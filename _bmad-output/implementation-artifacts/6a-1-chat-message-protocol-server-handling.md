# Story 6A.1: Chat Message Protocol & Server Handling

Status: done

| Ticket | Value |
| ------ | ----- |
| **Story key** | `6a-1-chat-message-protocol-server-handling` |
| **Epic** | 6A — Text Chat & Reactions |
| **Sprint status** | `done` (see [`sprint-status.yaml`](./sprint-status.yaml) → `development_status`) |
| **Last updated** | 2026-04-05 |

## Story

As a **developer**,
I want **chat and reaction messages handled by the server with sanitization, rate limiting, and broadcast to all room participants**,
so that **the social communication layer is secure and reliable (FR111, FR112, NFR46, NFR47, NFR48)**.

## Acceptance Criteria

1. **AC1 — CHAT sanitize + broadcast:** Given a player sends a `CHAT` message with text, when the server receives it, then the text is sanitized (capped at **500** characters, **control characters stripped**), and broadcast as a **`ChatBroadcast`** to **all** connected players in the room (**including the sender**) with **`playerId`**, **`playerName`**, **`text`**, and **`timestamp`** (**`number`**, Unix **milliseconds** since epoch — same convention as existing timers in codebase) (NFR46).

2. **AC2 — REACTION allowlist + broadcast:** Given a player sends a `REACTION` message with an emoji string, when the server receives it, then the emoji is validated against a **predefined allowlist**, and broadcast as a **`ReactionBroadcast`** to all connected players (NFR46). Payload must include **`playerId`**, **`playerName`**, **`emoji`**, **`timestamp`** (`number`, Unix ms) for table UX parity.

3. **AC3 — Invalid reaction:** Given a reaction with an emoji **not** on the allowlist, when the server receives it, then the message is **rejected silently** — no broadcast, **no** `ERROR` response, no throw.

4. **AC4 — Chat rate limit:** Given a player sends chat messages rapidly, when exceeding **10 messages per 10 seconds** (sliding or fixed window — document choice), then **excess** messages are **dropped silently** — no `ERROR`, no crash (NFR47).

5. **AC5 — Reaction rate limit:** Given a player sends reactions rapidly, when exceeding **5 per 5 seconds**, then excess reactions are dropped silently (NFR47).

6. **AC6 — Ring buffer:** Given the **chat** message store on the server, when messages accumulate, then the server retains the **last 100 chat entries per room** in a **ring buffer** (AR30 payload budget). **Do not** persist reactions in this buffer (reactions are live-only; aligns with [project-context.md](../project-context.md) “fire-and-forget” for replay semantics — see Scope).

7. **AC7 — Plain strings / NFR48:** Given all chat and reaction payloads, when checking rendering safety, then every user-derived field is a **plain string** suitable for Vue **`{{ }}`** interpolation — document for Story **6A.2** that chat UI must **never** use `v-html` for message body or emoji (NFR48).

8. **AC8 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass ([`AGENTS.md`](../../AGENTS.md)).

### Canonical constants (do not drift)

| Constant | Value | Source |
| -------- | ----- | ------ |
| Max chat length | **500** | NFR46 / epics |
| Chat rate limit | **10** per **10s** | NFR47 |
| Reaction rate limit | **5** per **5s** | NFR47 |
| Chat history depth | **100** entries / room | AC6 / AR30 |
| WS `maxPayload` | **65536** (64KB) | [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) |

Implement as named constants in server (and shared where the allowlist and protocol types live) so tests and prod stay aligned.

## Scope boundaries

| In scope (6A.1) | Out of scope (later stories) |
| ----------------- | ----------------------------- |
| Shared protocol types + server handlers + unit tests | **6A.2** Chat panel UI, `SlideInPanel`, client send of `CHAT`/`REACTION` |
| Per-room ring buffer **storage** for chat | **6A.4** **`CHAT_HISTORY`** wire message on join/reconnect, truncation to 64KB for huge payloads — implementer may add a **read accessor** on the room for history to support 6A.4, but **must not** add `CHAT_HISTORY` client handling or join-time send in this story unless needed for tests |
| `ChatBroadcast` / `ReactionBroadcast` to all sessions | Client `parseServerMessage` wiring for new types (**6A.2**); optional type-only exports are fine |

**Project-context alignment:** [`project-context.md`](../project-context.md) is aligned with this story: chat history is **100** messages per room (ring buffer; Story 6A.1). Older drafts referenced **200**; do not reintroduce that number without revisiting AC6 / AR30.

