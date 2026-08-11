---
title: Backend drift + PRD/landing/deck "phải F5" bug — handoff cho FE
date: 2026-08-12
audience: brainstorm-fe team (feat/brainstorm)
compared: backend dev@de99134 (2026-07-31) vs brainstorm-fe feat/brainstorm@6dbd5ca (2026-08-12)
---

# Backend drift & artifact-generation UX bug — báo cáo gửi FE

## Tóm tắt

Hai vấn đề độc lập:

1. **Drift API** — 6 thay đổi backend từ 27/07 mà FE (dừng đụng `lib/api`/`hooks`/`types` từ
   28/07) chưa cập nhật. 1 mục blocking (voiceId), còn lại là drift âm thầm.
2. **Bug UX "phải F5 mới thấy artifact"** — không phải backend lỗi. Backend generate xong thật,
   nhưng response không tới được FE trước khi client-side timeout/disconnect, và FE không có cơ
   chế tự phục hồi sau lỗi — chỉ có khi remount (F5) mới đối chiếu lại với server.

Mỗi mục dưới đây có **Severity**, **Root cause**, và **Cần làm gì** — đủ để FE lên task trực tiếp.

---

## Phần 1 — Drift API (re-verify 12/08, không đổi so với lần trước)

| # | Severity | Vấn đề | Root cause | FE cần làm |
|---|----------|--------|------------|------------|
| 1 | 🔴 Blocking | `POST /rooms/:roomId/sessions` sẽ trả `422 invalid_voice_id` cho mọi request từ `feat/brainstorm` | Backend (`de99134`) bắt buộc `voiceId` trong body kể từ khi voice chuyển từ room-scope sang session-scope. `types/brainstorm-domain.ts`'s `CreateRoomSessionRequest` vẫn chỉ có `{ name }` | Thêm `voiceId: string` bắt buộc vào `CreateRoomSessionRequest`, truyền lên khi gọi `roomsApi.createSession` |
| 2 | 🟠 High | Không có cách nào lấy danh sách voice để hiển thị picker | `GET /api/v1/brainstorm/voices` (không cần header, public) tồn tại từ `de99134` nhưng chưa có client trong `lib/api/services` | Thêm `voicesApi.list()` gọi `GET voices`, trả `{ voiceId, label }[]` — hiện có 2 preset: `vi-female-01` ("Giọng nữ"), `vi-male-01` ("Giọng nam") |
| 3 | 🟠 High | Nút "hủy" turn (unmount/gửi turn mới) không thực sự hủy gì ở backend | Từ bản refactor turn-runner (`caf65fa`), turn chạy độc lập với request HTTP — client disconnect không hủy turn nữa. `useBrainstormSession.ts` vẫn `turnAbortRef.current?.abort()` giả định điều ngược lại | Bỏ giả định "abort = turn dừng". Sau khi abort, đừng gửi turn mới ngay — sẽ dính `409` vì room vẫn có 1 operation đang chạy. Đợi SSE resolve hoặc snapshot xác nhận `state: idle` trước khi cho phép turn kế tiếp |
| 4 | 🟡 Low | Comment trỏ tới file doc đã xóa | `docs/frontend-integration-guide.md` bị xóa ở backend (`e443d6f`), nội dung gộp vào `docs/system-architecture.md`/`docs/code-standards.md` | Cập nhật comment trong `teacher-header.ts`, `brainstorm-domain.ts` — không có code nào hỏng |
| 5 | 🟡 Low | Không có UI xem lại archive cũ | 4 endpoint `GET /teachers/:teacherId/archive[...]` (cloud/local archive) có từ `e443d6f`, chưa có client FE | Không gấp — chỉ cần biết endpoint đã sẵn sàng khi FE làm tính năng archive |
| 6 | 🟡 Low | Filler audio không chọn được theo phase/voice | `GET /fillers` trả thêm `phase`/`voiceId` mỗi item từ `de99134`. `BrainstormFillerAsset` type vẫn `{ name, url }` | Thêm `phase?: string`, `voiceId?: string` vào type; dùng để chọn filler đúng giọng/đúng phase thay vì random |
| 7 | ✅ No-op | — | `PATCH /sessions/:id/voice` đã bị xóa ở backend, xác nhận FE không gọi endpoint này | Không cần làm gì |

---

## Phần 2 — Bug: generate PRD/landing page/deck báo lỗi, F5 mới thấy kết quả thật

### Triệu chứng
Giáo viên bấm "Tạo PRD"/"Tạo landing page"/"Tạo pitch deck" → UI báo lỗi (`prdError`/
`landingError`/`pitchError`) → nhưng F5 lại thì artifact đã có sẵn.

### Root cause (đã trace qua cả 2 phía)

**Backend** (`src/routes/sessionArtifacts.ts`): cả 3 route (`POST .../prd`, `.../landing-page`,
`.../pitch-deck`) là **một request HTTP đồng bộ, giữ nguyên trong `withRoomLock` cho tới khi xong
hẳn** — không có streaming, không có heartbeat, không gửi byte nào cho tới response cuối cùng.
Landing/deck có ngân sách tới `ARTIFACT_DEADLINE_MS = 900_000ms` (15 phút, gồm cả retry lint +
đo layout bằng Puppeteer). PRD không có deadline constant tường minh — chạy tới khi Claude CLI
viết xong `prd.md`.

