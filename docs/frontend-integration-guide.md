# Frontend Integration Guide — AI Brainstorm Room

> Đối tượng: đội FE xây UI thật cho giáo viên. Tài liệu này tổng hợp API/SSE contract đã
> **implement và verify bằng code** (không phải chỉ trên giấy), đọc trực tiếp từ `src/` tại
> thời điểm cập nhật:
> - `plans/260725-1400-tts-sentence-streaming` — audio phát theo từng câu, sync với text.
> - `plans/260726-1500-teacher-auth-cloud-sync` — teacher/room/session domain model + header
>   định danh.
> - Các thay đổi sau đó: artifact `report` → **`prd`** (kèm gate theo phase), thêm `audioMode`
>   cho turn, xoá `PATCH /voice`, thêm route filler audio, siết Origin/Host guard.
>
> Backend chỉ bind `127.0.0.1` (xem "Bảo mật" ở cuối) — FE chạy same-origin hoặc origin được
> whitelist trong `BRAINSTORM_ALLOWED_ORIGINS`, không có gateway public.

## 1. Tổng quan luồng sản phẩm

```
1. Giáo viên nhập code + tên  → POST /teachers  → lưu teacherId (localStorage)
2. Giáo viên tạo/chọn Room    → POST /rooms  (list bằng GET /rooms)
3. Giáo viên tạo Session      → POST /rooms/:roomId/sessions
4. Vòng lặp brainstorm:
     - Nhóm nói / nhập text   → POST /sessions/:sessionId/turns  (SSE response)
     - FE render text-delta + phát agent-audio-chunk theo thứ tự
5. Kết thúc (bắt buộc theo thứ tự này):
     - POST /sessions/:sessionId/prd            → sinh PRD (chỉ khi phase = wrap-up), đóng session
     - POST /sessions/:sessionId/landing-page   → sinh landing page (yêu cầu đã có PRD)
     - POST /sessions/:sessionId/pitch-deck     → sinh pitch deck  (yêu cầu đã có PRD)
```

Tất cả endpoint sản phẩm nằm dưới `API_PREFIX = /api/v1/brainstorm`. **Ngoại lệ** (không có
prefix): `GET /health`, `GET /fillers`, `GET /fillers/:file`, `GET /demo`. Bốn route này vẫn
dùng envelope chuẩn như mọi route khác — chúng chỉ khác ở chỗ không có prefix. (`GET /demo` và
`GET /fillers/:file` trả file, không trả JSON.)

> **Breaking change.** `GET /health` và `GET /fillers` trước đây trả body trần
> (`{ ok: true }`, `{ fillers: [...] }`) và lỗi của `/fillers/:file` trả `{ error: "not_found" }`
> — tức `error` là **string**, nên client đọc `body.error.code` nhận `undefined` và `body.message`
> không tồn tại. Nay cả bốn đều dùng `apiOk`/`apiError`: đọc `body.data.fillers` thay vì
> `body.fillers`, và `body.error.code` thay vì `body.error`.

Response envelope chuẩn cho mọi request dưới `API_PREFIX` (không phải SSE) — **kể cả 201 và
kể cả các GET trả danh sách**, mảng luôn nằm trong `data`:

```ts
// success
{ isSuccess: true, message: string, data: T }
// error
{ isSuccess: false, message: string, error: { code: string, recoverable: boolean } }
```

Trong tài liệu này, phần `→ {...}` ở mỗi route mô tả **nội dung `data`**, không phải toàn bộ body.

## 2. Định danh giáo viên (KHÔNG phải xác thực)

`X-Teacher-Id` chỉ là nhãn để gán tác giả (attribution) và định tuyến đường dẫn cloud. Backend
**không** hash, không JWT, không hết hạn, không thu hồi. Bất kỳ ai chạm được cổng loopback đều
có thể gửi bất kỳ id nào. Đừng thiết kế UI như thể đây là đăng nhập bảo mật — nó chỉ là "ai đang
thao tác" trên một máy cục bộ dùng chung.

### `POST /teachers`

```
Body: { code: string, name: string }        // code ≤64 bytes; thừa field lạ → 422 invalid_teacher
201 → { teacherId, code, name, createdAt, isNew: true }    // code chưa tồn tại → tạo mới
200 → { teacherId, code, name, createdAt, isNew: false }   // code đã tồn tại → đăng nhập lại
422 invalid_code | invalid_name | invalid_teacher
```

Route này là **login-or-register**: `code` chính là danh tính của giáo viên (mỗi giáo viên một mã
duy nhất, dùng lâu dài). Gửi lại đúng `code` cũ sẽ trả về **đúng `teacherId` cũ** — đây là cách
khôi phục khi giáo viên xoá `localStorage` hoặc chuyển sang thiết bị/trình duyệt khác. Không còn
`409 teacher_code_taken`.

