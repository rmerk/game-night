# Story 6A.4: Chat History on Connect/Reconnect

Status: review

<!-- Ultimate context engine — 2026-04-05. Pass 2: fixed payload sizing (UTF-8 bytes), mandated send order, REQUEST_STATE path, SESSION_SUPERSEDED + list-key notes. -->

## Story

As a **player**,
I want **to see recent chat messages when I join a room or reconnect after a network hiccup**,
so that **I don't miss the conversation and can catch up on what friends were saying (FR105)**.

## Acceptance Criteria

1. **AC1 — Wire message on join:** Given a player completes **initial** room join (new seat, `JOIN_ROOM` without valid `token`), when the server has sent the joining client their first `STATE_UPDATE` (with `token`), then the server **also** sends **`CHAT_HISTORY`** on that same WebSocket **immediately after** that `STATE_UPDATE` (same order for every code path — document in a one-line comment on the helper). Rationale: `handleMessage` processes messages serially; state (and session token write) should land before chat hydration. Payload: `version`, `type: "CHAT_HISTORY"`, `messages`: array of **`ChatBroadcast`** objects (same shape as live `CHAT_BROADCAST` — see [`protocol.ts`](../../packages/shared/src/types/protocol.ts)), **chronological order** (oldest → newest) so the newest line is last. Entries may be **copies** of `room.chatHistory` elements (already include `version` + `type: "CHAT_BROADCAST"`).

2. **AC2 — Wire message on token reconnect:** Given token-based reconnection in [`handleTokenReconnection`](../../packages/server/src/websocket/join-handler.ts), when the server sends the reconnecting client their `STATE_UPDATE` (with `token`), then the server **also** sends **`CHAT_HISTORY` immediately after** that `STATE_UPDATE` with the same semantics as AC1.

3. **AC3 — Empty history:** Given a room with **no** stored chat lines, when a client connects (join or reconnect), then `CHAT_HISTORY` is sent with **`messages: []`** — no error, no omission of the message type.

4. **AC4 — Source of truth:** Given `room.chatHistory` populated by [`appendChatHistory`](../../packages/server/src/websocket/chat-handler.ts) (capacity [`CHAT_HISTORY_CAPACITY`](../../packages/shared/src/chat-constants.ts) = **100**), when building `CHAT_HISTORY`, then the array matches the authoritative buffer (oldest-first order in memory — today `shift()` evicts oldest; **do not** reverse order when serializing).

5. **AC5 — 64KB cap (AR30):** Given serialization of `CHAT_HISTORY`, when the **on-the-wire UTF-8 size** would exceed **65536** bytes (match `maxPayload` in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts)), then the server **drops entries from the oldest end** until the payload fits (or until `messages` is empty). **Critical:** measure with **`Buffer.byteLength(json, "utf8")`** (or equivalent), **not** `json.length` — JavaScript string length is UTF-16 code units and can diverge from WebSocket frame bytes (emoji, astral planes). **No** reliance on inbound `maxPayload` for **outbound** sizing — explicit truncation loop. Export or centralize a named constant (e.g. `WS_MAX_PAYLOAD_BYTES = 65_536`) in server (or shared) for the helper + tests.

6. **AC6 — Client parse:** Given a valid `CHAT_HISTORY` JSON message, when [`parseServerMessage`](../../packages/client/src/composables/parseServerMessage.ts) runs, then return a typed result (e.g. `kind: "chat_history"`, `message: ChatHistoryMessage`) or equivalent — **not** `{ kind: "ignored" }`. Validate: `messages` is an array; each element satisfies the **same field contract** as `CHAT_BROADCAST` parsing (reuse validation logic or a shared helper to avoid drift). Malformed payloads → `null` (consistent with other server message parse failures).

7. **AC7 — Client store hydration:** Given `CHAT_HISTORY` is received in [`useRoomConnection.handleMessage`](../../packages/client/src/composables/useRoomConnection.ts), when handling succeeds, then call [`useChatStore().setMessages`](../../packages/client/src/stores/chat.ts) with the parsed array (**replace**, not append). **Do not** duplicate messages when subsequent `CHAT_BROADCAST` arrives.

8. **AC8 — Live append after history:** Given the client has applied `CHAT_HISTORY`, when a new `CHAT_BROADCAST` arrives, then [`appendBroadcast`](../../packages/client/src/stores/chat.ts) adds **one** new row — no gaps, no duplicates relative to history.

