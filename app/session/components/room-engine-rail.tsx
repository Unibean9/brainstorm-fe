"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Eye,
  GitBranch,
  Lightbulb,
  Radar,
  Sparkles,
  Stethoscope,
  Wand2,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { WORKFLOW_NODES_HOME, type WorkflowNodeId } from "./room-orb-layout";

const ICONS: Record<WorkflowNodeId, typeof Eye> = {
  observer: Eye,
  analyzer: Radar,
  diagnosis: Stethoscope,
  "thinking-state": Activity,
  technique: Wand2,
  facilitate: Sparkles,
  trace: GitBranch,
  insight: Lightbulb,
};

type RoomEngineRailProps = {
  activeId?: WorkflowNodeId;
  onSelect?: (id: WorkflowNodeId) => void;
};

const STAGGER = { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const };

/**
 * 8 engine cards under time/weather — chat sits beside this rail.
 */
export function RoomEngineRail({ activeId, onSelect }: RoomEngineRailProps) {
  const reduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Engine nodes"
      className="mt-5 flex w-[13.5rem] shrink-0 flex-col gap-1.5 pt-2 sm:mt-7 sm:w-56"
    >
      {WORKFLOW_NODES_HOME.map((node, i) => {
        const Icon = ICONS[node.id];
        const active = activeId === node.id;
        return (
          <motion.button
            key={node.id}
            type="button"
            onClick={() => onSelect?.(node.id)}
            initial={reduceMotion ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              ...(reduceMotion ? { duration: 0 } : STAGGER),
              delay: reduceMotion ? 0 : 0.12 + i * 0.04,
            }}
            className={cn(
              "group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors",
              active
                ? "border border-white/14 bg-[#07111f]/92 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                : "border border-transparent text-white/70 hover:bg-white/6 hover:text-white/90"
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg border",
                active
                  ? "border-[#fbbf24]/55 bg-[#fbbf24]/18 text-[#fbbf24]"
                  : "border-white/10 bg-white/5 text-cyan-200/80 group-hover:border-white/20"
              )}
            >
              <Icon className="size-3.5 stroke-[1.75]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold tracking-wide">
                {node.label}
              </span>
              <span
                className={cn(
                  "block truncate text-[10px]",
                  active ? "text-white/55" : "text-white/40"
                )}
              >
                {node.blurb}
              </span>
            </span>
            {active ? (
              <span className="size-1.5 shrink-0 rounded-full bg-[#fbbf24] shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            ) : null}
          </motion.button>
        );
      })}
    </nav>
  );
}