**Lưu ý cho FE**:
- Khi `isNew: false`, `name` trả về là **tên đã đăng ký**, không phải tên vừa gõ (đăng nhập không
  ghi đè tên, vì tên đó đã hiển thị trên các room/session cũ). Hãy hiển thị `data.name` từ response
  thay vì giá trị trong ô input.
- Không có mật khẩu: ai biết `code` đều đăng nhập được. Đây là chủ ý — xem §2 ở trên, đây là định
  danh chứ không phải xác thực, và `GET /rooms` vốn đã công khai `ownerTeacherId` của mọi giáo viên.

### `GET /teachers`
```
200 → [{ code, name, createdAt }, ...]      // loại trừ hàng hệ thống `__legacy__`
```
Không kèm `teacherId` — **không phải vì bảo mật** (xem §7: `GET /rooms` phát `ownerTeacherId` của
mọi giáo viên mà không cần header), chỉ vì không client nào cần id từ endpoint này. Đừng viết copy
UI kiểu "id được giấu để bảo vệ tài khoản".

### Header bắt buộc trên các route ghi (write)

`X-Teacher-Id: <teacherId uuid>` bắt buộc trên:
`POST /rooms`, `POST /rooms/:roomId/sessions`, `POST /sessions/:id/turns`,
`POST /sessions/:id/prd`, `POST /sessions/:id/landing-page`, `POST /sessions/:id/pitch-deck`.

Hai route cloud-sync (`GET /cloud-sync/status`, `POST /cloud-sync/retry`) **không** cần header,
kể cả `POST` — chúng là thao tác khắc phục sự cố cục bộ.

Lỗi có thể gặp (FE nên map thành thông báo UI rõ ràng, không phải "lỗi chung chung"):

| HTTP | code | Ý nghĩa | FE nên làm gì |
|------|------|---------|----------------|
| 401 | `teacher_required` | Thiếu header | Chưa đăng ký/chọn giáo viên → điều hướng về bước 1 |
| 422 | `invalid_teacher_id` | Header không phải UUID | Bug FE — kiểm tra lại giá trị lưu |
| 404 | `teacher_not_found` | teacherId không tồn tại (VD DB bị reset) | Xoá `teacherId` cục bộ, yêu cầu đăng ký lại |

**Không cần header** trên bất kỳ `GET` nào, kể cả các route trả file mở trực tiếp trong
tab/iframe: `GET /sessions/:id/prd`, `GET /sessions/:id/landing-page`,
`GET /sessions/:id/pitch-deck/html`, `GET /sessions/:id/pitch-deck/pdf` (trình duyệt không
gắn được custom header khi điều hướng URL trực tiếp).

## 3. Room & Session

### `POST /rooms` — header bắt buộc
```
Body: { name: string }   // 1-200 bytes, không control character; field lạ → 422 invalid_room
201 → { roomId: "rm_<uuid>", name, ownerTeacherId, createdAt }
422 invalid_name | invalid_room
```
Lưu ý: `roomId` luôn có tiền tố `rm_` — đây là id-space riêng biệt với `sessionId` (uuid trần).
Không bao giờ dùng `roomId` ở chỗ API mong đợi `sessionId` và ngược lại.

### `GET /rooms` — không cần header
```
200 → [{ roomId, name, ownerTeacherId, ownerName, createdAt }, ...]
```
Danh sách **tất cả** room trên instance (không lọc theo teacher hiện tại) — vì đây là công cụ
1 máy cục bộ dùng chung, lọc sẽ chỉ tạo ra danh sách rỗng gây khó hiểu nếu giáo viên đổi code.
Loại trừ room hệ thống (`Legacy`).

### `POST /rooms/:roomId/sessions` — header bắt buộc
```
Body: { name: string }
201 → { sessionId, voiceId, engineStep, phaseKey, state, transcript, activeTurn, roomId, name }
422 invalid_room_id | invalid_name | invalid_session
404 room_not_found
502 facilitator_start_failed   // Claude CLI process không khởi động được
```
Đây là **cách duy nhất** để tạo session — route cũ `POST /sessions` (không có room) đã bị xoá
hẳn, không phải deprecate. Backend khởi động facilitator **trước** khi ghi row session, nên khi
gặp `502 facilitator_start_failed` thì không có session rác nào được tạo — FE cứ cho người dùng
bấm tạo lại.

