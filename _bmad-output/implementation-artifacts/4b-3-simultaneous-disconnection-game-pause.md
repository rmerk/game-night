# Story 4B.3: Simultaneous Disconnection & Game Pause

Status: done

<!-- Epic 4B story 3. Builds on 4B.1 (grace timers, PLAYER_RECONNECTING/RECONNECTED, attachToExistingSeat) and 4B.2 (grace-expiry-fallbacks, consolidated broadcast fan-out). Introduces room-level pause as a new orthogonal concept: when ≥2 seats are disconnected simultaneously, individual per-player grace timers are suspended in favor of a single 2-minute room pause timer. Auto-end on pause-timer expiry transitions the in-flight game to scoreboard; resume when the last disconnected player returns. NOT in scope: multi-game session score history (deferred), host migration (4B.6), player departure (4B.5). -->

## Story

As a **player**,
I want **the game to pause entirely if 2 or more players disconnect simultaneously, and auto-end if they don't all reconnect within 2 minutes**,
so that **the game doesn't continue in a broken state and everyone gets a clean close-out instead of a limbo state (FR108, FR109)**.

## Acceptance Criteria

1. **AC1 — Pause trigger: disconnect threshold ≥ 2 while game in progress.** Given `room.gameState !== null` and `room.gameState.gamePhase ∈ {"charleston","play"}`, when a socket close in [`registerDisconnectHandler`](../../packages/server/src/websocket/join-handler.ts) flips `player.connected = false` and the resulting count of disconnected seats in `room.players` is **≥ 2**, then the room enters the paused state: set `room.paused = true`, set `room.pausedAt = Date.now()`, **cancel every per-player grace timer** in `room.graceTimers` (clear the map entirely), start a single `"pause-timeout"` lifecycle timer (2 minutes — see AC6), and broadcast `{ type: "GAME_PAUSED", disconnectedPlayerIds, reason: "simultaneous-disconnect" }` as the resolvedAction on a **single** `broadcastStateToRoom(room, undefined, ...)` call (no excludes — all connected clients). The `PLAYER_RECONNECTING` broadcast for this specific player must **not** also fire in the same close handler once pause fires; the close handler emits pause XOR reconnecting, not both (order: mutate `connected=false` → count → branch).

2. **AC2 — Pause is orthogonal to `gameState.gamePhase`.** `gamePhase` is **not** modified when the room pauses. `GameState.gamePhase` stays exactly where it was (`play`/`charleston`). Pause is a **server-side `Room` flag** surfaced to clients via a new `PlayerGameView.paused: boolean` field (default `false`, set `true` while paused). This keeps the engine pure — no new `"paused"` variant on the shared `GamePhase` union.

3. **AC3 — Game actions are rejected while paused.** Given `room.paused === true`, when [`handleActionMessage`](../../packages/server/src/websocket/action-handler.ts) receives any `ACTION` message (including `START_GAME`, `DISCARD_TILE`, `DRAW_TILE`, Charleston, calls, mahjong), then the server rejects it with `sendActionError(ws, logger, "ROOM_PAUSED", "Room is paused waiting for players to reconnect")` **before** the `room.gameState` null-check and before `handleAction()`. The check lives at the top of `handleActionMessage` immediately after the payload validity gates (after `validateActionPayload`, before the `room.gameState` null-branch). `SET_JOKER_RULES`, chat messages, and reactions are **not** game actions and pass through unaffected.

4. **AC4 — Grace-expiry fallbacks are suspended while paused.** Given `room.paused === true`, when [`applyGraceExpiryGameActions`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) is invoked for any reason, it early-returns with no side effects. In practice this never fires while paused because AC1 clears `room.graceTimers`, but the guard is defense-in-depth in case a timer callback races with the pause flip. Add the check as the first line inside `applyGraceExpiryGameActions` and cover it with a unit test.

5. **AC5 — Resume on full reconnect.** Given `room.paused === true`, when any reconnect path ([`attachToExistingSeat`](../../packages/server/src/websocket/join-handler.ts) — both token and tokenless grace-recovery entrypoints in [`handleJoinRoom`](../../packages/server/src/websocket/join-handler.ts)) flips a player's `connected` to `true`, then immediately after that flip the server checks: if every entry in `room.players` now has `connected === true`, it **resumes** the room: set `room.paused = false`, clear `room.pausedAt`, cancel the `"pause-timeout"` lifecycle timer via `cancelLifecycleTimer(room, "pause-timeout")`, and broadcast `{ type: "GAME_RESUMED" }` as the resolvedAction on a `broadcastStateToRoom(room)` call immediately **after** the existing `PLAYER_RECONNECTED` broadcast in `attachToExistingSeat`. Partial reconnect (still ≥ 1 other disconnected player) does **not** resume — the normal `PLAYER_RECONNECTED` broadcast still fires so opponents see the reconnecting label clear for the returning player, but `room.paused` stays `true` and the `pause-timeout` timer keeps counting down. **Do not re-install per-player grace timers** on partial reconnect; the room-level pause timer is the single source of truth while paused.

6. **AC6 — Pause-timeout lifecycle timer.** Add a new `LifecycleTimerType` variant `"pause-timeout"` in [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) alongside the existing three variants. Default duration: `DEFAULT_PAUSE_TIMEOUT_MS = 2 * 60 * 1000` (2 minutes, FR109). Expose a test-only setter `setPauseTimeoutMs(ms)` following the same pattern as `setDisconnectTimeoutMs`. Wire it into `getTimeoutForType`. The timer is started via `startLifecycleTimer(room, "pause-timeout", autoEndCallback)` inside AC1 and cancelled via `cancelLifecycleTimer(room, "pause-timeout")` inside AC5 resume.

7. **AC7 — Auto-end on pause-timeout expiry.** Given the `"pause-timeout"` timer fires (AC6), when its callback runs, then: (a) set `room.gameState.gamePhase = "scoreboard"` if the current phase is `"play"` or `"charleston"` and the engine still has a `gameState` (guard for the cleanup-race case); (b) set `room.gameState.gameResult = { winnerId: null, points: 0 }` (`WallGameResult` shape — reuse existing type; no new `GameResult` variant); (c) leave `room.gameState.scores` as-is — no rewrites, current in-progress scores become final; (d) set `room.paused = false`, clear `room.pausedAt`; (e) for every player still `connected === false`, release the seat inline (same seat-release block the per-player grace-expiry timer uses in `registerDisconnectHandler` lines 263–274: drop from `room.players`, `room.sessions`, `room.tokenMap`, `room.playerTokens`, `room.chatRateTimestamps`, `room.reactionRateTimestamps`); (f) broadcast `{ type: "GAME_ABANDONED", reason: "pause-timeout" }` on a single `broadcastStateToRoom(room)` call. Do **not** cascade to `roomManager.cleanupRoom` — the room stays alive so connected players can view the scoreboard, leave, or start a rematch. The existing scoreboard `idle-timeout` (5 min, room-lifecycle.ts line 6) will eventually close the room naturally.

