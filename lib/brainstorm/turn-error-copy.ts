/** Map mã lỗi turn (SSE `error` event hoặc lỗi trước-stream) → câu tiếng Việt hiển thị UI. */
const TURN_ERROR_COPY: Record<string, string> = {
  audio_unavailable: "Không có audio cho lượt này — TTS tạm lỗi, chữ vẫn đầy đủ.",
  audio_truncated: "Audio bị ngắt giữa chừng — xem phần chữ.",
  room_busy: "Room đang bận việc khác — gửi lại được ngay.",
  turn_failed: "Lượt này gặp lỗi — gửi lại được ngay.",
  client_disconnected: "Kết nối tới facilitator bị gián đoạn — gửi lại được ngay.",
  turn_in_progress: "Đang có một lượt chạy — chờ xong rồi gửi tiếp.",
  turn_interrupted: "Lượt trước bị đứt — gửi lại lượt mới.",
  session_wrapped: "Phiên đã đóng — không nhận lượt mới.",
  invalid_turn: "Nội dung gửi không hợp lệ.",
  input_too_large: "Nội dung quá dài.",
  "not-allowed": "Trình duyệt chưa cho phép dùng micro. Hãy cấp quyền rồi thử lại.",
  service_not_allowed: "Trình duyệt chưa cho phép dùng micro. Hãy cấp quyền rồi thử lại.",
  unsupported: "Trình duyệt này chưa hỗ trợ nhận giọng nói. Bạn có thể chat bằng chữ.",
  audio_context_not_allowed: "Trình duyệt chưa cho phép phát âm thanh. Hãy bật quyền audio rồi thử lại.",
};

export function formatTurnErrorCode(code: string): string {
  if (TURN_ERROR_COPY[code]) return TURN_ERROR_COPY[code];
  if (code.includes(" ") && !/request failed|network error|timeout|econn/i.test(code)) return code;
  return "Có lỗi khi xử lý lượt này. Bạn có thể thử lại hoặc chat bằng chữ.";
}
