/** Map mã lỗi turn (SSE `error` event hoặc lỗi trước-stream) → câu tiếng Việt hiển thị UI. */
const TURN_ERROR_COPY: Record<string, string> = {
  audio_unavailable: "Không có audio cho lượt này — TTS tạm lỗi, chữ vẫn đầy đủ.",
  audio_truncated: "Audio bị ngắt giữa chừng — xem phần chữ.",
  room_busy: "Room đang bận việc khác — gửi lại được ngay.",
  turn_failed: "Lượt này gặp lỗi — gửi lại được ngay.",
  client_disconnected: "Kết nối tới facilitator bị gián đoạn — gửi lại được ngay.",
  turn_in_progress: "Đang có một lượt chạy — chờ xong rồi gửi tiếp.",
  turn_interrupted: "Lượt trước bị đứt — gửi lại lượt mới.",
  session_wrapped: "Phiên đã đóng sau khi tạo PRD — không nhận lượt mới.",
  invalid_turn: "Nội dung gửi không hợp lệ.",
  input_too_large: "Nội dung quá dài.",
};

export function formatTurnErrorCode(code: string): string {
  return TURN_ERROR_COPY[code] ?? code;
}
