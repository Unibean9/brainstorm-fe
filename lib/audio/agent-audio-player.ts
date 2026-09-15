type AudioChunkInput = {
  chunkBase64: string;
  encoding: "audio/mpeg" | "audio/wav" | "audio/webm" | "audio/pcm16";
  sampleRate?: number;
};

const AUDIO_LEAD_SECONDS = 0.03;
// Wait for a small amount of decoded audio before starting. Claude/TTS delivery is bursty:
// starting on the first sentence makes a later TTS request pause audible. This intentional
// ~1-second latency gives the scheduler enough jitter buffer to keep speech continuous.
const INITIAL_BUFFER_SECONDS = 1;

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function mimeFor(encoding: AudioChunkInput["encoding"]) {
  if (encoding === "audio/mpeg") return "audio/mpeg";
  if (encoding === "audio/webm") return "audio/webm";
  return "audio/wav";
}

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

/**
 * Gapless TTS player.
 *
 * The sidecar sends independent WAV files while Claude is still streaming text. An
 * HTMLAudioElement has to load and start each file separately, which creates an audible gap
 * between otherwise-overlapping chunks. Web Audio lets us decode each file as it arrives and
 * schedule it on one monotonic timeline, so the browser does not restart its media pipeline for
 * every chunk.
 */
export class AgentAudioPlayer {
  private decodeQueue: Promise<void> = Promise.resolve();
  private current: HTMLAudioElement | null = null;
  private objectUrls: string[] = [];
  private playing = false;
  private unlockPromise: Promise<void> | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nextStartTime = 0;
  private generation = 0;
  private pendingDecodes = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private bufferedBuffers: Array<{ buffer: AudioBuffer; onPlaybackStart?: () => void }> = [];
  private bufferedDuration = 0;
  private playbackStarted = false;
  private streamFinished = false;

  get isPlaying() {
    return this.playing;
  }

  /** Resolve after all already-enqueued chunks have been decoded and played. */
  async whenIdle(): Promise<void> {
    await this.decodeQueue;
    while (this.playing) {
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
  }

  /**
   * Unlock audio from a user gesture before TTS bytes arrive over SSE. AudioContext.resume()
   * keeps the permission for all scheduled TTS buffers, unlike calling play() on a new media
   * source after every chunk.
   */
  unlock(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (this.unlockPromise) return this.unlockPromise;

    const context = this.getAudioContext();
    if (!context) return Promise.resolve();

    this.unlockPromise = context
      .resume()
      .then(() => {
        // Start a one-sample silent source while the gesture is active. This is harmless but
        // helps browsers that require an actual source before considering the context unlocked.
        const source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 1, context.sampleRate);
        source.connect(this.gainNode ?? context.destination);
        source.start();
      })
      .catch(() => undefined);
    return this.unlockPromise;
  }

  /** Start a fresh streamed response while keeping the already-unlocked audio context. */
  beginStream() {
    this.bufferedBuffers = [];
    this.bufferedDuration = 0;
    this.playbackStarted = false;
    this.streamFinished = false;
    this.nextStartTime = 0;
    this.updatePlaying();
  }

  /** Queue a chunk immediately; decoding is ordered, playback is scheduled ahead of time. */
  enqueue(chunk: AudioChunkInput, onPlaybackStart?: () => void): Promise<void> {
    const generation = this.generation;
    this.pendingDecodes += 1;
    this.playing = true;

    this.decodeQueue = this.decodeQueue
      .then(async () => {
        if (generation !== this.generation) return;
        await this.unlockPromise?.catch(() => undefined);
        if (generation !== this.generation) return;

        const bytes = decodeBase64(chunk.chunkBase64);
        const context = this.getAudioContext();
        if (!context) {
          await this.playWithHtmlAudio(bytes, chunk.encoding, generation, onPlaybackStart);
          return;
        }

        try {
          const audioBuffer = await context.decodeAudioData(copyToArrayBuffer(bytes));
          if (generation === this.generation) {
            this.bufferedBuffers.push({ buffer: audioBuffer, onPlaybackStart });
            this.bufferedDuration += audioBuffer.duration;
            this.maybeStartPlayback(context, generation);
          }
        } catch {
          // Keep a usable fallback for older browsers/codecs. The normal WAV path uses Web
          // Audio and never reaches this branch.
          await this.playWithHtmlAudio(bytes, chunk.encoding, generation, onPlaybackStart);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (generation === this.generation) {
          this.pendingDecodes = Math.max(0, this.pendingDecodes - 1);
          this.updatePlaying();
        }
      });

    return this.whenIdle();
  }

  stop() {
    this.generation += 1;
    this.pendingDecodes = 0;
    this.decodeQueue = Promise.resolve();
    this.nextStartTime = 0;
    this.bufferedBuffers = [];
    this.bufferedDuration = 0;
    this.playbackStarted = false;
    this.streamFinished = false;
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // A source may already have ended.
      }
    }
    this.activeSources.clear();
    this.current?.pause();
    this.current = null;
    this.playing = false;
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  /** Play one complete audio response, replacing anything currently queued. */
  playOnce(chunk: AudioChunkInput): Promise<void> {
    this.stop();
    const done = this.enqueue(chunk);
    this.finish();
    return done;
  }

