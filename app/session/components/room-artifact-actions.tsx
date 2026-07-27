"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { downloadArtifactFromUrl } from "@/lib/brainstorm/download-artifact";

const CYAN_GLOW =
  "0 0 8px rgba(34,211,238,0.55), 0 0 22px rgba(34,211,238,0.35), 0 0 40px rgba(56,189,248,0.2)";

type RoomArtifactActionsProps = {
  isWrapped: boolean;
  isWrapUpPhase: boolean;
  canGeneratePrd: boolean;
  canGenerateLanding: boolean;
  canGeneratePitch: boolean;
  prdUrl?: string;
  landingPageUrl?: string;
  landingWarnings?: string[];
  pitchDeckHtmlUrl?: string;
  pitchDeckExportUrl?: string;
  speakerScriptUrl?: string;
  pitchWarnings?: string[];
  prdHint?: string | null;
  prdError?: string | null;
  landingError?: string | null;
  pitchError?: string | null;
  isPrdPending?: boolean;
  isLandingPending?: boolean;
  isPitchPending?: boolean;
  confirmForcePrd: boolean;
  onCreatePrd: () => void;
  onConfirmForcePrd: () => void;
  onCancelForcePrd: () => void;
  onCreateLandingPage: () => void;
  onCreatePitchDeck: () => void;
};

