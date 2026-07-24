"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import type { HubWebglState } from "./room-hub-webgl";

type RoomVoiceStatusProps = {
  state: HubWebglState;
  micActive: boolean;
};

function labelFor(state: HubWebglState, micActive: boolean) {
  if (micActive || state === "listening") return "LISTENING";
  if (state === "agent-speaking") return "SPEAKING";
  if (state === "processing") return "THINKING";
  return "READY";
}

/**
 * Center voice HUD — sonic lens with core + mirrored gold bars.
 * Lightweight: few DOM bars, no canvas.
 */
export function RoomVoiceStatus({ state, micActive }: RoomVoiceStatusProps) {
  const reduceMotion = useReducedMotion();
  const hot =
    micActive ||
    state === "listening" ||
    state === "agent-speaking" ||
    state === "processing";
  const label = labelFor(state, micActive);
  const speaking = state === "agent-speaking";
  const thinking = state === "processing";

  const half = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const t = i / 8;
        return 0.28 + Math.sin(t * Math.PI) * 0.72;
      }),
    []
  );

  const accent = speaking
    ? { from: "#67e8f9", to: "#22d3ee", glow: "rgba(34,211,238,0.55)" }
    : thinking
      ? { from: "#fdba74", to: "#f59e0b", glow: "rgba(245,158,11,0.5)" }
      : { from: "#fde047", to: "#fbbf24", glow: "rgba(251,191,36,0.55)" };

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative flex h-14 items-center justify-center gap-[3px] px-2">
        <motion.span
          className="pointer-events-none absolute inset-x-6 inset-y-1 rounded-full"
          style={{
            background: `radial-gradient(ellipse at center, ${accent.glow} 0%, transparent 70%)`,
          }}
          animate={
            reduceMotion
              ? { opacity: hot ? 0.55 : 0.25 }
              : { opacity: hot ? [0.35, 0.75, 0.35] : [0.2, 0.35, 0.2] }
          }
          transition={{ duration: hot ? 1.2 : 2.8, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />

        {/* B — small broadcast rings under sonic lens when SPEAKING */}
        {speaking && !reduceMotion
          ? [0, 1].map((i) => (
              <motion.span
                key={`broadcast-${i}`}
                className="pointer-events-none absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/50"
                initial={{ scale: 0.6, opacity: 0.55 }}
                animate={{ scale: [0.7, 2.4], opacity: [0.5, 0] }}
                transition={{
                  duration: 1.35,
                  repeat: Infinity,
                  ease: [0.16, 1, 0.3, 1],
                  delay: i * 0.55,
                }}
                aria-hidden
              />
            ))
          : null}

        {[...half].reverse().map((h, i) => (
          <VoiceBar
            key={`l-${i}`}
            h={h}
            index={i}
            hot={hot}
            active={!reduceMotion}
            accent={accent}
            side="left"
          />
        ))}

        <motion.span
          className="relative z-10 mx-1.5 grid size-3.5 place-items-center rounded-full sm:size-4"
          style={{
            background: `radial-gradient(circle at 35% 30%, #e0f2fe, ${accent.from} 45%, ${accent.to})`,
            boxShadow: `0 0 12px ${accent.glow}`,
          }}
          animate={
            reduceMotion
              ? undefined
              : speaking
                ? { scale: [1, 1.28, 1], opacity: [0.9, 1, 0.9] }
                : hot
                  ? { scale: [1, 1.18, 1], opacity: [0.9, 1, 0.9] }
                  : { scale: [1, 1.06, 1], opacity: [0.75, 0.95, 0.75] }
          }
          transition={{
            duration: speaking ? 0.75 : hot ? 0.9 : 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          aria-hidden
        >
          <span className="size-1 rounded-full bg-[#e0f2fe]" />
        </motion.span>

        {half.map((h, i) => (
          <VoiceBar
            key={`r-${i}`}
            h={h}
            index={i}
            hot={hot}
            active={!reduceMotion}
            accent={accent}
            side="right"
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <motion.p
          className={cn(
            "text-[11px] font-semibold tracking-[0.42em]",
            speaking ? "text-[#67e8f9]" : "text-[#fbbf24]"
          )}
          style={{ textShadow: `0 0 14px ${accent.glow}` }}
          animate={reduceMotion ? undefined : { opacity: [0.75, 1, 0.75] }}
          transition={{ duration: speaking ? 1.2 : 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {label}
        </motion.p>
        <span className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1 rounded-full bg-[#fbbf24]/90"
              animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.18,
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function VoiceBar({
  h,
  index,
  hot,
  active,
  accent,
  side,
}: {
  h: number;
  index: number;
  hot: boolean;
  active: boolean;
  accent: { from: string; to: string; glow: string };
  side: "left" | "right";
}) {
  const maxH = hot ? 8 + h * 26 : 6 + h * 10;
  const midH = hot ? 6 + h * 14 : 5 + h * 7;
  const minH = hot ? 4 + h * 6 : 4 + h * 4;

  return (
    <motion.span
      className={cn("w-[2px] rounded-full sm:w-[2.5px]")}
      style={{
        background: `linear-gradient(180deg, ${accent.from}, ${accent.to})`,
        boxShadow: hot ? `0 0 6px ${accent.glow}` : "none",
        opacity: hot ? 0.95 : 0.45,
      }}
      animate={active ? { height: [minH, maxH, midH, maxH * 0.85, minH] } : { height: minH }}
      transition={{
        duration: hot ? 0.42 + (index % 4) * 0.05 : 2.6,
        repeat: Infinity,
        ease: [0.37, 0, 0.63, 1],
        delay: (side === "left" ? 8 - index : index) * 0.035,
      }}
    />
  );
}
