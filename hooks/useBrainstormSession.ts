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
import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import {
  hydrateBrainstormSessionCache,
  useBrainstormTranscriptQuery,
  useLoadBrainstormSessionMutation,
} from "@/hooks/queries/useBrainstormSessionQueries";
import type { BrainstormSessionSnapshot, BrainstormSessionState, BrainstormPhaseKey } from "@/types/brainstorm-stream";

export type BrainstormConnectionStatus = "idle" | "connecting" | "connected" | "error";

type UseBrainstormSessionOptions = {
  /** sessionId đã tồn tại — tạo trước đó qua POST /rooms/:roomId/sessions. */
  sessionId: string;
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
    setEngineStep: (step: number) => void;
    setState: (state: BrainstormSessionState) => void;
    setSessionPhaseKey: (phaseKey: BrainstormPhaseKey) => void;
    setVoiceId?: (voiceId: string) => void;
  }
) {
  setters.setEngineStep(clampEngineStep(snapshot.engineStep));
  setters.setState(snapshot.state === "processing" ? "processing" : "idle");
  setters.setSessionPhaseKey(snapshot.phaseKey);
  setters.setVoiceId?.(snapshot.voiceId);
}

function formatTurnError(err: unknown) {
  if (err instanceof BrainstormApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Turn stream failed";
}

export function useBrainstormSession({ sessionId, enabled }: UseBrainstormSessionOptions) {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] =
    useState<BrainstormConnectionStatus>("idle");
  const [state, setState] = useState<BrainstormSessionState>("idle");
  const [micActive, setMicActive] = useState(false);
  const [engineStep, setEngineStep] = useState(0);
  const [sessionPhaseKey, setSessionPhaseKey] = useState<BrainstormPhaseKey>("framing");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<WorkflowNodeId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [fillerActive, setFillerActive] = useState(false);

  const audioRef = useRef<AgentAudioPlayer | null>(null);
  const speechRef = useRef<BrowserSpeechSession | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const loadSessionMutation = useLoadBrainstormSessionMutation();
  const { data: transcript = [] } = useBrainstormTranscriptQuery(sessionId);

  const patchTranscript = useCallback(
    (updater: (prev: TranscriptEntry[]) => TranscriptEntry[]) => {
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

  /** Mất kết nối SSE giữa chừng không huỷ turn — đồng bộ lại UI từ snapshot thay vì đoán. */
  const resyncFromSnapshot = useCallback(async () => {
    try {
      const snapshot = await brainstormSessionApi.get(sessionId);
      applySnapshotToUi(snapshot, { setEngineStep, setState, setSessionPhaseKey, setVoiceId });
      hydrateBrainstormSessionCache(queryClient, snapshot);
    } catch {
      /* best-effort — giữ nguyên UI hiện tại nếu resync cũng lỗi */
    }
  }, [queryClient, sessionId]);

  const runTurnStream = useCallback(
    async (body: Parameters<typeof brainstormSessionApi.postTurnStream>[1]) => {
      // abort() chỉ ngắt kết nối SSE phía client — từ bản refactor turn-runner,
      // turn vẫn chạy tiếp ở backend độc lập với request HTTP. Không được coi
      // abort xong là turn đã dừng; state thật chỉ biết được qua SSE resolve
      // hoặc resyncFromSnapshot().
      turnAbortRef.current?.abort();
      const ac = new AbortController();
      turnAbortRef.current = ac;

      const response = await brainstormSessionApi.postTurnStream(sessionId, body, ac.signal);
      const contentType = response.headers.get("content-type") ?? "";

      // clientTurnId trùng turn cũ: BE trả JSON thường (200 completed / 409 processing|interrupted|failed)
      if (!contentType.includes("text/event-stream")) {
        const json = (await response.json()) as {
          isSuccess: boolean;
          message: string;
          data?: { operation?: { status?: string }; snapshot?: BrainstormSessionSnapshot };
          error?: { code?: string };
        };
        if (json.data?.snapshot) {
          applySnapshotToUi(json.data.snapshot, {
            setEngineStep,
            setState,
            setSessionPhaseKey,
            setVoiceId,
          });
          hydrateBrainstormSessionCache(queryClient, json.data.snapshot);
        }
        if (!json.isSuccess) {
          throw new BrainstormApiError(json.message, json.error?.code, response.status);
        }
        return;
      }

      const ctx = {
        setState,
        setEngineStep,
        setFocusNodeId,
        setSessionPhaseKey,
        setError,
        setWarning,
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
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          // Đóng kết nối giữa chừng không huỷ turn ở BE — đồng bộ lại thay vì báo lỗi cứng.
          void resyncFromSnapshot();
        }
        throw err;
      } finally {
        stopFiller();
      }
    },
    [patchTranscript, queryClient, resyncFromSnapshot, sessionId, stopFiller]
  );

  const postTurnMutation = useMutation({
    mutationFn: runTurnStream,
    onError: (err) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      stopFiller();
      setError(formatTurnError(err));
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

    try {
      const snapshot = await loadSessionMutation.mutateAsync(sessionId);
      applySnapshotToUi(snapshot, { setEngineStep, setState, setSessionPhaseKey, setVoiceId });
      hydrateBrainstormSessionCache(queryClient, snapshot);
      setConnectionStatus("connected");
      return true;
    } catch (err) {
      startedRef.current = false;
      setConnectionStatus("error");
      setError(formatTurnError(err));
      return false;
    }
  }, [connectionStatus, loadSessionMutation, queryClient, sessionId]);

  const endSession = useCallback(() => {
    startedRef.current = false;
    teardownLive();
    setConnectionStatus("idle");
    setMicActive(false);
    setState("idle");
    setEngineStep(0);
    setSessionPhaseKey("framing");
    setVoiceId(null);
    setFocusNodeId(null);
    setError(null);
    setWarning(null);
    setFillerActive(false);
  }, [teardownLive]);

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        endSession();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    return () => {
      teardownLive();
    };
  }, [teardownLive]);

  const submitTurn = useCallback(
    async (text: string, options?: { optimistic?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      // Room chỉ chạy 1 operation cùng lúc ở backend — gửi turn mới khi turn
      // trước còn "processing" (kể cả khi client vừa abort SSE của nó) sẽ ăn
      // 409 room_busy. UI đã disable nút gửi qua isTurnPending/chatBusy, nhưng
      // guard lại ở đây để không phụ thuộc hoàn toàn vào việc đó.
      if (postTurnMutation.isPending) return;

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
      setWarning(null);
      setFillerActive(true);

      await postTurnMutation.mutateAsync({
        clientTurnId,
        text: trimmed,
        audioMode: "streaming",
      });
    },
    [patchTranscript, postTurnMutation]
  );

  const sendText = useCallback(
    async (text: string) => {
      await submitTurn(text);
    },
    [submitTurn]
  );

  const toggleMic = useCallback(async () => {
    if (state === "processing" || state === "agent-speaking") return;

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
  }, [micActive, state, submitTurn]);

  return {
    sessionId,
    connectionStatus,
    state,
    micActive,
    transcript,
    engineStep,
    sessionPhaseKey,
    voiceId,
    focusNodeId,
    setFocusNodeId,
    error,
    warning,
    fillerActive,
    isTurnPending: postTurnMutation.isPending,
    startSession,
    endSession,
    sendText,
    toggleMic,
  };
}
