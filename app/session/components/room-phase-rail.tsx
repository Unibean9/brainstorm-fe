"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  Compass,
  FlagTriangleRight,
  GitMerge,
  ShieldAlert,
  Shuffle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { BrainstormPhaseKey } from "@/types/brainstorm-stream";

type RoomPhaseRailProps = {
  phaseKey: BrainstormPhaseKey;
};

const PHASES: ReadonlyArray<{
  key: BrainstormPhaseKey;
  label: string;
  blurb: string;
  icon: LucideIcon;
}> = [
  { key: "framing", label: "Làm rõ", blurb: "Hiểu vấn đề & mục tiêu", icon: Compass },
  { key: "diverging", label: "Mở rộng", blurb: "Nảy càng nhiều ý tưởng", icon: Sparkles },
  { key: "shifting", label: "Đối góc nhìn", blurb: "Soi vấn đề từ góc khác", icon: Shuffle },
  { key: "critiquing", label: "Thử thách", blurb: "Phản biện, dò lỗ hổng", icon: ShieldAlert },
  { key: "converging", label: "Hội tụ", blurb: "Thu hẹp về hướng tốt nhất", icon: GitMerge },
  { key: "wrap-up", label: "Chốt lại", blurb: "Tổng kết & hành động", icon: FlagTriangleRight },
];

const ROW = { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const };
const FILL = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

/**
 * Vertical 6-stage session progress — replaces the old per-turn engine node
 * list. Reflects sessionPhaseKey (BE), not the per-turn engine ring.
 */
export function RoomPhaseRail({ phaseKey }: RoomPhaseRailProps) {
  const reduceMotion = useReducedMotion();
  const currentIndex = Math.max(0, PHASES.findIndex((p) => p.key === phaseKey));

  return (
    <nav
      aria-label="Tiến trình phiên brainstorm"
      className="flex w-[13.5rem] shrink-0 flex-col sm:w-56"
    >
      {PHASES.map((phase, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const isLast = i === PHASES.length - 1;
        const Icon = phase.icon;

        return (
          <motion.div
            key={phase.key}
            initial={reduceMotion ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              ...(reduceMotion ? { duration: 0 } : ROW),
              delay: reduceMotion ? 0 : 0.12 + i * 0.05,
            }}
            className="relative flex gap-3 pb-6 last:pb-0"
          >
            {!isLast ? (
              <span
                aria-hidden
                className="absolute left-5 top-10 bottom-0 w-0.5 -translate-x-1/2 overflow-hidden rounded-full bg-white/10"
              >
                <motion.span
                  className="absolute inset-x-0 top-0 block w-full rounded-full bg-gradient-to-b from-[#fbbf24] to-[#fbbf24]/45"
                  initial={false}
                  animate={{ height: done ? "100%" : "0%" }}
                  transition={reduceMotion ? { duration: 0 } : FILL}
                />
              </span>
            ) : null}

            <span
              className={cn(
                "relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 transition-colors",
                done
                  ? "border-[#fbbf24]/75 bg-[#fbbf24]/20 text-[#fbbf24]"
                  : active
                    ? "border-[#fbbf24] bg-[#07111f] text-[#fbbf24] shadow-[0_0_16px_rgba(251,191,36,0.55)]"
                    : "border-white/14 bg-white/6 text-white/45"
              )}
            >
              {active ? (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute -inset-2 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 72%)",
                  }}
                  animate={
                    reduceMotion
                      ? { opacity: 0.8 }
                      : { opacity: [0.55, 0.95, 0.55], scale: [1, 1.15, 1] }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                  }
                />
              ) : null}
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.span
                    key="done"
                    initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Check className="size-[1.15rem] stroke-[2.25]" />
                  </motion.span>
                ) : (
                  <motion.span key="icon">
                    <Icon className="size-[1.15rem] stroke-[1.75]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            <span className="flex min-h-10 min-w-0 flex-1 flex-col justify-center px-0.5">
              <span
                className={cn(
                  "block truncate text-[15px] font-semibold tracking-wide",
                  active ? "text-white" : done ? "text-amber-200/90" : "text-white/50"
                )}
              >
                {phase.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-[11.5px] leading-snug",
                  active ? "text-white/60" : done ? "text-amber-100/45" : "text-white/32"
                )}
              >
                {phase.blurb}
              </span>
            </span>
          </motion.div>
        );
      })}
    </nav>
  );
}
