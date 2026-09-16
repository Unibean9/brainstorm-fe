/** Teacher — định danh, không phải xác thực. Xem docs/system-architecture.md / docs/code-standards.md. */
export type Teacher = {
  teacherId: string;
  code: string;
  name: string;
  createdAt: string;
  isNew: boolean;
};

export type TeacherDirectoryEntry = {
  code: string;
  name: string;
  createdAt: string;
};

export type CreateTeacherRequest = {
  code: string;
  name: string;
};

/** Room — id-space riêng biệt, luôn có tiền tố rm_. */
export type Room = {
  roomId: string;
  name: string;
  ownerTeacherId: string;
  ownerName?: string;
  createdAt: string;
  /** Canonical runtime provider pinned at room level. */
  runtimeProvider: RuntimeProvider;
  /** Compatibility alias returned by older backend snapshots. */
  agent?: BrainstormAgent;
};

export type CreateRoomRequest = {
  name: string;
  runtimeProvider?: RuntimeProvider;
  /** Compatibility alias for older clients. */
  agent?: BrainstormAgent;
};

export type RoomSessionStatus = "active" | "wrapped" | string;

export type RuntimeProvider = "claude" | "codex";
/** Compatibility alias; provider is runtime infrastructure, not a facilitation mode. */
export type BrainstormAgent = RuntimeProvider;
export type FacilitationMode = "facilitator" | "creative_partner";
export type BrainstormLanguage = "vi" | "en";
export type CognitiveIntent =
  | "explore"
  | "analyze"
  | "ideate"
  | "challenge"
  | "develop"
  | "evaluate"
  | "converge"
  | "synthesize";
export type BriefStatus = "discovery" | "ready_for_confirmation" | "confirmed";

export type SessionSeed = {
  topic: string;
  language: BrainstormLanguage;
  voiceId: string;
};

export type WorkingBrief = {
  goal: string | null;
  context: string | null;
  constraints: string[] | null;
  audience: string | null;
  successCriteria: string[] | null;
};

export type AdaptiveState = {
  cognitiveIntent: CognitiveIntent | null;
  userState: string | null;
};

export type WorkingBriefPatch = {
  goal?: string | null;
  context?: string | null;
  constraints?: string[] | null;
  audience?: string | null;
  successCriteria?: string[] | null;
  /** Used when updating an already confirmed brief. */
  stance?: FacilitationMode;
  requestedArtifacts?: ArtifactKey[];
};

export type BriefMutationResponse = {
  sessionId: string;
  brief: SessionBrief | null;
  workingBrief: WorkingBrief;
  briefStatus: BriefStatus;
  briefRevision: number;
};

export type SessionBrief = {
  goal: string;
  context: string;
  constraints: string[];
  successCriteria: string[];
  audience: string;
  stance: FacilitationMode;
  language: BrainstormLanguage;
  requestedArtifacts: ArtifactKey[];
};

export type SessionCapabilities = {
  research?: boolean;
};

export type ArtifactKey = "prd" | "landing-page" | "pitch-deck";
export type ArtifactStatus = "generating" | "ready" | "failed";

export type BrainstormArtifactStatus = {
  artifactKey: ArtifactKey;
  status: ArtifactStatus;
  warnings?: string[];
  error?: string | { code?: string; message?: string };
  outputMetadata?: Record<string, unknown>;
  updatedAt?: string;
};

export type DurableOutcomeKind =
  | "idea"
  | "insight"
  | "assumption"
  | "risk"
  | "question"
  | "decision"
  | "rejected_option"
  | "action";

export type DurableOutcome = {
  outcomeId: string;
  sessionId?: string;
  kind: DurableOutcomeKind;
  content: unknown;
  status: "accepted" | "rejected";
  sourceTraceTurn?: number | null;
  supersedesOutcomeId?: string | null;
  createdAt?: string;
};

export type AutonomousJobStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled" | string;

export type AutonomousIdeationCandidate = {
  candidateId: string;
  jobId?: string;
  sessionId?: string;
  source?: string;
  ordinal?: number;
  text?: string;
  rationale?: string;
  content?: unknown;
  status: "pending" | "accepted" | "rejected" | string;
  kind?: DurableOutcomeKind;
  createdAt?: string;
};

export type AutonomousIdeationJob = {
  jobId: string;
  clientJobId?: string;
  sessionId?: string;
  prompt: string;
  status: AutonomousJobStatus;
  error?: { code?: string; message?: string } | string;
  createdAt?: string;
  completedAt?: string;
  candidates?: AutonomousIdeationCandidate[];
};

export type RoomSessionSummary = {
  sessionId: string;
  name: string;
  status: RoomSessionStatus;
  phaseKey: string;
  createdAt: string;
  runtimeProvider?: RuntimeProvider;
  agent?: BrainstormAgent;
  briefStatus?: BriefStatus;
  briefRevision?: number;
  brief?: SessionBrief | null;
  durableOutcomes?: DurableOutcome[];
  artifacts?: BrainstormArtifactStatus[];
  autonomousJobs?: AutonomousIdeationJob[];
};

export type CreateRoomSessionRequest = {
  /** Minimal seed: the user-facing brainstorm topic. */
  topic: string;
  voiceId: string;
  language?: BrainstormLanguage;
  /** Compatibility alias for pre-progressive clients. */
  name?: string;
  runtimeProvider?: RuntimeProvider;
  agent?: BrainstormAgent;
  brief?: SessionBrief;
  capabilities?: SessionCapabilities;
  facilitationMode?: FacilitationMode;
};

export type BrainstormVoice = {
  voiceId: string;
  label: string;
};

export type BrainstormAgentOption = {
  agentId: BrainstormAgent;
  label: string;
};

export type RuntimeProviderOption = {
  providerId: RuntimeProvider;
  label: string;
};

export type BrainstormLanguageOption = {
  languageId: BrainstormLanguage;
  label: string;
};

export type CloudSyncFailedRecord = {
  id: string;
  sessionId: string;
  kind: "trace" | "metadata" | "prd" | "landing" | "pitch";
  attempts: number;
  lastError: { code: string; hint: string } | null;
  updatedAt: string;
};

export type CloudSyncStatus = {
  counts: Record<string, number>;
  failed: CloudSyncFailedRecord[];
};
