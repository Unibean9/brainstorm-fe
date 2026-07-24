"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { ROOM_GRAPH_PHASES } from "../data/room-graph-mock";
import { GRAPH_LUMINOUS } from "../data/room-graph-palette";
import type { RoomPhaseKey } from "../data/room-graph-types";

const PHASE_COLORS: Record<RoomPhaseKey, string> = {
  Framing: GRAPH_LUMINOUS.framing,
  Context: GRAPH_LUMINOUS.context,
  Explore: GRAPH_LUMINOUS.explore,
  Expand: GRAPH_LUMINOUS.expand,
  Challenge: GRAPH_LUMINOUS.challenge,
  Insight: GRAPH_LUMINOUS.insight,
  Decision: GRAPH_LUMINOUS.decision,
  Action: GRAPH_LUMINOUS.action,
};

type RoomPhaseStepperProps = {
  /** Mức tiến độ phiên — sáng tích lũy từ đầu đến đây */
  progressPhase: RoomPhaseKey;
  /** Chỉ để focus graph khi user muốn xem phase cũ; không đổi màu progress */
  onPhaseFocus?: (phase: RoomPhaseKey) => void;
  className?: string;
};

export function RoomPhaseStepper({
  progressPhase,
  onPhaseFocus,
  className,
}: RoomPhaseStepperProps) {
  const progressIndex = ROOM_GRAPH_PHASES.findIndex((p) => p.key === progressPhase);
  const leadingRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    leadingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [progressPhase]);

  return (
    <nav
      aria-label="Tiến trình phase brainstorm"
      className={cn("flex min-w-0 justify-center", className)}
    >
      <ol className="flex max-w-full justify-center gap-0.5 overflow-x-auto px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ROOM_GRAPH_PHASES.map((phase, index) => {
          const reached = index <= progressIndex;
          const leading = index === progressIndex;
          const passed = index < progressIndex;
          const color = PHASE_COLORS[phase.key];

          return (
            <li
              key={phase.key}
              ref={leading ? leadingRef : undefined}
              className="relative shrink-0"
            >
              {onPhaseFocus ? (
                <button
                  type="button"
                  onClick={() => onPhaseFocus(phase.key)}
                  disabled={!reached}
                  aria-current={leading ? "step" : undefined}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                    reached && "cursor-pointer",
                    !reached && "cursor-default",
                    leading && "shadow-[0_0_20px_-6px_var(--phase-glow)]",
                    reached && !leading && "hover:bg-white/[0.04]"
                  )}
                  style={
                    leading
                      ? ({
                          backgroundColor: `${color}1f`,
                          boxShadow: `inset 0 0 0 1px ${color}66, 0 0 18px -8px ${color}`,
                          "--phase-glow": color,
                        } as CSSProperties)
                      : passed
                        ? ({ backgroundColor: `${color}12` } as CSSProperties)
                        : undefined
                  }
                >
                  <PhaseChip
                    label={phase.label}
                    color={color}
                    reached={reached}
                    leading={leading}
                    passed={passed}
                  />
                </button>
              ) : (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2",
                    leading && "shadow-[0_0_20px_-6px_var(--phase-glow)]"
                  )}
                  style={
                    leading
                      ? ({
                          backgroundColor: `${color}1f`,
                          boxShadow: `inset 0 0 0 1px ${color}66, 0 0 18px -8px ${color}`,
                          "--phase-glow": color,
                        } as CSSProperties)
                      : passed
                        ? ({ backgroundColor: `${color}12` } as CSSProperties)
                        : undefined
                  }
                  aria-current={leading ? "step" : undefined}
                >
                  <PhaseChip
                    label={phase.label}
                    color={color}
                    reached={reached}
                    leading={leading}
                    passed={passed}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PhaseChip({
  label,
  color,
  reached,
  leading,
  passed,
}: {
  label: string;
  color: string;
  reached: boolean;
  leading: boolean;
  passed: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full transition-all",
          leading && "size-2 ring-2 ring-white/25",
          passed && "size-1.5"
        )}
        style={{
          backgroundColor: reached ? color : `${color}40`,
          boxShadow: leading ? `0 0 10px ${color}88` : undefined,
        }}
      />

      <span
        className={cn(
          "whitespace-nowrap text-[11px] leading-none transition-colors",
          leading && "font-semibold text-white",
          passed && "font-medium text-white/82",
          !reached && "text-white/32"
        )}
      >
        {label}
      </span>
    </>
  );
}