### Malformed client payloads (guardrail)

`handleMessage` only guarantees `version` + JSON object. For `type === "CHAT"` / `"REACTION"` **after join**:

- **`text`** / **`emoji`** must be **non-empty strings** of the expected shape. Wrong type (`number`, `object`), missing field, or empty string after trim → **silent drop** (no broadcast, **no** `ERROR`) — same spirit as AC3/AC4 “silent” handling; avoids chat becoming an error oracle.
- **Do not** throw from the chat path; log at **debug/warn** if useful for local dev only.

### JSON examples (informative)

Client → server (after `JOIN_ROOM`, same `version` as rest of protocol):

```json
{ "version": 1, "type": "CHAT", "text": "Hello table" }
```

```json
{ "version": 1, "type": "REACTION", "emoji": "👍" }
```

Server → all sessions in room:

```json
{
  "version": 1,
  "type": "CHAT_BROADCAST",
  "playerId": "…",
  "playerName": "…",
  "text": "Hello table",
  "timestamp": 1712275200000
}
```

```json
{
  "version": 1,
  "type": "REACTION_BROADCAST",
  "playerId": "…",
  "playerName": "…",
  "emoji": "👍",
  "timestamp": 1712275200000
}
```

Ring buffer should store the **same fields** as `CHAT_BROADCAST` (or a dedicated `ChatHistoryEntry` type that maps 1:1) so **6A.4** can serialize history without conversion glue.

## Tasks / Subtasks

- [x] **Task 1: Shared protocol types** (AC: 1–3, 7)
  - [x] 1.1 Add **client → server** message types in [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts): e.g. `ChatMessage { type: "CHAT"; text: string }`, `ReactionMessage { type: "REACTION"; emoji: string }` (exact field names up to implementer; keep discriminant `type`).
  - [x] 1.2 Add **server → client** types: `ChatBroadcast`, `ReactionBroadcast` with `version`, `type` discriminant **`"CHAT_BROADCAST"`** and **`"REACTION_BROADCAST"`** (match existing **`STATE_UPDATE`** / **`ERROR`** uppercase underscore style in [`protocol.ts`](../../packages/shared/src/types/protocol.ts)).
  - [x] 1.3 Export new types from [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts).
  - [x] 1.4 Add **`REACTION_EMOJI_ALLOWLIST`** (or equivalent) as a **`readonly` string array** in shared — single source of truth for server validation and future **6A.3** UI buttons (epic examples: thumbs up, laugh, groan, surprise, celebrate, cry — pick concrete Unicode scalars and count **6** emoji minimum).

- [x] **Task 2: Room state + rate limits** (AC: 4–6)
  - [x] 2.1 Extend [`Room`](../../packages/server/src/rooms/room.ts) with: chat ring buffer (capacity **100**), and per-player rate-limit state for chat (10/10s) and reactions (5/5s). Prefer small dedicated types; avoid leaking `WebSocket` into shared.
  - [x] 2.2 Initialize new fields in [`RoomManager.createRoom`](../../packages/server/src/rooms/room-manager.ts). Ensure **`cleanupRoom`** does not leave dangling references (buffers cleared with room).

- [x] **Task 3: Sanitization + handlers** (AC: 1–5)
  - [x] 3.1 Implement **chat sanitization**: max **500** chars after trim; strip control characters — **same regex** as [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) (`CONTROL_CHARS` / `[\x00-\x1F\x7F]`). `CONTROL_CHARS` is **not** exported today — either **duplicate the pattern** in the chat module (with the same eslint `no-control-regex` comment) or extract a tiny **server-local** `stripControlChars(s: string): string` used by join + chat to avoid drift. If sanitization yields **empty** string, drop silently (no broadcast).
  - [x] 3.2 Add a **`chat-handler.ts`** (or similarly named) module: parse `CHAT` / `REACTION` payloads from already-version-checked messages; enforce session via `roomManager.findSessionByWs`; resolve `playerName` from [`room.players`](../../packages/server/src/rooms/room.ts); apply rate limits; append **chat-only** to ring buffer; **`broadcastToRoom`** all open `session.ws` — mirror send pattern from [`broadcastGameState`](../../packages/server/src/websocket/state-broadcaster.ts) (iterate `room.sessions`, skip non-OPEN).
  - [x] 3.3 Wire new message types in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) after `handleMessage`: **require** active session (same as `ACTION`). On unknown `type`, existing behavior should remain safe (log + ignore or current pattern).

