"use client";

import { getReadinessTone } from "../data/mock-data";
import { cn } from "@/lib/utils";

type RoomSessionStatusProps = {
  mode: "live" | "replay";
  readiness: number;
  voiceState: "idle" | "listening" | "agent-speaking" | "processing";
  className?: string;
};

const voiceLabels = {
  idle: "Sẵn sàng",
  listening: "Đang lắng nghe",
  "agent-speaking": "Agent đang nói",
  processing: "Đang phân tích",
} as const;

export function RoomSessionStatus({
  mode,
  readiness,
  voiceState,
  className,
}: RoomSessionStatusProps) {
  const tone = getReadinessTone(readiness);

  return (
    <div className={cn("flex shrink-0 items-center gap-3", className)}>
      <p className="hidden text-right text-[10px] leading-tight text-white/40 lg:block">
        <span className="block font-medium text-white/70">{voiceLabels[voiceState]}</span>
      </p>

      {mode === "live" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ea580c]/40 bg-[#ea580c]/18 px-2.5 py-1 text-[11px] font-medium text-[#fdba74]">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ea580c] opacity-60" />
            <span className="relative size-1.5 rounded-full bg-[#ea580c]" />
          </span>
          Live
        </span>
      ) : (
        <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 text-[11px] font-medium text-white/65">
          Replay
        </span>
      )}

      <div
        className="flex min-w-[4.75rem] flex-col gap-1 sm:min-w-[5.75rem]"
        role="img"
        aria-label={`Decision readiness ${readiness}%`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] text-white/40">Ready</span>
          <span
            className="text-xs font-semibold tabular-nums leading-none"
            style={{ color: tone.color }}
          >
            {readiness}%
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500 ease-out")}
            style={{ width: `${readiness}%`, backgroundColor: tone.color }}
          />
        </div>
      </div>
    </div>
  );
}
