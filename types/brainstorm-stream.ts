import type { RoomPhaseKey } from "@/app/session/data/room-graph-types";
import type {
  BrainstormAgent,
  BrainstormArtifactStatus,
  AdaptiveState,
  BriefStatus,
  BrainstormLanguage,
  CognitiveIntent,
  DurableOutcome,
  AutonomousIdeationJob,
  FacilitationMode,
  RoomSessionStatus,
  RuntimeProvider,
  SessionBrief,
  SessionCapabilities,
  SessionSeed,
  WorkingBrief,
} from "@/types/brainstorm-domain";
import type { HubWebglState } from "@/app/session/components/room-hub-webgl";

/** Contract BE — xem docs/frontend-api.md */

export type BrainstormSessionState = HubWebglState;

/** Phase keys từ BE SSE / snapshot */
export type BrainstormPhaseKey =
  "framing" | "diverging" | "shifting" | "critiquing" | "converging" | "wrap-up";

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
  phaseKey: BrainstormPhaseKey | null;
  stage?: string;
}>;

/** Speech segment mapped to an exact range in the assistant's final text. */
export type AgentAudioSegmentPayload = StreamEnvelope<{
  messageId: string;
  segmentId: string;
  textStart: number;
  textEnd: number;
  traceId?: string;
}>;

export type ReasoningState = {
  stage?: string;
  technique?: string;
  diagnosis?: string;
  move?: string;
  stance?: string;
  completion?: { suggested?: boolean; reason?: string };
  traceEntry?: unknown;
  phase?: string;
  trace_entry?: unknown;
  cognitiveIntent?: CognitiveIntent | null;
  userState?: string | null;
  suggestedFacilitationMode?: FacilitationMode | null;
  workingBrief?: WorkingBrief | null;
  briefReady?: boolean;
};

export type AdvisoryStatePayload = StreamEnvelope<{
  state: ReasoningState;
  diagnostic: string | null;
}>;

export type FacilitationModeChangedPayload = StreamEnvelope<{
  facilitationMode: FacilitationMode;
  modeRevision: number;
  effectiveFrom: "next_turn";
}>;

export type AdvisoryWarningPayload = StreamEnvelope<{
  code: string;
  recoverable: true;
}>;

export type ConversationActionName =
  | "none"
  | "autonomous_ideation"
  | "confirm_brief"
  | "accept_candidate"
  | "reject_candidate"
  | "request_artifact"
  | "complete_session"
  | "cancel_autonomous";

export type ConversationActionPayload = StreamEnvelope<
  | { kind: "none" }
  | { kind: "clarify"; reason: string }
  | {
      kind: "executed";
      action: Exclude<ConversationActionName, "none">;
      result: unknown;
    }
>;

export type ConversationActionErrorPayload = StreamEnvelope<{
  action: ConversationActionName;
  code: string;
}>;

export type AgentAudioChunkPayload = StreamEnvelope<{
  messageId: string;
  encoding: "audio/wav";
  audioBase64: string;
  /** Additive metadata. Legacy WAV frames may omit these fields. */
  traceId?: string;
  segmentId?: string;
  chunkIndex?: number;
  sampleRate?: number;
  startSample?: number;
  sampleCount?: number;
}>;

export type AgentAudioDonePayload = StreamEnvelope<{
  messageId: string;
}>;

export type AgentAudioSegmentDonePayload = StreamEnvelope<{
  messageId: string;
  segmentId: string;
  totalSamples: number;
  sampleRate: number;
  traceId?: string;
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
  facilitationMode?: FacilitationMode;
  modeRevision?: number;
};

export type BrainstormSessionSnapshot = {
  sessionId: string;
  voiceId: string;
  engineStep: number;
  phaseKey: BrainstormPhaseKey | null;
  state: "idle" | "processing";
  status?: RoomSessionStatus;
  runtimeProvider?: RuntimeProvider;
  agent?: BrainstormAgent;
  language?: BrainstormLanguage;
  facilitationMode?: FacilitationMode;
  modeRevision?: number;
  seed?: SessionSeed | null;
  workingBrief?: WorkingBrief | null;
  briefStatus?: BriefStatus;
  briefRevision?: number;
  adaptiveState?: AdaptiveState;
  brief?: SessionBrief | null;
  capabilities?: SessionCapabilities;
  durableOutcomes?: DurableOutcome[];
  artifacts?: BrainstormArtifactStatus[];
  autonomousJobs?: AutonomousIdeationJob[];
  transcript?: ApiTranscriptMessage[];
  activeTurn?: BrainstormActiveTurn | null;
};

export type BrainstormAudioMode = "streaming" | "standard" | "text";

export type PostBrainstormTurnRequest = {
  clientTurnId: string;
  text: string;
  audioMode?: BrainstormAudioMode;
};

export type BrainstormPrdResponse =
  | {
      prdUrl: string;
      generatedAt: string;
    }
  | {
      sessionId: string;
      artifactKey: "prd";
      status: "generating";
    };

export type BrainstormLandingPageResponse = {
  landingPageUrl: string;
  /** Cảnh báo không chặn request — VD "measurement_unavailable: ...". Có thể rỗng. */
  warnings?: string[];
};

export type BrainstormPitchDeckResponse = {
  htmlUrl: string;
  exportUrl: string;
  speakerScriptUrl: string;
  warnings?: string[];
};

export type PostOutcomeRequest = Omit<DurableOutcome, "sessionId" | "createdAt">;

export type StartAutonomousIdeationRequest = {
  clientJobId: string;
  prompt: string;
  deadlineMs?: number;
};

export type AcceptCandidateRequest = {
  kind?: DurableOutcome["kind"];
  outcomeId?: string;
};

export type AutonomousCandidatesResponse = {
  candidates: import("@/types/brainstorm-domain").AutonomousIdeationCandidate[];
};

export type BrainstormFillerAsset = {
  name: string;
  url: string;
  phase?: BrainstormPhaseKey | null;
  voiceId?: string | null;
  /** Backend metadata for filler_<phase>_<voice>_<lang>_<n>.wav. */
  lang?: BrainstormLanguage | null;
};

export type BrainstormFillersResponse = {
  fillers: BrainstormFillerAsset[];
};

/** UI-only mapped phase (optional helper) */
export type MappedTranscriptPhase = RoomPhaseKey;
