"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import { mapSessionSnapshot } from "@/lib/brainstorm/map-session-snapshot";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import type { BrainstormSessionSnapshot } from "@/types/brainstorm-stream";

export function useBrainstormSessionQuery(sessionId: string | null, enabled = false) {
  return useQuery({
    queryKey: brainstormKeys.session(sessionId ?? "pending"),
    queryFn: () => brainstormSessionApi.get(sessionId!),
    enabled: Boolean(sessionId && enabled),
    staleTime: 30_000,
  });
}

export function useBrainstormTranscriptQuery(sessionId: string | null) {
  return useQuery({
    queryKey: brainstormKeys.transcript(sessionId ?? "pending"),
    queryFn: (): TranscriptEntry[] => [],
    enabled: Boolean(sessionId),
    initialData: [] as TranscriptEntry[],
    staleTime: Infinity,
  });
}

/** Nạp snapshot của 1 session đã tồn tại (tạo qua room) — không tạo session mới. */
export function useLoadBrainstormSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => brainstormSessionApi.get(sessionId),
    onSuccess: (snapshot) => {
      hydrateBrainstormSessionCache(queryClient, snapshot);
    },
  });
}

export function useCreateBrainstormPrdMutation() {
  return useMutation({
    mutationFn: ({ sessionId, force = false }: { sessionId: string; force?: boolean }) =>
      brainstormSessionApi.createPrd(sessionId, force),
  });
}

export function useCreateBrainstormLandingPageMutation() {
  return useMutation({
    mutationFn: (sessionId: string) => brainstormSessionApi.createLandingPage(sessionId),
  });
}

export function useCreateBrainstormPitchDeckMutation() {
  return useMutation({
    mutationFn: (sessionId: string) => brainstormSessionApi.createPitchDeck(sessionId),
  });
}

export function hydrateBrainstormSessionCache(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: BrainstormSessionSnapshot
) {
  const mapped = mapSessionSnapshot(snapshot);
  queryClient.setQueryData(brainstormKeys.session(snapshot.sessionId), mapped);
  queryClient.setQueryData(brainstormKeys.transcript(snapshot.sessionId), mapped.transcript);
}
