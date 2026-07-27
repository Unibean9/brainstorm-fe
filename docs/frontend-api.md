# Frontend integration guide

Tài liệu này mô tả hợp đồng hiện tại giữa frontend và Brainstorm Room backend. Backend mặc định chạy tại `http://127.0.0.1:3001`; `/demo` là client tham chiếu cùng origin.

## Quy ước chung

- API prefix: `/api/v1/brainstorm`.
- Backend chỉ bind loopback, không có authentication.
- JSON thành công có dạng:

```json
{ "isSuccess": true, "message": "OK", "data": {} }
```

- Lỗi API có dạng:

```json
{
  "isSuccess": false,
  "message": "Human-readable message",
  "error": { "code": "machine_readable_code", "recoverable": false }
}
```

- `sessionId` là UUID. Nội dung một turn tối đa 12,000 UTF-8 bytes; `clientTurnId` tối đa 128 bytes.
- Khi gọi từ origin khác, dùng CORS origin đã cấu hình trong `BRAINSTORM_ALLOWED_ORIGINS`; `/demo` không cần CORS vì cùng origin.

## Luồng tổng quát

```text
POST /sessions
  → UI mở composer
  → POST /sessions/:id/turns (SSE)
     → text-delta / text-done
     → agent-audio (tuỳ TTS)
  → lặp lại cho đến khi đủ trace
POST /sessions/:id/report
  → room được đóng (wrapped)
  → POST landing-page và/hoặc pitch-deck
```

Không gửi turn mới sau khi report đã được tạo. Đừng mở nút tạo landing page/deck trước khi report thành công.

## 1. Health và assets âm thanh chờ

### `GET /health`

Kiểm tra backend có hoạt động.

```json
{ "ok": true }
```

### `GET /fillers`

Trả danh sách WAV local dùng làm **filler thinking**.

```json
{
  "fillers": [
    { "name": "filler_thinking_01.wav", "url": "/fillers/filler_thinking_01.wav" }
  ]
}
```

### `GET /fillers/:file`

Trả WAV với `Content-Type: audio/wav`. `..` hoặc đường dẫn tuyệt đối bị từ chối (`400`); file không tồn tại trả `404`.

### Hành vi frontend đề nghị

1. Tải `/fillers` một lần khi khởi tạo UI.
2. **Mặc định bật** âm thanh chờ (`checked`); cho người dùng một toggle để tắt.
3. Khi bắt đầu một turn đang xử lý, chọn ngẫu nhiên một item, gán `audio.src`, đặt `loop = true`, rồi `play()`.
4. Khi SSE kết thúc, lỗi, hoặc user tắt toggle, gọi `pause()`, đặt `currentTime = 0` và xoá `src`.
5. Nếu `play()` bị browser chặn bởi autoplay policy, giữ luồng text/TTS hoạt động; đây không phải lỗi của turn.

Filler thinking chỉ là âm thanh chờ, không phải câu trả lời nói của facilitator.

## 2. Session

### `POST /api/v1/brainstorm/sessions`

Tạo room và khởi động facilitator session.

Response `201`:

```json
{
  "isSuccess": true,
  "message": "OK",
  "data": {
    "sessionId": "uuid",
    "voiceId": "default",
    "engineStep": 0,
    "phaseKey": "framing",
    "state": "idle",
    "transcript": [],
    "activeTurn": null
  }
}
```

Lỗi `502/facilitator_start_failed` nghĩa là không thể khởi động Claude session; composer phải giữ disabled và cho phép thử tạo room lại.

### `GET /api/v1/brainstorm/sessions/:sessionId`

Lấy snapshot để hydrate/recover UI.

`data.transcript` là mảng message công khai:

```json
{
  "messageId": "uuid",
  "role": "user",
  "text": "Nội dung turn",
  "turnId": "uuid",
  "replyToMessageId": "uuid optional",
  "createdAt": "ISO-8601"
}
```

`data.state` là `idle` hoặc `processing`; `activeTurn` có `turnId`, `clientTurnId`, `status`, message IDs và `lastSeq` khi có lượt đang/chưa hoàn tất.

