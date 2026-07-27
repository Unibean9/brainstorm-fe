import type { ApiResponse } from "@/types/api";
import type {
  CreateRoomRequest,
  CreateRoomSessionRequest,
  Room,
  RoomSessionSummary,
} from "@/types/brainstorm-domain";
import type { BrainstormSessionSnapshot } from "@/types/brainstorm-stream";

import { withTeacherHeader } from "@/lib/api/teacher-header";
import apiService from "../core";

const BASE = "api/v1/brainstorm/rooms";

export const roomsApi = {
  /** Header X-Teacher-Id bắt buộc. */
  create: async (body: CreateRoomRequest): Promise<Room> => {
    const response = await apiService.post<ApiResponse<Room>>(BASE, body, withTeacherHeader());
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
    >(`${BASE}/${roomId}/sessions`, body, withTeacherHeader());
    return response.data.data;
  },

  listSessions: async (roomId: string): Promise<RoomSessionSummary[]> => {
    const response = await apiService.get<ApiResponse<RoomSessionSummary[]>>(
      `${BASE}/${roomId}/sessions`
    );
    return response.data.data;
  },
};
