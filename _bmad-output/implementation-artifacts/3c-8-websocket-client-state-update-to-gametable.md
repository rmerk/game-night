# Story 3C.8: WebSocket client — `STATE_UPDATE` to GameTable

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **player in a live room**,
I want **the client to apply each filtered `PlayerGameView` from the server to the real table UI**,
so that **I see racks, Charleston, calls, and governance UIs from authoritative state — not only dev harnesses (Epic 3B retro follow-up)**.

## Acceptance Criteria

1. **AC1 — PlayerGameView drives GameTable:** Given a WebSocket connection to an active room with `STATE_UPDATE` messages, when `state` is a `PlayerGameView`, then the client maps it with `mapPlayerGameViewToGameTableProps` (or equivalent) and renders [`GameTable`](../../packages/client/src/components/game/GameTable.vue) from that mapping. Pass **`resolvedAction`** from the same `STATE_UPDATE` message to `GameTable` when present (mapper does not include it — merge at the wiring layer). See [`StateUpdateMessage`](../../packages/shared/src/types/protocol.ts).

2. **AC2 — Lobby hides in-progress table:** Given `state` is [`LobbyState`](../../packages/shared/src/types/protocol.ts) (`gamePhase === "lobby"`), when the client receives the update, then the **in-progress** table surface is not shown as a live game — a lobby / room shell handles pre-start (create or extend a route-level view; see Tasks).

3. **AC3 — Server authority (AR5):** Given the player dispatches game actions (discard, call, Charleston, etc.), when messages are sent per [`protocol.ts`](../../packages/shared/src/types/protocol.ts) (`ACTION`, `JOIN_ROOM`, `REQUEST_STATE`, `SET_JOKER_RULES` as applicable), then the client **does not** mutate authoritative game state locally before server confirmation. UI may reflect **client-only** concerns (Pinia: rack order, selection, preferences) per [`project-context.md`](../project-context.md). No optimistic removal of tiles from the rack based on a pending discard.

