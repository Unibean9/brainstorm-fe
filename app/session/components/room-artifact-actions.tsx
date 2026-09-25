"use client";

import { useMemo } from "react";
import { Download, ExternalLink, Loader2, Lock } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { downloadArtifactFromUrl } from "@/lib/brainstorm/download-artifact";
import { resolveArtifactUrl } from "@/lib/brainstorm/resolve-artifact-url";
import type { ArtifactKey, BrainstormArtifactStatus } from "@/types/brainstorm-domain";

const CYAN_GLOW =
  "0 0 8px rgba(34,211,238,0.55), 0 0 22px rgba(34,211,238,0.35), 0 0 40px rgba(56,189,248,0.2)";

type RoomArtifactActionsProps = {
  isWrapped: boolean;
  canGeneratePrd: boolean;
  canGenerateLanding: boolean;
  canGeneratePitch: boolean;
  prdUrl?: string;
  landingPageUrl?: string;
  landingWarnings?: string[];
  pitchDeckHtmlUrl?: string;
  pitchWarnings?: string[];
  /** Why nothing can be generated right now (another output running, turn in flight). */
  blockedReason?: string | null;
  prdError?: string | null;
  landingError?: string | null;
  pitchError?: string | null;
  artifactStatuses?: BrainstormArtifactStatus[];
  isPrdPending?: boolean;
  isLandingPending?: boolean;
  isPitchPending?: boolean;
  onCreatePrd: () => void;
  onCreateLandingPage: () => void;
  onCreatePitchDeck: () => void;
};

type StepState = "locked" | "available" | "generating" | "failed" | "ready";

type Step = {
  key: ArtifactKey;
  code: string;
  name: string;
  state: StepState;
  url?: string;
  filename: string;
  /** HTML outputs open in a tab; the PRD is a markdown download only. */
  openable: boolean;
  warnings?: string[];
  error?: string | null;
  /** Previous step's short name, for the "CẦN …" lock label. */
  requires?: string;
  canCreate: boolean;
  onCreate: () => void;
};

function statusOf(statuses: BrainstormArtifactStatus[] | undefined, key: ArtifactKey) {
  return statuses?.find((item) => item.artifactKey === key)?.status;
}

function resolveState(
  ready: boolean,
  pending: boolean | undefined,
  serverStatus: BrainstormArtifactStatus["status"] | undefined,
  error: string | null | undefined,
  unlocked: boolean
): StepState {
  if (ready) return "ready";
  if (pending || serverStatus === "generating") return "generating";
  if (error || serverStatus === "failed") return "failed";
  return unlocked ? "available" : "locked";
}

function download(url?: string, filename?: string) {
  if (!url) return;
  void downloadArtifactFromUrl(url, filename).catch(() => undefined);
}

function openInTab(url?: string) {
  if (!url) return;
  window.open(resolveArtifactUrl(url), "_blank", "noopener,noreferrer");
}

function StatusDot({ on, alert }: { on?: boolean; alert?: boolean }) {
  return (
    <span
      className="size-1.5 rounded-full"
      style={
        alert
          ? {
              background: "#ea580c",
              boxShadow: "0 0 6px rgba(234,88,12,0.9), 0 0 12px rgba(234,88,12,0.45)",
            }
          : on
            ? {
                background: "#22d3ee",
                boxShadow: "0 0 6px rgba(34,211,238,0.95), 0 0 14px rgba(56,189,248,0.55)",
              }
            : { background: "rgba(255,255,255,0.22)" }
      }
      aria-hidden
    />
  );
}

/** Primary step action: a glowing pill, so "the next thing to do" reads at a glance. */
function CreateBtn({
  label,
  disabled,
  ariaLabel,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "pointer-events-auto inline-flex h-6 items-center rounded-full border border-[#22d3ee]/60 bg-[#22d3ee]/12 px-2.5",
        "text-[11px] font-semibold tracking-[0.12em] text-[#e0f2fe] transition-colors duration-150",
        "shadow-[0_0_12px_-3px_rgba(34,211,238,0.7)] hover:bg-[#22d3ee]/25",
        "outline-none focus-visible:ring-2 focus-visible:ring-[#67e8f9]/60",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:bg-[#22d3ee]/12"
      )}
    >
      {label}
    </button>
  );
}