- [x] **Task 4: Tests** (AC: 4–6, 8)
  - [x] 4.1 Co-located server tests next to the implementation (e.g. [`chat-handler.test.ts`](../../packages/server/src/websocket/chat-handler.test.ts) beside `chat-handler.ts`): **sanitize** + **500 cap**; **allowlist** reject (silent); **rate-limit** drops (advance fake timers or inject clock); **ring buffer** eviction on 101st chat; **broadcast** JSON includes `version`, `type`, and all required fields; **malformed payload** (wrong `text` type, empty emoji) → no send / no throw.
  - [x] 4.2 Use `vite-plus/test` imports per project convention.
  - [x] 4.3 Run full regression gate.

## Dev Notes

### Epic context (6A)

From [`epics.md`](../planning-artifacts/epics.md): Epic **6A** adds lightweight social features on the **existing** WebSocket connection. **6A.1** establishes the **secure server path**; **6A.2** adds UI. **SlideInPanel** reuse for NMJL (**5B**) is noted in epics but **not** this story.

### Architecture compliance

| Topic | Guidance |
| ----- | -------- |
| **Separate channel** | Chat/reactions **must not** be embedded in [`StateUpdateMessage`](../../packages/shared/src/types/protocol.ts) — orthogonal to game state ([`project-context.md`](../project-context.md)). |
| **No game engine** | Do **not** route through [`handleAction`](../../packages/shared/src/engine/game-engine.ts) / [`GameAction`](../../packages/shared/src/types/actions.ts) / [`handleActionMessage`](../../packages/server/src/websocket/action-handler.ts) for `CHAT`/`REACTION`. |
| **Server authority** | Sanitization and rate limits are **server-side only**; clients cannot trust themselves. |
| **AR30** | WebSocket `maxPayload` is already **64KB** ([`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts)); ring buffer keeps history bounded for future **`CHAT_HISTORY`** serialization (**6A.4**). |
| **NFR48** | Server only emits strings; **6A.2** must render with `{{ }}` not `v-html`. |

### Existing patterns (reuse)

| Pattern | Location |
| ------- | -------- |
| Versioned JSON + `handleMessage` | [`message-handler.ts`](../../packages/server/src/websocket/message-handler.ts) |
| Session lookup | [`room-manager.ts`](../../packages/server/src/rooms/room-manager.ts) `findSessionByWs` |
| Per-room broadcast | [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) `broadcastGameState` |
| Control-char stripping | [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `CONTROL_CHARS` |
| `trySendJson` / error to single client | [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) |

### Rate limiting

Implement **per `playerId` per room**. Silent drop means: no `ERROR`, no broadcast. Use monotonic time (`Date.now()`). **Recommended:** sliding window — keep an array (or queue) of accept timestamps per player per channel; before accept, drop timestamps older than 10s (chat) or 5s (reactions); if count ≥ limit, drop. Document the chosen approach in a one-line comment on the limiter.

### Anti-patterns (do not do this)

| Wrong | Right |
| ----- | ----- |
| Add `CHAT` / `REACTION` to [`GameAction`](../../packages/shared/src/types/actions.ts) | Separate message types in [`protocol.ts`](../../packages/shared/src/types/protocol.ts) only |
| Push chat into [`StateUpdateMessage`](../../packages/shared/src/types/protocol.ts) | Dedicated `CHAT_BROADCAST` / `REACTION_BROADCAST` messages |
| Broadcast `ERROR` to room on spam/invalid emoji | Silent drop per AC3/AC4/AC5 |
| Store reactions in the 100-msg ring buffer | Chat only (AC6) |
| Use `v-html` for chat in 6A.2 | `{{ }}` only (AC7) — call out in 6A.2 review |
| Rely on client-side sanitization alone | Server is authoritative (NFR46) |

### Cross-session intelligence

Epic **3C** completed WebSocket client plumbing ([`3c-8-websocket-client-state-update-to-gametable.md`](./3c-8-websocket-client-state-update-to-gametable.md)); **6A.1** extends **protocol** only on the server side — client composables stay unchanged until **6A.2**.

### Project structure notes

- **Packages:** `shared` (types + allowlist), `server` (handlers, room fields, tests). **No** `client/` changes required for AC unless you add a trivial type re-export smoke test (optional).
- **No import aliases** — relative or `@mahjong-game/shared` only ([`CLAUDE.md`](../../CLAUDE.md)).

### References

- [Epics — Story 6A.1](../planning-artifacts/epics.md) (acceptance criteria source)
- [project-context.md](../project-context.md) — WebSocket, sanitization, three-tier state
- [game-architecture.md](../planning-artifacts/game-architecture.md) — server authority, WS overview
- NFR46–NFR48, FR111–FR112 in epics cross-reference table (`epics.md`)

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent) — gds-dev-story workflow execution

### Debug Log References

### Completion Notes List

- Implemented Story **6A.1**: shared `CHAT` / `REACTION` client messages and `CHAT_BROADCAST` / `REACTION_BROADCAST` server messages; `packages/shared/src/chat-constants.ts` for limits and `REACTION_EMOJI_ALLOWLIST` (six emoji) plus `isAllowedReactionEmoji`.
- Server: `text-sanitize.ts` (`stripControlChars`) shared with join display names; `chat-handler.ts` with sliding-window rate limits, ring buffer (`chatHistory` max 100), silent drops for invalid/overflow; `ws-server` wires `CHAT`/`REACTION` with `NOT_IN_ROOM` when unjoined (same as `ACTION`). Unknown message `type` values are **debug**-logged and ignored (Task 3.3).
- Updated mock `Room` fixtures in server tests; `project-context.md` chat history set to **100** per AC6.
- **Code review (2026-04-05):** `REACTION_BROADCAST` JSON shape test; second pass added missing-`text` CHAT test, reaction rate-limit window recovery test, and unknown-type debug logging in `ws-server.ts`.
- Regression: `pnpm test`, `pnpm run typecheck`, `vp lint` all pass (re-run on review fixes).

### File List

- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/chat-constants.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/websocket/text-sanitize.ts`
- `packages/server/src/websocket/join-handler.ts`
- `packages/server/src/websocket/chat-handler.ts`
- `packages/server/src/websocket/chat-handler.test.ts`
- `packages/server/src/websocket/ws-server.ts`
- `packages/server/src/rooms/room.ts`
- `packages/server/src/rooms/room-manager.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/rooms/session-manager.test.ts`
- `packages/server/src/rooms/seat-assignment.test.ts`
- `packages/server/src/rooms/room-lifecycle.test.ts`
- `_bmad-output/project-context.md`

### Change Log

- 2026-04-05 (pass 2) — Adversarial re-review: `ws-server` logs unknown `type` at **debug** (Task 3.3); tests for missing `text`, reaction sliding-window recovery after `REACTION_RATE_LIMIT_WINDOW_MS`.
- 2026-04-05 — GDS code review: added `REACTION_BROADCAST` JSON shape test in `chat-handler.test.ts` (parity with `CHAT_BROADCAST` assertions). Status: review → done; sprint synced.
- 2026-04-04 — Story 6A.1 implemented: chat/reaction protocol, server sanitization, rate limits, per-room chat ring buffer, tests, project-context alignment.
- 2026-04-04 — Code review pass 2: clear chat/reaction rate-limit maps on seat release (grace expiry) to match per-player semantics when seat ids are recycled.

---

**Completion status:** Done (GDS review 2026-04-04; AI ticket pass 2026-04-05).

### Code review (GDS)

- **AC validation:** AC1–AC8 satisfied in implementation and tests; AC7 reinforced with NFR48 JSDoc on `ChatBroadcast` / `ReactionBroadcast` in `protocol.ts`.
- **Second pass (2026-04-04):** Cleared `chatRateTimestamps` / `reactionRateTimestamps` when a seat is released after grace expiry so recycled `player-0..3` ids do not inherit the previous occupant’s rate-limit state (join-handler). Regression test documents expected behavior in `chat-handler.test.ts`.
- **Regression:** `pnpm test`, `pnpm run typecheck`, `pnpm exec vp lint` passed in review environment.
- **Note:** Branch may contain additional commits outside this story’s file list; 6A.1 scope verified against listed implementation files only.

### Senior Developer Review (AI)

| Pass | Date | Outcome | Notes |
| ---- | ---- | ------- | ----- |
| 1 | 2026-04-05 | **Approve** | Added `REACTION_BROADCAST` JSON assertion (parity with `CHAT_BROADCAST`); story **review → done**; sprint synced. |
| 2 | 2026-04-05 | **Approve** | No HIGH/MEDIUM findings; unknown `type` → `logger.debug` in `ws-server.ts`; tests for missing `text`, reaction sliding-window recovery. |
