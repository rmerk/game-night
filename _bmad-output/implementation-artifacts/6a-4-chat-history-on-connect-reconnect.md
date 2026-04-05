# Story 6A.4: Chat History on Connect/Reconnect

Status: ready-for-dev

<!-- Ultimate context engine — 2026-04-05. Targets first backlog in sprint-status; server ring buffer + client chat store hooks from 6A.1/6A.2; aligns FR105 + AR30. -->

## Story

As a **player**,
I want **to see recent chat messages when I join a room or reconnect after a network hiccup**,
so that **I don't miss the conversation and can catch up on what friends were saying (FR105)**.

## Acceptance Criteria

1. **AC1 — Wire message on join:** Given a player completes **initial** room join (new seat, `JOIN_ROOM` without valid `token`), when the server has sent the joining client their first `STATE_UPDATE` (with `token`), then the server **also** sends a **`CHAT_HISTORY`** server message on that same WebSocket **before** or **after** that `STATE_UPDATE` (pick one order, document it in code comment, and **keep it consistent** for reconnection). Payload: `version`, `type: "CHAT_HISTORY"`, `messages`: array of **`ChatBroadcast`** objects (same shape as live `CHAT_BROADCAST` — see [`protocol.ts`](../../packages/shared/src/types/protocol.ts)), **chronological order** (oldest → newest) so the newest line is last.

2. **AC2 — Wire message on token reconnect:** Given token-based reconnection in [`handleTokenReconnection`](../../packages/server/src/websocket/join-handler.ts), when the server sends the reconnecting client their `STATE_UPDATE` (with `token`), then the server **also** sends **`CHAT_HISTORY`** with the same semantics as AC1.

3. **AC3 — Empty history:** Given a room with **no** stored chat lines, when a client connects (join or reconnect), then `CHAT_HISTORY` is sent with **`messages: []`** — no error, no omission of the message type.

4. **AC4 — Source of truth:** Given `room.chatHistory` populated by [`appendChatHistory`](../../packages/server/src/websocket/chat-handler.ts) (capacity [`CHAT_HISTORY_CAPACITY`](../../packages/shared/src/chat-constants.ts) = **100**), when building `CHAT_HISTORY`, then the array matches the authoritative buffer (oldest-first order in memory — today `shift()` evicts oldest; **do not** reverse order when serializing).

5. **AC5 — 64KB cap (AR30):** Given serialization of `CHAT_HISTORY`, when `JSON.stringify` length would exceed **65536** bytes (match server `maxPayload` in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts)), then the server **drops entries from the oldest end** until the serialized message fits (or until `messages` is empty). **No** reliance on incoming `maxPayload` for **outbound** sizing — implement explicit length check / truncation loop. Document the constant (reuse **65536** or import a single named constant shared with tests).

6. **AC6 — Client parse:** Given a valid `CHAT_HISTORY` JSON message, when [`parseServerMessage`](../../packages/client/src/composables/parseServerMessage.ts) runs, then return a typed result (e.g. `kind: "chat_history"`, `message: ChatHistoryMessage`) or equivalent — **not** `{ kind: "ignored" }`. Validate: `messages` is an array; each element satisfies the **same field contract** as `CHAT_BROADCAST` parsing (reuse validation logic or a shared helper to avoid drift). Malformed payloads → `null` (consistent with other server message parse failures).

7. **AC7 — Client store hydration:** Given `CHAT_HISTORY` is received in [`useRoomConnection.handleMessage`](../../packages/client/src/composables/useRoomConnection.ts), when handling succeeds, then call [`useChatStore().setMessages`](../../packages/client/src/stores/chat.ts) with the parsed array (**replace**, not append). **Do not** duplicate messages when subsequent `CHAT_BROADCAST` arrives.

8. **AC8 — Live append after history:** Given the client has applied `CHAT_HISTORY`, when a new `CHAT_BROADCAST` arrives, then [`appendBroadcast`](../../packages/client/src/stores/chat.ts) adds **one** new row — no gaps, no duplicates relative to history.

9. **AC9 — Session reset boundaries:** Given [`resetSocialUiForSession`](../../packages/client/src/composables/useRoomConnection.ts) runs on `disconnect` / socket `close` / start of `connect`, when a **new** session begins, then chat is cleared **before** new server messages arrive; after connect, `CHAT_HISTORY` + live broadcasts repopulate. **Reconnect** after close: same — no stale merge with prior session.

