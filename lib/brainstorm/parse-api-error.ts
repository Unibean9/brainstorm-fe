import type { AxiosError } from "axios";

import type { ApiError } from "@/lib/api/core";
import type { ApiResponse } from "@/types/api";

type ArtifactApiBody = ApiResponse<unknown> & { error?: { code?: string; recoverable?: boolean } };

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

function isApiServiceError(err: unknown): err is ApiError {
  return Boolean(err) && typeof err === "object" && "status" in (err as object) && "data" in (err as object);
}

export function parseAxiosApiError(err: unknown): BrainstormApiError {
  // apiService (lib/api/core.ts) response interceptor bọc MỌI lỗi axios thành
  // { code: httpStatus, message, status: false, data: responseBody } trước khi reject —
  // không còn field `.response` như AxiosError gốc. Phải đọc shape này trước, nếu không
  // mọi lỗi (kể cả room_busy có message rõ ràng từ BE) đều rơi vào "Request failed" ở cuối.
  if (isApiServiceError(err)) {
    const body = err.data as ArtifactApiBody | undefined;
    return new BrainstormApiError(
      body?.message || err.message || "Request failed",
      body?.error?.code,
      err.code,
      body?.error?.recoverable
    );
  }

  const axiosErr = err as AxiosError<ArtifactApiBody>;
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
