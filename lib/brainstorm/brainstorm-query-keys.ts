export const brainstormKeys = {
  all: ["brainstorm"] as const,
  session: (sessionId: string) => [...brainstormKeys.all, "session", sessionId] as const,
  transcript: (sessionId: string) => [...brainstormKeys.all, "transcript", sessionId] as const,
  fillers: () => [...brainstormKeys.all, "fillers"] as const,
  rooms: () => [...brainstormKeys.all, "rooms"] as const,
  roomDefaults: () => [...brainstormKeys.all, "room-defaults"] as const,
  roomSessions: (roomId: string) => [...brainstormKeys.all, "rooms", roomId, "sessions"] as const,
  voices: () => [...brainstormKeys.all, "voices"] as const,
  agents: () => [...brainstormKeys.all, "agents"] as const,
  runtimeProviders: () => [...brainstormKeys.all, "runtime-providers"] as const,
  languages: () => [...brainstormKeys.all, "languages"] as const,
  outcomes: (sessionId: string) => [...brainstormKeys.all, "outcomes", sessionId] as const,
  artifactStatuses: (sessionId: string) =>
    [...brainstormKeys.all, "artifact-statuses", sessionId] as const,
  autonomousJob: (sessionId: string, jobId: string) =>
    [...brainstormKeys.all, "autonomous-job", sessionId, jobId] as const,
  autonomousCandidates: (sessionId: string, jobId: string) =>
    [...brainstormKeys.all, "autonomous-candidates", sessionId, jobId] as const,
};