10. **AC10 — UI continuity:** Given [`ChatPanel.vue`](../../packages/client/src/components/chat/ChatPanel.vue) renders `chatStore.messages`, when history is loaded, then the list shows **oldest at top, newest at bottom** (already how `v-for` works if array is oldest-first). Timestamps and `{{ }}` rendering unchanged (NFR48).

11. **AC11 — Shared types:** Given new server message type, when exporting from [`@mahjong-game/shared`](../../packages/shared/src/index.ts), then add **`ChatHistoryMessage`** (or equivalent) next to `ChatBroadcast` in [`protocol.ts`](../../packages/shared/src/types/protocol.ts) with discriminant **`"CHAT_HISTORY"`** (uppercase underscore, match existing style).

12. **AC12 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass ([`AGENTS.md`](../../AGENTS.md)).

### Scope boundaries

| In scope (6A.4) | Out of scope |
| ---------------- | ------------- |
| `CHAT_HISTORY` server emit on join + token reconnect; truncation to 64KB | **Epic 4B** grace-period / `PLAYER_RECONNECTED` UX (may consume this payload later) |
| Client parse + `setMessages` + ordering guarantees | Persistent chat across server restart / DB |
| Tests for server + client parser + store behavior | Pagination, search, or editing history |

## Tasks / Subtasks

- [ ] **Task 1: Shared protocol** (AC: 11, 12)
  - [ ] 1.1 Add `ChatHistoryMessage` interface: `version`, `type: "CHAT_HISTORY"`, `messages: readonly ChatBroadcast[]` (or mutable array type consistent with codebase).
  - [ ] 1.2 Export from [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts).

- [ ] **Task 2: Server — build + send** (AC: 1–5, 12)
  - [ ] 2.1 Add a small module or functions in server (e.g. next to [`chat-handler.ts`](../../packages/server/src/websocket/chat-handler.ts)): `serializeChatHistory(room: Room): string` or `buildChatHistoryMessages(room): ChatBroadcast[]` + truncation until `JSON.stringify({ version, type: "CHAT_HISTORY", messages })` length ≤ **65536**.
  - [ ] 2.2 Call from [`handleJoinRoom`](../../packages/server/src/websocket/join-handler.ts) after successful seat assignment and initial `STATE_UPDATE` (and from `handleTokenReconnection` after `STATE_UPDATE`). Use `ws.send` with the pre-built string **or** structured object — must not throw; log warn on failure (mirror [`trySendJson`](../../packages/server/src/websocket/ws-server.ts) behavior).
  - [ ] 2.3 Unit tests: empty history; N messages round-trip; artificial oversized payload forces oldest dropped; order preserved.

- [ ] **Task 3: Client — parse + route** (AC: 6–9, 12)
  - [ ] 3.1 Extend `ParsedServerMessage` union and [`parseServerMessage`](../../packages/client/src/composables/parseServerMessage.ts) `switch` for `CHAT_HISTORY`.
  - [ ] 3.2 [`parseServerMessage.test.ts`](../../packages/client/src/composables/parseServerMessage.test.ts): valid payload; empty `messages`; invalid element → `null`.
  - [ ] 3.3 [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts): on `chat_history`, `useChatStore().setMessages([...])` (copy to plain array if needed for readonly typing).

- [ ] **Task 4: Integration / store tests** (AC: 7–10, 12)
  - [ ] 4.1 [`chat.test.ts`](../../packages/client/src/stores/chat.test.ts): `setMessages` then `appendBroadcast` yields length +1 with expected tail.
  - [ ] 4.2 Optional: server WebSocket test or join-handler test asserting `CHAT_HISTORY` appears after join (if existing harness allows multi-message capture).

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
- **Omitting truncation** — worst-case 100 × 500-char messages can exceed 64KB JSON.
- **Using architecture doc’s `ChatBroadcast.type` label `CHAT`** — wrong; breaks parser and server parity.

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

_(filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List

_(filled by dev agent)_

## Story completion status

**ready-for-dev** — Ultimate context engine analysis completed; comprehensive developer guide created.
