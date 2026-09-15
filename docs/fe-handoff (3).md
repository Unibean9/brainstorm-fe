# FE Handoff — Progressive sessions, adaptive facilitation, outcomes

Backend contract changes on `dev` since the last FE sync. All paths under `API_PREFIX =
/api/v1/brainstorm`. Reference implementation for every call below: `public/demo.html`.

## Current UX contract

The user should only need to choose voice, language, and say the brainstorm topic. New sessions send
the minimal seed `{ topic, language, voiceId }`; `goal`, `context`, `constraints`, `audience`, and
`successCriteria` are discovered from the first turns into `workingBrief`. The UI presents that
working context for review, then calls `POST /sessions/:sessionId/brief/confirm` only after the
teacher confirms it. `PATCH /sessions/:sessionId/brief` supports corrections and later revisions.

`runtimeProvider` (`claude` or `codex`) is infrastructure pinned to the room's main conversation.
It is separate from adaptive `facilitationMode` and `cognitiveIntent`. A different provider must
be an explicit subtask/fork/handoff grounded by a snapshot; the main conversation never silent-
switches runtime.

## 1. Room creation now takes a pinned runtime provider

`POST /rooms`

- New optional body field `runtimeProvider`: `"claude" | "codex"` (default `"claude"`). Every
  main conversation created in the room uses that pinned provider.
- Response and `GET /rooms` list items include `runtimeProvider` (with `agent` retained as a
  compatibility alias).
- New canonical endpoint: `GET /runtime-providers` → `[{ providerId: "claude", label: "Claude" },
{ providerId: "codex", label: "Codex" }]`. `GET /agents` remains a compatibility alias.

## 2. Session creation uses a minimal seed; the brief is progressive

`POST /rooms/:roomId/sessions` new clients send:

- `topic`: required user-facing brainstorm topic (the legacy `name` field remains an alias).
- `language`: `"vi" | "en"` (default `"vi"`). New: `GET /languages` lists the supported set,
  same shape/auth as `GET /voices`.
- `voiceId`: required supported voice id.

The following remain compatibility/configuration fields, but are not required by the progressive
UX:

- `language`: `"vi" | "en"` (default `"vi"`). New: `GET /languages` lists the supported set,
  same shape/auth as `GET /voices`.
- `brief`: a bounded `SessionBrief` object — `{ goal, context, constraints[], successCriteria[],
audience, stance: "facilitator"|"creative_partner", language, requestedArtifacts: ("prd"|
"landing-page"|"pitch-deck")[] }`. Strings capped at 4000 bytes (list items at 1000), lists
  capped at 12 items, `requestedArtifacts` capped at 3. Sending a malformed brief is a 422
  (`invalid_brief`), not a silent drop.
- `capabilities`: `{ research?: boolean }` — enables/disables the research capability for the
  session's agent.
- `facilitationMode`: `"facilitator" | "creative_partner"` (default `"facilitator"`).

The session snapshot returned by session-create and by `GET .../sessions/:sessionId` (and the
`teacherRooms.ts` room-session listing) now additionally includes:

```
 runtimeProvider, agent, language, facilitationMode, modeRevision,
 seed, workingBrief, briefStatus, briefRevision, adaptiveState, brief,
 durableOutcomes, artifacts, autonomousJobs
```

- `artifacts` is an array of per-artifact status objects (one per `prd | landing-page |
pitch-deck` that has ever been generated) — see §4.
- `activeTurn`, when present, now also carries `facilitationMode` and `modeRevision` — the mode
  that turn is actually running under, which can lag a mode change made mid-turn.

### Brief lifecycle

- `PATCH /sessions/:sessionId/brief` accepts partial `WorkingBrief` fields during discovery. For a
  confirmed brief it creates a new revision while preserving the existing stance and outputs.
- `POST /sessions/:sessionId/brief/confirm` accepts optional `stance` and `requestedArtifacts`,
  and persists the complete Working Brief as `SessionBrief`. It returns `409 brief_not_ready` until
  all five discovery fields are clear enough.
- `advisory-state` may include `cognitiveIntent`, `userState`, `suggestedFacilitationMode`,
  `workingBrief`, and `briefReady`. These are advisory model observations; the session snapshot is
  the source of truth after the stream completes.

## 3. Facilitation mode is live-switchable

New: `PATCH /sessions/:sessionId/mode`

- Body: `{ facilitationMode: "facilitator"|"creative_partner", reason?: string }` (reason capped
  at 500 chars, trimmed).
