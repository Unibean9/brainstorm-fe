"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export type EngineCoreState = "idle" | "listening" | "agent-speaking" | "processing";

/** 8 workflow engines from ai-brainstorm-room-tool-concept.md §5 */
export const WORKFLOW_NODES = [
  { id: "observer", label: "Observer", accent: "coral" as const },
  { id: "analyzer", label: "Analyzer", accent: "cyan" as const },
  { id: "diagnosis", label: "Diagnosis", accent: "gold" as const },
  { id: "thinking-state", label: "Thinking State", accent: "cyan" as const },
  { id: "technique", label: "Technique", accent: "gold" as const },
  { id: "facilitate", label: "Facilitate", accent: "coral" as const },
  { id: "trace", label: "Trace", accent: "cyan" as const },
  { id: "insight", label: "Insight", accent: "gold" as const },
] as const;

const ACCENT = {
  coral: { ring: "#ea580c", glow: "rgba(234,88,12,0.55)", soft: "rgba(234,88,12,0.18)" },
  cyan: { ring: "#22d3ee", glow: "rgba(34,211,238,0.5)", soft: "rgba(34,211,238,0.16)" },
  gold: { ring: "#fbbf24", glow: "rgba(251,191,36,0.5)", soft: "rgba(251,191,36,0.16)" },
} as const;

type RoomOrchestrationStageProps = {
  state: EngineCoreState;
  className?: string;
  compact?: boolean;
  onHubClick?: () => void;
  hubLabel?: string;
};

