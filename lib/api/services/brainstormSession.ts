import type { ApiResponse } from "@/types/api";
import type {
  BrainstormFillersResponse,
  BrainstormLandingPageResponse,
  BrainstormPitchDeckFormat,
  BrainstormPitchDeckResponse,
  BrainstormReportResponse,
  BrainstormSessionSnapshot,
  CreateBrainstormSessionRequest,
  PostBrainstormTurnRequest,
} from "@/types/brainstorm-stream";

import { parseApiErrorBody } from "@/lib/brainstorm/parse-api-error";
import { resolveApiBaseUrl } from "@/lib/api/resolve-api-base-url";
import apiService from "../core";

const BASE = "api/v1/brainstorm/sessions";

export const brainstormSessionApi = {
  create: async (
    body: CreateBrainstormSessionRequest = {}
  ): Promise<BrainstormSessionSnapshot> => {
    const response = await apiService.post<ApiResponse<BrainstormSessionSnapshot>>(BASE, body);
    return response.data.data;
  },

  get: async (sessionId: string): Promise<BrainstormSessionSnapshot> => {
    const response = await apiService.get<ApiResponse<BrainstormSessionSnapshot>>(
      `${BASE}/${sessionId}`
    );
    return response.data.data;
  },

  updateVoice: async (sessionId: string, voiceId = "default"): Promise<void> => {
    await apiService.patch(`${BASE}/${sessionId}/voice`, { voiceId });
  },

  postTurnStream: async (
    sessionId: string,
    body: PostBrainstormTurnRequest,
    signal?: AbortSignal
  ): Promise<Response> => {
    const response = await fetch(new URL(`${BASE}/${sessionId}/turns`, resolveApiBaseUrl()), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        clientTurnId: body.clientTurnId,
        text: body.text,
      }),
      signal,
    });
    return response;
  },

  createReport: async (sessionId: string): Promise<BrainstormReportResponse> => {
    const response = await apiService.post<ApiResponse<BrainstormReportResponse>>(
      `${BASE}/${sessionId}/report`,
      {}
    );
    return response.data.data;
  },

  createLandingPage: async (sessionId: string): Promise<BrainstormLandingPageResponse> => {
    const response = await apiService.post<ApiResponse<BrainstormLandingPageResponse>>(
      `${BASE}/${sessionId}/landing-page`,
      {}
    );
    return response.data.data;
  },

  createPitchDeck: async (
    sessionId: string,
    format: BrainstormPitchDeckFormat = "pdf"
  ): Promise<BrainstormPitchDeckResponse> => {
    const apiFormat = format === "ppt" ? "pptx" : format;
    const response = await apiService.post<ApiResponse<BrainstormPitchDeckResponse>>(
      `${BASE}/${sessionId}/pitch-deck`,
      { format: apiFormat }
    );
    return response.data.data;
  },

  getFillers: async (): Promise<BrainstormFillersResponse> => {
    const response = await fetch(new URL("fillers", resolveApiBaseUrl()));
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw parseApiErrorBody(text, response.status);
    }
    return (await response.json()) as BrainstormFillersResponse;
  },
};

export { parseApiErrorBody };