/** Open / download on a finished output. */
function FileBtn({
  label,
  ariaLabel,
  icon,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "pointer-events-auto inline-flex h-6 items-center gap-1 rounded-full px-1.5",
        "text-[11px] font-semibold tracking-[0.12em] text-[#67e8f9] transition-colors duration-150",
        "hover:bg-[#22d3ee]/12 hover:text-[#a5f3fc]",
        "outline-none focus-visible:ring-2 focus-visible:ring-[#67e8f9]/60"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StateLabel({ step, isWrapped }: { step: Step; isWrapped: boolean }) {
  const { state } = step;
  if (state === "locked") {
    if (!isWrapped) return null;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.08em] text-white/45">
        <Lock className="size-2.5" aria-hidden />
        CẦN {step.requires}
      </span>
    );
  }
  if (state === "available") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.08em]",
        state === "ready"
          ? "text-[#a7f3d0]/85"
          : state === "failed"
            ? "text-[#fdba74]"
            : "text-[#a5f3fc]/85"
      )}
    >
      {state === "generating" ? <Loader2 className="size-2.5 animate-spin" aria-hidden /> : null}
      {state === "ready" ? "SẴN SÀNG" : state === "failed" ? "LỖI" : "ĐANG TẠO"}
    </span>
  );
}

function Col({ step, isWrapped }: { step: Step; isWrapped: boolean }) {
  const { state } = step;
  const hot = state === "ready" || state === "generating";
  return (
    <div className="flex min-w-[5rem] flex-col items-end gap-1.5">
      <p
        className={cn(
          "flex items-center gap-1 text-[1.35rem] font-semibold leading-none tracking-tight sm:text-[1.5rem]",
          hot
            ? "text-[#e0f2fe]"
            : state === "available" || state === "failed"
              ? "text-white/70"
              : "text-white/30"
        )}
        style={hot ? { textShadow: CYAN_GLOW } : undefined}
      >
        {step.code}
        {state === "ready" && step.warnings && step.warnings.length > 0 ? (
          <span
            className="pointer-events-auto size-1.5 shrink-0 rounded-full"
            style={{
              background: "#fbbf24",
              boxShadow: "0 0 5px rgba(251,191,36,0.9), 0 0 10px rgba(245,158,11,0.5)",
            }}
            title={step.warnings.join("\n")}
          />
        ) : null}
      </p>

      <span className="flex min-h-6 items-center justify-end gap-0.5">
        {state === "ready" ? (
          <>
            {step.openable ? (
              <FileBtn
                label="MỞ"
                ariaLabel={`Mở ${step.name} trong tab mới`}
                icon={<ExternalLink className="size-3" aria-hidden />}
                onClick={() => openInTab(step.url)}
              />
            ) : null}
            <FileBtn
              label="TẢI"
              ariaLabel={`Tải ${step.name}`}
              icon={<Download className="size-3" aria-hidden />}
              onClick={() => download(step.url, step.filename)}
            />
          </>
        ) : state === "available" || state === "failed" ? (
          <CreateBtn
            label={state === "failed" ? "THỬ LẠI" : "TẠO"}
            ariaLabel={`${state === "failed" ? "Tạo lại" : "Tạo"} ${step.name}`}
            disabled={!step.canCreate}
            onClick={step.onCreate}
          />
        ) : null}
      </span>

      <StateLabel step={step} isWrapped={isWrapped} />
    </div>
  );
}

