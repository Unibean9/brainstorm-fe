"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mic, MessageCircle } from "lucide-react";

import { useSnapListen } from "@/hooks/useSnapListen";
import { useBrainstormSession } from "@/hooks/useBrainstormSession";
import { cn } from "@/lib/utils";

import { engineStepNodeId } from "@/lib/brainstorm/engine-steps";
import {
  RoomEngineRing,
  stepStatus,
} from "./room-engine-ring";
import { RoomChatBar } from "./room-chat-bar";
import type { HubWebglState } from "./room-hub-webgl";
import {
  ORB_CX,
  ORB_CY,
  WORKFLOW_NODES_HANG_OFFSET,
  WORKFLOW_NODES_HOME,
  lerp,
  orbCenter,
  orbCoreRadius,
  spokeCurvePath,
  type WorkflowNodeId,
} from "./room-orb-layout";
import { RoomSessionChat, CHAT_STAGE_COLUMN, CHAT_STAGE_GRID, CHAT_STAGE_INNER } from "./room-session-chat";
import { RoomStandbyGate } from "./room-standby-gate";
import { RoomVoiceStatus } from "./room-voice-status";
import { SessionStatusHud } from "./session-status-hud";

const RoomHubWebgl = dynamic(
  () => import("./room-hub-webgl").then((m) => m.RoomHubWebgl),
  { ssr: false }
);

export type EngineCoreState = HubWebglState;

const ACCENT = {
  cyan: {
    ring: "#67e8f9",
    glow: "rgba(103,232,249,0.85)",
    soft: "rgba(34,211,238,0.45)",
  },
  gold: {
    ring: "#fbbf24",
    glow: "rgba(251,191,36,0.85)",
    soft: "rgba(245,158,11,0.45)",
  },
} as const;

const FADE = { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const };

