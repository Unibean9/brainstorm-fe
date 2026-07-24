import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { WorkflowNodeId } from "@/app/session/components/room-orb-layout";
import { clampEngineStep, normalizeEngineStepPayload } from "@/lib/brainstorm/engine-steps";
import type { AgentAudioPlayer } from "@/lib/audio/agent-audio-player";
import type {
  AgentAudioChunkPayload,
  AgentAudioCompletedPayload,
  AgentRunFailedPayload,
  AgentRunStartedPayload,
  AgentTextCompletedPayload,
  AgentTextDeltaPayload,
  BrainstormSessionState,
  EngineStepChangedPayload,
  SessionStateChangedPayload,
  StreamEnvelope,
  UserTranscriptFinalPayload,
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
  ts: number
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
        phaseKey: "Explore",
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
  setError: (message: string | null) => void;
  setTranscript: (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => void;
  audio: AgentAudioPlayer;
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
      break;
    }
    case "user-transcript-final": {
      const { data, ts } = envelope as UserTranscriptFinalPayload;
      ctx.setTranscript((prev) => [
        ...prev.filter((e) => e.id !== data.messageId),
        {
          id: data.messageId,
          speaker: "user",
          text: data.text,
          time: formatTime(ts),
          timestampMs: ts,
          phaseKey: data.phaseKey ?? "Explore",
        },
      ]);
      break;
    }
    case "agent-run-started": {
      const { data, ts } = envelope as AgentRunStartedPayload;
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
            phaseKey: "Explore",
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
      ctx.setTranscript((prev) => {
        const idx = prev.findIndex((e) => e.id === data.messageId);
        const entry: TranscriptEntry = {
          id: data.messageId,
          speaker: "agent",
          text: data.text,
          time: formatTime(ts),
          timestampMs: ts,
          phaseKey: data.phaseKey ?? "Explore",
        };
        if (idx === -1) return [...prev, entry];
        const next = [...prev];
        next[idx] = entry;
        return next;
      });
      break;
    }
    case "audio-chunk": {
      const { data } = envelope as AgentAudioChunkPayload;
      ctx.setState("agent-speaking");
      void ctx.audio.enqueue({
        chunkBase64: data.chunkBase64,
        encoding: data.encoding,
        sampleRate: data.sampleRate,
      });
      break;
    }
    case "audio-done": {
      if (!ctx.audio.isPlaying) ctx.setState("idle");
      break;
    }
    case "engine-step": {
      const { data } = envelope as EngineStepChangedPayload;
      const normalized = normalizeEngineStepPayload(data.step, data.focusNodeId);
      ctx.setEngineStep(normalized.step);
      ctx.setFocusNodeId(normalized.focusNodeId);
      break;
    }
    case "error":
    case "agent-run-failed": {
      const { data } = envelope as AgentRunFailedPayload;
      ctx.setError(data.message);
      ctx.setState("idle");
      break;
    }
    default:
      break;
  }
}