8. **AC8 — `PlayerGameView.paused` field threaded through broadcast.** Extend [`PlayerGameView`](../../packages/shared/src/types/protocol.ts) with `paused: boolean` (required, defaults populated by server) and optional `pauseReason?: "simultaneous-disconnect"` for future extensibility. Update [`buildPlayerView`](../../packages/server/src/websocket/state-broadcaster.ts) to read `room.paused` and emit the field on every `STATE_UPDATE` for a player view (not lobby state). **`LobbyState` is not extended** — pause is an in-game concept; if the game is not started, pause semantics don't apply (2 disconnects in lobby still follow existing `allPlayersDisconnected` → `disconnect-timeout` → cleanup path). The field flows through `StateUpdateMessage.state` which is already exported.

9. **AC9 — `ResolvedAction` union: `GAME_PAUSED`, `GAME_RESUMED`, `GAME_ABANDONED`.** Add three new discriminants to the [`ResolvedAction`](../../packages/shared/src/types/game-state.ts) union:
   - `{ readonly type: "GAME_PAUSED"; readonly disconnectedPlayerIds: readonly string[]; readonly reason: "simultaneous-disconnect" }`
   - `{ readonly type: "GAME_RESUMED" }`
   - `{ readonly type: "GAME_ABANDONED"; readonly reason: "pause-timeout" }`
   Every existing exhaustive `switch` on `ResolvedAction.type` must either handle the new variants or hit a `never`-check; fix any `typecheck` breakage. No new `GameAction` discriminants — these are resolved actions only.

10. **AC10 — Per-player grace timers cleared on pause, not restarted on resume.** When AC1 fires, iterate `room.graceTimers` and `clearTimeout` each entry, then `room.graceTimers.clear()`. On AC5 resume, do **not** reinstall grace timers for anyone — by definition every player is now `connected === true`. The next disconnect (post-resume) goes through the normal single-disconnect path: `registerDisconnectHandler` sees count 1 < 2 and installs a fresh per-player grace timer exactly as it does today. This is the key invariant: **while paused, there are zero per-player grace timers**; the only countdown is the single room-level `pause-timeout`.

11. **AC11 — Still-disconnected player during pause does not double-pause.** Given `room.paused === true`, when another player's socket closes (a third disconnect while paused), then `registerDisconnectHandler` detects `room.paused === true` early and skips the pause-trigger branch: mutate `player.connected = false`, log, but **do not** broadcast `PLAYER_RECONNECTING`, **do not** install a new per-player grace timer, **do not** restart the `pause-timeout` timer. The existing `PLAYER_RECONNECTING` close-handler branch is gated on `room.paused === false`. Downstream broadcast is still useful — one `broadcastStateToRoom(room)` (untyped, no resolvedAction) so clients see the updated `connected` flags in the player list. This prevents the pause-timer reset disasters ("paused for 1:59, next drop resets to 2:00 forever").

12. **AC12 — Reconnect during pause of a still-disconnected player, not the last one.** Given `room.paused === true` and 3 of 4 players are disconnected, when one of those three reconnects (token or tokenless), then `attachToExistingSeat` runs normally (supersede, build state, install session, send filtered state via `sendPostStateSequence`, broadcast `PLAYER_RECONNECTED`). The filtered state carries `paused: true` because the room is still paused. The reconnecting client renders the pause banner immediately. **No** `GAME_RESUMED` broadcast fires — AC5's all-connected check returns false. The `pause-timeout` timer is not touched.

13. **AC13 — Pause banner on the client (GameTable overlay).** In [`mapPlayerGameViewToGameTable`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts), thread the new `paused` / `pauseReason` fields through to a new `paused: boolean` prop on [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue). When `paused === true`, render a muted full-width banner overlay inside the existing table frame (use existing `text-text-on-felt/85` or a design-system token — **no spinner**, no animation per UX-DR38 conventions established in 4B.1) with the copy **"Waiting for players to reconnect…"**. The banner does **not** blur the board — players can still see current turn / rack / discards so they know what state they're returning to. Existing interactive elements (rack drag, discard, call buttons, mahjong) do **not** need to be programmatically disabled for this story — the server already rejects actions (AC3), and clicking a disabled-from-server action shows the existing `ROOM_PAUSED` error toast via the existing error path. Add `data-testid="game-paused-banner"` for test targeting. The banner disappears automatically when the next `STATE_UPDATE` carries `paused: false`.

14. **AC14 — Auto-end scoreboard transition is observable client-side.** When the server auto-ends a paused game (AC7), the resulting broadcast (`GAME_ABANDONED`) lands on the connected clients as a `STATE_UPDATE` whose `state.gamePhase === "scoreboard"` and whose `state.gameResult` is a `WallGameResult` (`winnerId: null, points: 0`). The existing scoreboard UI ([`Scoreboard.vue`](../../packages/client/src/components/scoreboard/Scoreboard.vue)) already handles this case (wall-game draw). No new client rendering required beyond the short-lived `GAME_ABANDONED` resolvedAction toast (optional — if the client already has a generic `resolvedAction` display for wall games, reuse it; otherwise leave it implicit via the phase transition). The client test (Task 7.2) asserts the `paused → scoreboard` transition flows through without the banner sticking.

15. **AC15 — Test strategy: fake timers + `setPauseTimeoutMs`.** All pause-timeout tests use **either** `vi.useFakeTimers()` with `vi.advanceTimersByTime(120_000)` **or** `setPauseTimeoutMs(50)` to shrink the window for integration tests (same pattern as `setGracePeriodMs` per 4B.1 AC14). `afterEach` must restore `DEFAULT_PAUSE_TIMEOUT_MS`. Never `await new Promise(r => setTimeout(r, 120_000))`. Every transition scenario below must have at least one test.

16. **AC16 — Regression gate.** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass from the repo root. Previous story (4B.2) test `grace-expiry-fallbacks.test.ts` AC4/AC5 coverage remains green — the new pause-guard early-return must not break the existing no-op branches.

### Transition scenarios

Every row must be enumerated in implementation and covered by at least one test. Pass-1 code review walks this table (per 6A retro follow-through `6a-retro-1`).

