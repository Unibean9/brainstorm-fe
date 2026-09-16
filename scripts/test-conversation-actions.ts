import assert from "node:assert/strict";

import type { AgentAudioPlayer } from "../lib/audio/agent-audio-player";
import { applyTurnStreamEvent, type TurnEventContext } from "../lib/brainstorm/apply-turn-event";
import type { BrainstormSessionSnapshot } from "../types/brainstorm-stream";

let snapshot: BrainstormSessionSnapshot | null = {
  sessionId: "session-1",
  voiceId: "vi-female-01",
  engineStep: 0,
  phaseKey: "framing",
  state: "idle",
  status: "active",
  autonomousJobs: [],
};
let notice: string | null = null;

const context = {
  setState: () => undefined,
  setEngineStep: () => undefined,
  setFocusNodeId: () => undefined,
  setSessionPhaseKey: () => undefined,
  setSnapshot: (
    updater: (current: BrainstormSessionSnapshot | null) => BrainstormSessionSnapshot | null
  ) => {
    snapshot = updater(snapshot);
  },
  setError: () => undefined,
  setWarning: () => undefined,
  setConversationNotice: (next: string | null) => {
    notice = next;
  },
  setTranscript: () => undefined,
  audio: {} as AgentAudioPlayer,
} satisfies TurnEventContext;

const envelope = (data: unknown) => ({
  sessionId: "session-1",
  turnId: "turn-1",
  ts: Date.now(),
  data,
});

applyTurnStreamEvent(
  "conversation-action",
  envelope({ kind: "executed", action: "complete_session", result: { status: "wrapped" } }),
  context
);
assert.equal(snapshot?.status, "wrapped", "completion action must make the snapshot read-only");

applyTurnStreamEvent(
  "conversation-action",
  envelope({
    kind: "executed",
    action: "autonomous_ideation",
    result: { jobId: "job-1", status: "queued", prompt: "more ideas" },
  }),
  context
);
assert.equal(
  snapshot?.autonomousJobs?.[0]?.jobId,
  "job-1",
  "autonomous job must enter the snapshot"
);

applyTurnStreamEvent(
  "conversation-action-error",
  envelope({ action: "autonomous_ideation", code: "internal_error_code" }),
  context
);
assert.equal(
  notice,
  "Chưa thể thực hiện yêu cầu này. Bạn có thể tiếp tục nói hoặc chat để làm rõ.",
  "action errors must use plain-language copy"
);

console.log("conversation action regression checks passed");