**Frontend** (`lib/api/services/brainstormSession.ts` + `lib/api/core.ts`):
- `createLandingPage`/`createPitchDeck` set `timeout: ARTIFACT_GENERATION_TIMEOUT_MS = 900_000ms`
  — **khớp chính xác** với ngân sách backend, tức là gần như **không có margin**: bất kỳ độ trễ
  mạng/proxy nào cũng đủ để client timeout ngay trước hoặc đúng lúc backend xong.
- `createPrd` **không set timeout riêng** → dùng default của `ApiService` là `600_000ms` (10
  phút) — có thể ngắn hơn thời gian PRD thực sự cần nếu phiên dài/nhiều turn.
- Ngoài axios timeout, request còn đi qua Next.js rewrite proxy (`next.config.ts`,
  `/api/v1/brainstorm/:path* → BRAINSTORM_API_PROXY`). Nếu FE self-host qua `next start`, HTTP
  server của Node có `requestTimeout` mặc định 300s (5 phút, Node ≥18) — **ngắn hơn cả 2 timeout
  phía trên** — nên một request 6-15 phút hoàn toàn có thể bị chính lớp proxy cắt trước khi tới
  axios timeout. (Cần FE xác nhận cấu hình deploy thực tế để biết đây có phải nguyên nhân chính
  không — xem "Câu hỏi mở" cuối file.)
- Khi promise reject (timeout/network error), `useBrainstormArtifacts.ts`'s
  `runCreatePrd`/`createLandingPage`/`createPitchDeck` catch block **chỉ set error string**, không
  gọi lại `checkArtifactExists()` để xác nhận backend có thật sự thất bại hay không.
  `checkArtifactExists()` (HEAD request, đã có sẵn trong code) **chỉ chạy trong `useEffect` khi
  `sessionId` đổi** — tức là chỉ khi mount lại component (F5). Đó là toàn bộ lý do "F5 mới thấy".
- Hệ quả phụ: nếu giáo viên bấm lại nút ngay sau khi thấy lỗi, request gốc trong `withRoomLock`
  rất có thể **vẫn đang chạy** ở backend → request thứ hai ăn `409 room_busy` — càng củng cố cảm
  giác "bị lỗi" trong khi thực ra backend đang generate bình thường.

### Cần làm gì (FE, không cần đổi backend)

1. **Gọi `checkArtifactExists()` trong catch block** của cả 3 hàm (`runCreatePrd`,
   `createLandingPage`, `createPitchDeck`) trước khi set error state — nếu HEAD xác nhận artifact
   đã tồn tại, coi như thành công (ghi `localStorage`, không hiện lỗi) thay vì bắt người dùng F5.
2. **Tăng margin timeout phía client**: đặt timeout FE dài hơn ngân sách backend một khoảng an
   toàn (vd. backend 900s → FE 960-1000s), không đặt bằng nhau tuyệt đối như hiện tại.
3. **Set timeout tường minh cho `createPrd`** thay vì dùng default 600s của `ApiService` — PRD có
   thể cần chạy sát mức backend cho phép.
4. **Phân biệt lỗi timeout/network với lỗi nghiệp vụ thật** trong `formatArtifactError` — timeout
   nên hiện thông báo dạng "đang xử lý, đang kiểm tra lại..." + tự động gọi `checkArtifactExists`,
   không phải "Không tạo được — thử lại" như lỗi `prd_failed`/`artifact_rejected` thật.
5. **Chặn nút bấm lại ngay sau lỗi timeout** trong vài giây / cho tới khi `checkArtifactExists`
   trả lời — tránh ăn `409 room_busy` chồng lên request gốc còn đang chạy ngầm.

### Nếu muốn fix triệt để hơn (cần backend hỗ trợ — liệt kê để tham khảo, chưa làm)

- Backend cung cấp một GET "trạng thái generation" nhẹ (poll) hoặc SSE progress cho 3 route này,
  giống cách turn đã có SSE — để FE không phải đoán qua timeout + HEAD-check.
- Backend gửi ít nhất 1 byte/heartbeat sớm trong response để giữ kết nối "sống" qua các proxy
  trung gian có timeout ngắn.

---

## Câu hỏi mở (cho FE xác nhận)

1. `brainstorm-fe` production/staging deploy bằng `next start` (self-host) hay Vercel? Nếu
   self-host, đã override Node's `server.requestTimeout`/`headersTimeout` chưa? (quyết định mục
   "Root cause" phần proxy ở trên có phải nguyên nhân chính hay chỉ là rủi ro tiềm ẩn)
2. Có log/Sentry nào ghi lại đúng mã lỗi axios thực tế (timeout vs network error vs 409) khi bug
   này xảy ra không? Sẽ giúp xác nhận chính xác timeout nào (client 600s/900s hay proxy 300s) là
   nguyên nhân thường gặp nhất.