9. **AC9 — Session reset boundaries:** Given [`resetSocialUiForSession`](../../packages/client/src/composables/useRoomConnection.ts) runs on `disconnect` / socket `close` / start of `connect`, when a **new** session begins, then chat is cleared **before** new server messages arrive; after connect, `CHAT_HISTORY` + live broadcasts repopulate. **Reconnect** after close: same — no stale merge with prior session.

10. **AC10 — UI continuity:** Given [`ChatPanel.vue`](../../packages/client/src/components/chat/ChatPanel.vue) renders `chatStore.messages`, when history is loaded, then the list shows **oldest at top, newest at bottom** (already how `v-for` works if array is oldest-first). Timestamps and `{{ }}` rendering unchanged (NFR48).

11. **AC11 — Shared types:** Given new server message type, when exporting from [`@mahjong-game/shared`](../../packages/shared/src/index.ts), then add **`ChatHistoryMessage`** (or equivalent) next to `ChatBroadcast` in [`protocol.ts`](../../packages/shared/src/types/protocol.ts) with discriminant **`"CHAT_HISTORY"`** (uppercase underscore, match existing style).

12. **AC12 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass ([`AGENTS.md`](../../AGENTS.md)).

13. **AC13 — REQUEST_STATE resync:** Given an **already-joined** client sends [`REQUEST_STATE`](../../packages/server/src/websocket/ws-server.ts) (handled after session lookup), when the server responds with [`sendCurrentState`](../../packages/server/src/websocket/state-broadcaster.ts), then it **also** sends **`CHAT_HISTORY` immediately after** that `STATE_UPDATE` using the same helper as AC1–2. Rationale: resync refreshes game view without a new `JOIN_ROOM`; without this, chat could stay empty or stale while state updates. **Note:** `sendCurrentState` does not emit a `token` — do not change that; only add `CHAT_HISTORY` beside it.

14. **AC14 — SESSION_SUPERSEDED:** Given a second connection supersedes the first ([`handleTokenReconnection`](../../packages/server/src/websocket/join-handler.ts) closes the old socket with `SESSION_SUPERSEDED`), the **old** socket does **not** receive `CHAT_HISTORY`. The replacement connection follows normal join/reconnect and receives history per AC1/AC2 — **no** extra requirement beyond documenting this in Dev Notes so implementers do not chase a ghost bug.

### Scope boundaries

| In scope (6A.4) | Out of scope |
| ---------------- | ------------- |
| `CHAT_HISTORY` server emit on join, token reconnect, and `REQUEST_STATE`; truncation to 64KB (UTF-8) | **Epic 4B** grace-period / `PLAYER_RECONNECTED` UX (may consume this payload later) |
| Client parse + `setMessages` + ordering guarantees | Persistent chat across server restart / DB |
| Tests for server + client parser + store behavior | Pagination, search, or editing history |

## Tasks / Subtasks

- [x] **Task 1: Shared protocol** (AC: 11, 12)
  - [x] 1.1 Add `ChatHistoryMessage` interface: `version`, `type: "CHAT_HISTORY"`, `messages: readonly ChatBroadcast[]` (or mutable array type consistent with codebase).
  - [x] 1.2 Export from [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts).

- [x] **Task 2: Server — build + send** (AC: 1–5, 12–13)
  - [x] 2.1 Add a small module or functions in server (e.g. next to [`chat-handler.ts`](../../packages/server/src/websocket/chat-handler.ts)): build `{ version, type: "CHAT_HISTORY", messages }` from `room.chatHistory`, then truncate from the **oldest** end until `Buffer.byteLength(JSON.stringify(...), "utf8")` ≤ **`WS_MAX_PAYLOAD_BYTES`** (65536). Prefer returning a **final JSON string** from the helper so join/reconnect/request-state paths share one implementation.
  - [x] 2.2 Call from [`handleJoinRoom`](../../packages/server/src/websocket/join-handler.ts) **immediately after** the initial `STATE_UPDATE` `ws.send`, and from [`handleTokenReconnection`](../../packages/server/src/websocket/join-handler.ts) **immediately after** its `STATE_UPDATE` `ws.send`. Wrap send in try/catch; on failure log **warn** (mirror [`trySendJson`](../../packages/server/src/websocket/ws-server.ts)).
  - [x] 2.3 After [`sendCurrentState`](../../packages/server/src/websocket/state-broadcaster.ts) in the `REQUEST_STATE` branch of [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts), call the same `CHAT_HISTORY` send helper (same `ws`).
  - [x] 2.4 Unit tests: empty history; N messages; UTF-8-heavy content (emoji in `text`) proves byte-based cap; oversized payload drops oldest; order preserved; optional: `REQUEST_STATE` integration test asserts second message is `CHAT_HISTORY`.

