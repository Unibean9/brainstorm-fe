"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import { mapSessionSnapshot } from "@/lib/brainstorm/map-session-snapshot";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import type {
  BrainstormPitchDeckFormat,
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
      hydrateBrainstormSessionCache(queryClient, snapshot);
    },
  });
}

export function useResumeBrainstormSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => brainstormSessionApi.get(sessionId),
    onSuccess: (snapshot) => {
      hydrateBrainstormSessionCache(queryClient, snapshot);
    },
  });
}

export function useUpdateBrainstormVoiceMutation() {
  return useMutation({
    mutationFn: ({ sessionId, voiceId = "default" }: { sessionId: string; voiceId?: string }) =>
      brainstormSessionApi.updateVoice(sessionId, voiceId),
  });
}

export function useCreateBrainstormReportMutation() {
  return useMutation({
    mutationFn: (sessionId: string) => brainstormSessionApi.createReport(sessionId),
  });
}

export function useCreateBrainstormLandingPageMutation() {
  return useMutation({
    mutationFn: (sessionId: string) => brainstormSessionApi.createLandingPage(sessionId),
  });
}

export function useCreateBrainstormPitchDeckMutation() {
  return useMutation({
    mutationFn: ({
      sessionId,
      format,
    }: {
      sessionId: string;
      format: BrainstormPitchDeckFormat;
    }) => brainstormSessionApi.createPitchDeck(sessionId, format),
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
