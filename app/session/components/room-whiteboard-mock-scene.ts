import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";

import { stickyRectSkeleton, THINKING_HAT_COLORS } from "./room-whiteboard-library";

type NoteSpec = {
  text: string;
  background: string;
  stroke: string;
  textColor?: string;
};

const FRAMING = { background: "#d0ebff", stroke: "#4dabf7" };
const FRAMING_ALT = { background: "#c3fae8", stroke: "#12b886" };
const DIVERGING = { background: "#fff3b0", stroke: "#e0b400" };
const DIVERGING_ALT = { background: "#ffd8a8", stroke: "#e8590c" };
const SHIFTING = { background: "#e5dbff", stroke: "#7950f2" };
const CRITIQUING = { background: "#ffc9c9", stroke: "#e03131" };
const CONVERGING = { background: "#d3f9d8", stroke: "#40c057" };

const skeleton: ExcalidrawElementSkeleton[] = [];
let cursorY = 0;

function heading(text: string) {
  skeleton.push({ type: "text", x: 0, y: cursorY, text, fontSize: 28 });
  cursorY += 60;
}

/** Lays out notes left-to-right, wrapping into new rows; advances the shared cursor. */
function addGrid(notes: NoteSpec[], opts?: { cols?: number; width?: number; height?: number; gap?: number }) {
  const cols = opts?.cols ?? 3;
  const width = opts?.width ?? 240;
  const height = opts?.height ?? 170;
  const gap = opts?.gap ?? 28;
  const startY = cursorY;

  notes.forEach((note, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    skeleton.push(
      stickyRectSkeleton({
        x: col * (width + gap),
        y: startY + row * (height + gap),
        width,
        height,
        background: note.background,
        stroke: note.stroke,
        textColor: note.textColor,
        text: note.text,
      })
    );
  });

  const rows = Math.ceil(notes.length / cols);
  cursorY = startY + rows * (height + gap) + 60;
}

// 1 — 5W1H
heading("🧭 5W1H — Vấn đề Wokki");
addGrid([
  { text: "WHO\nNhân viên part-time & chủ quán cà phê nhỏ", ...FRAMING },
  { text: "WHAT\nChấm công qua Excel/Zalo — dễ sai khi tính lương", ...FRAMING },
  { text: "WHEN\nPhát hiện sai lệch lúc nhận lương cuối ngày/tháng", ...FRAMING },
  { text: "WHERE\nQuán cà phê nhỏ, chuỗi nhiều nhân viên", ...FRAMING },
  { text: "WHY\nDữ liệu giờ công một chiều — chỉ chủ quán giữ", ...FRAMING },
  { text: "HOW\nKhông có bản ghi độc lập để đối chiếu", ...FRAMING },
]);

// 2 — How Might We
heading("💭 How Might We");
addGrid(
  [
    { text: "HMW giúp nhân viên tự xác minh giờ công mỗi ngày?", ...FRAMING_ALT },
    { text: "HMW giúp chủ quán xếp ca mà không cần chat qua lại trên Zalo?", ...FRAMING_ALT },
    { text: "HMW làm lương minh bạch mà không khiến chủ quán mất linh hoạt?", ...FRAMING_ALT },
  ],
  { cols: 3, width: 260 }
);

// 3 — Brainwriting
heading("✍️ Brainwriting — mỗi người viết riêng, không nói to");
addGrid([
  { text: "Chấm công bằng quét QR dán ở quầy", ...DIVERGING },
  { text: "App tự tính lương ngay khi tan ca", ...DIVERGING },
  { text: "Chủ quán duyệt ca bằng một nút bấm", ...DIVERGING },
  { text: "Nhân viên tự đổi ca cho nhau, chủ chỉ duyệt", ...DIVERGING },
  { text: "Lưu lịch sử chấm công dạng nhật ký, không sửa được", ...DIVERGING },
  { text: "Gửi bảng lương xem trước mỗi cuối tuần", ...DIVERGING },
]);

