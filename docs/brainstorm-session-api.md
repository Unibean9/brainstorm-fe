# Brainstorm Session API — FE ↔ BE (SSE)

Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:8080/`)

Auth: `Authorization: Bearer {accessToken}`

FE dùng **axios** (REST) + **TanStack Query** (cache) + **`fetch` SSE** (stream text + metadata trong một response).

**Không dùng SignalR** cho luồng agent. **Không mock** — mọi dữ liệu phiên từ BE.

**Text agent (chat panel):** stream qua **`text-delta`** — FE cộng dồn từng đoạn vào bubble realtime. Kết thúc bằng **`text-done`**.

**TTS (BE → FE):** BE render **một file audio hoàn chỉnh** (mp3/webm) — event **`agent-audio`**, FE phát một lần (không stream audio).

`sessionId` được lưu `localStorage` (`brainstorm_session_id`) để reload trang → `GET /sessions/{id}`.

---

## REST

### `POST /api/v1/brainstorm/sessions`

Tạo phiên live.

**Request**

```json
{
  "roomId": null,
  "locale": "vi-VN",
  "voiceId": null
}
```

**Response** `ApiResponse<BrainstormSessionSnapshot>`

```json
{
  "isSuccess": true,
  "message": "OK",
  "data": {
    "sessionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "voiceId": "nova",
    "engineStep": 0,
    "phaseKey": "Explore",
    "state": "idle",
    "transcript": []
  }
}
```

| Field | Type | Mô tả |
|-------|------|--------|
| `engineStep` | `0–7` | Engine **đang active** trên ring (xem bảng map bên dưới) |
| `state` | enum | HUD orb: `idle` \| `listening` \| `processing` \| `agent-speaking` |
| `phaseKey` | string | Phase brainstorm hiện tại |

### `GET /api/v1/brainstorm/sessions/{sessionId}`

Snapshot phiên + transcript (reload trang). Cùng schema với `POST /sessions`.

**BE phải persist** `engineStep` sau mỗi turn — FE đọc lại khi reload.

### `PATCH /api/v1/brainstorm/sessions/{sessionId}/voice`

```json
{ "voiceId": "alloy" }
```

Giọng do **BE** chọn/apply — FE chỉ gửi preference.

---

## 8 engine nodes — map cố định (BE bắt buộc theo)

`step` = index **engine đang chạy**. FE render:

| Điều kiện | Ring UI |
|-----------|---------|
| `nodeIndex < step` | **done** — vàng |
| `nodeIndex === step` | **active** — sáng + pulse |
| `nodeIndex > step` | **upcoming** — mờ |

| `step` | `focusNodeId` | Label |
|--------|---------------|-------|
| `0` | `observer` | Observer |
| `1` | `analyzer` | Analyzer |
| `2` | `diagnosis` | Diagnosis |
| `3` | `thinking-state` | Thinking State |
| `4` | `technique` | Technique |
| `5` | `facilitate` | Facilitate |
| `6` | `trace` | Trace |
| `7` | `insight` | Insight |

Source FE: `lib/brainstorm/engine-steps.ts` (derive từ `WORKFLOW_NODES_HOME`).

**Quy tắc BE:**

1. `engineStep` / `engine-step.data.step` luôn `0–7` (FE clamp nếu lệch).
2. `focusNodeId` **nên** khớp `WORKFLOW_NODES_HOME[step].id`. Nếu thiếu, FE tự suy từ `step`.
3. **`text-done` / `audio-done` KHÔNG đánh dấu node** — chỉ `engine-step` (hoặc snapshot `engineStep`).
4. Một turn có thể emit **nhiều** `engine-step` (orchestration chạy qua pipeline).
5. **Khi agent trả xong** (trước `state: idle`): emit ít nhất một lần — thường `step: 7` (`insight`) hoặc step orchestration thực tế.

---

## Agent turn — SSE (text + voice cùng stream)

### `POST /api/v1/brainstorm/sessions/{sessionId}/turns`

**Headers**

```
Content-Type: application/json
Accept: text/event-stream
Authorization: Bearer …
```

**Request — chat**

```json
{
  "clientTurnId": "turn-1719840000",
  "text": "Ý tưởng QR onboarding"
}
```

**Request — voice**

```json
{
  "clientTurnId": "vturn-1719840001",
  "audioBase64": "<raw base64 webm>",
  "audioMime": "audio/webm"
}
```

**Response:** `Content-Type: text/event-stream`

Mỗi event:

```
event: {name}
data: {json envelope}

