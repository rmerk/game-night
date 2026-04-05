# Story 4B.5: Player Departure & Dead Seat

Status: done

<!-- Epic 4B story 5. Adds intentional player departure (LEAVE_ROOM) distinct from disconnect, the "dead seat vs end game" departure vote (FR94, FR95), full dead-seat turn-skip + wall-skip + call-window auto-pass semantics (FR96), and multi-departure auto-end (FR97). Replaces the minimal AC14 dead-seat auto-discard stub from Story 4B.4 with the real turn-skip implementation. Explicitly defers: host-migration-specific prompt and HOST_PROMOTED flow (Story 4B.6), AI fill-in (not in MVP per FR99), "table is full" 5th-player page (Story 4B.7). -->

## Story

As a **player**,
I want **the game to handle a teammate permanently leaving the table with a vote to either continue with them as a dead seat (hand locked, turns auto-skipped, wall draws reallocated) or end the game, and to auto-end immediately if two or more players leave**,
so that **one person quitting doesn't freeze the table for everyone else, and the remaining 3 players can finish out the game as a 3-player round when they choose to (FR94, FR95, FR96, FR97, FR99)**.

## Acceptance Criteria

1. **AC1 — `LEAVE_ROOM` protocol message.** Add a new client→server message type to [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts) alongside `AfkVoteCastMessage`:
   ```
   interface LeaveRoomMessage {
     version: typeof PROTOCOL_VERSION;
     type: "LEAVE_ROOM";
   }
   ```
   No payload beyond `version`/`type`. Route in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) message dispatch to a new `handleLeaveRoomMessage(ws, session, room, logger, roomManager)` in a new [`packages/server/src/websocket/leave-handler.ts`](../../packages/server/src/websocket/leave-handler.ts) module. **Intentional departure is distinct from socket disconnect** — a disconnect (tab close, network drop) still goes through the existing grace-period → grace-expiry → `releaseSeat` path in [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) and does **not** start a departure vote. Only an explicit `LEAVE_ROOM` message triggers the 4B.5 departure flow.

2. **AC2 — `handleLeaveRoomMessage` lifecycle.** The handler runs in this strict order:
   - (a) Validate session exists (reuse the `session` returned from `roomManager.findSessionByWs(ws)` in the dispatcher). If no session, send `NOT_IN_ROOM` error and return.
   - (b) Look up `playerId = session.player.playerId`. If `room.departedPlayerIds.has(playerId)` (see AC3), log a warn and return (idempotent — re-sending `LEAVE_ROOM` after a leave is a no-op).
   - (c) Log `"Player departed"` with `roomCode` and `playerId`.
   - (d) Mark the player departed by calling `markPlayerDeparted(room, playerId, logger)` (new helper in `leave-handler.ts`) — see AC3.
   - (e) Close the WebSocket with code `4000` reason `"LEAVE_ROOM"` **after** marking departed, so the subsequent `ws.on("close", …)` disconnect handler in `registerDisconnectHandler` (join-handler.ts) runs against a room that already knows the player is departed. The disconnect handler must **short-circuit** for departed players — see AC4.

