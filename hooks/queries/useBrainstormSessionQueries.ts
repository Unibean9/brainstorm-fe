"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import type {
  BrainstormSessionSnapshot,
  CreateBrainstormSessionRequest,
} from "@/types/brainstorm-stream";

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

export function useCreateBrainstormSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateBrainstormSessionRequest = {}) => brainstormSessionApi.create(body),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(brainstormKeys.session(snapshot.sessionId), snapshot);
      queryClient.setQueryData(
        brainstormKeys.transcript(snapshot.sessionId),
        snapshot.transcript ?? []
      );
    },
  });
}

export function useResumeBrainstormSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => brainstormSessionApi.get(sessionId),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(brainstormKeys.session(snapshot.sessionId), snapshot);
      queryClient.setQueryData(
        brainstormKeys.transcript(snapshot.sessionId),
        snapshot.transcript ?? []
      );
    },
  });
}

export function useUpdateBrainstormVoiceMutation() {
  return useMutation({
    mutationFn: ({ sessionId, voiceId }: { sessionId: string; voiceId: string }) =>
      brainstormSessionApi.updateVoice(sessionId, voiceId),
  });
}

export function hydrateBrainstormSessionCache(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: BrainstormSessionSnapshot
) {
  queryClient.setQueryData(brainstormKeys.session(snapshot.sessionId), snapshot);
  queryClient.setQueryData(
    brainstormKeys.transcript(snapshot.sessionId),
    snapshot.transcript ?? []
  );
}
