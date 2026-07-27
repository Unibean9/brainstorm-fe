"use client";

import { useSyncExternalStore } from "react";

import {
  readStoredSessionArtifacts,
  subscribeStoredSessionArtifacts,
  type StoredSessionArtifacts,
} from "@/lib/brainstorm/artifact-storage";

const cache = new Map<string, { raw: string; value: StoredSessionArtifacts | null }>();

function getServerSnapshot(): StoredSessionArtifacts | null {
  return null;
}

export function useStoredSessionArtifacts(
  sessionId: string | null
): StoredSessionArtifacts | null {
  return useSyncExternalStore(
    subscribeStoredSessionArtifacts,
    () => {
      if (!sessionId) return null;
      const next = readStoredSessionArtifacts(sessionId);
      const raw = JSON.stringify(next);
      const entry = cache.get(sessionId);
      if (entry && entry.raw === raw) return entry.value;
      cache.set(sessionId, { raw, value: next });
      return next;
    },
    getServerSnapshot
  );
}
