export const brainstormKeys = {
  all: ["brainstorm"] as const,
  session: (sessionId: string) => [...brainstormKeys.all, "session", sessionId] as const,
  transcript: (sessionId: string) =>
    [...brainstormKeys.all, "transcript", sessionId] as const,
  fillers: () => [...brainstormKeys.all, "fillers"] as const,
  rooms: () => [...brainstormKeys.all, "rooms"] as const,
  roomSessions: (roomId: string) => [...brainstormKeys.all, "rooms", roomId, "sessions"] as const,
  voices: () => [...brainstormKeys.all, "voices"] as const,
};