```

### Envelope (mọi event)

```typescript
{
  sessionId: string;
  turnId: string;
  seq?: number;
  ts: number;       // unix ms
  data: { ... }
}
```

### Event names

| `event:` | `data` | Mô tả |
|----------|--------|--------|
| `state` | `{ state: "idle" \| "listening" \| "processing" \| "agent-speaking" }` | HUD orb |
| `user-transcript-final` | `{ clientTurnId, messageId, text, phaseKey? }` | STT xong (voice) |
| `agent-run-started` | `{ messageId, replyToMessageId? }` | Bắt đầu agent reply |
| `text-delta` | `{ messageId, delta }` | **Stream text chat** — FE cộng dồn vào bubble agent |
| `text-done` | `{ messageId, text, phaseKey? }` | Text hoàn chỉnh — chốt message (nên gửi sau các delta) |
| **`agent-audio`** | **`{ messageId, encoding, audioBase64 }`** | **TTS xong — một file audio đầy đủ, FE phát** |
| `audio-chunk` | `{ messageId, encoding, chunkBase64, isLast }` | *(legacy)* — FE vẫn hỗ trợ; BE MVP dùng `agent-audio` |
| `audio-done` | `{ messageId }` | *(optional)* marker sau audio — FE tự `idle` khi phát xong |
| **`engine-step`** | **`{ step: 0-7, focusNodeId? }`** | **Đánh dấu 8 node — bắt buộc MVP** |
| `error` | `{ code, message, messageId? }` | Lỗi |

Stream kết thúc khi connection đóng hoặc gửi:

```
event: done
data: [DONE]
```

---

## Ví dụ response đầy đủ (chat + orchestration + đánh dấu node)

```
event: state
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001000,"data":{"state":"processing"}}

event: engine-step
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001050,"data":{"step":0,"focusNodeId":"observer"}}

event: engine-step
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001190,"data":{"step":1,"focusNodeId":"analyzer"}}

event: engine-step
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001330,"data":{"step":2,"focusNodeId":"diagnosis"}}

event: engine-step
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001470,"data":{"step":3,"focusNodeId":"thinking-state"}}

event: agent-run-started
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001500,"data":{"messageId":"amsg-1"}}

event: engine-step
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001610,"data":{"step":4,"focusNodeId":"technique"}}

event: text-delta
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001700,"data":{"messageId":"amsg-1","delta":"Ghi "}}

event: text-delta
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001750,"data":{"messageId":"amsg-1","delta":"nhận..."}}

event: state
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001800,"data":{"state":"agent-speaking"}}

event: engine-step
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001810,"data":{"step":5,"focusNodeId":"facilitate"}}

event: text-done
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840001900,"data":{"messageId":"amsg-1","text":"Ghi nhận rồi — …","phaseKey":"Explore"}}

event: agent-audio
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840002000,"data":{"messageId":"amsg-1","encoding":"audio/mpeg","audioBase64":"…"}}

event: engine-step
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840002280,"data":{"step":6,"focusNodeId":"trace"}}

event: engine-step
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840002360,"data":{"step":7,"focusNodeId":"insight"}}

event: state
data: {"sessionId":"sess-1","turnId":"turn-1","ts":1719840002400,"data":{"state":"idle"}}
```

**Thứ tự gợi ý cho BE (MVP):**

1. `state: processing`
2. `engine-step` 0 → 4 (orchestration)
3. `agent-run-started` + `text-delta`…
4. `state: agent-speaking` + `engine-step: 5`
5. **`text-delta`…** (nhiều lần — chat hiện dần) + **`text-done`**
6. **`agent-audio`** — một file TTS base64
7. **`engine-step: 6` → `7` (agent xong / chốt insight)**
8. `state: idle` + persist `engineStep: 7` trên session

**TTS flow (BE):** agent sinh text → TTS engine render **full file** → emit **một** `agent-audio` → FE `HTMLAudioElement.play()` → xong thì FE `idle` (hoặc BE gửi thêm `state: idle`).

Voice turn: BE nhận `audioBase64` → STT → emit `user-transcript-final` → cùng chuỗi agent events ở trên.

Listening (mic bật): `state: listening` + `engine-step: { step: 0, focusNodeId: "observer" }` (optional nhưng khuyến nghị).

---

## BE checklist (MVP)

1. `POST /sessions` + `GET /sessions/{id}` — trả `engineStep` (0–7)
2. `POST /sessions/{id}/turns` trả SSE
3. Chat/voice turn: **`text-delta` + `text-done`** (stream chat) + **`agent-audio`** (một file TTS)
4. `state` events sync HUD orb
5. Voice: nhận `audioBase64`, STT → `user-transcript-final` → agent stream
6. **`engine-step` mỗi lần orchestration đổi engine + khi agent xong (step 6–7)**
7. Persist `engineStep` trên session sau turn

---

## FE files

| File | Role |
|------|------|
| `lib/api/services/brainstormSession.ts` | axios REST + fetch SSE turn |
| `lib/brainstorm/session-storage.ts` | `localStorage` sessionId |
| `hooks/queries/useBrainstormSessionQueries.ts` | TanStack Query mutations / cache |
| `hooks/useBrainstormSession.ts` | Session orchestration + SSE turn |
| `lib/brainstorm/engine-steps.ts` | Map step 0–7 ↔ node id (contract BE) |
| `lib/brainstorm/consume-sse-stream.ts` | SSE parser |
| `lib/brainstorm/apply-turn-event.ts` | Map event → UI (`engine-step` → ring) |
| `lib/brainstorm/brainstorm-query-keys.ts` | TanStack Query keys |
| `lib/audio/agent-audio-player.ts` | Play **`agent-audio`** (một file) |

Env mẫu: `.env.example`
