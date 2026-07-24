"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { WorkflowNodeId } from "@/app/session/components/room-orb-layout";
import { AgentAudioPlayer } from "@/lib/audio/agent-audio-player";
import { applyTurnStreamEvent } from "@/lib/brainstorm/apply-turn-event";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import { clampEngineStep } from "@/lib/brainstorm/engine-steps";
import { consumeSseStream } from "@/lib/brainstorm/consume-sse-stream";
import {
  createMockSessionDriver,
  isBrainstormMockMode,
} from "@/lib/brainstorm/mock-session-driver";
import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import type { BrainstormSessionState } from "@/types/brainstorm-stream";

export type BrainstormConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "mock"
  | "error";

type UseBrainstormSessionOptions = {
  enabled: boolean;
  initialTranscript?: TranscriptEntry[];
};

function formatTime(ts = Date.now()) {
  return new Date(ts).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useBrainstormSession({
  enabled,
  initialTranscript = [],
}: UseBrainstormSessionOptions) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<BrainstormConnectionStatus>("idle");
  const [state, setState] = useState<BrainstormSessionState>("idle");
  const [micActive, setMicActive] = useState(false);
  const [engineStep, setEngineStep] = useState(0);
  const [focusNodeId, setFocusNodeId] = useState<WorkflowNodeId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mockRef = useRef<ReturnType<typeof createMockSessionDriver> | null>(null);
  const audioRef = useRef<AgentAudioPlayer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const turnAbortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const transcriptKey = sessionId
    ? brainstormKeys.transcript(sessionId)
    : brainstormKeys.transcript("pending");

  const { data: transcript = initialTranscript } = useQuery({
    queryKey: transcriptKey,
    queryFn: () => initialTranscript,
    enabled: Boolean(sessionId),
    initialData: initialTranscript,
    staleTime: Infinity,
  });

  const patchTranscript = useCallback(
    (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => {
      if (!sessionId) return;
      queryClient.setQueryData<TranscriptEntry[]>(brainstormKeys.transcript(sessionId), (prev) =>
        updater(prev ?? initialTranscript)
      );
    },
    [initialTranscript, queryClient, sessionId]
  );

  const ensureAudio = () => {
    if (!audioRef.current) audioRef.current = new AgentAudioPlayer();
    return audioRef.current;
  };

  const createSessionMutation = useMutation({
    mutationFn: () => brainstormSessionApi.create({}),
  });

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

  const startSession = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setError(null);

    if (isBrainstormMockMode()) {
      setSessionId("mock");
      queryClient.setQueryData(brainstormKeys.transcript("mock"), initialTranscript);
      setConnectionStatus("mock");
      mockRef.current = createMockSessionDriver({
        onState: setState,
        onMicActive: setMicActive,
        onEngineStep: (step, focusNodeId) => {
          setEngineStep(step);
          setFocusNodeId(focusNodeId ?? null);
        },
        onTranscript: (updater) => {
          patchTranscript(updater);
        },
      });
      return;
    }

    setConnectionStatus("connecting");
    try {
      const snapshot = await createSessionMutation.mutateAsync();
      setSessionId(snapshot.sessionId);
      setEngineStep(clampEngineStep(snapshot.engineStep));
      setState(snapshot.state);
      queryClient.setQueryData(
        brainstormKeys.transcript(snapshot.sessionId),
        snapshot.transcript ?? initialTranscript
      );
      queryClient.setQueryData(brainstormKeys.session(snapshot.sessionId), snapshot);
      setConnectionStatus("connected");
    } catch (err) {
      console.warn("[useBrainstormSession] live failed — fallback mock", err);
      setSessionId("mock");
      queryClient.setQueryData(brainstormKeys.transcript("mock"), initialTranscript);
      setConnectionStatus("mock");
      mockRef.current = createMockSessionDriver({
        onState: setState,
        onMicActive: setMicActive,
        onEngineStep: (step, focusNodeId) => {
          setEngineStep(step);
          setFocusNodeId(focusNodeId ?? null);
        },
        onTranscript: (updater) => patchTranscript(updater),
      });
    }
  }, [createSessionMutation, initialTranscript, patchTranscript, queryClient]);

  const endSession = useCallback(() => {
    startedRef.current = false;
    mockRef.current?.dispose();
    mockRef.current = null;
    teardownLive();
    setSessionId(null);
    setConnectionStatus("idle");
    setMicActive(false);
    setState("idle");
  }, [teardownLive]);

  useEffect(() => {
    if (!enabled) endSession();
  }, [enabled, endSession]);

  useEffect(() => {
    return () => {
      mockRef.current?.dispose();
      teardownLive();
    };
  }, [teardownLive]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (mockRef.current) {
        mockRef.current.sendText(trimmed);
        return;
      }

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
    [patchTranscript, postTurnMutation]
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
    if (state === "processing" || state === "agent-speaking") return;

    if (mockRef.current) {
      mockRef.current.toggleMic(!micActive);
      return;
    }

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
  }, [micActive, postTurnMutation, startVoiceCapture, state, stopVoiceCapture]);

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
