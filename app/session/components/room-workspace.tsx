"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Play, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  buildGraphForRoom,
  deriveSessionPhaseAtMs,
  getRoomSessionMeta,
  MOCK_TRANSCRIPT,
} from "../data/room-graph-mock";
import type {
  RoomGraphNode,
  RoomPhaseKey,
  RoomSessionMeta,
  TranscriptEntry,
} from "../data/room-graph-types";
import { RoomChatBar } from "./room-chat-bar";
import { RoomGraphFallback } from "./room-graph-fallback";
import { roomHudDock, roomImmersiveCanvas } from "./room-immersive-surfaces";
import { RoomOrchestrationStage } from "./room-orchestration-stage";
import { RoomReplayTimeline } from "./room-replay-timeline";
import { RoomTopBar } from "./room-top-bar";
import { RoomTracePanel } from "./room-trace-panel";
import { RoomTranscript } from "./room-transcript";

const RoomKnowledgeGraph = dynamic(
  () => import("./room-knowledge-graph").then((m) => m.RoomKnowledgeGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-white/45">
        Đang tải knowledge graph…
      </div>
    ),
  }
);

const LOCAL_SESSION_ID = "room-001";
const CHAT_TRANSITION = { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const };

type VoiceState = "idle" | "listening" | "agent-speaking" | "processing";

const DEMO_VOICE_UTTERANCES = [
  "Mình nghĩ nên ưu tiên chi phí thấp hơn là tốc độ triển khai.",
  "Có rủi ro gì nếu làm theo hướng này không?",
  "Thử kết hợp thêm validation qua WiFi xem sao.",
  "Ok, vậy mình chốt phương án này cho MVP.",
];

const DEMO_AGENT_REPLIES = [
  "Ghi nhận rồi — mình thêm vào Thinking Trace của phase hiện tại.",
  "Ý này khá thú vị, để mình đối chiếu với insight trước đó.",
  "Được, mình cập nhật readiness score theo hướng này.",
  "Câu hỏi hay — bạn có muốn thử Devil's Advocate cho ý này không?",
];