function downloadArtifact(path?: string, filename?: string) {
  if (!path) return;
  void downloadArtifactFromUrl(path, filename).catch(() => undefined);
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

function GlowBtn({
  children,
  disabled,
  pending,
  onClick,
  amber,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  pending?: boolean;
  onClick?: () => void;
  amber?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || pending}
      onClick={onClick}
      className={cn(
        "pointer-events-auto inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.16em] transition-opacity",
        "disabled:cursor-not-allowed disabled:opacity-30",
        amber ? "text-[#fde68a] hover:text-[#fef3c7]" : "text-[#67e8f9]/90 hover:text-[#a5f3fc]"
      )}
    >
      {pending ? <Loader2 className="size-2.5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

function Col({
  code,
  hot,
  warnings,
  children,
}: {
  code: string;
  hot?: boolean;
  warnings?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-end gap-1">
      <p
        className={cn(
          "flex items-center gap-1 text-[1.35rem] font-semibold leading-none tracking-tight sm:text-[1.5rem]",
          hot ? "text-[#e0f2fe]" : "text-white/30"
        )}
        style={hot ? { textShadow: CYAN_GLOW } : undefined}
      >
        {code}
        {warnings && warnings.length > 0 ? (
          <span
            className="pointer-events-auto size-1.5 shrink-0 rounded-full"
            style={{
              background: "#fbbf24",
              boxShadow: "0 0 5px rgba(251,191,36,0.9), 0 0 10px rgba(245,158,11,0.5)",
            }}
            title={warnings.join("\n")}
          />
        ) : null}
      </p>
      {children}
    </div>
  );
}

export function RoomArtifactActions({
  isWrapped,
  isWrapUpPhase,
  canGeneratePrd,
  canGenerateLanding,
  canGeneratePitch,
  prdUrl,
  landingPageUrl,
  landingWarnings,
  pitchDeckHtmlUrl,
  pitchDeckExportUrl,
  speakerScriptUrl,
  pitchWarnings,
  prdHint,
  prdError,
  landingError,
  pitchError,
  isPrdPending,
  isLandingPending,
  isPitchPending,
  confirmForcePrd,
  onCreatePrd,
  onConfirmForcePrd,
  onCancelForcePrd,
  onCreateLandingPage,
  onCreatePitchDeck,
}: RoomArtifactActionsProps) {
  const reduceMotion = useReducedMotion();

  const pitchReady = Boolean(pitchDeckHtmlUrl || pitchDeckExportUrl);
  const deliverablePct = useMemo(() => {
    let n = 0;
    if (prdUrl) n += 34;
    if (landingPageUrl) n += 33;
    if (pitchReady) n += 33;
    return Math.min(100, n);
  }, [landingPageUrl, pitchReady, prdUrl]);

  const blockHint =
    prdError || landingError || pitchError
      ? prdError || landingError || pitchError
      : !canGeneratePrd && prdHint
        ? prdHint
        : null;

  return (
    <motion.aside
      className="pointer-events-none absolute right-4 top-4 z-30 w-[min(92vw,360px)] select-none text-right sm:right-6 sm:top-5"
      aria-label="Artifacts"
      initial={reduceMotion ? false : { opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mb-2.5 flex items-center justify-end gap-2">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-[#67e8f9]/90">OUTPUTS</p>
        {isWrapped ? (
          <span className="text-[9px] font-semibold tracking-[0.12em] text-[#fde68a]/90">WRAPPED</span>
        ) : (
          <span
            className={cn(
              "text-[9px] font-semibold tracking-[0.12em]",
              isWrapUpPhase ? "text-[#a7f3d0]/90" : "text-white/35"
            )}
          >
            {isWrapUpPhase ? "WRAP-UP" : "IN PROGRESS"}
          </span>
        )}
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

      <div className="flex items-start justify-end gap-5 sm:gap-6">
        <Col code="PRD" hot={Boolean(prdUrl) || isPrdPending}>
          {prdUrl ? (
            <GlowBtn onClick={() => downloadArtifact(prdUrl, "brainstorm-prd.md")}>MD</GlowBtn>
          ) : (
            <GlowBtn
              disabled={!canGeneratePrd}
              pending={isPrdPending}
              onClick={onCreatePrd}
              title={prdHint ?? undefined}
            >
              GEN
            </GlowBtn>
          )}
        </Col>

        <Col code="WEB" hot={Boolean(landingPageUrl) || isLandingPending} warnings={landingWarnings}>
          {landingPageUrl ? (
            <GlowBtn onClick={() => downloadArtifact(landingPageUrl, "landing-page.html")} amber>
              DL
            </GlowBtn>
          ) : (
            <GlowBtn
              disabled={!canGenerateLanding}
              pending={isLandingPending}
              onClick={onCreateLandingPage}
              amber
            >
              GEN
            </GlowBtn>
          )}
        </Col>

        <Col code="DCK" hot={pitchReady || isPitchPending} warnings={pitchWarnings}>
          {pitchReady ? (
            <span className="pointer-events-auto flex flex-wrap justify-end gap-2">
              {pitchDeckHtmlUrl ? (
                <GlowBtn onClick={() => downloadArtifact(pitchDeckHtmlUrl, "pitch-deck.html")}>HTML</GlowBtn>
              ) : null}
              {pitchDeckExportUrl ? (
                <GlowBtn onClick={() => downloadArtifact(pitchDeckExportUrl, "pitch-deck.pdf")} amber>
                  PDF
                </GlowBtn>
              ) : null}
              {speakerScriptUrl ? (
                <GlowBtn onClick={() => downloadArtifact(speakerScriptUrl, "speaker-script.md")}>
                  SCRIPT
                </GlowBtn>
              ) : null}
            </span>
          ) : (
            <GlowBtn
              disabled={!canGeneratePitch}
              pending={isPitchPending}
              onClick={onCreatePitchDeck}
              amber
            >
              GEN
            </GlowBtn>
          )}
        </Col>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 text-[9px] font-semibold tracking-[0.14em] text-white/60">
        <span className="inline-flex items-center gap-1">
          <StatusDot on={Boolean(prdUrl)} />
          PRD
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusDot on={Boolean(landingPageUrl)} />
          WEB
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusDot on={pitchReady} alert={isWrapped && !pitchReady} />
          DCK
        </span>
      </div>

      <div className="relative mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 right-0 rounded-full"
          style={{
            width: `${deliverablePct}%`,
            background: "linear-gradient(270deg, #67e8f9, #22d3ee)",
            boxShadow: "0 0 8px rgba(34,211,238,0.65)",
          }}
        />
      </div>

      {blockHint ? (
        <p className="pointer-events-none mt-2 max-w-full truncate text-[9px] text-white/45" title={blockHint}>
          {blockHint}
        </p>
      ) : null}

      <AnimatePresence>
        {confirmForcePrd ? (
          <motion.div
            className="pointer-events-auto mt-3 rounded-lg border border-amber-300/25 bg-[rgba(12,18,40,0.96)] p-3 text-left shadow-[0_8px_28px_rgba(0,0,0,0.4)]"
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-[11px] leading-snug text-amber-100/90">
              Phiên chưa tới bước tổng kết — PRD tạo lúc này có thể sơ sài. Vẫn muốn tạo?
            </p>
            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancelForcePrd}
                className="text-[10px] font-semibold tracking-[0.1em] text-white/50 hover:text-white/80"
              >
                HUỶ
              </button>
              <button
                type="button"
                onClick={onConfirmForcePrd}
                className="text-[10px] font-semibold tracking-[0.1em] text-[#fde68a] hover:text-[#fef3c7]"
              >
                VẪN TẠO
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.aside>
  );
}
