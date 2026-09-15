import assert from "node:assert/strict";

import { consumeSseStream } from "../lib/brainstorm/consume-sse-stream";

function responseFor(text: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } }
  );
}

async function parse(separator: string) {
  const events: Array<[string, unknown]> = [];
  const envelope = (data: Record<string, unknown>) => JSON.stringify({ sessionId: "s", turnId: "t", seq: 1, ts: 0, data });
  const stream = [
    `event: state${separator}data: ${envelope({ state: "processing" })}${separator}${separator}`,
    `event: text-done${separator}data: ${envelope({ messageId: "m", text: "Xin chào", phaseKey: "framing" })}${separator}${separator}`,
    `event: done${separator}data: [DONE]${separator}${separator}`,
  ].join("");

  await consumeSseStream(responseFor(stream), (event, value) => events.push([event, value]));
  return events;
}

const expected = [
  ["state", { sessionId: "s", turnId: "t", seq: 1, ts: 0, data: { state: "processing" } }],
  ["text-done", { sessionId: "s", turnId: "t", seq: 1, ts: 0, data: { messageId: "m", text: "Xin chào", phaseKey: "framing" } }],
] as Array<[string, unknown]>;

async function main() {
  assert.deepEqual(await parse("\n"), expected);
  assert.deepEqual(await parse("\r\n"), expected);
  console.log("SSE parser regression checks passed");
}

void main();
