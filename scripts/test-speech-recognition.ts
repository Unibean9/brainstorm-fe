import assert from "node:assert/strict";

import { startBrowserSpeechRecognition } from "../lib/brainstorm/browser-speech-recognition";

type Handler<T> = ((event: T) => void) | null;

class FakeSpeechRecognition {
  static latest: FakeSpeechRecognition | null = null;

  lang = "";
  interimResults = false;
  continuous = false;
  onresult: Handler<{ results: Array<{ 0: { transcript: string } }> }> = null;
  onerror: Handler<{ error?: string }> = null;
  onend: Handler<void> = null;

  constructor() {
    FakeSpeechRecognition.latest = this;
  }

  start() {}

  stop() {
    this.onend?.();
  }

  abort() {
    this.onend?.();
  }

  emitResult(transcript: string) {
    this.onresult?.({ results: [{ 0: { transcript } }] });
  }

  emitError(error: string) {
    this.onerror?.({ error });
  }

  emitEnd() {
    this.onend?.();
  }
}

async function main() {
  (globalThis as { window?: unknown }).window = {
    SpeechRecognition: FakeSpeechRecognition,
  };

  const errors: string[] = [];
  const errored = startBrowserSpeechRecognition({
    onError: (error) => errors.push(error.message),
  });
  FakeSpeechRecognition.latest?.emitError("network");
  assert.deepEqual(errors, ["network"]);
  await assert.rejects(errored.stop(), /network/);

  const ended: string[] = [];
  const naturallyEnded = startBrowserSpeechRecognition({
    onEnd: (text) => ended.push(text),
  });
  FakeSpeechRecognition.latest?.emitResult("xin chao");
  FakeSpeechRecognition.latest?.emitEnd();
  assert.deepEqual(ended, ["xin chao"]);
  assert.equal(await naturallyEnded.stop(), "xin chao");

  let explicitEndCount = 0;
  const explicitlyStopped = startBrowserSpeechRecognition({
    onEnd: () => explicitEndCount++,
  });
  FakeSpeechRecognition.latest?.emitResult("dung lai");
  assert.equal(await explicitlyStopped.stop(), "dung lai");
  assert.equal(explicitEndCount, 0);

  console.log("Speech recognition regression checks passed");
}

void main();
