"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { HubWebglState } from "@/app/session/components/room-hub-webgl";
import {
  useCreateBrainstormLandingPageMutation,
  useCreateBrainstormPitchDeckMutation,
  useCreateBrainstormPrdMutation,
} from "@/hooks/queries/useBrainstormSessionQueries";
import { useStoredSessionArtifacts } from "@/hooks/useStoredSessionArtifacts";
import { brainstormSessionApi } from "@/lib/api/services/brainstormSession";
import { brainstormKeys } from "@/lib/brainstorm/brainstorm-query-keys";
import {
  writeStoredSessionArtifacts,
  type StoredSessionArtifacts,
} from "@/lib/brainstorm/artifact-storage";
import { downloadArtifactsSequential } from "@/lib/brainstorm/download-artifact";
import { BrainstormApiError, parseAxiosApiError } from "@/lib/brainstorm/parse-api-error";
import type { ArtifactKey, BrainstormArtifactStatus } from "@/types/brainstorm-domain";
import type { BrainstormSessionSnapshot } from "@/types/brainstorm-stream";

const ARTIFACT_KEYS: ArtifactKey[] = ["prd", "landing-page", "pitch-deck"];
const ARTIFACT_RECOVERY_POLL_MS = 3_000;
const ARTIFACT_RECOVERY_WINDOW_MS = 15 * 60_000;

const ERROR_COPY: Record<string, string> = {
  invalid_session_id: "Session không hợp lệ.",
  session_not_found: "Không tìm thấy session.",
  prd_not_ready: "Chưa đủ nội dung để tạo output — hãy hoàn tất lượt đang chạy trước.",
  room_busy: "Room đang bận việc khác — thử lại sau vài giây.",
  prd_malformed: "PRD sinh ra bị lỗi định dạng — thử lại.",
  prd_failed: "Không tạo được PRD. Thử lại.",
  invalid_brief: "Brief chưa đúng định dạng — thử tạo lại session với brief ngắn hơn.",
  artifact_rejected: "Nội dung sinh ra không đạt kiểm tra chất lượng — thử lại.",
  deck_renderer_not_installed: "Server thiếu công cụ render — báo cho quản trị viên.",
  landing_page_failed: "Không tạo được landing page. Thử lại.",
  pitch_deck_failed: "Không tạo được pitch deck. Thử lại.",
  session_closed: "Phiên đã đóng — vẫn có thể tạo output còn thiếu.",
  artifact_not_ready: "Output chưa sẵn sàng.",
};

const TIMEOUT_STILL_PENDING_COPY =
  "Kết nối bị ngắt trước khi nhận được kết quả, nhưng server có thể vẫn đang xử lý — thử lại sau ít phút.";

function canonicalArtifactUrls(sessionId: string, artifactKey: ArtifactKey) {
  const base = `/api/v1/brainstorm/sessions/${sessionId}`;
  if (artifactKey === "prd") return { prdUrl: `${base}/prd` };
  if (artifactKey === "landing-page") return { landingPageUrl: `${base}/landing-page` };
  return {
    pitchDeckHtmlUrl: `${base}/pitch-deck/html`,
    pitchDeckExportUrl: `${base}/pitch-deck/pdf`,
  };
}

async function waitForArtifactState(
  sessionId: string,
  artifactKey: ArtifactKey
): Promise<BrainstormArtifactStatus | null> {
  const deadline = Date.now() + ARTIFACT_RECOVERY_WINDOW_MS;
  while (Date.now() < deadline) {
    try {
      const snapshot = await brainstormSessionApi.get(sessionId);
      const status = snapshot.artifacts?.find((item) => item.artifactKey === artifactKey);
      if (status?.status === "ready" || status?.status === "failed") return status;
    } catch {
      // Keep waiting when the status probe itself is temporarily unavailable.
    }
    await new Promise<void>((resolve) => setTimeout(resolve, ARTIFACT_RECOVERY_POLL_MS));
  }
  return null;
}

function formatArtifactError(err: unknown) {
  if (err instanceof BrainstormApiError) {
    if (err.code && ERROR_COPY[err.code]) return ERROR_COPY[err.code]!;
    return err.message;
  }
  return parseAxiosApiError(err).message;
}

function shouldReconcileArtifactError(err: unknown) {
  const parsed = err instanceof BrainstormApiError ? err : parseAxiosApiError(err);
  return Boolean(parsed.isTimeout || parsed.isNetworkError || parsed.code === "room_busy");
}

