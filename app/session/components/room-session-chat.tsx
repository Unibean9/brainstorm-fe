"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "../data/room-graph-types";
import { RoomEngineRail } from "./room-engine-rail";
import type { WorkflowNodeId } from "./room-orb-layout";
import { RoomTranscript } from "./room-transcript";

type RoomSessionChatProps = {
  entries: TranscriptEntry[];
  activeNodeId?: WorkflowNodeId;
  onSelectNode?: (id: WorkflowNodeId) => void;
};

const PANEL = { duration: 0.72, ease: [0.16, 1, 0.3, 1] as const };

/** Grid stage — rail · chat · orb spacer (dock + overlay dùng chung) */
export const CHAT_STAGE_GRID =
  "grid w-full grid-cols-[13.5rem_minmax(0,1fr)_minmax(10rem,34%)] gap-3 px-4 sm:grid-cols-[14rem_minmax(0,1fr)_minmax(12rem,36%)] sm:gap-4 sm:px-5";

export const CHAT_STAGE_COLUMN =
  "min-w-0 px-2 sm:px-4";

export const CHAT_STAGE_INNER = "mx-auto w-full max-w-lg sm:max-w-xl lg:max-w-2xl";

/**
 * Chat stage: rail trái · khung chat căn giữa · chừa orb phải.
 * Input nằm ở dock dưới (RoomChatBar).
 */
export function RoomSessionChat({
  entries,
  activeNodeId,
  onSelectNode,
}: RoomSessionChatProps) {
  const reduceMotion = useReducedMotion();
  const t = reduceMotion ? { duration: 0 } : PANEL;

  return (
    <motion.div
      className={cn(
        "pointer-events-auto absolute inset-0 z-30 pt-40 pb-28 sm:pt-44",
        CHAT_STAGE_GRID
      )}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.28 } }}
      transition={{ ...t, delay: reduceMotion ? 0 : 0.08 }}
    >
      <div className="no-scrollbar min-h-0 overflow-y-auto">
        <RoomEngineRail activeId={activeNodeId} onSelect={onSelectNode} />
      </div>

      <motion.div
        className={cn("flex min-h-0 justify-center", CHAT_STAGE_COLUMN)}
        initial={reduceMotion ? false : { opacity: 0, y: 18, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ ...t, delay: reduceMotion ? 0 : 0.2 }}
      >
        <div className={cn("flex min-h-0 flex-col", CHAT_STAGE_INNER)}>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            <p className="mb-4 text-center text-xs font-semibold tracking-[0.22em] text-cyan-100/55">
              FACILITATOR
            </p>
            <RoomTranscript entries={entries} />
          </div>
        </div>
      </motion.div>

      <div aria-hidden className="pointer-events-none" />
    </motion.div>
  );
}
