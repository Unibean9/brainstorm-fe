import type { AxiosError } from "axios";

import type { ApiResponse } from "@/types/api";

export class BrainstormApiError extends Error {
  code?: string;
  recoverable?: boolean;
  status?: number;

  constructor(message: string, code?: string, status?: number, recoverable?: boolean) {
    super(message);
    this.name = "BrainstormApiError";
    this.code = code;
    this.status = status;
    this.recoverable = recoverable;
  }
}

export function parseApiErrorBody(
  raw: string,
  status?: number
): BrainstormApiError {
  try {
    const json = JSON.parse(raw) as ApiResponse<unknown> & {
      error?: { code?: string; recoverable?: boolean };
    };
    return new BrainstormApiError(
      json.message || raw || "Request failed",
      json.error?.code,
      status,
      json.error?.recoverable
    );
  } catch {
    return new BrainstormApiError(raw || "Request failed", undefined, status);
  }
}

export function parseAxiosApiError(err: unknown): BrainstormApiError {
  const axiosErr = err as AxiosError<
    ApiResponse<unknown> & { error?: { code?: string; recoverable?: boolean } }
  >;
  if (axiosErr?.response?.data) {
    const body = axiosErr.response.data;
    return new BrainstormApiError(
      body.message || axiosErr.message || "Request failed",
      body.error?.code,
      axiosErr.response.status,
      body.error?.recoverable
    );
  }
  if (err instanceof BrainstormApiError) return err;
  if (err instanceof Error) return new BrainstormApiError(err.message);
  return new BrainstormApiError("Request failed");
}
