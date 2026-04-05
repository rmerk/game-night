# Story 4B.1: Reconnection with Full State Restore

Status: done

<!-- Ultimate context engine — 2026-04-05. First story in Epic 4B: Multiplayer Resilience. Much of the token reconnection backbone already exists (6A.4 and earlier). This story closes the remaining gaps (`PLAYER_RECONNECTING` broadcast, tokenless grace-period recovery, seat-position UX, `sendPostStateSequence` helper, Playwright E2E) and establishes the reconnection contract that Stories 4B.2–4B.6 extend. -->
<!-- Pass 2 (2026-04-05): AC7 decision locked to `buildCurrentStateMessage` + helper (no dual-path). AC2 simplified. AC3 restricted to in-game phases. Disconnect broadcast now *replaces* the final untyped broadcast (was duplicate). Task 5.1 fixed to use `player.name` (not `displayName`) per `OpponentPlayer` type. Task 4 tightened on disconnect-timeout cancel and sanitized displayName comparison. Added `setGracePeriodMs` test-speedup option. Added note on empty-seat vs disconnected-player UI branch. -->

## Story

As a **player**,
I want **to refresh my browser or recover from a network hiccup and seamlessly return to my seat with full game state restored**,
so that **a brief drop doesn't ruin game night (FR104, FR105, FR106, AR11)**.

## Acceptance Criteria

1. **AC1 — Disconnect detection starts grace period and broadcasts `PLAYER_RECONNECTING`:** Given a player has a live WebSocket session in a room, when that socket closes (explicit `close`, network drop, or heartbeat `terminate` via [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) after 2 missed pings — ~30s worst-case detection), then [`registerDisconnectHandler`](../../packages/server/src/websocket/join-handler.ts) marks `player.connected = false`, starts a grace timer of **`getGracePeriodMs()` (default `DEFAULT_GRACE_PERIOD_MS = 30_000`)** in `room.graceTimers`, and **broadcasts `{ type: "PLAYER_RECONNECTING", playerId, playerName: player.displayName }`** as the `resolvedAction` on a single `broadcastStateToRoom(room, playerId, ...)` call. **This replaces the existing final untyped `broadcastStateToRoom(room)` at the bottom of the close handler — do not emit two broadcasts.** The existing close handler's `broadcastStateToRoom(room)` (no excludes, no resolvedAction) exists today only to propagate the `connected=false` state change; the new call carries the same state change plus the typed resolvedAction. `player.connectedAt` is **not** overwritten; if a disconnect timestamp is needed for logs, capture it as a local `const disconnectedAt = Date.now()` inside the close handler (FR104, FR106). The grace timer must **not** fire if the socket close is the result of a `SESSION_SUPERSEDED` handoff — see AC10; the existing guard `if (!session || session.ws !== ws) return;` already prevents this and must run **before** any `connected=false` mutation or broadcast.

2. **AC2 — `PLAYER_RECONNECTING` shape and wire:** Given the disconnect broadcast, when clients receive it, then they see a `StateUpdateMessage` whose `resolvedAction` is `{ type: "PLAYER_RECONNECTING", playerId, playerName }`. Add the discriminant to the [`ResolvedAction`](../../packages/shared/src/types/game-state.ts) union next to the existing `PLAYER_RECONNECTED` variant. No new export from `packages/shared/src/index.ts` is needed — `ResolvedAction` flows through `StateUpdateMessage.resolvedAction` which is already exported. Client consumers read `resolvedAction.value.type === "PLAYER_RECONNECTING"` on the existing `resolvedAction` shallowRef in [`useRoomConnection`](../../packages/client/src/composables/useRoomConnection.ts). The reconnecting player's own subsequent state update (when they later reconnect) carries `{ type: "PLAYER_RECONNECTED", ... }` in the **others'** state broadcasts; the reconnecting client itself receives `STATE_UPDATE` without a `resolvedAction` (existing `handleTokenReconnection` behavior — preserved).

3. **AC3 — Seat-position reconnecting indicator (UX-DR38):** Given a player's `PlayerPublicInfo.connected === false` in [`PlayerGameView.players`](../../packages/shared/src/types/protocol.ts), when the game is in an **active game phase** (i.e. `playerGameView.value !== null` — lobby is out of scope for this story, see Scope boundaries), then [`OpponentArea.vue`](../../packages/client/src/components/game/OpponentArea.vue) renders a gentle "{player.name} is reconnecting…" label below the name line (tone muted via existing `text-text-on-felt/85` or equivalent design token, no spinner, informational). The label is additive — the existing connected-dot badge already flips to `tone="muted"` when `connected: false` (line 39 of `OpponentArea.vue`). The label sits inside the existing `<template v-if="player">` block only — the empty-seat `<template v-else>` branch (no `player` object) does **not** render the label. The label clears automatically when `connected` flips back to `true` on the next `STATE_UPDATE`; there is no local component state to reset. If `player.name` is empty, the existing truncation/fallback handling applies — do not add a separate "Player is reconnecting…" fallback string (the mapper + `sanitizeDisplayName` already guarantee non-empty names).

4. **AC4 — Token reconnection cancels grace, sends `PLAYER_RECONNECTED`:** Given a player's client reads its session token from [`sessionTokenStorage`](../../packages/client/src/composables/sessionTokenStorage.ts) and sends `JOIN_ROOM` with `{ roomCode, token }`, when [`handleTokenReconnection`](../../packages/server/src/websocket/join-handler.ts) runs, then it (already implemented) cancels `room.graceTimers.get(playerId)`, cancels the `disconnect-timeout` lifecycle timer, restores `player.connected = true`, installs the new session, sends a filtered `STATE_UPDATE` (with `token`), sends `CHAT_HISTORY` **immediately after** that `STATE_UPDATE`, and broadcasts `{ type: "PLAYER_RECONNECTED", playerId, playerName }` to all other sessions. This story **does not** re-implement any of that — it (a) routes the paired `STATE_UPDATE`/`CHAT_HISTORY` send through the new `sendPostStateSequence` helper (AC7), and (b) adds the test coverage below (AC13).