### `GET /rooms/:roomId/sessions` — không cần header
```
200 → [{ sessionId, name, status, phaseKey, createdAt }, ...]  // mới nhất trước
422 invalid_room_id | 404 room_not_found
```
`status` là trạng thái vòng đời của session (`wrapped` = đã sinh PRD, không nhận turn mới nữa) —
khác với `state` (`idle`/`processing`) trong snapshot bên dưới, vốn chỉ nói về turn đang chạy.

### `GET /sessions/:sessionId` — snapshot đầy đủ, không cần header
```ts
{
  sessionId, voiceId: "default",
  engineStep: number,          // 0-7, dùng để highlight node trong sơ đồ engine nếu FE có UI đó
  phaseKey: 'framing'|'diverging'|'shifting'|'critiquing'|'converging'|'wrap-up',
  state: 'idle' | 'processing',
  transcript: PublicMessage[], // lịch sử hội thoại công khai
  activeTurn: {
    turnId, clientTurnId, status, userMessageId, assistantMessageId, lastSeq
  } | null
}
```
Dùng route này để **khôi phục UI sau khi F5 hoặc mất kết nối giữa chừng** — không có API resume
SSE riêng, chỉ có polling/snapshot lại toàn bộ trạng thái.

Lưu ý về `activeTurn`: nếu không có turn nào đang chạy, backend vẫn trả về turn `interrupted`
gần nhất (nếu có) để FE biết lượt trước bị đứt — lúc đó `state` vẫn là `idle`. Tức
`activeTurn !== null` **không** đồng nghĩa với "đang bận"; hãy đọc `state` để quyết định
enable/disable input.

### `PATCH /sessions/:sessionId/voice` — **đã bị xoá**

Route này không còn tồn tại (gọi vào sẽ nhận `404 route_not_found`). Nó chỉ validate rồi echo lại
đúng giá trị `"default"` mà không lưu gì cả. Hiện hệ thống chỉ có một giọng; `voiceId` trong
snapshot luôn là `"default"` và là read-only với FE.

## 4. Gửi lượt nói — `POST /sessions/:sessionId/turns` (SSE)

Header bắt buộc. Body:
```ts
{
  clientTurnId: string,   // ≤128 bytes, do FE tự sinh, idempotency key
  text: string,           // ≤12000 bytes, không được rỗng/toàn khoảng trắng
  audioMode?: 'streaming' | 'standard' | 'text',   // mặc định 'streaming'
}
```
Field lạ ngoài 3 cái trên → `422 invalid_turn`.

### `audioMode` — chọn cách sinh audio cho lượt này

| Mode | Hành vi | Khi nào dùng |
|------|---------|--------------|
| `streaming` (mặc định) | TTS theo từng câu **ngay trong lúc** Claude sinh text; audio chunk tới xen kẽ `text-delta` | Mặc định — time-to-first-audio thấp nhất |
| `standard` | Một lần gọi TTS cho toàn bộ câu trả lời, phát **sau** `text-done` | Khi endpoint streaming của sidecar chập chờn; chỉ 1 chunk lớn |
| `text` | Không gọi TTS, không có `agent-audio-chunk` nào | Chế độ đọc thầm / môi trường không loa |

Ở cả 3 mode, `agent-audio-done` vẫn được phát ở cuối turn (kể cả `text`) — đừng dùng nó để suy ra
"có audio hay không".

**`clientTurnId` là khoá idempotency** — nếu FE gửi lại đúng `clientTurnId` (VD do mạng
timeout rồi retry), backend trả lại kết quả turn cũ thay vì tạo turn mới:
- Nếu turn cũ đã `completed` → HTTP 200 + `data: { operation, snapshot }` (JSON thường, không
  phải SSE) — FE nên kiểm tra `content-type` của response, thấy không phải `text/event-stream`
  thì xử lý như "đã xong rồi" và render từ `snapshot`.
- Nếu đang `processing`/`accepted` → HTTP 409 `turn_in_progress`. **Body 409 này có cả
  `error` lẫn `data: { operation, snapshot }`** (`isSuccess: false`) — FE vẫn dùng được
  `snapshot` để đồng bộ UI, nhưng phải discriminate bằng `isSuccess`, không phải bằng "có
  `data` hay không".
- Nếu `interrupted` → HTTP 409 `turn_interrupted, recoverable:true` — FE phải sinh
  **`clientTurnId` mới** để thử lại, gửi lại cùng id sẽ luôn bị kẹt.
