import type { ApiResponse } from "@/types/api";
import type {
  AcceptCandidateRequest,
  BrainstormFillersResponse,
  BrainstormLandingPageResponse,
  BrainstormPitchDeckResponse,
  BrainstormPrdResponse,
  BrainstormSessionSnapshot,
  PostOutcomeRequest,
  PostBrainstormTurnRequest,
  StartAutonomousIdeationRequest,
} from "@/types/brainstorm-stream";
import type {
  AutonomousIdeationCandidate,
  AutonomousIdeationJob,
  BriefMutationResponse,
  DurableOutcome,
  FacilitationMode,
  SessionBrief,
  WorkingBriefPatch,
} from "@/types/brainstorm-domain";

import { BrainstormApiError, parseApiErrorBody } from "@/lib/brainstorm/parse-api-error";
import { resolveApiBaseUrl } from "@/lib/api/resolve-api-base-url";
import { readStoredTeacher } from "@/lib/brainstorm/teacher-storage";
import { withTeacherHeader } from "@/lib/api/teacher-header";
import apiService from "../core";

const BASE = "api/v1/brainstorm/sessions";

/**
 * Artifact routes may run for up to 20 minutes on the server (including retries and
 * layout measurement). Edge proxies can still return HTTP 524 before that; the artifact
 * hook then reconciles the server-owned status instead of treating the request as failed.
 */
// The browser may be talking through a proxy with a shorter request budget.
// After this point the hook switches to snapshot reconciliation instead of
// keeping the artifact controls blocked on one HTTP response.
const ARTIFACT_REQUEST_TIMEOUT_MS = 1_260_000;

