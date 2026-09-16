import assert from "node:assert/strict";

import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import { AgentAudioPlayer } from "@/lib/audio/agent-audio-player";
import { applyTurnStreamEvent } from "@/lib/brainstorm/apply-turn-event";

type DecodeRequest = {
  resolve: (buffer: AudioBuffer) => void;
  reject: (error: Error) => void;
};

class FakeSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  startTime: number | null = null;

  constructor(private readonly context: FakeAudioContext) {}

  connect() {}

  start(at: number) {
    this.startTime = at;
    this.context.sources.push(this);
  }

  stop() {
    this.onended?.();
  }

  end() {
    this.onended?.();
  }
}

class FakeAudioContext {
  readonly sampleRate = 48_000;
  readonly destination = {} as AudioDestinationNode;
  readonly sources: FakeSource[] = [];
  readonly decodes: DecodeRequest[] = [];
  state: AudioContextState = "running";
  currentTime = 0;

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  close() {
    this.state = "closed";
    return Promise.resolve();
  }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    return {
      duration: length / sampleRate,
      sampleRate,
    } as AudioBuffer;
  }

  createBufferSource() {
    return new FakeSource(this) as unknown as AudioBufferSourceNode;
  }

  decodeAudioData(bytes: ArrayBuffer) {
    void bytes;
    return new Promise<AudioBuffer>((resolve, reject) => {
      this.decodes.push({ resolve, reject });
    });
  }

  resolveDecode(duration = 0.25) {
    const request = this.decodes.shift();
    assert.ok(request, "expected a pending decode");
    request.resolve({ duration, sampleRate: this.sampleRate } as AudioBuffer);
  }

  rejectDecode(message = "bad wav") {
    const request = this.decodes.shift();
    assert.ok(request, "expected a pending decode");
    request.reject(new Error(message));
  }

  advance(seconds: number) {
    this.currentTime = seconds;
  }
}

function installFakeAudioContext() {
  const contexts: FakeAudioContext[] = [];
  class TestAudioContext extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  }
  Object.assign(globalThis, {
    window: { AudioContext: TestAudioContext },
    atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
  });
  return contexts;
}

function envelope<T>(data: T) {
  return { sessionId: "s", turnId: "t", ts: Date.now(), data };
}

