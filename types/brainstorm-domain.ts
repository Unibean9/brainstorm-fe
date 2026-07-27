/** Teacher — định danh, không phải xác thực. Xem docs/frontend-integration-guide.md §2. */
export type Teacher = {
  teacherId: string;
  code: string;
  name: string;
  createdAt: string;
  isNew: boolean;
};

export type TeacherDirectoryEntry = {
  code: string;
  name: string;
  createdAt: string;
};

export type CreateTeacherRequest = {
  code: string;
  name: string;
};

/** Room — id-space riêng biệt, luôn có tiền tố rm_. */
export type Room = {
  roomId: string;
  name: string;
  ownerTeacherId: string;
  ownerName?: string;
  createdAt: string;
};

export type CreateRoomRequest = {
  name: string;
};

export type RoomSessionStatus = "active" | "wrapped" | string;

export type RoomSessionSummary = {
  sessionId: string;
  name: string;
  status: RoomSessionStatus;
  phaseKey: string;
  createdAt: string;
};

export type CreateRoomSessionRequest = {
  name: string;
};

export type CloudSyncFailedRecord = {
  id: string;
  sessionId: string;
  kind: "trace" | "metadata" | "prd" | "landing" | "pitch";
  attempts: number;
  lastError: { code: string; hint: string } | null;
  updatedAt: string;
};

export type CloudSyncStatus = {
  counts: Record<string, number>;
  failed: CloudSyncFailedRecord[];
};
