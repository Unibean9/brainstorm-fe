export type StoredSessionArtifacts = {
  isWrapped: boolean;
  reportUrl?: string;
  reportGeneratedAt?: string;
  landingPageUrl?: string;
  pitchDeckHtmlUrl?: string;
  pitchDeckExportUrl?: string;
  pitchDeckFormat?: string;
};

const key = (sessionId: string) => `brainstorm_artifacts_${sessionId}`;

export function readStoredSessionArtifacts(sessionId: string): StoredSessionArtifacts | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredSessionArtifacts;
  } catch {
    return null;
  }
}

export function writeStoredSessionArtifacts(sessionId: string, data: StoredSessionArtifacts) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(sessionId), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearStoredSessionArtifacts(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(sessionId));
  } catch {
    /* ignore */
  }
}