- Nếu `failed` → HTTP 409 `turn_failed, recoverable:true`, body cũng có
  `data: { operation, snapshot }`. Giống `turn_interrupted`: FE phải sinh **`clientTurnId` mới**.
  (Trước đây trường hợp này rơi vào `turn_in_progress`, tức FE bị báo "turn đang chạy" vĩnh viễn
  cho key đó, trong khi `GET /sessions/:id` lại báo `state: 'idle'` — hai câu trả lời mâu thuẫn.
  Nay `GET /sessions/:id` cũng trả turn `failed` đó trong `activeTurn`, `state` vẫn là `'idle'`
  vì không có gì đang chạy.)

Lỗi trước khi vào SSE:

| HTTP | code | Ý nghĩa |
|------|------|---------|
| 422 | `invalid_session_id` | sessionId không phải UUID |
| 404 | `session_not_found` | — |
| 409 | `session_wrapped` | Session đã đóng sau khi sinh **PRD** — không nhận turn mới nữa |
| 422 | `invalid_turn` | Thiếu/sai `clientTurnId`, `text`, hoặc `audioMode` không hợp lệ |
| 413 | `input_too_large` | Vượt 12000 bytes text hoặc 128 bytes clientTurnId |
| 500 | `operation_create_failed` | Lỗi ghi SQLite cục bộ — không phải lỗi tạm, retry không giúp |

Một room chỉ xử lý 1 operation tại một thời điểm (kể cả sinh PRD/landing/deck) — nhưng khác với
bản trước, `room_busy` giờ **không còn là lỗi trước khi vào SSE nữa**: turn được backend nhận
(operation đã tạo, stream `200` đã mở) trước khi nó phát hiện room đang bị khoá bởi một request
artifact khác. Trường hợp hiếm này giờ tới dưới dạng **event `error` trong stream** (`room_busy`,
`recoverable: true`, xem bảng ở mục kế tiếp), không phải `409` JSON như trước. FE vẫn nên disable
nút gửi cho tới khi nhận `state: idle`, nhưng phải xử lý `room_busy` ở cả hai chỗ: khi đọc SSE event
(luồng chính hiện nay) và — vẫn còn tồn tại — khi gọi `POST /sessions/:id/prd|landing-page|pitch-deck`
lúc một turn đang chạy (route đó trả `409 room_busy` trước khi có body, không đổi).

### SSE event contract (khi request thành công, response là `text/event-stream`)

Mỗi event có payload dạng:
```ts
{ sessionId, turnId, seq, ts, data: {...} }   // seq tăng dần, dùng để order/dedupe nếu cần
```

Thứ tự event thực tế trong 1 turn thành công:

```
state            { state: "processing" }
engine-step      { step: 0, focusNodeId: "observer" }
agent-run-started{ messageId, replyToMessageId }
engine-step      { step: 1, focusNodeId: "analyzer" }
state            { state: "agent-speaking" }        // ngay khi có delta đầu tiên
engine-step      { step: 2, focusNodeId: "diagnosis" }
text-delta       { messageId, delta }               // lặp lại nhiều lần khi Claude sinh text
agent-audio-chunk{ messageId, encoding: "audio/wav", audioBase64 }  // audioMode=streaming: xen kẽ
                                                                     // với text-delta, KHÔNG đợi
                                                                     // hết text mới có audio
... (lặp text-delta / agent-audio-chunk theo từng câu) ...
engine-step      { step: 3, focusNodeId: "thinking-state" }
engine-step      { step: 4, focusNodeId: "technique" }
                 // engine-step 5 ("facilitate") CHỈ xuất hiện ở nhánh hiếm: Claude không sinh
                 // delta nào, backend phát bù state:agent-speaking + step 5 tại đây.
text-done        { messageId, text, phaseKey }       // toàn văn cuối cùng + phase mới
agent-audio-chunk (câu cuối/tail với streaming, hoặc toàn bộ reply với audioMode=standard)
agent-audio-done { messageId }                       // hết audio của turn này (mọi audioMode)
engine-step      { step: 6, focusNodeId: "trace" }
state            { state: "idle" }
engine-step      { step: 7, focusNodeId: "insight" }
done             [DONE]                              // event kết thúc stream, payload KHÔNG phải JSON
```

`focusNodeId` theo thứ tự step 0→7: `observer`, `analyzer`, `diagnosis`, `thinking-state`,
`technique`, `facilitate`, `trace`, `insight`.

**Event `done` kết thúc stream**: khác mọi event khác, `data` của nó là chuỗi literal `[DONE]`,
không phải JSON — FE parse SSE phải bỏ qua/đặc-cách event này, đừng `JSON.parse` mù quáng.

