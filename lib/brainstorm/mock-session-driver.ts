import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { WorkflowNodeId } from "@/app/session/components/room-orb-layout";
import {
  DEMO_TURN_ENGINE_TIMELINE,
  engineStepNodeId,
  normalizeEngineStepPayload,
} from "@/lib/brainstorm/engine-steps";
import type { BrainstormSessionState } from "@/types/brainstorm-stream";

const DEMO_AGENT_REPLIES = [
  "Ghi nhận rồi — mình thêm vào Thinking Trace.",
  "Ý này thú vị, để mình đối chiếu với insight trước đó.",
  "Được, mình cập nhật readiness theo hướng này.",
];

const DEMO_VOICE_UTTERANCES = [
  "Mình muốn thử hướng onboarding QR cho nhân viên mới.",
  "Có thể gom insight về retention vào một trace không?",
  "Team đang bị kẹt ở bước chọn technique.",
];

function formatTime(ts = Date.now()) {
  return new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export type MockSessionDriver = {
  sendText: (text: string) => void;
  toggleMic: (micActive: boolean) => void;
  dispose: () => void;
};

type MockCallbacks = {
  onState: (state: BrainstormSessionState) => void;
  onMicActive: (active: boolean) => void;
  onEngineStep: (step: number, focusNodeId?: WorkflowNodeId | null) => void;
  onTranscript: (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => void;
};

function emitEngineStep(
  callbacks: MockCallbacks,
  step: number,
  focusNodeId?: WorkflowNodeId | null
) {
  const normalized = normalizeEngineStepPayload(step, focusNodeId);
  callbacks.onEngineStep(normalized.step, normalized.focusNodeId);
}

export function createMockSessionDriver(callbacks: MockCallbacks): MockSessionDriver {
  const timers: number[] = [];

  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers.length = 0;
  };

  const scheduleEngineTimeline = (baseMs: number) => {
    for (const { offsetMs, step } of DEMO_TURN_ENGINE_TIMELINE) {
      timers.push(
        window.setTimeout(
          () => emitEngineStep(callbacks, step),
          baseMs + offsetMs
        )
      );
    }
  };

  const queueAgentReply = (processingMs: number, speakingMs: number) => {
    callbacks.onState("processing");
    emitEngineStep(callbacks, 0);
    scheduleEngineTimeline(0);

    timers.push(
      window.setTimeout(() => {
        callbacks.onState("agent-speaking");
        emitEngineStep(callbacks, 5);
        callbacks.onTranscript((prev) => [
          ...prev,
          {
            id: `mock-a-${prev.length}-${Date.now()}`,
            speaker: "agent",
            text: pickOne(DEMO_AGENT_REPLIES),
            time: formatTime(),
            timestampMs: Date.now(),
            phaseKey: "Explore",
          },
        ]);
      }, processingMs),
      window.setTimeout(
        () => emitEngineStep(callbacks, 6),
        processingMs + speakingMs - 220
      ),
      window.setTimeout(
        () => emitEngineStep(callbacks, 7),
        processingMs + speakingMs - 80
      ),
      window.setTimeout(
        () => callbacks.onState("idle"),
        processingMs + speakingMs
      )
    );
  };

  return {
    sendText(text) {
      clearTimers();
      callbacks.onTranscript((prev) => [
        ...prev,
        {
          id: `mock-u-${prev.length}-${Date.now()}`,
          speaker: "user",
          text,
          time: formatTime(),
          timestampMs: Date.now(),
          phaseKey: "Explore",
        },
      ]);
      queueAgentReply(700, 2500);
    },
    toggleMic(micActive) {
      clearTimers();
      if (micActive) {
        callbacks.onMicActive(true);
        callbacks.onState("listening");
        emitEngineStep(callbacks, 0, engineStepNodeId(0));
        return;
      }
      callbacks.onMicActive(false);
      callbacks.onTranscript((prev) => [
        ...prev,
        {
          id: `mock-u-${prev.length}-${Date.now()}`,
          speaker: "user",
          text: pickOne(DEMO_VOICE_UTTERANCES),
          time: formatTime(),
          timestampMs: Date.now(),
          phaseKey: "Explore",
        },
      ]);
      queueAgentReply(900, 3300);
    },
    dispose: clearTimers,
  };
}

export function isBrainstormMockMode() {
  const mode = process.env.NEXT_PUBLIC_BRAINSTORM_STREAM_MODE;
  if (mode === "live") return false;
  if (mode === "mock") return true;
  return true;
}
