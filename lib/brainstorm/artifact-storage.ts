export type StoredSessionArtifacts = {
  isWrapped: boolean;
  prdUrl?: string;
  prdGeneratedAt?: string;
  landingPageUrl?: string;
  landingWarnings?: string[];
  pitchDeckHtmlUrl?: string;
  pitchDeckExportUrl?: string;
  speakerScriptUrl?: string;
  pitchWarnings?: string[];
};

const key = (sessionId: string) => `brainstorm_artifacts_${sessionId}`;
const CHANGE_EVENT = "brainstorm-artifacts-changed";

function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeStoredSessionArtifacts(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

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
    notifyChange();
  } catch {
    /* ignore */
  }
}

export function clearStoredSessionArtifacts(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(sessionId));
    notifyChange();
  } catch {
    /* ignore */
  }
}