- [x] **Task 3: Client — parse + route** (AC: 6–9, 12)
  - [x] 3.1 Extend `ParsedServerMessage` union and [`parseServerMessage`](../../packages/client/src/composables/parseServerMessage.ts) `switch` for `CHAT_HISTORY`.
  - [x] 3.2 [`parseServerMessage.test.ts`](../../packages/client/src/composables/parseServerMessage.test.ts): valid payload; empty `messages`; invalid element → `null`.
  - [x] 3.3 [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts): on `chat_history`, `useChatStore().setMessages([...])` (copy to plain array if needed for readonly typing).

- [x] **Task 4: Integration / store tests** (AC: 7–10, 12)
  - [x] 4.1 [`chat.test.ts`](../../packages/client/src/stores/chat.test.ts): `setMessages` then `appendBroadcast` yields length +1 with expected tail.
  - [x] 4.2 Optional: server WebSocket test or join-handler test asserting `CHAT_HISTORY` appears after join (if existing harness allows multi-message capture).

## Change Log

- **2026-04-05:** Story 6A.4 implemented — `ChatHistoryMessage` in shared; server `chat-history.ts` (`WS_MAX_PAYLOAD_BYTES`, UTF-8 truncation, send after `STATE_UPDATE` on join, token reconnect, `REQUEST_STATE`); client parse + `setMessages`; tests (unit + ws-server REQUEST_STATE pairing + full-game-flow reader skip).

## Dev Notes

### Epic & requirements traceability

- [`epics.md`](../planning-artifacts/epics.md) — Story **6A.4** (FR105 social continuity; AR30 payload budget).
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — Decision 2: `CHAT_HISTORY` on connect/reconnect; 100-message cap; truncate oldest until under 64KB (**note:** architecture snippet uses legacy `type: 'CHAT'` for broadcast — **implementation uses `CHAT_BROADCAST`** per [`protocol.ts`](../../packages/shared/src/types/protocol.ts)).

### Previous story intelligence (6A.3)

Source: [`6a-3-quick-reactions-system.md`](./6a-3-quick-reactions-system.md).

- **`resetSocialUiForSession`** clears chat + reactions + slide-in — `CHAT_HISTORY` must run **after** that reset for a new connection; ordering of server messages vs. client `connect()` is already “clear then receive.”
- Reactions **must not** appear in chat history (6A.1 only appends chat to `room.chatHistory`).

### Previous story intelligence (6A.2 / 6A.1)

- [`useChatStore`](../../packages/client/src/stores/chat.ts) already exposes **`setMessages`** for this story — prefer it over hacking `appendBroadcast` in a loop (avoids N reactive updates).
- Ring buffer and `ChatBroadcast` shape are already unified in [`chat-handler.ts`](../../packages/server/src/websocket/chat-handler.ts).

### Architecture compliance

| Topic | Rule |
| ----- | ---- |
| **Not a `GameAction`** | `CHAT_HISTORY` is a social sync message, not engine state. |
| **NFR48** | History entries are plain strings; render with `{{ }}` only. |
| **Server authority** | Client never fabricates history; only displays server-provided lines. |
| **Imports** | Tests: `vite-plus/test`; app: `vite-plus` per [`AGENTS.md`](../../AGENTS.md). |

### Anti-patterns (do not ship)

- **Appending `CHAT_HISTORY` with `appendBroadcast` in a loop** — duplicates risk if any message replays; use **replace** once.
- **Sending history only on join but not on token reconnect** — violates AC2 and FR105 narrative.
- **Skipping `REQUEST_STATE`** — leaves chat stale after resync (AC13).
- **Using `json.length` for the 64KB budget** — wrong unit; use **UTF-8 byte length** (AC5).
- **Omitting truncation** — worst-case 100 × 500-char messages can exceed 64KB JSON.
- **Using architecture doc’s `ChatBroadcast.type` label `CHAT`** — wrong; breaks parser and server parity.