| # | Scenario | Expected behavior | AC |
|---|----------|-------------------|----|
| T1 | 4 connected → 2 disconnect within the same tick (both grace-start racing) | First close fires normally (count = 1, grace timer starts, PLAYER_RECONNECTING broadcast). Second close fires with count = 2 → pause trigger: cancel first player's grace timer, broadcast GAME_PAUSED (NOT a second PLAYER_RECONNECTING), start pause-timeout | AC1, AC10, AC11 |
| T2 | Paused → both disconnected players reconnect (token) within 2 min | attachToExistingSeat runs for each; the **second** reconnect flips the last `connected=false` to `true` → AC5 resume: cancel pause-timeout, GAME_RESUMED broadcast, paused=false | AC5, AC12 |
| T3 | Paused → only 1 of 2 reconnects within 2 min → pause-timeout fires | AC7: gamePhase→scoreboard, gameResult = wall-game draw, still-disconnected seat released, GAME_ABANDONED broadcast, room stays alive | AC7 |
| T4 | Paused → 3rd player disconnects while paused | AC11: connected=false set, no new PLAYER_RECONNECTING, no new grace timer, pause-timeout NOT reset, broadcastStateToRoom fires untyped state update so clients see connected flag change | AC11 |
| T5 | Paused → 3rd player disconnects, then all 3 reconnect within timeout | Each reconnect runs attachToExistingSeat; only the **last** one (all four now connected) fires GAME_RESUMED; earlier two fire PLAYER_RECONNECTED but paused=true on their STATE_UPDATE | AC5, AC12 |
| T6 | Paused → client attempts ACTION (DISCARD_TILE, CHARLESTON_PASS, CALL_PUNG) | handleActionMessage rejects with ROOM_PAUSED error code; no state mutation; broadcastGameState NOT called | AC3 |
| T7 | 2 disconnects in lobby (gameState === null) | No pause trigger. Existing `allPlayersDisconnected` + `disconnect-timeout` → `cleanupRoom("all_disconnected")` path stays untouched. Pause is in-game only | AC1, AC2 |
| T8 | 2 disconnects during scoreboard phase (game already ended) | `gameState.gamePhase === "scoreboard"` → pause trigger DOES NOT fire (AC1 guards on `charleston`/`play` only). Existing per-player grace timers run, seats release via normal path. Scoreboard phase is already "game over" | AC1 |
| T9 | Paused for 1:59, then final reconnect arrives (resume), then a new disconnect happens | Post-resume flow: AC5 fires (GAME_RESUMED, pause-timeout cancelled, paused=false). New disconnect goes through normal single-disconnect path with a **fresh** per-player grace timer (30s). Pause-timeout is not reinstalled unless count hits ≥2 again | AC5, AC10 |
| T10 | `SESSION_SUPERSEDED` (live second session reclaims seat) while paused | Existing supersede guard (`if (!session \|\| session.ws !== ws) return;` line 247 of join-handler.ts) holds — old socket close is a no-op. Pause state unaffected. Reconnect fires AC12 path (not the pause-trigger close branch) | AC5, AC10 (4B.1 AC10) |
| T11 | Tokenless grace recovery while paused (AC8 from 4B.1) | The tokenless recovery path currently checks `room.graceTimers.has(p.playerId)` as a match predicate. Since pause **clears** `graceTimers`, tokenless recovery via displayName **will fail to match** during pause. This is **by design** for 4B.3 — the implementer must not reintroduce grace timers while paused. Clients reconnecting tokenless during pause fall through to new-player join (or blocked by ROOM_FULL if the seat still exists). Document this as a known gap; 4B.5 (departure) may revisit | AC10, Known gap |
| T12 | Auto-end fires, then a disconnected player's client tries to reconnect 5 seconds later with a token | `resolveToken` will still find the token → `attachToExistingSeat` runs. But `room.players` no longer contains that playerId (AC7 (e) released the seat). The existing `if (!player)` guard at join-handler.ts:86 returns early with a warn log. The client receives no STATE_UPDATE; its next `JOIN_ROOM` with `displayName` flows through normal new-player join (fresh seat or ROOM_FULL) | AC7, regression |

### Scope boundaries

| In scope (4B.3) | Out of scope |
| --------------- | ------------ |
| `room.paused` flag + pause/resume logic | Multi-game session score history (no existing infra; `sessionScores` on client is currently a rename of per-game `score`) |
| `"pause-timeout"` lifecycle timer (2 min, FR109) | Host migration when the host is among the disconnected (Story 4B.6) |
| `GAME_PAUSED` / `GAME_RESUMED` / `GAME_ABANDONED` resolvedActions | Dead-seat flow / explicit player departure (Story 4B.5) |
| Auto-end transition to scoreboard with `WallGameResult` | Rematch flow changes (out of Epic 4B; Story 5B.4) |
| Action rejection via `ROOM_PAUSED` error | Turn-timer / AFK interaction with pause (Story 4B.4) |
| Client `GameTable` pause banner | Persisting pause state across server restart |
| `PlayerGameView.paused` broadcast field | Lobby-phase simultaneous-disconnect handling (existing `allPlayersDisconnected` path stays as-is) |
| Tests for every transition in table above | Playwright E2E (no harness in repo — Vitest integration covers the multi-socket path per 4B.1 precedent) |

## Tasks / Subtasks

- [x] **Task 1: Shared types — `ResolvedAction` variants + `PlayerGameView.paused`** (AC: 8, 9, 16)
  - [x] 1.1 Add `GAME_PAUSED` / `GAME_RESUMED` / `GAME_ABANDONED` discriminants to the `ResolvedAction` union in [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) — shapes exactly as AC9 specifies.
  - [x] 1.2 Add `paused: boolean` (required) and `pauseReason?: "simultaneous-disconnect"` (optional) to `PlayerGameView` in [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts). `LobbyState` unchanged.
  - [x] 1.3 `pnpm run typecheck` — find every exhaustive `switch` on `ResolvedAction.type` (most live in client composables + test helpers). Add the three new arms (usually `break;` or a noop) or rely on an existing `default:` / `never`-check. **Do not** silently widen an existing non-exhaustive switch into one; match the file's existing pattern.