function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function RoomWorkspace() {
  const reduceMotion = useReducedMotion();
  const [meta] = useState<RoomSessionMeta>(() => getRoomSessionMeta(LOCAL_SESSION_ID));
  const graphData = useMemo(() => buildGraphForRoom(LOCAL_SESSION_ID), []);

  const [exploreOpen, setExploreOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<RoomGraphNode | null>(null);
  const [focusPhase, setFocusPhase] = useState<RoomPhaseKey>(meta.currentPhase);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(MOCK_TRANSCRIPT);
  const voiceTimersRef = useRef<number[]>([]);
  const [replayPercent, setReplayPercent] = useState(42);

  const replayTimestampMs = (replayPercent / 100) * meta.durationMinutes * 60_000;

  const sessionPhase = useMemo(() => {
    if (meta.mode === "replay") {
      return deriveSessionPhaseAtMs(replayTimestampMs);
    }
    return meta.currentPhase;
  }, [meta.mode, meta.currentPhase, replayTimestampMs]);

  const visibleTranscript = useMemo(() => {
    if (meta.mode === "live") return transcript;
    return MOCK_TRANSCRIPT.filter((e) => e.timestampMs <= replayTimestampMs);
  }, [meta.mode, replayTimestampMs, transcript]);

  const handlePhaseFocus = useCallback((phase: RoomPhaseKey) => {
    setFocusPhase(phase);
    setSelectedNode(null);
  }, []);

  const handleNodeSelect = useCallback((node: RoomGraphNode | null) => {
    setSelectedNode(node);
    if (node?.phaseKey) {
      setFocusPhase(node.phaseKey);
    }
  }, []);

  const appendMessage = useCallback(
    (speaker: "user" | "agent", text: string) => {
      setTranscript((prev) => [
        ...prev,
        {
          id: `live-${prev.length}-${Math.round(performance.now())}`,
          speaker,
          text,
          time: new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          timestampMs: Date.now(),
          phaseKey: sessionPhase,
        },
      ]);
    },
    [sessionPhase]
  );

  const queueAgentReply = useCallback(
    (thinkDelay: number, settleDelay: number) => {
      voiceTimersRef.current.push(
        window.setTimeout(() => {
          setVoiceState("agent-speaking");
          appendMessage("agent", pickOne(DEMO_AGENT_REPLIES));
        }, thinkDelay),
        window.setTimeout(() => setVoiceState("idle"), settleDelay)
      );
    },
    [appendMessage]
  );

  const handleMicToggle = useCallback(() => {
    if (voiceState === "processing" || voiceState === "agent-speaking") return;

    voiceTimersRef.current.forEach((id) => window.clearTimeout(id));
    voiceTimersRef.current = [];

    if (!micActive) {
      setMicActive(true);
      setVoiceState("listening");
      return;
    }

    setMicActive(false);
    appendMessage("user", pickOne(DEMO_VOICE_UTTERANCES));
    setVoiceState("processing");
    queueAgentReply(900, 4500);
  }, [micActive, voiceState, appendMessage, queueAgentReply]);

  const handleSendText = useCallback(
    (text: string) => {
      voiceTimersRef.current.forEach((id) => window.clearTimeout(id));
      voiceTimersRef.current = [];

      appendMessage("user", text);
      setVoiceState("processing");
      queueAgentReply(700, 3200);
    },
    [appendMessage, queueAgentReply]
  );

  const handleEndSession = useCallback(() => {
    voiceTimersRef.current.forEach((id) => window.clearTimeout(id));
    voiceTimersRef.current = [];
    setMicActive(false);
    setVoiceState("idle");
    setChatOpen(false);
    setSessionStarted(false);
  }, []);

  useEffect(() => {
    return () => {
      voiceTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const micDisabled = voiceState === "processing" || voiceState === "agent-speaking";
  const showStartHero = meta.mode === "live" && !sessionStarted;
  const chatMotion = reduceMotion ? { duration: 0 } : CHAT_TRANSITION;

  return (
    <div className={cn("relative flex h-dvh flex-col overflow-hidden", roomImmersiveCanvas)}>
      {/* Full-bleed constellation — the room IS the engine */}
      <RoomOrchestrationStage
        state={voiceState}
        compact={chatOpen}
        onHubClick={() => {
          if (showStartHero) return;
          setChatOpen((v) => !v);
        }}
        hubLabel="Orchestrator"
      />

      <RoomTopBar
        meta={meta}
        sessionPhase={sessionPhase}
        voiceState={voiceState}
        onPhaseFocus={handlePhaseFocus}
        onOpenGraph={() => setExploreOpen(true)}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <AnimatePresence initial={false}>
          {chatOpen && !showStartHero ? (
            <motion.div
              key="session-chat"
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -28 }}
              transition={chatMotion}
              className="absolute inset-x-0 top-0 bottom-28 z-10 overflow-y-auto px-4 pt-4 pb-2 lg:px-8"
            >
              <div className="mx-auto w-full max-w-2xl rounded-2xl border border-white/8 bg-[#060a14]/72 p-4 backdrop-blur-md">
                <RoomTranscript
                  entries={visibleTranscript}
                  activeTimestampMs={meta.mode === "replay" ? replayTimestampMs : undefined}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-auto flex shrink-0 flex-col items-center gap-4 px-4 pb-6 pt-2">
          {showStartHero ? (
            <button
              type="button"
              onClick={() => setSessionStarted(true)}
              className="flex items-center gap-2 rounded-full bg-[#ea580c] px-7 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_-8px_rgba(234,88,12,0.75)] transition-transform hover:scale-[1.03]"
            >
              <Play className="size-4 fill-current" />
              Bắt đầu phiên
            </button>
          ) : (
            <div className="w-full max-w-2xl">
              {meta.mode !== "live" ? (
                <div className={roomHudDock}>
                  <RoomReplayTimeline
                    durationMinutes={meta.durationMinutes}
                    positionPercent={replayPercent}
                    onPositionChange={setReplayPercent}
                  />
                </div>
              ) : (
                <RoomChatBar
                  micActive={micActive}
                  micDisabled={micDisabled}
                  onMicToggle={handleMicToggle}
                  onSendText={handleSendText}
                  onClose={handleEndSession}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={exploreOpen} onOpenChange={setExploreOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[min(92dvh,52rem)] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border border-white/10 bg-[#060a14] p-0 sm:max-w-5xl"
        >
          <DialogTitle className="sr-only">Knowledge graph</DialogTitle>
          <DialogDescription className="sr-only">
            Bản đồ kiến thức phiên brainstorm — kéo xoay, scroll để zoom, chọn node để xem Thinking
            Trace.
          </DialogDescription>

          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0">
              {reduceMotion ? (
                <RoomGraphFallback
                  data={graphData}
                  selectedNodeId={selectedNode?.id ?? null}
                  focusPhaseKey={focusPhase}
                  onNodeSelect={handleNodeSelect}
                />
              ) : (
                <RoomKnowledgeGraph
                  data={graphData}
                  selectedNodeId={selectedNode?.id ?? null}
                  focusPhaseKey={focusPhase}
                  liveParticles={meta.mode === "live"}
                  onNodeSelect={handleNodeSelect}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setExploreOpen(false)}
              aria-label="Đóng knowledge graph"
              className="absolute top-4 left-4 z-10 grid size-9 place-items-center rounded-full border border-white/12 bg-[#0b1528]/85 text-white shadow-md backdrop-blur-md hover:bg-[#0b1528]"
            >
              <X className="size-4" />
            </button>

            {!selectedNode ? (
              <div className="pointer-events-none absolute bottom-5 left-5 max-w-xs text-[11px] text-white/40">
                Kéo xoay · scroll zoom · click node → Thinking Trace
              </div>
            ) : (
              <div className="absolute top-4 right-4 bottom-4 z-10 w-[min(100%,20rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1528]/92 p-4 shadow-xl backdrop-blur-xl">
                <RoomTracePanel node={selectedNode} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
