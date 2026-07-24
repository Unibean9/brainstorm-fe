"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { WorkflowNodeId } from "@/app/session/components/room-orb-layout";
import { AgentAudioPlayer } from "@/lib/audio/agent-audio-player";
import { applyTurnStreamEvent } from "@/lib/brainstorm/apply-turn-event";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import { clampEngineStep } from "@/lib/brainstorm/engine-steps";
import { consumeSseStream } from "@/lib/brainstorm/consume-sse-stream";
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
import type { BrainstormSessionSnapshot, BrainstormSessionState } from "@/types/brainstorm-stream";

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

function applySnapshotToUi(
  snapshot: BrainstormSessionSnapshot,
  setters: {
    setSessionId: (id: string) => void;
    setEngineStep: (step: number) => void;
    setState: (state: BrainstormSessionState) => void;
  }
) {
  writeStoredSessionId(snapshot.sessionId);
  setters.setSessionId(snapshot.sessionId);
  setters.setEngineStep(clampEngineStep(snapshot.engineStep));
  setters.setState(snapshot.state);
}

export function useBrainstormSession({ enabled }: UseBrainstormSessionOptions) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<BrainstormConnectionStatus>("idle");
  const [state, setState] = useState<BrainstormSessionState>("idle");
  const [micActive, setMicActive] = useState(false);
  const [engineStep, setEngineStep] = useState(0);
  const [focusNodeId, setFocusNodeId] = useState<WorkflowNodeId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<AgentAudioPlayer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
        setError,
        setTranscript: patchTranscript,
        audio: ensureAudio(),
      };

      await consumeSseStream(
        response,
        (event, envelope) => applyTurnStreamEvent(event, envelope, ctx),
        ac.signal
      );
    },
    [patchTranscript, sessionId]
  );

  const postTurnMutation = useMutation({
    mutationFn: runTurnStream,
    onError: (err) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Turn stream failed");
      setState("idle");
    },
  });

  const teardownLive = useCallback(() => {
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    audioChunksRef.current = [];
    audioRef.current?.stop();
  }, []);

  const startSession = useCallback(async (): Promise<boolean> => {
    if (startedRef.current) {
      return connectionStatus === "connected";
    }
    startedRef.current = true;
    setError(null);
    setConnectionStatus("connecting");

    const setters = { setSessionId, setEngineStep, setState };

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
      setError(err instanceof Error ? err.message : "Không kết nối được phiên brainstorm");
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
    setFocusNodeId(null);
    setError(null);
  }, [teardownLive]);

  useEffect(() => {
    if (!enabled) endSession();
  }, [enabled, endSession]);

  useEffect(() => {
    return () => {
      teardownLive();
    };
  }, [teardownLive]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !sessionId) return;

      const clientTurnId = `turn-${Date.now()}`;
      patchTranscript((prev) => [
        ...prev,
        {
          id: clientTurnId,
          speaker: "user",
          text: trimmed,
          time: formatTime(),
          timestampMs: Date.now(),
          phaseKey: "Explore",
        },
      ]);
      setState("processing");

      await postTurnMutation.mutateAsync({
        clientTurnId,
        text: trimmed,
      });
    },
    [patchTranscript, postTurnMutation, sessionId]
  );

  const stopVoiceCapture = useCallback(async (): Promise<string | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        recorderRef.current = null;

        if (!blob.size) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            resolve(null);
            return;
          }
          resolve(result.split(",")[1] ?? null);
        };
        reader.readAsDataURL(blob);
      };
      recorder.stop();
    });
  }, []);

  const startVoiceCapture = useCallback(async () => {
    audioChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;
    recorder.ondataavailable = (ev) => {
      if (ev.data.size) audioChunksRef.current.push(ev.data);
    };
    recorder.start(250);
  }, []);

  const toggleMic = useCallback(async () => {
    if (!sessionId || state === "processing" || state === "agent-speaking") return;

    if (!micActive) {
      setMicActive(true);
      setState("listening");
      try {
        await startVoiceCapture();
      } catch (err) {
        setMicActive(false);
        setState("idle");
        setError(err instanceof Error ? err.message : "Mic failed");
      }
      return;
    }

    setMicActive(false);
    setState("processing");

    const audioBase64 = await stopVoiceCapture();
    const clientTurnId = `vturn-${Date.now()}`;

    await postTurnMutation.mutateAsync({
      clientTurnId,
      audioBase64: audioBase64 ?? undefined,
      audioMime: "audio/webm",
    });
  }, [micActive, postTurnMutation, sessionId, startVoiceCapture, state, stopVoiceCapture]);

  return {
    sessionId,
    connectionStatus,
    state,
    micActive,
    transcript,
    engineStep,
    focusNodeId,
    setFocusNodeId,
    error,
    isTurnPending: postTurnMutation.isPending,
    startSession,
    endSession,
    sendText,
    toggleMic,
  };
}
