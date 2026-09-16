export type AgentAudioSegmentMetadata = {
  messageId: string;
  segmentId: string;
  traceId?: string;
  textStart?: number;
  textEnd?: number;
};

export type AudioChunkInput = {
  chunkBase64: string;
  encoding: "audio/mpeg" | "audio/wav" | "audio/webm" | "audio/pcm16";
  messageId?: string;
  segmentId?: string;
  traceId?: string;
  chunkIndex?: number;
  sampleRate?: number;
  startSample?: number;
  sampleCount?: number;
};

export type AgentAudioTelemetry = {
  type:
    | "browser-receive"
    | "decode-ready"
    | "playback-start"
    | "inter-chunk-gap"
    | "segment-gap"
    | "buffered"
    | "underrun"
    | "text-audio-drift"
    | "audio-error";
  atMs: number;
  audioTime?: number;
  messageId?: string;
  segmentId?: string;
  traceId?: string;
  chunkIndex?: number;
  durationMs?: number;
  bufferedDurationMs?: number;
  gapMs?: number;
  driftMs?: number;
  textAtMs?: number;
  alignment?: "browser-receive";
  phase?: "scheduled" | "output-estimate";
  error?: string;
};

export type AgentAudioPlayerOptions = {
  onTelemetry?: (event: AgentAudioTelemetry) => void;
  onError?: (error: Error, input?: AudioChunkInput) => void;
  onSegmentStart?: (segment: AgentAudioSegmentMetadata) => void;
  onSegmentDone?: (segment: AgentAudioSegmentMetadata) => void;
};

type AudioContextConstructor = new () => AudioContext;

type PendingChunk = {
  id: number;
  generation: number;
  input: AudioChunkInput;
  messageId: string;
  segmentKey: string;
  arrivalOrder: number;
  receivedAtMs: number;
  decoded: AudioBuffer | null;
  decodePending: boolean;
  scheduled: boolean;
  settled: boolean;
  source: AudioBufferSourceNode | null;
  onPlaybackStart?: () => void;
  actualStartTimer: ReturnType<typeof setTimeout> | null;
  actualStarted: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
};

type SegmentState = {
  key: string;
  metadata: AgentAudioSegmentMetadata;
  messageId: string;
  order: number;
  done: boolean;
  started: boolean;
  startPending: boolean;
  completed: boolean;
  totalSamples?: number;
  sampleRate?: number;
  baseAudioTime: number | null;
  lastScheduledEnd: number | null;
  lastStartSample: number | null;
  receivedAtMs: number;
  textEventAtMs: number | null;
  chunks: PendingChunk[];
};

type TextProgress = {
  length: number;
  updates: Array<{ end: number; atMs: number }>;
};

const LEGACY_SEGMENT_ID = "__legacy__";
const START_LEAD_SECONDS = 0.1;
const MIN_START_BUFFER_SECONDS = 0.35;
const GAP_EPSILON_SECONDS = 0.006;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? scope.webkitAudioContext ?? null;
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof atob !== "function") throw new Error("Audio decoding is unavailable in this browser");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toError(error: unknown, fallback = "Audio playback failed") {
  return error instanceof Error ? error : new Error(fallback);
}

/**
 * Browser TTS player.
 *
 * One AudioContext is kept for the lifetime of the player. Incoming WAVs are
 * decoded concurrently, then scheduled in segment/sample-clock order. The
 * player deliberately reports media failures to its caller; a failed chunk is
 * never silently discarded.
 */
export class AgentAudioPlayer {
  private readonly options: AgentAudioPlayerOptions;
  private context: AudioContext | null = null;
  private contextReady: Promise<void> | null = null;
  private disposed = false;
  private generation = 0;
  private nextChunkId = 1;
  private nextArrivalOrder = 1;
  private activeMessageId: string | null = null;
  private audioDoneMessages = new Set<string>();
  private pendingMessages = new Set<string>();
  private chunks = new Set<PendingChunk>();
  private activeSources = new Set<AudioBufferSourceNode>();
  private segments = new Map<string, SegmentState>();
  private segmentOrder: string[] = [];
  private lastScheduledEnd: number | null = null;
  private lastScheduledSegmentKey: string | null = null;
  private idleWaiters: Array<() => void> = [];
  private textProgress = new Map<string, TextProgress>();