- [x] **Task 2: Server — `Room` fields + lifecycle timer** (AC: 1, 6, 7, 16)
  - [x] 2.1 Extend [`packages/server/src/rooms/room.ts`](../../packages/server/src/rooms/room.ts) `Room` interface: add `paused: boolean` (default `false`) and `pausedAt: number | null` (default `null`). Initialize both in [`room-manager.ts`](../../packages/server/src/rooms/room-manager.ts) `createRoom` alongside `graceTimers: new Map()` etc.
  - [x] 2.2 In [`packages/server/src/rooms/room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts): add `"pause-timeout"` to the `LifecycleTimerType` union; add `DEFAULT_PAUSE_TIMEOUT_MS = 2 * 60 * 1000`; add `pauseTimeoutMs` variable + `setPauseTimeoutMs(ms)` setter; extend `getTimeoutForType` switch to include the new case. The `startLifecycleTimer` / `cancelLifecycleTimer` / `hasLifecycleTimer` helpers already parameterize over `LifecycleTimerType` — no further changes needed.
  - [x] 2.3 Add `setPauseTimeoutMs` export to whatever test-helpers barrel exists (check `join-handler.test.ts` for the import pattern of `setGracePeriodMs`/`setDisconnectTimeoutMs`).

- [x] **Task 3: Server — pause trigger + counting helper** (AC: 1, 2, 10, 11, 16)
  - [x] 3.1 Add a private helper `countDisconnectedPlayers(room: Room): number` in [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) right next to the existing `allPlayersDisconnected`. Sum `room.players.values()` where `!player.connected`.
  - [x] 3.2 Inside `registerDisconnectHandler`'s `ws.on("close", ...)` callback, **after** the existing guard (`if (!session || session.ws !== ws) return;`), and **after** setting `player.connected = false` + log, branch as follows:
    - **Branch A — room already paused (AC11):** If `room.paused === true`, call `broadcastStateToRoom(room)` (untyped — no resolvedAction, just propagate the new `connected=false` to clients), log `"Additional player disconnected while paused"`, and `return` from the close handler. Do **not** install a per-player grace timer, do **not** broadcast `PLAYER_RECONNECTING`, do **not** touch the pause-timeout timer.
    - **Branch B — pause trigger (AC1):** Else, compute `const disconnectedCount = countDisconnectedPlayers(room);`. If `disconnectedCount >= 2` **and** `room.gameState !== null` **and** `room.gameState.gamePhase === "play" || room.gameState.gamePhase === "charleston"`, then enter pause:
      - Clear every timer in `room.graceTimers`: iterate, `clearTimeout`, then `.clear()` (AC10).
      - Cancel the room-wide `"disconnect-timeout"` lifecycle timer via `cancelLifecycleTimer(room, "disconnect-timeout")` (prevents legacy all-disconnected cleanup from racing with pause on 4-player rooms).
      - Set `room.paused = true; room.pausedAt = Date.now();`.
      - Start `startLifecycleTimer(room, "pause-timeout", () => handlePauseTimeout(room, roomManager, logger))` — the auto-end callback (Task 4).
      - Build the `disconnectedPlayerIds` array by scanning `room.players.values()` for `!p.connected` entries.
      - Broadcast `broadcastStateToRoom(room, undefined, { type: "GAME_PAUSED", disconnectedPlayerIds, reason: "simultaneous-disconnect" })`.
      - Log `"Room paused due to simultaneous disconnect"` with the playerIds and count.
      - `return` — do **not** fall through to the normal single-disconnect path.
    - **Branch C — normal single disconnect (unchanged):** Fall through to the existing grace-timer install + `PLAYER_RECONNECTING` broadcast block (join-handler.ts lines 253–305).
  - [x] 3.3 Verify the legacy `allPlayersDisconnected` check (line 291) still lives inside Branch C only. It should **not** fire from Branches A or B. Pause's auto-end path owns the 2-minute countdown when gameState exists; `allPlayersDisconnected` → `disconnect-timeout` still handles the lobby-only case (T7 in transition table).

- [x] **Task 4: Server — auto-end on pause-timeout expiry** (AC: 7, 14, 16)
  - [x] 4.1 Create a new module [`packages/server/src/websocket/pause-handlers.ts`](../../packages/server/src/websocket/pause-handlers.ts). Export `handlePauseTimeout(room: Room, roomManager: RoomManager | undefined, logger: FastifyBaseLogger): void` implementing AC7:
    - Guard: `if (!room.paused) return;` (defensive — if something already resumed between timer fire and callback).
    - If `room.gameState` exists and `gameState.gamePhase === "play" || "charleston"`: set `gameState.gamePhase = "scoreboard"`; set `gameState.gameResult = { winnerId: null, points: 0 }`.
    - Set `room.paused = false; room.pausedAt = null;`.
    - Release seats for every still-disconnected player — extract the seat-release block from `registerDisconnectHandler`'s grace-timer callback (lines 263–275) into a new shared helper `releaseSeat(room, playerId, roomManager, logger)` in the same `pause-handlers.ts` file, and call it from both the grace-timer path and here. This de-dupes the six-line cleanup sequence (`tokenMap.delete`, `playerTokens.delete`, `room.players.delete`, `room.sessions.delete`, `chatRateTimestamps.delete`, `reactionRateTimestamps.delete`). The grace-timer path still owns its own `applyGraceExpiryGameActions` + `applyCharlestonAutoAction` calls **before** `releaseSeat`.
    - Broadcast `broadcastStateToRoom(room, undefined, { type: "GAME_ABANDONED", reason: "pause-timeout" })`.
    - Log `"Pause timeout fired — game auto-ended"`.
    - **Do not** call `roomManager.cleanupRoom`. Room stays alive; scoreboard's existing `idle-timeout` (5 min) will close it if no one returns.
  - [x] 4.2 Export `releaseSeat(room, playerId, roomManager, logger): void` from `pause-handlers.ts`. Refactor `registerDisconnectHandler`'s grace-expiry callback to call `releaseSeat(...)` instead of the inline delete block. Import in `join-handler.ts`. Verify the `room.players.size <= 1 → start abandoned-timeout` branch at lines 278–282 still runs **after** `releaseSeat` returns.
  - [x] 4.3 `handlePauseTimeout` is wired into `startLifecycleTimer` inside Task 3.2 Branch B. Double-check the closure captures `room`, `roomManager`, `logger` correctly — `logger` comes from the enclosing `registerDisconnectHandler` scope.

- [x] **Task 5: Server — action rejection while paused** (AC: 3, 16)
  - [x] 5.1 In [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) `handleActionMessage`, **after** `validateActionPayload` (line 288) and **before** the `room.gameState` null-branch (line 295), add:
    ```
    if (room.paused) {
      sendActionError(ws, logger, "ROOM_PAUSED", "Room is paused waiting for players to reconnect");
      return;
    }
    ```
  - [x] 5.2 Confirm this gates `START_GAME` as well (the current code at lines 294–299 runs `handleStartGameAction` before the `gameState` check — putting the pause check above that gate ensures START_GAME is also blocked if a paused room somehow reaches this branch). In practice pause only applies during `play`/`charleston`, so `START_GAME` during pause is a malformed client; the rejection is defensive.
  - [x] 5.3 Chat + reactions flow through `handleChatMessage` / `handleReactionMessage` in `ws-server.ts`, not `handleActionMessage`. Verify no changes needed there — pause must NOT block chat (players communicate about who's reconnecting).

- [x] **Task 6: Server — resume on full reconnect** (AC: 5, 12, 16)
  - [x] 6.1 In `attachToExistingSeat` (join-handler.ts lines 77–149), **after** the existing `broadcastStateToRoom(room, playerId, { type: "PLAYER_RECONNECTED", ... })` call (lines 142–146) and **before** the final `registerDisconnectHandler` call (line 148), insert the resume check:
    ```
    if (room.paused && countDisconnectedPlayers(room) === 0) {
      cancelLifecycleTimer(room, "pause-timeout");
      room.paused = false;
      room.pausedAt = null;
      logger.info({ roomCode: room.roomCode }, "Room resumed — all players reconnected");
      broadcastStateToRoom(room, undefined, { type: "GAME_RESUMED" });
    }
    ```
  - [x] 6.2 Partial reconnect (still ≥ 1 disconnected) falls through the `if` → paused stays true, pause-timeout keeps ticking. The preceding `PLAYER_RECONNECTED` broadcast still fires (AC12 requirement).
  - [x] 6.3 Verify `attachToExistingSeat` is the only reconnect entry point that needs this. `handleJoinRoom`'s tokenless grace-recovery branch (lines 346–365) also routes through `attachToExistingSeat`, so the resume logic is picked up automatically. Document this in the function's top-of-file JSDoc.

- [x] **Task 7: Server — `PlayerGameView.paused` emission** (AC: 8, 16)
  - [x] 7.1 In [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) `buildPlayerView`, add `paused: room.paused` to the returned `PlayerGameView` object. Optionally add `pauseReason: room.paused ? "simultaneous-disconnect" : undefined` if the implementer wants to surface the reason (currently only one cause exists; leave `pauseReason` off if it would require extra type plumbing for no benefit).
  - [x] 7.2 Confirm `buildLobbyState` is NOT touched — pause is in-game only (AC8).

- [x] **Task 8: Server — tests** (AC: 1, 3, 4, 5, 7, 11, 12, 15, 16)
  - [x] 8.1 New file [`packages/server/src/websocket/pause-handlers.test.ts`](../../packages/server/src/websocket/pause-handlers.test.ts): unit tests for `handlePauseTimeout` and `releaseSeat` using a minimally-constructed `Room` + fake logger. Cover: play-phase auto-end, charleston-phase auto-end, already-ended guard (calling with `gamePhase === "scoreboard"` → no-op), seat release for still-disconnected players, `GAME_ABANDONED` broadcast, room NOT cleaned up.
  - [x] 8.2 Extend [`grace-expiry-fallbacks.test.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.test.ts): add an `it("early-returns when room is paused", ...)` test that sets `room.paused = true` and asserts `applyGraceExpiryGameActions` does not call `handleAction` or `broadcastGameState` (AC4).
  - [x] 8.3 Extend [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts) with a new `describe("Story 4B.3 — simultaneous disconnect pause", ...)` block covering T1–T12 from the Transition scenarios table. Use `setGracePeriodMs(SHORT_GRACE_MS)` + `setPauseTimeoutMs(SHORT_PAUSE_MS)` (e.g. 25ms / 100ms) for the integration-style cases, or `vi.useFakeTimers()` for precise sequencing. Critical assertions:
    - T1: second disconnect triggers exactly one `GAME_PAUSED` broadcast, first player's grace timer is cleared (check `room.graceTimers.size === 0` after pause), no `PLAYER_RECONNECTING` for the second player.
    - T2: both reconnect → exactly one `GAME_RESUMED` broadcast on the second reconnect, not the first. Use `broadcastRecorder`-style mock that tracks resolvedAction sequence.
    - T3: advance past pause-timeout → `GAME_ABANDONED` broadcast, `room.gameState.gamePhase === "scoreboard"`, `room.gameState.gameResult` is a `WallGameResult`, still-disconnected players removed from `room.players`, room NOT cleaned up (`roomManager.cleanupRoom` not called).
    - T4: third disconnect while paused → `room.graceTimers.size === 0` still, `pause-timeout` timer identity unchanged (not restarted).
    - T7: 2 disconnects in lobby (`room.gameState === null`) → pause NOT triggered, existing `disconnect-timeout` path intact.
    - T8: 2 disconnects during scoreboard phase → pause NOT triggered, grace timers install normally.
  - [x] 8.4 Extend [`action-handler.test.ts`](../../packages/server/src/websocket/action-handler.test.ts) (or create if missing) with an `it("rejects game actions when room is paused", ...)` test for AC3. Assert `sendActionError` is called with `"ROOM_PAUSED"` and `handleAction` is not invoked. Cover at least DISCARD_TILE, CHARLESTON_PASS, and START_GAME.
  - [x] 8.5 `afterEach` in every new test block: `setPauseTimeoutMs(DEFAULT_PAUSE_TIMEOUT_MS)` to avoid leakage (AC15).