5. **AC5 — Full state restored to the reconnecting client:** Given the reconnecting client applies the post-reconnect `STATE_UPDATE`, when [`applyStateUpdate`](../../packages/client/src/composables/useRoomConnection.ts) runs, then `playerGameView` is replaced with a complete filtered view: `myRack`, `exposedGroups`, `discardPools`, `wallRemaining`, `currentTurn`, `turnPhase`, `callWindow`, `scores`, `lastDiscard`, `gameResult`, `pendingMahjong`, `challengeState`, `socialOverrideState`, `tableTalkReportState`, `charleston`, `shownHands`, `myDeadHand`, and `jokerRulesMode`. This is a regression-gate assertion — the server already sends this via [`buildPlayerView`](../../packages/server/src/websocket/state-broadcaster.ts); the story adds an explicit test (see Tasks) that proves every field survives a disconnect→reconnect round-trip (FR105).

6. **AC6 — Client-only state explicitly discarded on reconnect:** Given the reconnecting client's rack arrangement and drag-drop ordering are local component state (held in [`useRackDragDrop`](../../packages/client/src/composables/useRackDragDrop.ts) / `TileRack`), when the client applies the reconnect `STATE_UPDATE`, then rack tile arrangement is replaced by the server's `myRack` order — prior arrangement is not persisted or rehydrated. The Sort button (5A.3) provides quick recovery. Document this in the story dev notes so no one tries to "fix" it by adding sessionStorage for rack order. **Not** a code change; it's a behavior contract the tests must not violate.

7. **AC7 — `sendPostStateSequence` helper (retro follow-through `6a-retro-2`):** Extract a new server helper `sendPostStateSequence(ws, stateMessage, room, logger, context)` in a new file [`packages/server/src/websocket/post-state-sequence.ts`](../../packages/server/src/websocket/). The helper owns the canonical per-socket post-state send order: `STATE_UPDATE → CHAT_HISTORY`. Signature — the caller passes a pre-built `StateUpdateMessage` (the helper does **not** build state; it only serializes and sends), the helper checks `ws.readyState !== WebSocket.OPEN` and returns early with a debug log (mirror `trySendJson`), otherwise `ws.send(JSON.stringify(stateMessage))` wrapped in try/catch → warn-on-failure, then calls `sendChatHistoryAfterStateUpdate(ws, room, logger, context)`. To eliminate the dual-path problem at the `REQUEST_STATE` call site, **refactor** [`sendCurrentState`](../../packages/server/src/websocket/state-broadcaster.ts) by extracting `buildCurrentStateMessage(room, playerId): StateUpdateMessage | null` (returns `null` if no player view can be built) in `state-broadcaster.ts`. Delete `sendCurrentState` after migrating its single caller (the `REQUEST_STATE` branch in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts)) to `sendPostStateSequence(ws, buildCurrentStateMessage(...), room, logger, "request-state")`. Update the three current paired-send call sites to route through the helper: (1) [`handleJoinRoom`](../../packages/server/src/websocket/join-handler.ts) initial-join branch (build lobby state message → helper), (2) [`handleTokenReconnection`](../../packages/server/src/websocket/join-handler.ts) (build filtered player view message → helper), (3) `REQUEST_STATE` branch in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts). The `broadcastStateToRoom` fan-out does **not** use the helper (it serves multiple sockets and does not carry chat history — chat history is a per-socket join/reconnect/resync payload). Tests assert message ordering for all three call sites.

8. **AC8 — Tokenless grace-period recovery (architecture line 534):** Given a client reconnects **without** a token (token write failed between `STATE_UPDATE` and socket close, or tab never persisted it), when [`handleJoinRoom`](../../packages/server/src/websocket/join-handler.ts) runs and no valid token matches, then **before** falling through to new-player join, the server attempts a recovery: first `sanitizeDisplayName(message.displayName)` (existing helper) and reject on empty/invalid; then scan `room.players` for entries where `connected === false` **and** `room.graceTimers.has(playerId)`, collecting matches whose **stored** `player.displayName.toLowerCase() === sanitizedInbound.toLowerCase()`. Both sides are compared post-sanitization (server-stored names are already sanitized at first join; sanitize the inbound name once before the loop). If exactly **one** match: reissue a fresh token via `createSessionToken` (which internally revokes the old token), follow the same reattach path as AC4 through the shared helper extracted in Task 4.5, and broadcast `PLAYER_RECONNECTED`. If **zero** or **more than one** in-grace player matches, fall through to normal new-player join (no auto-claim). If a name-matching player exists but is not in grace (`graceTimers` entry absent), treat as no match — the seat is either live (`connected === true`) or already released, neither of which is a recovery candidate. Do **not** match against `connected === true` players (would steal a live seat).

9. **AC9 — Seat recycling does not re-fire `PLAYER_RECONNECTING`:** Given grace period expires without reconnection, when [`registerDisconnectHandler`](../../packages/server/src/websocket/join-handler.ts)'s grace-timer callback runs and releases the seat, then the downstream `broadcastStateToRoom(room)` sends a `STATE_UPDATE` **without** a `PLAYER_RECONNECTING` resolved action (transition from "reconnecting" to "seat released"). A separate story (4B.2 phase-specific fallbacks) will decide whether to emit a dedicated seat-release resolved action; for 4B.1, the broadcast stays untyped — just the state change. This AC exists to prevent the implementer from re-broadcasting `PLAYER_RECONNECTING` inside the grace-expiry timer.

10. **AC10 — `SESSION_SUPERSEDED` does not trigger `PLAYER_RECONNECTING`:** Given a second connection supersedes the first via `handleTokenReconnection` (existing behavior), when the old socket's `close` event fires after the `SESSION_SUPERSEDED` frame, then the disconnect handler must bail early: it already checks `if (!session || session.ws !== ws) return;` — verify this guard holds. Add a test that asserts: superseded old socket's `close` firing does **not** set `player.connected = false`, does **not** start a grace timer, does **not** broadcast `PLAYER_RECONNECTING`. This is a known transition pitfall that 6A retrospective flagged (see Transition scenarios below).