  constructor(options: AgentAudioPlayerOptions = {}) {
    this.options = options;
  }

  get isPlaying() {
    return this.pendingMessages.size > 0 || this.chunks.size > 0 || this.activeSources.size > 0;
  }

  /** The same browser clock used by receive/playback telemetry. */
  static browserNow() {
    return nowMs();
  }

  /**
   * Resume the one shared AudioContext from a user gesture. This method is
   * intentionally safe to call repeatedly from Play and Send actions.
   */
  unlock(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error("Audio player has been disposed"));
    const context = this.ensureContext();
    if (!context) return Promise.resolve();
    if (context.state === "running") return Promise.resolve();
    if (!this.contextReady) {
      const pending = context
        .resume()
        .then(() => {
          if (context.state !== "running") throw new Error("AudioContext did not resume");
          const silent = context.createBufferSource();
          silent.buffer = context.createBuffer(1, 1, context.sampleRate);
          silent.connect(context.destination);
          silent.start();
        })
        .catch((error) => {
          const normalized = toError(error, "Browser audio permission was denied");
          this.reportError(normalized);
          throw normalized;
        });
      const settled = pending.finally(() => {
        if (this.contextReady === settled) this.contextReady = null;
      });
      this.contextReady = settled;
    }
    return this.contextReady;
  }

  /** Begin a new turn and invalidate callbacks from the previous turn. */
  beginTurn(messageId: string) {
    if (this.disposed) return;
    this.stop();
    this.activeMessageId = messageId;
    this.pendingMessages.add(messageId);
    this.audioDoneMessages.delete(messageId);
  }

  /** Record a backend segment before its chunks arrive. */
  markSegment(segment: AgentAudioSegmentMetadata) {
    if (this.disposed) return;
    if (this.activeMessageId && this.activeMessageId !== segment.messageId && this.isPlaying) {
      this.beginTurn(segment.messageId);
    }
    this.activeMessageId ??= segment.messageId;
    this.pendingMessages.add(segment.messageId);
    const key = this.segmentKey(segment.messageId, segment.segmentId);
    const existing = this.segments.get(key);
    const receivedAtMs = existing?.receivedAtMs ?? nowMs();
    const textEventAtMs =
      segment.textStart == null
        ? null
        : (this.textTimestampForRange(segment.messageId, segment.textStart) ?? null);
    if (existing) {
      existing.metadata = { ...existing.metadata, ...segment };
      existing.receivedAtMs = receivedAtMs;
      existing.textEventAtMs = textEventAtMs ?? existing.textEventAtMs;
      return;
    }
    const state: SegmentState = {
      key,
      metadata: segment,
      messageId: segment.messageId,
      order: this.segmentOrder.length,
      done: false,
      started: false,
      startPending: false,
      completed: false,
      baseAudioTime: null,
      lastScheduledEnd: null,
      lastStartSample: null,
      receivedAtMs,
      textEventAtMs,
      chunks: [],
    };
    this.segments.set(key, state);
    this.segmentOrder.push(key);
  }

  /** Mark one backend segment complete; decoded work may still be pending. */
  markSegmentDone(
    segment: AgentAudioSegmentMetadata & { totalSamples?: number; sampleRate?: number }
  ): void {
    if (this.disposed) return;
    const key = this.segmentKey(segment.messageId, segment.segmentId);
    const state = this.segments.get(key);
    if (!state) {
      this.markSegment(segment);
      this.markSegmentDone(segment);
      return;
    }
    state.done = true;
    state.totalSamples = segment.totalSamples;
    state.sampleRate = segment.sampleRate;
    void this.scheduleDecoded();
    this.maybeResolveIdle();
  }

  /** Mark the whole SSE audio stream complete, including audio-free turns. */
  markAudioDone(messageId = this.activeMessageId ?? "__legacy__") {
    if (this.disposed) return;
    this.audioDoneMessages.add(messageId);
    this.pendingMessages.add(messageId);
    for (const segment of this.segments.values()) {
      if (segment.messageId === messageId) segment.done = true;
    }
    this.maybeResolveIdle();
    void this.scheduleDecoded();
  }

  /** Called when SSE closes without a usable audio-done event. */
  markStreamComplete(messageId = this.activeMessageId ?? "__legacy__") {
    this.markAudioDone(messageId);
  }

  /** Capture text arrival using the same browser clock as audio telemetry. */
  noteTextEvent(messageId: string, deltaLength = 0) {
    const atMs = nowMs();
    const progress = this.textProgress.get(messageId) ?? { length: 0, updates: [] };
    if (deltaLength > 0) {
      progress.length += deltaLength;
      progress.updates.push({ end: progress.length, atMs });
    }
    this.textProgress.set(messageId, progress);
    for (const segment of this.segments.values()) {
      if (segment.messageId === messageId && !segment.textEventAtMs) {
        segment.textEventAtMs = atMs;
      }
    }
  }

  /**
   * Decode immediately and let the scheduler place it by sample clock. Decode
   * completion order is intentionally independent from arrival order.
   */
  enqueue(input: AudioChunkInput, callbacks?: { onPlaybackStart?: () => void }): Promise<void> {
    if (this.disposed) return Promise.reject(new Error("Audio player has been disposed"));
    const messageId = input.messageId ?? this.activeMessageId ?? "__legacy__";
    if (this.activeMessageId && this.activeMessageId !== messageId && this.isPlaying) {
      this.beginTurn(messageId);
    }
    this.activeMessageId ??= messageId;
    this.pendingMessages.add(messageId);
    const segmentId = input.segmentId ?? LEGACY_SEGMENT_ID;
    this.markSegment({ messageId, segmentId });
    const segmentKey = this.segmentKey(messageId, segmentId);
    const segment = this.segments.get(segmentKey)!;
    const id = this.nextChunkId++;
    const item = {
      id,
      generation: this.generation,
      input,
      messageId,
      segmentKey,
      arrivalOrder: this.nextArrivalOrder++,
      receivedAtMs: nowMs(),
      decoded: null,
      decodePending: true,
      scheduled: false,
      settled: false,
      source: null,
      onPlaybackStart: callbacks?.onPlaybackStart,
      actualStartTimer: null,
      actualStarted: false,
    } as PendingChunk;
    this.chunks.add(item);
    segment.chunks.push(item);
    this.emit({
      type: "browser-receive",
      messageId,
      segmentId,
      traceId: input.traceId,
      chunkIndex: input.chunkIndex,
    });

    const promise = new Promise<void>((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
    void this.decode(item);
    return promise;
  }

  /** Resolve when no decode, scheduled, or active media work remains. */
  whenIdle(): Promise<void> {
    if (!this.isPlaying) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  /** Stop media and invalidate every callback from the previous generation. */
  stop() {
    this.generation += 1;
    for (const source of this.activeSources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // A source may already have ended; generation cancellation is enough.
      }
    }
    this.activeSources.clear();
    for (const item of this.chunks) {
      if (item.actualStartTimer) clearTimeout(item.actualStartTimer);
      if (!item.settled) {
        item.settled = true;
        item.resolve();
      }
    }
    this.chunks.clear();
    this.segments.clear();
    this.segmentOrder = [];
    this.pendingMessages.clear();
    this.audioDoneMessages.clear();
    this.textProgress.clear();
    this.activeMessageId = null;
    this.lastScheduledEnd = null;
    this.lastScheduledSegmentKey = null;
    this.resolveIdleWaiters();
  }

  /** Stop and close the shared context when the owning session unmounts. */
  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    const context = this.context;
    this.context = null;
    this.contextReady = null;
    if (context && context.state !== "closed") {
      void context.close().catch((error) => this.reportError(toError(error)));
    }
  }

  /** Compatibility helper for callers that have one complete WAV. */
  playOnce(input: AudioChunkInput): Promise<void> {
    const messageId = input.messageId ?? "__play-once__";
    this.beginTurn(messageId);
    const segmentId = input.segmentId ?? LEGACY_SEGMENT_ID;
    this.markSegment({ messageId, segmentId });
    const playback = this.enqueue({ ...input, messageId, segmentId });
    this.markSegmentDone({ messageId, segmentId });
    this.markAudioDone(messageId);
    return playback;
  }

  private async decode(item: PendingChunk) {
    try {
      const context = this.ensureContext();
      if (!context) throw new Error("Web Audio is unavailable in this browser");
      const bytes = decodeBase64(item.input.chunkBase64);
      const decoded = await context.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
      if (item.generation !== this.generation || item.settled || this.disposed) return;
      item.decoded = decoded;
      item.decodePending = false;
      this.emit({
        type: "decode-ready",
        messageId: item.messageId,
        segmentId: item.input.segmentId,
        traceId: item.input.traceId,
        chunkIndex: item.input.chunkIndex,
        durationMs: decoded.duration * 1000,
      });
      await this.scheduleDecoded();
    } catch (error) {
      const normalized = toError(error, "Audio chunk could not be decoded");
      if (item.generation !== this.generation || item.settled || this.disposed) return;
      item.decodePending = false;
      this.failChunk(item, normalized);
    }
  }

  private async scheduleDecoded() {
    if (this.disposed || !this.isPlaying) return;
    try {
      await this.ensureReady();
    } catch (error) {
      const normalized = toError(error, "Browser audio permission was denied");
      for (const item of [...this.chunks]) {
        if (!item.scheduled && !item.settled && !item.decodePending)
          this.failChunk(item, normalized);
      }
      return;
    }
    if (this.disposed) return;
    if (!this.hasInitialPlaybackBuffer()) return;

    let progressed = true;
    while (progressed) {
      progressed = false;
      const segment = this.nextSchedulableSegment();
      if (!segment) break;
      const item = this.nextSchedulableChunk(segment);
      if (!item) {
        if (this.segmentHasPendingDecode(segment)) break;
        if (segment.done) {
          this.completeSegmentIfReady(segment);
          continue;
        }
        break;
      }
      this.scheduleChunk(segment, item);
      progressed = true;
    }
    this.maybeResolveIdle();
  }

  /**
   * Streaming TTS commonly delivers the next chunk after the first one has
   * already ended. Hold the first source until a small decoded cushion exists
   * so normal network jitter does not become an audible hole. A short or
   * completed turn is allowed through immediately.
   */
  private hasInitialPlaybackBuffer() {
    const segment = this.nextSchedulableSegment();
    if (!segment || segment.baseAudioTime != null || segment.done) return true;
    const decodedDuration = segment.chunks.reduce(
      (total, item) => total + (item.decoded?.duration ?? 0),
      0
    );
    return decodedDuration >= MIN_START_BUFFER_SECONDS;
  }

  private nextSchedulableSegment() {
    for (const key of this.segmentOrder) {
      const segment = this.segments.get(key);
      if (!segment || segment.completed) continue;
      const unscheduled = segment.chunks.some((item) => !item.scheduled && !item.settled);
      if (unscheduled || !segment.done) return segment;
    }
    return null;
  }

  private nextSchedulableChunk(segment: SegmentState) {
    const pending = segment.chunks
      .filter((item) => !item.scheduled && !item.settled)
      .sort((a, b) => {
        const aStart = a.input.startSample;
        const bStart = b.input.startSample;
        if (aStart != null && bStart != null && aStart !== bStart) return aStart - bStart;
        if (a.input.chunkIndex != null && b.input.chunkIndex != null) {
          return a.input.chunkIndex - b.input.chunkIndex;
        }
        return a.arrivalOrder - b.arrivalOrder;
      });
    const first = pending[0];
    if (!first || first.decodePending || !first.decoded) return null;
    return first;
  }

  private segmentHasPendingDecode(segment: SegmentState) {
    return segment.chunks.some((item) => !item.scheduled && !item.settled && item.decodePending);
  }

  private scheduleChunk(segment: SegmentState, item: PendingChunk) {
    const context = this.context;
    const buffer = item.decoded;
    if (!context || !buffer) return;
    const sampleRate = item.input.sampleRate ?? buffer.sampleRate;
    const startSample = item.input.startSample;
    const currentTime = context.currentTime;
    const previousEnd = segment.lastScheduledEnd ?? this.lastScheduledEnd;
    let rawStart =
      segment.baseAudioTime == null
        ? previousEnd == null
          ? currentTime + START_LEAD_SECONDS
          : previousEnd
        : startSample == null
          ? (previousEnd ?? segment.baseAudioTime)
          : segment.baseAudioTime + startSample / sampleRate;
    const minStart = Math.max(currentTime + 0.005, previousEnd ?? -Infinity);
    const originalRawStart = rawStart;
    if (rawStart < minStart) {
      // A late decode cannot reuse the old sample anchor: doing so would place
      // the next chunk in the past and overlap the previous source.
      if (segment.baseAudioTime != null && startSample != null) {
        segment.baseAudioTime = minStart - startSample / sampleRate;
      }
      rawStart = minStart;
    }
    const scheduleAt = Math.max(rawStart, minStart);
    const duration = buffer.duration;
    const scheduledEnd = scheduleAt + duration;
    const lateBy = currentTime - originalRawStart;
    if (lateBy > 0.005) {
      this.emit({
        type: "underrun",
        audioTime: currentTime,
        messageId: item.messageId,
        segmentId: item.input.segmentId,
        traceId: item.input.traceId,
        chunkIndex: item.input.chunkIndex,
        gapMs: lateBy * 1000,
      });
    }
    if (previousEnd != null && rawStart - previousEnd > GAP_EPSILON_SECONDS) {
      this.emit({
        type: segment.key === this.lastScheduledSegmentKey ? "inter-chunk-gap" : "segment-gap",
        audioTime: currentTime,
        messageId: item.messageId,
        segmentId: item.input.segmentId,
        traceId: item.input.traceId,
        chunkIndex: item.input.chunkIndex,
        gapMs: (rawStart - previousEnd) * 1000,
      });
    }
    if (segment.baseAudioTime == null) {
      segment.baseAudioTime =
        startSample == null ? scheduleAt : scheduleAt - startSample / sampleRate;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    item.scheduled = true;
    item.source = source;
    segment.lastStartSample = startSample ?? segment.lastStartSample;
    segment.lastScheduledEnd = scheduledEnd;
    this.lastScheduledEnd = scheduledEnd;
    this.lastScheduledSegmentKey = segment.key;
    this.activeSources.add(source);
    this.emit({
      type: "playback-start",
      audioTime: scheduleAt,
      messageId: item.messageId,
      segmentId: item.input.segmentId,
      traceId: item.input.traceId,
      chunkIndex: item.input.chunkIndex,
      durationMs: duration * 1000,
      phase: "scheduled",
    });
    this.emit({
      type: "buffered",
      audioTime: currentTime,
      messageId: item.messageId,
      segmentId: item.input.segmentId,
      traceId: item.input.traceId,
      bufferedDurationMs: Math.max(0, scheduledEnd - currentTime) * 1000,
    });
    try {
      source.onended = () => {
        if (item.generation !== this.generation || this.disposed) return;
        if (item.actualStartTimer) {
          clearTimeout(item.actualStartTimer);
          item.actualStartTimer = null;
        }
        if (!segment.started) segment.startPending = false;
        this.activeSources.delete(source);
        this.settleChunk(item);
        this.completeSegmentIfReady(segment);
        if (this.activeSources.size === 0 && this.hasUnscheduledWork()) {
          this.emit({
            type: "underrun",
            audioTime: context.currentTime,
            messageId: item.messageId,
            segmentId: item.input.segmentId,
            traceId: item.input.traceId,
          });
        }
        void this.scheduleDecoded();
      };
      source.start(scheduleAt);
      this.scheduleActualStart(segment, item, scheduleAt);
    } catch (error) {
      this.activeSources.delete(source);
      this.failChunk(item, toError(error));
    }
  }

  private scheduleActualStart(segment: SegmentState, item: PendingChunk, scheduleAt: number) {
    const context = this.context;
    if (!context) return;
    if (item.actualStarted) return;
    if (!segment.started) segment.startPending = true;
    const generation = item.generation;
    const check = () => {
      if (generation !== this.generation || item.settled || this.disposed) return;
      if (context.state !== "running" || context.currentTime + 0.002 < scheduleAt) {
        item.actualStartTimer = setTimeout(check, 16);
        return;
      }
      item.actualStartTimer = null;
      if (item.actualStarted) return;
      item.actualStarted = true;
      const actualAtMs = nowMs();
      item.onPlaybackStart?.();
      this.emit({
        type: "playback-start",
        audioTime: context.currentTime,
        messageId: segment.messageId,
        segmentId: segment.metadata.segmentId,
        traceId: segment.metadata.traceId,
        chunkIndex: item.input.chunkIndex,
        phase: "output-estimate",
      });
      if (!segment.started) {
        segment.startPending = false;
        segment.started = true;
        this.options.onSegmentStart?.(segment.metadata);
        const textAt = segment.textEventAtMs ?? segment.receivedAtMs;
        this.emit({
          type: "text-audio-drift",
          messageId: segment.messageId,
          segmentId: segment.metadata.segmentId,
          traceId: segment.metadata.traceId,
          driftMs: actualAtMs - textAt,
          textAtMs: textAt,
          alignment: "browser-receive",
        });
      }
    };
    const delay = Math.max(0, (scheduleAt - context.currentTime) * 1000 - 4);
    item.actualStartTimer = setTimeout(check, delay);
  }

  private completeSegmentIfReady(segment: SegmentState) {
    if (segment.completed || !segment.done) return;
    if (segment.chunks.some((item) => !item.settled)) return;
    segment.completed = true;
    this.options.onSegmentDone?.(segment.metadata);
  }

  private hasUnscheduledWork() {
    return [...this.chunks].some((item) => !item.scheduled && !item.settled);
  }

  private settleChunk(item: PendingChunk) {
    if (item.settled) return;
    item.settled = true;
    this.chunks.delete(item);
    item.resolve();
    this.maybeResolveIdle();
  }

  private failChunk(item: PendingChunk, error: Error) {
    if (item.settled) return;
    if (item.actualStartTimer) {
      clearTimeout(item.actualStartTimer);
      item.actualStartTimer = null;
    }
    item.settled = true;
    this.chunks.delete(item);
    this.reportError(error, item.input);
    item.reject(error);
    const segment = this.segments.get(item.segmentKey);
    if (segment) this.completeSegmentIfReady(segment);
    this.maybeResolveIdle();
    void this.scheduleDecoded();
  }

  private maybeResolveIdle() {
    if (this.pendingMessages.size === 0 || this.chunks.size > 0 || this.activeSources.size > 0)
      return;
    for (const messageId of [...this.pendingMessages]) {
      if (this.audioDoneMessages.has(messageId)) this.pendingMessages.delete(messageId);
    }
    if (this.pendingMessages.size === 0) this.resolveIdleWaiters();
  }

  private resolveIdleWaiters() {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  private ensureContext() {
    if (this.context) return this.context;
    const Constructor = getAudioContextConstructor();
    if (!Constructor) return null;
    this.context = new Constructor();
    return this.context;
  }

  private async ensureReady() {
    const context = this.ensureContext();
    if (!context) throw new Error("Web Audio is unavailable in this browser");
    if (context.state === "running") return;
    await this.unlock();
  }

  private segmentKey(messageId: string, segmentId: string) {
    return `${messageId}:${segmentId}`;
  }

  private textTimestampForRange(messageId: string, textStart?: number) {
    const progress = this.textProgress.get(messageId);
    if (textStart == null || !progress || !progress.updates.length) return null;
    const offset = Math.max(0, textStart);
    return (
      progress.updates.find((update) => update.end > offset)?.atMs ??
      progress.updates.at(-1)?.atMs ??
      null
    );
  }

  private emit(event: Omit<AgentAudioTelemetry, "atMs">) {
    const payload = { ...event, atMs: nowMs() } satisfies AgentAudioTelemetry;
    try {
      this.options.onTelemetry?.(payload);
    } catch (error) {
      console.error("[AgentAudioPlayer] telemetry sink failed", error);
    }
  }

  private reportError(error: Error, input?: AudioChunkInput) {
    this.emit({
      type: "audio-error",
      messageId: input?.messageId,
      segmentId: input?.segmentId,
      traceId: input?.traceId,
      chunkIndex: input?.chunkIndex,
      error: error.message,
    });
    try {
      this.options.onError?.(error, input);
    } catch (callbackError) {
      console.error("[AgentAudioPlayer] error sink failed", callbackError);
    }
  }
}
