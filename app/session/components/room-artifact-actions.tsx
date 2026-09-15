"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { downloadArtifactFromUrl } from "@/lib/brainstorm/download-artifact";
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
  pitchDeckExportUrl?: string;
  speakerScriptUrl?: string;
  pitchWarnings?: string[];
  prdHint?: string | null;
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
  status,
  children,
}: {
  code: string;
  hot?: boolean;
  warnings?: string[];
  status?: BrainstormArtifactStatus["status"];
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
      {status ? (
        <span
          className={cn(
            "text-[9px] font-medium tracking-[0.08em]",
            status === "ready"
              ? "text-[#a7f3d0]/80"
              : status === "failed"
                ? "text-[#fdba74]/90"
                : "text-[#a5f3fc]/80"
          )}
        >
          {status === "ready" ? "SẴN SÀNG" : status === "failed" ? "THỬ LẠI" : "ĐANG TẠO"}
        </span>
      ) : null}
    </div>
  );
}

function getStatus(statuses: BrainstormArtifactStatus[] | undefined, key: ArtifactKey) {
  return statuses?.find((item) => item.artifactKey === key);
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
  pitchDeckExportUrl,
  speakerScriptUrl,
  pitchWarnings,
  prdHint,
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

  const pitchReady = Boolean(pitchDeckHtmlUrl || pitchDeckExportUrl);
  const prdStatus = getStatus(artifactStatuses, "prd");
  const landingStatus = getStatus(artifactStatuses, "landing-page");
  const pitchStatus = getStatus(artifactStatuses, "pitch-deck");
  const prdReady = Boolean(prdUrl) || prdStatus?.status === "ready";
  const landingReady = Boolean(landingPageUrl) || landingStatus?.status === "ready";
  const pitchIsReady = pitchReady || pitchStatus?.status === "ready";
  const deliverablePct = useMemo(() => {
    let n = 0;
    if (prdReady) n += 34;
    if (landingReady) n += 33;
    if (pitchIsReady) n += 33;
    return Math.min(100, n);
  }, [landingReady, pitchIsReady, prdReady]);

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

      <div className="flex items-start justify-end gap-5 sm:gap-6">
        <Col code="PRD" hot={prdReady || isPrdPending} status={prdStatus?.status}>
          {prdUrl ? (
            <GlowBtn onClick={() => downloadArtifact(prdUrl, "brainstorm-prd.md")}>MD</GlowBtn>
          ) : prdStatus?.status === "ready" ? (
            <GlowBtn disabled title="PRD đã sẵn sàng trên server">
              READY
            </GlowBtn>
          ) : (
            <GlowBtn
              disabled={!canGeneratePrd || prdStatus?.status === "generating"}
              pending={isPrdPending || prdStatus?.status === "generating"}
              onClick={onCreatePrd}
              title={prdHint ?? undefined}
            >
              {prdStatus?.status === "failed" ? "RETRY" : "GEN"}
            </GlowBtn>
          )}
        </Col>

        <Col
          code="WEB"
          hot={landingReady || isLandingPending}
          warnings={landingWarnings}
          status={landingStatus?.status}
        >
          {landingPageUrl ? (
            <GlowBtn onClick={() => downloadArtifact(landingPageUrl, "landing-page.html")} amber>
              DL
            </GlowBtn>
          ) : landingStatus?.status === "ready" ? (
            <GlowBtn disabled amber title="Landing page đã sẵn sàng trên server">
              READY
            </GlowBtn>
          ) : (
            <GlowBtn
              disabled={!canGenerateLanding || landingStatus?.status === "generating"}
              pending={isLandingPending || landingStatus?.status === "generating"}
              onClick={onCreateLandingPage}
              amber
            >
              {landingStatus?.status === "failed" ? "RETRY" : "GEN"}
            </GlowBtn>
          )}
        </Col>

        <Col
          code="DCK"
          hot={pitchIsReady || isPitchPending}
          warnings={pitchWarnings}
          status={pitchStatus?.status}
        >
          {pitchReady ? (
            <span className="pointer-events-auto flex flex-wrap justify-end gap-2">
              {pitchDeckHtmlUrl ? (
                <GlowBtn onClick={() => downloadArtifact(pitchDeckHtmlUrl, "pitch-deck.html")}>
                  HTML
                </GlowBtn>
              ) : null}
              {pitchDeckExportUrl ? (
                <GlowBtn
                  onClick={() => downloadArtifact(pitchDeckExportUrl, "pitch-deck.pdf")}
                  amber
                >
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
              disabled={!canGeneratePitch || pitchStatus?.status === "generating"}
              pending={isPitchPending || pitchStatus?.status === "generating"}
              onClick={onCreatePitchDeck}
              amber
            >
              {pitchStatus?.status === "ready"
                ? "READY"
                : pitchStatus?.status === "failed"
                  ? "RETRY"
                  : "GEN"}
            </GlowBtn>
          )}
        </Col>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 text-[9px] font-semibold tracking-[0.14em] text-white/60">
        <span className="inline-flex items-center gap-1">
          <StatusDot on={prdReady} alert={prdStatus?.status === "failed"} />
          PRD
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusDot on={landingReady} alert={landingStatus?.status === "failed"} />
          WEB
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusDot on={pitchIsReady} alert={pitchStatus?.status === "failed"} />
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
        <p
          className="pointer-events-none mt-2 max-w-full truncate text-[9px] text-white/45"
          title={blockHint}
        >
          {blockHint}
        </p>
      ) : null}
    </motion.aside>
  );
}