- [x] **Task 9: Client — banner + mapper** (AC: 13, 14, 16)
  - [x] 9.1 In [`mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts), thread `paused: view.paused ?? false` through to the mapped `GameTableProps`. Inspect the existing shape (seats + view-level fields) and add the new prop following the existing style — do **not** invent a new nested struct.
  - [x] 9.2 In [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue), add `paused?: boolean` (default `false`) to the `defineProps` interface. Render a new `<div v-if="paused" data-testid="game-paused-banner" class="...">Waiting for players to reconnect…</div>` positioned as an overlay on the table (top center or full-width strip — match the existing muted banner patterns from scoreboard / AFK prompts). Plain text, muted tone tokens, no spinner, no motion.
  - [x] 9.3 Do **not** programmatically disable rack DnD, call buttons, or discard interactions. The server rejects actions via AC3; the existing error-toast path displays `ROOM_PAUSED` as a generic action error. If the implementer feels an urge to add `:disabled="paused"` bindings, stop and re-read AC13 — scope creep.
  - [x] 9.4 Verify [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) requires no changes — `playerGameView.value = state` already carries the new `paused` field as part of the shallowRef replacement. The new `GAME_PAUSED` / `GAME_RESUMED` / `GAME_ABANDONED` resolvedActions flow through the existing `resolvedAction` shallowRef without code changes (the ref just holds whatever variant the server sent).

- [x] **Task 10: Client — tests** (AC: 13, 14, 16)
  - [x] 10.1 Add `GameTable.test.ts` (or extend existing) case: render with `paused: true` → banner visible by `data-testid="game-paused-banner"`; with `paused: false` → banner not in DOM.
  - [x] 10.2 Add a `useRoomConnection` test that: (a) feeds a `STATE_UPDATE` with `state.paused = true` + `resolvedAction: GAME_PAUSED` → `playerGameView.value.paused === true`; (b) feeds a follow-up `STATE_UPDATE` with `state.paused = false` + `resolvedAction: GAME_RESUMED` → `playerGameView.value.paused === false`. Use the existing test patterns in `useRoomConnection.reconnection.test.ts` / `useRoomConnection.sendChat.test.ts`.
  - [x] 10.3 Add a test for the auto-end transition: feed a `STATE_UPDATE` with `paused: true`, then a follow-up with `gamePhase: "scoreboard"`, `gameResult: { winnerId: null, points: 0 }`, `paused: false`, `resolvedAction: GAME_ABANDONED` → component reflects scoreboard view, banner cleared (AC14).

- [x] **Task 11: Regression gate + finalize** (AC: 16)
  - [x] 11.1 `pnpm test` (all packages) — green.
  - [x] 11.2 `pnpm run typecheck` — green. Especially watch for `ResolvedAction` exhaustiveness breakage in client composables.
  - [x] 11.3 `vp lint` — green.
  - [x] 11.4 Update File List below with every touched file.
  - [x] 11.5 Update `sprint-status.yaml`: `4b-3-simultaneous-disconnection-game-pause: ready-for-dev → in-progress` when Dev picks it up, then `→ review` at implementation complete, `→ done` after code review.

## Dev Notes

### Epic & requirements traceability

- [`epics.md`](../planning-artifacts/epics.md#L2696) — Story **4B.3** (FR108, FR109).
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — Decision 7 (Reconnection Strategy) establishes the full-state model pause builds on; the 2-minute window comes from FR109.
- Builds on 4B.1 ([`4b-1-reconnection-with-full-state-restore.md`](./4b-1-reconnection-with-full-state-restore.md)) and 4B.2 ([`4b-2-phase-specific-reconnection-fallbacks.md`](./4b-2-phase-specific-reconnection-fallbacks.md)).

### Infrastructure already in place (do not re-build)

| Capability | Location | Notes |
|---|---|---|
| Per-player grace timers (30s default) | [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` lines 254–286 | 4B.3 **suspends** these on pause (AC10). Do not rebuild the grace-timer install path; just clear the map on pause. |
| Grace-expiry fallbacks (auto-discard, auto-pass, charleston) | [`grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) + `applyCharlestonAutoAction` in join-handler | 4B.3 adds a one-line pause guard at the top of `applyGraceExpiryGameActions` (AC4). |
| Lifecycle timer framework | [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) | 4B.3 adds one new variant `"pause-timeout"` + `DEFAULT_PAUSE_TIMEOUT_MS` + test setter. Do not rewrite the helpers. |
| `broadcastStateToRoom` / `broadcastGameState` | [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) | Consolidated fan-out from 4B.2. Reuse for all new broadcasts. |
| `attachToExistingSeat` shared reconnect path | [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) lines 77–149 | Both token + tokenless grace recovery route through it. 4B.3 adds the resume check AFTER the existing `PLAYER_RECONNECTED` broadcast. |
| `ResolvedAction` discriminated union wire format | [`game-state.ts`](../../packages/shared/src/types/game-state.ts) line 231 | 4B.3 adds three new variants. Every existing `switch` on `ResolvedAction.type` must stay exhaustive. |
| Scoreboard phase + `WallGameResult` | [`game-state.ts`](../../packages/shared/src/types/game-state.ts) line 59 + engine call-window `closeCallWindow` | Reuse `WallGameResult` for auto-end — no new `GameResult` variant. Client `Scoreboard.vue` already handles wall-game draws. |
| `sendActionError` + error code pattern | [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) | New error code `"ROOM_PAUSED"` follows the same shape as existing `"GAME_NOT_STARTED"`, `"INVALID_ACTION"`, etc. |

**Bottom line:** this story adds one flag (`room.paused`), one lifecycle timer variant, three resolvedAction discriminants, and one `PlayerGameView` field. Everything else reuses existing machinery.

### Architecture compliance

| Topic | Rule |
|---|---|
| **Engine purity** | `GamePhase` stays `"lobby" \| "charleston" \| "play" \| "scoreboard" \| "rematch"` — no `"paused"` variant. Pause is a server-side `Room` flag, surfaced via `PlayerGameView.paused`. The engine does not know about pause. |
| **Full-state model** | Every pause / resume / auto-end broadcast ships a complete filtered `PlayerGameView` — no delta replay. Client applies `playerGameView.value = state` as usual. |
| **Server authority** | Clients never self-pause. `room.paused` is the single source of truth; clients render based on the broadcast flag. |
| **Validate-then-mutate** | Pause branch order in `registerDisconnectHandler`: guard (session match) → mutate (`connected=false`) → classify (count + phase) → branch (pause / normal). Never broadcast before the mutation is committed. |
| **Single source of post-state sequencing** | `sendPostStateSequence` (4B.1) stays the owner for STATE_UPDATE → CHAT_HISTORY ordering on per-socket sends. `GAME_PAUSED` / `GAME_RESUMED` / `GAME_ABANDONED` are `broadcastStateToRoom` fan-outs; they do **not** route through `sendPostStateSequence` (chat history is not re-sent on pause/resume). |
| **Consolidated broadcast fan-out** | `broadcastStateToRoom` (from 4B.2 consolidation in `state-broadcaster.ts`) owns the try/catch-per-session safety. 4B.3 does not add any new raw `ws.send` call sites. |
| **Imports** | Tests: `vite-plus/test`; app: `vite-plus`. No `vitest` / `vite` direct imports. Server has no `@mahjong-game/shared/testing` subpath yet (4B.2 follow-up) — keep test helper imports consistent with 4B.2 precedent. |
| **Composition API + `<script setup lang="ts">`** | `GameTable.vue` is already SFC + Composition; keep the banner addition minimal. |

### Anti-patterns (do not ship)

- **Adding a `"paused"` variant to `GamePhase`** — violates engine purity (AC2). Pause is a Room flag. Do not touch the shared `GamePhase` union.
- **Re-installing per-player grace timers on partial reconnect** — violates AC10 invariant. While paused, the pause-timeout is the only countdown.
- **Resetting the pause-timeout timer on additional disconnects while paused** — violates AC11 (T4). This would let malicious / flaky clients hold the room paused indefinitely by rolling disconnects.
- **Calling `roomManager.cleanupRoom` from the pause auto-end path** — violates AC7. Cleanup belongs to the idle-timeout path (5 min post-scoreboard) and the existing `all_disconnected` path (lobby only).
- **Blocking chat or reactions while paused** — players need to communicate about who's reconnecting. Only game actions are gated (AC3). Chat and reactions flow through a different handler and must remain live.
- **Introducing a new `GameResult` variant for "abandoned"** — reuse `WallGameResult` (winnerId: null, points: 0). The `GAME_ABANDONED` resolvedAction carries the reason ("pause-timeout"); the result itself is a draw. Client scoreboard already renders wall-game draws.
- **Programmatically disabling client rack DnD / call buttons on pause** — scope creep for 4B.3. Server rejection via `ROOM_PAUSED` error is the authoritative block; the banner is the user-facing signal. Interactive disabling is a 5B polish concern.
- **Tokenless grace recovery via displayName during pause** — by design, the match predicate `room.graceTimers.has(playerId)` fails because AC10 clears the map. Do not work around this for 4B.3 (see T11 known gap).
- **Broadcasting both `PLAYER_RECONNECTING` and `GAME_PAUSED` from the same close handler invocation** — the branches in Task 3.2 are XOR. One or the other, never both.
- **Using real time in pause-timer tests** (`await new Promise(r => setTimeout(r, 120_000))`) — use fake timers or `setPauseTimeoutMs`.
- **Mutating `room.gameState.scores` in the auto-end path** — leave them exactly where they were when pause fired. Current in-progress scores become final.

### Implementation edge cases

- **Race: disconnect A then disconnect B within the same event-loop tick.** Node's `close` events serialize per socket, but multiple sockets can fire in arbitrary order. The first fire hits Branch C (count 1 → normal grace start + PLAYER_RECONNECTING broadcast). The second fire hits Branch B (count 2 → pause trigger, clears the first player's grace timer). Net effect: the first `PLAYER_RECONNECTING` broadcast went out and is visually a no-op in the final state, but not a bug — clients render both the first player's reconnecting label **and** the pause banner (for ~1 tick) before the second broadcast lands. Tests should not assert "exactly one broadcast" across both fires; they should assert "at least one GAME_PAUSED, zero or one PLAYER_RECONNECTING on the losing-race player."
- **4-player room, all 4 disconnect simultaneously.** The first disconnect goes through normal single-disconnect path; the second triggers pause (Branch B) which cancels the `disconnect-timeout` started by `allPlayersDisconnected` (if the first disconnect already installed it — lines 291–295). Wait — `allPlayersDisconnected` only returns true when ALL 4 are disconnected, so it would only fire on the 4th disconnect. In practice: first disconnect → grace timer + PLAYER_RECONNECTING; second → pause trigger (clears grace, starts pause-timeout); third and fourth → Branch A (untyped broadcast, no-op otherwise). `allPlayersDisconnected` check lives inside Branch C only (after Task 3.3 cleanup), so it never fires while paused.
- **Reconnect during the ~millisecond window between `startLifecycleTimer` firing and `handlePauseTimeout` running its body.** The `if (!room.paused) return;` guard at the top of `handlePauseTimeout` handles this: if `attachToExistingSeat` already flipped `room.paused = false` between timer fire and callback execution, the auto-end is a no-op.
- **`gameState.gamePhase === "scoreboard"` at the moment pause would fire.** AC1 gates on `"play"` or `"charleston"` — if the game already ended, the pause trigger is skipped and the legacy per-player grace timers run normally (seat release after 30s). T8 test covers this.
- **Tokenless reconnect during pause.** As documented in T11, the tokenless recovery path (`handleJoinRoom` lines 346–365) scans `room.graceTimers.has(p.playerId)` as a match predicate. Since pause clears `graceTimers`, tokenless recovery **fails** during pause. Client falls through to new-player join. This is a known limitation — fine for 4B.3, may be revisited if/when session identity becomes more robust. Token-based reconnect is unaffected.
- **`cancelLifecycleTimer(room, "pause-timeout")` inside `attachToExistingSeat`'s resume check.** The helper is no-op-safe if the timer was never installed (only the last reconnect in a cascade hits the full-connected branch). This matches the existing pattern in `attachToExistingSeat` line 109 where `cancelLifecycleTimer(room, "disconnect-timeout")` is called unconditionally on every reconnect.
- **Engine state during pause:** `room.gameState` is NOT mutated by pause. The next game action (post-resume) operates on exactly the state that existed at pause time — current turn, turn phase, call window, Charleston submissions, everything. This is why pause is a `Room` flag and not a `gameState` field — zero engine touch.
- **Chat history during pause.** Chat messages sent during pause append to `room.chatHistory` as normal. On post-pause reconnect, clients receive full chat history via the existing `sendPostStateSequence` → `sendChatHistoryAfterStateUpdate` path (no 4B.3 changes).

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Shared types | [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) (`ResolvedAction` union + 3 discriminants), [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts) (`PlayerGameView.paused` field) |
| Server — core | [`packages/server/src/rooms/room.ts`](../../packages/server/src/rooms/room.ts) (`paused`, `pausedAt`), [`packages/server/src/rooms/room-manager.ts`](../../packages/server/src/rooms/room-manager.ts) (init defaults), [`packages/server/src/rooms/room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) (`"pause-timeout"` variant + `setPauseTimeoutMs`), [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) (pause trigger, resume check, `countDisconnectedPlayers`), new [`packages/server/src/websocket/pause-handlers.ts`](../../packages/server/src/websocket/pause-handlers.ts) (`handlePauseTimeout`, `releaseSeat`), [`packages/server/src/websocket/action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) (`ROOM_PAUSED` gate), [`packages/server/src/websocket/state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) (`buildPlayerView` emits `paused`), [`packages/server/src/websocket/grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) (pause guard early-return) |
| Server — tests | new [`packages/server/src/websocket/pause-handlers.test.ts`](../../packages/server/src/websocket/pause-handlers.test.ts), extended [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts), extended [`grace-expiry-fallbacks.test.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.test.ts), extended or new `action-handler.test.ts` |
| Client | [`packages/client/src/composables/mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) (`paused` mapping), [`packages/client/src/components/game/GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) (banner) |
| Client — tests | extended or new `GameTable.test.ts` (banner), extended `useRoomConnection.*.test.ts` (pause/resume/abandoned state transitions) |

### Cross-session intelligence (claude-mem)

- **Epic 4B.1** established the reconnection backbone (`PLAYER_RECONNECTING`, `sendPostStateSequence`, `attachToExistingSeat`, tokenless grace recovery). 4B.3 extends it with one layer above: room-level pause when the grace-per-player model stops being appropriate (2+ simultaneous drops). Do not fork the reconnect path.
- **Epic 4B.2** consolidated broadcast fan-out into `state-broadcaster.ts` with try/catch-per-session (retro `4b1-review-1/2`). Every new broadcast in 4B.3 goes through `broadcastStateToRoom` / `broadcastGameState` — do not invent a new raw `ws.send` loop.
- **Epic 4B.2** also established `attachToExistingSeat` build-before-mutate discipline (retro `4b1-review-3`). 4B.3's resume check adds ONE post-mutation side effect (cancel timer + flip `paused` flag + broadcast); it does not introduce new mutate-before-build orderings.
- **Epic 6A retro follow-through `6a-retro-1`** (transition scenarios in story specs) is why this story enumerates T1–T12. Every row must have a test before code review signs off.
- **Epic 4B.2 Review Follow-ups** flagged hand-constructed `Room` fixtures as maintenance debt. For new tests in 4B.3, prefer `roomManager.createRoom()` over hand-constructed `Room` literals where feasible. The new `pause-handlers.test.ts` is allowed to use a minimal handwritten `Room` if it tests pure helper logic, but `join-handler.test.ts` extensions should route through `roomManager` as the existing file does.

### Git intelligence (recent commits)

```
93f9244 feat: implement phase-specific reconnection fallbacks for multiplayer Mahjong   (4B.2)
9410832 feat: implement reconnection with full state restore for multiplayer resilience (4B.1)
659e2fd chore: update claude-mem context rules and finalize Epic 6A documentation
```

4B.2 (93f9244) introduced the grace-expiry-fallbacks module and `state-broadcaster` consolidation. Review that commit's shape when adding the new `pause-handlers.ts` module — same three-piece layout (core function, optional private helpers, clean test file). 4B.1 (9410832) established the `setGracePeriodMs` test pattern; mirror it for `setPauseTimeoutMs` in `room-lifecycle.ts`.

### Latest tech / versions

No new dependencies. `setTimeout` + `clearTimeout` for the pause-timeout timer. Vue 3 SFC for the banner. Existing `ws` library for broadcasts. Keep the surface minimal.

### Project context reference

[`project-context.md`](../project-context.md) (if present) — reconnection and WebSocket sections apply. Grace period 30s / pause timeout 2 min are the two reconnection windows. Pause is the new second-level escalation when single-player grace cannot help (needed both players).

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation session 2026-04-05)