3. **AC3 — Room state: `departedPlayerIds` + `departureVoteState`.** Extend [`Room`](../../packages/server/src/rooms/room.ts) with two new fields alongside the Story 4B.4 dead-seat fields:
   - `departedPlayerIds: Set<string>` — players who sent `LEAVE_ROOM` and whose seats have not yet been cleaned up. Initialize empty in `createRoom`. A player in this set is also typically in `deadSeatPlayerIds` (after the vote passes) or no longer in `room.players` (after end-game auto-cleanup). The set exists to distinguish "intentional quit, waiting for vote or cleanup" from "disconnected with grace period" during the race window before `releaseSeat` runs.
   - `departureVoteState: DepartureVoteState | null` (new server-only interface declared in `leave-handler.ts`, not in `@mahjong-game/shared`):
     ```
     interface DepartureVoteState {
       readonly targetPlayerId: string;
       readonly targetPlayerName: string;
       readonly startedAt: number;
       votes: Map<string, "dead_seat" | "end_game">; // voterId → choice
     }
     ```
     Initialize `null` in `createRoom`.
   
   `markPlayerDeparted(room, playerId, logger)` does:
   - Add `playerId` to `room.departedPlayerIds`.
   - Set `player.connected = false` (they're leaving for good).
   - Cancel any pending grace timer for this player (`room.graceTimers.get(playerId)`) — there shouldn't be one yet since we're ahead of the disconnect handler, but be defensive.
   - Cancel the turn timer if `room.turnTimerPlayerId === playerId` (same defense as 4B.4 AC9 handles for disconnect).
   - Cancel an in-progress AFK vote targeting this player via `cancelAfkVote(room, logger, "target_active")` — a leave resolves the AFK vote (they're gone; no need to keep voting). If the vote was targeting someone *else*, leave it alone unless the departing player is one of the voters (the vote continues with their vote erased from the tally; see AC7 interaction).
   - Broadcast `PLAYER_DEPARTED` resolvedAction (AC11).
   - Then branch per AC5: multi-departure auto-end OR start departure vote OR (degenerate ≤1 remaining) immediate auto-end.

4. **AC4 — Disconnect handler short-circuits for departed players.** In [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` `ws.on("close", …)`, at the top of the callback (immediately after the `if (!player) return` and `if (!session || session.ws !== ws) return` guards), add:
   ```
   if (room.departedPlayerIds.has(playerId)) {
     // Intentional leave already handled by handleLeaveRoomMessage.
     // Skip grace period, skip PLAYER_RECONNECTING broadcast, skip pause trigger.
     return;
   }
   ```
   This keeps the disconnect handler inert for intentional departures — the leave path owns all state transitions for departed players.

5. **AC5 — Departure branching: multi-departure auto-end vs. vote vs. degenerate.** Inside `markPlayerDeparted`, after updating `departedPlayerIds` and broadcasting `PLAYER_DEPARTED`, branch on the new departed-count:
   - **`departedPlayerIds.size >= 2` → auto-end (FR97).** The game auto-ends immediately. Call `autoEndGameOnDeparture(room, logger, roomManager)` (new helper, AC8). Do **not** start a departure vote.
   - **`room.players.size - departedPlayerIds.size < 2` (i.e. fewer than 2 live connected players remain) → auto-end.** This also covers the "1 player left sends LEAVE_ROOM" degenerate case and is separate from the ≥2-departed gate; both lead to the same auto-end path. Call `autoEndGameOnDeparture`.
   - **Otherwise (at least 2 connected non-departed players remain and total departures = 1) → start departure vote (AC6).**
   
   "Live connected non-departed players" = players in `room.players` where `connected === true` AND `!departedPlayerIds.has(playerId)` AND `!deadSeatPlayerIds.has(playerId)`. Dead-seat players do not vote on subsequent departures (they've already been ejected from play).
   
   **Lobby phase:** if `gameState === null` or `gamePhase === "lobby"`, `LEAVE_ROOM` **does not start a vote**. Instead it runs `releaseSeat(room, playerId)` directly (remove from players map, tokens, sessions) and broadcasts a lobby `STATE_UPDATE` + a `PLAYER_DEPARTED` resolved action. No dead seat, no vote. Rationale: dead-seat semantics only make sense mid-game. Gate this branch at the top of `markPlayerDeparted` **before** the departure-vote branching so lobby leaves skip the vote entirely.

6. **AC6 — Departure vote state machine.** Introduce `DepartureVoteState` per AC3. Vote lifecycle:
   - **Start:** In `startDepartureVote(room, targetPlayerId, targetPlayerName, logger)`, build `DepartureVoteState` with empty votes map. Start a `"departure-vote-timeout"` lifecycle timer (new variant — AC12) with 30s default duration. Broadcast `DEPARTURE_VOTE_STARTED` resolved action (AC11) with `targetPlayerId`, `targetPlayerName`, and `expiresAt: Date.now() + 30_000`.
   - **Cast (new protocol action — AC10):** On receiving a valid `DEPARTURE_VOTE_CAST` message from voter `V`, `votes.set(V, choice)`. Broadcast `DEPARTURE_VOTE_CAST` resolved action. Then call `resolveDepartureVote(room, logger, roomManager, "vote")`.
   - **Resolve:** `resolveDepartureVote`:
     - `livingVoterCount` = number of `room.players` where `connected === true && !departedPlayerIds.has(p) && !deadSeatPlayerIds.has(p) && p.playerId !== targetPlayerId`.
     - `deadSeatCount` = number of `"dead_seat"` votes in the map.
     - `endGameCount` = number of `"end_game"` votes.
     - **Majority rule (2 of 3):** if `deadSeatCount >= 2` → outcome `"dead_seat"` → convert departed player to dead seat (AC7). If `endGameCount >= 2` → outcome `"end_game"` → auto-end (AC8). Both are majority gates — whichever side hits 2 first wins.
     - **Degenerate 2-voter case:** if `livingVoterCount === 2` (e.g. a voter disconnected mid-vote), adjust majority to `1 of 2` — a single vote is enough to decide, and a tie (1 each) waits for timeout. Use `Math.ceil(livingVoterCount / 2)` as the threshold. For 3 voters this is 2 (unchanged); for 2 it's 1; for 1 it's 1 (pathological but covered).
     - **Timeout:** if the lifecycle `"departure-vote-timeout"` fires (30s elapsed) and no threshold was reached, outcome is `"end_game"` by default (no quorum = group couldn't decide = bail out safely). Same resolution path as an explicit `end_game` majority.
     - **On resolve (any outcome):** cancel the lifecycle timer, clear `room.departureVoteState = null`, broadcast `DEPARTURE_VOTE_RESOLVED` (AC11) with the outcome, then call the outcome-specific handler (`convertToDeadSeat` or `autoEndGameOnDeparture`).
   - **Concurrency:** only one departure vote can be active at a time. If a second player departs while a vote is open, the `departedPlayerIds.size >= 2` gate in AC5 fires **before** the vote can resolve — the auto-end path cancels the active vote (broadcast `DEPARTURE_VOTE_RESOLVED { outcome: "cancelled" }`) and routes to end-game. See AC7 interaction.
   - **No re-voting after resolution:** once a player's departure vote resolves, their outcome is final. (Unlike AFK vote cooldown, departure is terminal.)

7. **AC7 — Outcome `"dead_seat"`: `convertToDeadSeat(room, playerId, logger)`.** Implement in `leave-handler.ts`. Steps:
   - (a) Add `playerId` to `room.deadSeatPlayerIds` (idempotent — `Set.add` no-op if already present).
   - (b) Do **NOT** call `releaseSeat(room, playerId)`. The departed player stays in `room.players` so their `PlayerPublicInfo` continues to appear in broadcasts (so opponents see their nameplate with the dead-seat badge), and their `GameState.players[playerId]` stays populated so their exposed groups remain visible on the table (per epic AC "their exposed tiles remain visible"). Their `connected = false` remains — this is fine, grace-expiry cannot fire for them because `departedPlayerIds.has(playerId)` short-circuits the disconnect handler (AC4), and the turn-skip logic (AC9) gates on `deadSeatPlayerIds` not `connected`.
   - (c) Remove them from `room.sessions` (they have no live socket anyway). Leave token/playerTokens in place — these cannot be reused by a fresh join because the player is still in `room.players` (and a new join would get `ROOM_FULL` if 4 are present). Future: Story 4B.6 may revisit.
   - (d) Call `syncTurnTimer(room, logger)` — this will, via AC9 below, advance past the dead seat if it was their turn. **Critically**: if an AFK vote was previously targeting *this* player, it was already cancelled in `markPlayerDeparted` (AC3); the dead-seat conversion does not need to re-cancel it.
   - (e) Broadcast `PLAYER_CONVERTED_TO_DEAD_SEAT` resolved action (AC11). This ships after `DEPARTURE_VOTE_RESOLVED` so clients see vote resolution → then the state change.

8. **AC8 — Outcome `"end_game"` / auto-end: `autoEndGameOnDeparture(room, logger, roomManager)`.** Implement in `leave-handler.ts`. Steps:
   - (a) If `room.gameState` exists and `gamePhase === "play" || "charleston"`, mutate `gs.gamePhase = "scoreboard"` and `gs.gameResult = { winnerId: null, points: 0 }` — mirror the [`handlePauseTimeout`](../../packages/server/src/websocket/pause-handlers.ts) pattern. The `GAME_ABANDONED` broadcast fires the scoreboard transition on clients.
   - (b) For each `playerId` in `room.departedPlayerIds`, call `releaseSeat(room, playerId)` to drop them from `room.players`, `sessions`, tokens, rate-limit maps. Dead-seat players previously converted via AC7 stay in the room — only the newly-departed uncleaned players get released here.
   - (c) Cancel any open departure vote (should be null by the time we get here, but defensive: `if (room.departureVoteState) { cancelLifecycleTimer(room, "departure-vote-timeout"); room.departureVoteState = null; }`).
   - (d) Call `resetTurnTimerStateOnGameEnd(room, logger)` — clears consecutive-timeout counters, cancels any AFK vote, cancels turn timer. Same invariant as pause-timeout end-game.
   - (e) Arm idle-timeout via `roomManager`: if `room.players.size <= 1`, start `"abandoned-timeout"`; otherwise start `"idle-timeout"`. Mirrors the pause-timeout pattern for consistency.
   - (f) Broadcast `GAME_ABANDONED` resolved action with a new reason variant: extend [`GAME_ABANDONED`](../../packages/shared/src/types/game-state.ts) from `{ reason: "pause-timeout" }` to `{ reason: "pause-timeout" | "player-departure" }`. This is a **breaking** change to the `ResolvedAction` union — every exhaustive switch on `ResolvedAction.type` that handles `GAME_ABANDONED` must be updated (same discipline as 4B.4 AC16). Run `pnpm run typecheck` to find them.
   - (g) Log `"Game auto-ended due to player departure"` with `roomCode`, `departedCount`, and the list of departed playerIds.

9. **AC9 — Dead-seat turn-skip + wall-skip (replaces 4B.4 AC14 stub).** This is the **core engine-adjacent change** — it replaces the `TODO(4B.5)` dead-seat auto-discard stub in [`syncTurnTimer`](../../packages/server/src/websocket/turn-timer.ts). Semantics:
   - **Turn skip:** when the current turn is a dead-seat player in `draw` phase, their turn is **skipped entirely** — they do not draw from the wall, they do not discard. The turn advances directly to the next non-dead player in counterclockwise seat order. Wall tiles that would have been their draw remain in the wall (the "wall tiles skipped" clause in the epic AC means "the tile that would have been drawn by the dead seat is instead drawn by the next player", not "a tile is consumed and discarded from the wall"). This gives remaining players more effective draws per wall (the accepted balance trade-off per GDD).
   - **Call window auto-pass:** when `turnPhase === "callWindow"` and the call window expects a response from a dead-seat player (they are in `state.callWindow.waitingOn` or equivalent — check the exact field name in `packages/shared/src/engine/actions/call-window.ts`), the server issues `PASS_CALL` on their behalf via `handleAction(gs, { type: "PASS_CALL", playerId: deadSeatId })`. Same pattern as [`applyGraceExpiryGameActions`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) but gated on `deadSeatPlayerIds.has(playerId)` instead of `!connected`.
   - **Implementation (server-side, engine-pure):** add a new helper in `turn-timer.ts` (or a new `dead-seat.ts` module if that's cleaner — implementer's call):
     ```
     /** Advance currentTurn past any dead-seat players in counterclockwise order. */
     export function advancePastDeadSeats(room: Room, logger: FastifyBaseLogger): boolean
     ```
     Returns `true` if any skip happened. The helper reads `room.gameState.currentTurn`, uses the same `SEATS` lookup math as [`advanceTurn`](../../packages/shared/src/engine/actions/draw.ts) (`packages/shared/src/constants.ts` SEATS array), and walks forward while `deadSeatPlayerIds.has(currentTurn)`. Set `gs.turnPhase = "draw"` on every skip (same as engine `advanceTurn`). Bounded loop: max 4 iterations (one per seat) — if all 4 are dead-seat, log an error and call `autoEndGameOnDeparture` as a safety net (this should be unreachable because the multi-departure gate in AC5 already catches 2+ departures, but defensive). Broadcast `TURN_SKIPPED_DEAD_SEAT` resolved action (AC11) for each skipped player so clients can render a "player is dead seat, turn skipped" toast.
   - **Call into `advancePastDeadSeats`:** from inside `syncTurnTimer` **before** the `shouldArmPlayPhaseTimer` check — if `advancePastDeadSeats` made a skip, re-enter `syncTurnTimer` (recursive) so the post-skip state gets the timer armed for the new current player. Remove the AC14 dead-seat auto-discard stub entirely.
   - **Call window hooks:** also call `advancePastDeadSeats` (or a sibling `autoPassCallWindowForDeadSeats(room, logger)`) from the post-action broadcast path in [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) `handleActionMessage` — after `broadcastGameState` and **before** `syncTurnTimer`. This catches the "discard opens call window → dead-seat players auto-pass → call window resolves" cascade. Implementer may merge both into a single `advanceDeadSeatState(room, logger)` helper that handles both turn-skip and call-auto-pass; single helper is preferred for atomicity.
   - **Anti-pattern (do NOT ship):** the 4B.4 stub that auto-discards on behalf of the dead seat. Dead seats do **not** draw and do **not** discard. They are truly skipped.

10. **AC10 — `DEPARTURE_VOTE_CAST` protocol message.** Add to [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts):
    ```
    interface DepartureVoteCastMessage {
      version: typeof PROTOCOL_VERSION;
      type: "DEPARTURE_VOTE_CAST";
      targetPlayerId: string;
      choice: "dead_seat" | "end_game";
    }
    ```
    Route in `ws-server.ts` dispatch to `handleDepartureVoteCastMessage(ws, session, room, parsed, logger, roomManager)` in `leave-handler.ts`. Validation (mirror AFK vote pattern, AC12 in 4B.4):
    - `room.departureVoteState !== null`; else `NO_ACTIVE_DEPARTURE_VOTE`.
    - `parsed.targetPlayerId === room.departureVoteState.targetPlayerId`; else `INVALID_DEPARTURE_VOTE_TARGET`.
    - `voterId !== targetPlayerId`; else `CANNOT_VOTE_ON_DEPARTED` (semantically impossible since they're gone, but defensive).
    - `voterId` is in `room.players`, `connected === true`, and **not** in `deadSeatPlayerIds` or `departedPlayerIds`; else `INVALID_ACTION`.
    - Vote is idempotent-writable (players may change their mind before quorum).
    - On invalid, `sendProtocolError` via the same helper pattern `turn-timer.ts` uses. New error codes: `NO_ACTIVE_DEPARTURE_VOTE`, `INVALID_DEPARTURE_VOTE_TARGET`, `CANNOT_VOTE_ON_DEPARTED`.

11. **AC11 — `ResolvedAction` union: six new discriminants + one field extension.** Add to [`ResolvedAction`](../../packages/shared/src/types/game-state.ts):
    - `{ readonly type: "PLAYER_DEPARTED"; readonly playerId: string; readonly playerName: string }`
    - `{ readonly type: "DEPARTURE_VOTE_STARTED"; readonly targetPlayerId: string; readonly targetPlayerName: string; readonly expiresAt: number }`
    - `{ readonly type: "DEPARTURE_VOTE_CAST"; readonly voterId: string; readonly targetPlayerId: string; readonly choice: "dead_seat" | "end_game" }`
    - `{ readonly type: "DEPARTURE_VOTE_RESOLVED"; readonly targetPlayerId: string; readonly outcome: "dead_seat" | "end_game" | "cancelled" }`
    - `{ readonly type: "PLAYER_CONVERTED_TO_DEAD_SEAT"; readonly playerId: string; readonly playerName: string }`
    - `{ readonly type: "TURN_SKIPPED_DEAD_SEAT"; readonly playerId: string }`
    
    And extend the existing `GAME_ABANDONED` variant:
    - Change `{ readonly type: "GAME_ABANDONED"; readonly reason: "pause-timeout" }` → `{ readonly type: "GAME_ABANDONED"; readonly reason: "pause-timeout" | "player-departure" }`.
    
    Fix exhaustiveness breakage across client composables, test helpers, and dev showcase routes. Run `pnpm run typecheck` to find every site. Key files per 4B.4 precedent: `mapPlayerGameViewToGameTable.ts`, `useRoomConnection.ts` resolved-action router, various `*.test.ts` fixtures, `PlayerGameViewBridgeShowcase.vue`.

12. **AC12 — New lifecycle timer variant: `"departure-vote-timeout"`.** Extend the `LifecycleTimerType` union in [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) with `"departure-vote-timeout"`. Add `DEFAULT_DEPARTURE_VOTE_TIMEOUT_MS = 30_000` and `departureVoteTimeoutMs` module variable + `setDepartureVoteTimeoutMs(ms)` test setter. Extend `getTimeoutForType` switch with the new case. Follows the exact `"afk-vote-timeout"` precedent from 4B.4 AC15.

13. **AC13 — Pause interaction (4B.3 integration).** The 4B.3 simultaneous-disconnect pause trigger in [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` Branch B must also cancel an in-progress departure vote if present:
    - After `cancelTurnTimer(room, logger)` and the existing `if (room.afkVoteState) cancelAfkVote(...)` block, add:
      ```
      if (room.departureVoteState) {
        cancelLifecycleTimer(room, "departure-vote-timeout");
        room.departureVoteState = null;
        broadcastStateToRoom(room, undefined, {
          type: "DEPARTURE_VOTE_RESOLVED",
          targetPlayerId: <target>,
          outcome: "cancelled",
        });
      }
      ```
      The cancelled vote does **not** auto-restart on resume. The departed player remains in `departedPlayerIds` with no resolution; the next voluntary action path re-triggers nothing. **Recovery:** on `GAME_RESUMED` (existing 4B.3 resume path in `attachToExistingSeat`), call a new `resumeDepartureVoteIfNeeded(room, logger)` that, if `departedPlayerIds.size >= 1` and no current vote is active and game is not already in scoreboard, re-starts the departure vote for the **first** departed player still marked departed. Document this as an accepted simplification — we don't track mid-pause vote state because vote participants may have changed. If `departedPlayerIds.size >= 2` on resume, route directly to `autoEndGameOnDeparture` instead. Simpler alternative: on pause, do not cancel the vote — just pause its lifecycle timer and resume it on `GAME_RESUMED`. **Implementer's call**; recommend the simpler pause-then-resume path to minimize state thrash. Pick one approach and document in the file header.

14. **AC14 — Action-handler dead-seat gate (from 4B.4) stays and extends.** The existing Story 4B.4 `if (room.deadSeatPlayerIds.has(playerId)) { sendActionError(..., "DEAD_SEAT", ...); return; }` gate in [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) `handleActionMessage` continues to guard against dead-seat players sending actions. 4B.5 adds a parallel gate for departed players:
    ```
    if (room.departedPlayerIds.has(playerId)) {
      sendActionError(ws, logger, "PLAYER_DEPARTED", "Departed players cannot take actions");
      return;
    }
    ```
    Order: `ROOM_PAUSED` gate → `DEAD_SEAT` gate → `PLAYER_DEPARTED` gate (or merge DEAD_SEAT and PLAYER_DEPARTED into one gate — they share semantics but the error codes differ for client toast clarity).

15. **AC15 — Game-end state cleanup on `handleStartGameAction` + `resetTurnTimerStateOnGameEnd`.** In `handleStartGameAction` (action-handler.ts), alongside the 4B.4 clears (`consecutiveTurnTimeouts`, `afkVoteState`, `afkVoteCooldownPlayerIds`, `deadSeatPlayerIds`), **also clear** `departedPlayerIds` and `departureVoteState` at the start of a new game. In `resetTurnTimerStateOnGameEnd` (turn-timer.ts), **also cancel** the `"departure-vote-timeout"` lifecycle timer and null out `departureVoteState` so game-end paths clean up vote state uniformly. Extend the helper's JSDoc to document both vote types. `departedPlayerIds` is **not** cleared on scoreboard transition (only on new `START_GAME`) — during scoreboard, the departed players remain departed so the UI can still render their absence correctly.

16. **AC16 — `PlayerGameView.departureVoteState` field.** Thread the departure vote into the client view so mid-vote reconnecters can see and participate. Extend [`PlayerGameView`](../../packages/shared/src/types/protocol.ts) with an optional `departureVoteState: { targetPlayerId: string; targetPlayerName: string; expiresAt: number } | null` field (required, default `null`). Populated by [`buildPlayerView`](../../packages/server/src/websocket/state-broadcaster.ts) from `room.departureVoteState` — the client only needs the public view (no vote tally; they re-derive their own vote from the modal state). **This is a departure from the 4B.4 AFK vote precedent** (which explicitly declined to thread vote state into the view — see 4B.4 edge case "Reconnect during AFK vote"). The rationale for 4B.5: departure is a higher-stakes, permanent outcome, and the vote timeout is long enough (30s) that reconnect-during-vote is a realistic case. Document this asymmetry in the `PlayerGameView` JSDoc. `LobbyState` is NOT extended — departure votes only fire mid-game.

17. **AC17 — Client: leave button, departure vote modal, dead-seat turn-skip toast.**
    - **Leave button:** add a "Leave game" option to the existing game menu (or create a minimal one if none exists). On click, show a confirmation dialog: "Leave the game? Your teammates will decide whether to continue without you or end the game." On confirm, call a new `sendLeaveRoom()` method on [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) that sends `{ version: 1, type: "LEAVE_ROOM" }` then closes the socket client-side. `data-testid="leave-game-button"`, `data-testid="leave-game-confirm-dialog"`.
    - **Departure vote modal:** new component [`DepartureVoteModal.vue`](../../packages/client/src/components/game/DepartureVoteModal.vue). Props: `open`, `targetPlayerName`, `expiresAt`, emits `vote: "dead_seat" | "end_game"`. Copy: "[Name] has left the game. Continue with them as a dead seat, or end the game?" Two buttons: "Continue (dead seat)" and "End game". Countdown from `expiresAt`. Wired to `AFK_VOTE_STARTED`-style pipeline from the new `DEPARTURE_VOTE_STARTED` resolvedAction. Close on `DEPARTURE_VOTE_RESOLVED`. Also read from `playerGameView.departureVoteState` on mount so reconnecters see the open vote. `data-testid="departure-vote-modal"`, `data-testid="departure-vote-dead-seat-btn"`, `data-testid="departure-vote-end-game-btn"`.
    - **Turn-skip toast:** when `TURN_SKIPPED_DEAD_SEAT` resolvedAction arrives, show a brief toast "[PlayerName]'s turn skipped (dead seat)" for 2s. Reuse existing toast pipeline. `data-testid="turn-skipped-dead-seat-toast"`.
    - **Game-abandoned scoreboard:** when `GAME_ABANDONED { reason: "player-departure" }` arrives, the scoreboard transition is handled by the existing `GAME_ABANDONED` pipeline (4B.3); 4B.5 just adds the new reason discriminant. Copy on the scoreboard should indicate "Game ended: player departed" instead of "Game ended: disconnection timeout". Small copy change, no new layout.
    - **Dead-seat badge** already exists from 4B.4 (AC17). No new component needed; it just updates naturally as `deadSeatPlayerIds` grows.
    - **No new animations, sounds, or panels.** Scope creep is Epic 7's problem.

18. **AC18 — Test strategy.** Mirror 4B.4 AC19:
    - Fake timers + short windows: `setDepartureVoteTimeoutMs(100)` in `beforeEach`, restore `DEFAULT_DEPARTURE_VOTE_TIMEOUT_MS` in `afterEach`.
    - Every transition scenario in the table below must have at least one test.
    - Integration tests live in [`leave-handler.test.ts`](../../packages/server/src/websocket/leave-handler.test.ts) (new file) using the multi-socket `roomManager.createRoom` + `connectSocket` pattern from 4B.1/4B.2/4B.3/4B.4.
    - Unit tests for `advancePastDeadSeats` (or `advanceDeadSeatState`) live in a new `dead-seat.test.ts` (or extended `turn-timer.test.ts` — implementer's call based on where the helper lives).
    - Engine-level tests: none expected, because dead-seat logic lives in the server helper, not the engine. If the implementer chooses to add an `advanceTurn({ skip?: Set<string> })` overload in `draw.ts`, add a unit test in `draw.test.ts` and keep the existing `advanceTurn()` signature backwards-compatible.

19. **AC19 — Regression gate.** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass from the repo root. All previous story tests remain green. Critical regressions to verify:
    - 4B.4 `turn-timer.test.ts`: the AC14 dead-seat stub tests (currently asserting the auto-discard behavior) must be **updated** to assert the new turn-skip behavior — dead-seat players are advanced past, not auto-discarded. T19 in 4B.4's transition table specifically exercised the stub; update it to the new semantics.
    - 4B.3 pause-handlers tests: pause + departure-vote interaction must not break existing pause sequencing.
    - 4B.2 grace-expiry tests: grace-expiry still runs for disconnected (non-departed) players exactly as before. The new `departedPlayerIds.has(playerId)` short-circuit in the disconnect handler (AC4) must not leak into the grace-expiry path for non-departed disconnects.
    - `action-handler.test.ts`: the existing `DEAD_SEAT` error path (4B.4 AC14 gate) remains green; the new `PLAYER_DEPARTED` error path is added alongside it.

20. **AC20 — Documentation.** Add a top-of-file header comment to `leave-handler.ts` documenting the three concurrent vote types now in the system (AFK vote, departure vote, social-override vote — though social-override lives elsewhere) and the divergence between AFK vote (mid-vote reconnect does NOT see the vote) vs. departure vote (mid-vote reconnect DOES see the vote via `PlayerGameView.departureVoteState`). Update `turn-timer.ts` header to cross-reference `leave-handler.ts` for the dead-seat lifecycle.

### Transition scenarios

Every row must be enumerated in implementation and covered by at least one test (Epic 6A retro follow-through `6a-retro-1`).

| # | Scenario | Expected behavior | AC |
|---|----------|-------------------|----|
| T1 | Lobby phase, E sends `LEAVE_ROOM` | `releaseSeat(room, E)` runs immediately; `PLAYER_DEPARTED` broadcast; no vote started; lobby state updates with 3 players | AC5 lobby branch |
| T2 | Mid-game play phase, E sends `LEAVE_ROOM`, S/W/N connected | `PLAYER_DEPARTED` broadcast → `DEPARTURE_VOTE_STARTED` targeting E → `departure-vote-timeout` armed (100ms test) | AC2, AC3, AC6 |
| T3 | Departure vote open for E, S votes `dead_seat`, W votes `dead_seat` | Two `DEPARTURE_VOTE_CAST` broadcasts → `DEPARTURE_VOTE_RESOLVED { outcome: "dead_seat" }` → `PLAYER_CONVERTED_TO_DEAD_SEAT` → `deadSeatPlayerIds` contains E → `syncTurnTimer` advances past E if it was their turn | AC6, AC7, AC9 |
| T4 | Departure vote open for E, S votes `end_game`, W votes `end_game` | `DEPARTURE_VOTE_RESOLVED { outcome: "end_game" }` → `autoEndGameOnDeparture` → `GAME_ABANDONED { reason: "player-departure" }` → scoreboard phase → `releaseSeat(E)` | AC6, AC8 |
| T5 | Departure vote open for E, only S votes `dead_seat`, 100ms elapses | `departure-vote-timeout` fires → `DEPARTURE_VOTE_RESOLVED { outcome: "end_game" }` (default for no quorum) → auto-end | AC6 timeout branch |
| T6 | Departure vote open for E, S votes `dead_seat`, W changes mind from `dead_seat` to `end_game` | Both cast broadcasts fire in order; vote tally after each cast; final state: 1 dead_seat, 1 end_game → still below quorum → vote remains open | AC6 idempotent writes |
| T7 | Multi-departure: E sends `LEAVE_ROOM`, vote starts, then S sends `LEAVE_ROOM` before vote resolves | S's leave triggers `departedPlayerIds.size >= 2` → cancel active vote (`DEPARTURE_VOTE_RESOLVED { outcome: "cancelled" }`) → `autoEndGameOnDeparture` → `GAME_ABANDONED { reason: "player-departure" }` | AC5 multi-departure, AC6 cancel |
| T8 | E is dead seat (from T3); turn advances to E on next rotation | `advancePastDeadSeats` runs from post-action broadcast hook; `gs.currentTurn` jumps from E to next non-dead seat; `TURN_SKIPPED_DEAD_SEAT` broadcast; wall unchanged (E never drew); turn timer armed for the new current player | AC9 turn skip, AC9 wall skip |
| T9 | E is dead seat; W discards, call window opens, E is expected to pass/call | `advanceDeadSeatState` (or sibling) auto-issues `PASS_CALL` for E via `handleAction`; call window resolves without waiting for E | AC9 call window auto-pass |
| T10 | E is dead seat AND has exposed groups visible from earlier play | E's `PlayerPublicInfo` stays in `room.players` → opponents still see nameplate + dead-seat badge; `gs.players[E].exposed` stays populated → exposed groups remain rendered on the table | AC7 |
| T11 | Departure vote open for E, targeting E, and E's WebSocket reconnects via token | `departedPlayerIds.has(E)` short-circuits disconnect-handler (AC4 is irrelevant since they already left), and the leave path already closed the socket. Any new `JOIN_ROOM` with E's token should fail gracefully — `playerId` is still in `room.players` but `departedPlayerIds` gate in `handleJoinRoom`/`attachToExistingSeat` rejects the reconnect. **New guard needed** in `attachToExistingSeat`: if `departedPlayerIds.has(playerId)`, send `ERROR PLAYER_DEPARTED` and close with 4000. | AC4, AC14 (extended) |
| T12 | Lobby phase, host (E) sends `LEAVE_ROOM` | `releaseSeat(E)` runs. Host role reassignment is explicitly deferred to Story 4B.6 — for 4B.5, `isHost` flag is cleared on E's info pre-release, but no new host is assigned. The room may be hostless until 4B.6 ships. Document as a known gap. | AC5 lobby branch, AC20 |
| T13 | Mid-game play phase, host (E) sends `LEAVE_ROOM` with 3 other players | Departure vote starts (AC6). If vote passes to `dead_seat`, E is dead-seated but still holds the host flag. Rematch / settings are host-gated and will fail until 4B.6 host migration ships — accepted gap for 4B.5. Document in dev notes. | AC6, AC7, 4B.6 boundary |
| T14 | Simultaneous disconnect (4B.3 pause) triggers while departure vote is open | Pause-trigger branch in join-handler cancels departure vote OR pauses the lifecycle timer (implementer's AC13 choice). On resume, vote either auto-restarts or resumes (per AC13 choice). Document path in file header. | AC13 |
| T15 | Dead-seat player (E) somehow sends a `GameAction` (client bug or replay) | Blocked by `DEAD_SEAT` gate in `handleActionMessage` (4B.4 AC14 gate — unchanged). `sendActionError(..., "DEAD_SEAT", ...)`. | AC14 |
| T16 | Departed player (E) somehow sends a `GameAction` (before `releaseSeat` runs) | Blocked by new `PLAYER_DEPARTED` gate in `handleActionMessage`. `sendActionError(..., "PLAYER_DEPARTED", ...)`. | AC14 |
| T17 | `DEPARTURE_VOTE_CAST` from departed player (target tries to vote on themselves) | They have no live socket to send from — but defensive: `voterId === targetPlayerId` gate rejects with `CANNOT_VOTE_ON_DEPARTED`. | AC10 |
| T18 | `DEPARTURE_VOTE_CAST` when no vote is active | Rejected with `NO_ACTIVE_DEPARTURE_VOTE`. | AC10 |
| T19 | `DEPARTURE_VOTE_CAST` with stale `targetPlayerId` (vote is targeting a different player) | Rejected with `INVALID_DEPARTURE_VOTE_TARGET`. | AC10 |
| T20 | `LEAVE_ROOM` during scoreboard phase (game already ended) | Runs `releaseSeat(E)` immediately; no vote started; scoreboard stays visible. Broadcast `PLAYER_DEPARTED` for UI update. Idle-timeout / abandoned-timeout unchanged. | AC5 (extends lobby gate — treat scoreboard same as lobby: no vote, just release) |
| T21 | Game ends to scoreboard while a departure vote is open and a dead seat exists | `resetTurnTimerStateOnGameEnd` runs (same as post–`DECLARE_MAHJONG` scoreboard path); open departure vote is cancelled with `DEPARTURE_VOTE_RESOLVED { outcome: "cancelled" }` (AC15); `deadSeatPlayerIds` is NOT cleared until `START_GAME`. | AC15 |
| T22 | New game started after a dead-seat game ended | `handleStartGameAction` clears `departedPlayerIds`, `departureVoteState`, `deadSeatPlayerIds`, and the full 4B.4 set. Fresh slate for the new game. | AC15 |
| T23 | 3-player game (one dead seat from earlier); another **live** player sends `LEAVE_ROOM` | Dead-seat players were removed from `departedPlayerIds` at conversion (AC7), so `departedPlayerIds.size` is 1 → **new departure vote** starts for the leaver, not FR97 auto-end. FR97 multi-departure (`departedPlayerIds.size >= 2`) applies when two players are simultaneously in `departedPlayerIds` before vote resolution (see T7). | AC5, AC7, FR97 |
| T24 | `advancePastDeadSeats` safety: all 4 players marked dead-seat (unreachable in normal flow) | Bounded loop hits max depth 4 → logs error and routes to `autoEndGameOnDeparture` as safety net. | AC9 safety |

### Scope boundaries

| In scope (4B.5) | Out of scope |
| --------------- | ------------ |
| `LEAVE_ROOM` protocol message + `handleLeaveRoomMessage` | Host-migration-specific prompt copy ("Host left. Continue with [next] as new host?") — Story 4B.6 |
| `DEPARTURE_VOTE_CAST` protocol message + `handleDepartureVoteCastMessage` | `HOST_PROMOTED` resolved action and host-role transfer — Story 4B.6 |
| `room.departedPlayerIds` + `room.departureVoteState` + `"departure-vote-timeout"` lifecycle timer | AI fill-in for departed players — not in MVP per FR99 |
| `PlayerGameView.departureVoteState` field (thread into view for reconnect resume) | 5th-player "table is full" page — Story 4B.7 |
| `convertToDeadSeat(room, playerId)` — adds to `deadSeatPlayerIds`, keeps player in `room.players` | Dead-seat animations / rich visuals — Epic 7 / 5B |
| `autoEndGameOnDeparture(room, ...)` — auto-end scoreboard transition, `releaseSeat` departed players | Persisting dead-seat / departure state across server restart |
| `advancePastDeadSeats` / `advanceDeadSeatState` — proper turn-skip + wall-skip + call-window auto-pass | Re-voting a dead-seat conversion (terminal outcome) |
| Replace 4B.4 AC14 dead-seat auto-discard stub with real skip logic | Departure vote UI polish (scoreboard history, vote audit log) |
| `GAME_ABANDONED` reason extension: `"pause-timeout" | "player-departure"` | Late-join by the departed player (they cannot rejoin the same game) |
| Client: leave button + confirmation, departure vote modal, turn-skip toast | E2E Playwright tests (Vitest integration covers the multi-socket path per 4B.1 precedent) |
| Multi-departure auto-end (≥2 leaves) | Charleston-phase departure (accepted gap: covered by same vote mechanism but minimally tested; implementer adds a T25 scenario if bandwidth allows) |
| Pause-during-vote handling (AC13) | Reopening a departure vote after it resolved |
| Tests for every T1–T24 transition above | |

## Tasks / Subtasks

- [x] **Task 1: Shared types — `LEAVE_ROOM` / `DEPARTURE_VOTE_CAST` protocol, `ResolvedAction` discriminants, `PlayerGameView.departureVoteState`** (AC: 1, 10, 11, 16, 19)
  - [x] 1.1 Add `LeaveRoomMessage` and `DepartureVoteCastMessage` interfaces + types to [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts) alongside `AfkVoteCastMessage`.
  - [x] 1.2 Add the 6 new `ResolvedAction` discriminants (AC11) to [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) and extend `GAME_ABANDONED` reason union.
  - [x] 1.3 Add `departureVoteState: { targetPlayerId: string; targetPlayerName: string; expiresAt: number } | null` (required) to `PlayerGameView`. `LobbyState` untouched.
  - [x] 1.4 Export new types from `packages/shared/src/index.ts`.
  - [x] 1.5 Run `pnpm run typecheck` — fix every exhaustive `switch` on `ResolvedAction.type` (`mapPlayerGameViewToGameTable.ts`, `useRoomConnection.ts` resolved-action router, test helpers, `PlayerGameViewBridgeShowcase.vue`, and any dev routes).

- [x] **Task 2: Server — `Room` fields + `createRoom` init + lifecycle timer variant** (AC: 3, 12, 15)
  - [x] 2.1 Extend `Room` interface in [`packages/server/src/rooms/room.ts`](../../packages/server/src/rooms/room.ts) with `departedPlayerIds: Set<string>` and `departureVoteState: DepartureVoteState | null` (import `DepartureVoteState` from `leave-handler.ts` or re-declare locally if circular-import is a concern).
  - [x] 2.2 Initialize both fields in `createRoom` in [`room-manager.ts`](../../packages/server/src/rooms/room-manager.ts) alongside the 4B.4 fields: `departedPlayerIds: new Set()`, `departureVoteState: null`.
  - [x] 2.3 Add `"departure-vote-timeout"` to `LifecycleTimerType` union in [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts), plus `DEFAULT_DEPARTURE_VOTE_TIMEOUT_MS = 30_000`, `departureVoteTimeoutMs` variable, `setDepartureVoteTimeoutMs(ms)` setter, and a new case in `getTimeoutForType`. Follow the `"afk-vote-timeout"` precedent exactly.

- [x] **Task 3: Server — new `leave-handler.ts` module** (AC: 1, 2, 3, 5, 6, 7, 8, 10)
  - [x] 3.1 Create [`packages/server/src/websocket/leave-handler.ts`](../../packages/server/src/websocket/leave-handler.ts). Top-of-file header comment per AC20 (document vote-type divergences and mid-pause handling choice).
  - [x] 3.2 Export:
    - `DepartureVoteState` interface (server-only).
    - `handleLeaveRoomMessage(ws, session, room, logger, roomManager): void` — AC2 lifecycle.
    - `markPlayerDeparted(room, playerId, logger, roomManager): void` — AC3.
    - `startDepartureVote(room, targetPlayerId, targetPlayerName, logger, roomManager): void` — AC6 start path.
    - `handleDepartureVoteCastMessage(ws, session, room, parsed, logger, roomManager): void` — AC10.
    - `resolveDepartureVote(room, logger, roomManager, trigger: "vote" | "timeout"): void` — AC6 resolve.
    - `handleDepartureVoteTimeoutExpiry(room, logger, roomManager): void` — lifecycle-timer callback.
    - `convertToDeadSeat(room, playerId, logger): void` — AC7.
    - `autoEndGameOnDeparture(room, logger, roomManager): void` — AC8.
    - `cancelDepartureVote(room, logger, reason: "multi_departure" | "pause" | "game_ended"): void` — cancellation helper.
    - `resumeDepartureVoteIfNeeded(room, logger, roomManager): void` — AC13 resume hook (may be a no-op depending on AC13 choice).
  - [x] 3.3 Implement validation helpers: `sendProtocolError` (reuse the `turn-timer.ts` pattern or extract to a shared util), error codes `NO_ACTIVE_DEPARTURE_VOTE`, `INVALID_DEPARTURE_VOTE_TARGET`, `CANNOT_VOTE_ON_DEPARTED`, `PLAYER_DEPARTED`.

- [x] **Task 4: Server — dead-seat turn-skip + call-window auto-pass** (AC: 9, 19)
  - [x] 4.1 Add `advancePastDeadSeats(room, logger): boolean` (and optionally `autoPassCallWindowForDeadSeats(room, logger)`, or merged into `advanceDeadSeatState(room, logger)`) in [`turn-timer.ts`](../../packages/server/src/websocket/turn-timer.ts) — or in a new `dead-seat.ts` module if cleaner. The helper walks `gs.currentTurn` forward using the `SEATS` array (`packages/shared/src/constants.ts`) while `deadSeatPlayerIds.has(currentTurn)`, bounded to 4 iterations. Broadcasts `TURN_SKIPPED_DEAD_SEAT` per skip. Sets `gs.turnPhase = "draw"` after skipping.
  - [x] 4.2 Integrate with `syncTurnTimer`: remove the AC14 dead-seat auto-discard stub entirely; replace with a call to `advancePastDeadSeats` (before the `shouldArmPlayPhaseTimer` check). If any skip happened, recursively re-enter `syncTurnTimer` so the post-skip state gets the timer armed. Bound the recursion at 4 as a safety net.
  - [x] 4.3 Integrate with the action-handler post-broadcast path in [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) `handleActionMessage`: after `broadcastGameState` and before `syncTurnTimer`, call the call-window auto-pass helper (if separate) so dead-seat players auto-pass on freshly-opened call windows.
  - [x] 4.4 Remove the `TODO(4B.5)` comment in `syncTurnTimer`.
  - [x] 4.5 **Update 4B.4 tests** that previously asserted the auto-discard stub behavior to assert the new turn-skip behavior (specifically T19 in `turn-timer.test.ts`).

- [x] **Task 5: Server — action-handler `PLAYER_DEPARTED` gate + join-handler departed short-circuit** (AC: 4, 14)
  - [x] 5.1 In [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) `handleActionMessage`, after the 4B.4 `DEAD_SEAT` gate, add the `PLAYER_DEPARTED` gate:
    ```
    if (room.departedPlayerIds.has(playerId)) {
      sendActionError(ws, logger, "PLAYER_DEPARTED", "Departed players cannot take actions");
      return;
    }
    ```
  - [x] 5.2 In [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` `ws.on("close", …)`, after the existing `session.ws !== ws` guard and before the turn-timer cancel, add:
    ```
    if (room.departedPlayerIds.has(playerId)) {
      return;
    }
    ```
  - [x] 5.3 In `attachToExistingSeat` (join-handler.ts), add an early-return guard: if `room.departedPlayerIds.has(playerId)`, send `PLAYER_DEPARTED` error and close with 4000. Prevents a departed player from reconnecting via stale token (T11).

- [x] **Task 6: Server — `LEAVE_ROOM` + `DEPARTURE_VOTE_CAST` dispatch in ws-server** (AC: 1, 10)
  - [x] 6.1 Import `handleLeaveRoomMessage` and `handleDepartureVoteCastMessage` from `./leave-handler` in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts).
  - [x] 6.2 Add dispatch branches for `parsed.type === "LEAVE_ROOM"` and `parsed.type === "DEPARTURE_VOTE_CAST"` alongside the existing `AFK_VOTE_CAST` branch. Both require `session` via `roomManager.findSessionByWs(ws)` and resolve to the room's session via `room.sessions.get(session.playerId)`. Send `NOT_IN_ROOM` error if no session.

- [x] **Task 7: Server — `buildPlayerView` emits `departureVoteState`** (AC: 16)
  - [x] 7.1 In [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) `buildPlayerView`, thread `departureVoteState: room.departureVoteState ? { targetPlayerId, targetPlayerName, expiresAt: ??? } : null`. The `expiresAt` must be stored on the `DepartureVoteState` interface when the vote starts so `buildPlayerView` can return it verbatim — add `expiresAt: number` as a field on `DepartureVoteState` (mutated at start time). `buildLobbyState` unchanged.

- [x] **Task 8: Server — pause integration (4B.3)** (AC: 13)
  - [x] 8.1 In [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` Branch B pause trigger, after the `cancelAfkVote` block, add the departure-vote cancel-or-pause handling per the AC13 approach chosen. Simpler pause-then-resume path recommended: do nothing on pause (the lifecycle timer continues ticking — accept that the 30s timer runs concurrent with the pause and may fire during pause, in which case `handleDepartureVoteTimeoutExpiry` must check `room.paused` and defer if paused). **Or** cancel on pause and rely on `resumeDepartureVoteIfNeeded` from `attachToExistingSeat`. Document the chosen path.
  - [x] 8.2 In `attachToExistingSeat` after the `GAME_RESUMED` broadcast (if path is "cancel-then-resume"), call `resumeDepartureVoteIfNeeded(room, logger, roomManager)`.

- [x] **Task 9: Server — game-end + game-start state cleanup** (AC: 15)
  - [x] 9.1 In `handleStartGameAction` (action-handler.ts), alongside the 4B.4 clears, add `room.departedPlayerIds.clear()` and `room.departureVoteState = null` (also cancel `"departure-vote-timeout"` lifecycle timer defensively).
  - [x] 9.2 In `resetTurnTimerStateOnGameEnd` (turn-timer.ts), extend to also cancel `"departure-vote-timeout"` and null out `departureVoteState`. Update JSDoc to document both vote types.
  - [x] 9.3 Verify `autoEndGameOnDeparture` (Task 3) arms scoreboard idle-timeout correctly, matching the `handlePauseTimeout` precedent.

- [x] **Task 10: Server — tests** (AC: 18, 19)
  - [x] 10.1 [`leave-handler.test.ts`](../../packages/server/src/websocket/leave-handler.test.ts): integration coverage for **T1–T7, T11–T14, T14b, T12, T13, T17–T21, T23** (multi-socket + `setDepartureVoteTimeoutMs(100)` / restore in `afterEach`). **Not individually named in-file:** T15 (covered by existing `DEAD_SEAT` gate tests), T24 (see 10.2), T25 optional Charleston bandwidth.
  - [x] 10.2 [`turn-timer.test.ts`](../../packages/server/src/websocket/turn-timer.test.ts): Story 4B.5 block for **T8, T9, T24**; legacy **T19** label retained for dead-seat turn-skip (4B.4 stub replacement). [`charleston-auto-action.test.ts`](../../packages/server/src/websocket/charleston-auto-action.test.ts): dead-seat Charleston drain.
  - [x] 10.3 [`action-handler.test.ts`](../../packages/server/src/websocket/action-handler.test.ts): **T16** `PLAYER_DEPARTED` gate; **T22** `START_GAME` clears departure/dead-seat/vote state.
  - [x] 10.4 [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts): **T11** `departedPlayerIds` disconnect short-circuit + `PLAYER_DEPARTED` on token rejoin (where covered).
  - [x] 10.5 [`turn-timer.test.ts`](../../packages/server/src/websocket/turn-timer.test.ts): **T19** dead-seat turn-skip (replaces 4B.4 auto-discard stub assertion).
  - [x] 10.6 **T14** pause cancels departure vote in `leave-handler.test.ts`; **T14b** resume restarts vote (`resumeDepartureVoteIfNeeded`). `countDisconnectedPlayers` excludes `departedPlayerIds` so `GAME_RESUMED` can fire with a pending departed player.
  - [x] 10.7 [`state-broadcaster.test.ts`](../../packages/server/src/websocket/state-broadcaster.test.ts): **T10** dead-seat visibility in `buildPlayerView`.
  - [x] 10.8 `afterEach` in departure test blocks: restore `setDepartureVoteTimeoutMs(DEFAULT_DEPARTURE_VOTE_TIMEOUT_MS)`.

- [x] **Task 11: Client — `useRoomConnection` extensions** (AC: 17)
  - [x] 11.1 In [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts), add `sendLeaveRoom(): void` that sends `{ version: 1, type: "LEAVE_ROOM" }` via `sendRaw` then closes the socket client-side (to prevent auto-reconnect).
  - [x] 11.2 Add `sendDepartureVote(targetPlayerId: string, choice: "dead_seat" | "end_game"): void` mirroring `sendAfkVote`.
  - [x] 11.3 Route the new `PLAYER_DEPARTED` / `DEPARTURE_VOTE_STARTED` / `DEPARTURE_VOTE_CAST` / `DEPARTURE_VOTE_RESOLVED` / `PLAYER_CONVERTED_TO_DEAD_SEAT` / `TURN_SKIPPED_DEAD_SEAT` resolvedAction discriminants through the existing `resolvedAction` shallowRef. Add them to any exhaustive `switch` in this file.
  - [x] 11.4 Track departure vote state locally: `departureVoteOpen: ref<{ targetPlayerId; targetPlayerName; expiresAt } | null>(null)` populated from either (a) incoming `DEPARTURE_VOTE_STARTED` resolvedAction, or (b) `playerGameView.departureVoteState` on initial STATE_UPDATE (for mid-vote reconnecters per AC16). Clear on `DEPARTURE_VOTE_RESOLVED`.
  - [x] 11.5 Update the `GAME_ABANDONED` toast/message handling to include the new `reason: "player-departure"` variant with appropriate copy.

- [x] **Task 12: Client — `mapPlayerGameViewToGameTable` thread `departureVoteState`** (AC: 16, 17)
  - [x] 12.1 In [`mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts), thread `departureVoteState: view.departureVoteState ?? null` onto the mapped `GameTableProps`. Update `mapPlayerGameViewToGameTable.test.ts` expected output.

- [x] **Task 13: Client — leave button + confirmation dialog + DepartureVoteModal** (AC: 17)
  - [x] 13.1 Add a "Leave game" button to the existing game menu in `GameTable.vue` (or the parent view if there's no menu). On click, open a confirmation dialog. On confirm, call `useRoomConnection().sendLeaveRoom()`. `data-testid="leave-game-button"`, `data-testid="leave-game-confirm-dialog"`.
  - [x] 13.2 New component [`packages/client/src/components/game/DepartureVoteModal.vue`](../../packages/client/src/components/game/DepartureVoteModal.vue). Props: `open: boolean`, `targetPlayerName: string`, `expiresAt: number | null`. Emits: `vote: "dead_seat" | "end_game"`. Two buttons + countdown. `data-testid` attributes per AC17.
  - [x] 13.3 Mount `DepartureVoteModal` in `GameTable.vue` wired to the `departureVoteOpen` state from `useRoomConnection`. Emit handler calls `sendDepartureVote(targetPlayerId, choice)`.
  - [x] 13.4 Add the `TURN_SKIPPED_DEAD_SEAT` toast binding to the resolved-action → toast pipeline.

- [x] **Task 14: Client — tests** (AC: 17, 19)
  - [x] 14.1 New `DepartureVoteModal.test.ts`: renders correctly; clicking buttons emits the right event; countdown updates.
  - [x] 14.2 Extend `GameTable.test.ts` for the leave button + confirmation flow.
  - [x] 14.3 Extend `mapPlayerGameViewToGameTable.test.ts` with the new `departureVoteState` field in expected output.
  - [x] 14.4 New or extended `useRoomConnection.departure.test.ts`: feed synthetic `STATE_UPDATE` with `departureVoteState` populated → assert modal opens. Feed `DEPARTURE_VOTE_STARTED` resolvedAction → assert modal opens. Feed `DEPARTURE_VOTE_RESOLVED` → assert modal closes. Assert `sendDepartureVote` and `sendLeaveRoom` produce the expected outbound JSON frames.
  - [x] 14.5 Extend `PlayerGameViewBridgeShowcase.vue` fixture with the new `departureVoteState: null` default to keep the dev showcase green.

- [x] **Task 15: Regression gate + finalize** (AC: 19, 20)
  - [x] 15.1 `pnpm test` (all packages) — green. Explicit focus: 4B.4 `turn-timer.test.ts` T19 updated, `action-handler.test.ts` both DEAD_SEAT and PLAYER_DEPARTED gates green, `grace-expiry-fallbacks.test.ts` still green (non-departed disconnects unchanged).
  - [x] 15.2 `pnpm run typecheck` — green. Watch for `ResolvedAction` / `GAME_ABANDONED` exhaustiveness breakage across client composables, dev routes, and test helpers.
  - [x] 15.3 `vp lint` — green.
  - [x] 15.4 Update the File List below with every touched file.
  - [x] 15.5 Update `sprint-status.yaml`: `4b-5-player-departure-dead-seat` → **done** after code review follow-up (2026-04-05).

## Dev Notes

### Epic & requirements traceability

- [`epics.md`](../planning-artifacts/epics.md#L2760) — Story **4B.5** (FR94, FR95, FR96, FR97, FR99). FR98 (host migration) is explicitly Story 4B.6 and out of scope.
- [`gdd.md`](../planning-artifacts/gdd.md#L459) — "Player Departure Mid-Game" section. Key phrases: "dead seat behavior", "locked hand", "auto-pass all turns", "no one can claim their discards", "exposed tiles remain visible", "wall tiles that would be their draw are skipped", "slight balance shift is preferable", "no AI fill-in for MVP", "multi-departure threshold: if 2 or more players leave, the game auto-ends immediately".
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — Decision 7 (Reconnection Strategy) contrasts grace/reconnect (disconnect) with intentional leave (this story). Server-authoritative timer precedent (call-window timer, pause-timeout, turn timer) extends to `"departure-vote-timeout"`.
- Builds on 4B.1 reconnection backbone, 4B.2 grace-expiry helpers, 4B.3 pause + lifecycle timer framework, 4B.4 dead-seat flag + AFK vote precedent. 4B.5 replaces the 4B.4 AC14 stub.

### Infrastructure already in place (do not re-build)

| Capability | Location | Notes |
|---|---|---|
| `room.deadSeatPlayerIds: Set<string>` + dead-seat badge + action-handler `DEAD_SEAT` gate | [`room.ts`](../../packages/server/src/rooms/room.ts), [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts), [`OpponentArea.vue`](../../packages/client/src/components/game/OpponentArea.vue) | Story 4B.4. 4B.5 **populates** this set via `convertToDeadSeat` and **consumes** it via `advancePastDeadSeats`. |
| `releaseSeat(room, playerId)` | [`pause-handlers.ts`](../../packages/server/src/websocket/pause-handlers.ts) | 4B.3 helper. Drops player from all room maps. 4B.5 reuses for `autoEndGameOnDeparture` cleanup. |
| Lifecycle timer framework + `getTimeoutForType` | [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) | 4B.5 adds one variant `"departure-vote-timeout"`. Mirrors 4B.4's `"afk-vote-timeout"` pattern. |
| `resetTurnTimerStateOnGameEnd` | [`turn-timer.ts`](../../packages/server/src/websocket/turn-timer.ts) | 4B.4 helper. 4B.5 extends to also clear `departureVoteState` and its lifecycle timer. |
| `GAME_ABANDONED` resolved action + scoreboard auto-end flow | [`pause-handlers.ts`](../../packages/server/src/websocket/pause-handlers.ts) `handlePauseTimeout` | 4B.5 reuses the pattern: mutate `gamePhase`, null `gameResult`, arm idle/abandoned timeout, broadcast `GAME_ABANDONED`. New reason `"player-departure"`. |
| AFK vote state machine precedent | [`turn-timer.ts`](../../packages/server/src/websocket/turn-timer.ts) `startAfkVote` / `resolveAfkVote` / `cancelAfkVote` / `handleAfkVoteCastMessage` | Story 4B.4. 4B.5 mirrors this almost exactly for the departure vote, with key differences: (1) binary outcome vs. AFK's pass/fail/cancel; (2) target player is GONE (no voluntary-action cancel path); (3) outcome `"end_game"` auto-ends the whole game; (4) vote state IS threaded into `PlayerGameView` for reconnect resume. |
| `PASS_CALL` auto-action via `handleAction` | [`grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) | 4B.5 reuses the pattern for dead-seat call-window auto-pass. |
| `advanceTurn(state)` + `SEATS` counterclockwise order | [`draw.ts`](../../packages/shared/src/engine/actions/draw.ts), [`constants.ts`](../../packages/shared/src/constants.ts) | 4B.5 duplicates the math in server-side `advancePastDeadSeats` because engine stays pure (dead-seat set is server-owned). |
| Grace-expiry auto-discard / auto-pass | [`grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) | Unchanged. 4B.5 adds the `departedPlayerIds` short-circuit **before** grace-expiry runs (AC4), so departures never fall into the grace path. |

**Bottom line:** 4B.5 adds: 1 new protocol module (`leave-handler.ts`), 2 new protocol messages (`LEAVE_ROOM`, `DEPARTURE_VOTE_CAST`), 6 new `ResolvedAction` discriminants + 1 field extension, 1 new lifecycle timer variant, 2 new `Room` fields (`departedPlayerIds`, `departureVoteState`), 1 new `PlayerGameView` field (`departureVoteState`), and one new server helper family (`advancePastDeadSeats` / `advanceDeadSeatState`). It **removes** the 4B.4 AC14 auto-discard stub entirely. The engine is not touched — all new state and all dead-seat skip logic live on `Room` / in `leave-handler.ts` / in `turn-timer.ts`.

### Architecture compliance

| Topic | Rule |
|---|---|
| **Engine purity** | `GameState` is not modified for dead-seat handling. Turn skip is server-side (`advancePastDeadSeats` mutates `gs.currentTurn` using SEATS math imported from shared, same as `advanceTurn`). Call-window auto-pass goes through the existing `handleAction` with a synthetic `PASS_CALL` — engine is unaware of dead-seat concept. |
| **Full-state model** | Every departure-vote / turn-skip / dead-seat broadcast ships a complete filtered `PlayerGameView`. The `departureVoteState` field flows naturally through the existing `shallowRef<PlayerGameView>` pipeline; no new client-side delta/replay state. |
| **Server authority** | Client never starts, cancels, or resolves a departure vote. Client never self-marks as departed or dead-seat. Client sends `LEAVE_ROOM` and `DEPARTURE_VOTE_CAST`; server decides everything else. |
| **Validate-then-mutate** | Every new handler validates preconditions before mutating. `markPlayerDeparted` validates the player exists and isn't already departed before mutating `departedPlayerIds`. `resolveDepartureVote` tallies and gates before mutating. |
| **Single source of post-state sequencing** | `sendPostStateSequence` (4B.1) stays the owner for `STATE_UPDATE → CHAT_HISTORY` ordering on per-socket sends. Departure broadcasts fan out via `broadcastStateToRoom` / `broadcastGameState` and do NOT route through `sendPostStateSequence`. |
| **Consolidated broadcast fan-out** | All new broadcasts go through `broadcastStateToRoom` / `broadcastGameState` (4B.2 consolidation). No raw `ws.send` loops. |
| **Imports** | Tests: `vite-plus/test`; app: `vite-plus`. No `vitest` / `vite` direct imports. |
| **Composition API + `<script setup lang="ts">`** | New `DepartureVoteModal.vue` stays in Composition API. |
| **No import aliases** | Relative imports or `@mahjong-game/shared` only. |

### Anti-patterns (do not ship)

- **Treating disconnect as departure.** A socket close without a `LEAVE_ROOM` message is still a disconnect — grace period, reconnect, grace-expiry. Only an explicit `LEAVE_ROOM` message triggers the departure flow. Do not unify the two code paths.
- **Auto-discarding on behalf of a dead-seat player.** 4B.4 shipped this as the AC14 stub so 4B.4 was standalone-shippable. 4B.5 **removes** the stub. Dead-seat players do not draw and do not discard. They are skipped entirely — the tile that would have been theirs goes to the next player.
- **Calling `releaseSeat` when converting to dead seat.** The dead-seat player stays in `room.players` so their public info, nameplate, and exposed groups remain visible. Only `autoEndGameOnDeparture` calls `releaseSeat` (because the game is over and cleanup is final).
- **Engine-level dead-seat logic.** The engine doesn't know about dead seats. Do not extend `advanceTurn` to take a skip set or add a `DEAD_SEAT_SKIP` action. Keep the skip logic server-side in `leave-handler.ts` / `turn-timer.ts`.
- **Restarting departure vote on failed outcome.** Unlike AFK vote cooldown, departure outcomes are terminal. Once resolved, a player is either dead-seat for the rest of the game or the game is over.
- **Allowing a departed player to reconnect and rejoin the same game.** `attachToExistingSeat` must gate on `departedPlayerIds.has(playerId)` (Task 5.3). The departed flag is sticky until `START_GAME` clears it.
- **Clearing `departedPlayerIds` or `deadSeatPlayerIds` on scoreboard transition.** Both persist through scoreboard so the UI can render post-game state correctly. Only `START_GAME` clears them.
- **Starting a departure vote during the lobby.** Lobby leaves run `releaseSeat` directly. Dead-seat semantics only apply mid-game.
- **Letting the departure vote's 30s timer run during a 4B.3 pause.** Pick one: cancel the lifecycle timer on pause and restart on resume, OR have `handleDepartureVoteTimeoutExpiry` check `room.paused` and defer. Document the choice in `leave-handler.ts`.
- **Using the AFK vote cooldown set for departure.** Different mechanism. `afkVoteCooldownPlayerIds` is AFK-specific (can still play after a failed AFK vote). Departure has no cooldown — outcomes are terminal.
- **Broadcasting `PLAYER_DEPARTED` as a `broadcastGameState` resolution.** It's a room-level event, not an engine resolution. Use `broadcastStateToRoom` so it doesn't interleave with engine state broadcasts incorrectly.
- **Forgetting to update exhaustive switches.** `GAME_ABANDONED` reason extension + 6 new `ResolvedAction` discriminants = real typecheck breakage across `mapPlayerGameViewToGameTable.ts`, `useRoomConnection.ts`, test helpers, dev showcase. Run `pnpm run typecheck` early and often.
- **Handling host departure with a custom "new host" flow in 4B.5.** Host migration is Story 4B.6. For 4B.5, host departure uses the same generic departure vote; if it passes `dead_seat`, the host flag stays on the departed player and rematch/settings become unavailable until 4B.6. Document as an accepted gap.
- **Adding AI fill-in for departed players.** Explicitly not in MVP per FR99. Dead seat is the only option.
- **Dead-seat players participating in departure votes.** They are excluded from `livingVoterCount` in AC6.

### Implementation edge cases

- **Race: `LEAVE_ROOM` message arrives and the socket closes before the handler runs.** The `ws.on("close", …)` fires concurrently. Because `markPlayerDeparted` sets `departedPlayerIds.add(playerId)` **before** closing the socket (AC2 step d/e), the disconnect handler's `departedPlayerIds.has(playerId)` short-circuit (AC4) catches the close and does nothing. Order matters.
- **Race: second player sends `LEAVE_ROOM` while first player's vote is resolving.** Node's event loop is single-threaded. Either: (a) second leave runs after the vote resolves — the first player is already converted to dead seat (or game already ended), second leave runs through the multi-departure gate normally; (b) second leave runs during the 100ms-test window before the first vote resolves — `departedPlayerIds.size` goes to 2, `markPlayerDeparted` fires the multi-departure gate, which cancels the active vote and auto-ends. Both paths converge on end-game.
- **Degenerate vote: 2 remaining voters (e.g. one player disconnected after departure triggered vote).** `livingVoterCount` drops to 2, majority becomes 1, a single vote decides. Tie (1 each) waits for timeout. Document in AC6.
- **Departure vote open, target player reconnects.** They cannot — `attachToExistingSeat` gates on `departedPlayerIds.has(playerId)` (Task 5.3). Even if they try with their old token, they're bounced with `PLAYER_DEPARTED` error.
- **Departure vote open, non-target player reconnects mid-vote.** They see the open vote via `playerGameView.departureVoteState` on initial `STATE_UPDATE` (AC16). Their modal opens. They can cast a vote. This is the primary rationale for threading vote state into the view vs. the AFK vote's "accepted gap" (4B.4 edge cases).
- **Charleston-phase departure.** The same vote mechanism fires. Dead-seat turn-skip in Charleston phase is a question: Charleston has its own phase transitions and the server already auto-passes disconnected players via `applyCharlestonAutoAction`. Extend that helper to also run for `deadSeatPlayerIds` members (parallel to the existing `!connected` check). **Scope check:** this is a minimal extension; include it in Task 4 or call out as a known gap if bandwidth is tight. Recommend inclusion for correctness.
- **Mahjong declaration mid-departure-vote.** If a player declares Mahjong while a departure vote is open, the Mahjong goes through normally (engine accepts it), `resetTurnTimerStateOnGameEnd` fires from the action-handler scoreboard-transition path (4B.4 pattern), which will (per AC15) cancel the `"departure-vote-timeout"` and null `departureVoteState`. Broadcast a final `DEPARTURE_VOTE_RESOLVED { outcome: "cancelled" }` before clearing so clients close the modal cleanly. Add a `cancelDepartureVote(room, logger, "game_ended")` helper call inside `resetTurnTimerStateOnGameEnd`.
- **All 4 players dead-seat (shouldn't be reachable).** AC5 multi-departure gate catches ≥2 departures and auto-ends, so the set can grow to at most 1 via a passed vote per game. But defense-in-depth: `advancePastDeadSeats` has a max-depth 4 loop that routes to `autoEndGameOnDeparture` as a safety net (T24).
- **Idempotent `LEAVE_ROOM`.** Re-sending `LEAVE_ROOM` after the player is already in `departedPlayerIds` is a no-op (AC2b). Do not crash or start a second vote.
- **Reconnect after departure vote resolved to `dead_seat` but before `convertToDeadSeat` runs.** Node event loop makes this impossible — `resolveDepartureVote` runs both steps synchronously.
- **Departure vote for a player who is simultaneously the AFK vote target.** `markPlayerDeparted` calls `cancelAfkVote(room, logger, "target_active")` early. The AFK vote is killed; the departure vote takes over.
- **Dead-seat player is the `state.callWindow.discarderId`.** They can't discard (they're dead-seat and can't take actions) but the call-window resolution logic treats the discarder as "not waiting on" — the call window resolves normally as other players pass or call. No special handling needed. Verify in test.

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Shared types | [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) (6 new `ResolvedAction` discriminants + `GAME_ABANDONED` reason extension), [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts) (`LeaveRoomMessage`, `DepartureVoteCastMessage`, `PlayerGameView.departureVoteState`), [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts) (exports) |
| Server — core | new [`packages/server/src/websocket/leave-handler.ts`](../../packages/server/src/websocket/leave-handler.ts), [`packages/server/src/rooms/room.ts`](../../packages/server/src/rooms/room.ts) (new fields), [`packages/server/src/rooms/room-manager.ts`](../../packages/server/src/rooms/room-manager.ts) (`createRoom` init), [`packages/server/src/rooms/room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) (`"departure-vote-timeout"` variant + setter), [`packages/server/src/websocket/turn-timer.ts`](../../packages/server/src/websocket/turn-timer.ts) (new `advancePastDeadSeats` / `advanceDeadSeatState`, remove AC14 stub, extend `resetTurnTimerStateOnGameEnd`), [`packages/server/src/websocket/action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) (new `PLAYER_DEPARTED` gate + post-broadcast dead-seat auto-advance hook + `handleStartGameAction` clears), [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) (disconnect-handler short-circuit + `attachToExistingSeat` guard + pause-trigger departure-vote integration), [`packages/server/src/websocket/ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) (`LEAVE_ROOM` + `DEPARTURE_VOTE_CAST` dispatch), [`packages/server/src/websocket/state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) (`buildPlayerView` emits `departureVoteState`), [`packages/server/src/websocket/pause-handlers.ts`](../../packages/server/src/websocket/pause-handlers.ts) (optional — document departure-vote cancellation if AC13 chosen path is cancel-on-pause), optional new [`packages/server/src/websocket/dead-seat.ts`](../../packages/server/src/websocket/dead-seat.ts) if splitting helpers out |
| Server — tests | new [`packages/server/src/websocket/leave-handler.test.ts`](../../packages/server/src/websocket/leave-handler.test.ts), extended [`turn-timer.test.ts`](../../packages/server/src/websocket/turn-timer.test.ts) (T8, T9, T19 update, T24), extended [`action-handler.test.ts`](../../packages/server/src/websocket/action-handler.test.ts) (T16), extended [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts) (T11), extended [`pause-handlers.test.ts`](../../packages/server/src/websocket/pause-handlers.test.ts) (T14), extended [`grace-expiry-fallbacks.test.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.test.ts) (regression) |
| Client — state | [`packages/client/src/composables/useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) (`sendLeaveRoom`, `sendDepartureVote`, new resolved-action arms, `departureVoteOpen` ref, `GAME_ABANDONED` reason copy), [`packages/client/src/composables/mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) (thread `departureVoteState`) |
| Client — components | [`packages/client/src/components/game/GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) (leave button + confirmation + modal mount), new [`packages/client/src/components/game/DepartureVoteModal.vue`](../../packages/client/src/components/game/DepartureVoteModal.vue), [`packages/client/src/components/dev/PlayerGameViewBridgeShowcase.vue`](../../packages/client/src/components/dev/PlayerGameViewBridgeShowcase.vue) (fixture `departureVoteState: null`) |
| Client — tests | new `DepartureVoteModal.test.ts`, extended `GameTable.test.ts` (leave button), extended `mapPlayerGameViewToGameTable.test.ts`, new or extended `useRoomConnection.departure.test.ts`, extended `gameActionFromPlayerView.test.ts` (fixture update) |

### Cross-session intelligence (claude-mem)

Recent memory observations (2026-04-05) confirm:

- **Epic 4B.4 (obs 788–821, S306–S307)** just shipped the dead-seat flag, AFK vote state machine, `"afk-vote-timeout"` lifecycle variant, `PlayerGameView.deadSeatPlayerIds`, and the AC14 auto-discard stub with an explicit `TODO(4B.5)` marker. 4B.5 **replaces** that stub — it is the load-bearing reason the stub exists. Study `turn-timer.ts` for the module structure precedent.
- **Epic 4B.3 (S299–S304)** established the simultaneous-disconnect pause flow with `handlePauseTimeout` → scoreboard + `resetTurnTimerStateOnGameEnd` + idle-timeout arm. 4B.5's `autoEndGameOnDeparture` mirrors this pattern exactly. Copy the structure.
- **Epic 4B.2 (obs 794+ from earlier)** consolidated broadcast fan-out into `state-broadcaster.ts` with per-session try/catch (retro `4b1-review-1/2`). Every new 4B.5 broadcast must go through `broadcastStateToRoom` / `broadcastGameState`. No raw `ws.send` loops.
- **Epic 4B.4 code review (obs 830–836, S307)** surfaced five issues related to disconnect/reconnect races with the turn timer. The analogous 4B.5 concern is: departed players must short-circuit the disconnect handler (AC4) and `attachToExistingSeat` (Task 5.3) to prevent zombie state. Write regression tests for both paths.
- **Epic 6A retro follow-through `6a-retro-1`** (transition scenarios in story specs) is why this story enumerates T1–T24. Every row must have at least one test before code review signs off (pass 1 review walks the table).
- **Epic 6A retro follow-through `6a-retro-2`** (send-post-state sequence helper) applies: departure broadcasts use the consolidated fan-out, not `sendPostStateSequence`.
- **Epic 3B Story 3B.5 (Charleston disconnect handling)** established the pattern for Charleston-phase auto-actions for offline players. Logic lives in [`charleston-auto-action.ts`](../../packages/server/src/websocket/charleston-auto-action.ts) (extracted from `join-handler.ts`); `convertToDeadSeat` calls `drainCharlestonForDeadSeats` for dead-seat Charleston progression.

### Git intelligence (recent commits)

```
c5a5ade feat: add turn timeout and AFK escalation for multiplayer Mahjong            (4B.4)
df5f720 feat: add simultaneous-disconnect game pause for multiplayer Mahjong         (4B.3)
93f9244 feat: implement phase-specific reconnection fallbacks for multiplayer Mahjong (4B.2)
9410832 feat: implement reconnection with full state restore for multiplayer resilience (4B.1)
```

Study `c5a5ade` (4B.4) as the closest prior art: the `turn-timer.ts` module layout, AFK vote state machine, lifecycle timer variant, `PlayerGameView` field threading, exhaustive `ResolvedAction` switch discipline, and `AfkVoteModal.vue` component are all directly parallel to what 4B.5 needs. Mirror file-for-file.

### Latest tech / versions

No new dependencies. Existing `setTimeout` / `clearTimeout` via `room-lifecycle.ts`. Existing `ws` library. Vue 3 SFC for `DepartureVoteModal.vue`. Keep the surface minimal.

### Project context reference

[`project-context.md`](../project-context.md) — Multiplayer resilience section applies. The timers now in play after 4B.5:

1. **Grace period (30s per-player)** — disconnect tolerance. 4B.1.
2. **Pause timeout (2 min room-level)** — simultaneous disconnect auto-end. 4B.3.
3. **Turn timer (20s per-turn, `initial` → `extended` → auto-discard → AFK vote)** — AFK escalation. 4B.4.
4. **AFK vote timeout (30s room-level)** — AFK escalation resolve. 4B.4.
5. **Departure vote timeout (30s room-level)** — departure resolve. **4B.5 (this story).**

All five are server-authoritative. Clients read expiry timestamps from broadcasts (and now from `PlayerGameView.departureVoteState` for the fifth) for display only.

### Project Structure Notes

- Alignment: `leave-handler.ts` lives alongside `join-handler.ts`, `action-handler.ts`, `turn-timer.ts`, `pause-handlers.ts` in `packages/server/src/websocket/`. `DepartureVoteModal.vue` lives alongside `AfkVoteModal.vue` in `packages/client/src/components/game/`. No new subdirectories.
- Naming: `leave-handler` (not `departure-handler`) to match the protocol verb (`LEAVE_ROOM`). Helpers inside use "departure" terminology to match the epic language (`markPlayerDeparted`, `startDepartureVote`, `autoEndGameOnDeparture`).
- No variance from the unified project structure.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L2760`] — Story 4B.5 acceptance criteria
- [Source: `_bmad-output/planning-artifacts/gdd.md#L459`] — Player Departure Mid-Game design
- [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-26.md#L170-175`] — FR94–FR99 definitions
- [Source: `_bmad-output/implementation-artifacts/4b-4-turn-timeout-afk-escalation.md`] — Prior story: AFK vote + dead-seat flag + AC14 stub
- [Source: `_bmad-output/implementation-artifacts/4b-3-simultaneous-disconnection-game-pause.md`] — Prior story: pause infrastructure and auto-end pattern
- [Source: `packages/server/src/websocket/turn-timer.ts`] — AFK vote state machine precedent, AC14 stub to replace
- [Source: `packages/server/src/websocket/pause-handlers.ts`] — `handlePauseTimeout` auto-end pattern, `releaseSeat` helper
- [Source: `packages/shared/src/engine/actions/draw.ts`] — `advanceTurn` + SEATS math to mirror in `advancePastDeadSeats`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### File List

**Code review follow-up (2026-04-05):**
- `packages/server/src/websocket/charleston-auto-action.ts` — extracted Charleston auto-advance; `drainCharlestonForDeadSeats` for dead-seat Charleston
- `packages/server/src/websocket/charleston-auto-action.test.ts` — unit tests for dead-seat Charleston drain
- `packages/server/src/websocket/join-handler.ts` — delegate to `charleston-auto-action`; `countDisconnectedPlayers` excludes `departedPlayerIds` (pause resume with pending departure)
- `packages/server/src/websocket/leave-handler.ts` — `drainCharlestonForDeadSeats` after dead-seat conversion
- `packages/server/src/websocket/action-handler.ts` — AC14 gate order (`DEAD_SEAT` before `PLAYER_DEPARTED`)
- `packages/server/src/websocket/leave-handler.test.ts` — T12, T13, T14b, T17–T20, helpers
- `packages/server/src/websocket/turn-timer.test.ts` — Story 4B.5 block T8, T9, T24
- `packages/server/src/websocket/state-broadcaster.test.ts` — T10 dead-seat visibility
- `packages/server/src/websocket/action-handler.test.ts` — T22 START_GAME clears

**Earlier implementation / tests:**
- `packages/server/src/websocket/leave-handler.test.ts`, `action-handler.test.ts`, `turn-timer.ts`, `turn-timer.test.ts` (T19), client `DepartureVoteModal` / `GameTable` / `useRoomConnection` / `RoomView.vue`, `seat-release.ts`, shared protocol + `ResolvedAction` types, `state-broadcaster.ts`, `room*.ts`, `ws-server.ts`, and related `*.test.ts` updates.

**Room / protocol fixture-only updates (`departureVoteState: null` and related):**
- `packages/server/src/websocket/chat-handler.test.ts`
- `packages/server/src/websocket/grace-expiry-fallbacks.test.ts`
- `packages/server/src/websocket/pause-handlers.test.ts`
- `packages/server/src/rooms/room-lifecycle.test.ts`
- `packages/server/src/rooms/session-manager.test.ts`
- `packages/server/src/rooms/seat-assignment.test.ts`

### Completion Notes List

- **Task 1 (2026-04-05):** Shared types land clean. Typecheck + full test suite (1366 tests) green after the change — no runtime impact since `departureVoteState` is null at every existing construction site. Spec and quality review both approved on first pass.

- **Pass 2 (2026-04-05):** Filled AC18 test gaps: new `leave-handler.test.ts` (T1, T2, T3, T4, T5, T6, T7, T11, T14), `action-handler.test.ts` T16 (`PLAYER_DEPARTED` gate), `DepartureVoteModal.test.ts`, GameTable leave-dialog test. Fixed `autoPassCallWindowForDeadSeats` unused-parameter lint (`_logger`). `pnpm test`, `pnpm run typecheck`, and `vp lint` green. Story status → **review**; sprint entry `4b-5-player-departure-dead-seat` → **review**.

- **Code review option 1 (2026-04-05):** Charleston auto-action extracted to `charleston-auto-action.ts` (no join↔leave cycle); dead-seat Charleston drain from `convertToDeadSeat`; AC14 gate order; expanded tests (T8–T10, T12–T14b, T17–T20, T22, T24, Charleston); `countDisconnectedPlayers` excludes departed so `GAME_RESUMED` + `resumeDepartureVoteIfNeeded` work. Story + sprint → **done**; `pnpm test`, `pnpm run typecheck`, `vp lint` green.

- **Code review pass 2 (2026-04-05):** Added **T21** (`resetTurnTimerStateOnGameEnd` vs departure vote + dead-seat persistence) and **T23** (dead seat + second live leave starts a new vote, not multi-departure auto-end); corrected T21/T23 transition table wording; File List completed for Room fixture test files.

## Change Log

- **2026-04-05:** Code review pass 2 — T21/T23 tests, T21/T23 transition table corrections, File List fixture files.

- **2026-04-05:** Code review follow-up — Charleston module, pause/resume fix, AC14 order, transition/protocol test backfill, story File List + Task 10 accuracy.

- **2026-04-05:** Pass 2 — integration + client tests for departure flow; lint fix in `turn-timer.ts`; story and sprint status set to review.

- **2026-04-05:** Task 1 complete — shared types for LEAVE_ROOM protocol, 6 new ResolvedAction discriminants, GAME_ABANDONED reason extension, PlayerGameView.departureVoteState field (required, JSDoc noting divergence from 4B.4 AFK vote precedent).

- **2026-04-05:** Story 4B.5 created. Enumerates 20 ACs + 24 transition scenarios. Replaces 4B.4 AC14 dead-seat auto-discard stub with proper turn-skip + wall-skip + call-window auto-pass. Key decisions: (1) intentional departure uses a new `LEAVE_ROOM` protocol message distinct from socket disconnect; (2) departure vote state machine mirrors 4B.4 AFK vote pattern with binary `dead_seat | end_game` outcomes and majority-of-remaining-voters quorum; (3) dead-seat turn-skip lives server-side in `leave-handler.ts`/`turn-timer.ts` (not in the engine) to preserve engine purity; (4) dead-seat player stays in `room.players` (only `autoEndGameOnDeparture` calls `releaseSeat`) so their public info and exposed groups remain visible; (5) `PlayerGameView.departureVoteState` IS threaded into the view for mid-vote reconnect resume, diverging from the 4B.4 AFK-vote "accepted gap" because departure is higher-stakes and terminal; (6) multi-departure (≥2 leaves) auto-ends immediately per FR97, canceling any in-progress vote; (7) host migration stays Story 4B.6 — 4B.5 treats host departure as a generic departure vote and accepts that host-gated actions may fail until 4B.6 ships. Scope explicitly excludes: host migration (4B.6), AI fill-in (not in MVP per FR99), 5th-player page (4B.7).