**Điểm quan trọng nhất cho FE audio player**: với `audioMode: 'streaming'`, `agent-audio-chunk`
bắt đầu tới **trong lúc**
`text-delta` vẫn đang chảy, không phải sau `text-done`. Mỗi chunk là 1 file WAV độc lập, hoàn
chỉnh, đã coalesce ≥0.5s — phát tuần tự theo đúng thứ tự nhận được (không interleave), không
overlap. Pattern khuyến nghị (đã dùng trong `public/demo.html`):

```js
let queue = [], playing = false;
function enqueueAudioChunk(base64) {
  const url = URL.createObjectURL(base64ToBlob(base64, 'audio/wav'));
  queue.push(url);
  playNextIfIdle();
}
function playNextIfIdle() {
  if (playing || !queue.length) return;
  playing = true;
  const url = queue.shift();
  audioEl.src = url;
  audioEl.onended = () => { URL.revokeObjectURL(url); playing = false; playNextIfIdle(); };
  audioEl.play();
}
```

### Error event trong lúc SSE đang chạy

```ts
error { code: string, recoverable: boolean }   // event name = "error"
```

Năm case:
- `code: "audio_unavailable", recoverable: true` — TTS sidecar lỗi/timeout/không chạy. **Turn
  vẫn hoàn tất bình thường** (`text-done`, `state: idle` vẫn tới) — chỉ mất audio, KHÔNG coi
  đây là turn fail. FE nên hiển thị "không có audio cho lượt này" chứ không phải lỗi đỏ toàn màn
  hình. (Backend đã tự retry 1 lần khi sidecar bận trước khi phát event này.)
- `code: "audio_truncated", recoverable: true` — audio bị **cắt giữa chừng**, phần còn lại của
  lượt sẽ không được đọc. Hai nguyên nhân: vượt trần 32 MiB audio/turn, hoặc client không kịp
  đọc stream (backpressure — tab bị throttle, mạng chậm). Text vẫn hoàn tất đầy đủ. FE nên báo
  nhẹ "audio bị ngắt, xem phần chữ" — và lưu ý đây là tín hiệu client đang tiêu thụ chậm.
- `code: "room_busy", recoverable: true` — race hiếm: một request sinh artifact (PRD/landing/deck)
  đã giữ khoá room cho session này đúng lúc turn cố giành lại khoá đó. Turn đã được backend nhận
  (operation `accepted`, stream đã mở `200`) trước khi phát hiện ra, nên lỗi này tới **giữa
  stream** thay vì `409` trước khi mở — khác bản tài liệu cũ. Sau event này có `state: idle` rồi
  SSE đóng; FE gửi lại được ngay (cùng hoặc `clientTurnId` mới đều được, vì operation này coi như
  `failed`).
- `code: "turn_failed", recoverable: false` — turn thật sự lỗi giữa chừng (VD Claude trả private
  state hỏng). Sau event này sẽ có `state: idle` rồi SSE đóng — FE cho phép gửi turn mới (với
  `clientTurnId` mới) ngay sau đó.
- `code: "client_disconnected", recoverable: true` — nhãn lịch sử, **không còn nghĩa là "client
  mất kết nối"**: từ bản turn-runner này, việc trình duyệt đóng kết nối SSE giữa chừng không còn
  huỷ turn nữa (xem "Việc FE cần tự làm cho robust" bên dưới) — nó chỉ dừng audio của riêng
  subscriber đó. Code này giờ chỉ phát khi backend tự huỷ turn vì lý do nội bộ (hết thời hạn chạy,
  mất quyền sở hữu lease vào tay một tiến trình khác, hoặc server đang shutdown) — FE hiếm khi gặp,
  và không nên coi đây là dấu hiệu "kết nối của tôi bị đứt".

### Việc FE cần tự làm cho robust

- **Đóng kết nối SSE (F5, mất mạng, đóng tab) không còn huỷ turn.** Turn chạy trong một tiến
  trình nội bộ độc lập với request HTTP đã mở nó — backend vẫn spawn Claude, sinh xong text, và
  ghi kết quả xuống DB dù không còn ai đọc stream. Việc đóng kết nối chỉ dừng phát audio cho
  riêng kết nối đó (và dừng hẳn TTS của turn nếu đó là subscriber cuối cùng); nó **không** đánh
  dấu turn `interrupted` như trước. `activeTurn.status = 'interrupted'` giờ chỉ xuất hiện khi
  server bị tắt/restart giữa chừng (turn thật sự chưa kịp chạy xong khi tiến trình dừng), không
  còn xuất hiện chỉ vì trình duyệt F5.