4. **AC4 — Automated test:** Given implementation, when reviewed, then at least one automated test covers parsing a `STATE_UPDATE`-shaped payload and producing **table-bound props** (e.g. extend [`mapPlayerGameViewToGameTable.test.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts) with a fixture that mirrors a real `STATE_UPDATE.state` object), **or** an E2E path exercises a live room (project convention: Vitest + `vite-plus/test`).

5. **AC5 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass.

## Tasks / Subtasks

- [x] Task 1: Protocol + transport layer (AC: 1–3)
  - [x] 1.1 Implement a **single** WebSocket lifecycle for the room session (connect, close on leave, optional reconnect hook). Use browser `WebSocket`; message shape matches shared protocol (`version`, `type` discriminant). Prefer a **composable** (e.g. `useRoomConnection`) and/or a **Pinia store** for connection/session token — align intent with [`project-context.md`](../project-context.md) (game state not in Pinia; connection/token UI may be).
  - [x] 1.2 **WebSocket URL:** Choose a deterministic dev/prod strategy (e.g. new `VITE_WS_BASE_URL` or derive `ws://` / `wss://` from `window.location` and the server port). Document the chosen env var in the implementation PR; default must work with local `vp dev` + server on the documented port.
  - [x] 1.3 On open after `JOIN_ROOM`, handle **server → client** messages defined in shared types: at minimum [`StateUpdateMessage`](../../packages/shared/src/types/protocol.ts), [`ServerErrorMessage`](../../packages/shared/src/types/protocol.ts), [`SystemEventMessage`](../../packages/shared/src/types/protocol.ts). Parse JSON safely; verify `version === PROTOCOL_VERSION` before trusting payloads. Ignore or log unknown `type` strings without crashing.
  - [x] 1.4 Persist **`token`** from `STATE_UPDATE` per [`game-architecture.md`](../planning-artifacts/game-architecture.md) (sessionStorage) and include `token` on subsequent `JOIN_ROOM` reconnects.
  - [x] 1.5 Parse `STATE_UPDATE`: narrow `state` with **`state.gamePhase === "lobby"`** → `LobbyState`; otherwise **`PlayerGameView`** (all non-lobby phases). Do not use structural checks that confuse `LobbyState` with game-over/scoreboard views.

- [x] Task 2: View composition (AC: 1–2)
  - [x] 2.1 Add a **production** route (e.g. `/room/:code` per project-context) and a parent view that hosts the WebSocket-driven UI. [`HomeView`](../../packages/client/src/views/HomeView.vue) currently has no room flow — add navigation entry or minimal link for local testing as needed.
  - [x] 2.2 When `PlayerGameView`: `const tableProps = mapPlayerGameViewToGameTableProps(view)` and bind to `GameTable` **v-bind** spread or explicit props; pass `:resolved-action="resolvedAction"` from the message.
  - [x] 2.3 When `LobbyState`: render lobby / pre-start shell only — **do not** mount `GameTable` as the active game. Host controls (e.g. `SET_JOKER_RULES`) can stay dev-only or move behind host UI per scope you define; document in completion notes.
  - [x] 2.4 Wire `GameTable` **emits** to send `ACTION` messages (reuse action shapes from `@mahjong-game/shared`). Do **not** call `handleAction` from shared on the client for authoritative state.
  - [x] 2.5 **Rack store reconciliation:** [`useRackStore`](../../packages/client/src/stores/rack.ts) owns tile **order** and selection. On each `PlayerGameView` update, reconcile `tileOrder` with the new `myRack` tile IDs (retain order for tiles that still exist; append new IDs; drop removed IDs; clear selection if the selected ID disappears). Failure to reconcile causes stale order after draws/discards/calls.

- [x] Task 3: Mapper / prop gaps (AC: 1)
  - [x] 3.1 **`invalidMahjongMessage`:** Mapper hard-codes `null`. Wire [`InvalidMahjongNotification`](../../packages/client/src/components/game/GameTable.vue) from `view.pendingMahjong` and/or `resolvedAction` (`INVALID_MAHJONG_WARNING`) per existing engine semantics — extend [`mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) or map in the parent; add/update tests.
  - [x] 3.2 **`canRequestTableTalkReport`:** Mapper hard-codes `false`. Replace with eligibility derived from `PlayerGameView` + `tableTalkReportState` (mirror Story **3C.5** / server rules in [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts)); ensure Table Talk UI can appear when the server allows it.

- [x] Task 4: Tests (AC: 4–5)
  - [x] 4.1 **Unit:** JSON fixture of `StateUpdateMessage` (or minimal `state: PlayerGameView`) → assert `mapPlayerGameViewToGameTableProps` output keys used by `GameTable`, or test a small `parseStateUpdate` helper if extracted.
  - [ ] 4.2 Optional: component test for room shell switching lobby vs game. Co-locate `*.test.ts`; import from `vite-plus/test`. **Deferred** — AC4 covered by parse→map integration test in `mapPlayerGameViewToGameTable.test.ts`.
  - [x] 4.3 Run full regression gate (AC5).

- [x] Task 5: Docs / handoff
  - [x] 5.1 If `state-broadcaster` / protocol types are **unchanged**, note “no server edits required.” If client work reveals a protocol bug, fix in shared + server and run [`state-broadcaster.test.ts`](../../packages/server/src/websocket/state-broadcaster.test.ts).

## Dev Notes

### Scope boundaries

- **In scope:** First-class **production** path from WebSocket `STATE_UPDATE` → `GameTable` via existing mapper; lobby vs game; `ACTION` dispatch; AR5; session token handling; tests per AC4.
- **Out of scope:** Story **3C.9** (`useTileSelection` for call confirmation refactor); Epic **6A** chat; full Epic **4B** reconnection productization (handle `REQUEST_STATE` / reconnect basics if trivial, but defer deep resilience to 4B).

### Existing implementation (do not reinvent)

| Artifact | Location |
| -------- | -------- |
| `PlayerGameView` → `GameTable` prop mapping | [`mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) |
| Mapper unit tests | [`mapPlayerGameViewToGameTable.test.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts) |
| Dev reference (fixture + `GameTable`) | [`PlayerGameViewBridgeShowcase.vue`](../../packages/client/src/components/dev/PlayerGameViewBridgeShowcase.vue) |
| Wire types | [`protocol.ts`](../../packages/shared/src/types/protocol.ts) — `StateUpdateMessage`, `LobbyState`, `PlayerGameView`, `ActionMessage` |
| Server broadcast contract (read-only reference) | [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts), [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) |

### Architecture compliance

- **AR5 / no optimistic updates:** [`game-architecture.md`](../planning-artifacts/game-architecture.md) — client renders from `STATE_UPDATE` only; see **No optimistic updates** under WebSocket protocol.
- **Three-tier state:** [`project-context.md`](../project-context.md) — game state from server messages; Pinia for rack ordering / UI only; do not store authoritative `GameState` in Pinia.
- **Components stay dumb:** `GameTable` and children remain prop/emit driven; connection logic lives in composables/views, not inside presentational game components.

### Technical requirements (guardrails)

| Requirement | Detail |
| ----------- | ------ |
| Protocol version | Reject or no-op inbound messages where `version !== PROTOCOL_VERSION` (import from `@mahjong-game/shared`). |
| Message union | Server → client types in [`protocol.ts`](../../packages/shared/src/types/protocol.ts): `STATE_UPDATE`, `ERROR`, `SYSTEM_EVENT` — extend client parser if the server adds types later. |
| `resolvedAction` | Forward to `GameTable` for Motion/animation hooks; optional on each `STATE_UPDATE`. |
| `ERROR` UX | Show non-blocking feedback (toast/subtle) per architecture; never mutate game state from `ERROR`. |
| `SYSTEM_EVENT` | Handle `SESSION_SUPERSEDED` (second tab) and `ROOM_CLOSING` per [`game-architecture.md`](../planning-artifacts/game-architecture.md). |

### Likely files to add or touch

| Area | Suggested paths (adjust to final design) |
| ---- | ---------------------------------------- |
| Route + view | [`router/index.ts`](../../packages/client/src/router/index.ts), new `views/RoomView.vue` (or similar) |
| WebSocket composable | `composables/useRoomWebSocket.ts` (name flexible) |
| Env types | [`env.d.ts`](../../packages/client/env.d.ts) if new `VITE_*` vars |
| Mapper | [`mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) |
| Rack | [`stores/rack.ts`](../../packages/client/src/stores/rack.ts) — reconciliation helpers |

### Testing requirements

- Co-located `*.test.ts`; imports from `vite-plus/test` (not `vitest` directly).
- Prefer a **fixture** copied from server test output or [`mapPlayerGameViewToGameTable.test.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts) minimal view builder, extended toward “realistic” `PlayerGameView` shapes.
- Backpressure gate before commit: `pnpm test && pnpm run typecheck && vp lint` ([`AGENTS.md`](../../AGENTS.md)).

### Anti-patterns (do not)

- Calling `handleAction` / mutating a local `GameState` on the client as if it were authoritative.
- Duplicating seat/discard mapping logic outside `mapPlayerGameViewToGameTableProps` without strong reason.
- Skipping rack reconciliation — leads to ghost tiles or wrong discard target after `STATE_UPDATE`.

### Validation checklist

Paste from [`story-validation-checklist.md`](story-validation-checklist.md) during review. If this story **changes** `PlayerGameView` serialization or `state-broadcaster`, run `state-broadcaster.test.ts` and relevant WebSocket integration tests.

### Project structure notes

- **No import aliases** — relative imports or `@mahjong-game/shared` per [`CLAUDE.md`](../../CLAUDE.md).
- Router: extend [`router/index.ts`](../../packages/client/src/router/index.ts).

### Cross-session intelligence

- Epic **3B** retro and **5A** follow-up: `mapPlayerGameViewToGameTable` + dev bridge already landed; this story connects **live** `STATE_UPDATE` to the same path.
- **3C.9** follows for call-confirmation selection consistency.

### Previous story intelligence (3C.7)

- Source: [`3c-7-concealed-hand-validation-at-mahjong.md`](3c-7-concealed-hand-validation-at-mahjong.md) — protocol/types may carry new fields; align mapper and tests when `PlayerGameView` exposes them.

### References

- [`epics.md`](../planning-artifacts/epics.md) — Epic 3C intro, Story 3C.8 (lines ~2422–2444)
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — WebSocket, session token, view filtering
- [`project-context.md`](../project-context.md) — WebSocket protocol, server authority, testing

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation).

### Debug Log References

### Completion Notes List

- Production path: `useRoomConnection` + `parseServerMessage` + `JOIN_ROOM` with `sessionStorage` token; dev default WebSocket `ws://<host>:3001` (`getWebSocketUrl`), override with `VITE_WS_BASE_URL`; HTTP API `getApiBaseUrl` default `http://<host>:3001` in dev, override with `VITE_API_BASE_URL`.
- `RoomView.vue`: lobby shell (host: `SET_JOKER_RULES`, `START_GAME`) vs `GameTable` for non-lobby `PlayerGameView`; `resolvedAction` passed separately; `gameActionFromPlayerView` maps emits to `ACTION` (no `handleAction` on client).
- Mapper: optional `resolvedAction` for `invalidMahjongMessage`; `canRequestTableTalkReport` mirrors server preconditions (`MAX_PLAYERS`, phase, blockers, count &lt; 2).
- Task 5.1: **No server or shared protocol changes** were required; `state-broadcaster` unchanged.
- Code review (2026-04-04): In-session **ERROR** banner on `RoomView` when lobby or `GameTable` is visible (`clearLastError` on `useRoomConnection`); play-phase **STATE_UPDATE** JSON → `parseServerMessage` → `mapPlayerGameViewToGameTableProps` integration test; Task 4.2 left unchecked (deferred optional shell test).

### File List

- `_bmad-output/implementation-artifacts/3c-8-websocket-client-state-update-to-gametable.md`
- `packages/client/src/composables/useRoomConnection.ts` (new)
- `packages/client/src/composables/parseServerMessage.ts` (new)
- `packages/client/src/composables/wsUrl.ts` (new)
- `packages/client/src/composables/apiBaseUrl.ts` (new)
- `packages/client/src/composables/sessionTokenStorage.ts` (new)
- `packages/client/src/composables/gameActionFromPlayerView.ts` (new)
- `packages/client/src/composables/parseServerMessage.test.ts` (new)
- `packages/client/src/views/RoomView.vue` (new)
- `packages/client/src/router/index.ts`
- `packages/client/src/views/HomeView.vue`
- `packages/client/env.d.ts`
- `packages/client/src/stores/rack.ts`
- `packages/client/src/stores/rack.test.ts` (new)
- `packages/client/src/composables/mapPlayerGameViewToGameTable.ts`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-04: Implemented WebSocket room session, `/room/:code`, `STATE_UPDATE` → `GameTable`, rack reconciliation, mapper gaps, tests; sprint status → review.
- 2026-04-04: GDS code review follow-up — ERROR banner + dismiss, AC4 integration test, story/sprint → done.
- 2026-04-04: Second pass — staged and committed full client diff (transport composables, `HomeView` room flow, rack reconciliation, mapper); File List includes story file.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (gds-create-story workflow). **Second pass (2026-04-04):** added transport URL/version handling, server message inventory, rack-store reconciliation, mapper gaps (`invalidMahjongMessage`, `canRequestTableTalkReport`), technical-requirements table, anti-patterns, and likely file paths.