export const brainstormSessionApi = {
  /** Snapshot đầy đủ — dùng để resume sau F5/mất kết nối. Không cần header. */
  get: async (sessionId: string): Promise<BrainstormSessionSnapshot> => {
    const response = await apiService.get<ApiResponse<BrainstormSessionSnapshot>>(
      `${BASE}/${sessionId}`
    );
    return response.data.data;
  },

  /**
   * SSE. Header X-Teacher-Id bắt buộc. Response có thể KHÔNG phải
   * text/event-stream nếu clientTurnId trùng turn đã completed (200 JSON)
   * hoặc đang processing/interrupted/failed (409 JSON) — caller phải đọc
   * content-type trước khi parse SSE.
   */
  postTurnStream: async (
    sessionId: string,
    body: PostBrainstormTurnRequest,
    signal?: AbortSignal
  ): Promise<Response> => {
    const teacher = readStoredTeacher();
    try {
      const response = await fetch(new URL(`${BASE}/${sessionId}/turns`, resolveApiBaseUrl()), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(teacher?.teacherId ? { "X-Teacher-Id": teacher.teacherId } : {}),
        },
        body: JSON.stringify({
          clientTurnId: body.clientTurnId,
          text: body.text,
          audioMode: body.audioMode ?? "streaming",
        }),
        signal,
      });
      return response;
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
      throw new BrainstormApiError(
        "Không thể kết nối tới máy chủ Brainstorm — kiểm tra backend rồi thử lại.",
        "network_error",
        undefined,
        true,
        false,
        true
      );
    }
  },

  /** Artifact có thể tạo ở mọi phase; backend chỉ từ chối khi turn đang chạy/chưa đủ source. */
  createPrd: async (sessionId: string): Promise<BrainstormPrdResponse> => {
    const response = await apiService.post<ApiResponse<BrainstormPrdResponse>>(
      `${BASE}/${sessionId}/prd?async=true`,
      {},
      { ...withTeacherHeader(), timeout: ARTIFACT_REQUEST_TIMEOUT_MS }
    );
    return response.data.data;
  },

  /** ensureBrief (lazy từ PRD) → skill → lint → retry tới 3 lần → đo layout Puppeteer. */
  createLandingPage: async (sessionId: string): Promise<BrainstormLandingPageResponse> => {
    const response = await apiService.post<ApiResponse<BrainstormLandingPageResponse>>(
      `${BASE}/${sessionId}/landing-page`,
      {},
      { ...withTeacherHeader(), timeout: ARTIFACT_REQUEST_TIMEOUT_MS }
    );
    return response.data.data;
  },

  /** Cùng pipeline landing-page + thêm bước render PDF (Puppeteer). Không còn body/format. */
  createPitchDeck: async (sessionId: string): Promise<BrainstormPitchDeckResponse> => {
    const response = await apiService.post<ApiResponse<BrainstormPitchDeckResponse>>(
      `${BASE}/${sessionId}/pitch-deck`,
      undefined,
      { ...withTeacherHeader(), timeout: ARTIFACT_REQUEST_TIMEOUT_MS }
    );
    return response.data.data;
  },

  updateMode: async (
    sessionId: string,
    facilitationMode: FacilitationMode,
    reason?: string
  ): Promise<{
    facilitationMode: FacilitationMode;
    modeRevision: number;
    effectiveFrom: "next_turn";
  }> => {
    const response = await apiService.patch<
      ApiResponse<{
        facilitationMode: FacilitationMode;
        modeRevision: number;
        effectiveFrom: "next_turn";
      }>
    >(
      `${BASE}/${sessionId}/mode`,
      { facilitationMode, ...(reason?.trim() ? { reason: reason.trim() } : {}) },
      withTeacherHeader()
    );
    return response.data.data;
  },

  /** Persist the teacher-approved Working Brief as the durable Session Brief. */
  confirmBrief: async (
    sessionId: string,
    body?: Pick<SessionBrief, "stance" | "requestedArtifacts">
  ): Promise<BriefMutationResponse> => {
    const response = await apiService.post<ApiResponse<BriefMutationResponse>>(
      `${BASE}/${sessionId}/brief/confirm`,
      body ?? {},
      withTeacherHeader()
    );
    return response.data.data;
  },

  /** Update discovered context during the session, or revise a confirmed brief. */
  updateBrief: async (
    sessionId: string,
    body: WorkingBriefPatch | { brief: SessionBrief }
  ): Promise<BriefMutationResponse> => {
    const response = await apiService.patch<ApiResponse<BriefMutationResponse>>(
      `${BASE}/${sessionId}/brief`,
      body,
      withTeacherHeader()
    );
    return response.data.data;
  },

  complete: async (sessionId: string): Promise<{ sessionId: string; status: "wrapped" }> => {
    const response = await apiService.post<ApiResponse<{ sessionId: string; status: "wrapped" }>>(
      `${BASE}/${sessionId}/complete`,
      undefined,
      withTeacherHeader()
    );
    return response.data.data;
  },

  listOutcomes: async (sessionId: string): Promise<DurableOutcome[]> => {
    const response = await apiService.get<ApiResponse<DurableOutcome[]>>(
      `${BASE}/${sessionId}/outcomes`
    );
    return response.data.data;
  },

  createOutcome: async (sessionId: string, body: PostOutcomeRequest): Promise<DurableOutcome> => {
    const response = await apiService.post<ApiResponse<DurableOutcome>>(
      `${BASE}/${sessionId}/outcomes`,
      body,
      withTeacherHeader()
    );
    return response.data.data;
  },

  startAutonomousIdeation: async (
    sessionId: string,
    body: StartAutonomousIdeationRequest
  ): Promise<AutonomousIdeationJob> => {
    const response = await apiService.post<ApiResponse<AutonomousIdeationJob>>(
      `${BASE}/${sessionId}/autonomous-ideation/jobs`,
      body,
      withTeacherHeader()
    );
    return response.data.data;
  },

  getAutonomousJob: async (sessionId: string, jobId: string): Promise<AutonomousIdeationJob> => {
    const response = await apiService.get<ApiResponse<AutonomousIdeationJob>>(
      `${BASE}/${sessionId}/autonomous-ideation/jobs/${jobId}`
    );
    return response.data.data;
  },

  cancelAutonomousJob: async (sessionId: string, jobId: string): Promise<AutonomousIdeationJob> => {
    const response = await apiService.post<ApiResponse<AutonomousIdeationJob>>(
      `${BASE}/${sessionId}/autonomous-ideation/jobs/${jobId}/cancel`,
      undefined,
      withTeacherHeader()
    );
    return response.data.data;
  },

  listAutonomousCandidates: async (
    sessionId: string,
    jobId: string
  ): Promise<AutonomousIdeationCandidate[]> => {
    const response = await apiService.get<
      ApiResponse<AutonomousIdeationCandidate[] | { candidates: AutonomousIdeationCandidate[] }>
    >(`${BASE}/${sessionId}/autonomous-ideation/jobs/${jobId}/candidates`);
    const data = response.data.data;
    return Array.isArray(data) ? data : data.candidates;
  },

  acceptAutonomousCandidate: async (
    sessionId: string,
    jobId: string,
    candidateId: string,
    body?: AcceptCandidateRequest
  ): Promise<DurableOutcome> => {
    const response = await apiService.post<ApiResponse<DurableOutcome>>(
      `${BASE}/${sessionId}/autonomous-ideation/jobs/${jobId}/candidates/${candidateId}/accept`,
      body ?? {},
      withTeacherHeader()
    );
    return response.data.data;
  },

  rejectAutonomousCandidate: async (
    sessionId: string,
    jobId: string,
    candidateId: string
  ): Promise<AutonomousIdeationCandidate> => {
    const response = await apiService.post<ApiResponse<AutonomousIdeationCandidate>>(
      `${BASE}/${sessionId}/autonomous-ideation/jobs/${jobId}/candidates/${candidateId}/reject`,
      undefined,
      withTeacherHeader()
    );
    return response.data.data;
  },

  getFillers: async (): Promise<BrainstormFillersResponse> => {
    const response = await fetch(new URL("fillers", resolveApiBaseUrl()));
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw parseApiErrorBody(text, response.status);
    }
    const body = (await response.json()) as ApiResponse<BrainstormFillersResponse>;
    return body.data;
  },
};

export { parseApiErrorBody };
