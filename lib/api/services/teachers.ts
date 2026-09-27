import type { ApiResponse } from "@/types/api";
import type {
  CreateTeacherRequest,
  DeletionCounts,
  Teacher,
  TeacherDirectoryEntry,
} from "@/types/brainstorm-domain";

import apiService from "../core";

const BASE = "api/v1/brainstorm/teachers";

export const teachersApi = {
  /** Login-or-register bằng code — xem §2 guide. Không cần header. */
  register: async (body: CreateTeacherRequest): Promise<Teacher> => {
    const response = await apiService.post<ApiResponse<Teacher>>(BASE, body);
    return response.data.data;
  },

  list: async (): Promise<TeacherDirectoryEntry[]> => {
    const response = await apiService.get<ApiResponse<TeacherDirectoryEntry[]>>(BASE);
    return response.data.data;
  },

  /** Xoá GV kèm mọi room họ sở hữu và session họ tạo. Không cần header (chưa ai đăng nhập ở bước này). */
  remove: async (teacherId: string): Promise<DeletionCounts> => {
    const response = await apiService.delete<ApiResponse<{ deleted: DeletionCounts }>>(
      `${BASE}/${teacherId}`
    );
    return response.data.data.deleted;
  },

  removeAll: async (): Promise<DeletionCounts> => {
    const response = await apiService.delete<ApiResponse<{ deleted: DeletionCounts }>>(BASE);
    return response.data.data.deleted;
  },
};
