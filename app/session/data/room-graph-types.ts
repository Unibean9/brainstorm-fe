export type RoomGraphNodeType =
  | "room"
  | "phase"
  | "artifact"
  | "idea"
  | "technique"
  | "insight"
  | "output";

export type RoomGraphLinkType =
  | "progression"
  | "contains"
  | "technique-source"
  | "evolved-from"
  | "loop-back";

export type RoomPhaseKey =
  | "Framing"
  | "Context"
  | "Explore"
  | "Expand"
  | "Challenge"
  | "Insight"
  | "Decision"
  | "Action";

export type TraceEvent = {
  time: string;
  event: string;
  technique?: string;
  detail: string;
};

export type RoomGraphNode = {
  id: string;
  label: string;
  type: RoomGraphNodeType;
  phaseKey?: RoomPhaseKey;
  color: string;
  val?: number;
  status?: "active" | "complete" | "pending";
  trace?: TraceEvent[];
  fx?: number;
  fy?: number;
  fz?: number;
  x?: number;
  y?: number;
  z?: number;
};

export type RoomGraphLink = {
  source: string;
  target: string;
  type: RoomGraphLinkType;
  color?: string;
};

export type RoomGraphData = {
  nodes: RoomGraphNode[];
  links: RoomGraphLink[];
};

export type TranscriptEntry = {
  id: string;
  speaker: "user" | "agent";
  text: string;
  time: string;
  timestampMs: number;
  phaseKey?: RoomPhaseKey;
};

export type RoomSessionMeta = {
  roomId: string;
  title: string;
  topic: string;
  goal: string;
  readiness: number;
  currentPhase: RoomPhaseKey;
  durationMinutes: number;
  mode: "live" | "replay";
  activeTechnique?: string;
};
