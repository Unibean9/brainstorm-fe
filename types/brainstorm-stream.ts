import type { RoomPhaseKey } from "@/app/session/data/room-graph-types";
import type { HubWebglState } from "@/app/session/components/room-hub-webgl";

/** SSE turn stream contract — xem docs/brainstorm-session-api.md */

export type BrainstormSessionState = HubWebglState;

export type StreamEnvelope<T> = {
  sessionId: string;
  turnId: string;
  seq?: number;
  ts: number;
  data: T;
};

export type SessionStateChangedPayload = StreamEnvelope<{
  state: BrainstormSessionState;
}>;

export type UserTranscriptFinalPayload = StreamEnvelope<{
  clientTurnId: string;
  messageId: string;
  text: string;
  phaseKey?: RoomPhaseKey;
}>;

export type AgentRunStartedPayload = StreamEnvelope<{
  messageId: string;
  replyToMessageId?: string;
}>;

export type AgentTextDeltaPayload = StreamEnvelope<{
  messageId: string;
  delta: string;
}>;

export type AgentTextCompletedPayload = StreamEnvelope<{
  messageId: string;
  text: string;
  phaseKey?: RoomPhaseKey;
}>;

export type AgentAudioChunkPayload = StreamEnvelope<{
  messageId: string;
  encoding: "audio/mpeg" | "audio/wav" | "audio/webm" | "audio/pcm16";
  sampleRate?: number;
  chunkBase64: string;
  isLast: boolean;
}>;

export type AgentAudioCompletedPayload = StreamEnvelope<{
  messageId: string;
}>;

export type AgentRunFailedPayload = StreamEnvelope<{
  messageId?: string;
  code: string;
  message: string;
}>;

export type EngineStepChangedPayload = StreamEnvelope<{
  /** 0–7 — engine đang active trên ring */
  step: number;
  /** Khớp WORKFLOW_NODES_HOME[step].id — nếu bỏ trống FE tự suy từ step */
  focusNodeId?: string | null;
}>;

export type CreateBrainstormSessionRequest = {
  roomId?: string | null;
  locale?: string;
  voiceId?: string | null;
};

export type BrainstormSessionSnapshot = {
  sessionId: string;
  voiceId: string;
  /** 0–7 — xem lib/brainstorm/engine-steps.ts */
  engineStep: number;
  phaseKey: RoomPhaseKey;
  state: BrainstormSessionState;
  transcript?: import("@/app/session/data/room-graph-types").TranscriptEntry[];
};

/** Một lượt chat hoặc voice — BE trả SSE text + audio */
export type PostBrainstormTurnRequest = {
  clientTurnId: string;
  /** Chat text */
  text?: string;
  /** Voice — WebM/PCM base64 (raw, không prefix data:) */
  audioBase64?: string;
  audioMime?: "audio/webm" | "audio/pcm16";
};