- **Không có resume/replay SSE riêng.** Nếu kết nối SSE đứt giữa chừng, FE gọi lại
  `GET /sessions/:sessionId` để lấy snapshot mới nhất (`activeTurn.status`,
  `activeTurn.lastSeq`) rồi tự quyết định UI — không có event "catch-up" nào phát lại các sự
  kiện đã bỏ lỡ. Turn vẫn tiếp tục chạy phía sau dù FE không còn nghe được các event của nó;
  poll `GET /sessions/:sessionId` cho tới khi `state` trở lại `idle` để biết khi nào xong.
- Disable input trong khi `state !== 'idle'` — không có hàng đợi turn ở server, gửi turn thứ 2
  (với `clientTurnId` khác) khi turn trước chưa xong sẽ nhận `409 turn_in_progress`, không phải
  `room_busy`.
- `agent-audio-chunk` có thể **không bao giờ tới** nếu sidecar TTS chưa chạy — đây là hành vi
  fallback hợp lệ (xem `audio_unavailable` ở trên), không phải bug. Tương tự khi
  `audioMode: 'text'`.
- **Đọc stream liên tục.** Nếu FE để buffer dồn (>8 MiB chưa đọc), backend chủ động bỏ phần
  audio còn lại của turn và phát `audio_truncated`. Đừng chặn vòng đọc SSE bằng công việc nặng
  đồng bộ ở main thread.

### Filler audio trong lúc chờ (tuỳ chọn)

Trong lúc Claude đang suy nghĩ (trước chunk audio đầu tiên) có thể phát tiếng đệm để tránh khoảng
lặng. Hai route này **không** có prefix `/api/v1/brainstorm`, nhưng vẫn dùng envelope chuẩn:

```
GET /fillers            → { isSuccess: true, message, data: { fillers: [{ name, url }] } }
                          // data.fillers = [] nếu thư mục trống
GET /fillers/:file      → audio/wav  (chỉ phục vụ file .wav)
                          // lỗi: 400 apiError('invalid_file'), 404 apiError('not_found')
```

Cách demo đang làm: random 1 filler khi bắt đầu turn, dừng ngay khi chunk audio **thật đầu tiên
được phát** (không phải khi nó vừa tới) — xem `public/demo.html`.

## 5. Artifact (PRD / landing page / pitch deck)

Cả 3 đều theo pattern: `POST` để sinh (header bắt buộc, đồng bộ — trả về khi xong, không SSE),
`GET` để đọc (không cần header, mở trực tiếp bằng URL).

**Có thứ tự bắt buộc**: PRD phải được sinh trước; landing page và pitch deck đều từ chối bằng
`409 prd_not_ready` nếu chưa có `prd.md`.

### `POST /sessions/:id/prd` (trước đây là `/report` — đã đổi tên hoàn toàn)

```
POST /sessions/:id/prd[?force=true]   → { prdUrl, generatedAt }
GET  /sessions/:id/prd                → text/markdown, kèm content-disposition: attachment
                                        (filename "brainstorm-prd.md") — trình duyệt sẽ TẢI VỀ,
                                        không render inline. Muốn hiện trong UI thì tự fetch rồi
                                        render, đừng trỏ iframe vào đây.
```

| HTTP | code | Ý nghĩa |
|------|------|---------|
| 409 | `phase_not_complete` | Session chưa tới phase `wrap-up`. Recoverable — xem ghi chú `force` |
| 409 | `prd_not_ready` | Chưa có nội dung để sinh (không có trace, hoặc đang có operation chạy dở); trên `GET` nghĩa là chưa sinh PRD |
| 409 | `room_busy` | Room đang bận việc khác |
| 502 | `prd_failed` | Sinh PRD thất bại |
| 422 | `invalid_session_id` / 404 `session_not_found` | — |

**`?force=true`** bỏ qua đúng một điều kiện: gate `phase_not_complete`. FE nên để nút chính
disabled cho tới khi `phaseKey === 'wrap-up'`, và chỉ mở `force` sau một hộp thoại xác nhận
("phiên chưa tới bước tổng kết, PRD có thể sơ sài").

Sinh PRD thành công sẽ **đóng session**: các turn mới sau đó bị từ chối với `409 session_wrapped`,
và `status` của session chuyển thành `wrapped`. FE nên coi "Tạo PRD" là hành động kết thúc phiên,
cảnh báo giáo viên trước khi bấm.

### `POST /sessions/:id/landing-page`

```
POST /sessions/:id/landing-page  → { landingPageUrl }
GET  /sessions/:id/landing-page  → HTML mở trực tiếp trong tab/iframe (KHÔNG cần header)
409 prd_not_ready | 409 room_busy | 502 landing_page_failed
409 artifact_not_ready   // trên GET khi chưa sinh
```

### `POST /sessions/:id/pitch-deck`

