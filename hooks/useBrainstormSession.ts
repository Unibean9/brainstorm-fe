"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { WorkflowNodeId } from "@/app/session/components/room-orb-layout";
import { AgentAudioPlayer } from "@/lib/audio/agent-audio-player";
import {
  startBrowserSpeechRecognition,
  type BrowserSpeechSession,
} from "@/lib/brainstorm/browser-speech-recognition";
import { applyTurnStreamEvent } from "@/lib/brainstorm/apply-turn-event";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import { clampEngineStep } from "@/lib/brainstorm/engine-steps";
import { consumeSseStream } from "@/lib/brainstorm/consume-sse-stream";
import { BrainstormApiError } from "@/lib/brainstorm/parse-api-error";
import {
  clearStoredSessionId,
  readStoredSessionId,
  writeStoredSessionId,
} from "@/lib/brainstorm/session-storage";
import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import {
  hydrateBrainstormSessionCache,
  useBrainstormTranscriptQuery,
  useCreateBrainstormSessionMutation,
  useResumeBrainstormSessionMutation,
} from "@/hooks/queries/useBrainstormSessionQueries";
import type { BrainstormSessionSnapshot, BrainstormSessionState, BrainstormPhaseKey } from "@/types/brainstorm-stream";

export type BrainstormConnectionStatus = "idle" | "connecting" | "connected" | "error";

type UseBrainstormSessionOptions = {
  enabled: boolean;
};