function nodeAngle(index: number, count: number) {
  return -Math.PI / 2 + (index / count) * Math.PI * 2;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

function filamentPath(cx: number, cy: number, x: number, y: number, bend: number) {
  const mx = (cx + x) / 2;
  const my = (cy + y) / 2;
  const dx = x - cx;
  const dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * bend;
  const py = (dx / len) * bend;
  return `M ${cx} ${cy} Q ${mx + px} ${my + py} ${x} ${y}`;
}

function activeIndexForState(state: EngineCoreState, tick: number) {
  if (state === "listening") return 0;
  if (state === "agent-speaking") return 5;
  if (state === "processing") return 1 + (tick % 4);
  return tick % 8;
}

export function RoomOrchestrationStage({
  state,
  className,
  compact = false,
  onHubClick,
  hubLabel = "Orchestrator",
}: RoomOrchestrationStageProps) {
  const reduceMotion = useReducedMotion();
  const gradId = useId().replace(/:/g, "");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(
      () => setTick((t) => t + 1),
      state === "processing" ? 700 : 2200
    );
    return () => window.clearInterval(id);
  }, [reduceMotion, state]);

  const activeIndex = activeIndexForState(state, tick);

  const layout = useMemo(() => {
    const cx = 500;
    const cy = 420;
    const orbit = compact ? 210 : 280;
    const nodes = WORKFLOW_NODES.map((node, i) => {
      const angle = nodeAngle(i, WORKFLOW_NODES.length);
      const pos = polar(cx, cy, orbit, angle);
      const bend = (i % 2 === 0 ? 1 : -1) * (compact ? 48 : 72);
      return {
        ...node,
        ...pos,
        angle,
        path: filamentPath(cx, cy, pos.x, pos.y, bend),
      };
    });
    return { cx, cy, orbit, nodes };
  }, [compact]);

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      role="img"
      aria-label="Thinking Orchestration Engine — 8 luồng workflow quanh hub"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 55% 50% at 50% 48%, rgba(14,165,233,0.16), transparent 62%),
            radial-gradient(ellipse 40% 36% at 50% 48%, rgba(234,88,12,0.12), transparent 55%),
            radial-gradient(ellipse 90% 70% at 50% 100%, rgba(2,6,23,0.9), transparent 50%),
            linear-gradient(180deg, #060a14 0%, #0b1528 48%, #070b16 100%)
          `,
        }}
        aria-hidden
      />

      <svg
        viewBox="0 0 1000 840"
        className="absolute inset-0 size-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <radialGradient id={`${gradId}-hub`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#0ea5e9" stopOpacity="0.75" />
            <stop offset="70%" stopColor="#0369a1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </radialGradient>
          <filter id={`${gradId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {WORKFLOW_NODES.map((n) => (
            <linearGradient
              key={n.id}
              id={`${gradId}-line-${n.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={ACCENT[n.accent].ring} stopOpacity="0.85" />
              <stop offset="100%" stopColor={ACCENT[n.accent].ring} stopOpacity="0.15" />
            </linearGradient>
          ))}
        </defs>

        <ellipse
          cx={layout.cx}
          cy={layout.cy}
          rx={layout.orbit * 0.92}
          ry={layout.orbit * 0.88}
          fill="none"
          stroke="rgba(34,211,238,0.12)"
          strokeWidth="1"
        />
        <ellipse
          cx={layout.cx}
          cy={layout.cy}
          rx={layout.orbit * 1.08}
          ry={layout.orbit * 1.02}
          fill="none"
          stroke="rgba(234,88,12,0.14)"
          strokeWidth="1.2"
        />

        {layout.nodes.map((node, i) => {
          const active = i === activeIndex;
          return (
            <path
              key={`line-${node.id}`}
              d={node.path}
              fill="none"
              stroke={`url(#${gradId}-line-${node.id})`}
              strokeWidth={active ? 2.6 : 1.4}
              strokeOpacity={active ? 1 : 0.45}
              filter={active && !reduceMotion ? `url(#${gradId}-glow)` : undefined}
            />
          );
        })}

        <circle
          cx={layout.cx}
          cy={layout.cy}
          r={compact ? 54 : 72}
          fill={`url(#${gradId}-hub)`}
          filter={`url(#${gradId}-glow)`}
        />
        <circle cx={layout.cx} cy={layout.cy} r={compact ? 28 : 36} fill="#e0f2fe" opacity="0.9" />
        <circle
          cx={layout.cx}
          cy={layout.cy}
          r={compact ? 64 : 86}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeOpacity="0.55"
        />
        <circle
          cx={layout.cx}
          cy={layout.cy}
          r={compact ? 76 : 102}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="1"
          strokeOpacity="0.28"
        />

        {!reduceMotion &&
          layout.nodes.map((node, i) => {
            if (i !== activeIndex) return null;
            return (
              <circle key={`pulse-${node.id}`} r="4" fill={ACCENT[node.accent].ring}>
                <animateMotion dur="2.4s" repeatCount="indefinite" path={node.path} />
              </circle>
            );
          })}
      </svg>

      {layout.nodes.map((node, i) => {
        const active = i === activeIndex;
        const tone = ACCENT[node.accent];
        return (
          <div
            key={node.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(node.x / 1000) * 100}%`, top: `${(node.y / 840) * 100}%` }}
          >
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full border transition-[box-shadow,transform] duration-500 sm:size-10",
                  active ? "scale-110" : "scale-100"
                )}
                style={{
                  borderColor: tone.ring,
                  background: tone.soft,
                  boxShadow: active
                    ? `0 0 28px ${tone.glow}, inset 0 0 12px ${tone.soft}`
                    : `0 0 12px ${tone.soft}`,
                }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: tone.ring, boxShadow: `0 0 10px ${tone.glow}` }}
                />
              </span>
              <span
                className={cn(
                  "max-w-[7.5rem] text-center text-[11px] font-medium tracking-wide sm:text-xs",
                  active ? "text-white" : "text-white/55"
                )}
              >
                {node.label}
              </span>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onHubClick}
        aria-label={hubLabel}
        className="absolute top-1/2 left-1/2 z-10 flex w-[min(42vw,11rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full bg-transparent pt-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 sm:w-44"
      >
        <motion.span
          className="font-heading text-sm font-semibold tracking-tight text-white/90 sm:text-base"
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: [0.75, 1, 0.75],
                  scale: state === "listening" ? [1, 1.04, 1] : 1,
                }
          }
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {hubLabel}
        </motion.span>
        <span className="text-[10px] text-cyan-100/45 sm:text-[11px]">Thinking Engine</span>
      </button>
    </div>
  );
}