export function RoomArtifactActions({
  isWrapped,
  canGeneratePrd,
  canGenerateLanding,
  canGeneratePitch,
  prdUrl,
  landingPageUrl,
  landingWarnings,
  pitchDeckHtmlUrl,
  pitchWarnings,
  blockedReason,
  prdError,
  landingError,
  pitchError,
  artifactStatuses,
  isPrdPending,
  isLandingPending,
  isPitchPending,
  onCreatePrd,
  onCreateLandingPage,
  onCreatePitchDeck,
}: RoomArtifactActionsProps) {
  const reduceMotion = useReducedMotion();

  const prdStatus = statusOf(artifactStatuses, "prd");
  const landingStatus = statusOf(artifactStatuses, "landing-page");
  const pitchStatus = statusOf(artifactStatuses, "pitch-deck");

  // Strict order, PRD → landing page → pitch deck: each step unlocks when the previous is ready.
  const prdState = resolveState(
    Boolean(prdUrl) || prdStatus === "ready",
    isPrdPending,
    prdStatus,
    prdError,
    isWrapped
  );
  const landingState = resolveState(
    Boolean(landingPageUrl) || landingStatus === "ready",
    isLandingPending,
    landingStatus,
    landingError,
    isWrapped && prdState === "ready"
  );
  const pitchState = resolveState(
    Boolean(pitchDeckHtmlUrl) || pitchStatus === "ready",
    isPitchPending,
    pitchStatus,
    pitchError,
    isWrapped && landingState === "ready"
  );

  const steps: Step[] = [
    {
      key: "prd",
      code: "PRD",
      name: "PRD",
      state: prdState,
      url: prdUrl,
      filename: "brainstorm-prd.md",
      openable: false,
      error: prdError,
      canCreate: canGeneratePrd,
      onCreate: onCreatePrd,
    },
    {
      key: "landing-page",
      code: "WEB",
      name: "landing page",
      state: landingState,
      url: landingPageUrl,
      filename: "landing-page.html",
      openable: true,
      warnings: landingWarnings,
      error: landingError,
      requires: "PRD",
      canCreate: canGenerateLanding,
      onCreate: onCreateLandingPage,
    },
    {
      key: "pitch-deck",
      code: "DCK",
      name: "pitch deck",
      state: pitchState,
      url: pitchDeckHtmlUrl,
      filename: "pitch-deck.html",
      openable: true,
      warnings: pitchWarnings,
      error: pitchError,
      requires: "WEB",
      canCreate: canGeneratePitch,
      onCreate: onCreatePitchDeck,
    },
  ];

  const deliverablePct = useMemo(() => {
    const done = [prdState, landingState, pitchState].filter((s) => s === "ready").length;
    return done === 3 ? 100 : done * 33;
  }, [landingState, pitchState, prdState]);

  // One line that always says what to do next — replaces the old truncated hint.
  const failed = steps.find((step) => step.state === "failed");
  const generating = steps.find((step) => step.state === "generating");
  const next = steps.find((step) => step.state === "available");
  const guide: { text: string; tone: "muted" | "alert" | "active" } = !isWrapped
    ? { text: "Output mở sau khi session kết thúc.", tone: "muted" }
    : generating
      ? { text: `Đang tạo ${generating.name}, có thể mất vài phút…`, tone: "active" }
      : failed
        ? {
            text: `${failed.error ?? `Chưa tạo được ${failed.name}.`} Bấm “Thử lại”.`,
            tone: "alert",
          }
        : next && !next.canCreate && blockedReason
          ? { text: blockedReason, tone: "muted" }
          : next
            ? {
                text:
                  next.key === "prd"
                    ? "Bước 1/3: tạo PRD trước, rồi tới landing page và pitch deck."
                    : `Bước ${steps.indexOf(next) + 1}/3: tạo ${next.name}.`,
                tone: "active",
              }
            : { text: "Đã tạo đủ 3 output.", tone: "muted" };

  return (
    <motion.aside
      className="pointer-events-none absolute right-4 top-4 z-30 w-[min(92vw,360px)] select-none text-right sm:right-6 sm:top-5"
      aria-label="Output của session"
      initial={reduceMotion ? false : { opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-2.5 flex items-center justify-end gap-2">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-[#67e8f9]/90">OUTPUTS</p>
        <span
          className={cn(
            "text-[9px] font-semibold tracking-[0.12em]",
            isWrapped ? "text-[#fde68a]/90" : "text-[#a7f3d0]/90"
          )}
        >
          {isWrapped ? "WRAPPED" : "IN PROGRESS"}
        </span>
      </div>
      <div className="relative mb-3 h-[3px] w-full overflow-visible">
        <div
          className="absolute inset-x-0 top-0 h-[3px] rounded-full"
          style={{
            background:
              "linear-gradient(270deg, #67e8f9 0%, #22d3ee 42%, rgba(34,211,238,0.12) 78%, transparent 100%)",
            boxShadow: "0 0 8px rgba(34,211,238,0.6), 0 0 20px rgba(34,211,238,0.35)",
          }}
        />
      </div>

      <div className="flex items-start justify-end gap-4 sm:gap-5">
        {steps.map((step) => (
          <Col key={step.key} step={step} isWrapped={isWrapped} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 text-[9px] font-semibold tracking-[0.14em] text-white/60">
        {steps.map((step) => (
          <span key={step.key} className="inline-flex items-center gap-1">
            <StatusDot on={step.state === "ready"} alert={step.state === "failed"} />
            {step.code}
          </span>
        ))}
      </div>

      <div className="relative mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 right-0 rounded-full transition-[width] duration-500"
          style={{
            width: `${deliverablePct}%`,
            background: "linear-gradient(270deg, #67e8f9, #22d3ee)",
            boxShadow: "0 0 8px rgba(34,211,238,0.65)",
          }}
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "mt-2 ml-auto max-w-[19rem] text-[11px] leading-snug",
          guide.tone === "alert"
            ? "text-[#fdba74]"
            : guide.tone === "active"
              ? "text-[#a5f3fc]/90"
              : "text-white/55"
        )}
      >
        {guide.text}
      </p>
    </motion.aside>
  );
}
