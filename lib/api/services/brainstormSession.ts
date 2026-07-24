import type { ApiResponse } from "@/types/api";
import type {
  BrainstormSessionSnapshot,
  CreateBrainstormSessionRequest,
  PostBrainstormTurnRequest,
} from "@/types/brainstorm-stream";

import apiService, { getAuthToken } from "../core";

const BASE = "api/v1/brainstorm/sessions";

function apiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/";
  return url.endsWith("/") ? url : `${url}/`;
}

export const brainstormSessionApi = {
  create: async (
    body: CreateBrainstormSessionRequest = {}
  ): Promise<BrainstormSessionSnapshot> => {
    const response = await apiService.post<ApiResponse<BrainstormSessionSnapshot>>(BASE, {
      locale: "vi-VN",
      ...body,
    });
    return response.data.data;
  },

  get: async (sessionId: string): Promise<BrainstormSessionSnapshot> => {
    const response = await apiService.get<ApiResponse<BrainstormSessionSnapshot>>(
      `${BASE}/${sessionId}`
    );
    return response.data.data;
  },

  updateVoice: async (sessionId: string, voiceId: string): Promise<void> => {
    await apiService.patch(`${BASE}/${sessionId}/voice`, { voiceId });
  },

  /**
   * SSE turn stream — dùng `fetch` (ReadableStream) thay vì axios.
   * REST còn lại qua axios + interceptors (auth refresh).
   */
  postTurnStream: async (
    sessionId: string,
    body: PostBrainstormTurnRequest,
    signal?: AbortSignal
  ): Promise<Response> => {
    const token = getAuthToken();
    return fetch(new URL(`${BASE}/${sessionId}/turns`, apiBaseUrl()), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  },
};