### Debug Log References

### Completion Notes List

- Implemented room-level `paused` / `pausedAt`, `"pause-timeout"` lifecycle timer (`setPauseTimeoutMs`), `pause-handlers.ts` (`handlePauseTimeout`, `releaseSeat`), pause trigger + resume in `join-handler`, `ROOM_PAUSED` gate in `action-handler`, `PlayerGameView.paused` in `buildPlayerView`, client `GameTable` banner + mapper. Tests: `pause-handlers.test.ts`, extended `join-handler`, `grace-expiry-fallbacks`, `action-handler`, `state-broadcaster`, `GameTable.test`, `useRoomConnection.reconnection.test`. T11 remains a documented known gap (tokenless recovery during pause).
- **Pass 2 (2026-04-05):** Added dedicated transition coverage: `join-handler.test.ts` — T5 (`broadcastStateToRoom` GAME_RESUMED only on last of three reconnects), T8 (scoreboard phase — no pause, two grace timers), T9 (post-resume single disconnect installs per-player grace; long grace + delay assert to avoid WS buffer races), T10 (SESSION_SUPERSEDED close while paused does not drop seat), T12 (stale token after auto-end → `INVALID_DISPLAY_NAME`). `action-handler.test.ts` — extended AC3 with `CHARLESTON_PASS` and `CALL_PUNG` under `ROOM_PAUSED`. Full gate: `pnpm test`, `pnpm run typecheck`, `vp lint`.
- **Code review (2026-04-05, Pass 3):** Applied adversarial review fixes:
  - **M1 (idle-timeout arming):** `handlePauseTimeout` now arms `idle-timeout` (5 min) when auto-end leaves ≥2 players connected, matching the AC7 narrative. Previously only `abandoned-timeout` fired when `players.size ≤ 1`, leaving 2–3-player auto-ended rooms with no cleanup countdown. Added two unit tests in `pause-handlers.test.ts` (idle-timeout vs abandoned-timeout branch).
  - **M2 (pause-timeout leakage between tests):** Strengthened `afterEach` in the `Story 4B.3` describe block in `join-handler.test.ts` to iterate all active rooms and cancel any lingering `pause-timeout`, removing the reliance on each test remembering to call `cancelLifecycleTimer` manually.
  - **L1 (dead parameters):** Dropped unused `roomManager` / `logger` parameters from `releaseSeat`; simplified three call sites (`pause-handlers.ts` internal, `join-handler.ts` grace-expiry path, `pause-handlers.test.ts`).
  - **L2 (comment):** Added clarifying comment in `join-handler.ts` Branch A explaining why the dead session entry is intentionally left in `room.sessions` under pause.
  - Regression gate re-run: 277 server tests + 396 client tests passing, `pnpm run typecheck` clean, `vp lint` clean (0 errors).