// 4 — SCAMPER
heading("🔄 SCAMPER");
addGrid(
  [
    { text: "Substitute\nThay bấm giấy bằng bấm nút trên app", ...DIVERGING_ALT },
    { text: "Combine\nGộp xếp ca + chấm công + lương vào một màn hình", ...DIVERGING_ALT },
    { text: "Adapt\nHọc cách quét mã ra/vào như bãi giữ xe", ...DIVERGING_ALT },
    { text: "Modify\nPhóng to \"giờ đã làm hôm nay\" làm trung tâm màn hình", ...DIVERGING_ALT },
    { text: "Put to other use\nDùng dữ liệu giờ công để tự đề xuất lịch tuần sau", ...DIVERGING_ALT },
    { text: "Eliminate\nBỏ hẳn bước chủ quán duyệt tay từng ca", ...DIVERGING_ALT },
    { text: "Reverse\nNhân viên tự đề xuất ca, chủ chỉ từ chối nếu cần", ...DIVERGING_ALT },
  ],
  { cols: 4, width: 230 }
);

// 5 — Crazy 8s
heading("⚡ Crazy 8s — 8 ý tưởng trong vài phút");
addGrid(
  [
    { text: "Chấm công bằng giọng nói", ...DIVERGING },
    { text: "Huy hiệu \"đi làm đúng giờ 7 ngày\"", ...DIVERGING },
    { text: "Cảnh báo khi quên chấm công ra", ...DIVERGING },
    { text: "Lương hiển thị như đồng hồ chạy real-time", ...DIVERGING },
    { text: "Selfie xác nhận vào ca", ...DIVERGING },
    { text: "Xin đổi ca nhanh ngay trong app", ...DIVERGING },
    { text: "Biểu đồ giờ làm theo tuần", ...DIVERGING },
    { text: "Rút gọn chấm công còn một chạm", ...DIVERGING },
  ],
  { cols: 4, width: 190, height: 140 }
);

// 6 — Six Thinking Hats
heading("🎩 Six Thinking Hats — Ý tưởng cho Wokki");
addGrid([
  { text: `${THINKING_HAT_COLORS.white.label}\nChấm công qua Excel, xếp ca qua Zalo`, background: THINKING_HAT_COLORS.white.background, stroke: THINKING_HAT_COLORS.white.stroke, textColor: THINKING_HAT_COLORS.white.text },
  { text: `${THINKING_HAT_COLORS.red.label}\nNhân viên thấy bất an vì không tự bảo vệ được mình`, background: THINKING_HAT_COLORS.red.background, stroke: THINKING_HAT_COLORS.red.stroke, textColor: THINKING_HAT_COLORS.red.text },
  { text: `${THINKING_HAT_COLORS.black.label}\nChủ quán có thể ngại mất "linh hoạt" khi minh bạch hoá`, background: THINKING_HAT_COLORS.black.background, stroke: THINKING_HAT_COLORS.black.stroke, textColor: THINKING_HAT_COLORS.black.text },
  { text: `${THINKING_HAT_COLORS.yellow.label}\nTiết kiệm công quản lý, giảm tranh chấp lương`, background: THINKING_HAT_COLORS.yellow.background, stroke: THINKING_HAT_COLORS.yellow.stroke, textColor: THINKING_HAT_COLORS.yellow.text },
  { text: `${THINKING_HAT_COLORS.green.label}\nThêm nhắc lịch + thông báo đổi ca tự động`, background: THINKING_HAT_COLORS.green.background, stroke: THINKING_HAT_COLORS.green.stroke, textColor: THINKING_HAT_COLORS.green.text },
  { text: `${THINKING_HAT_COLORS.blue.label}\nChốt ưu tiên P0: xếp ca + xem lương realtime`, background: THINKING_HAT_COLORS.blue.background, stroke: THINKING_HAT_COLORS.blue.stroke, textColor: THINKING_HAT_COLORS.blue.text },
]);

// 7 — Role storming
heading("🎭 Role Storming — nhập vai người khác");
addGrid(
  [
    { text: "🧓 NV lớn tuổi\n\"Chữ phải to, thao tác phải đơn giản\"", ...SHIFTING },
    { text: "😤 Chủ quán khó tính\n\"Tôi cần tự sửa giờ khi NV bấm nhầm\"", ...SHIFTING },
    { text: "🏪 Đối thủ cạnh tranh\n\"App tụi tôi tích hợp luôn trả lương\"", ...SHIFTING },
    { text: "🎓 Chuyên gia F&B\n\"Quán nhỏ ngại phí, cần bản miễn phí <5 NV\"", ...SHIFTING },
  ],
  { cols: 4, width: 230 }
);

