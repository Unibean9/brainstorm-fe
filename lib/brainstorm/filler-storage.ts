const FILLER_ENABLED_KEY = "brainstorm_filler_enabled";

export function readFillerEnabledPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(FILLER_ENABLED_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function writeFillerEnabledPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILLER_ENABLED_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}
