"use client";

import { motion, useReducedMotion } from "motion/react";

import { WORKFLOW_NODES_HOME, type WorkflowNodeId } from "./room-orb-layout";

export type EngineStepStatus = "done" | "active" | "upcoming";

type RoomEngineRingProps = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  coreR: number;
  step: number;
  links: { id: string; d: string }[];
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const sweep = endDeg - startDeg;
  const large = sweep > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export function stepStatus(index: number, step: number): EngineStepStatus {
  if (index < step) return "done";
  if (index === step) return "active";
  return "upcoming";
}

export function RoomEngineRing({ w, h, cx, cy, coreR, step, links }: RoomEngineRingProps) {
  const reduceMotion = useReducedMotion();
  const arcR = coreR * 1.22;
  const gap = 4;
  const seg = 360 / 8;
  const next = Math.min(7, step + 1);

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-5 size-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <filter id="engine-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="trail-active" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.15" />
          <stop offset="55%" stopColor="#67e8f9" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <g fill="none" filter="url(#engine-glow)">
        {WORKFLOW_NODES_HOME.map((node, i) => {
          const status = stepStatus(i, step);
          const start = i * seg + gap / 2;
          const end = (i + 1) * seg - gap / 2;
          const d = arcPath(cx, cy, arcR, start, end);
          const stroke =
            status === "done"
              ? "#fbbf24"
              : status === "active"
                ? node.accent === "gold"
                  ? "#fbbf24"
                  : "#67e8f9"
                : "rgba(125,211,252,0.22)";
          const width = status === "active" ? 4.2 : status === "done" ? 3.2 : 2;
          const opacity = status === "upcoming" ? 0.35 : status === "done" ? 0.75 : 1;

          return (
            <motion.path
              key={`arc-${node.id}`}
              d={d}
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeOpacity={opacity}
              initial={false}
              animate={
                reduceMotion || status !== "active"
                  ? { strokeOpacity: opacity }
                  : { strokeOpacity: [0.55, 1, 0.55] }
              }
              transition={
                status === "active" && !reduceMotion
                  ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.35 }
              }
            />
          );
        })}
      </g>

      <g fill="none" filter="url(#engine-glow)">
        {links.map((link, i) => {
          const status = stepStatus(i, step);
          const isNext = i === next && step < 7;
          const isTrail = status === "done" || status === "active" || isNext;

          if (!isTrail) {
            return (
              <path
                key={link.id}
                d={link.d}
                stroke="rgba(125,211,252,0.1)"
                strokeWidth={1.2}
                strokeLinecap="round"
              />
            );
          }

          if (status === "done") {
            return (
              <path
                key={link.id}
                d={link.d}
                stroke="#fbbf24"
                strokeWidth={1.8}
                strokeOpacity={0.45}
                strokeLinecap="round"
              />
            );
          }

          if (status === "active") {
            return (
              <g key={link.id}>
                <path
                  d={link.d}
                  stroke="url(#trail-active)"
                  strokeWidth={2.8}
                  strokeLinecap="round"
                  strokeOpacity={0.95}
                />
                {!reduceMotion ? (
                  <motion.path
                    d={link.d}
                    stroke="#e0f2fe"
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    strokeDasharray="6 14"
                    animate={{ strokeDashoffset: [0, -40] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                    strokeOpacity={0.7}
                  />
                ) : null}
              </g>
            );
          }

          return (
            <path
              key={link.id}
              d={link.d}
              stroke="#67e8f9"
              strokeWidth={1.5}
              strokeOpacity={0.28}
              strokeLinecap="round"
              strokeDasharray="4 8"
            />
          );
        })}
      </g>

      {WORKFLOW_NODES_HOME.map((node, i) => {
        const status = stepStatus(i, step);
        const mid = i * seg + seg / 2;
        const p = polar(cx, cy, arcR, mid);
        const fill =
          status === "done" ? "#fbbf24" : status === "active" ? "#67e8f9" : "rgba(125,211,252,0.35)";
        return (
          <circle
            key={`dot-${node.id}`}
            cx={p.x}
            cy={p.y}
            r={status === "active" ? 3.2 : 2.2}
            fill={fill}
            opacity={status === "upcoming" ? 0.4 : 0.9}
          />
        );
      })}
    </svg>
  );
}

export function engineStepFromState(
  state: "idle" | "listening" | "agent-speaking" | "processing",
  tick: number,
  focusId: WorkflowNodeId | null,
  freezeIdle = false
): number {
  if (focusId) {
    const idx = WORKFLOW_NODES_HOME.findIndex((n) => n.id === focusId);
    return idx >= 0 ? idx : 0;
  }
  if (state === "listening") return 0;
  if (state === "processing") return 1 + (tick % 4);
  if (state === "agent-speaking") return 5;
  if (freezeIdle) return -1;
  return tick % 8;
}
