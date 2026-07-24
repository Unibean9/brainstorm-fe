export type RoomStatus = "active" | "in_progress" | "completed" | "draft";

export type MockRoom = {
  id: string;
  title: string;
  topic: string;
  goal: string;
  status: RoomStatus;
  participants: number;
  ideas: number;
  readiness: number;
  lastSession: string;
  phase: string;
};

export const mockRooms: MockRoom[] = [
  {
    id: "room-001",
    title: "Wookki Attendance MVP",
    topic: "Attendance for SME HRM app",
    goal: "Tìm giải pháp chấm công rẻ, dễ triển khai cho SME",
    status: "active",
    participants: 10,
    ideas: 200,
    readiness: 72,
    lastSession: "Hôm nay, 09:15",
    phase: "Decision",
  },
];

export const READINESS_COLORS = {
  low: "oklch(0.55 0.22 25)",
  medium: "oklch(0.55 0.18 65)",
  high: "oklch(0.5 0.15 145)",
} as const;

export function getReadinessTone(value: number) {
  if (value >= 70) {
    return { color: READINESS_COLORS.high, level: "high" as const };
  }
  if (value >= 40) {
    return { color: READINESS_COLORS.medium, level: "medium" as const };
  }
  return { color: READINESS_COLORS.low, level: "low" as const };
}
