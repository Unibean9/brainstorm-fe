import type { RoomPhaseKey } from "@/app/session/data/room-graph-types";
import type { HubWebglState } from "@/app/session/components/room-hub-webgl";

/** Contract BE — xem docs/frontend-api.md */

export type BrainstormSessionState = HubWebglState;

/** Phase keys từ BE SSE / snapshot */
export type BrainstormPhaseKey =
  | "framing"
  | "diverging"
  | "shifting"
  | "critiquing"
  | "converging"
  | "wrap-up";

export type StreamEnvelope<T> = {
  sessionId: string;
  turnId: string;
  seq?: number;
  ts: number;
  data: T;
};

export type SessionStateChangedPayload = StreamEnvelope<{
  state: "idle" | "processing" | "agent-speaking";
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
  phaseKey: BrainstormPhaseKey;
}>;

export type AgentAudioReadyPayload = StreamEnvelope<{
  messageId: string;
  encoding: "audio/wav";
  audioBase64: string;
}>;

export type AgentStreamErrorPayload = StreamEnvelope<{
  code: string;
  recoverable?: boolean;
}>;

export type EngineStepChangedPayload = StreamEnvelope<{
  step: number;
  focusNodeId?: string | null;
}>;

export type ApiTranscriptMessage = {
  messageId: string;
  role: "user" | "assistant";
  text: string;
  turnId: string;
  replyToMessageId?: string;
  createdAt: string;
};

export type BrainstormActiveTurn = {
  turnId: string;
  clientTurnId: string;
  status: string;
  lastSeq?: number;
};

export type BrainstormSessionSnapshot = {
  sessionId: string;
  voiceId: string;
  engineStep: number;
  phaseKey: BrainstormPhaseKey;
  state: "idle" | "processing";
  transcript?: ApiTranscriptMessage[];
  activeTurn?: BrainstormActiveTurn | null;
};

export type CreateBrainstormSessionRequest = Record<string, never>;

/** BE chỉ nhận clientTurnId + text */
export type PostBrainstormTurnRequest = {
  clientTurnId: string;
  text: string;
};

export type BrainstormReportResponse = {
  reportUrl: string;
  generatedAt: string;
};

export type BrainstormLandingPageResponse = {
  landingPageUrl: string;
};

export type BrainstormPitchDeckFormat = "pdf" | "ppt" | "pptx";

export type BrainstormPitchDeckResponse = {
  htmlUrl: string;
  exportUrl: string;
};

export type BrainstormFillerAsset = {
  name: string;
  url: string;
};

export type BrainstormFillersResponse = {
  fillers: BrainstormFillerAsset[];
};

/** UI-only mapped phase (optional helper) */
export type MappedTranscriptPhase = RoomPhaseKey;
