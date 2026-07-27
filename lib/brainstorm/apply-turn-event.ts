import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { WorkflowNodeId } from "@/app/session/components/room-orb-layout";
import { mapBePhaseToUi } from "@/lib/brainstorm/map-session-snapshot";
import { clampEngineStep, normalizeEngineStepPayload } from "@/lib/brainstorm/engine-steps";
import type { AgentAudioPlayer } from "@/lib/audio/agent-audio-player";
import type {
  AgentAudioReadyPayload,
  AgentRunStartedPayload,
  AgentStreamErrorPayload,
  AgentTextCompletedPayload,
  AgentTextDeltaPayload,
  BrainstormPhaseKey,
  BrainstormSessionState,
  EngineStepChangedPayload,
  SessionStateChangedPayload,
  StreamEnvelope,
} from "@/types/brainstorm-stream";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function upsertAgentDelta(
  prev: TranscriptEntry[],
  messageId: string,
  delta: string,
  ts: number,
  phaseKey?: TranscriptEntry["phaseKey"]
): TranscriptEntry[] {
  const idx = prev.findIndex((e) => e.id === messageId);
  if (idx === -1) {
    return [
      ...prev,
      {
        id: messageId,
        speaker: "agent",
        text: delta,
        time: formatTime(ts),
        timestampMs: ts,
        phaseKey: phaseKey ?? "Framing",
      },
    ];
  }
  const next = [...prev];
  next[idx] = { ...next[idx]!, text: next[idx]!.text + delta };
  return next;
}

export type TurnEventContext = {
  setState: (state: BrainstormSessionState) => void;
  setEngineStep: (step: number) => void;
  setFocusNodeId: (id: WorkflowNodeId | null) => void;
  setSessionPhaseKey: (phaseKey: BrainstormPhaseKey) => void;
  setError: (message: string | null) => void;
  setTranscript: (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => void;
  audio: AgentAudioPlayer;
  /** Dừng filler thinking — gọi khi text-done, idle, lỗi */
  stopFiller?: () => void;
};

export function applyTurnStreamEvent(
  event: string,
  envelope: StreamEnvelope<unknown>,
  ctx: TurnEventContext
) {
  switch (event) {
    case "state":
    case "session-state": {
      const { data } = envelope as SessionStateChangedPayload;
      ctx.setState(data.state);
      if (data.state !== "processing") ctx.stopFiller?.();
      break;
    }
    case "agent-run-started": {
      const { data, ts } = envelope as AgentRunStartedPayload;
      ctx.stopFiller?.();
      ctx.setTranscript((prev) => {
        if (prev.some((e) => e.id === data.messageId)) return prev;
        return [
          ...prev,
          {
            id: data.messageId,
            speaker: "agent",
            text: "",
            time: formatTime(ts),
            timestampMs: ts,
            phaseKey: "Framing",
          },
        ];
      });
      break;
    }
    case "text-delta": {
      const { data, ts } = envelope as AgentTextDeltaPayload;
      ctx.setTranscript((prev) => upsertAgentDelta(prev, data.messageId, data.delta, ts));
      break;
    }
    case "text-done": {
      const { data, ts } = envelope as AgentTextCompletedPayload;
      ctx.stopFiller?.();
      ctx.setSessionPhaseKey(data.phaseKey);
      const phaseKey = mapBePhaseToUi(data.phaseKey);
      ctx.setTranscript((prev) => {
        const idx = prev.findIndex((e) => e.id === data.messageId);
        const entry: TranscriptEntry = {
          id: data.messageId,
          speaker: "agent",
          text: data.text,
          time: formatTime(ts),
          timestampMs: ts,
          phaseKey,
        };
        if (idx === -1) return [...prev, entry];
        const next = [...prev];
        next[idx] = entry;
        return next;
      });
      break;
    }
    case "agent-audio": {
      const { data } = envelope as AgentAudioReadyPayload;
      ctx.stopFiller?.();
      ctx.setState("agent-speaking");
      void ctx.audio
        .playOnce({
          chunkBase64: data.audioBase64,
          encoding: "audio/wav",
        })
        .catch(() => undefined)
        .then(() => {
          ctx.setState("idle");
        });
      break;
    }
    case "engine-step": {
      const { data } = envelope as EngineStepChangedPayload;
      const normalized = normalizeEngineStepPayload(data.step, data.focusNodeId);
      ctx.setEngineStep(normalized.step);
      ctx.setFocusNodeId(normalized.focusNodeId);
      break;
    }
    case "error": {
      const { data } = envelope as AgentStreamErrorPayload;
      if (data.code === "audio_unavailable" && data.recoverable) break;
      ctx.stopFiller?.();
      ctx.setError(data.code);
      ctx.setState("idle");
      break;
    }
    default:
      break;
  }
}
