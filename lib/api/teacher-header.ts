import type { AxiosRequestConfig } from "axios";

import { readStoredTeacher } from "@/lib/brainstorm/teacher-storage";

/**
 * X-Teacher-Id là định danh (attribution), không phải xác thực (JWT Bearer) —
 * cố tình tách khỏi interceptor Authorization của apiService để không đụng
 * vào luồng auth khác trong app. Xem docs/frontend-integration-guide.md §2.
 */
export function withTeacherHeader(config?: AxiosRequestConfig): AxiosRequestConfig {
  const teacher = readStoredTeacher();
  if (!teacher?.teacherId) return config ?? {};
  return {
    ...config,
    headers: {
      ...config?.headers,
      "X-Teacher-Id": teacher.teacherId,
    },
  };
}