```
POST /sessions/:id/pitch-deck    (không có body)
                                 → { htmlUrl, exportUrl }
GET  /sessions/:id/pitch-deck/html      → HTML xem trực tiếp (KHÔNG cần header)
GET  /sessions/:id/pitch-deck/pdf       → file PDF export
409 prd_not_ready | 409 room_busy | 502 pitch_deck_failed
409 artifact_not_ready   // trên GET khi chưa sinh
```

Chỉ xuất PDF — không còn PPTX. Model author trực tiếp `deck.html` (giống `landing-page`), backend
chỉ chạy Puppeteer để in ra `deck.pdf`, không còn bước dựng HTML từ schema JSON trung gian.

Render deck chạy Puppeteer và có deadline **180 giây**; trong suốt thời gian đó room bị khoá nên
mọi route sinh artifact khác sẽ nhận `409 room_busy` (còn `POST .../turns` nhận `room_busy` dưới
dạng SSE event như mô tả ở mục 4). FE nên hiển thị progress/disable UI cho
toàn phòng, không chỉ nút deck, và đặt HTTP timeout của client > 180s.

Cả hai route HTML (`landing-page`, `pitch-deck/html`) được trả kèm
`content-security-policy: sandbox` — nội dung do model sinh chạy trong sandbox, nên nhúng bằng
`<iframe>` là an toàn nhưng script/liên kết bên trong sẽ bị vô hiệu hoá.

## 6. Cloud sync — chỉ để hiển thị trạng thái, không phải tính năng tương tác

Session đã hoàn tất turn sẽ tự động đồng bộ (một chiều, ghi-only) lên Firebase Cloud Storage ở
background — FE không cần gọi gì để kích hoạt việc này. Hai route sau chỉ để **quan sát/khắc
phục sự cố**, không cần header:

```ts
GET  /cloud-sync/status  → {
  counts: Record<string, number>,
  failed: Array<{
    id, sessionId,
    kind: 'trace' | 'metadata' | 'prd' | 'landing' | 'pitch',
    attempts: number,
    lastError: { code: string, hint: string } | null,   // OBJECT, không phải string
    updatedAt: string,
  }>,
}
POST /cloud-sync/retry   → { requeued: number }   // đẩy lại các bản ghi đã dead-letter (>10 lần thử)
```

`lastError.code` ∈ `upload_timeout` | `permission_denied` | `source_missing` |
`network_unavailable` | `upload_failed`; `hint` là câu tiếng Anh ngắn, an toàn để hiển thị (đã
lọc bỏ tên bucket/đường dẫn/service-account khỏi thông báo gốc). FE nên map `code` sang tiếng
Việt của mình thay vì in thẳng `hint`.

