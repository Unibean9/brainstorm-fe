import type { StreamEnvelope } from "@/types/brainstorm-stream";

import { parseApiErrorBody } from "@/lib/brainstorm/parse-api-error";

export type SseEventHandler = (event: string, envelope: StreamEnvelope<unknown>) => void;

/**
 * Parse SSE (`text/event-stream`) từ Response body.
 * BE gửi: event + data (JSON envelope).
 */
export async function consumeSseStream(
  response: Response,
  onEvent: SseEventHandler,
  signal?: AbortSignal
): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw parseApiErrorBody(text, response.status);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is not readable");

  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];

  const flush = () => {
    if (!dataLines.length) {
      eventName = "message";
      return;
    }
    const raw = dataLines.join("\n");
    dataLines = [];
    const name = eventName;
    eventName = "message";

    if (raw === "[DONE]") return;

    try {
      const envelope = JSON.parse(raw) as StreamEnvelope<unknown>;
      onEvent(name, envelope);
    } catch (err) {
      console.warn("[consumeSseStream] invalid JSON", name, err);
    }
  };

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith(":")) continue;
      if (line === "") {
        flush();
        continue;
      }
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }

  if (buffer.trim()) {
    if (buffer.startsWith("data:")) dataLines.push(buffer.slice(5).trimStart());
    flush();
  } else if (dataLines.length) {
    flush();
  }
}
