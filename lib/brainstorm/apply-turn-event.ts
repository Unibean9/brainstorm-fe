import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { WorkflowNodeId } from "@/app/session/components/room-orb-layout";
import { mapBePhaseToUi } from "@/lib/brainstorm/map-session-snapshot";
import { normalizeEngineStepPayload } from "@/lib/brainstorm/engine-steps";
import type { AgentAudioPlayer } from "@/lib/audio/agent-audio-player";
import type {
  AgentAudioChunkPayload,
  AgentRunStartedPayload,
  AgentStreamErrorPayload,
  AgentTextCompletedPayload,
  AgentTextDeltaPayload,
  BrainstormPhaseKey,
  BrainstormSessionSnapshot,
  BrainstormSessionState,
  EngineStepChangedPayload,
  AdvisoryStatePayload,
  AdvisoryWarningPayload,
  FacilitationModeChangedPayload,
  ReasoningState,
  SessionStateChangedPayload,
  StreamEnvelope,
} from "@/types/brainstorm-stream";

/** Lỗi không chặn turn — chỉ mất/ngắt audio, text vẫn hoàn tất bình thường. */
const SOFT_WARNING_CODES = new Set(["audio_unavailable", "audio_truncated"]);

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
  setAdvisory?: (state: ReasoningState | null) => void;
  setAdvisoryWarning?: (code: string | null) => void;
  setAdvisoryDiagnostic?: (diagnostic: string | null) => void;
  /** Keep progressive brief/mode metadata in sync while the SSE turn is live. */
  setSnapshot?: (
    updater: (current: BrainstormSessionSnapshot | null) => BrainstormSessionSnapshot | null
  ) => void;
  /** Lỗi chặn turn (room_busy, turn_failed, client_disconnected) — cho gửi lại với clientTurnId mới. */
  setError: (message: string | null) => void;
  /** Lỗi không chặn (audio_unavailable, audio_truncated) — turn vẫn hoàn tất, chỉ mất audio. */
  setWarning: (message: string | null) => void;
  setTranscript: (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => void;
  audio: AgentAudioPlayer;
  /** Dừng filler thinking — gọi khi có audio thật đầu tiên, idle, hoặc lỗi */
  stopFiller?: () => void;
};

export function applyTurnStreamEvent(
  event: string,
  envelope: StreamEnvelope<unknown>,
  ctx: TurnEventContext
) {
  switch (event) {
    case "state": {
      const { data } = envelope as SessionStateChangedPayload;
      // BE báo state đổi ngay khi sinh xong text/audio — không biết hàng đợi
      // audio phía client (AgentAudioPlayer) đã phát xong thật hay chưa. Nếu
      // đổi sang state khác "agent-speaking" trong lúc audio còn đang phát,
      // đợi phát xong rồi mới đổi để animation "đang nói" không tắt sớm.
      if (data.state !== "agent-speaking" && ctx.audio.isPlaying) {
        void ctx.audio.whenIdle().then(() => {
          if (!ctx.audio.isPlaying) ctx.setState(data.state);
        });
      } else {
        ctx.setState(data.state);
      }
      if (data.state !== "processing") ctx.stopFiller?.();
      break;
    }
    case "agent-run-started": {
      const { data, ts } = envelope as AgentRunStartedPayload;
      ctx.audio.beginStream();
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
      ctx.setSessionPhaseKey(data.phaseKey ?? "framing");
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
    case "advisory-state": {
      const { data } = envelope as AdvisoryStatePayload;
      ctx.setAdvisory?.(data.state);
      ctx.setAdvisoryWarning?.(null);
      ctx.setAdvisoryDiagnostic?.(data.diagnostic);
      ctx.setSnapshot?.((current) => {
        if (!current) return current;
        const next = data.state;
        return {
          ...current,
          workingBrief: next.workingBrief ?? current.workingBrief,
          briefStatus:
            next.briefReady && current.briefStatus !== "confirmed"
              ? "ready_for_confirmation"
              : current.briefStatus,
          adaptiveState: {
            cognitiveIntent: next.cognitiveIntent ?? current.adaptiveState?.cognitiveIntent ?? null,
            userState: next.userState ?? current.adaptiveState?.userState ?? null,
          },
        };
      });
      break;
    }
    case "advisory-warning": {
      const { data } = envelope as AdvisoryWarningPayload;
      ctx.setAdvisory?.(null);
      ctx.setAdvisoryWarning?.(data.code ?? "private_state_unavailable");
      ctx.setAdvisoryDiagnostic?.(null);
      break;
    }
    case "facilitation-mode": {
      const { data } = envelope as FacilitationModeChangedPayload;
      ctx.setSnapshot?.((current) =>
        current
          ? {
              ...current,
              facilitationMode: data.facilitationMode,
              modeRevision: data.modeRevision,
            }
          : current
      );
      break;
    }
    case "agent-audio-chunk": {
      const { data } = envelope as AgentAudioChunkPayload;
      ctx.setState("agent-speaking");
      // Stop the filler only after the real audio element has successfully
      // started. The chunk can arrive before the browser begins playback.
      ctx.audio.enqueue({ chunkBase64: data.audioBase64, encoding: data.encoding }, ctx.stopFiller);
      break;
    }
    case "agent-audio-done": {
      // Cho player biết stream đã kết thúc để flush các câu ngắn hơn ngưỡng prebuffer.
      // Các chunk đã nhận vẫn được schedule trên cùng một timeline, nên không bị bỏ qua.
      ctx.audio.finish();
      // Lifecycle `state: idle` stops the filler for turns that have no playable audio chunk.
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
      if (SOFT_WARNING_CODES.has(data.code)) {
        ctx.setWarning(data.code);
        break;
      }
      // room_busy | turn_failed | client_disconnected — turn coi như kết thúc, cho gửi lại
      ctx.stopFiller?.();
      ctx.audio.finish();
      ctx.setError(data.code);
      break;
    }
    default:
      break;
  }
}
