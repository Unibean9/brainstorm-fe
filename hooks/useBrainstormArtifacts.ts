"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { HubWebglState } from "@/app/session/components/room-hub-webgl";
import {
  useCreateBrainstormLandingPageMutation,
  useCreateBrainstormPitchDeckMutation,
  useCreateBrainstormPrdMutation,
} from "@/hooks/queries/useBrainstormSessionQueries";
import { useStoredSessionArtifacts } from "@/hooks/useStoredSessionArtifacts";
import { checkArtifactExists } from "@/lib/brainstorm/check-artifact-exists";
import {
  readStoredSessionArtifacts,
  writeStoredSessionArtifacts,
  type StoredSessionArtifacts,
} from "@/lib/brainstorm/artifact-storage";
import { downloadArtifactsSequential } from "@/lib/brainstorm/download-artifact";
import { BrainstormApiError, parseAxiosApiError } from "@/lib/brainstorm/parse-api-error";
import type { BrainstormPhaseKey } from "@/types/brainstorm-stream";

const ERROR_COPY: Record<string, string> = {
  invalid_session_id: "Session không hợp lệ.",
  session_not_found: "Không tìm thấy session.",
  phase_not_complete: "Phiên chưa tới bước tổng kết (wrap-up).",
  prd_not_ready: "Chưa có nội dung để tạo — cần ít nhất một Thinking Trace.",
  room_busy: "Room đang bận việc khác — thử lại sau vài giây.",
  prd_malformed: "PRD sinh ra bị lỗi định dạng — thử lại.",
  prd_failed: "Không tạo được PRD. Thử lại.",
  brief_invalid: "Không tóm tắt được nội dung từ PRD — thử lại.",
  artifact_rejected: "Nội dung sinh ra không đạt kiểm tra chất lượng sau nhiều lần thử — thử lại.",
  deck_renderer_not_installed: "Server thiếu công cụ render — báo cho quản trị viên.",
  landing_page_failed: "Không tạo được landing page. Thử lại.",
  pitch_deck_failed: "Không tạo được pitch deck. Thử lại.",
  session_wrapped: "Phiên đã đóng — chỉ còn artifacts.",
  artifact_not_ready: "Chưa được tạo.",
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
  voiceState: HubWebglState;
  isTurnPending: boolean;
};

