"use client";

import { useEffect, useRef } from "react";
import { Copy, MoreHorizontal, ThumbsDown, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TranscriptEntry } from "../data/room-graph-types";

type RoomTranscriptProps = {
  entries: TranscriptEntry[];
  activeTimestampMs?: number;
};

const FEEDBACK_ICONS = [Copy, ThumbsUp, ThumbsDown, MoreHorizontal];

function renderAgentText(entry: TranscriptEntry) {
  const segment = entry.audioSegments?.find(
    (candidate) => candidate.segmentId === entry.activeAudioSegmentId
  );
  if (
    !segment ||
    !segment.textSnapshot ||
    segment.textStart < 0 ||
    segment.textEnd <= segment.textStart ||
    segment.textEnd > entry.text.length ||
    entry.text.slice(segment.textStart, segment.textEnd) !== segment.textSnapshot
  ) {
    return entry.text;
  }

  return (
    <>
      {entry.text.slice(0, segment.textStart)}
      <mark aria-current="true" className="rounded-[0.2em] bg-[#22d3ee]/18 text-cyan-50">
        {entry.text.slice(segment.textStart, segment.textEnd)}
      </mark>
      {entry.text.slice(segment.textEnd)}
    </>
  );
}

export function RoomTranscript({ entries, activeTimestampMs = 0 }: RoomTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isReplay = activeTimestampMs > 0;

  useEffect(() => {
    if (isReplay) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, isReplay]);

  const firstLiveIndex = entries.findIndex((e) => e.id.startsWith("live-"));

  return (
    <div>
      <ul className="flex flex-col gap-5">
        {entries.map((entry, index) => {
          const isAgent = entry.speaker === "agent";
          const isActive =
            activeTimestampMs >= entry.timestampMs &&
            (entries[index + 1]?.timestampMs ?? Infinity) > activeTimestampMs;

          return (
            <li key={entry.id} className="flex flex-col gap-5">
              {index === firstLiveIndex ? (
                <p className="text-center text-xs text-white/35">Hôm nay {entry.time}</p>
              ) : null}

              {isAgent ? (
                <div className="flex flex-col gap-1.5">
                  <p
                    className={cn(
                      "text-pretty text-[15px] font-semibold leading-relaxed text-white",
                      isActive && "text-white"
                    )}
                  >
                    {renderAgentText(entry)}
                  </p>
                  <div className="flex items-center gap-1 text-white/35">
                    {FEEDBACK_ICONS.map((Icon, i) => (
                      <button
                        key={i}
                        type="button"
                        className="grid size-6 place-items-center rounded-md transition-colors hover:bg-white/8 hover:text-white/70"
                      >
                        <Icon className="size-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl bg-white/12 px-3.5 py-2 text-[15px] font-semibold text-pretty whitespace-pre-wrap text-white transition-colors",
                      isActive && "ring-1 ring-[#ea580c]/50"
                    )}
                  >
                    {entry.text}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}
