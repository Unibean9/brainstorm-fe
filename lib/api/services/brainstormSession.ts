import type { ApiResponse } from "@/types/api";
import type {
  BrainstormFillersResponse,
  BrainstormLandingPageResponse,
  BrainstormPitchDeckResponse,
  BrainstormPrdResponse,
  BrainstormSessionSnapshot,
  PostBrainstormTurnRequest,
} from "@/types/brainstorm-stream";

import { parseApiErrorBody } from "@/lib/brainstorm/parse-api-error";
import { resolveApiBaseUrl } from "@/lib/api/resolve-api-base-url";
import { readStoredTeacher } from "@/lib/brainstorm/teacher-storage";
import { withTeacherHeader } from "@/lib/api/teacher-header";
import apiService from "../core";

const BASE = "api/v1/brainstorm/sessions";

/**
 * landing-page / pitch-deck: server bound tối đa 15 phút (ARTIFACT_DEADLINE_MS, retry
 * brief+lint tới 3 lần + đo layout Puppeteer). Client timeout phải dài hơn ngân sách
 * backend một khoảng an toàn — đặt bằng nhau tuyệt đối nghĩa là gần như không có margin,
 * bất kỳ độ trễ mạng/proxy nào cũng đủ khiến client timeout ngay trước/đúng lúc backend xong.
 */
const ARTIFACT_BACKEND_BUDGET_MS = 15 * 60_000;
const ARTIFACT_GENERATION_TIMEOUT_MS = ARTIFACT_BACKEND_BUDGET_MS + 80_000;

/** PRD không có deadline constant tường minh ở backend — dùng cùng ngân sách client để không cắt sớm hơn landing/deck. */
const PRD_GENERATION_TIMEOUT_MS = ARTIFACT_GENERATION_TIMEOUT_MS;

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
  },

  /** `force=true` bỏ qua gate phase_not_complete — chỉ dùng sau khi giáo viên xác nhận. */
  createPrd: async (sessionId: string, force = false): Promise<BrainstormPrdResponse> => {
    const query = force ? "?force=true" : "";
    const response = await apiService.post<ApiResponse<BrainstormPrdResponse>>(
      `${BASE}/${sessionId}/prd${query}`,
      {},
      { ...withTeacherHeader(), timeout: PRD_GENERATION_TIMEOUT_MS }
    );
    return response.data.data;
  },

  /** ensureBrief (lazy từ PRD) → skill → lint → retry tới 3 lần → đo layout Puppeteer. */
  createLandingPage: async (sessionId: string): Promise<BrainstormLandingPageResponse> => {
    const response = await apiService.post<ApiResponse<BrainstormLandingPageResponse>>(
      `${BASE}/${sessionId}/landing-page`,
      {},
      { ...withTeacherHeader(), timeout: ARTIFACT_GENERATION_TIMEOUT_MS }
    );
    return response.data.data;
  },

  /** Cùng pipeline landing-page + thêm bước render PDF (Puppeteer). Không còn body/format. */
  createPitchDeck: async (sessionId: string): Promise<BrainstormPitchDeckResponse> => {
    const response = await apiService.post<ApiResponse<BrainstormPitchDeckResponse>>(
      `${BASE}/${sessionId}/pitch-deck`,
      undefined,
      { ...withTeacherHeader(), timeout: ARTIFACT_GENERATION_TIMEOUT_MS }
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