  /** Mark the end of a streamed response and flush a short response below the buffer target. */
  finish() {
    this.streamFinished = true;
    const context = this.getAudioContext();
    if (context) this.maybeStartPlayback(context, this.generation);
    this.updatePlaying();
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.audioContext) return this.audioContext;

    const AudioContextCtor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AudioContextCtor) return null;

    try {
      this.audioContext = new AudioContextCtor();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1;
      this.gainNode.connect(this.audioContext.destination);
      return this.audioContext;
    } catch {
      this.audioContext = null;
      this.gainNode = null;
      return null;
    }
  }

  private schedule(
    buffer: AudioBuffer,
    context: AudioContext,
    generation: number,
    onPlaybackStart?: () => void
  ) {
    if (generation !== this.generation) return;

    const start = Math.max(this.nextStartTime, context.currentTime + AUDIO_LEAD_SECONDS);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode ?? context.destination);
    source.onended = () => {
      this.activeSources.delete(source);
      this.updatePlaying();
    };
    this.activeSources.add(source);
    this.nextStartTime = start + buffer.duration;
    source.start(start);
    if (onPlaybackStart) {
      const delay = Math.max(0, (start - context.currentTime) * 1000);
      window.setTimeout(() => {
        if (generation === this.generation && this.activeSources.has(source)) onPlaybackStart();
      }, delay);
    }
  }

  private maybeStartPlayback(context: AudioContext, generation: number) {
    if (generation !== this.generation || this.playbackStarted || !this.bufferedBuffers.length)
      return;
    if (!this.streamFinished && this.bufferedDuration < INITIAL_BUFFER_SECONDS) return;

    this.playbackStarted = true;
    const buffers = this.bufferedBuffers;
    this.bufferedBuffers = [];
    this.bufferedDuration = 0;
    let startedCallbackUsed = false;
    for (const item of buffers) {
      const onPlaybackStart = startedCallbackUsed ? undefined : item.onPlaybackStart;
      if (onPlaybackStart) startedCallbackUsed = true;
      this.schedule(item.buffer, context, generation, onPlaybackStart);
    }
    this.updatePlaying();
  }

  private async playWithHtmlAudio(
    bytes: Uint8Array,
    encoding: AudioChunkInput["encoding"],
    generation: number,
    onPlaybackStart?: () => void
  ): Promise<void> {
    if (generation !== this.generation) return;
    const url = URL.createObjectURL(
      new Blob([copyToArrayBuffer(bytes)], { type: mimeFor(encoding) })
    );
    this.objectUrls.push(url);

    await new Promise<void>(async (resolve) => {
      await this.unlockPromise?.catch(() => undefined);
      if (generation !== this.generation) {
        URL.revokeObjectURL(url);
        resolve();
        return;
      }

      const audio = this.current ?? new Audio();
      audio.preload = "auto";
      audio.setAttribute("playsinline", "");
      audio.muted = false;
      audio.src = url;
      this.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.objectUrls = this.objectUrls.filter((item) => item !== url);
        if (this.current === audio) this.current = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.objectUrls = this.objectUrls.filter((item) => item !== url);
        if (this.current === audio) this.current = null;
        resolve();
      };
      void audio.play().then(
        () => {
          if (this.current === audio && this.playing) onPlaybackStart?.();
        },
        () => {
          this.playing = false;
          resolve();
        }
      );
    });
  }

  private updatePlaying() {
    this.playing =
      this.pendingDecodes > 0 || this.activeSources.size > 0 || this.bufferedBuffers.length > 0;
  }
}