11. **AC11 — Client reset ordering through `resetSocialUiForSession` (retro follow-through `6a-retro-3`):** Given a client's socket closes (either explicit `disconnect()` or unexpected `close` event), when [`useRoomConnection`](../../packages/client/src/composables/useRoomConnection.ts) handles the close, then [`resetSocialUiForSession`](../../packages/client/src/composables/useRoomConnection.ts) is the single extension point for clearing session-scoped state — do **not** introduce a parallel `resetGameStateForSession` or fork the reset path. For 4B.1, `resetSocialUiForSession` is **not modified** (chat + reactions + slide-in are the right things to clear between sessions; game state `lobbyState` / `playerGameView` / `resolvedAction` are cleared separately in `connect()` and should stay there). If a later 4B story needs game-state clearing on close, it extends `resetSocialUiForSession` in place. Dev notes reference the function by name and file path.

12. **AC12 — Transition scenarios covered by tests (retro follow-through `6a-retro-1`):** Every transition scenario listed in the "Transition scenarios" section below has at least one test — unit, integration, or Playwright. Pass-1 code review must walk each row and confirm a referenced test. If any row has no test, the story is not `done`.

13. **AC13 — Playwright E2E for basic reconnection:** A Playwright test (new file, e.g. `packages/client/e2e/reconnection.spec.ts` or wherever existing e2e infra lives — confirm in Task 7.1) drives the following scenario end-to-end against a real server: (1) Player A joins room, game starts, Player A draws a tile; (2) Player A's WebSocket is forcibly closed (client-side `ws.close()` or navigate-away); (3) Opposing clients see the "reconnecting…" label at Player A's seat within 1s of the disconnect; (4) Player A reloads the page with session token still in `sessionStorage`; (5) Player A's client reconnects, receives full `PlayerGameView` with the previously drawn tile still in `myRack`, current turn still Player A, `turnPhase` still `post-draw`; (6) Opposing clients see the reconnecting label clear and receive a `PLAYER_RECONNECTED` resolvedAction. If no Playwright harness exists yet in the repo, scope this AC to a Vitest-driven integration test that exercises the same sequence through [`full-game-flow.test.ts`](../../packages/server/src/integration/full-game-flow.test.ts) style — and explicitly note in dev notes that E2E harness setup is a separate Epic 4B task (not this story).

14. **AC14 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass from the repo root ([`AGENTS.md`](../../AGENTS.md)). No flaky tests introduced: grace-timer tests must use **either** `vi.useFakeTimers()` (preferred for precise expiry assertions) **or** [`setGracePeriodMs(ms)`](../../packages/server/src/rooms/session-manager.ts) to shrink the window to e.g. 50ms (simpler for integration tests that are already driving real sockets). Never `await new Promise(r => setTimeout(r, 30_000))`. Tests that mutate `setGracePeriodMs` **must** restore `DEFAULT_GRACE_PERIOD_MS` in `afterEach` to avoid leaking into unrelated tests.

### Transition scenarios (retro follow-through `6a-retro-1`)

Every row must be enumerated in the implementation and covered by at least one test. Pass-1 review walks this table.

| # | Scenario | Who moves | Expected behavior | Test touchpoint |
|---|----------|-----------|-------------------|-----------------|
| T1 | Lobby → game start, then player disconnects mid-turn | Current turn player | Grace starts; `PLAYER_RECONNECTING` broadcast; server state unchanged; other players see reconnecting label | AC1, AC2, AC3, AC13 |
| T2 | Disconnect → reconnect with token mid-turn | Same player | Grace cancelled; full `PlayerGameView` restored; `myRack` contains the drawn tile; `PLAYER_RECONNECTED` broadcast | AC4, AC5, AC13 |
| T3 | Disconnect → grace expires → seat released | Disconnected player | `player.connected=false` → seat removed; no second `PLAYER_RECONNECTING` at release; no PLAYER_RECONNECTED on later stale socket | AC9 |
| T4 | `SESSION_SUPERSEDED` — new socket reclaims seat, old socket close event fires after | Same player across two sockets | Old `close` is a no-op: no `connected=false`, no grace timer, no `PLAYER_RECONNECTING` broadcast | AC10 |
| T5 | Tokenless reconnect during grace, exactly one matching in-grace `displayName` | Player who lost token | Server reissues token, re-attaches to same seat, `PLAYER_RECONNECTED` broadcast | AC8 |
| T6 | Tokenless reconnect during grace, zero matching or multiple matching | Player with collision or none | Falls through to normal new-player join (new seat if capacity allows) | AC8 |
| T7 | Tokenless reconnect after grace expired | Player who lost token | Seat already gone → normal new-player join | AC8 |
| T8 | Disconnect during `charleston` / `call-window` / `discard` / `scoreboard` phases | Any seat | Grace starts and `PLAYER_RECONNECTING` broadcasts for **every** phase; phase-specific fallback actions are **Story 4B.2's** problem (auto-pass, auto-discard, forfeit). 4B.1 stops at "grace started" | AC1, AC12 |
| T9 | Heartbeat-based detection (2 missed pings → `terminate`) rather than explicit close | Any seat | Grace handler fires same as explicit close (already wired via `ws.terminate()` → `close` event in `ws-server.ts`) | AC1 |
| T10 | Reconnect during `REQUEST_STATE` resync path (already-joined client refreshing its view) | Any seat | `sendPostStateSequence` helper delivers `STATE_UPDATE` → `CHAT_HISTORY` in order; no grace timer involvement (connection never closed) | AC7 |
| T11 | Player departure (explicit leave, Story 4B.5) — OUT OF SCOPE here but enumerated | Departing player | 4B.1 does **not** introduce departure handling. Any "leave" today falls through as a normal socket close → grace → seat release (same as T3) until 4B.5 differentiates them | Out of scope (flag only) |
| T12 | Host migration after host disconnect — OUT OF SCOPE here | Host seat | 4B.1 does **not** implement host migration. If the host's grace expires, the seat releases via T3 but no `HOST_PROMOTED` event is emitted. Story 4B.6 handles host migration end-to-end | Out of scope (flag only) |
| T13 | Rack arrangement across reconnect | Reconnecting player | Local rack order is **lost**, replaced by server `myRack` order. Sort button recovers. Document in dev notes; no persistence | AC6 |
| T14 | `resetSocialUiForSession` on close | Any seat | Chat / reactions / slide-in cleared on `close` before next `CHAT_HISTORY` arrives; no stale transcript merge | AC11, existing 6A.4 tests |