- Response: `{ facilitationMode, modeRevision, effectiveFrom: "next_turn" }` — **the switch never
  affects the turn currently in flight**, only turns after it. UI should surface this ("takes
  effect on the next message") rather than implying an instant switch.
- 403 if the calling teacher doesn't own the session; 422 on a bad body.

New: `POST /sessions/:sessionId/complete` — explicit wrap-up. Body must be empty. Returns
`{ sessionId, status: "wrapped" }`. 409 if a turn is still in progress. This is now the way a
session is marked wrapped — the old implicit "generating a PRD force-wraps the session" behavior
is gone (see §4).

## 4. Artifact generation no longer requires wrap-up phase

`POST /sessions/:sessionId/prd` (and landing-page / pitch-deck) previously:

- 409'd with `phase_not_complete` unless the session was in `wrap-up` phase (or `?force=true`).
- Implicitly marked the session `wrapped` as a side effect of a successful PRD generation.

Now:

- `phase_not_complete` / `?force=true` are **gone**. Generation is allowed at any point; it only
  409s with `prd_not_ready` if a turn is currently active.
- Generating an artifact no longer wraps the session. Use the explicit `POST .../complete` (§3)
  when you want to mark a session done.
- Every artifact route now writes status transitions you can poll or read off the session
  snapshot's `artifacts` array: `{ artifactKey, status: "generating"|"ready"|"failed", warnings?,
error?, outputMetadata? }`. Useful for showing "generating…" state without polling the artifact
  file itself.

## 5. New durable outcomes ledger

New: `GET /sessions/:sessionId/outcomes` and `POST /sessions/:sessionId/outcomes`.

- Kinds: `idea | insight | assumption | risk | question | decision | rejected_option | action`.
- POST body: `{ outcomeId (uuid), kind, content (any JSON, ≤16KB serialized), status?:
"accepted"|"rejected" (default accepted), sourceTraceTurn?: number|null,
supersedesOutcomeId?: uuid|null }`.
- This is the teacher-confirmed, durable record distinct from the live transcript/trace — it's
  what feeds artifact generation's "source bundle" now (see §4) and shows up as
  `durableOutcomes` on the session snapshot.

## 6. Explicit subtask/fork branches

New endpoints under `/sessions/:sessionId/autonomous-ideation/jobs`:

- `POST` (body `{ clientJobId (uuid-shaped, ≤ same bytes as clientTurnId), prompt (≤ text limit),
deadlineMs? }`) — starts an explicit forked-session subtask off the last completed root turn,
  grounded by the current main conversation snapshot. Idempotent
  on `clientJobId` (replays return 200 instead of 201).
- `GET /:jobId` — job status.
- `POST /:jobId/cancel` — cancel a running job (empty body).
- `GET /:jobId/candidates` — list generated candidate outcomes.
- `POST /:jobId/candidates/:candidateId/accept` (optional `{ kind?, outcomeId? }`) — promotes a
  candidate into the durable outcomes ledger (§5).
- `POST /:jobId/candidates/:candidateId/reject` (empty body).

Session snapshots now include `autonomousJobs` (list of jobs for that session) so the UI can show
branch state without a separate poll on first load.

Error codes to handle: `claude_fork_unsupported` / `codex_fork_unsupported` (503, agent's CLI
doesn't support native forking), `session_closed`, `root_turn_in_progress` (409, wait for the
live turn), `autonomous_job_limit` (409, one branch at a time per session), `legacy_job_not_runnable`,
`candidate_not_found`, `candidate_not_pending`, `job_not_completed`.

## 7. SSE turn stream: new event types, old ones now fail open

`text-done` now also carries `stage` (freeform reasoning stage string) alongside the existing
`phaseKey` — `phaseKey` can be `null` now (see below), so don't assume it's always a valid
`PHASE_KEYS` value.

Two new replayable SSE events per turn:

- `advisory-state`: `{ state: ReasoningState, diagnostic: string | null }` — sent whenever the
  model's private reasoning state parsed successfully. `ReasoningState` is richer than before:
  `{ stage, technique, diagnosis, move, stance, completion: { suggested, reason }, traceEntry }`
  (plus legacy `phase`/`trace_entry` aliases). Treat this as **advisory/debug display only** —
  never as a lifecycle or product-state authority (that's still `state`/`engine-step`).
- `advisory-warning`: `{ code: string, recoverable: true }` — sent instead of `advisory-state`
  when the model's private-state block was missing/malformed. **This is not a turn failure** —
  the turn still completes and `text-done` still fires; previously this situation would have
  thrown `invalid_private_state` and failed the whole turn. If your SSE handler treats unknown
  event names as no-ops today, this is backward compatible; if you have a switch/exhaustive
  handler over event names, add these two.

## 8. Filler audio filenames gained a language segment

If FE ever references filler audio filenames directly (vs. going through the `/fillers` route),
the format changed:

```
filler_<phase>_<voice>_<lang>_<n>.wav   (was: filler_<phase>_<voice>_<n>.wav)
```

Not expected to affect FE if it only consumes the `/fillers` API response, but flagging since the
old flat naming assumption breaks if hardcoded anywhere.

## Not FE-facing (skip)

Schema migrations, artifact-registry internals, Claude/Codex process spawning, and the
`bmad-brainstorming` skill/runtime config are backend/runtime-only — no contract impact beyond
what's listed above.