Lỗi: `422/invalid_session_id`, `404/session_not_found`.

### `PATCH /api/v1/brainstorm/sessions/:sessionId/voice`

Hiện chỉ chấp nhận voice cố định `default`.

Request:

```json
{ "voiceId": "default" }
```

Response `200`:

```json
{ "isSuccess": true, "message": "OK", "data": { "voiceId": "default" } }
```

Gửi voice khác nhận `422/unsupported_voice`.

## 3. Gửi turn và SSE

### `POST /api/v1/brainstorm/sessions/:sessionId/turns`

Headers:

```http
Content-Type: application/json
Accept: text/event-stream
```

Request:

```json
{
  "clientTurnId": "client-generated UUID or idempotency key",
  "text": "Nội dung do nhóm nhập hoặc STT tạo"
}
```

`clientTurnId` phải ổn định cho một lần submit: gửi lại cùng ID sau khi turn hoàn tất sẽ trả replay JSON thay vì chạy facilitator lần nữa.

Response thành công mới trả **SSE**. Không dùng `response.text()`; đọc `response.body` incremental với `TextDecoder`, gom record phân cách bởi dòng trống, rồi parse `event:` và JSON `data:`. Payload wire luôn có envelope; các payload ở bảng bên dưới là trường `data` bên trong envelope:

```json
{
  "sessionId": "uuid",
  "turnId": "uuid",
  "seq": 1,
  "ts": 1710000000000,
  "data": { "state": "processing" }
}
```

### SSE event contract

| Event | `data` | FE action |
| --- | --- | --- |
| `state` | `{ "state": "processing" \| "agent-speaking" \| "idle" }` | Khoá composer khi processing; cập nhật trạng thái; dừng filler khi idle. |
| `engine-step` | `{ "step": 0..7, "focusNodeId": "observer" \| ... }` | Tùy chọn: hiển thị trace/debug. Không dùng làm transcript. |
| `agent-run-started` | `{ "messageId", "replyToMessageId" }` | Tạo bubble facilitator đang chờ. |
| `text-delta` | `{ "messageId", "delta": "..." }` | Append `delta` vào cùng bubble đang stream. |
| `text-done` | `{ "messageId", "text", "phaseKey" }` | Chốt bubble, cập nhật phase. `phaseKey` là `framing`, `diverging`, `shifting`, `critiquing`, `converging`, hoặc `wrap-up`. |
| `agent-audio` | `{ "messageId", "encoding": "audio/wav", "audioBase64": "..." }` | Decode base64 thành `Blob(audio/wav)`, tạo object URL và render control Play/Pause/Replay. |
| `error` | `{ "code", "recoverable" }` | Xem bảng lỗi bên dưới. |

TTS không chặn text: turn vẫn hợp lệ khi server phát `error` với `code: "audio_unavailable"` và `recoverable: true`. Các lỗi terminal như `turn_failed` phải làm UI coi lượt thất bại; nếu stream kết thúc mà không có `text-done`, cũng coi là lỗi.

### Lỗi HTTP khi gửi turn

| Status/code | Frontend handling |
| --- | --- |
| `409/session_wrapped` | Đóng composer, hướng user sang artifacts. |
| `409/turn_in_progress` hoặc `409/room_busy` | Giữ draft text, thông báo room đang bận, cho retry với clientTurnId mới khi hợp lý. |
| `409/turn_interrupted` | Giữ draft và yêu cầu gửi lại với clientTurnId mới. |
| `422/invalid_turn` | Hiển thị lỗi validation cho input. |
| `413/input_too_large` | Yêu cầu rút ngắn text. |
| `404/session_not_found`, `422/invalid_session_id` | Quay lại tạo/chọn room. |
| `502/turn_failed` | Giữ draft; cho thử lại. |

## 4. TTS facilitator

Backend tự gọi TTS sidecar sau `text-done` và gửi kết quả bằng event `agent-audio`; không có HTTP endpoint audio riêng cho assistant reply.

Browser decode tham khảo:

```js
const binary = atob(audioBase64);
const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
```

