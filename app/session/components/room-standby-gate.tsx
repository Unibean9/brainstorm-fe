"use client";

import { motion, useReducedMotion } from "motion/react";
import { Play } from "lucide-react";

import type { SnapListenStatus } from "@/hooks/useSnapListen";
import { cn } from "@/lib/utils";

type RoomStandbyGateProps = {
  size: number;
  onPlay: () => void;
  snapStatus: SnapListenStatus;
  snapLevel: number;
  onRetryMic?: () => void;
  /** Brief flash when snap detected */
  snapFlash?: boolean;
  connecting?: boolean;
  error?: string | null;
};

/**
 * Sonic Gate — premium STANDBY play control.
 * Click Play or finger-snap (when mic listening) to arm the session.
 */
export function RoomStandbyGate({
  size,
  onPlay,
  snapStatus,
  snapLevel,
  onRetryMic,
  snapFlash = false,
  connecting = false,
  error = null,
}: RoomStandbyGateProps) {
  const reduceMotion = useReducedMotion();
  const ring = Math.max(96, size);
  const blocked = connecting;

  const hint = connecting
    ? "Đang tạo phiên…"
    : error
      ? error
      : snapStatus === "listening"
        ? "Bấm Play  ·  Búng tay"
        : snapStatus === "denied"
          ? "Bấm Play  ·  Mic chưa được phép"
          : snapStatus === "unsupported"
            ? "Bấm Play để bắt đầu"
            : "Bấm Play  ·  Đang mở mic…";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onPlay}
        disabled={blocked}
        aria-busy={connecting}
        aria-label={
          connecting
            ? "Đang tạo phiên brainstorm"
            : "Bắt đầu phiên — Play hoặc búng tay"
        }
        className={cn(
          "group relative grid place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60",
          blocked && "cursor-wait opacity-80"
        )}
        style={{ width: ring, height: ring }}
      >
        {/* Expanding sonic rings */}
        {!reduceMotion
          ? [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="pointer-events-none absolute inset-0 rounded-full border border-cyan-300/35"
                style={{
                  boxShadow: `0 0 24px rgba(34,211,238,${0.12 + snapLevel * 0.2})`,
                }}
                animate={{
                  scale: [1, 1.55 + i * 0.08],
                  opacity: [0.45 - i * 0.08, 0],
                }}
                transition={{
                  duration: 2.4 + i * 0.35,
                  repeat: Infinity,
                  ease: [0.16, 1, 0.3, 1],
                  delay: i * 0.55,
                }}
              />
            ))
          : null}

        {/* Snap flash burst */}
        <AnimateFlash active={snapFlash && !reduceMotion} />

        {/* Outer dual ring */}
        <motion.span
          className="pointer-events-none absolute inset-[5%] rounded-full"
          style={{
            background:
              "conic-gradient(from 200deg, #fbbf24, #22d3ee, #67e8f9, #f59e0b, #22d3ee, #fbbf24)",
            boxShadow: "0 0 28px rgba(34,211,238,0.35)",
          }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={
            reduceMotion ? undefined : { duration: 16, repeat: Infinity, ease: "linear" }
          }
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-[8%] rounded-full bg-[#07111f]"
          aria-hidden
        />

        {/* Core disc */}
        <motion.span
          className="relative z-10 grid place-items-center rounded-full"
          style={{
            width: "68%",
            height: "68%",
            background:
              "radial-gradient(circle at 40% 35%, rgba(56,189,248,0.35), rgba(7,17,31,0.92) 55%, rgba(4,14,28,0.98))",
            boxShadow: `
              0 0 0 1px rgba(125,211,252,0.35),
              0 0 40px rgba(34,211,238,0.35),
              0 0 80px rgba(14,165,233,0.2),
              inset 0 0 28px rgba(34,211,238,0.18)
            `,
          }}
          whileHover={reduceMotion ? undefined : { scale: 1.04 }}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          animate={
            reduceMotion
              ? undefined
              : {
                  boxShadow: [
                    "0 0 0 1px rgba(125,211,252,0.35), 0 0 36px rgba(34,211,238,0.3), 0 0 70px rgba(14,165,233,0.16), inset 0 0 28px rgba(34,211,238,0.16)",
                    "0 0 0 1px rgba(251,191,36,0.4), 0 0 48px rgba(34,211,238,0.45), 0 0 90px rgba(14,165,233,0.28), inset 0 0 32px rgba(34,211,238,0.28)",
                    "0 0 0 1px rgba(125,211,252,0.35), 0 0 36px rgba(34,211,238,0.3), 0 0 70px rgba(14,165,233,0.16), inset 0 0 28px rgba(34,211,238,0.16)",
                  ],
                }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Mic level ring */}
          <span
            className="pointer-events-none absolute inset-[-4px] rounded-full"
            style={{
              boxShadow: `0 0 0 2px rgba(103,232,249,${0.08 + snapLevel * 0.55})`,
              opacity: snapStatus === "listening" ? 1 : 0.35,
            }}
            aria-hidden
          />

          <motion.span
            className="relative ml-1 text-white drop-shadow-[0_0_18px_rgba(125,211,252,0.85)]"
            animate={
              reduceMotion
                ? undefined
                : { scale: [1, 1.06, 1], opacity: [0.88, 1, 0.88] }
            }
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <Play
              className="size-10 fill-current sm:size-12"
              strokeWidth={1.25}
              aria-hidden
            />
          </motion.span>
        </motion.span>
      </button>

      <div className="mt-5 flex flex-col items-center gap-2.5">
        <span className="text-[13px] font-semibold tracking-[0.42em] text-white/95 sm:text-sm">
          STANDBY
        </span>
        <span className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1 rounded-full bg-white/80"
              animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.35,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.2,
              }}
            />
          ))}
        </span>
        <p
          className={cn(
            "mt-1 max-w-[16rem] text-center text-[11px] tracking-wide sm:text-xs",
            error
              ? "text-amber-200/90"
              : connecting
                ? "text-cyan-100/85"
                : "text-cyan-100/70",
            snapStatus === "denied" && !error && !connecting && "text-amber-100/70"
          )}
        >
          {hint}
        </p>
        {snapStatus === "denied" && onRetryMic ? (
          <button
            type="button"
            onClick={onRetryMic}
            className="text-[11px] font-medium text-cyan-300/90 underline-offset-2 hover:underline"
          >
            Cho phép mic để búng tay
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AnimateFlash({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.span
      className="pointer-events-none absolute inset-[-8%] rounded-full bg-cyan-300/25"
      initial={{ scale: 0.7, opacity: 0.7 }}
      animate={{ scale: 2.1, opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden
    />
  );
}
