"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { downloadArtifactFromUrl } from "@/lib/brainstorm/download-artifact";
import type { BrainstormPitchDeckFormat } from "@/types/brainstorm-stream";

const PITCH_FORMATS: BrainstormPitchDeckFormat[] = ["pdf", "ppt", "pptx"];
const CYAN_GLOW =
  "0 0 8px rgba(34,211,238,0.55), 0 0 22px rgba(34,211,238,0.35), 0 0 40px rgba(56,189,248,0.2)";

type RoomArtifactActionsProps = {
  isWrapped: boolean;
  canGenerateReport: boolean;
  canGenerateLanding: boolean;
  canGeneratePitch: boolean;
  reportUrl?: string;
  landingPageUrl?: string;
  pitchDeckHtmlUrl?: string;
  pitchDeckExportUrl?: string;
  pitchDeckFormat?: string;
  reportHint?: string | null;
  reportError?: string | null;
  landingError?: string | null;
  pitchError?: string | null;
  isReportPending?: boolean;
  isLandingPending?: boolean;
  isPitchPending?: boolean;
  onCreateReport: () => void;
  onCreateLandingPage: () => void;
  onCreatePitchDeck: (format: BrainstormPitchDeckFormat) => void;
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
  children,
}: {
  code: string;
  hot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-end gap-1">
      <p
        className={cn(
          "text-[1.35rem] font-semibold leading-none tracking-tight sm:text-[1.5rem]",
          hot ? "text-[#e0f2fe]" : "text-white/30"
        )}
        style={hot ? { textShadow: CYAN_GLOW } : undefined}
      >
        {code}
      </p>
      {children}
    </div>
  );
}

export function RoomArtifactActions({
  isWrapped,
  canGenerateReport,
  canGenerateLanding,
  canGeneratePitch,
  reportUrl,
  landingPageUrl,
  pitchDeckHtmlUrl,
  pitchDeckExportUrl,
  pitchDeckFormat,
  reportHint,
  reportError,
  landingError,
  pitchError,
  isReportPending,
  isLandingPending,
  isPitchPending,
  onCreateReport,
  onCreateLandingPage,
  onCreatePitchDeck,
}: RoomArtifactActionsProps) {
  const reduceMotion = useReducedMotion();
  const [pitchFormat, setPitchFormat] = useState<BrainstormPitchDeckFormat>("pdf");

  const pitchReady = Boolean(pitchDeckHtmlUrl || pitchDeckExportUrl);
  const deliverablePct = useMemo(() => {
    let n = 0;
    if (reportUrl) n += 34;
    if (landingPageUrl) n += 33;
    if (pitchReady) n += 33;
    return Math.min(100, n);
  }, [landingPageUrl, pitchReady, reportUrl]);

  const blockHint =
    reportError || landingError || pitchError
      ? reportError || landingError || pitchError
      : !canGenerateReport && reportHint
        ? reportHint
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
        ) : null}
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
        <Col code="RPT" hot={Boolean(reportUrl) || isReportPending}>
          {reportUrl ? (
            <GlowBtn onClick={() => downloadArtifact(reportUrl, "brainstorm-report.md")}>MD</GlowBtn>
          ) : (
            <GlowBtn
              disabled={!canGenerateReport}
              pending={isReportPending}
              onClick={onCreateReport}
              title={reportHint ?? undefined}
            >
              GEN
            </GlowBtn>
          )}
        </Col>

        <Col code="WEB" hot={Boolean(landingPageUrl) || isLandingPending}>
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

        <Col code="DCK" hot={pitchReady || isPitchPending}>
          {pitchReady ? (
            <span className="pointer-events-auto flex gap-2">
              {pitchDeckHtmlUrl ? (
                <GlowBtn onClick={() => downloadArtifact(pitchDeckHtmlUrl, "pitch-deck.html")}>HTML</GlowBtn>
              ) : null}
              {pitchDeckExportUrl ? (
                <GlowBtn onClick={() => downloadArtifact(pitchDeckExportUrl, `pitch-deck.${(pitchDeckFormat ?? pitchFormat) === "pdf" ? "pdf" : "pptx"}`)} amber>
                  DL
                </GlowBtn>
              ) : null}
            </span>
          ) : (
            <span className="pointer-events-auto flex flex-col items-end gap-1">
              <span className="flex gap-1.5">
                {PITCH_FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={!canGeneratePitch || isPitchPending}
                    onClick={() => setPitchFormat(f)}
                    className={cn(
                      "text-[8px] font-semibold tracking-[0.12em]",
                      pitchFormat === f ? "text-[#fde68a]" : "text-white/30"
                    )}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </span>
              <GlowBtn
                disabled={!canGeneratePitch}
                pending={isPitchPending}
                onClick={() => onCreatePitchDeck(pitchFormat)}
                amber
              >
                GEN
              </GlowBtn>
            </span>
          )}
        </Col>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3 text-[9px] font-semibold tracking-[0.14em] text-white/60">
        <span className="inline-flex items-center gap-1">
          <StatusDot on={Boolean(reportUrl)} />
          RPT
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
    </motion.aside>
  );
}