export function useBrainstormArtifacts({
  sessionId,
  sessionPhaseKey,
  voiceState,
  isTurnPending,
}: UseBrainstormArtifactsOptions) {
  const stored = useStoredSessionArtifacts(sessionId);
  const [prdError, setPrdError] = useState<string | null>(null);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [pitchError, setPitchError] = useState<string | null>(null);
  const [confirmForcePrd, setConfirmForcePrd] = useState(false);

  const prdMutation = useCreateBrainstormPrdMutation();
  const landingMutation = useCreateBrainstormLandingPageMutation();
  const pitchMutation = useCreateBrainstormPitchDeckMutation();

  const persist = useCallback(
    (next: StoredSessionArtifacts) => {
      if (!sessionId) return;
      writeStoredSessionArtifacts(sessionId, next);
    },
    [sessionId]
  );

  /**
   * localStorage chỉ đúng trong cùng trình duyệt đã tạo artifact — nếu giáo viên đổi máy,
   * xoá cache, hay mở tab ẩn danh, artifact có thể đã tồn tại thật trên server mà UI vẫn
   * hiện "chưa tạo". Đối chiếu ngầm bằng HEAD request (không tải nội dung) cho đúng 3 route
   * — chỉ khi thiếu cục bộ, và chỉ ghi đè khi biết chắc (không đụng vào khi kết quả null).
   */
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const base = `api/v1/brainstorm/sessions/${sessionId}`;

    void (async () => {
      const local = readStoredSessionArtifacts(sessionId);

      if (!local?.prdUrl) {
        const exists = await checkArtifactExists(`${base}/prd`);
        if (!cancelled && exists) {
          const latest = readStoredSessionArtifacts(sessionId);
          if (!latest?.prdUrl) {
            writeStoredSessionArtifacts(sessionId, {
              ...(latest ?? { isWrapped: false }),
              isWrapped: true,
              prdUrl: `${base}/prd`,
            });
          }
        }
      }

      if (!local?.landingPageUrl) {
        const exists = await checkArtifactExists(`${base}/landing-page`);
        if (!cancelled && exists) {
          const latest = readStoredSessionArtifacts(sessionId);
          if (!latest?.landingPageUrl) {
            writeStoredSessionArtifacts(sessionId, {
              ...(latest ?? { isWrapped: true }),
              isWrapped: true,
              landingPageUrl: `${base}/landing-page`,
            });
          }
        }
      }

      if (!local?.pitchDeckHtmlUrl) {
        // html/pdf/script luôn được sinh cùng lúc — chỉ cần xác nhận qua html.
        const exists = await checkArtifactExists(`${base}/pitch-deck/html`);
        if (!cancelled && exists) {
          const latest = readStoredSessionArtifacts(sessionId);
          if (!latest?.pitchDeckHtmlUrl) {
            writeStoredSessionArtifacts(sessionId, {
              ...(latest ?? { isWrapped: true }),
              isWrapped: true,
              pitchDeckHtmlUrl: `${base}/pitch-deck/html`,
              pitchDeckExportUrl: `${base}/pitch-deck/pdf`,
              speakerScriptUrl: `${base}/speaker-script`,
            });
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const isWrapped = stored?.isWrapped ?? false;
  const isBusy =
    isTurnPending ||
    voiceState === "processing" ||
    voiceState === "agent-speaking" ||
    prdMutation.isPending ||
    landingMutation.isPending ||
    pitchMutation.isPending;

  const isWrapUpPhase = sessionPhaseKey === "wrap-up";

  const canGeneratePrd = Boolean(sessionId) && !isWrapped && !isBusy;

  const canGenerateLanding =
    Boolean(sessionId) && isWrapped && !isBusy && Boolean(stored?.prdUrl);

  const canGeneratePitch =
    Boolean(sessionId) && isWrapped && !isBusy && Boolean(stored?.prdUrl);

  const runCreatePrd = useCallback(
    async (force: boolean) => {
      if (!sessionId || !canGeneratePrd) return;
      setPrdError(null);
      try {
        const data = await prdMutation.mutateAsync({ sessionId, force });
        persist({
          isWrapped: true,
          prdUrl: data.prdUrl,
          prdGeneratedAt: data.generatedAt,
          landingPageUrl: stored?.landingPageUrl,
          landingWarnings: stored?.landingWarnings,
          pitchDeckHtmlUrl: stored?.pitchDeckHtmlUrl,
          pitchDeckExportUrl: stored?.pitchDeckExportUrl,
          speakerScriptUrl: stored?.speakerScriptUrl,
          pitchWarnings: stored?.pitchWarnings,
        });
        void downloadArtifactsSequential([
          { path: data.prdUrl, filename: "brainstorm-prd.md" },
        ]);
      } catch (err) {
        setPrdError(formatArtifactError(err));
      } finally {
        setConfirmForcePrd(false);
      }
    },
    [canGeneratePrd, persist, prdMutation, sessionId, stored]
  );

  /** Gọi khi giáo viên bấm "Tạo PRD" — nếu chưa tới wrap-up thì mở hộp thoại xác nhận force. */
  const createPrd = useCallback(async () => {
    if (!isWrapUpPhase) {
      setConfirmForcePrd(true);
      return;
    }
    await runCreatePrd(false);
  }, [isWrapUpPhase, runCreatePrd]);

  const confirmCreatePrdEarly = useCallback(() => runCreatePrd(true), [runCreatePrd]);
  const cancelCreatePrdEarly = useCallback(() => setConfirmForcePrd(false), []);

  const createLandingPage = useCallback(async () => {
    if (!sessionId || !canGenerateLanding) return;
    setLandingError(null);
    try {
      const data = await landingMutation.mutateAsync(sessionId);
      persist({
        isWrapped: true,
        prdUrl: stored?.prdUrl,
        prdGeneratedAt: stored?.prdGeneratedAt,
        landingPageUrl: data.landingPageUrl,
        landingWarnings: data.warnings,
        pitchDeckHtmlUrl: stored?.pitchDeckHtmlUrl,
        pitchDeckExportUrl: stored?.pitchDeckExportUrl,
        speakerScriptUrl: stored?.speakerScriptUrl,
        pitchWarnings: stored?.pitchWarnings,
      });
      void downloadArtifactsSequential([
        { path: data.landingPageUrl, filename: "landing-page.html" },
      ]);
    } catch (err) {
      setLandingError(formatArtifactError(err));
    }
  }, [canGenerateLanding, landingMutation, persist, sessionId, stored]);

  const createPitchDeck = useCallback(async () => {
    if (!sessionId || !canGeneratePitch) return;
    setPitchError(null);
    try {
      const data = await pitchMutation.mutateAsync(sessionId);
      persist({
        isWrapped: true,
        prdUrl: stored?.prdUrl,
        prdGeneratedAt: stored?.prdGeneratedAt,
        landingPageUrl: stored?.landingPageUrl,
        landingWarnings: stored?.landingWarnings,
        pitchDeckHtmlUrl: data.htmlUrl,
        pitchDeckExportUrl: data.exportUrl,
        speakerScriptUrl: data.speakerScriptUrl,
        pitchWarnings: data.warnings,
      });
      void downloadArtifactsSequential([
        { path: data.htmlUrl, filename: "pitch-deck.html" },
        { path: data.exportUrl, filename: "pitch-deck.pdf" },
      ]);
    } catch (err) {
      setPitchError(formatArtifactError(err));
    }
  }, [canGeneratePitch, persist, pitchMutation, sessionId, stored]);

  const prdHint = useMemo(() => {
    if (isWrapped) return "Đã tạo PRD — phiên đã đóng";
    if (isBusy) return "Đang bận";
    if (!isWrapUpPhase) return "Chưa tới bước tổng kết — có thể tạo sớm (sẽ hỏi xác nhận)";
    return null;
  }, [isBusy, isWrapped, isWrapUpPhase]);

  return {
    isWrapped,
    isBusy,
    isWrapUpPhase,
    canGeneratePrd,
    canGenerateLanding,
    canGeneratePitch,
    prdUrl: stored?.prdUrl,
    prdGeneratedAt: stored?.prdGeneratedAt,
    landingPageUrl: stored?.landingPageUrl,
    landingWarnings: stored?.landingWarnings,
    pitchDeckHtmlUrl: stored?.pitchDeckHtmlUrl,
    pitchDeckExportUrl: stored?.pitchDeckExportUrl,
    speakerScriptUrl: stored?.speakerScriptUrl,
    pitchWarnings: stored?.pitchWarnings,
    prdError,
    landingError,
    pitchError,
    prdHint,
    confirmForcePrd,
    confirmCreatePrdEarly,
    cancelCreatePrdEarly,
    isPrdPending: prdMutation.isPending,
    isLandingPending: landingMutation.isPending,
    isPitchPending: pitchMutation.isPending,
    createPrd,
    createLandingPage,
    createPitchDeck,
  };
}