export function RoomPage() {
  const reduceMotion = useReducedMotion();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [snapFlash, setSnapFlash] = useState(false);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const rootRef = useRef<HTMLDivElement>(null);
  const [dockAmt, setDockAmt] = useState(0);

  const brainstorm = useBrainstormSession({
    enabled: sessionStarted,
  });

  const {
    state,
    micActive,
    transcript,
    engineStep: streamEngineStep,
    focusNodeId,
    setFocusNodeId,
    connectionStatus,
    error: sessionError,
    startSession: connectBrainstorm,
    sendText: handleSendText,
    toggleMic,
  } = brainstorm;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 2 && height > 2) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dockAmtRef = useRef(0);
  useEffect(() => {
    if (reduceMotion) {
      dockAmtRef.current = chatOpen ? 1 : 0;
      setDockAmt(dockAmtRef.current);
      return;
    }
    let raf = 0;
    let frames = 0;
    const target = chatOpen ? 1 : 0;
    const tickDock = () => {
      dockAmtRef.current += (target - dockAmtRef.current) * 0.11;
      frames += 1;
      const settled = Math.abs(target - dockAmtRef.current) < 0.003;
      if (settled) {
        dockAmtRef.current = target;
        setDockAmt(target);
        return;
      }
      if (frames % 3 === 0) setDockAmt(dockAmtRef.current);
      raf = requestAnimationFrame(tickDock);
    };
    raf = requestAnimationFrame(tickDock);
    return () => cancelAnimationFrame(raf);
  }, [chatOpen, reduceMotion]);

  const engineStep = streamEngineStep;
  const railActiveId = focusNodeId ?? engineStepNodeId(engineStep);
  const live = state === "listening" || state === "agent-speaking";
  const voiceLevel = !sessionStarted
    ? 0
    : live
      ? 1
      : state === "processing"
        ? 0.55
        : 0.22;

  const layout = useMemo(() => {
    const { w, h } = size;
    const orb = orbCenter(dockAmt);
    const cx = w * orb.cx;
    const cy = h * orb.cy;
    const coreR = orbCoreRadius(w, h, orb.radiusFactor);
    const rim = coreR + 3;
    const nodeScale = lerp(1, 0.72, dockAmt);

    const nodes = WORKFLOW_NODES_HOME.map((n) => {
      const off = WORKFLOW_NODES_HANG_OFFSET[n.id];
      const hangX = orb.cx + off.dx;
      const hangY = orb.cy + off.dy;
      const x = lerp(n.x, hangX, dockAmt);
      const y = lerp(n.y, hangY, dockAmt);
      return {
        ...n,
        x: x * w,
        y: y * h,
        leftPct: x * 100,
        topPct: y * 100,
        scale: nodeScale,
      };
    });

    const links = nodes.map((n, i) => {
      const dx = n.x - cx;
      const dy = n.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const sx = cx + ux * rim;
      const sy = cy + uy * rim;
      const side = i % 2 === 0 ? 1 : -1;
      const bend = (18 + (i % 3) * 8) * lerp(1, 0.55, dockAmt);
      return {
        id: `${n.id}-spoke`,
        d: spokeCurvePath(sx, sy, n.x, n.y, side * bend),
      };
    });

    return { nodes, links, w, h, cx, cy, coreR };
  }, [size, dockAmt]);

  const handleStart = useCallback(
    async (via: "click" | "snap" = "click") => {
      if (sessionStarted || connectionStatus === "connecting") return;
      const ok = await connectBrainstorm();
      if (!ok) return;
      if (via === "snap") {
        setSnapFlash(true);
        window.setTimeout(() => setSessionStarted(true), reduceMotion ? 0 : 220);
      } else {
        setSessionStarted(true);
      }
    },
    [connectBrainstorm, connectionStatus, reduceMotion, sessionStarted]
  );

  const { status: snapStatus, level: snapLevel, retry: retrySnapMic } = useSnapListen({
    enabled: !sessionStarted && connectionStatus !== "connecting",
    onSnap: () => {
      void handleStart("snap");
    },
  });

  const handleMic = () => {
    if (!sessionStarted) return;
    void toggleMic();
  };

  const motionOff = !!reduceMotion;
  const fade = motionOff ? { duration: 0 } : FADE;
  const orbHit = Math.max(72, layout.coreR * 2.2);
  const chatBusy = state === "processing" || state === "agent-speaking";

  const closeChat = useCallback(() => {
    setChatOpen(false);
    setFocusNodeId(null);
  }, []);

  return (
    <div ref={rootRef} className="relative h-dvh overflow-hidden bg-[#073048] text-white">
      <RoomHubWebgl
        state={state}
        armed={sessionStarted}
        dockProgressRef={dockAmtRef}
        voiceLevel={voiceLevel}
        reduceMotion={reduceMotion}
        className="z-0"
      />

      <AnimatePresence>
        {sessionStarted ? (
          <motion.div
            key="hud"
            className="relative z-40"
            initial={motionOff ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ...fade, delay: motionOff ? 0 : 0.15 }}
          >
            <SessionStatusHud state={state} micActive={micActive} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {sessionStarted ? (
          <motion.div
            key="engine-ring"
            className="absolute inset-0 z-5"
            initial={motionOff ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ ...fade, delay: motionOff ? 0 : 0.2 }}
          >
            <RoomEngineRing
              w={layout.w}
              h={layout.h}
              cx={layout.cx}
              cy={layout.cy}
              coreR={layout.coreR}
              step={engineStep}
              links={layout.links}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {sessionStarted
          ? layout.nodes.map((node, i) => {
              const status = stepStatus(i, engineStep);
              const done = status === "done";
              const active = status === "active";
              const tone = done ? ACCENT.gold : ACCENT[node.accent];
              const docked = dockAmt > 0.55;
              return (
                <div
                  key={node.id}
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: `${node.leftPct}%`,
                    top: `${node.topPct}%`,
                    transform: `translate(-50%, -50%) scale(${node.scale})`,
                    opacity: status === "upcoming" ? 0.42 : 1,
                  }}
                >
                  <div
                    className={cn(
                      "flex flex-col items-center",
                      docked ? "gap-1.5" : "gap-2"
                    )}
                  >
                    <motion.span
                      className={cn(
                        "relative block rounded-full",
                        docked ? "size-6 sm:size-7" : "size-9 sm:size-10"
                      )}
                      style={{
                        background: done
                          ? "rgba(251,191,36,0.18)"
                          : "rgba(5,11,24,0.55)",
                        border: `${active ? 2 : 1.5}px solid ${tone.ring}`,
                        boxShadow: active
                          ? `0 0 14px ${tone.glow}, 0 0 32px ${tone.soft}`
                          : done
                            ? `0 0 8px ${ACCENT.gold.soft}`
                            : `0 0 6px ${tone.soft}`,
                      }}
                      initial={motionOff ? false : { opacity: 0 }}
                      animate={
                        reduceMotion
                          ? { opacity: 1 }
                          : active
                            ? { scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] }
                            : done
                              ? { opacity: 1, scale: 1 }
                              : { opacity: [0.7, 0.85, 0.7] }
                      }
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : {
                              duration: active ? 1.35 : done ? 0.4 : 3.8,
                              repeat: active || status === "upcoming" ? Infinity : 0,
                              ease: "easeInOut",
                              delay: i * 0.02,
                            }
                      }
                    >
                      <span
                        className="pointer-events-none absolute -inset-2 rounded-full"
                        style={{
                          background: `radial-gradient(circle, ${tone.soft} 0%, transparent 72%)`,
                          opacity: active ? 0.9 : done ? 0.55 : 0.35,
                        }}
                        aria-hidden
                      />
                      {done ? (
                        <span
                          className="pointer-events-none absolute inset-[28%] rounded-full bg-[#fbbf24]/80"
                          aria-hidden
                        />
                      ) : null}
                    </motion.span>
                    <span
                      className={cn(
                        "relative z-10 whitespace-nowrap font-medium tracking-wide",
                        active
                          ? "text-white"
                          : done
                            ? "text-amber-200/90"
                            : "text-white/55",
                        docked ? "text-[10px] sm:text-[11px]" : "text-xs sm:text-[13px]"
                      )}
                    >
                      {node.label}
                    </span>
                  </div>
                </div>
              );
            })
          : null}
      </AnimatePresence>

      <AnimatePresence>
        {sessionStarted && chatOpen ? (
          <RoomSessionChat
            key="session-chat"
            entries={transcript}
            activeNodeId={railActiveId}
            onSelectNode={setFocusNodeId}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!sessionStarted ? (
          <motion.div
            key="standby"
            className="absolute z-30 -translate-x-1/2 translate-y-[-42%]"
            style={{
              left: `${ORB_CX * 100}%`,
              top: `${ORB_CY * 100}%`,
            }}
            initial={{ opacity: 1 }}
            exit={
              motionOff
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, filter: "blur(6px)", transition: { duration: 0.4 } }
            }
          >
            <RoomStandbyGate
              size={orbHit}
              onPlay={() => {
                void handleStart("click");
              }}
              snapStatus={snapStatus}
              snapLevel={snapLevel}
              snapFlash={snapFlash}
              onRetryMic={retrySnapMic}
              connecting={connectionStatus === "connecting"}
              error={sessionError}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {sessionStarted ? (
          <motion.div
            key="dock"
            className={cn(
              "absolute inset-x-0 bottom-0 z-40 pb-8 sm:pb-10",
              chatOpen ? "px-0" : "px-5"
            )}
            initial={motionOff ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ ...fade, delay: motionOff ? 0 : 0.28 }}
          >
            <AnimatePresence mode="wait">
              {chatOpen ? (
                <motion.div
                  key="chat-bar"
                  className={CHAT_STAGE_GRID}
                  initial={motionOff ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={fade}
                >
                  <div aria-hidden />
                  <div className={CHAT_STAGE_COLUMN}>
                    <div className={CHAT_STAGE_INNER}>
                      <RoomChatBar
                        variant="session"
                        autoFocus
                        micDisabled={chatBusy}
                        onSendText={handleSendText}
                        onClose={closeChat}
                      />
                    </div>
                  </div>
                  <div aria-hidden />
                </motion.div>
              ) : (
                <motion.div
                  key="voice-dock"
                  className="relative mx-auto flex w-full max-w-3xl items-end justify-center"
                  initial={motionOff ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                >
                    <motion.div
                      className="absolute bottom-0 left-0"
                      initial={motionOff ? false : { opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...fade, delay: motionOff ? 0 : 0.1 }}
                    >
                      <div
                        className="flex items-center rounded-full border border-white/10 p-1 shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
                        style={{ background: "rgba(12, 18, 40, 0.92)" }}
                      >
                        <button
                          type="button"
                          onClick={() => setChatOpen(true)}
                          className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
                        >
                          <MessageCircle className="size-4 stroke-[1.75]" />
                          Chat
                        </button>

                        <span className="mx-0.5 h-5 w-px bg-white/15" aria-hidden />

                        <button
                          type="button"
                          onClick={handleMic}
                          disabled={chatBusy}
                          className={cn(
                            "flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors",
                            "disabled:pointer-events-none disabled:opacity-45",
                            micActive
                              ? "border border-white/20 bg-white/14 text-[#f5d76e] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                              : "text-white hover:bg-white/5"
                          )}
                        >
                          <Mic className="size-4 stroke-[1.75]" />
                          {micActive ? "Voice On" : "Voice"}
                        </button>
                      </div>
                    </motion.div>

                    <RoomVoiceStatus state={state} micActive={micActive} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