async function testOutOfOrderDecodeAndContiguity() {
  const contexts = installFakeAudioContext();
  const telemetry: Array<{
    type: string;
    gapMs?: number;
    traceId?: string;
    atMs?: number;
    textAtMs?: number;
  }> = [];
  let segmentStarts = 0;
  const player = new AgentAudioPlayer({
    onTelemetry: (event) => telemetry.push(event),
    onSegmentStart: () => segmentStarts++,
  });
  player.beginTurn("m");
  player.noteTextEvent("m", 5);
  player.markSegment({
    messageId: "m",
    segmentId: "seg",
    traceId: "trace-1",
    textStart: 0,
    textEnd: 5,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const first = player.enqueue({
    chunkBase64: "AA==",
    encoding: "audio/wav",
    messageId: "m",
    segmentId: "seg",
    traceId: "trace-1",
    chunkIndex: 1,
    sampleRate: 48_000,
    startSample: 12_000,
    sampleCount: 12_000,
  });
  const second = player.enqueue({
    chunkBase64: "AA==",
    encoding: "audio/wav",
    messageId: "m",
    segmentId: "seg",
    traceId: "trace-1",
    chunkIndex: 0,
    sampleRate: 48_000,
    startSample: 0,
    sampleCount: 12_000,
  });
  player.markSegmentDone({
    messageId: "m",
    segmentId: "seg",
    totalSamples: 24_000,
    sampleRate: 48_000,
  });
  player.markAudioDone("m");

  const context = contexts[0]!;
  context.resolveDecode();
  await Promise.resolve();
  assert.equal(context.sources.length, 0, "later decode must wait for the missing first chunk");
  context.resolveDecode();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(context.sources.length, 2);
  assert.equal(telemetry.find((event) => event.type === "browser-receive")?.traceId, "trace-1");
  assert.equal(telemetry.find((event) => event.type === "decode-ready")?.traceId, "trace-1");
  assert.ok(
    telemetry
      .filter((event) => event.type === "playback-start")
      .every((event) => event.traceId === "trace-1"),
    "trace ID must survive scheduled and output-estimate playback telemetry"
  );
  const starts = context.sources.map((source) => source.startTime);
  assert.deepEqual(starts, [0.1, 0.35]);
  assert.equal(segmentStarts, 0, "segment highlight waits for the scheduled output time");
  context.advance(0.1);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(segmentStarts, 1);
  const receiveAt = telemetry.find((event) => event.type === "browser-receive")?.atMs ?? 0;
  const textDrift = telemetry.find((event) => event.type === "text-audio-drift");
  assert.equal(textDrift?.traceId, "trace-1");
  assert.ok(
    (textDrift?.textAtMs ?? 0) < receiveAt - 10,
    "enqueue must preserve the existing same-span text timestamp"
  );
  assert.equal(
    telemetry.filter((event) => event.type === "inter-chunk-gap" || event.type === "segment-gap")
      .length,
    0
  );

  for (const source of context.sources) (source as unknown as FakeSource).end();
  await Promise.all([first, second, player.whenIdle()]);
  assert.equal(player.isPlaying, false);
}

async function testCancellationAndStaleCallbacks() {
  const contexts = installFakeAudioContext();
  let starts = 0;
  const player = new AgentAudioPlayer({ onSegmentStart: () => starts++ });
  player.beginTurn("old");
  player.markSegment({ messageId: "old", segmentId: "seg", textStart: 0, textEnd: 4 });
  const work = player.enqueue({
    chunkBase64: "AA==",
    encoding: "audio/wav",
    messageId: "old",
    segmentId: "seg",
    chunkIndex: 0,
    startSample: 0,
    sampleRate: 48_000,
  });
  const idle = player.whenIdle();
  player.stop();
  contexts[0]!.resolveDecode();
  await Promise.all([work, idle]);
  assert.equal(contexts[0]!.sources.length, 0);
  assert.equal(starts, 0, "cancelled generation cannot publish segment callbacks");
  assert.equal(player.isPlaying, false);
}

async function testInitialStreamingBufferPreventsFirstChunkUnderrun() {
  const contexts = installFakeAudioContext();
  const player = new AgentAudioPlayer();
  player.beginTurn("buffered");
  player.markSegment({ messageId: "buffered", segmentId: "seg" });
  const first = player.enqueue({
    chunkBase64: "AA==",
    encoding: "audio/wav",
    messageId: "buffered",
    segmentId: "seg",
    chunkIndex: 0,
  });
  contexts[0]!.resolveDecode(0.25);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(contexts[0]!.sources.length, 0, "the first short chunk should wait for a decoded cushion");

  const second = player.enqueue({
    chunkBase64: "AA==",
    encoding: "audio/wav",
    messageId: "buffered",
    segmentId: "seg",
    chunkIndex: 1,
  });
  contexts[0]!.resolveDecode(0.25);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(contexts[0]!.sources.length, 2, "the scheduler should start once the cushion is ready");

  player.markSegmentDone({ messageId: "buffered", segmentId: "seg" });
  player.markAudioDone("buffered");
  for (const source of contexts[0]!.sources) source.end();
  await Promise.all([first, second, player.whenIdle()]);
}

async function testDecodeErrorIsObservable() {
  const contexts = installFakeAudioContext();
  const errors: string[] = [];
  const player = new AgentAudioPlayer({ onError: (error) => errors.push(error.message) });
  player.beginTurn("m");
  player.markSegment({ messageId: "m", segmentId: "seg", textStart: 0, textEnd: 4 });
  const work = player.enqueue({
    chunkBase64: "AA==",
    encoding: "audio/wav",
    messageId: "m",
    segmentId: "seg",
  });
  player.markAudioDone("m");
  contexts[0]!.rejectDecode();
  await assert.rejects(work, /bad wav/);
  await player.whenIdle();
  assert.deepEqual(errors, ["bad wav"]);
  assert.equal(player.isPlaying, false);
}

async function testFinalTextKeepsFullTranscriptAndRejectsMismatchedOffsets() {
  installFakeAudioContext();
  const player = new AgentAudioPlayer();
  const transcript: TranscriptEntry[] = [];
  const warnings: string[] = [];
  const ctx = {
    setState: () => {},
    setEngineStep: () => {},
    setFocusNodeId: () => {},
    setSessionPhaseKey: () => {},
    setError: () => {},
    setWarning: (message: string | null) => {
      if (message) warnings.push(message);
    },
    setTranscript: (update: (prev: TranscriptEntry[]) => TranscriptEntry[]) => {
      transcript.splice(0, transcript.length, ...update(transcript));
    },
    audio: player,
  };

  applyTurnStreamEvent("agent-run-started", envelope({ messageId: "m" }), ctx);
  applyTurnStreamEvent("text-delta", envelope({ messageId: "m", delta: "hello world" }), ctx);
  applyTurnStreamEvent(
    "agent-audio-segment",
    envelope({ messageId: "m", segmentId: "seg", textStart: 0, textEnd: 5 }),
    ctx
  );
  applyTurnStreamEvent(
    "text-done",
    envelope({ messageId: "m", text: "different final text", phaseKey: "framing" }),
    ctx
  );
  assert.equal(transcript[0]?.text, "different final text");
  assert.equal(transcript[0]?.audioSegments, undefined);
  assert.deepEqual(warnings, []);

  // A terminal error must release the pending turn even without agent-audio-done.
  applyTurnStreamEvent("error", envelope({ code: "turn_failed", recoverable: false }), ctx);
  assert.equal(player.isPlaying, false);
  await player.whenIdle();

  // The next turn must get fresh completion state, including a short/audio-free reply.
  applyTurnStreamEvent("agent-run-started", envelope({ messageId: "next" }), ctx);
  assert.equal(player.isPlaying, true);
  applyTurnStreamEvent("agent-audio-done", envelope({ messageId: "next" }), ctx);
  await player.whenIdle();
  assert.equal(player.isPlaying, false);
}

async function main() {
  await testOutOfOrderDecodeAndContiguity();
  await testInitialStreamingBufferPreventsFirstChunkUnderrun();
  await testCancellationAndStaleCallbacks();
  await testDecodeErrorIsObservable();
  await testFinalTextKeepsFullTranscriptAndRejectsMismatchedOffsets();
  console.log("agent audio tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
