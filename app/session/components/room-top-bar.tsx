"use client";

import { Network } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RoomPhaseKey, RoomSessionMeta } from "../data/room-graph-types";
import { roomHudBar } from "./room-immersive-surfaces";
import { RoomPhaseStepper } from "./room-phase-stepper";
import { RoomSessionStatus } from "./room-session-status";

type RoomTopBarProps = {
  meta: RoomSessionMeta;
  sessionPhase: RoomPhaseKey;
  voiceState: "idle" | "listening" | "agent-speaking" | "processing";
  onPhaseFocus: (phase: RoomPhaseKey) => void;
  onOpenGraph: () => void;
};

export function RoomTopBar({
  meta,
  sessionPhase,
  voiceState,
  onPhaseFocus,
  onOpenGraph,
}: RoomTopBarProps) {
  return (
    <header className={cn("relative z-20 shrink-0 px-4 py-3 lg:px-5", roomHudBar)}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 shrink-0 max-w-[9rem] sm:max-w-[11rem] lg:max-w-[13rem]">
          <h1 className="truncate font-heading text-base font-semibold tracking-tight text-white sm:text-lg">
            {meta.title}
          </h1>
          <p className="truncate text-[11px] text-white/45">{meta.topic}</p>
        </div>

        <RoomPhaseStepper
          progressPhase={sessionPhase}
          onPhaseFocus={onPhaseFocus}
          className="min-w-0 flex-1"
        />

        <RoomSessionStatus
          mode={meta.mode}
          readiness={meta.readiness}
          voiceState={voiceState}
          className="shrink-0"
        />

        <button
          type="button"
          onClick={onOpenGraph}
          aria-label="Xem knowledge graph"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-white/12 bg-white/8 text-white/75 transition-colors hover:bg-white/14 hover:text-white"
        >
          <Network className="size-4" />
        </button>
      </div>
    </header>
  );
}
