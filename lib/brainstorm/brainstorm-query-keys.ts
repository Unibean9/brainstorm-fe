export const brainstormKeys = {
  all: ["brainstorm"] as const,
  session: (sessionId: string) => [...brainstormKeys.all, "session", sessionId] as const,
  transcript: (sessionId: string) =>
    [...brainstormKeys.all, "transcript", sessionId] as const,
};