### Scope boundaries

| In scope (4B.1) | Out of scope |
| ---------------- | ------------- |
| Grace-period detection + `PLAYER_RECONNECTING` broadcast | Phase-specific fallbacks on grace expiry (Story 4B.2) |
| Token reconnect restoring full state + `PLAYER_RECONNECTED` broadcast (harden existing path) | Simultaneous 2+ disconnect pause (Story 4B.3) |
| Tokenless grace-period recovery via displayName match | Turn timeout / AFK escalation (Story 4B.4) |
| Seat-position "{name} is reconnecting…" label | Player departure / dead seat (Story 4B.5) |
| `sendPostStateSequence` helper covering 3 current call sites | Host migration (Story 4B.6) |
| Transition scenarios section + tests for each row | Host settings / 5th player (Story 4B.7) |
| Basic Playwright (or integration) E2E for reconnection | Persistent chat across server restart / DB |
| Regression gate (pnpm test + typecheck + vp lint) | New dependencies / new protocol version bump |

## Tasks / Subtasks

- [x] **Task 1: Shared protocol — `PLAYER_RECONNECTING` discriminant** (AC: 2, 14)
  - [x] 1.1 Add `| { readonly type: "PLAYER_RECONNECTING"; readonly playerId: string; readonly playerName: string }` to the `ResolvedAction` union in [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) next to `PLAYER_RECONNECTED`.
  - [x] 1.2 Confirm nothing else in [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts) needs re-export — `ResolvedAction` flows through `StateUpdateMessage` already.
  - [x] 1.3 `pnpm run typecheck` — every `switch` on `ResolvedAction.type` either handles the new variant or has an exhaustiveness assertion. Fix any TS2367 / never-check breakage.