// 8 — Pre-mortem
heading("⚰️ Pre-mortem — \"Dự án đã thất bại sau 1 năm, vì sao?\"");
addGrid([
  { text: "NV thấy app rườm rà hơn nhắn Zalo nên bỏ dùng", ...CRITIQUING },
  { text: "Chủ quán không nhập đúng giờ để né minh bạch", ...CRITIQUING },
  { text: "Mất mạng ở quán → không chấm công được, đổ lỗi qua lại", ...CRITIQUING },
  { text: "Không ai chịu là người đầu tiên đổi từ Excel sang app", ...CRITIQUING },
]);

// 9 — Devil's advocate
heading("😈 Devil's Advocate — công kích ý tưởng đang được ủng hộ nhất");
addGrid(
  [
    { text: "Xếp ca tự động sẽ dở nếu NV nghỉ đột xuất — ai xử lý kịp?", ...CRITIQUING },
    { text: "Chủ quán có thực sự muốn NV thấy lịch của người khác?", ...CRITIQUING },
    { text: "Thông báo đổi ca dồn dập có làm NV thấy phiền như spam?", ...CRITIQUING },
  ],
  { cols: 3, width: 260 }
);

// 10 — Impact-Effort Matrix
heading("📊 Impact–Effort Matrix");
{
  const mx = 0;
  const my = cursorY;
  const w = 700;
  const h = 460;
  skeleton.push(
    { type: "rectangle", x: mx, y: my, width: w, height: h, strokeColor: "#868e96", backgroundColor: "transparent", strokeStyle: "dashed" },
    { type: "line", x: mx, y: my + h / 2, points: [[0, 0], [w, 0]], strokeColor: "#868e96" },
    { type: "line", x: mx + w / 2, y: my, points: [[0, 0], [0, h]], strokeColor: "#868e96" },
    { type: "text", x: mx + 8, y: my + 6, text: "Impact cao", fontSize: 14, strokeColor: "#868e96" },
    { type: "text", x: mx + 8, y: my + h - 24, text: "Impact thấp", fontSize: 14, strokeColor: "#868e96" },
    { type: "text", x: mx + w - 110, y: my + h + 8, text: "Effort cao →", fontSize: 14, strokeColor: "#868e96" },
    { type: "text", x: mx + 8, y: my + h + 8, text: "← Effort thấp", fontSize: 14, strokeColor: "#868e96" },
    stickyRectSkeleton({ x: mx + 30, y: my + 40, width: 220, height: 110, ...CONVERGING, text: "Ưu tiên ngay\nXem lương trong ngày" }),
    stickyRectSkeleton({ x: mx + w - 250, y: my + 40, width: 220, height: 110, ...CONVERGING, text: "Lên kế hoạch\nXếp ca thông minh tự động" }),
    stickyRectSkeleton({ x: mx + 30, y: my + h - 150, width: 220, height: 110, background: "#f1f3f5", stroke: "#adb5bd", text: "Làm khi rảnh\nHuy hiệu đi làm đúng giờ" }),
    stickyRectSkeleton({ x: mx + w - 250, y: my + h - 150, width: 220, height: 110, background: "#f1f3f5", stroke: "#adb5bd", text: "Bỏ qua\nChấm công bằng giọng nói" })
  );
  cursorY = my + h + 60;
}

// 11 — Dot voting
heading("🔴 Dot Voting — mỗi người có số chấm giới hạn");
addGrid(
  [
    { text: "🔴🔴🔴🔴🔴\nXếp ca thông minh + thông báo (5 phiếu)", ...CONVERGING },
    { text: "🔴🔴🔴\nXem lương trong ngày (3 phiếu)", ...CONVERGING },
    { text: "🔴🔴\nTính lương minh bạch cuối tháng (2 phiếu)", ...CONVERGING },
    { text: "🔴\nQuản lý nhân viên (1 phiếu)", ...CONVERGING },
  ],
  { cols: 4, width: 230 }
);

/**
 * Demo scene showing all 11 brainstorm techniques applied to the Wokki PRD —
 * loaded once as the whiteboard's initial content so an agent-driven or
 * manual session opens on concrete worked examples instead of a blank canvas.
 */
export const WOKKI_DEMO_ELEMENTS = convertToExcalidrawElements(skeleton);
