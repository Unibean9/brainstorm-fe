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
import type {
  BrainstormSessionSnapshot,
  BrainstormSessionState,
  BrainstormPhaseKey,
  ReasoningState,
} from "@/types/brainstorm-stream";
import type { BrainstormLanguage } from "@/types/brainstorm-domain";
import type {
  AgentAudioPlayerOptions,
  AgentAudioSegmentMetadata,
  AgentAudioTelemetry,
} from "@/lib/audio/agent-audio-player";

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
    setLanguage?: (language: BrainstormLanguage) => void;
  }
) {
  setters.setEngineStep(clampEngineStep(snapshot.engineStep));
  setters.setState(snapshot.state === "processing" ? "processing" : "idle");
  setters.setSessionPhaseKey(snapshot.phaseKey ?? "framing");
  setters.setVoiceId?.(snapshot.voiceId);
  setters.setLanguage?.(snapshot.language ?? "vi");
}

function formatTurnError(err: unknown) {
  if (err instanceof BrainstormApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Turn stream failed";
}

function waitForNextSnapshot(signal: AbortSignal, delayMs: number) {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    function onAbort() {
      window.clearTimeout(timeoutId);
      resolve(false);
    }
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function useBrainstormSession({ sessionId, enabled }: UseBrainstormSessionOptions) {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<BrainstormConnectionStatus>("idle");
  const [state, setState] = useState<BrainstormSessionState>("idle");
  const [micActive, setMicActive] = useState(false);
  const [engineStep, setEngineStep] = useState(0);
  const [sessionPhaseKey, setSessionPhaseKey] = useState<BrainstormPhaseKey>("framing");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [language, setLanguage] = useState<BrainstormLanguage>("vi");
  const [focusNodeId, setFocusNodeId] = useState<WorkflowNodeId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [fillerActive, setFillerActive] = useState(false);
  const [snapshot, setSnapshot] = useState<BrainstormSessionSnapshot | null>(null);
  const [advisory, setAdvisory] = useState<ReasoningState | null>(null);
  const [advisoryWarning, setAdvisoryWarning] = useState<string | null>(null);
  const [advisoryDiagnostic, setAdvisoryDiagnostic] = useState<string | null>(null);

  const audioRef = useRef<AgentAudioPlayer | null>(null);
  const speechRef = useRef<BrowserSpeechSession | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const streamTokenRef = useRef<symbol | null>(null);
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

  const stopFiller = useCallback(() => {
    setFillerActive(false);
  }, []);

  const updateActiveAudioSegment = useCallback(
    (segment: AgentAudioSegmentMetadata, active: boolean) => {
      patchTranscript((prev) =>
        prev.map((entry) => {
          if (entry.id !== segment.messageId) return entry;
          if (!active) {
            if (entry.activeAudioSegmentId !== segment.segmentId) return entry;
            const withoutActive = { ...entry };
            delete withoutActive.activeAudioSegmentId;
            return withoutActive;
          }
          if (!entry.audioSegments?.some((item) => item.segmentId === segment.segmentId)) {
            return entry;
          }
          return { ...entry, activeAudioSegmentId: segment.segmentId };
        })
      );
    },
    [patchTranscript]
  );

  const reportAudioTelemetry = useCallback((event: AgentAudioTelemetry) => {
    // Every timing field uses performance.now()/AudioContext.currentTime. Keep
    // this structured log available for browser traces without changing UI.
    console.debug("[brainstorm-audio]", event);
  }, []);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const options: AgentAudioPlayerOptions = {
        onTelemetry: reportAudioTelemetry,
        onError: (audioError) => setWarning(audioError.message),
        onSegmentStart: (segment) => updateActiveAudioSegment(segment, true),
        onSegmentDone: (segment) => updateActiveAudioSegment(segment, false),
      };
      audioRef.current = new AgentAudioPlayer(options);
    }
    return audioRef.current;
  }, [reportAudioTelemetry, updateActiveAudioSegment]);

  /** Mất kết nối SSE giữa chừng không huỷ turn — đồng bộ lại UI từ snapshot thay vì đoán. */
  const resyncFromSnapshot = useCallback(
    async (signal?: AbortSignal) => {
      while (!signal?.aborted) {
        try {
          const snapshot = await brainstormSessionApi.get(sessionId);
          if (signal?.aborted) return;

          const audio = audioRef.current;
          const audioPending = Boolean(audio?.isPlaying);
          // A final snapshot is authoritative only after browser audio drains.
          // Hydrating earlier would replace the live entry and clear the active
          // segment highlight while the scheduled source is still speaking.
          if (audioPending && snapshot.state !== "processing") {
            await audio?.whenIdle();
            if (signal?.aborted) return;
          }

          applySnapshotToUi(snapshot, {
            setEngineStep,
            setState,
            setSessionPhaseKey,
            setVoiceId,
            setLanguage,
          });
          setSnapshot(snapshot);
          if (snapshot.state !== "processing" && (!audioPending || !audio?.isPlaying)) {
            hydrateBrainstormSessionCache(queryClient, snapshot);
          }

          // A disconnected SSE subscriber does not cancel the backend turn. Keep the
          // lifecycle state truthful until the backend reports that the turn is idle.
          if (snapshot.state !== "processing" || !signal) return;
          if (!(await waitForNextSnapshot(signal, 800))) return;
        } catch {
          /* best-effort — giữ nguyên UI hiện tại nếu resync cũng lỗi */
          return;
        }
      }
    },
    [queryClient, sessionId]
  );

  const runTurnStream = useCallback(
    async (body: Parameters<typeof brainstormSessionApi.postTurnStream>[1]) => {
      // abort() chỉ ngắt kết nối SSE phía client — từ bản refactor turn-runner,
      // turn vẫn chạy tiếp ở backend độc lập với request HTTP. Không được coi
      // abort xong là turn đã dừng; state thật chỉ biết được qua SSE resolve
      // hoặc resyncFromSnapshot().
      turnAbortRef.current?.abort();
      const ac = new AbortController();
      turnAbortRef.current = ac;
      const streamToken = Symbol("brainstorm-stream");
      streamTokenRef.current = streamToken;
      const isCurrentStream = () => streamTokenRef.current === streamToken;

      try {
        const response = await brainstormSessionApi.postTurnStream(sessionId, body, ac.signal);
        if (!isCurrentStream()) return;
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
            setSnapshot(json.data.snapshot);
            applySnapshotToUi(json.data.snapshot, {
              setEngineStep,
              setState,
              setSessionPhaseKey,
              setVoiceId,
              setLanguage,
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
          setAdvisory,
          setAdvisoryWarning,
          setAdvisoryDiagnostic,
          setSnapshot,
          setError,
          setWarning,
          setTranscript: patchTranscript,
          audio: ensureAudio(),
          stopFiller,
        };

        await consumeSseStream(
          response,
          (event, envelope) => {
            if (isCurrentStream()) applyTurnStreamEvent(event, envelope, ctx);
          },
          ac.signal
        );
        if (!isCurrentStream()) return;
        // The stream may finish without an audio-done event on text-only or
        // partial-audio turns. Marking completion here keeps whenIdle truthful
        // without changing the full transcript.
        ensureAudio().markStreamComplete();
        // The advisory event is model-authored and may be partial. Refresh once after the
        // replayable stream completes so Working Brief, adaptive mode and revision come from the
        // persisted server snapshot rather than only from optimistic SSE metadata.
        await resyncFromSnapshot(ac.signal);
      } catch (err) {
        if (!isCurrentStream()) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          // No later SSE event can settle the browser-side queue after abort.
          // Invalidate it so a new turn cannot inherit stale pending work.
          ensureAudio().stop();
        } else {
          // A dropped connection may have left decoded/scheduled chunks behind;
          // let those drain while the snapshot catches up.
          ensureAudio().markStreamComplete();
        }
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          // Đóng kết nối giữa chừng không huỷ turn ở BE — đồng bộ lại thay vì báo lỗi cứng.
          void resyncFromSnapshot(ac.signal);
        }
        throw err;
      } finally {
        if (isCurrentStream()) {
          stopFiller();
          streamTokenRef.current = null;
          if (turnAbortRef.current === ac) turnAbortRef.current = null;
        }
      }
    },
    [ensureAudio, patchTranscript, queryClient, resyncFromSnapshot, sessionId, stopFiller]
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
    streamTokenRef.current = null;
    speechRef.current?.abort();
    speechRef.current = null;
    audioRef.current?.stop();
    patchTranscript((prev) =>
      prev.map((entry) => {
        if (!entry.activeAudioSegmentId) return entry;
        const withoutActive = { ...entry };
        delete withoutActive.activeAudioSegmentId;
        return withoutActive;
      })
    );
  }, [patchTranscript]);

  const startSession = useCallback(async (): Promise<boolean> => {
    if (startedRef.current) {
      return connectionStatus === "connected";
    }
    startedRef.current = true;
    setError(null);
    setConnectionStatus("connecting");
    // Unlock browser audio from the Play button's user gesture. TTS chunks arrive
    // asynchronously over SSE and are otherwise vulnerable to autoplay blocking.
    void ensureAudio()
      .unlock()
      .catch((err) => {
        setWarning(err instanceof Error ? err.message : "audio_unavailable");
      });

    try {
      const snapshot = await loadSessionMutation.mutateAsync(sessionId);
      applySnapshotToUi(snapshot, {
        setEngineStep,
        setState,
        setSessionPhaseKey,
        setVoiceId,
        setLanguage,
      });
      setSnapshot(snapshot);
      hydrateBrainstormSessionCache(queryClient, snapshot);
      setConnectionStatus("connected");
      return true;
    } catch (err) {
      startedRef.current = false;
      setConnectionStatus("error");
      setError(formatTurnError(err));
      return false;
    }
  }, [connectionStatus, ensureAudio, loadSessionMutation, queryClient, sessionId]);

  const endSession = useCallback(() => {
    startedRef.current = false;
    teardownLive();
    setConnectionStatus("idle");
    setMicActive(false);
    setState("idle");
    setEngineStep(0);
    setSessionPhaseKey("framing");
    setVoiceId(null);
    setLanguage("vi");
    setFocusNodeId(null);
    setError(null);
    setWarning(null);
    setFillerActive(false);
    setSnapshot(null);
    setAdvisory(null);
    setAdvisoryWarning(null);
    setAdvisoryDiagnostic(null);
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
      audioRef.current?.dispose();
      audioRef.current = null;
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
      // Also unlock on direct chat submission for sessions entered through an
      // automatic path or when the browser revoked the previous media permission.
      void ensureAudio()
        .unlock()
        .catch((err) => {
          setWarning(err instanceof Error ? err.message : "audio_unavailable");
        });
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
      setAdvisory(null);
      setAdvisoryWarning(null);
      setAdvisoryDiagnostic(null);
      setFillerActive(true);

      await postTurnMutation.mutateAsync({
        clientTurnId,
        text: trimmed,
        audioMode: "streaming",
      });
    },
    [ensureAudio, patchTranscript, postTurnMutation]
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
        speechRef.current = startBrowserSpeechRecognition({
          onError: (err) => {
            speechRef.current = null;
            setMicActive(false);
            setState("idle");
            setError(err.message || "Nhận giọng nói thất bại");
          },
          onEnd: (text) => {
            // Chrome may end a recognition session on its own. Do not leave the
            // UI in LISTENING and do not lose a final transcript in that case.
            speechRef.current = null;
            setMicActive(false);
            if (!text) {
              setState("idle");
              return;
            }
            void submitTurn(text).catch((err) => {
              setState("idle");
              setError(err instanceof Error ? err.message : "Gửi giọng nói thất bại");
            });
          },
        });
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
    language,
    focusNodeId,
    setFocusNodeId,
    error,
    warning,
    snapshot,
    advisory,
    advisoryWarning,
    advisoryDiagnostic,
    fillerActive,
    isTurnPending: postTurnMutation.isPending,
    startSession,
    endSession,
    sendText,
    toggleMic,
  };
}
