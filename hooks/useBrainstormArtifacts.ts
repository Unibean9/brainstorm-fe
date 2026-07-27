"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { TranscriptEntry } from "@/app/session/data/room-graph-types";
import type { HubWebglState } from "@/app/session/components/room-hub-webgl";
import {
  useCreateBrainstormLandingPageMutation,
  useCreateBrainstormPitchDeckMutation,
  useCreateBrainstormReportMutation,
} from "@/hooks/queries/useBrainstormSessionQueries";
import {
  readStoredSessionArtifacts,
  writeStoredSessionArtifacts,
  type StoredSessionArtifacts,
} from "@/lib/brainstorm/artifact-storage";
import { downloadArtifactsSequential } from "@/lib/brainstorm/download-artifact";
import { BrainstormApiError, parseAxiosApiError } from "@/lib/brainstorm/parse-api-error";
import { isSessionReadyForReport } from "@/lib/brainstorm/session-readiness";
import type { BrainstormPitchDeckFormat, BrainstormPhaseKey } from "@/types/brainstorm-stream";

const ERROR_COPY: Record<string, string> = {
  report_not_ready: "Chưa hoàn tất phiên brainstorm.",
  room_busy: "Room đang bận — thử lại sau vài giây.",
  report_failed: "Không tạo được report. Thử lại.",
  pitch_deck_failed: "Không tạo được pitch deck. Thử lại.",
  invalid_format: "Định dạng export không hợp lệ.",
  session_wrapped: "Phiên đã đóng — chỉ còn artifacts.",
};

function formatArtifactError(err: unknown) {
  if (err instanceof BrainstormApiError) {
    if (err.code && ERROR_COPY[err.code]) return ERROR_COPY[err.code]!;
    return err.message;
  }
  return parseAxiosApiError(err).message;
}

type UseBrainstormArtifactsOptions = {
  sessionId: string | null;
  sessionPhaseKey: BrainstormPhaseKey | null;
  transcript: TranscriptEntry[];
  voiceState: HubWebglState;
  isTurnPending: boolean;
};

export function useBrainstormArtifacts({
  sessionId,
  sessionPhaseKey,
  transcript,
  voiceState,
  isTurnPending,
}: UseBrainstormArtifactsOptions) {
  const [stored, setStored] = useState<StoredSessionArtifacts | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [pitchError, setPitchError] = useState<string | null>(null);

  const reportMutation = useCreateBrainstormReportMutation();
  const landingMutation = useCreateBrainstormLandingPageMutation();
  const pitchMutation = useCreateBrainstormPitchDeckMutation();

  useEffect(() => {
    if (!sessionId) {
      setStored(null);
      return;
    }
    setStored(readStoredSessionArtifacts(sessionId));
  }, [sessionId]);

  const persist = useCallback(
    (next: StoredSessionArtifacts) => {
      if (!sessionId) return;
      writeStoredSessionArtifacts(sessionId, next);
      setStored(next);
    },
    [sessionId]
  );

  const isWrapped = stored?.isWrapped ?? false;
  const isBusy =
    isTurnPending ||
    voiceState === "processing" ||
    voiceState === "agent-speaking" ||
    reportMutation.isPending ||
    landingMutation.isPending ||
    pitchMutation.isPending;

  const sessionReadyForReport = isSessionReadyForReport(sessionPhaseKey, transcript);

  const canGenerateReport =
    Boolean(sessionId) &&
    !isWrapped &&
    !isBusy &&
    sessionReadyForReport;

  const canGenerateLanding =
    Boolean(sessionId) && isWrapped && !isBusy && Boolean(stored?.reportUrl);

  const canGeneratePitch =
    Boolean(sessionId) && isWrapped && !isBusy && Boolean(stored?.reportUrl);

  const createReport = useCallback(async () => {
    if (!sessionId || !canGenerateReport) return;
    setReportError(null);
    try {
      const data = await reportMutation.mutateAsync(sessionId);
      persist({
        isWrapped: true,
        reportUrl: data.reportUrl,
        reportGeneratedAt: data.generatedAt,
        landingPageUrl: stored?.landingPageUrl,
        pitchDeckHtmlUrl: stored?.pitchDeckHtmlUrl,
        pitchDeckExportUrl: stored?.pitchDeckExportUrl,
        pitchDeckFormat: stored?.pitchDeckFormat,
      });
      void downloadArtifactsSequential([
        { path: data.reportUrl, filename: "brainstorm-report.md" },
      ]);
    } catch (err) {
      setReportError(formatArtifactError(err));
    }
  }, [canGenerateReport, persist, reportMutation, sessionId, stored]);

  const createLandingPage = useCallback(async () => {
    if (!sessionId || !canGenerateLanding) return;
    setLandingError(null);
    try {
      const data = await landingMutation.mutateAsync(sessionId);
      persist({
        isWrapped: true,
        reportUrl: stored?.reportUrl,
        reportGeneratedAt: stored?.reportGeneratedAt,
        landingPageUrl: data.landingPageUrl,
        pitchDeckHtmlUrl: stored?.pitchDeckHtmlUrl,
        pitchDeckExportUrl: stored?.pitchDeckExportUrl,
        pitchDeckFormat: stored?.pitchDeckFormat,
      });
      void downloadArtifactsSequential([
        { path: data.landingPageUrl, filename: "landing-page.html" },
      ]);
    } catch (err) {
      setLandingError(formatArtifactError(err));
    }
  }, [canGenerateLanding, landingMutation, persist, sessionId, stored]);

  const createPitchDeck = useCallback(
    async (format: BrainstormPitchDeckFormat) => {
      if (!sessionId || !canGeneratePitch) return;
      setPitchError(null);
      try {
        const data = await pitchMutation.mutateAsync({ sessionId, format });
        persist({
          isWrapped: true,
          reportUrl: stored?.reportUrl,
          reportGeneratedAt: stored?.reportGeneratedAt,
          landingPageUrl: stored?.landingPageUrl,
          pitchDeckHtmlUrl: data.htmlUrl,
          pitchDeckExportUrl: data.exportUrl,
          pitchDeckFormat: format,
        });
        const exportExt = format === "ppt" || format === "pptx" ? "pptx" : "pdf";
        void downloadArtifactsSequential([
          { path: data.htmlUrl, filename: "pitch-deck.html" },
          { path: data.exportUrl, filename: `pitch-deck.${exportExt}` },
        ]);
      } catch (err) {
        setPitchError(formatArtifactError(err));
      }
    },
    [canGeneratePitch, persist, pitchMutation, sessionId, stored]
  );

  const reportHint = useMemo(() => {
    if (isWrapped) return "Đã wrap";
    if (isBusy) return "Đang bận";
    if (!sessionReadyForReport) return "Hoàn tất phiên trước khi export";
    return null;
  }, [isBusy, isWrapped, sessionReadyForReport]);

  return {
    isWrapped,
    isBusy,
    canGenerateReport,
    canGenerateLanding,
    canGeneratePitch,
    reportUrl: stored?.reportUrl,
    reportGeneratedAt: stored?.reportGeneratedAt,
    landingPageUrl: stored?.landingPageUrl,
    pitchDeckHtmlUrl: stored?.pitchDeckHtmlUrl,
    pitchDeckExportUrl: stored?.pitchDeckExportUrl,
    pitchDeckFormat: stored?.pitchDeckFormat,
    reportError,
    landingError,
    pitchError,
    reportHint,
    isReportPending: reportMutation.isPending,
    isLandingPending: landingMutation.isPending,
    isPitchPending: pitchMutation.isPending,
    createReport,
    createLandingPage,
    createPitchDeck,
  };
}