function metadataUrl(status: BrainstormArtifactStatus | undefined, keys: string[]) {
  const metadata = status?.outputMetadata;
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

type UseBrainstormArtifactsOptions = {
  sessionId: string | null;
  sessionStatus?: string | null;
  snapshotArtifacts?: BrainstormArtifactStatus[];
  voiceState: HubWebglState;
  isTurnPending: boolean;
};

export function useBrainstormArtifacts({
  sessionId,
  sessionStatus,
  snapshotArtifacts,
  voiceState,
  isTurnPending,
}: UseBrainstormArtifactsOptions) {
  const stored = useStoredSessionArtifacts(sessionId);
  const [prdError, setPrdError] = useState<string | null>(null);
  const [landingError, setLandingError] = useState<string | null>(null);
  const [pitchError, setPitchError] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<
    Partial<Record<ArtifactKey, BrainstormArtifactStatus>>
  >({});

  const prdMutation = useCreateBrainstormPrdMutation();
  const landingMutation = useCreateBrainstormLandingPageMutation();
  const pitchMutation = useCreateBrainstormPitchDeckMutation();

  const artifactStatusQuery = useQuery<BrainstormSessionSnapshot>({
    queryKey: brainstormKeys.artifactStatuses(sessionId ?? "pending"),
    queryFn: () => brainstormSessionApi.get(sessionId!),
    enabled: Boolean(sessionId),
    staleTime: 2_000,
    refetchInterval: (query) => {
      const statuses = query.state.data?.artifacts ?? snapshotArtifacts ?? [];
      const hasGenerating = statuses.some((status) => status.status === "generating");
      const mutationPending =
        prdMutation.isPending || landingMutation.isPending || pitchMutation.isPending;
      return hasGenerating || mutationPending ? 3_000 : false;
    },
  });

  // Session lifecycle comes from the server snapshot/list. Local artifact
  // storage can restore URLs, but it must not authorize a new lifecycle state.
  const isWrapped = sessionStatus === "wrapped";
  const serverStatus = useMemo(() => {
    const result: Partial<Record<ArtifactKey, BrainstormArtifactStatus>> = {};
    const statuses = artifactStatusQuery.data?.artifacts ?? snapshotArtifacts ?? [];
    for (const status of statuses) result[status.artifactKey] = status;
    return result;
  }, [artifactStatusQuery.data?.artifacts, snapshotArtifacts]);

  const urls = useMemo(() => {
    const prdStatus = serverStatus.prd;
    const landingStatus = serverStatus["landing-page"];
    const pitchStatus = serverStatus["pitch-deck"];
    const canonicalPrdUrl = sessionId ? canonicalArtifactUrls(sessionId, "prd").prdUrl : undefined;
    const canonicalLandingUrl = sessionId
      ? canonicalArtifactUrls(sessionId, "landing-page").landingPageUrl
      : undefined;
    const canonicalPitchUrls = sessionId
      ? canonicalArtifactUrls(sessionId, "pitch-deck")
      : undefined;
    return {
      prdUrl:
        stored?.prdUrl ?? metadataUrl(prdStatus, ["prdUrl", "url"]) ??
        (prdStatus?.status === "ready" ? canonicalPrdUrl : undefined),
      landingPageUrl:
        stored?.landingPageUrl ?? metadataUrl(landingStatus, ["landingPageUrl", "url"]) ??
        (landingStatus?.status === "ready" ? canonicalLandingUrl : undefined),
      pitchDeckHtmlUrl:
        stored?.pitchDeckHtmlUrl ??
        metadataUrl(pitchStatus, ["htmlUrl", "pitchDeckHtmlUrl", "url"]) ??
        (pitchStatus?.status === "ready" ? canonicalPitchUrls?.pitchDeckHtmlUrl : undefined),
      pitchDeckExportUrl:
        stored?.pitchDeckExportUrl ??
        metadataUrl(pitchStatus, ["exportUrl", "pitchDeckExportUrl"]) ??
        (pitchStatus?.status === "ready" ? canonicalPitchUrls?.pitchDeckExportUrl : undefined),
      speakerScriptUrl:
        stored?.speakerScriptUrl ?? metadataUrl(pitchStatus, ["speakerScriptUrl", "scriptUrl"]),
    };
  }, [serverStatus, sessionId, stored]);

  const persist = useCallback(
    (next: Partial<StoredSessionArtifacts>) => {
      if (!sessionId) return;
      writeStoredSessionArtifacts(sessionId, {
        ...(stored ?? {}),
        isWrapped,
        ...next,
      });
    },
    [isWrapped, sessionId, stored]
  );

  const isBusy =
    isTurnPending ||
    voiceState === "processing" ||
    voiceState === "agent-speaking" ||
    prdMutation.isPending ||
    landingMutation.isPending ||
    pitchMutation.isPending;

  const generationState = useMemo(() => {
    const mutationStates: Partial<Record<ArtifactKey, boolean>> = {
      prd: prdMutation.isPending,
      "landing-page": landingMutation.isPending,
      "pitch-deck": pitchMutation.isPending,
    };
    return ARTIFACT_KEYS.map((artifactKey) => {
      const local = localStatuses[artifactKey];
      const server = serverStatus[artifactKey];
      const url =
        artifactKey === "prd"
          ? urls.prdUrl
          : artifactKey === "landing-page"
            ? urls.landingPageUrl
            : urls.pitchDeckHtmlUrl || urls.pitchDeckExportUrl;
      const base =
        mutationStates[artifactKey] || local?.status === "generating"
          ? { artifactKey, status: "generating" as const }
          : (server ?? local ?? (url ? { artifactKey, status: "ready" as const } : undefined));
      return base ? { ...base, artifactKey } : null;
    }).filter((status): status is BrainstormArtifactStatus => status !== null);
  }, [
    landingMutation.isPending,
    localStatuses,
    pitchMutation.isPending,
    prdMutation.isPending,
    serverStatus,
    urls,
  ]);

  const hasServerGenerating = Object.values(serverStatus).some(
    (status) => status?.status === "generating"
  );
  const canGenerate = isWrapped && Boolean(sessionId) && !isBusy && !hasServerGenerating;

  const setGenerating = useCallback((artifactKey: ArtifactKey) => {
    setLocalStatuses((current) => ({
      ...current,
      [artifactKey]: { artifactKey, status: "generating" },
    }));
  }, []);

  const setFailed = useCallback((artifactKey: ArtifactKey, error: string) => {
    setLocalStatuses((current) => ({
      ...current,
      [artifactKey]: { artifactKey, status: "failed", error },
    }));
  }, []);

  const recoverArtifact = useCallback(
    async (artifactKey: ArtifactKey) => {
      if (!sessionId) return null;
      const status = await waitForArtifactState(sessionId, artifactKey);
      if (!status) return null;
      await artifactStatusQuery.refetch();
      if (status.status === "ready") {
        setLocalStatuses((current) => ({ ...current, [artifactKey]: status }));
        persist(canonicalArtifactUrls(sessionId, artifactKey));
      }
      return status.status;
    },
    [artifactStatusQuery, persist, sessionId]
  );

  const createPrd = useCallback(async () => {
    if (!sessionId || !canGenerate) return;
    setPrdError(null);
    setGenerating("prd");
    try {
      const data = await prdMutation.mutateAsync({ sessionId });
      setLocalStatuses((current) => ({
        ...current,
        prd: { artifactKey: "prd", status: "ready" },
      }));
      persist({ prdUrl: data.prdUrl, prdGeneratedAt: data.generatedAt });
      void downloadArtifactsSequential([{ path: data.prdUrl, filename: "brainstorm-prd.md" }]);
    } catch (err) {
      if (shouldReconcileArtifactError(err)) {
        const recovered = await recoverArtifact("prd");
        if (recovered === "ready") return;
        if (recovered === "failed") {
          const message = ERROR_COPY.prd_failed;
          setFailed("prd", message);
          setPrdError(message);
          return;
        }
        setFailed("prd", TIMEOUT_STILL_PENDING_COPY);
        setPrdError(TIMEOUT_STILL_PENDING_COPY);
        return;
      }
      const message = formatArtifactError(err);
      setFailed("prd", message);
      setPrdError(message);
    }
  }, [canGenerate, persist, prdMutation, recoverArtifact, sessionId, setFailed, setGenerating]);

  const createLandingPage = useCallback(async () => {
    if (!sessionId || !canGenerate) return;
    setLandingError(null);
    setGenerating("landing-page");
    try {
      const data = await landingMutation.mutateAsync(sessionId);
      setLocalStatuses((current) => ({
        ...current,
        "landing-page": {
          artifactKey: "landing-page",
          status: "ready",
          warnings: data.warnings,
        },
      }));
      persist({ landingPageUrl: data.landingPageUrl, landingWarnings: data.warnings });
      void downloadArtifactsSequential([
        { path: data.landingPageUrl, filename: "landing-page.html" },
      ]);
    } catch (err) {
      if (shouldReconcileArtifactError(err)) {
        const recovered = await recoverArtifact("landing-page");
        if (recovered === "ready") return;
        if (recovered === "failed") {
          const message = ERROR_COPY.landing_page_failed;
          setFailed("landing-page", message);
          setLandingError(message);
          return;
        }
        setFailed("landing-page", TIMEOUT_STILL_PENDING_COPY);
        setLandingError(TIMEOUT_STILL_PENDING_COPY);
        return;
      }
      const message = formatArtifactError(err);
      setFailed("landing-page", message);
      setLandingError(message);
    }
  }, [canGenerate, landingMutation, persist, recoverArtifact, sessionId, setFailed, setGenerating]);

  const createPitchDeck = useCallback(async () => {
    if (!sessionId || !canGenerate) return;
    setPitchError(null);
    setGenerating("pitch-deck");
    try {
      const data = await pitchMutation.mutateAsync(sessionId);
      setLocalStatuses((current) => ({
        ...current,
        "pitch-deck": { artifactKey: "pitch-deck", status: "ready", warnings: data.warnings },
      }));
      persist({
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
      if (shouldReconcileArtifactError(err)) {
        const recovered = await recoverArtifact("pitch-deck");
        if (recovered === "ready") return;
        if (recovered === "failed") {
          const message = ERROR_COPY.pitch_deck_failed;
          setFailed("pitch-deck", message);
          setPitchError(message);
          return;
        }
        setFailed("pitch-deck", TIMEOUT_STILL_PENDING_COPY);
        setPitchError(TIMEOUT_STILL_PENDING_COPY);
        return;
      }
      const message = formatArtifactError(err);
      setFailed("pitch-deck", message);
      setPitchError(message);
    }
  }, [canGenerate, persist, pitchMutation, recoverArtifact, sessionId, setFailed, setGenerating]);

  const errors = useMemo(
    () => ({ prd: prdError, "landing-page": landingError, "pitch-deck": pitchError }),
    [landingError, pitchError, prdError]
  );

  return {
    isWrapped,
    isBusy,
    canGeneratePrd: canGenerate,
    canGenerateLanding: canGenerate,
    canGeneratePitch: canGenerate,
    artifactStatuses: generationState,
    prdUrl: urls.prdUrl,
    prdGeneratedAt: stored?.prdGeneratedAt,
    landingPageUrl: urls.landingPageUrl,
    landingWarnings: stored?.landingWarnings ?? serverStatus["landing-page"]?.warnings,
    pitchDeckHtmlUrl: urls.pitchDeckHtmlUrl,
    pitchDeckExportUrl: urls.pitchDeckExportUrl,
    speakerScriptUrl: urls.speakerScriptUrl,
    pitchWarnings: stored?.pitchWarnings ?? serverStatus["pitch-deck"]?.warnings,
    prdError:
      serverStatus.prd?.status === "ready"
        ? null
        : (errors.prd ?? (localStatuses.prd?.error as string | undefined) ?? null),
    landingError:
      serverStatus["landing-page"]?.status === "ready"
        ? null
        : (errors["landing-page"] ??
          (localStatuses["landing-page"]?.error as string | undefined) ??
          null),
    pitchError:
      serverStatus["pitch-deck"]?.status === "ready"
        ? null
        : (errors["pitch-deck"] ??
          (localStatuses["pitch-deck"]?.error as string | undefined) ??
          null),
    prdHint: !isWrapped
      ? "Output mở sau khi conversation hoàn tất."
      : isBusy
        ? "Đang xử lý — output sẽ cập nhật khi server hoàn tất."
        : null,
    isPrdPending: prdMutation.isPending || localStatuses.prd?.status === "generating",
    isLandingPending:
      landingMutation.isPending || localStatuses["landing-page"]?.status === "generating",
    isPitchPending: pitchMutation.isPending || localStatuses["pitch-deck"]?.status === "generating",
    createPrd,
    createLandingPage,
    createPitchDeck,
  };
}