Không autoplay mặc định. Nếu có preference autoplay, gọi `audio.play()` và xử lý promise rejection do browser policy. Luôn `URL.revokeObjectURL(url)` khi không còn dùng.

## 5. Browser speech-to-text (không gọi backend)

STT là progressive enhancement ở frontend, dùng:

```js
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
```

Thiết lập `lang = "vi-VN"`, `interimResults = true`, `continuous = false`. Transcript được điền vào textarea, sau đó user xác nhận/chỉnh rồi mới gọi endpoint turn.

- Khi browser không có API: disable micro và vẫn cho nhập text.
- Xử lý ít nhất `not-allowed`, `service-not-allowed`, `no-speech`, `audio-capture`, `network`.
- Không tự gửi khi `onend`.
- Khoá textarea trong lúc dictation để transcript tạm thời không ghi đè thao tác chỉnh tay; mở lại khi `onend`.
- Browser/service có thể không hỗ trợ hoặc yêu cầu quyền micro; đây không phải backend failure.

## 6. Report và artifacts

### Report

`POST /api/v1/brainstorm/sessions/:sessionId/report`

Chỉ gọi khi không có turn đang chạy và đã có trace. Response `200`:

```json
{
  "isSuccess": true,
  "message": "OK",
  "data": {
    "reportUrl": "/api/v1/brainstorm/sessions/:sessionId/report",
    "generatedAt": "ISO-8601"
  }
}
```

Sau thành công room trở thành `wrapped`.

`GET /api/v1/brainstorm/sessions/:sessionId/report` tải `text/markdown` với `Content-Disposition: attachment`.

`409/report_not_ready` nghĩa là chưa có trace hoặc turn đang chạy; `409/room_busy` là lock đang bận; `502/report_failed` là lỗi generation.

### Landing page

`POST /api/v1/brainstorm/sessions/:sessionId/landing-page` cần report tồn tại.

Response:

```json
{ "isSuccess": true, "message": "OK", "data": { "landingPageUrl": "/api/v1/brainstorm/sessions/:sessionId/landing-page" } }
```

`GET /api/v1/brainstorm/sessions/:sessionId/landing-page` trả HTML đã sandbox CSP. Chỉ render preview trong iframe cùng origin hoặc mở trang mới; không giả định script của artifact có full browser permission.

### Pitch deck

`POST /api/v1/brainstorm/sessions/:sessionId/pitch-deck`

```json
{ "format": "pdf" }
```

`format` chỉ là `pdf` hoặc `pptx`.

Response:

```json
{
  "isSuccess": true,
  "message": "OK",
  "data": {
    "htmlUrl": "/api/v1/brainstorm/sessions/:sessionId/pitch-deck/html",
    "exportUrl": "/api/v1/brainstorm/sessions/:sessionId/pitch-deck/pdf"
  }
}
```

- `GET .../pitch-deck/html`: HTML preview sandboxed.
- `GET .../pitch-deck/pdf` hoặc `/pptx`: file export với content type phù hợp.
- `422/invalid_format`, `409/report_not_ready`, `409/room_busy`, `502/pitch_deck_failed` cần hiển thị inline và cho retry phù hợp.

## UI state tối thiểu

| State | Composer | Filler | Artifact actions |
| --- | --- | --- | --- |
| Chưa tạo room | disabled | stopped | disabled |
| Idle room | enabled | stopped | report disabled cho tới khi có lượt thành công |
| Processing/SSE | disabled | play nếu toggle bật | disabled |
| Text done, TTS pending/available | enabled | stopped | report enabled |
| Report generated / wrapped | disabled | stopped | landing page và pitch deck enabled |

## Bảo mật và UX

- Không đưa private facilitator state vào UI; chỉ dùng public SSE/text contract.
- Render transcript bằng `textContent`, không nối user/assistant text vào `innerHTML`.
- Preserve draft khi nhận `409` hoặc lỗi request để user có thể retry.
- Khởi tạo audio/TTS/STT từ hành động user khi có thể; mọi `audio.play()` cần catch rejection.
