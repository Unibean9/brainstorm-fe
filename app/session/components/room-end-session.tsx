"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type RoomEndSessionProps = {
  /** The agent judged the conversation complete (completion.suggested or the wrap-up phase). */
  suggested: boolean;
  canComplete: boolean;
  isCompleting: boolean;
  error?: string | null;
  onComplete: () => void;
};

/**
 * Teacher-owned end of the conversation, docked next to the chat input or under the voice
 * wave. Always reachable but quiet; it only asks for attention once the agent suggests wrapping.
 * Ending is irreversible (no more turns), so the first click only arms the button.
 */
export function RoomEndSession({
  suggested,
  canComplete,
  isCompleting,
  error,
  onComplete,
}: RoomEndSessionProps) {
  const reduceMotion = useReducedMotion();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  const label = isCompleting
    ? "Đang kết thúc…"
    : !canComplete
      ? "Đợi lượt hiện tại xong"
      : confirming
        ? "Bấm lần nữa để kết thúc"
        : "Kết thúc session";

  const note = error
    ? error
    : confirming
      ? "Sau khi kết thúc sẽ không chat tiếp được, chỉ tạo PRD, landing page, pitch deck."
      : suggested
        ? "AI gợi ý: đã đủ để chốt."
        : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          if (!confirming) return setConfirming(true);
          setConfirming(false);
          onComplete();
        }}
        disabled={!canComplete || isCompleting}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border text-xs font-semibold",
          "outline-none transition-[color,background-color,border-color,box-shadow] duration-150",
          "focus-visible:ring-2 focus-visible:ring-[#fbbf24]/60",
          "disabled:cursor-not-allowed disabled:opacity-45",
          suggested || confirming ? "min-h-9 px-4" : "min-h-8 px-3",
          confirming
            ? "border-[#fbbf24] bg-[#fbbf24]/20 text-[#fef3c7]"
            : suggested
              ? "border-[#fbbf24]/70 bg-[#fbbf24]/12 text-[#fde68a] shadow-[0_0_18px_-4px_rgba(251,191,36,0.55)] hover:bg-[#fbbf24]/20"
              : "border-white/12 bg-[rgba(12,18,40,0.92)] text-white/60 hover:border-[#fbbf24]/45 hover:text-[#fde68a]"
        )}
      >
        {isCompleting ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-3.5" aria-hidden />
        )}
        {label}
      </button>
      <AnimatePresence initial={false}>
        {note ? (
          <motion.p
            key={note}
            role={error ? "alert" : "status"}
            initial={reduceMotion ? false : { opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            className={cn(
              "max-w-[22rem] text-center text-[11px] leading-snug",
              error ? "text-[#fdba74]" : "text-white/60"
            )}
          >
            {note}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
