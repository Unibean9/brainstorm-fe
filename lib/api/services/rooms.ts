import type { ApiResponse } from "@/types/api";
import type {
  CreateRoomRequest,
  CreateRoomSessionRequest,
  DeletionCounts,
  Room,
  RoomSessionSummary,
} from "@/types/brainstorm-domain";
import type { BrainstormSessionSnapshot } from "@/types/brainstorm-stream";

import { withTeacherHeader } from "@/lib/api/teacher-header";
import apiService from "../core";

const BASE = "api/v1/brainstorm/rooms";
const SESSION_START_TIMEOUT_MS = 500_000;

export const roomsApi = {
  /** Header X-Teacher-Id bắt buộc. */
  create: async (body: CreateRoomRequest): Promise<Room> => {
    const response = await apiService.post<ApiResponse<Room>>(BASE, body, withTeacherHeader());
    return response.data.data;
  },

  /** Giá trị mặc định (theo env của backend) để form tạo room chọn sẵn. */
  defaults: async (): Promise<{ supportiveMode: boolean }> => {
    const response = await apiService.get<ApiResponse<{ supportiveMode: boolean }>>(
      "api/v1/brainstorm/room-defaults"
    );
    return response.data.data;
  },

  /** Danh sách toàn bộ room trên instance — không cần header, không lọc theo teacher. */
  list: async (): Promise<Room[]> => {
    const response = await apiService.get<ApiResponse<Room[]>>(BASE);
    return response.data.data;
  },

  /** Header bắt buộc. Cách duy nhất để tạo session — không còn POST /sessions phẳng. */
  createSession: async (
    roomId: string,
    body: CreateRoomSessionRequest
  ): Promise<BrainstormSessionSnapshot & { roomId: string; name: string }> => {
    const response = await apiService.post<
      ApiResponse<BrainstormSessionSnapshot & { roomId: string; name: string }>
    >(`${BASE}/${roomId}/sessions`, body, {
      ...withTeacherHeader(),
      // The backend bounds Codex startup at 30s. Keep a small client margin so
      // a stalled proxy cannot leave the onboarding form disabled indefinitely.
      timeout: SESSION_START_TIMEOUT_MS,
    });
    return response.data.data;
  },

  listSessions: async (roomId: string): Promise<RoomSessionSummary[]> => {
    const response = await apiService.get<ApiResponse<RoomSessionSummary[]>>(
      `${BASE}/${roomId}/sessions`
    );
    return response.data.data;
  },

  /** Header bắt buộc. Xoá room kèm mọi session trong room. */
  remove: (roomId: string) => deleteWithTeacher(`${BASE}/${roomId}`),

  /** Header bắt buộc. Xoá mọi room trên instance (kèm session). */
  removeAll: () => deleteWithTeacher(BASE),

  /** Header bắt buộc. */
  removeSession: (sessionId: string) =>
    deleteWithTeacher(`api/v1/brainstorm/sessions/${sessionId}`),

  /** Header bắt buộc. Xoá mọi session trong room, giữ lại room. */
  removeAllSessions: (roomId: string) => deleteWithTeacher(`${BASE}/${roomId}/sessions`),
};

// apiService.delete takes no request config, so the teacher header goes through request().
async function deleteWithTeacher(url: string): Promise<DeletionCounts> {
  const response = await apiService.request<ApiResponse<{ deleted: DeletionCounts }>>({
    ...withTeacherHeader(),
    method: "DELETE",
    url,
  });
  return response.data.data.deleted;
}