### File List

- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/protocol.ts`
- `packages/server/src/rooms/room.ts`
- `packages/server/src/rooms/room-manager.ts`
- `packages/server/src/rooms/room-lifecycle.ts`
- `packages/server/src/websocket/join-handler.ts`
- `packages/server/src/websocket/pause-handlers.ts`
- `packages/server/src/websocket/pause-handlers.test.ts`
- `packages/server/src/websocket/action-handler.ts`
- `packages/server/src/websocket/action-handler.test.ts`
- `packages/server/src/websocket/grace-expiry-fallbacks.ts`
- `packages/server/src/websocket/grace-expiry-fallbacks.test.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/websocket/join-handler.test.ts`
- `packages/server/src/websocket/chat-handler.test.ts`
- `packages/server/src/rooms/room-lifecycle.test.ts`
- `packages/server/src/rooms/seat-assignment.test.ts`
- `packages/server/src/rooms/session-manager.test.ts`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.ts`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts`
- `packages/client/src/composables/gameActionFromPlayerView.test.ts`
- `packages/client/src/composables/useRoomConnection.reconnection.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/dev/PlayerGameViewBridgeShowcase.vue`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4b-3-simultaneous-disconnection-game-pause.md`

## Change Log

- **2026-04-05:** Pass 3 (code review) — fixed idle-timeout arming in auto-end, strengthened 4B.3 test block `afterEach` against pause-timeout leakage, dropped unused `releaseSeat` parameters, added Branch A comment. Status → done.
- **2026-04-05:** Pass 2 — expanded transition-scenario tests (T5, T6, T8, T9, T10, T12) and AC3 action variants; full regression green.
- **2026-04-05:** Implementation complete; Story 4B.3 ready for code review (`pnpm test`, `pnpm run typecheck`, `vp lint` green).
- **2026-04-05:** Story 4B.3 created. Enumerates 16 ACs + 12 transition scenarios. Builds on 4B.1 reconnection backbone and 4B.2 grace-expiry fallbacks. Key decisions: (1) pause is a `Room` flag, not a `GamePhase` variant — keeps engine pure; (2) per-player grace timers are **cleared** on pause, not suspended/resumed — pause-timeout is the single room-level countdown; (3) auto-end reuses `WallGameResult` (no new `GameResult` variant); (4) room stays alive after auto-end so scoreboard renders and rematch is possible; (5) tokenless grace recovery during pause is a documented known gap (T11) since the match predicate requires `graceTimers`. Out of scope: multi-game session score history (no infra), host migration, departure. Three new `ResolvedAction` discriminants (`GAME_PAUSED`, `GAME_RESUMED`, `GAME_ABANDONED`) and one new `PlayerGameView` field (`paused`).