Gợi ý UI: 1 icon nhỏ/badge trạng thái đồng bộ (VD "Đã lưu cloud" / "Đang đồng bộ" / "Lỗi đồng
bộ, X bản ghi") ở góc màn hình giáo viên, không cần chặn luồng chính. Dữ liệu cloud là bản
mirror ghi-only — **không có API đọc lại từ cloud vào app**, local SQLite luôn là nguồn sự thật.

## 7. Bảo mật — điều FE phải hiểu đúng

- Backend + TTS sidecar chỉ bind `127.0.0.1`. Không có tầng xác thực nào khác ngoài việc chạy
  trên localhost.
- `X-Teacher-Id` là **định danh, không phải xác thực**. Đừng build UI kiểu "đăng nhập/đăng xuất
  bảo mật" — nó gần với "chọn hồ sơ đang dùng" hơn. Không hiển thị copy như "bảo vệ dữ liệu của
  bạn bằng mã này". `GET /rooms` trả `ownerTeacherId` của mọi giáo viên mà không cần header —
  id này công khai theo thiết kế.
- Không lưu thông tin nhạy cảm thật (mật khẩu, dữ liệu cá nhân định danh) vào trường `name`
  (teacher/room/session) — các giá trị này được publish nguyên văn lên cloud JSON.

### Origin / Host guard — FE dev server phải nằm trong allowlist

Mọi request đều đi qua một hook kiểm tra trước khi tới route:

| HTTP | code | Khi nào |
|------|------|---------|
| 403 | `forbidden_host` | Header `Host` không thuộc `127.0.0.1` / `localhost` / `[::1]` (±`:PORT`). Chống DNS rebinding — một hostname trỏ về 127.0.0.1 vẫn bị chặn |
| 403 | `forbidden_origin` | Request **có** `Origin` không nằm trong allowlist và method khác `GET`/`OPTIONS` |
| 404 | `route_not_found` | Không khớp route nào |

Allowlist mặc định: `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:5173`,
`http://127.0.0.1:5173` — đổi bằng env `BRAINSTORM_ALLOWED_ORIGINS` (danh sách origin chuẩn hoá,
phân tách bằng dấu phẩy). Origin của chính backend (`:3001` mặc định) luôn được chấp nhận.

Header CORS trả về chỉ cho phép `content-type, accept, x-teacher-id` và method
`GET, POST, PATCH, OPTIONS`. Nếu FE thêm header custom khác (VD `x-request-id`) preflight sẽ hỏng.

`GET /health` → `{ isSuccess: true, message: "OK", data: { ok: true } }` — dùng để FE kiểm tra
backend đã chạy chưa.

## 8. Chưa làm / có thể cần thêm (đừng giả định đã có)

- **Không có route tra cứu `teacherId` theo `code`** sau khi mất `localStorage`. Cách duy nhất
  hiện có là dò `ownerTeacherId` trong `GET /rooms` (chỉ được nếu giáo viên đó đã từng tạo
  room). Nếu sản phẩm cần "đăng nhập lại trên máy khác/sau khi xoá cache" một cách đàng hoàng,
  đây là việc cần làm thêm ở backend.
- **Chỉ có 1 giọng đọc** (`voiceId: "default"`) và không còn route đổi giọng.
- **Không có route xoá/sửa** teacher, room hay session — UI đừng vẽ nút xoá.
- **Không có API huỷ turn đang chạy.** Đóng kết nối SSE (abort fetch) **không còn** dừng được
  turn — nó chỉ dừng audio phía client đó, turn vẫn tiếp tục chạy và ghi kết quả xuống DB. Hiện
  không có cách nào từ phía FE để thật sự huỷ một turn đã được backend nhận.
- **Không có SSE reconnect/replay.** Nếu cần trải nghiệm mượt hơn khi rớt mạng giữa turn, đó là
  việc cần thiết kế thêm (hiện chỉ có snapshot polling).
- **Không có phân quyền theo giáo viên** trên `GET /rooms` (mọi giáo viên thấy mọi room) — đây
  là quyết định có chủ đích (xem plan 2), không phải thiếu sót, nhưng FE cần biết để không giả
  định có "my rooms" filter ở tầng server.
- Manual verification (nghe thử audio thật, đo time-to-first-audio, test sidecar treo) của plan
  TTS **chưa được thực hiện** — về code thì đã xong, nhưng nếu audio nghe giật/trễ hơn kỳ vọng,
  đó là điều cần đo thực tế trước khi kết luận là bug FE.

## 9. Thay đổi phá vỡ so với bản tài liệu trước

Nếu FE đã code theo bản cũ, đây là danh sách cần sửa:

| Cũ | Mới |
|----|-----|
| `POST/GET /sessions/:id/report`, `{ reportUrl }` | `POST/GET /sessions/:id/prd`, `{ prdUrl, generatedAt }` |
| Sinh report bất cứ lúc nào | Chặn bằng `409 phase_not_complete` cho tới phase `wrap-up` (bỏ qua bằng `?force=true`) |
| Landing page / pitch deck độc lập | Cả hai yêu cầu đã có PRD, nếu không → `409 prd_not_ready` |
| pitch-deck `Body: { format: 'pptx' \| 'pdf' }`, `GET .../pitch-deck/:format` | Không còn body, không còn PPTX; `GET .../pitch-deck/pdf` cố định |
| `PATCH /sessions/:id/voice` | Đã xoá → `404 route_not_found` |
| Turn body chỉ có `clientTurnId`, `text` | Thêm `audioMode?: 'streaming' \| 'standard' \| 'text'` |
| SSE error chỉ có `audio_unavailable`, `turn_failed` | Thêm `audio_truncated`, `client_disconnected` |
| `cloud-sync/status.failed[].lastError` là string | Là object `{ code, hint }` hoặc `null` |
| Đóng kết nối SSE huỷ turn, đánh dấu `interrupted` | Turn chạy độc lập với request; đóng SSE chỉ dừng audio phía client đó, turn vẫn chạy tới khi xong |
| `room_busy` khi gửi turn luôn là `409` trước khi mở SSE | `room_busy` cho `POST .../turns` giờ tới dưới dạng **event `error` trong stream** (stream đã mở `200`); `409` trước-stream không còn xảy ra cho case này (route sinh artifact vẫn trả `409 room_busy` như cũ) |
| `client_disconnected` nghĩa là "kết nối bị đứt" | Code này giờ chỉ phát khi backend tự huỷ turn nội bộ (hết hạn chạy, mất lease, shutdown) — disconnect thật sự không còn kích hoạt nó |