- [x] **Task 2: Server — disconnect handler broadcasts `PLAYER_RECONNECTING`** (AC: 1, 9, 10, 14)
  - [x] 2.1 In [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler`, after `player.connected = false` and the `logger.info` disconnect log, and after the grace `setTimeout` is installed + `allPlayersDisconnected` lifecycle check runs, **replace** the existing terminal `broadcastStateToRoom(room)` (last line of the close handler) with `broadcastStateToRoom(room, playerId, { type: "PLAYER_RECONNECTING", playerId, playerName: player.displayName })`. The previous untyped broadcast existed only to propagate `connected=false`; the typed broadcast carries the same state update plus the explicit resolvedAction. Result: **exactly one** broadcast per disconnect.
  - [x] 2.2 Inside the grace-expiry `setTimeout` callback (after `room.players.delete(playerId)` and `room.sessions.delete(playerId)`), leave the existing terminal `broadcastStateToRoom(room)` **untyped** — no `PLAYER_RECONNECTING`, no new resolvedAction (AC9). A later story (4B.2 or 4B.5) can introduce a seat-release resolved action; 4B.1 does not.
  - [x] 2.3 Guard against superseded close (AC10): the existing `if (!session || session.ws !== ws) return;` check must run **before** any connected-flag mutation or broadcast. Verify by code reading, then add a unit test (Task 6.2).
  - [x] 2.4 Logging: add `logger.info({ roomCode, playerId, disconnectedAt: Date.now() }, "PLAYER_RECONNECTING broadcast, grace period started")` so ops can grep reconnect lifecycle events. Use a local `const disconnectedAt = Date.now()` — do **not** mutate `player.connectedAt`.

- [x] **Task 3: Server — `sendPostStateSequence` helper + `buildCurrentStateMessage` extraction** (AC: 7, 14)
  - [x] 3.1 Create `packages/server/src/websocket/post-state-sequence.ts`. Export `sendPostStateSequence(ws: WebSocket, stateMessage: StateUpdateMessage, room: Room, logger: FastifyBaseLogger, context: string): void`. Behavior: early-return with debug log if `ws.readyState !== WebSocket.OPEN`; otherwise wrap `ws.send(JSON.stringify(stateMessage))` in try/catch → `logger.warn` on failure; then call `sendChatHistoryAfterStateUpdate(ws, room, logger, context)` only if the state send did not throw. Mirror the `trySendJson` pattern from [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts).
  - [x] 3.2 In [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts), extract `buildCurrentStateMessage(room: Room, playerId: string): StateUpdateMessage` that returns the exact same `{ version, type: "STATE_UPDATE", state }` shape that `sendCurrentState` currently builds (lobby vs filtered game view branch preserved). Delete `sendCurrentState` once all call sites are migrated (the single caller is the `REQUEST_STATE` branch in `ws-server.ts`).
  - [x] 3.3 Migrate the three paired-send call sites to the helper:
    - [`handleJoinRoom`](../../packages/server/src/websocket/join-handler.ts) initial-join branch: replace the inline `ws.send(JSON.stringify(stateMessage))` + `sendChatHistoryAfterStateUpdate(...)` pair with `sendPostStateSequence(ws, stateMessage, room, logger, "join-room")`. The `stateMessage` still includes the fresh `token` field (lobby state + token).
    - [`handleTokenReconnection`](../../packages/server/src/websocket/join-handler.ts): same replacement. The `stateMessage` is the filtered player view + token. `broadcastStateToRoom(room, playerId, { type: "PLAYER_RECONNECTED", ... })` stays as a separate call — the helper does not own fan-out broadcasts.
    - `REQUEST_STATE` branch in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts): replace `sendCurrentState(session.room, session.playerId, ws); sendChatHistoryAfterStateUpdate(...)` with `const stateMessage = buildCurrentStateMessage(session.room, session.playerId); sendPostStateSequence(ws, stateMessage, session.room, logger, "request-state")`.
  - [x] 3.4 Add JSDoc comment block on `sendPostStateSequence`: `/** Canonical per-socket post-STATE_UPDATE send order lives here. New messages added in Epic 4B (PLAYER_RECONNECTED post-state metadata, grace-cancel signals, phase fallbacks) that must land on the SAME socket immediately after STATE_UPDATE go INSIDE this helper and nowhere else. Fan-out broadcasts via broadcastStateToRoom are a separate mechanism. See 6A retrospective action item 6a-retro-2. */`
  - [x] 3.5 Unit tests for the helper (Task 6.1): ordering (STATE_UPDATE before CHAT_HISTORY), `CHAT_HISTORY` not sent if `STATE_UPDATE` send throws, empty chat history still emits the `CHAT_HISTORY` frame with `messages: []`, closed socket → early return with no sends.

- [x] **Task 4: Server — tokenless grace-period recovery** (AC: 8, 14)
  - [x] 4.1 **Refactor first (prerequisite for 4.2):** Extract `attachToExistingSeat(ws: WebSocket, room: Room, playerId: string, token: string, logger: FastifyBaseLogger, roomManager?: RoomManager): void` from the body of `handleTokenReconnection`. The extracted function owns: supersede existing session (send `SESSION_SUPERSEDED`, close old ws), clear `room.graceTimers.get(playerId)`, `cancelLifecycleTimer(room, "disconnect-timeout")`, flip `player.connected = true`, set `player.connectedAt = Date.now()`, install new `PlayerSession` in `room.sessions`, build filtered `stateMessage` with token via `buildPlayerView`/`buildLobbyState` + `buildCurrentStateMessage` helper, route through `sendPostStateSequence`, broadcast `{ type: "PLAYER_RECONNECTED", playerId, playerName }` to other sessions via `broadcastStateToRoom(room, playerId, ...)`, and `registerDisconnectHandler(ws, room, playerId, logger, roomManager)`. `handleTokenReconnection` now shrinks to: `resolveToken` → if no match return false → lookup player → call `attachToExistingSeat(ws, room, playerId, token, logger, roomManager)` → return true. **Do not duplicate reattach logic** in Step 4.2.
  - [x] 4.2 In `handleJoinRoom`, **after** the `token && handleTokenReconnection(...)` branch returns false (invalid token) **or** no token was provided, and **before** `sanitizeDisplayName` gates new joins: sanitize the inbound `message.displayName` once (`const sanitizedName = sanitizeDisplayName(message.displayName)`; if null, fall through to the existing invalid-display-name error path — do **not** attempt recovery). Then scan `room.players.values()` for entries where `connected === false && room.graceTimers.has(playerId) && player.displayName.toLowerCase() === sanitizedName.toLowerCase()`. Collect matches into an array.
  - [x] 4.3 If `matches.length === 1`: call `createSessionToken(room, matches[0].playerId)` to mint a fresh token (the helper revokes the old one internally, but since the client lost it, there may not be one to revoke — either way is safe), then `attachToExistingSeat(ws, room, matches[0].playerId, newToken, logger, roomManager)`. Log `logger.info({ roomCode, playerId: matches[0].playerId, displayName: sanitizedName }, "Player reconnected via displayName grace recovery (tokenless)")`. Return — do not fall through.
  - [x] 4.4 If `matches.length === 0 || matches.length > 1`: fall through to the existing new-player join path. No additional logging required beyond the existing join log (which will fire naturally).
  - [x] 4.5 Hard constraints verified by tests: (a) tokenless recovery never matches `connected === true` players, (b) never matches players whose grace timer has expired (map entry absent), (c) multi-match falls through instead of picking one arbitrarily (prevents accidental seat-steal on collision).

- [x] **Task 5: Client — seat-position reconnecting label** (AC: 3, 11, 14)
  - [x] 5.1 In [`OpponentArea.vue`](../../packages/client/src/components/game/OpponentArea.vue), inside the existing `<template v-if="player">` block, add a muted text line **below** the `{{ player.name }}` span that renders `{{ player.name }} is reconnecting…` when `!player.connected`. Use `player.name` (the `OpponentPlayer` type in [`seat-types.ts`](../../packages/client/src/components/game/seat-types.ts) exposes `name`, not `displayName` — the mapper already converts `displayName → name`). Add `data-testid="seat-reconnecting-label"` for test targeting. Style with existing muted tokens (e.g. `text-text-on-felt/70 text-2.5 lg:text-3`). Plain text, no spinner, no animation (UX-DR38).
  - [x] 5.2 Do **not** render the reconnecting label in the empty-seat `<template v-else>` branch (`player === null` — a seat that was never occupied or whose grace has fully expired and seat is released). That branch already shows "Waiting..." which is the correct affordance.
  - [x] 5.3 Confirm [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) and [`mapPlayerGameViewToGameTable`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) already propagate `connected` (`mapPlayerGameViewToGameTable.ts` line 78). No changes expected in either file; only read to verify.
  - [x] 5.4 Do **not** modify [`resetSocialUiForSession`](../../packages/client/src/composables/useRoomConnection.ts) for this story. Chat + reactions + slide-in are already the right things to clear on session boundaries, and `lobbyState` / `playerGameView` / `resolvedAction` are already reset inside `connect()` before the new WebSocket opens. If the implementer feels the urge to add game-state clearing to `resetSocialUiForSession`, stop and re-read AC11 and retro action item `6a-retro-3`.
  - [x] 5.5 No reconnecting-side UI change needed to "resume" the label — when the reconnecting client's own socket re-opens and receives fresh state, other clients receive broadcasts with `connected: true` for them and the label disappears automatically on the next render.

- [x] **Task 6: Tests — server** (AC: 1, 4, 5, 7, 8, 9, 10, 12, 13, 14)
  - [x] 6.1 `post-state-sequence.test.ts` — unit tests for helper ordering, send failure paths, empty chat history path. Use mock `ws` objects (`send: vi.fn()`, `readyState: WebSocket.OPEN`). Imports from `vite-plus/test`.
  - [x] 6.2 Extend [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts):
    - Disconnect handler fires `PLAYER_RECONNECTING` resolvedAction on `close` (T1).
    - Token reconnect within grace sends paired `STATE_UPDATE` + `CHAT_HISTORY`, cancels grace, broadcasts `PLAYER_RECONNECTED` (T2) — may already exist; extend with full state round-trip assertions for every `PlayerGameView` field.
    - Grace expiry releases seat and does **not** emit a second `PLAYER_RECONNECTING` (T3, AC9).
    - `SESSION_SUPERSEDED` close does not flip `connected`, does not start grace timer, does not broadcast `PLAYER_RECONNECTING` (T4, AC10).
    - Tokenless reconnect with exactly one in-grace matching displayName reattaches the seat with fresh token (T5, AC8).
    - Tokenless reconnect with zero / multiple matches falls through to new join (T6, AC8).
    - Tokenless reconnect after grace expired falls through to new join (T7, AC8).
    - Use `vi.useFakeTimers()` for grace timer control; never `setTimeout`-sleep in tests.
  - [x] 6.3 Extend [`ws-server.test.ts`](../../packages/server/src/websocket/ws-server.test.ts) if needed to assert the `REQUEST_STATE` branch routes through `sendPostStateSequence` (T10).
  - [x] 6.4 Integration coverage: either [`full-game-flow.test.ts`](../../packages/server/src/integration/full-game-flow.test.ts) or a new integration file drives a mid-turn disconnect+reconnect and asserts `myRack` + `currentTurn` + `turnPhase` round-trip (T2, AC5). The existing `waitForMessage` / `waitForParsedMessage` helpers skip `CHAT_HISTORY` (per 6A.4 pass 2) — reuse that pattern.

- [x] **Task 7: Tests — client + E2E** (AC: 3, 5, 6, 13, 14)
  - [x] 7.1 Check for existing Playwright setup in the repo. If present: add `reconnection.spec.ts` covering the AC13 scenario. If absent: scope E2E to a Vitest integration test using the mounted `useRoomConnection` against a running server test harness, and file an out-of-scope note in dev notes that a dedicated Playwright harness is a separate Epic 4B task.
  - [x] 7.2 Add an `OpponentArea.test.ts` case: `connected: false` renders the reconnecting label; `connected: true` does not.
  - [x] 7.3 Add a `useRoomConnection` test that `resolvedAction.value` transitions `PLAYER_RECONNECTING → PLAYER_RECONNECTED` as those messages arrive (mock parser or feed raw JSON through the existing test patterns in [`useRoomConnection.sendChat.test.ts`](../../packages/client/src/composables/useRoomConnection.sendChat.test.ts)).
  - [x] 7.4 Explicitly assert AC6 (rack arrangement not persisted): a test that locally reorders a rack, simulates a reconnect `STATE_UPDATE` with server-ordered rack, and verifies the displayed rack matches server order (not the locally-reordered order).

- [x] **Task 8: Regression gate + dev notes finalization** (AC: 14)
  - [x] 8.1 `pnpm test` (all packages) — green.
  - [x] 8.2 `pnpm run typecheck` — green.
  - [x] 8.3 `vp lint` — green.
  - [x] 8.4 Update "File List" below with every touched file.
  - [x] 8.5 Update `sprint-status.yaml`: `4b-1-reconnection-with-full-state-restore: in-progress → review` at handoff, and flip `retro_follow_through.epic-6a.6a-retro-1-transition-scenarios-in-story-specs`, `6a-retro-2-send-post-state-sequence-helper`, `6a-retro-3-extend-resetSocialUiForSession` to `done` once the code-review workflow verifies each deliverable landed.

## Dev Notes

### Epic & requirements traceability

- [`epics.md`](../planning-artifacts/epics.md#L2628) — Story **4B.1** (FR104, FR105, FR106, AR11).
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — **Decision 7: Reconnection Strategy** (line 683); tokenless grace-period recovery (line 534); heartbeat detection (line 108).
- [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md#L1408) — UX-DR38 seat-position reconnecting indicator, no spinner.

### Previous story intelligence (6A.4)

Source: [`6a-4-chat-history-on-connect-reconnect.md`](./6a-4-chat-history-on-connect-reconnect.md).

- `CHAT_HISTORY` is already sent immediately after `STATE_UPDATE` on join, token reconnect, and `REQUEST_STATE`. **4B.1 does not re-implement this** — it refactors the three call sites through `sendPostStateSequence` and preserves the ordering invariant.
- `WS_MAX_PAYLOAD_BYTES = 65_536` is the canonical wire budget (outbound truncation + inbound `maxPayload`). No change here.
- The 6A.4 tests established a pattern for multi-message ordering assertions (`waitForParsedMessage` skips `CHAT_HISTORY` for state-update waiters). Reuse this pattern when asserting `STATE_UPDATE → CHAT_HISTORY → PLAYER_RECONNECTED` ordering.
- `resetSocialUiForSession` is the single place that clears chat + reactions + slide-in on session boundaries. **Do not fork.**

### Infrastructure already in place (do not re-build)

| Capability | Location | Notes |
|---|---|---|
| Session tokens (create, resolve, tokenMap, playerTokens) | [`session-manager.ts`](../../packages/server/src/rooms/session-manager.ts) | `DEFAULT_GRACE_PERIOD_MS = 30_000`. |
| Grace timer storage | [`room.ts`](../../packages/server/src/rooms/room.ts) | `Map<playerId, setTimeout>` on `Room`. |
| Grace timer start on close + grace timer cancel on reconnect | [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` + `handleTokenReconnection` | Already calls `cancelLifecycleTimer(room, "disconnect-timeout")`. |
| Full state resend on reconnect | `handleTokenReconnection` via `buildPlayerView` | Filtered `PlayerGameView` with every field. |
| Chat history on reconnect | `sendChatHistoryAfterStateUpdate` | Routes through `chat-history.ts` — do not duplicate. |
| `PLAYER_RECONNECTED` resolved action | `handleTokenReconnection` | Already broadcasts to room. |
| Heartbeat (15s ping, terminate on 2 missed) | [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) line 14, 58 | `ws.terminate()` fires the normal `close` event → existing disconnect handler runs. |
| `connected: boolean` on `PlayerPublicInfo` | [`protocol.ts`](../../packages/shared/src/types/protocol.ts#L113) | Already in `PlayerGameView.players`; `OpponentArea.vue` already renders a muted/success badge. |
| `resetSocialUiForSession` | [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) line 29 | Runs on `disconnect()` and socket `close`. |
| Session supersede via `handleTokenReconnection` | `join-handler.ts` lines 141–152 | Emits `SESSION_SUPERSEDED` and closes old ws. |
| Client session token storage | [`sessionTokenStorage.ts`](../../packages/client/src/composables/sessionTokenStorage.ts) | Per-room token read/write. |

What this means in practice: **the bulk of this story is hardening, wiring three small gaps (`PLAYER_RECONNECTING`, tokenless grace recovery, seat UX label), extracting `sendPostStateSequence`, and writing the test matrix for the transition scenarios.** Do not rewrite reconnection; extend it.

### Architecture compliance

| Topic | Rule |
| ----- | ---- |
| **Full-state model** | Reconnection re-sends the complete filtered `PlayerGameView` — no delta replay, no event log catchup (Decision 7). |
| **Server authority** | Client never fabricates state on reconnect; always applies the fresh `STATE_UPDATE`. Rack arrangement (local) is reset to server order. |
| **Validate-then-mutate** | Disconnect handling + tokenless recovery are server-side branches; no game engine changes in `shared/`. |
| **Not a `GameAction`** | `PLAYER_RECONNECTING` / `PLAYER_RECONNECTED` are `ResolvedAction` discriminants, **not** `GameAction`. They ride `StateUpdateMessage.resolvedAction`. |
| **Imports** | Tests: `vite-plus/test`; app: `vite-plus` per [`AGENTS.md`](../../AGENTS.md). No `vitest` / `vite` direct imports. |
| **Composition API + `<script setup lang="ts">`** | `OpponentArea.vue` is already SFC + Composition API; follow the same shape. |
| **No import aliases** | Use relative imports or `@mahjong-game/shared`; no `@/` path mappings (see [`CLAUDE.md`](../../CLAUDE.md)). |

### Anti-patterns (do not ship)

- **Introducing a parallel `resetGameStateForSession` client helper** — violates retro action item 6a-retro-3; `resetSocialUiForSession` is the extension point.
- **Forking the reconnect path** — do **not** add a second function that partially duplicates `handleTokenReconnection`. The tokenless recovery path must reuse `attachToExistingSeat` (or equivalent extracted helper).
- **Broadcasting `PLAYER_RECONNECTING` again from the grace-expiry timer** — violates AC9; the state transition is "reconnecting → seat released", not "reconnecting → reconnecting again".
- **Adding a spinner / animated loader to the seat-position reconnecting label** — violates UX-DR38. Plain text, muted tone.
- **Persisting rack arrangement to sessionStorage on disconnect** — violates AC6; Sort button is the recovery mechanism.
- **Sending `STATE_UPDATE` and `CHAT_HISTORY` in the wrong order, or from separate call sites bypassing `sendPostStateSequence`** — violates retro action item 6a-retro-2; single source of truth for post-state ordering.
- **Sleeping real time in grace-period tests** (e.g. `await new Promise(r => setTimeout(r, 30_000))`) — use `vi.useFakeTimers()`.
- **Matching tokenless recovery against `connected === true` players** — would steal a live seat.
- **Case-sensitive displayName matching in tokenless recovery** — users reload with the same name but different casing; use `.toLowerCase()` on both sides.
- **Forgetting the `if (!session || session.ws !== ws) return;` guard on superseded close** — the guard already exists; do not remove it while refactoring.
- **Re-implementing heartbeat logic** — `ws-server.ts` already does it. `ws.terminate()` fires a normal `close` event.

### Implementation edge cases

- **Grace-timer race with token reconnect:** The existing code clears `room.graceTimers.get(playerId)` inside `handleTokenReconnection` before restoring the session — this is the race-free path. Do not add additional locks.
- **`cancelLifecycleTimer(room, "disconnect-timeout")` inside token reconnect:** This is the room-wide "all disconnected → cleanup" timer, separate from per-player grace timers. Keep cancelling it on reconnect (already done).
- **Tokenless recovery during `SESSION_SUPERSEDED` window:** If a client loses its token and reconnects within the supersede window, the server's `room.players` still has `connected === true` (because supersede flips it to true immediately in the new session). Tokenless recovery skips this correctly because it requires `connected === false`.
- **Multiple reconnects in rapid succession:** Each reconnect goes through `handleTokenReconnection`, which supersedes the prior session. No additional work in 4B.1 — it's already idempotent.
- **`PLAYER_RECONNECTING` broadcast arrives before the reconnecting client has disconnected on its own end:** Harmless; the other clients render the seat as reconnecting, the player (who is the viewer of their own seat) never sees their own label. The `resolvedAction` ref on the reconnecting player's ws is irrelevant because their ws just closed.
- **Broadcasting `PLAYER_RECONNECTING` to a fully-empty room:** `broadcastStateToRoom` already iterates `room.sessions` and no-ops on closed sockets — no crash, no extra logic needed.
- **Rack tile ids after reconnect:** Tile ids are globally unique strings (`suit-value-copy`); server-rebuilt rack contains the same ids, so tests can assert by id equality. See [`CLAUDE.md`](../../CLAUDE.md) "Gotchas → Tile IDs are unique strings".
- **Reconnecting during Charleston:** 4B.2 handles phase-specific fallbacks on grace expiry. 4B.1 only guarantees that `PLAYER_RECONNECTING` broadcasts for all phases uniformly. If Charleston is active and the grace expires, 4B.2's auto-pass logic runs — 4B.1 does not.

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Shared | [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) (add `PLAYER_RECONNECTING` discriminant) |
| Server — core | [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) (disconnect broadcast, tokenless recovery, route through helper), new [`packages/server/src/websocket/post-state-sequence.ts`](../../packages/server/src/websocket/) (helper), [`packages/server/src/websocket/ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) (REQUEST_STATE branch via helper), possibly [`packages/server/src/websocket/state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) if `sendCurrentState` is refactored to return its state message |
| Server — tests | [`packages/server/src/websocket/join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts) (extended), new `post-state-sequence.test.ts`, possibly extended [`ws-server.test.ts`](../../packages/server/src/websocket/ws-server.test.ts), possibly extended [`full-game-flow.test.ts`](../../packages/server/src/integration/full-game-flow.test.ts) |
| Client | [`packages/client/src/components/game/OpponentArea.vue`](../../packages/client/src/components/game/OpponentArea.vue) (label), extended [`OpponentArea.test.ts`](../../packages/client/src/components/game/OpponentArea.test.ts) |
| Client — composable tests | New or extended `useRoomConnection` reconnection test, possibly `GameTable.test.ts` regression |
| E2E | New `packages/client/e2e/reconnection.spec.ts` **or** integration-test scoping note (Task 7.1) |

### Cross-session intelligence (claude-mem)

Key items from recent sessions that apply directly to this story:

- **Epic 6A retrospective (Apr 5, 2026)** flagged three action items owned by 4B.1: (1) "Transition scenarios" section in story specs [this story is the first to ship it], (2) extract `sendPostStateSequence` helper, (3) reference `resetSocialUiForSession` as extension point. All three are tracked as `retro_follow_through.epic-6a.6a-retro-{1,2,3}` in `sprint-status.yaml` and baked into this story.
- **Epic 6A pass-2 pattern**: every 6A story had a state-transition bug that pass-1 review missed (seat recycle, scoreboard phase lobby→game, maxPayload in/out). Epic 4B's entire surface area is state transitions. The Transition scenarios table is the countermeasure.
- **Epic 3C.8 / PlayerGameView bridge**: `mapPlayerGameViewToGameTable` is the single source of truth for prop-mapping. `connected` already flows through it (line 78). Don't bypass the mapper.
- **Epic 4A session identity + token management** (Story 4A.4) already implemented per-room token persistence on the client (`sessionTokenStorage.ts`). Reconnection reuses this as-is.

### Git intelligence (recent commits)

```
659e2fd chore: update claude-mem context rules and finalize Epic 6A documentation
02f16c7 chore: refresh claude-mem auto-context rules
469e5cc docs(gds): close Epic 6A retrospective and archive timeline
6f54ed4 feat(server): harden chat/reaction path and close 6A.1 ticket
edfaa15 Merge pull request #18 from rmerk/...
```

Epic 6A closed cleanly on Apr 5. The last server commit (`6f54ed4`) hardened the chat/reaction path — the `trySendJson` pattern and the warn-on-failure discipline it introduced is exactly what `sendPostStateSequence` should mirror. Reference that commit when implementing helper error handling.

### Latest tech / versions

No new dependencies. `ws` heartbeat, `setTimeout` grace timers, and `JSON.stringify` wire format are unchanged. Playwright (if added as the E2E host) should match whatever version `vp` already ships; confirm with `pnpm list playwright` before adding a dev dep. If no Playwright exists, do **not** add one as part of this story — scope E2E to integration tests (see Task 7.1).

### Project context reference

[`project-context.md`](../project-context.md) (if present) — WebSocket reconnection section; grace period = 30s; full-state model on reconnect; chat history piggybacks on `STATE_UPDATE` sequence.

## Change Log

- **2026-04-05:** Code review passed — added AC9 negative assertion (seat-release broadcast carries no `PLAYER_RECONNECTING`) and T7 coverage (same-name tokenless join after grace expiry falls through to new player). Sprint status: `4b-1 → done`; `6a-retro-1/2/3 → done`. Status → `done`.
- **2026-04-05:** Implementation complete — `PLAYER_RECONNECTING`, `sendPostStateSequence`, tokenless grace recovery, OpponentArea reconnecting label, test matrix; status → review.
- **2026-04-05:** Story 4B.1 created. First story in Epic 4B. Enumerates 14 ACs + 14 transition scenarios. Carries forward three 6A retro follow-through items (`6a-retro-1` Transition scenarios section, `6a-retro-2` `sendPostStateSequence` helper, `6a-retro-3` `resetSocialUiForSession` as extension point). Much of the reconnection backbone already exists from 4A.4 and 6A.4 — this story adds `PLAYER_RECONNECTING` broadcast, tokenless grace-period recovery, seat-position reconnecting label, and the helper + test matrix.
- **2026-04-05 (pass 2):** Eliminated a duplicate broadcast in the disconnect handler — AC1/Task 2.1 now *replace* the terminal untyped `broadcastStateToRoom(room)` with the typed `PLAYER_RECONNECTING` broadcast (was adding a second one). Locked AC7's `sendCurrentState` decision to a clean extract (`buildCurrentStateMessage`) and deleted the dual-path punt. AC3 scoped to in-game phases only (lobby excluded) and fixed Task 5.1 to use `player.name` (matches `OpponentPlayer` type in `seat-types.ts`; the mapper converts `displayName → name`). AC8 tightened on sanitized-name comparison symmetry and multi-match fall-through. Task 4 elevated the `attachToExistingSeat` extraction to a hard prerequisite (Task 4.1) instead of an optional refactor — both token and tokenless paths **must** share the reattach block. AC14 added `setGracePeriodMs(ms)` as an alternative to fake timers for integration tests, with `afterEach` reset requirement. Clarified that `handleTokenReconnection` sends `STATE_UPDATE` to the reconnecting client **without** a `resolvedAction` (existing behavior preserved) — only *other* clients see `PLAYER_RECONNECTED`. Added empty-seat branch exclusion for the reconnecting label.

## Dev Agent Record

### Agent Model Used

Cursor agent (gds-dev-story workflow)

### Debug Log References

### Completion Notes List

- Implemented `PLAYER_RECONNECTING` on disconnect (single `broadcastStateToRoom` with resolvedAction), `sendPostStateSequence` + `buildCurrentStateMessage`, tokenless grace recovery via `attachToExistingSeat`, OpponentArea label, and tests (join-handler, post-state-sequence, full-game-flow, client composable + OpponentArea). No Playwright in repo — AC13 covered by integration + client tests per Task 7.1. Retro follow-through items 6a-retro-1/2/3: transition scenarios exercised in tests; helper shipped; `resetSocialUiForSession` unchanged per AC11 — confirm in code-review before marking retro YAML entries `done`.

### File List

- `packages/shared/src/types/game-state.ts`
- `packages/server/src/websocket/post-state-sequence.ts`
- `packages/server/src/websocket/post-state-sequence.test.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/join-handler.ts`
- `packages/server/src/websocket/join-handler.test.ts`
- `packages/server/src/websocket/ws-server.ts`
- `packages/server/src/integration/full-game-flow.test.ts`
- `packages/client/src/components/game/OpponentArea.vue`
- `packages/client/src/components/game/OpponentArea.test.ts`
- `packages/client/src/composables/useRoomConnection.reconnection.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Story completion status

**done** — Code review passed (2026-04-05). AC9 negative assertion + T7 gap filled; retro follow-through 6a-retro-1/2/3 verified and flipped to `done`.
