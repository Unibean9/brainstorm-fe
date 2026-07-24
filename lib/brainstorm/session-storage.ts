const SESSION_ID_KEY = "brainstorm_session_id";

export function readStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function writeStoredSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_ID_KEY);
  } catch {
    /* ignore */
  }
}