### Implementation edge cases

- **SESSION_SUPERSEDED (AC14):** When a second connection supersedes the first, the **old** socket is closed after `SESSION_SUPERSEDED` only — it never receives `CHAT_HISTORY`. The new connection follows normal join/reconnect and receives history as usual.
- **Vue list keys:** [`ChatPanel.vue`](../../packages/client/src/components/chat/ChatPanel.vue) uses `` :key="\`${m.timestamp}-${m.playerId}-${m.text}\`" ``. Two distinct lines could theoretically collide if a player sends the **same** text twice in the **same** millisecond — rare. If tests or QA surface duplicate-key warnings, add a monotonic **client-side** `id` when hydrating (`setMessages` maps entries) or use array index as last-resort disambiguator; not required for MVP unless observed.
- **Malformed `CHAT_HISTORY`:** Parser returns `null` → `handleMessage` returns early; chat stays empty until next successful `CHAT_HISTORY` or live `CHAT_BROADCAST` — acceptable; do not crash.
- **Protocol direction:** `CHAT_HISTORY` is **server → client only**; it never appears in [`handleMessage`](../../packages/server/src/websocket/message-handler.ts) as an inbound `parsed.type` from clients.

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Shared | [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts), [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts) |
| Server | [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts), new or extended helper near [`packages/server/src/websocket/chat-handler.ts`](../../packages/server/src/websocket/chat-handler.ts), tests co-located |
| Client | [`packages/client/src/composables/parseServerMessage.ts`](../../packages/client/src/composables/parseServerMessage.ts), [`parseServerMessage.test.ts`](../../packages/client/src/composables/parseServerMessage.test.ts), [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts), [`packages/client/src/stores/chat.test.ts`](../../packages/client/src/stores/chat.test.ts) |

### Cross-session intelligence (claude-mem)

Epic 6A chat path: separate WS channel from `STATE_UPDATE`; `CHAT_HISTORY_CAPACITY` = 100; reactions not stored; 6A.3 completed reaction UI with explicit **out of scope** pointer to **6A.4** for `CHAT_HISTORY`.

### Git intelligence (recent commits)

Recent work on **`feat(client): … (6A.3)`** — reaction bar, `parseServerMessage` `reaction_broadcast`, `useRoomConnection` routing. Extend the same parser/handler pattern for `chat_history`; keep Pinia concerns split (chat store only for text lines).

### Latest tech / versions

No new dependencies. WebSocket server already `maxPayload: 65_536` ([`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts)). Node `ws` outbound send is standard JSON string.

### Project context reference

[`project-context.md`](../project-context.md) — WebSocket section: chat history on connect/reconnect in **6A.4**; 100 messages; never `v-html` for chat.

## Dev Agent Record

### Agent Model Used

Cursor agent (gds-dev-story / strategy-cursor)

### Debug Log References

### Completion Notes List

- Implemented `CHAT_HISTORY` end-to-end: shared type, server build/send with `Buffer.byteLength` cap, client `parseChatBroadcastFields` reuse + `chat_history` kind, `useRoomConnection` → `setMessages`.
- Integration tests: `waitForMessage` / `waitForParsedMessage` skip `CHAT_HISTORY`; `ws-server` REQUEST_STATE test uses paired `STATE_UPDATE`+`CHAT_HISTORY` waiter; `full-game-flow` `nextStateUpdate` skips `CHAT_HISTORY`.
- Gates: `pnpm test`, `pnpm run typecheck`, `vp lint` passed.

### File List

- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/websocket/chat-history.ts`
- `packages/server/src/websocket/chat-history.test.ts`
- `packages/server/src/websocket/join-handler.ts`
- `packages/server/src/websocket/ws-server.ts`
- `packages/server/src/websocket/join-handler.test.ts`
- `packages/server/src/websocket/ws-server.test.ts`
- `packages/server/src/integration/full-game-flow.test.ts`
- `packages/client/src/composables/parseServerMessage.ts`
- `packages/client/src/composables/parseServerMessage.test.ts`
- `packages/client/src/composables/useRoomConnection.ts`
- `packages/client/src/stores/chat.test.ts`

## Story completion status

**review** — Implementation complete; ready for `code-review` workflow.