function formatTime(ts = Date.now()) {
  return new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function newClientTurnId() {
  return globalThis.crypto?.randomUUID?.() ?? `turn-${Date.now()}`;
}

function applySnapshotToUi(
  snapshot: BrainstormSessionSnapshot,
  setters: {
    setSessionId: (id: string) => void;
    setEngineStep: (step: number) => void;
    setState: (state: BrainstormSessionState) => void;
    setSessionPhaseKey: (phaseKey: BrainstormPhaseKey) => void;
  }
) {
  writeStoredSessionId(snapshot.sessionId);
  setters.setSessionId(snapshot.sessionId);
  setters.setEngineStep(clampEngineStep(snapshot.engineStep));
  setters.setState(snapshot.state === "processing" ? "processing" : "idle");
  setters.setSessionPhaseKey(snapshot.phaseKey);
}

function formatTurnError(err: unknown) {
  if (err instanceof BrainstormApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Turn stream failed";
}

export function useBrainstormSession({ enabled }: UseBrainstormSessionOptions) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<BrainstormConnectionStatus>("idle");
  const [state, setState] = useState<BrainstormSessionState>("idle");
  const [micActive, setMicActive] = useState(false);
  const [engineStep, setEngineStep] = useState(0);
  const [sessionPhaseKey, setSessionPhaseKey] = useState<BrainstormPhaseKey>("framing");
  const [focusNodeId, setFocusNodeId] = useState<WorkflowNodeId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fillerActive, setFillerActive] = useState(false);

  const audioRef = useRef<AgentAudioPlayer | null>(null);
  const speechRef = useRef<BrowserSpeechSession | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const createSessionMutation = useCreateBrainstormSessionMutation();
  const resumeSessionMutation = useResumeBrainstormSessionMutation();

  const { data: transcript = [] } = useBrainstormTranscriptQuery(sessionId);

  const patchTranscript = useCallback(
    (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => {
      if (!sessionId) return;
      queryClient.setQueryData<TranscriptEntry[]>(brainstormKeys.transcript(sessionId), (prev) =>
        updater(prev ?? [])
      );
    },
    [queryClient, sessionId]
  );

  const ensureAudio = () => {
    if (!audioRef.current) audioRef.current = new AgentAudioPlayer();
    return audioRef.current;
  };

  const stopFiller = useCallback(() => {
    setFillerActive(false);
  }, []);

  const runTurnStream = useCallback(
    async (body: Parameters<typeof brainstormSessionApi.postTurnStream>[1]) => {
      if (!sessionId) return;

      turnAbortRef.current?.abort();
      const ac = new AbortController();
      turnAbortRef.current = ac;

      const response = await brainstormSessionApi.postTurnStream(sessionId, body, ac.signal);
      const ctx = {
        setState,
        setEngineStep,
        setFocusNodeId,
        setSessionPhaseKey,
        setError,
        setTranscript: patchTranscript,
        audio: ensureAudio(),
        stopFiller,
      };

      try {
        await consumeSseStream(
          response,
          (event, envelope) => applyTurnStreamEvent(event, envelope, ctx),
          ac.signal
        );
      } finally {
        stopFiller();
      }
    },
    [patchTranscript, sessionId, stopFiller]
  );

  const postTurnMutation = useMutation({
    mutationFn: runTurnStream,
    onError: (err) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      stopFiller();
      setError(formatTurnError(err));
      setState("idle");
    },
  });

  const teardownLive = useCallback(() => {
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    speechRef.current?.abort();
    speechRef.current = null;
    audioRef.current?.stop();
  }, []);

  const startSession = useCallback(async (): Promise<boolean> => {
    if (startedRef.current) {
      return connectionStatus === "connected";
    }
    startedRef.current = true;
    setError(null);
    setConnectionStatus("connecting");

    const setters = { setSessionId, setEngineStep, setState, setSessionPhaseKey };

    try {
      const storedId = readStoredSessionId();
      if (storedId) {
        try {
          const snapshot = await resumeSessionMutation.mutateAsync(storedId);
          applySnapshotToUi(snapshot, setters);
          hydrateBrainstormSessionCache(queryClient, snapshot);
          setConnectionStatus("connected");
          return true;
        } catch {
          clearStoredSessionId();
        }
      }

      const snapshot = await createSessionMutation.mutateAsync({});
      applySnapshotToUi(snapshot, setters);
      hydrateBrainstormSessionCache(queryClient, snapshot);
      setConnectionStatus("connected");
      return true;
    } catch (err) {
      startedRef.current = false;
      setConnectionStatus("error");
      setError(formatTurnError(err));
      return false;
    }
  }, [connectionStatus, createSessionMutation, queryClient, resumeSessionMutation]);

  const endSession = useCallback(() => {
    startedRef.current = false;
    teardownLive();
    clearStoredSessionId();
    setSessionId(null);
    setConnectionStatus("idle");
    setMicActive(false);
    setState("idle");
    setEngineStep(0);
    setSessionPhaseKey("framing");
    setFocusNodeId(null);
    setError(null);
    setFillerActive(false);
  }, [teardownLive]);

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        endSession();
      });
    }
  }, [enabled, endSession]);

  useEffect(() => {
    return () => {
      teardownLive();
    };
  }, [teardownLive]);

  const submitTurn = useCallback(
    async (text: string, options?: { optimistic?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId) return;

      const clientTurnId = newClientTurnId();
      if (options?.optimistic !== false) {
        patchTranscript((prev) => [
          ...prev,
          {
            id: clientTurnId,
            speaker: "user",
            text: trimmed,
            time: formatTime(),
            timestampMs: Date.now(),
            phaseKey: "Framing",
          },
        ]);
      }
      setState("processing");
      setError(null);
      setFillerActive(true);

      await postTurnMutation.mutateAsync({
        clientTurnId,
        text: trimmed,
      });
    },
    [patchTranscript, postTurnMutation, sessionId]
  );

  const sendText = useCallback(
    async (text: string) => {
      await submitTurn(text);
    },
    [submitTurn]
  );

  const toggleMic = useCallback(async () => {
    if (!sessionId || state === "processing" || state === "agent-speaking") return;

    if (!micActive) {
      setMicActive(true);
      setState("listening");
      setError(null);
      try {
        speechRef.current = startBrowserSpeechRecognition();
      } catch (err) {
        setMicActive(false);
        setState("idle");
        setError(err instanceof Error ? err.message : "Mic failed");
      }
      return;
    }

    setMicActive(false);
    const session = speechRef.current;
    speechRef.current = null;

    if (!session) {
      setState("idle");
      return;
    }

    try {
      const text = await session.stop();
      if (!text.trim()) {
        setState("idle");
        return;
      }
      await submitTurn(text);
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Nhận giọng nói thất bại");
    }
  }, [micActive, sessionId, state, submitTurn]);

  return {
    sessionId,
    connectionStatus,
    state,
    micActive,
    transcript,
    engineStep,
    sessionPhaseKey,
    focusNodeId,
    setFocusNodeId,
    error,
    fillerActive,
    isTurnPending: postTurnMutation.isPending,
    startSession,
    endSession,
    sendText,
    toggleMic,
  };
}
