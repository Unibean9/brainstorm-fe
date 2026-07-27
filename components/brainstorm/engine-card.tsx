"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type ExtendedStyle = CSSProperties & { viewTransitionName?: string };

type EngineCardTone = "cyan" | "gold";

const TONE_GLOW: Record<EngineCardTone, string> = {
  cyan: "0 0 0 1px rgba(103,232,249,0.22), 0 18px 40px -18px rgba(34,211,238,0.35)",
  gold: "0 0 0 1px rgba(251,191,36,0.22), 0 18px 40px -18px rgba(251,191,36,0.3)",
};

const TONE_GLOW_HOVER: Record<EngineCardTone, string> = {
  cyan: "0 0 0 1px rgba(103,232,249,0.5), 0 22px 48px -16px rgba(34,211,238,0.55), 0 0 32px rgba(34,211,238,0.25)",
  gold: "0 0 0 1px rgba(251,191,36,0.5), 0 22px 48px -16px rgba(251,191,36,0.5), 0 0 32px rgba(251,191,36,0.22)",
};

type EngineCardProps = {
  tone?: EngineCardTone;
  interactive?: boolean;
  viewTransitionName?: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  as?: "div" | "button";
};

export function EngineCard({
  tone = "cyan",
  interactive = false,
  viewTransitionName,
  className,
  children,
  onClick,
  as = "div",
}: EngineCardProps) {
  const reduceMotion = useReducedMotion();

  const style: ExtendedStyle = {
    background: "linear-gradient(165deg, rgba(14,25,48,0.92), rgba(7,17,31,0.96))",
    boxShadow: TONE_GLOW[tone],
    ...(viewTransitionName ? { viewTransitionName } : {}),
  };

  const sharedProps = {
    className: cn(
      "group relative rounded-lg p-5 text-left backdrop-blur-sm",
      interactive && "cursor-pointer outline-none",
      className
    ),
    style,
    initial: false as const,
    animate: { y: 0, scale: 1, boxShadow: TONE_GLOW[tone] },
    whileHover: interactive ? { y: -5, scale: 1.015, boxShadow: TONE_GLOW_HOVER[tone] } : undefined,
    whileFocus: interactive ? { y: -5, scale: 1.015, boxShadow: TONE_GLOW_HOVER[tone] } : undefined,
    whileTap: interactive ? { scale: 0.99, y: -2 } : undefined,
    transition: reduceMotion
      ? { duration: 0 }
      : { type: "spring" as const, stiffness: 320, damping: 24, mass: 0.7 },
  };

  const content = (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{
          background:
            tone === "gold"
              ? "linear-gradient(90deg, transparent, rgba(251,191,36,0.55), transparent)"
              : "linear-gradient(90deg, transparent, rgba(103,232,249,0.55), transparent)",
        }}
      />
      {interactive ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg opacity-0 ring-2 ring-[#67e8f9]/60 transition-opacity duration-150 group-focus-visible:opacity-100"
        />
      ) : null}
      {children}
    </>
  );

  if (as === "button") {
    return (
      <motion.button type="button" onClick={onClick} {...sharedProps}>
        {content}
      </motion.button>
    );
  }

  return <motion.div {...sharedProps}>{content}</motion.div>;
}
