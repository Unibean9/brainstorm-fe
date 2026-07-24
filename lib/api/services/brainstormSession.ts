import type { ApiResponse } from "@/types/api";
import type {
  BrainstormSessionSnapshot,
  CreateBrainstormSessionRequest,
  PostBrainstormTurnRequest,
} from "@/types/brainstorm-stream";

import { getAuthToken } from "../core";

const BASE = "api/v1/brainstorm/sessions";

function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/";
}

export const brainstormSessionApi = {
  create: async (
    body: CreateBrainstormSessionRequest = {}
  ): Promise<BrainstormSessionSnapshot> => {
    const token = getAuthToken();
    const res = await fetch(new URL(BASE, apiBaseUrl()), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ locale: "vi-VN", ...body }),
    });
    if (!res.ok) throw new Error(`Create session failed (${res.status})`);
    const json = (await res.json()) as ApiResponse<BrainstormSessionSnapshot>;
    return json.data;
  },

  get: async (sessionId: string): Promise<BrainstormSessionSnapshot> => {
    const token = getAuthToken();
    const res = await fetch(new URL(`${BASE}/${sessionId}`, apiBaseUrl()), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Get session failed (${res.status})`);
    const json = (await res.json()) as ApiResponse<BrainstormSessionSnapshot>;
    return json.data;
  },

  updateVoice: async (sessionId: string, voiceId: string): Promise<void> => {
    const token = getAuthToken();
    const res = await fetch(new URL(`${BASE}/${sessionId}/voice`, apiBaseUrl()), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ voiceId }),
    });
    if (!res.ok) throw new Error(`Update voice failed (${res.status})`);
  },

  /** POST turn → SSE stream (text + audio events trong một response) */
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
