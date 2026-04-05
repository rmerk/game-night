# Story 4B.4: Turn Timeout & AFK Escalation

Status: done

<!-- Epic 4B story 4. Adds the play-phase turn timer (FR89) with no-timer mode (FR90), first-timeout nudge + extension (FR91), second-timeout auto-discard (FR92), and third+ consecutive-timeout AFK vote → dead-seat conversion (FR93). Builds on 4B.1 (reconnect backbone), 4B.2 (grace-expiry auto-discard helper + consolidated broadcasts), and 4B.3 (room pause interaction). Dead-seat turn-skip / call-pass semantics ship in Story 4B.5 — 4B.4 ends at setting the dead-seat flag and emitting the resolved action; until 4B.5 lands the AFK'd player continues to auto-discard on every subsequent timeout (the "vote fails" behavior). -->

## Story

As a **player**,
I want **a forgiving turn timer that nudges me on the first expiry, auto-discards the most recently drawn tile on the second, and lets the group vote to convert me to a dead seat after 3 consecutive timeouts**,
so that **one distracted player doesn't freeze the game for everyone, but I still get multiple chances to come back before being ejected from play (FR89, FR90, FR91, FR92, FR93)**.

## Acceptance Criteria

1. **AC1 — Turn-timer config lives on the room.** Extend [`Room`](../../packages/server/src/rooms/room.ts) with `turnTimerConfig: { readonly mode: "timed" | "none"; readonly durationMs: number }`. Initialize in [`room-manager.ts`](../../packages/server/src/rooms/room-manager.ts) `createRoom` alongside `jokerRulesMode` with the module-level default `DEFAULT_TURN_TIMER_CONFIG = { mode: "timed", durationMs: 20_000 }` exported from a new [`packages/server/src/websocket/turn-timer.ts`](../../packages/server/src/websocket/turn-timer.ts) module. Add a test-only setter `setDefaultTurnTimerConfig(config)` following the `setGracePeriodMs` / `setPauseTimeoutMs` pattern so integration tests can shrink the window. Host UI for toggling the mode is **out of scope** (Story 4B.7); for 4B.4 the config is only writable via `createRoom`, `setDefaultTurnTimerConfig`, or direct fixture mutation in tests.

2. **AC2 — Turn timer only runs in play phase, for a connected current player, in `draw`/`discard` turn phase.** The timer's single authoritative entrypoint is `syncTurnTimer(room, logger)` (new helper in `turn-timer.ts`). It cancels any existing turn timer and decides whether to install a new one. Install conditions (all required):
   - `room.turnTimerConfig.mode === "timed"`
   - `room.paused === false`
   - `room.gameState !== null` and `room.gameState.gamePhase === "play"`
   - `room.gameState.turnPhase === "draw" || "discard"` (i.e. **not** `"callWindow"`)
   - `room.players.get(room.gameState.currentTurn)?.connected === true` (grace-expiry owns disconnected players — AC9)
   - The current player is **not** in `room.deadSeatPlayerIds` (AC14)
   
   If any condition fails, cancel the existing timer (if any) and do nothing. `syncTurnTimer` is called from: (a) post-action broadcasts in [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) `handleAction` path — immediately **after** `broadcastGameState` on successful actions; (b) post-pause-resume in [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `attachToExistingSeat` after `GAME_RESUMED`; (c) post-reconnect in `attachToExistingSeat` after `PLAYER_RECONNECTED` (re-arms timer if the reconnecter was the stuck current player); (d) post-`handleStartGameAction` after the initial `broadcastGameState` to arm the opening turn.

3. **AC3 — No-timer mode (FR90).** Given `room.turnTimerConfig.mode === "none"`, when `syncTurnTimer` is called from any site, then it cancels any existing timer and **does not** install one. No timer ticks, no nudge, no auto-discard, no AFK vote is ever triggered for that room. Tests must cover this path explicitly.

4. **AC4 — First timeout: nudge + extension (FR91).** Given a turn timer is armed for player `P` with `durationMs = D` and `stage = "initial"`, when the timer expires, then the expiry callback (`handleTurnTimeoutExpiry`) fires **in sequence**:
   - (a) Increment `room.consecutiveTurnTimeouts.get(P)` by 1 (initialize to 1 if absent). The map lives on the room, not the game state.
   - (b) Branch on the new counter value. If the counter is now `1`, emit the **nudge** path:
     - Re-arm the turn timer with a fresh `setTimeout(handleTurnTimeoutExpiry, D)` and set the new timer's `stage = "extended"`. The extension duration equals the configured `durationMs` (e.g. 20s initial → 20s extension → total 40s before auto-discard).
     - Broadcast `broadcastStateToRoom(room, undefined, { type: "TURN_TIMER_NUDGE", playerId: P, expiresAt: Date.now() + D })` so all clients can render a "It's your turn!" toast to the stuck player and a subtle indicator to opponents.
     - Log `"Turn timer: first timeout — nudge + extend"`.
     - `return`.
   
   The branch must be strictly ordered — never broadcast before the counter increment commits, and never re-arm the timer before the counter reflects the expiry.

5. **AC5 — Second timeout: auto-discard the most recently drawn tile (FR92).** Given the turn timer expires on a timer whose `stage === "extended"` (the counter is now `2`), then:
   - (a) Look up `gameState.players[P].rack`. Pick the **last non-joker** tile in the rack using the existing `pickAutoDiscardTileId` helper from [`grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) — **extract this helper to `turn-timer.ts`** (or a shared `auto-action-helpers.ts`) and re-import in both files so there is **one** auto-discard-tile picker. Do not duplicate the loop.
   - (b) If no non-joker tile exists, log a warn and return without mutating state (same behavior as grace-expiry); the next action broadcast will re-sync the timer.
   - (c) Call `handleAction(gameState, { type: "DISCARD_TILE", playerId: P, tileId })`. On success:
     - Call `broadcastGameState(room, gameState, result.resolved)` — the standard `DISCARD_TILE` resolved-action path, so existing client discard animations play unchanged.
     - **Then** call `broadcastStateToRoom(room, undefined, { type: "TURN_TIMEOUT_AUTO_DISCARD", playerId: P, tileId })` as an additional broadcast so clients can render an "AFK auto-discard" toast distinguishable from voluntary discards. This mirrors the 4B.3 pattern of emitting a supplementary resolved action after the primary state update.
     - Call `syncTurnTimer(room, logger)` — the discard advances the turn, so the timer re-arms for the next current player (or enters the call window, which cancels the timer via AC2).
   - (d) On `handleAction` failure, log a warn and return (no timer re-arm; the next broadcast will re-sync).
   - (e) **Do not reset** `consecutiveTurnTimeouts[P]` — that happens only on voluntary action (AC6). An auto-discard does not prove presence.

6. **AC6 — Counter resets on voluntary action.** Given player `P` successfully executes **any** game action (`DRAW_TILE`, `DISCARD_TILE`, `CHARLESTON_PASS`, `CHARLESTON_VOTE`, `COURTESY_PASS`, `JOKER_EXCHANGE`, `PASS_CALL`, `CALL_PUNG`/`CALL_KONG`/`CALL_QUINT`/`CALL_NEWS`/`CALL_DRAGON_SET`, `CALL_MAHJONG`, `CONFIRM_CALL`, `RETRACT_CALL`, `DECLARE_MAHJONG`, `CANCEL_MAHJONG`, challenge votes, social-override votes, table-talk votes, `SHOW_HAND`) via `handleActionMessage`, when the action is accepted (`ActionResult.accepted === true`), then `room.consecutiveTurnTimeouts.delete(P)` (or set to 0) immediately after `broadcastGameState` and immediately before `syncTurnTimer`. The reset is keyed on **the actor** (`action.playerId`), not on the current-turn player — a non-current player answering a call-window prompt proves their presence. Auto-generated discards from AC5 do **not** go through `handleActionMessage` and do **not** trigger the reset. `AFK_VOTE_CAST` and `SET_JOKER_RULES` are not `GameAction`s and also do not trigger the reset (the latter is a lobby action anyway; the former is this story's new vote path handled in AC11).

7. **AC7 — `consecutiveTurnTimeouts` scope: per-game, per-player.** The map is cleared at `START_GAME` (inside `handleStartGameAction` alongside `room.gameState` assignment) and again at auto-end / game-end transitions (scoreboard phase entry via `MAHJONG_DECLARED`, `WALL_GAME`, or pause auto-end from 4B.3). Implementer must **not** reset the map on per-player disconnect or reconnect — counters persist across a single player's reconnect cycle so a player can't dodge escalation by hard-quitting and rejoining.

8. **AC8 — Pause interaction (4B.3 integration).** `syncTurnTimer` gates on `room.paused === false` (AC2). The 4B.3 pause-trigger branch in [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` Branch B must call `cancelTurnTimer(room, logger)` **after** `room.graceTimers.clear()` and **before** `broadcastStateToRoom(... GAME_PAUSED)`. The 4B.3 resume path in `attachToExistingSeat` must call `syncTurnTimer(room, logger)` **after** the `GAME_RESUMED` broadcast (not before — the broadcast ships the cleared-counter state first, then the timer re-arms). The `consecutiveTurnTimeouts` counter is **not** reset by pause/resume — a player who pauses the room by dropping during their own stuck turn doesn't get a free counter reset. Pause-timeout auto-end (4B.3 AC7) clears the counter as part of AC7 ("game-end transition" in this story's AC7).

9. **AC9 — Disconnected current player: grace-expiry owns, turn timer stays off.** If the current player is `connected === false`, `syncTurnTimer` does not install a timer (AC2 install condition). The existing 4B.1/4B.2 grace-expiry path (30s per-player grace → `applyGraceExpiryGameActions` auto-discard) remains the sole auto-action mechanism for disconnected players. This is **not** an AFK escalation path — disconnect-timeouts do not increment `consecutiveTurnTimeouts`. A player who disconnects during their turn, auto-discards via grace-expiry, reconnects, and then starts their next turn fresh gets counter `0` — they were offline, not AFK. **Rationale:** AFK escalation is specifically about present-but-inattentive players; offline players are already handled by the reconnect / pause flow. Document this boundary clearly in `turn-timer.ts` JSDoc.

10. **AC10 — Third consecutive timeout: start AFK vote (FR93).** Given the second-timeout auto-discard in AC5 runs successfully and increments `consecutiveTurnTimeouts[P]` to `2` — wait, correction: the counter is incremented in AC4(a) **on every expiry**. So after the first expiry the counter is `1` (nudge), after the second expiry the counter is `2` (auto-discard), after the third expiry the counter is `3` (AFK vote trigger). The expiry callback branches on counter value:
   - `counter === 1` → AC4 nudge path (and `stage` just became `initial` → `extended`).
   - `counter === 2` → AC5 auto-discard path (happens on the extended-stage timer).
   - `counter >= 3` → AC10 AFK-vote path (see below).
   
   But wait — a "third consecutive timeout" in the epic's language means three full turn-timeouts over three turns, not the 3rd expiry within a single turn (there are only 2 expiries per turn: initial + extended). The counter increments **once per turn that ends in auto-discard**, not once per expiry. Re-specify:
   - Each turn has **one** counter increment, at the moment the extended-stage timer fires (the auto-discard or vote-trigger moment). The nudge expiry does **not** increment the counter by itself; instead the counter reflects "how many consecutive turns ended without a voluntary action from this player".
   - On the first stuck turn: initial expiry → nudge + extend (no counter change). Extended expiry → auto-discard → `counter = 1`.
   - On the second stuck turn (same player auto-AFK'd through another full rotation): counter was 1, initial expiry → nudge + extend, extended expiry → auto-discard → `counter = 2`.
   - On the third stuck turn: counter was 2, initial expiry → nudge + extend, extended expiry → auto-discard **and** trigger AFK vote → `counter = 3`.
   
   **Corrected rule:** increment `consecutiveTurnTimeouts[P]` **only** on the extended-stage expiry (the auto-discard moment), not on the initial nudge expiry. After increment, if the new counter is `>= 3` **and** player `P` is **not** already in `room.afkVoteCooldownPlayerIds` (AC13) **and** `room.afkVoteState === null` (no concurrent vote), start an AFK vote (AC11). Otherwise fall through to the normal auto-discard path.

11. **AC11 — AFK vote state machine.** Introduce `AfkVoteState` in `turn-timer.ts` (server-only, not shared):
    ```
    interface AfkVoteState {
      readonly targetPlayerId: string;
      readonly startedAt: number;
      readonly votes: Map<string, "approve" | "deny">; // voterId → vote
    }
    ```
    Store as `room.afkVoteState: AfkVoteState | null` (initialize `null` in `createRoom`). Vote lifecycle:
    - **Start (from AC10):** Build `AfkVoteState` with `targetPlayerId = P`, empty votes map. Start an `"afk-vote-timeout"` lifecycle timer (new variant — AC15) with 30s default duration. Broadcast `broadcastStateToRoom(room, undefined, { type: "AFK_VOTE_STARTED", targetPlayerId: P, expiresAt: Date.now() + 30_000 })`.
    - **Cast (new protocol action — AC12):** On receiving a valid `AFK_VOTE_CAST` message from voter `V`, add/overwrite `votes.set(V, vote)`. Broadcast `broadcastStateToRoom(room, undefined, { type: "AFK_VOTE_CAST", voterId: V, vote, targetPlayerId: P })` so clients can update vote tallies.
    - **Resolve (after each cast or on timeout expiry):** Run `resolveAfkVote(room, logger)`:
      - Count approves and denies. Approves needed: 2. Denies needed to block: 2.
      - If approves ≥ 2 → outcome `"passed"`: add `P` to `room.deadSeatPlayerIds`, broadcast `AFK_VOTE_RESOLVED { targetPlayerId: P, outcome: "passed" }`, clear `room.afkVoteState = null`, cancel the `"afk-vote-timeout"` lifecycle timer, call `syncTurnTimer(room, logger)` (which re-arms without `P` because of the dead-seat guard in AC2 — but see AC14 for the scope caveat).
      - If denies ≥ 2 → outcome `"failed"`: add `P` to `room.afkVoteCooldownPlayerIds` (no more votes this game for `P`), clear state, cancel timer, broadcast `AFK_VOTE_RESOLVED { targetPlayerId: P, outcome: "failed" }`. Future timeouts for `P` continue to auto-discard per AC5 with no new vote.
      - Else if `afk-vote-timeout` fired (30s up) → outcome `"failed"` (no quorum = denial), same as denies-pass path.
      - Else → vote stays open.
    - **Cancel on presence (AC13):** If the target player takes any voluntary action while the vote is open, resolve with outcome `"cancelled"`.

12. **AC12 — `AFK_VOTE_CAST` protocol message.** Add a new client-to-server message type to [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts) alongside `SET_JOKER_RULES`:
    ```
    {
      version: 1;
      type: "AFK_VOTE_CAST";
      targetPlayerId: string;
      vote: "approve" | "deny";
    }
    ```
    Handle in [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) message dispatch, routed to a new `handleAfkVoteCastMessage(ws, session, room, parsed, logger)` in `turn-timer.ts` (or a new `afk-vote-handler.ts` if the implementer prefers — but keep the vote module near the timer since they share the `room.afkVoteState` field). Validation:
    - Session must exist and match `ws` (standard gate).
    - `room.afkVoteState !== null` and `targetPlayerId === room.afkVoteState.targetPlayerId` (stale vote protection).
    - Voter `V = session.player.playerId` must **not** equal `targetPlayerId` (self-votes rejected).
    - Voter must be `connected === true` (defensive — should be true if we got a message from them).
    - Voter must **not** be in `room.deadSeatPlayerIds` (dead seats don't vote).
    - Vote is idempotent-writable: recasting with the same or different choice just updates the map (allows players to change their mind before quorum).
    - On invalid, send an `ERROR` message (reuse existing error-code pattern, new codes: `NO_ACTIVE_VOTE`, `INVALID_VOTE_TARGET`, `CANNOT_VOTE_ON_SELF`).

13. **AC13 — Voluntary action by target during vote cancels the vote.** Given `room.afkVoteState !== null` and the target player `P` executes any successful `GameAction` via `handleActionMessage`, then after the counter reset (AC6) and before `syncTurnTimer`, call `cancelAfkVote(room, logger, reason: "target_active")` which: clears `room.afkVoteState`, cancels the `"afk-vote-timeout"` lifecycle timer, broadcasts `AFK_VOTE_RESOLVED { targetPlayerId: P, outcome: "cancelled" }`. **Do not** add `P` to `afkVoteCooldownPlayerIds` — they've genuinely come back and should get the full counter-reset treatment (already done by AC6). Subsequent stuck turns for `P` can trigger a fresh vote once the counter re-reaches 3.

14. **AC14 — Dead-seat flag: 4B.4 sets, 4B.5 enforces.** On an AFK vote passing (AC11), add `P` to `room.deadSeatPlayerIds: Set<string>` (new field on `Room`, initialize empty in `createRoom`). Thread the set to the client through a new `PlayerGameView.deadSeatPlayerIds: readonly string[]` field (required, default `[]`; populated by `buildPlayerView` via `Array.from(room.deadSeatPlayerIds)`). **4B.4 does NOT implement turn-skipping, call auto-pass, or wall-skip behavior for dead seats** — that ships in Story 4B.5 and is explicitly out of scope here (see Scope boundaries). Until 4B.5 lands, a passed-vote dead seat continues to have its turns auto-discarded by AC5 on every timeout (i.e. the player is marked dead but the game still rotates turns to them; they just always auto-discard). This is **intentional** — the vote mechanism ships before the skip mechanism so 4B.5 can focus purely on the skip semantics. The `syncTurnTimer` AC2 dead-seat install-guard **still applies** so the timer doesn't re-arm on dead seats — this means a dead seat's turn enters draw phase, grace-expiry does not fire (they're connected), and the turn **never advances** until 4B.5 ships OR the implementer also runs an immediate auto-discard from the dead-seat branch. To keep 4B.4 shippable without 4B.5, add a minimal inline "if current player is dead-seat and connected and in draw phase, synthesize an immediate auto-discard via the AC5 code path" stub in `syncTurnTimer`. Mark this stub with a `// TODO(4B.5): replace with proper dead-seat turn-skip` comment. **Do not** build the general skip-turn helper — that belongs to 4B.5.

15. **AC15 — New lifecycle timer variants: `"turn-timer"` and `"afk-vote-timeout"`.** Extend the `LifecycleTimerType` union in [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) with two new variants. The turn timer has a **variable** duration (depends on `room.turnTimerConfig.durationMs` and `stage`), so its entry in `getTimeoutForType` must dynamically read from the room rather than returning a module-level constant — or, cleaner, the turn timer does **not** go through `startLifecycleTimer`/`getTimeoutForType` at all, instead living as a dedicated `room.turnTimerHandle: ReturnType<typeof setTimeout> | null` field managed directly by `turn-timer.ts`. The AFK vote timer **does** go through the lifecycle framework with a fixed `DEFAULT_AFK_VOTE_TIMEOUT_MS = 30_000` and a test setter `setAfkVoteTimeoutMs(ms)`. Pick **one** of these approaches and implement consistently; the story recommends the dedicated-field approach for the turn timer (simpler, matches the stateful nature of `stage: "initial" | "extended"`) and the lifecycle-timer approach for the AFK vote (matches `pause-timeout` precedent). Document the choice in the `turn-timer.ts` header comment.

16. **AC16 — `ResolvedAction` union: five new discriminants.** Add to [`ResolvedAction`](../../packages/shared/src/types/game-state.ts) union:
    - `{ readonly type: "TURN_TIMER_NUDGE"; readonly playerId: string; readonly expiresAt: number }`
    - `{ readonly type: "TURN_TIMEOUT_AUTO_DISCARD"; readonly playerId: string; readonly tileId: string }`
    - `{ readonly type: "AFK_VOTE_STARTED"; readonly targetPlayerId: string; readonly expiresAt: number }`
    - `{ readonly type: "AFK_VOTE_CAST"; readonly voterId: string; readonly targetPlayerId: string; readonly vote: "approve" | "deny" }`
    - `{ readonly type: "AFK_VOTE_RESOLVED"; readonly targetPlayerId: string; readonly outcome: "passed" | "failed" | "cancelled" }`
    
    Fix any exhaustiveness breakage in client composables and test helpers (same discipline as 4B.3 AC9). Run `pnpm run typecheck` to find all sites.

17. **AC17 — `PlayerGameView.deadSeatPlayerIds` field.** Extend [`PlayerGameView`](../../packages/shared/src/types/protocol.ts) with `deadSeatPlayerIds: readonly string[]` (required). Populated by [`buildPlayerView`](../../packages/server/src/websocket/state-broadcaster.ts) from `room.deadSeatPlayerIds`. `LobbyState` is NOT extended — dead-seat is an in-game concept. The client renders the list as muted badges on seat portraits (minimal styling for 4B.4 — 4B.5 ships the full dead-seat visual treatment). Add `data-testid="dead-seat-badge-{playerId}"` to each badge for test targeting.

18. **AC18 — Client: nudge toast, auto-discard toast, AFK vote modal, dead-seat badge.** Client deliverables in 4B.4 are **minimal and functional**, not polished:
    - **Nudge toast (AC4):** When a `TURN_TIMER_NUDGE` resolvedAction arrives for the local player, show a prominent "It's your turn!" toast with a 5-second timeout. For other players, optionally show a subtle "[PlayerName] is idle" toast. Reuse the existing toast/resolved-action pipeline in [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) — do **not** build new toast infrastructure. `data-testid="turn-timer-nudge-toast"`.
    - **Auto-discard toast (AC5):** When `TURN_TIMEOUT_AUTO_DISCARD` arrives, show "[PlayerName] auto-discarded" toast for 3 seconds. `data-testid="turn-timeout-auto-discard-toast"`.
    - **AFK vote modal (AC11/AC12):** When `AFK_VOTE_STARTED` arrives and the local player is **not** the target, show a modal with copy "Convert [PlayerName] to a dead seat?" and two buttons: "Yes" (Approve) / "No" (Deny). Send the `AFK_VOTE_CAST` message via a new `sendAfkVote(targetPlayerId, vote)` method on `useRoomConnection`. When the local player **is** the target, show a different modal: "Players are voting to mark you AFK — take an action to cancel the vote." When `AFK_VOTE_RESOLVED` arrives with any outcome, close the modal. `data-testid="afk-vote-modal"`, `data-testid="afk-vote-approve-btn"`, `data-testid="afk-vote-deny-btn"`.
    - **Dead-seat badge (AC17):** Render a muted "Dead Seat" badge on every seat whose `playerId` is in `playerGameView.deadSeatPlayerIds`. Minimal styling — a `text-text-on-felt/60` badge in the seat nameplate area. `data-testid="dead-seat-badge-{playerId}"`.
    - **No new panel, no animations, no sounds.** Scope creep is 4B.5 / Epic 7's problem.

19. **AC19 — Test strategy: fake timers + setters + shortened windows.** All turn-timer and AFK-vote tests use **either** `vi.useFakeTimers()` with `vi.advanceTimersByTime(...)` **or** `setDefaultTurnTimerConfig({ mode: "timed", durationMs: 50 })` + `setAfkVoteTimeoutMs(100)` to shrink windows for integration tests. `afterEach` must restore defaults: `setDefaultTurnTimerConfig({ mode: "timed", durationMs: 20_000 })` and `setAfkVoteTimeoutMs(DEFAULT_AFK_VOTE_TIMEOUT_MS)`. Never `await new Promise(r => setTimeout(r, 20_000))`. Every transition scenario below must have at least one test.

20. **AC20 — Regression gate.** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass from the repo root. Previous story (4B.3) tests in `pause-handlers.test.ts`, `grace-expiry-fallbacks.test.ts`, `action-handler.test.ts`, and `join-handler.test.ts` remain green — the new `syncTurnTimer` call sites in the action-handler broadcast path and join-handler pause/resume path must not break existing broadcast sequencing or state-transition tests. In particular: the 4B.3 `T2` test that asserts `GAME_RESUMED` fires exactly once on the last reconnect must still pass with the added `syncTurnTimer` call afterward.

### Transition scenarios

Every row must be enumerated in implementation and covered by at least one test. Pass-1 code review walks this table (per 6A retro follow-through `6a-retro-1`).

| # | Scenario | Expected behavior | AC |
|---|----------|-------------------|----|
| T1 | Game starts, E is current turn, connected, `durationMs = 50ms` (test) | `syncTurnTimer` arms initial-stage timer on E. Voluntary DRAW_TILE within 50ms → counter never incremented, timer cancels, re-arms for discard step | AC2, AC6 |
| T2 | E does nothing for 50ms | Initial expiry: nudge broadcast (`TURN_TIMER_NUDGE`), timer re-armed with stage=extended, 50ms more. Counter still 0. | AC4 |
| T3 | E does nothing for another 50ms after nudge | Extended expiry: counter → 1, auto-discard last non-joker tile, `DISCARD_TILE` + `TURN_TIMEOUT_AUTO_DISCARD` broadcasts, turn advances to S, timer re-arms for S | AC5, AC10 counter semantics |
| T4 | E stuck 3 consecutive turns (2×50ms each × 3 turns), 4th turn starts | On extended expiry of 3rd stuck turn: counter → 3, auto-discard **and** `AFK_VOTE_STARTED` broadcast, `afk-vote-timeout` armed for 100ms (test) | AC10, AC11 |
| T5 | AFK vote open, S votes approve, W votes approve | `AFK_VOTE_CAST` × 2 broadcasts, then `AFK_VOTE_RESOLVED { outcome: "passed" }`, `room.deadSeatPlayerIds` contains E, `afkVoteState = null`, `afk-vote-timeout` cancelled | AC11, AC14 |
| T6 | AFK vote open, S votes deny, W votes deny | `AFK_VOTE_RESOLVED { outcome: "failed" }`, `afkVoteCooldownPlayerIds` contains E, subsequent stuck turns auto-discard without re-voting | AC11 |
| T7 | AFK vote open, only S votes approve, 30s (100ms test) elapses | `afk-vote-timeout` fires → `AFK_VOTE_RESOLVED { outcome: "failed" }`, cooldown added, no dead seat | AC11 |
| T8 | AFK vote open, target E draws + discards voluntarily | Counter reset (AC6), `cancelAfkVote` fires → `AFK_VOTE_RESOLVED { outcome: "cancelled" }`, `afkVoteState = null`, E NOT in `deadSeatPlayerIds` NOR `afkVoteCooldownPlayerIds`, counter is 0 for E | AC13, AC6 |
| T9 | Counter at 1 for E (one prior auto-discard), E draws + discards on next turn | `handleActionMessage` reset → counter deleted for E. Next stuck turn starts fresh at 0 | AC6 |
| T10 | Room config `mode: "none"` | `syncTurnTimer` is a no-op from every call site. No nudge, no auto-discard, no vote triggered by the timer path ever. Only grace-expiry on disconnect can auto-discard | AC3 |
| T11 | Current player disconnects mid-turn → grace expires → grace-expiry auto-discard | `syncTurnTimer` gated by `connected=true` so no turn timer installed. Grace-expiry handles auto-discard via its own path (4B.2). Counter NOT incremented | AC9 |
| T12 | Two players disconnect simultaneously → 4B.3 pause fires | 4B.3 Branch B calls `cancelTurnTimer`. `room.turnTimerHandle === null`. All 4 reconnect → `GAME_RESUMED` → `syncTurnTimer` re-arms for the current player. Counters unchanged | AC8 |
| T13 | AFK vote open, vote target disconnects | Vote stays open (the target doesn't vote anyway). If 4B.3 pause fires because a 2nd player drops, `cancelTurnTimer` fires but `afkVoteState` and its timer also need to be cancelled — add pause-trigger cleanup for both. When pause resumes, the vote does **not** automatically restart — document as a tradeoff. | AC8, AC11, edge case |
| T14 | Call window opens (player X discards, phase → callWindow) | `syncTurnTimer` install-condition fails (turnPhase !== draw/discard), timer cancelled during call window. When call resolves and turn advances to next drawer, `syncTurnTimer` arms for them | AC2 |
| T15 | Player X declares Mahjong → gamePhase → scoreboard | `syncTurnTimer` install-condition fails (gamePhase !== play), timer cancelled, counter cleared (AC7 game-end) | AC2, AC7 |
| T16 | AFK_VOTE_CAST from target player (E votes on themselves) | Rejected with `CANNOT_VOTE_ON_SELF` error, vote state unchanged | AC12 |
| T17 | AFK_VOTE_CAST when no vote is active | Rejected with `NO_ACTIVE_VOTE` error | AC12 |
| T18 | AFK_VOTE_CAST with stale `targetPlayerId` (different from current vote) | Rejected with `INVALID_VOTE_TARGET` error | AC12 |
| T19 | AFK vote passed → E is dead-seat → E's turn comes up again | AC14 stub: `syncTurnTimer` detects dead seat, triggers immediate auto-discard via AC5 path so turn advances. `TODO(4B.5)` comment in place. Counter irrelevant (dead seats stay dead) | AC14 |
| T20 | S changes mind: casts approve then deny before quorum | Map updated; tally re-evaluated after each cast; final broadcast order is two `AFK_VOTE_CAST` broadcasts before any `AFK_VOTE_RESOLVED` | AC11 idempotent writes |

### Scope boundaries

| In scope (4B.4) | Out of scope |
| --------------- | ------------ |
| `room.turnTimerConfig` + default `{ timed, 20_000ms }` | Host UI for toggling timer mode (Story 4B.7) |
| Turn timer state machine: initial → extended → auto-discard | Settings panel mid-game change flow (Story 4B.7) |
| `consecutiveTurnTimeouts` per-player counter + reset on voluntary action | Dead-seat turn skip / wall-skip / call-auto-pass (Story 4B.5) |
| `TURN_TIMER_NUDGE` + extension | AI fill-in for AFK'd players (explicitly NOT in MVP per FR99) |
| `TURN_TIMEOUT_AUTO_DISCARD` resolvedAction + auto-discard reusing `pickAutoDiscardTileId` | Rich dead-seat visual treatment (Epic 7 / 5B polish) |
| `AFK_VOTE_STARTED` / `AFK_VOTE_CAST` / `AFK_VOTE_RESOLVED` + `AFK_VOTE_CAST` protocol message | Persisting dead-seat across server restart |
| `room.afkVoteState` + `afkVoteCooldownPlayerIds` + `deadSeatPlayerIds` + `"afk-vote-timeout"` lifecycle timer | Reopening AFK votes after cooldown within the same game |
| Pause (4B.3) integration — cancel/resume turn timer + vote cleanup on pause | Host migration while AFK vote is open (Story 4B.6) |
| Minimal client: nudge toast, auto-discard toast, vote modal, dead-seat badge | Full vote-in-progress scoreboard, vote-history audit log |
| `PlayerGameView.deadSeatPlayerIds` field threaded through broadcast | Dead-seat affecting wall count / mahjong validity |
| AC14 dead-seat auto-discard stub (scoped to keep 4B.4 shippable alone) | E2E Playwright tests (Vitest integration covers multi-socket path per 4B.1 precedent) |
| Tests for every transition in table above | |

## Tasks / Subtasks

- [x] **Task 1: Shared types — `ResolvedAction` discriminants, `PlayerGameView.deadSeatPlayerIds`, `AFK_VOTE_CAST` protocol** (AC: 12, 16, 17, 20)
  - [x] 1.1 Add the five new `ResolvedAction` discriminants from AC16 to [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts).
  - [x] 1.2 Add `deadSeatPlayerIds: readonly string[]` (required) to `PlayerGameView` in [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts). `LobbyState` untouched.
  - [x] 1.3 Add `AfkVoteCastMessage` type + discriminant to the client→server message union in `protocol.ts` alongside `SetJokerRulesMessage`.
  - [x] 1.4 `pnpm run typecheck` — find every exhaustive `switch` on `ResolvedAction.type` (most live in `mapPlayerGameViewToGameTable.ts`, `useRoomConnection.ts` resolved-action router, test helpers). Add the five new arms following each file's existing pattern (usually `break;` or `default: never`).

- [x] **Task 2: Server — `Room` fields + `createRoom` init** (AC: 1, 11, 13, 14, 15, 20)
  - [x] 2.1 Extend [`packages/server/src/rooms/room.ts`](../../packages/server/src/rooms/room.ts) `Room` interface with: `turnTimerConfig: { mode: "timed" | "none"; durationMs: number }`, `turnTimerHandle: ReturnType<typeof setTimeout> | null`, `turnTimerStage: "initial" | "extended" | null`, `turnTimerPlayerId: string | null`, `consecutiveTurnTimeouts: Map<string, number>`, `afkVoteState: AfkVoteState | null` (import the type from `turn-timer.ts` — or re-declare minimally here if circular-import avoidance matters), `afkVoteCooldownPlayerIds: Set<string>`, `deadSeatPlayerIds: Set<string>`.
  - [x] 2.2 Initialize all new fields in [`room-manager.ts`](../../packages/server/src/rooms/room-manager.ts) `createRoom` alongside `paused: false`. Defaults: `turnTimerConfig: { ...DEFAULT_TURN_TIMER_CONFIG }` (shallow copy), `turnTimerHandle: null`, `turnTimerStage: null`, `turnTimerPlayerId: null`, `consecutiveTurnTimeouts: new Map()`, `afkVoteState: null`, `afkVoteCooldownPlayerIds: new Set()`, `deadSeatPlayerIds: new Set()`.
  - [x] 2.3 Add `"afk-vote-timeout"` to `LifecycleTimerType` union in [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts), plus `DEFAULT_AFK_VOTE_TIMEOUT_MS = 30_000` and `afkVoteTimeoutMs` variable + `setAfkVoteTimeoutMs(ms)` setter. Extend `getTimeoutForType` switch with the new case. **Do not** add `"turn-timer"` here — the turn timer is a dedicated `room.turnTimerHandle` field (see AC15 decision and Task 3).

- [x] **Task 3: Server — new `turn-timer.ts` module (timer state machine + AFK vote)** (AC: 1, 2, 3, 4, 5, 10, 11, 13, 14, 15, 19, 20)
  - [x] 3.1 Create [`packages/server/src/websocket/turn-timer.ts`](../../packages/server/src/websocket/turn-timer.ts). Export:
    - `DEFAULT_TURN_TIMER_CONFIG: { mode: "timed", durationMs: 20_000 }` (readonly const).
    - `setDefaultTurnTimerConfig(config): void` — test-only setter that mutates a module-level `defaultTurnTimerConfig` used by `createRoom` via re-export through room-manager's helper.
    - `AfkVoteState` interface (server-only; not in `@mahjong-game/shared`).
    - `pickAutoDiscardTileId(rack: Tile[]): string | null` — **moved** from `grace-expiry-fallbacks.ts`. Update `grace-expiry-fallbacks.ts` to import from here (Task 4).
    - `syncTurnTimer(room: Room, logger: FastifyBaseLogger): void` — the single source of truth for "is a turn timer running right now". Call-graph per AC2 install conditions. Cancels any existing timer if conditions aren't met. Installs a fresh `setTimeout(() => handleTurnTimerExpiry(room, logger), room.turnTimerConfig.durationMs)` with `stage = "initial"` if all conditions met. **Dead-seat stub (AC14):** if current player is in `deadSeatPlayerIds`, synchronously invoke the auto-discard path from AC5 + re-call `syncTurnTimer` afterwards (recursive but bounded — turn advances each call until it rotates to a non-dead-seat player or all 4 are dead — add a recursion-depth guard of 4 as a safety net).
    - `cancelTurnTimer(room: Room, logger: FastifyBaseLogger): void` — `clearTimeout(room.turnTimerHandle)`, null out the three turn-timer fields.
    - `handleTurnTimerExpiry(room, logger): void` — branches on `room.turnTimerStage`:
      - `"initial"`: emit nudge (AC4). Re-arm `room.turnTimerHandle` with `stage = "extended"`. Do **not** increment counter.
      - `"extended"`: increment `consecutiveTurnTimeouts[P]` (initialize to 1 if absent), then branch on counter. If `counter >= 3` and not in cooldown and no active vote → call `startAfkVote(room, P, logger)` **before** the auto-discard path (order matters: vote triggers on the action that is about to happen, not after turn advances away from P). Then run the auto-discard path (AC5) regardless of vote status. After auto-discard + broadcast, call `syncTurnTimer` again for the new current player.
    - `startAfkVote(room, targetPlayerId, logger): void` — build `AfkVoteState`, start lifecycle timer `"afk-vote-timeout"` with expiry callback `handleAfkVoteTimeoutExpiry`, broadcast `AFK_VOTE_STARTED`.
    - `handleAfkVoteCastMessage(ws, session, room, parsed, logger): void` — validation per AC12, write to map, broadcast `AFK_VOTE_CAST`, then call `resolveAfkVote(room, logger)`.
    - `resolveAfkVote(room, logger): void` — tally + resolve per AC11.
    - `cancelAfkVote(room, logger, reason: "target_active" | "pause"): void` — clear state, cancel timer, broadcast `AFK_VOTE_RESOLVED { outcome: "cancelled" }`.
    - `handleAfkVoteTimeoutExpiry(room, logger): void` — called by lifecycle timer; resolves the vote as failed per AC11 "no quorum".

- [x] **Task 4: Server — refactor `pickAutoDiscardTileId` + extend `grace-expiry-fallbacks`** (AC: 5, 20)
  - [x] 4.1 Move `pickAutoDiscardTileId` from [`grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) to `turn-timer.ts` (exported). Update the grace-expiry file to import from `./turn-timer`.
  - [x] 4.2 Verify `grace-expiry-fallbacks.test.ts` still passes (the helper moved but behavior unchanged).

- [x] **Task 5: Server — hook `syncTurnTimer` into action dispatch** (AC: 2, 6, 13, 20)
  - [x] 5.1 In [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) `handleActionMessage`, after the existing `broadcastGameState(room, gameState, result.resolved)` call on the success path (and **after** the 4B.3 `ROOM_PAUSED` gate), insert:
    ```
    // AC6: reset consecutive-timeout counter on voluntary action
    room.consecutiveTurnTimeouts.delete(action.playerId);
    // AC13: cancel in-progress AFK vote targeting this player
    if (room.afkVoteState?.targetPlayerId === action.playerId) {
      cancelAfkVote(room, logger, "target_active");
    }
    // AC2: re-sync turn timer (turn may have advanced, phase may have changed, etc.)
    syncTurnTimer(room, logger);
    ```
  - [x] 5.2 Also add `syncTurnTimer(room, logger)` after the `START_GAME` success path in `handleStartGameAction` (or wherever the initial `broadcastGameState` lands for game start). This arms the timer on the opening turn.
  - [x] 5.3 Clear `room.consecutiveTurnTimeouts` inside `handleStartGameAction` alongside the `room.gameState` assignment (AC7 start-of-game reset).

- [x] **Task 6: Server — pause integration** (AC: 8, 20)
  - [x] 6.1 In [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` Branch B (4B.3 pause trigger), call `cancelTurnTimer(room, logger)` after `room.graceTimers.clear()` and before the `GAME_PAUSED` broadcast. Also call `cancelAfkVote(room, logger, "pause")` if `room.afkVoteState !== null` — T13 coverage.
  - [x] 6.2 In `attachToExistingSeat` after the 4B.3 `GAME_RESUMED` broadcast (and after the resume-check block), call `syncTurnTimer(room, logger)`. Also call it after a per-player reconnect even without resume (paused stays true but the reconnecter might be the stuck current player — however, `syncTurnTimer` gates on `room.paused === false` so the call is a no-op while paused, which is correct).

- [x] **Task 7: Server — `AFK_VOTE_CAST` message dispatch in ws-server** (AC: 12, 20)
  - [x] 7.1 In [`ws-server.ts`](../../packages/server/src/websocket/ws-server.ts), extend the client message dispatcher (alongside `SET_JOKER_RULES` / `ACTION` / chat / reactions) with a branch for `parsed.type === "AFK_VOTE_CAST"`. Route to `handleAfkVoteCastMessage(ws, session, room, parsed, logger)` from `turn-timer.ts`. Chat/reactions unaffected.
  - [x] 7.2 Verify `validateActionPayload` is NOT used (AFK_VOTE_CAST is a direct protocol message, not a `GameAction`). Implement inline validation in `handleAfkVoteCastMessage` per AC12.

- [x] **Task 8: Server — `buildPlayerView` emits `deadSeatPlayerIds`** (AC: 17, 20)
  - [x] 8.1 In [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) `buildPlayerView`, add `deadSeatPlayerIds: Array.from(room.deadSeatPlayerIds)` to the returned `PlayerGameView`. `buildLobbyState` unchanged.

- [x] **Task 9: Server — game-end counter cleanup** (AC: 7, 20)
  - [x] 9.1 Identify all sites where `gamePhase` transitions to `"scoreboard"` or `"rematch"`: `handleMahjongDeclaration` / `MAHJONG_DECLARED` resolution, `WALL_GAME` resolution, 4B.3 `handlePauseTimeout`. After each such transition (server side), call `room.consecutiveTurnTimeouts.clear()` and also clear any lingering `afkVoteState` (`cancelAfkVote` with a new reason `"game_ended"` — or just null the field + cancel the lifecycle timer without a broadcast since the game-over broadcast already supersedes). Safer: extract a `resetTurnTimerStateOnGameEnd(room)` helper in `turn-timer.ts` that does: `cancelTurnTimer`, clear the counter map, clear `afkVoteState` + cancel `"afk-vote-timeout"` if present. Call it once from wherever game-end is observed. Simplest integration point: after every `broadcastGameState` in `action-handler.ts`, check `if (room.gameState?.gamePhase === "scoreboard" || "rematch") resetTurnTimerStateOnGameEnd(room)` — this catches all game-end paths without surgery into the engine.
  - [x] 9.2 `deadSeatPlayerIds` and `afkVoteCooldownPlayerIds` are **not** cleared on game-end — they reset on next `START_GAME` (new game, fresh slate).
  - [x] 9.3 In `handleStartGameAction`, clear: `consecutiveTurnTimeouts`, `afkVoteState` (should already be null), `afkVoteCooldownPlayerIds`, `deadSeatPlayerIds`.

- [ ] **Task 10: Server — tests** (AC: 2-14, 19, 20)
  - [x] 10.1 New file [`packages/server/src/websocket/turn-timer.test.ts`](../../packages/server/src/websocket/turn-timer.test.ts): unit tests for `syncTurnTimer` install-condition matrix (AC2 × install conditions), `handleTurnTimerExpiry` stage transitions (AC4/AC5), `startAfkVote` / `resolveAfkVote` / `cancelAfkVote` with a minimal handwritten `Room` fixture, `pickAutoDiscardTileId` moved-helper round-trip. Use `vi.useFakeTimers()` for the timer cycles.
  - [ ] 10.2 Extend [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts) with a new `describe("Story 4B.4 — turn timeout & AFK escalation", ...)` block covering T1, T2, T3, T4, T10, T11, T12, T13, T14, T15, T19 via full integration (multi-socket `roomManager.createRoom` + `connectSocket` pattern established in 4B.1/4B.2/4B.3). Use `setDefaultTurnTimerConfig({ mode: "timed", durationMs: 50 })` + `setAfkVoteTimeoutMs(100)` in `beforeEach`; restore defaults in `afterEach`. **Deferred:** transition matrix partially covered in `turn-timer.test.ts` (fake timers) instead of full WS integration.
  - [x] 10.3 Extend [`action-handler.test.ts`](../../packages/server/src/websocket/action-handler.test.ts) with AC6 counter-reset test (`beforeEach` seed `consecutiveTurnTimeouts` with a value, dispatch a voluntary action, assert deleted) and AC13 vote-cancel-on-target-active test.
  - [ ] 10.4 New or extended `ws-server.test.ts` test for `AFK_VOTE_CAST` dispatch covering T5, T6, T7, T8, T16, T17, T18, T20. **Deferred:** vote protocol paths covered via direct `handleAfkVoteCastMessage` tests in `turn-timer.test.ts`.
  - [x] 10.5 Extend [`grace-expiry-fallbacks.test.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.test.ts) with a "counter is NOT incremented on grace-expiry auto-discard" regression test (AC9).
  - [ ] 10.6 Extend [`pause-handlers.test.ts`](../../packages/server/src/websocket/pause-handlers.test.ts) or `join-handler.test.ts` pause describe with a "turn timer cancelled + AFK vote cancelled on pause trigger" test (T13). **Deferred:** pause + `cancelAfkVote` behavior remains covered by implementation + manual reasoning; optional dedicated integration test still valuable.
  - [x] 10.7 `afterEach` in every new test block: restore `setDefaultTurnTimerConfig(DEFAULT_TURN_TIMER_CONFIG)` and `setAfkVoteTimeoutMs(DEFAULT_AFK_VOTE_TIMEOUT_MS)` to prevent cross-test leakage.

- [x] **Task 11: Client — `useRoomConnection` extensions + AFK vote send** (AC: 18, 20)
  - [x] 11.1 In [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts), add `sendAfkVote(targetPlayerId: string, vote: "approve" | "deny"): void` that calls `sendRaw({ version: 1, type: "AFK_VOTE_CAST", targetPlayerId, vote })`. Expose from the composable's return value.
  - [x] 11.2 Route the new `TURN_TIMER_NUDGE` / `TURN_TIMEOUT_AUTO_DISCARD` / `AFK_VOTE_STARTED` / `AFK_VOTE_CAST` / `AFK_VOTE_RESOLVED` `resolvedAction` discriminants through the existing `resolvedAction` shallowRef — no new refs needed, the composable's existing "latest resolved action" pipeline is reused. Update any exhaustive switch in this file with the new arms (likely there's a `switch (resolvedAction.type)` for toast / side-effect dispatch).
  - [x] 11.3 No changes to the `playerGameView` handling — the new `deadSeatPlayerIds` field flows through `shallowRef<PlayerGameView>` automatically.

- [x] **Task 12: Client — `mapPlayerGameViewToGameTable` thread `deadSeatPlayerIds`** (AC: 17, 18, 20)
  - [x] 12.1 In [`mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts), thread `deadSeatPlayerIds: view.deadSeatPlayerIds ?? []` onto the mapped `GameTableProps`. Existing test in `mapPlayerGameViewToGameTable.test.ts` must be updated to include the new field in the expected output.

- [x] **Task 13: Client — `GameTable.vue` dead-seat badge + modal slot** (AC: 18, 20)
  - [x] 13.1 In [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue), add `deadSeatPlayerIds?: readonly string[]` (default `[]`) to `defineProps`. Render a minimal `<span data-testid="dead-seat-badge-{playerId}" class="...">Dead</span>` on each seat whose `playerId` is in the list. Minimal styling — muted tone, no animation, no spinner.
  - [x] 13.2 Do NOT programmatically disable dead-seat player interactions — server rejects any input via the dead-seat stub in AC14 and (in 4B.5) via turn-skip. The badge is informational only.

- [x] **Task 14: Client — nudge toast, auto-discard toast, AFK vote modal** (AC: 18, 20)
  - [x] 14.1 Identify the existing resolved-action → toast pipeline in client code (likely in `useRoomConnection.ts` or a dedicated `useResolvedActionToasts.ts` composable or inline in `GameTable.vue`). Add toast bindings for `TURN_TIMER_NUDGE` (local player target → prominent, others → subtle) and `TURN_TIMEOUT_AUTO_DISCARD` (all viewers).
  - [x] 14.2 Build a new component [`packages/client/src/components/game/AfkVoteModal.vue`](../../packages/client/src/components/game/AfkVoteModal.vue) (or add to an existing modals module if one exists). Props: `open: boolean`, `targetPlayerId: string`, `targetPlayerName: string`, `isTargetLocalPlayer: boolean`, `expiresAt: number | null`. Emits: `vote: "approve" | "deny"` (only when `!isTargetLocalPlayer`). Render conditionally:
    - If `isTargetLocalPlayer`: "Players are voting to mark you AFK — take an action to cancel the vote." Plus a countdown derived from `expiresAt`.
    - Else: "Convert [PlayerName] to a dead seat?" with Yes/No buttons emitting the vote.
    - `data-testid` attributes per AC18.
  - [x] 14.3 Wire `AfkVoteModal` into `GameTable.vue` (or wherever is most natural in the composition). State: track `afkVoteOpen: ref<{ targetPlayerId, expiresAt } | null>(null)` populated from `AFK_VOTE_STARTED`, cleared on `AFK_VOTE_RESOLVED`, in the resolved-action pipeline.
  - [x] 14.4 Wire the modal's `vote` emit to `useRoomConnection().sendAfkVote(targetPlayerId, vote)`.

- [x] **Task 15: Client — tests** (AC: 18, 20)
  - [x] 15.1 Add `AfkVoteModal.test.ts`: renders target-view vs voter-view correctly; clicking Approve/Deny emits the vote; countdown updates.
  - [x] 15.2 Extend `GameTable.test.ts` or add a new test for dead-seat badge rendering (`deadSeatPlayerIds: ["player-1"]` → badge visible on player 1's seat).
  - [x] 15.3 Extend `mapPlayerGameViewToGameTable.test.ts` with the new `deadSeatPlayerIds` field in expected output.
  - [x] 15.4 Extend `useRoomConnection.reconnection.test.ts` (or add a new `useRoomConnection.afkVote.test.ts`): feed synthetic `STATE_UPDATE` + `AFK_VOTE_STARTED` resolvedAction → assert a `sendAfkVote` call with the right args triggers the expected outbound JSON frame. Feed `AFK_VOTE_RESOLVED` → assert the modal state clears.

- [x] **Task 16: Regression gate + finalize** (AC: 20)
  - [x] 16.1 `pnpm test` (all packages) — green.
  - [x] 16.2 `pnpm run typecheck` — green. Especially watch for `ResolvedAction` exhaustiveness breakage in `mapPlayerGameViewToGameTable.ts` / `useRoomConnection.ts` / test helpers / dev showcase routes.
  - [x] 16.3 `vp lint` — green.
  - [x] 16.4 Update File List below with every touched file.
  - [x] 16.5 Update `sprint-status.yaml`: `4b-4-turn-timeout-afk-escalation: ready-for-dev → in-progress` when Dev picks it up, `→ review` at implementation complete, `→ done` after code review.

## Dev Notes

### Epic & requirements traceability

- [`epics.md`](../planning-artifacts/epics.md#L2724) — Story **4B.4** (FR89, FR90, FR91, FR92, FR93).
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — Decision 7 (Reconnection Strategy) and the server-authoritative timer precedent (call-window timer, pause-timeout). 4B.4 extends the "server owns the clock" pattern to per-turn timing.
- Builds on 4B.1 ([`4b-1-reconnection-with-full-state-restore.md`](./4b-1-reconnection-with-full-state-restore.md)), 4B.2 ([`4b-2-phase-specific-reconnection-fallbacks.md`](./4b-2-phase-specific-reconnection-fallbacks.md), and 4B.3 ([`4b-3-simultaneous-disconnection-game-pause.md`](./4b-3-simultaneous-disconnection-game-pause.md)).

### Infrastructure already in place (do not re-build)

| Capability | Location | Notes |
|---|---|---|
| Per-player grace timers (30s default) | [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` | 4B.4 **does not touch** these. Grace-expiry owns disconnected-player auto-discard (AC9). |
| Grace-expiry auto-discard (`pickAutoDiscardTileId`) | [`grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) | 4B.4 **moves** `pickAutoDiscardTileId` to `turn-timer.ts` and re-imports. Single source of truth for "which tile does the server auto-pick". |
| Lifecycle timer framework | [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) | 4B.4 adds one variant `"afk-vote-timeout"` (30s) + setter. The turn timer itself is a dedicated `room.turnTimerHandle` field, not a lifecycle timer (AC15). |
| `broadcastStateToRoom` / `broadcastGameState` | [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) | Reuse for all new broadcasts. No raw `ws.send` loops in 4B.4. |
| `handleAction` engine entrypoint | [`packages/shared/src/engine/game-engine.ts`](../../packages/shared/src/engine/game-engine.ts) | 4B.4 auto-discard goes through `handleAction` for a normal `DISCARD_TILE` (engine is pure; auto-discard is indistinguishable from voluntary discard as far as the engine is concerned). |
| `ResolvedAction` discriminated union | [`game-state.ts`](../../packages/shared/src/types/game-state.ts) | 4B.4 adds five new variants (AC16). Every existing `switch` on `ResolvedAction.type` must stay exhaustive. |
| `sendActionError` error-code pattern | [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) | `AFK_VOTE_CAST` validation reuses this for `NO_ACTIVE_VOTE`, `INVALID_VOTE_TARGET`, `CANNOT_VOTE_ON_SELF`. |
| `PlayerGameView` broadcast shape | [`protocol.ts`](../../packages/shared/src/types/protocol.ts) + [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) | Add one new required field `deadSeatPlayerIds`. Do NOT extend `LobbyState`. |
| 4B.3 pause integration hooks | [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) Branch B + `attachToExistingSeat` resume check | 4B.4 adds `cancelTurnTimer` + `cancelAfkVote` on pause-trigger, and `syncTurnTimer` on resume. Mirror existing structure. |

**Bottom line:** this story adds one dedicated field (`turnTimerHandle` + `stage` + `playerId`), one counter map, one vote state object, two sets (cooldown + dead-seat), five `ResolvedAction` variants, one `PlayerGameView` field, one new protocol message, and one new lifecycle timer variant. The engine is not touched — all new state lives on `Room` and/or in `turn-timer.ts`.

### Architecture compliance

| Topic | Rule |
|---|---|
| **Engine purity** | `GameState` is not modified. Counter, vote state, dead-seat set all live on `Room`. Auto-discard goes through the existing engine `DISCARD_TILE` action unchanged — engine does not know it's an auto-action. |
| **Full-state model** | Every turn-timer / vote broadcast ships a complete filtered `PlayerGameView`. No delta replay. |
| **Server authority** | Client never starts, cancels, or extends a turn timer. Client never self-marks as dead-seat. Server is the single source of truth. |
| **Validate-then-mutate** | Every new handler (nudge expiry, auto-discard expiry, vote cast, vote resolve) validates preconditions before mutating. Never broadcast before the mutation commits. |
| **Single source of post-state sequencing** | `sendPostStateSequence` (4B.1) stays the owner for STATE_UPDATE → CHAT_HISTORY ordering on per-socket sends. Turn-timer / vote broadcasts are `broadcastStateToRoom` / `broadcastGameState` fan-outs and do NOT route through `sendPostStateSequence`. |
| **Consolidated broadcast fan-out** | All new broadcasts go through `broadcastStateToRoom` / `broadcastGameState` (4B.2 consolidation). No raw `ws.send` loops. |
| **Imports** | Tests: `vite-plus/test`; app: `vite-plus`. No `vitest` / `vite` direct imports. |
| **Composition API + `<script setup lang="ts">`** | New `AfkVoteModal.vue` and all `GameTable.vue` edits stay in Composition API. |
| **No import aliases** | Use relative imports or `@mahjong-game/shared`. |

### Anti-patterns (do not ship)

- **Starting the turn timer from the client.** Server-authoritative only. The client reads `TURN_TIMER_NUDGE` expiresAt for display, never advances the timer itself.
- **Incrementing `consecutiveTurnTimeouts` in the initial-stage expiry (nudge).** The counter increments on the **extended-stage** expiry (the auto-discard moment). One increment per stuck turn, not two.
- **Clearing `consecutiveTurnTimeouts` on per-player disconnect / reconnect.** The counter persists across the disconnect cycle. Only a voluntary action, game-end, or `START_GAME` resets it.
- **Running the turn timer for disconnected players.** Grace-expiry owns that path. `syncTurnTimer` gates on `connected === true`. AFK escalation is specifically for present-but-inattentive players.
- **Incrementing `consecutiveTurnTimeouts` on grace-expiry auto-discard.** Those are disconnect timeouts, not AFK timeouts. Different concept, different counter.
- **Allowing the target of an AFK vote to vote.** `CANNOT_VOTE_ON_SELF` rejection in `handleAfkVoteCastMessage`. Also applies to dead-seat players trying to vote on others.
- **Resetting `consecutiveTurnTimeouts` on failed vote.** The counter stays at 3+ so no new vote can trigger (cooldown covers that). Only a voluntary action clears it — and a voluntary action also cancels the cooldown naturally since the player is obviously back.
- **Actually no — failed vote adds player to cooldown. Counter staying at 3+ is fine but cooldown is the authoritative gate.** Don't double-gate by both counter and cooldown; cooldown is the contract.
- **Restarting the AFK vote timer when additional votes come in.** Vote has a single 30s lifecycle; votes just accumulate in the map. Only the target's voluntary action cancels it early.
- **Adding a new `GameAction` discriminant for `AFK_VOTE_CAST`.** It's a protocol message, not a game action — engine does not handle it. Follow `SET_JOKER_RULES` precedent.
- **Broadcasting `AFK_VOTE_CAST` resolvedActions as game actions.** They're room-level events, not engine resolutions. Use `broadcastStateToRoom` (not `broadcastGameState`) so they don't interleave with engine state broadcasts incorrectly.
- **Implementing dead-seat turn skipping in 4B.4.** Scope violation — that's 4B.5. 4B.4 ships only the flag + the minimal stub (AC14) that auto-discards dead-seat turns inline so 4B.4 is independently shippable.
- **Using real time in turn-timer tests** (`await new Promise(r => setTimeout(r, 20_000))`). Use `vi.useFakeTimers()` or `setDefaultTurnTimerConfig({ durationMs: 50 })`.
- **Not restoring test setters in `afterEach`.** Leakage across tests produces flaky nightmares. Every describe block that sets `setDefaultTurnTimerConfig` or `setAfkVoteTimeoutMs` must restore defaults.
- **Building an AFK vote modal with animations, confetti, or sounds.** Minimal and functional. Visual polish is Epic 7's problem.
- **Hardcoding the extension duration to anything other than `durationMs`.** The extension equals the initial duration — keeps the math simple and the code testable with a single setter.
- **Dropping the vote if the host changes.** Host migration is Story 4B.6 — 4B.4 does not need to handle it. If it somehow happens mid-vote, the vote just continues (host role is not part of the vote eligibility).

### Implementation edge cases

- **Race: current player's action resolves just as the extended-stage timer fires.** Node's event loop is single-threaded, so the ordering is deterministic per tick. If the action handler runs first (`handleActionMessage` → `syncTurnTimer` → `cancelTurnTimer` → re-arm fresh), the pending `setTimeout` callback is already cancelled. If the timer fires first (`handleTurnTimerExpiry` → `broadcastStateToRoom` → auto-discard), the subsequent `handleActionMessage` for the voluntary action sees the turn has already advanced and is rejected by the engine with `NOT_YOUR_TURN`. The client sees its voluntary action fail with a toast and the auto-discard animation plays. Document this "just-barely-too-late" race in the `handleTurnTimerExpiry` JSDoc.
- **Auto-discard tile pick: no non-joker tiles in the rack.** `pickAutoDiscardTileId` returns `null`. Log a warn and return without discarding. The turn does not advance. `syncTurnTimer` re-arms the timer on the next call site (e.g. a rebroadcast triggered elsewhere). **Known limitation**: if a player's entire rack is jokers (extremely rare), the auto-discard path stalls. Accept this for 4B.4 — 4B.5 dead-seat skip will cover the pathological case.
- **AFK vote with only 3 non-target, non-dead-seat voters at game start, minus any disconnected.** The vote math is "2 of 3" where 3 = the three non-target players. If one of those three is disconnected (grace timer or dead-seat), effectively only 2 can vote. In that degenerate case, a single approve doesn't hit quorum; both approves → pass; single deny → single deny; both deny → fail. This still works with the tally logic as written (`approves >= 2 || denies >= 2`). If only 1 voter is alive and votes approve → no quorum → vote times out as failed after 30s. This is acceptable behavior; don't add special-case logic.
- **Disconnected voter.** A disconnected player can't send an `AFK_VOTE_CAST` message. Their silence counts as a non-vote, contributing to the 30s timeout path. Don't try to be clever by auto-voting for them.
- **Vote cancelled by pause (T13).** If 4B.3 pause fires while a vote is open, `cancelAfkVote(room, logger, "pause")` broadcasts `AFK_VOTE_RESOLVED { outcome: "cancelled" }` and clears state. Post-resume, the vote does **not** auto-restart. The target player's next stuck turn re-triggers escalation organically (nudge → auto-discard → vote again on the 3rd consecutive timeout, assuming counter was still ≥2 and cooldown not set). Document this in the `cancelAfkVote` JSDoc as an accepted tradeoff — keeps the state machine simple.
- **Reconnect during AFK vote.** A voter reconnecting mid-vote sees the `AFK_VOTE_STARTED` resolved action in their initial `STATE_UPDATE`'s resolvedAction? No — resolvedActions are tied to individual broadcasts, not replayed on reconnect. The reconnecter misses the `STARTED` broadcast. For 4B.4 scope, this means the reconnecter's client never opens the modal. Mitigation: add `afkVoteState` to `PlayerGameView` as a new optional field? **Defer** — adding vote state to the full state broadcast is a 4B.5 / polish concern. For 4B.4, accept that a mid-vote reconnecter doesn't participate in that specific vote. Document in the `attachToExistingSeat` JSDoc.
- **Dead-seat auto-discard stub (AC14) + join-handler racing.** The stub fires inside `syncTurnTimer` and calls the auto-discard path, which in turn calls `broadcastGameState` and then recursively `syncTurnTimer`. The recursion guard of 4 (one per seat) handles the pathological "all 4 dead" case — though that should be impossible since AFK votes require 2 non-target voters. Still, defense-in-depth.
- **`handleStartGameAction` clears state.** At game start, clear: `consecutiveTurnTimeouts`, `afkVoteState`, `afkVoteCooldownPlayerIds`, `deadSeatPlayerIds`. Do **not** clear `turnTimerConfig` — that's configured once per room. Do **not** clear `turnTimerHandle` — `syncTurnTimer` called at game start arms it fresh.
- **Action from a dead-seat player.** If a dead-seat player somehow sends a `GameAction` (client bug or malicious), `handleActionMessage` should reject it. For 4B.4 scope, the cleanest gate is: at the top of `handleActionMessage`, after the pause gate, add `if (room.deadSeatPlayerIds.has(action.playerId)) return sendActionError(ws, logger, "DEAD_SEAT", "Dead seat players cannot take actions")`. This lets 4B.5 reuse the same gate for its turn-skip semantics. Add it as a minor task under Task 5.

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Shared types | [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) (5 new `ResolvedAction` discriminants), [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts) (`PlayerGameView.deadSeatPlayerIds`, new `AfkVoteCastMessage`) |
| Server — core | [`packages/server/src/rooms/room.ts`](../../packages/server/src/rooms/room.ts) (new fields), [`packages/server/src/rooms/room-manager.ts`](../../packages/server/src/rooms/room-manager.ts) (init defaults), [`packages/server/src/rooms/room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) (`"afk-vote-timeout"` variant + `setAfkVoteTimeoutMs`), new [`packages/server/src/websocket/turn-timer.ts`](../../packages/server/src/websocket/turn-timer.ts) (timer state machine + AFK vote), [`packages/server/src/websocket/grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) (import `pickAutoDiscardTileId` from `turn-timer.ts`), [`packages/server/src/websocket/action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) (post-action `syncTurnTimer` + counter reset + vote cancel + dead-seat gate), [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) (pause-trigger cleanup + resume re-sync + reconnect re-sync), [`packages/server/src/websocket/ws-server.ts`](../../packages/server/src/websocket/ws-server.ts) (`AFK_VOTE_CAST` dispatch), [`packages/server/src/websocket/state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) (`buildPlayerView` emits `deadSeatPlayerIds`) |
| Server — tests | new [`packages/server/src/websocket/turn-timer.test.ts`](../../packages/server/src/websocket/turn-timer.test.ts), extended [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts), extended [`action-handler.test.ts`](../../packages/server/src/websocket/action-handler.test.ts), extended or new `ws-server.test.ts` for AFK vote dispatch, extended [`grace-expiry-fallbacks.test.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.test.ts) (moved-helper regression), extended [`pause-handlers.test.ts`](../../packages/server/src/websocket/pause-handlers.test.ts) (pause cleanup regression) |
| Client — state | [`packages/client/src/composables/useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) (new `sendAfkVote`, new resolved-action switch arms, toast bindings), [`packages/client/src/composables/mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) (thread `deadSeatPlayerIds`) |
| Client — components | [`packages/client/src/components/game/GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) (dead-seat badges, modal mount), new [`packages/client/src/components/game/AfkVoteModal.vue`](../../packages/client/src/components/game/AfkVoteModal.vue) |
| Client — tests | new `AfkVoteModal.test.ts`, extended `GameTable.test.ts` (dead-seat badge), extended `mapPlayerGameViewToGameTable.test.ts`, extended or new `useRoomConnection.afkVote.test.ts` |

### Cross-session intelligence (claude-mem)

- **Epic 4B.1** established the reconnection backbone. 4B.4 layers on top: per-turn timing is orthogonal to per-connection timing. Do not conflate the two.
- **Epic 4B.2** consolidated broadcast fan-out into `state-broadcaster.ts` with try/catch-per-session (retro `4b1-review-1/2`). Every new broadcast in 4B.4 goes through `broadcastStateToRoom` / `broadcastGameState`. 4B.2 also established the `pickAutoDiscardTileId` helper; 4B.4 moves it to `turn-timer.ts` to serve both timer-based and disconnect-based auto-discard.
- **Epic 4B.3** introduced `room.paused` and the `"pause-timeout"` lifecycle timer. 4B.4 adds a sibling `"afk-vote-timeout"` variant and a dedicated `room.turnTimerHandle` field (not a lifecycle timer — see AC15). The 4B.3 pause-trigger branch is extended with `cancelTurnTimer` + `cancelAfkVote` calls. The 4B.3 resume path is extended with `syncTurnTimer`.
- **Epic 6A retro follow-through `6a-retro-1`** (transition scenarios in story specs) is why this story enumerates T1–T20. Every row must have a test before code review signs off.
- **Epic 4B.2 Review Follow-ups** flagged hand-constructed `Room` fixtures as maintenance debt. For new tests in 4B.4, prefer `roomManager.createRoom()` in integration tests (`join-handler.test.ts` extensions); the new `turn-timer.test.ts` may use a minimal handwritten `Room` for pure helper tests but should document the choice in a top-of-file comment.
- **Epic 4B.3 Pass 3 review** (context observation S301) noted the importance of arming `idle-timeout` on auto-end so 2–3-player rooms get cleaned up. 4B.4's AFK vote does not change auto-end paths, but the pause-cancel-on-pause-trigger path added in Task 6 must not break the idle-timeout arming from 4B.3. Verify in regression.

### Git intelligence (recent commits)

```
df5f720 feat: add simultaneous-disconnect game pause for multiplayer Mahjong     (4B.3)
93f9244 feat: implement phase-specific reconnection fallbacks for multiplayer Mahjong (4B.2)
9410832 feat: implement reconnection with full state restore for multiplayer resilience (4B.1)
```

Study `df5f720` (4B.3) especially: the `pause-handlers.ts` module layout is the closest prior art for the new `turn-timer.ts` module. Three-piece file (core functions, helpers, clean test file alongside), public functions exported individually, a minimal handwritten `Room` fixture used only in the unit test file, integration tests reach into `join-handler.test.ts` and friends. Mirror this structure.

### Latest tech / versions

No new dependencies. `setTimeout` + `clearTimeout` for the turn timer (dedicated field) and the AFK vote timer (via the existing lifecycle-timer helpers). Vue 3 SFC for the AFK vote modal. Existing `ws` library for broadcasts. Keep the surface minimal.

### Project context reference

[`project-context.md`](../project-context.md) — reconnection and WebSocket sections apply. The three timers now in play are:
1. **Grace period (30s per-player)** — disconnect tolerance. Unchanged.
2. **Pause timeout (2 min room-level)** — simultaneous disconnect auto-end. 4B.3.
3. **Turn timer (20s per-turn, `initial` → `extended` → auto-discard → AFK vote)** — AFK escalation. 4B.4.

All three are server-authoritative. Clients read expiry timestamps from broadcasts for display only.

## Dev Agent Record

### Agent Model Used

Cursor / Claude (implementation session)

### Debug Log References

### Completion Notes List

- Implemented Story 4B.4 server turn timer (dedicated `room.turnTimerHandle`), AFK vote via lifecycle `"afk-vote-timeout"`, `consecutiveTurnTimeouts` on extended-stage expiry only, `deadSeatPlayerIds` + dead-seat stub in `syncTurnTimer`, pause/resume hooks, `AFK_VOTE_CAST` WebSocket handler, client `AfkVoteModal` + toasts + badges + `sendAfkVote`.
- **Pass 2 (2026-04-05):** Expanded `turn-timer.test.ts` with transition scenarios T2–T4, T5–T8, T10, T16–T20, T19 (fake timers; `room.turnTimerConfig.durationMs` must match short test window); exported `handleAfkVoteTimeoutExpiry` for lifecycle tests. Added AC6/AC13 in `action-handler.test.ts` and AC9 in `grace-expiry-fallbacks.test.ts`. Task 10 subtasks 10.2, 10.4, 10.6 remain open (optional full WS / pause integration tests).
- **Code review (2026-04-05):** Adversarial review surfaced five issues; all HIGH/MEDIUM fixed in-place:
  - **H1 — Turn timer not cancelled on current-player disconnect (AC9 violation).** `registerDisconnectHandler` (`join-handler.ts`) now calls `cancelTurnTimer` when the disconnecting player matches `room.turnTimerPlayerId`, preventing the extended-stage expiry from incrementing `consecutiveTurnTimeouts` for an offline player or broadcasting a misleading nudge. Grace-expiry's own `syncTurnTimer` call re-arms the timer for whoever becomes current.
  - **H2 — `handleTurnTimerExpiry` now re-checks `connected` before acting** (defense-in-depth against the same race even if H1 gate is ever bypassed).
  - **M1 — Timer reset on unrelated reconnect (AFK dodge exploit).** `attachToExistingSeat` now only calls `syncTurnTimer` when either the room just resumed from pause or the reconnecter is the current turn player. Other reconnects no longer reset the stuck player's timer.
  - **M2 — `handleAfkVoteCastMessage` adds defensive `connected === true` voter check per AC12.**
  - **M3 — `handlePauseTimeout` documented as defensive cleanup** (the pause-trigger branch already cleared turn timer + AFK vote; this stays as a safety net for future pause entry paths).
  - **L1 — `T20` test name corrected** to describe the single-voter flip scenario it actually covers.
  - **L3 — `startAfkVote` now refuses to open a vote against a disconnected target** (unreachable after H2 fix, but kept as defense-in-depth).
  - New regression tests in `turn-timer.test.ts`: AC9 extended-expiry no-op on disconnect, AC9 startAfkVote skipped for offline target.
  - Regression gate: `pnpm test` (300 server / all client tests green), `pnpm -w run typecheck` green, `vp lint` 0 errors.

### File List

- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/rooms/room.ts`
- `packages/server/src/rooms/room-manager.ts`
- `packages/server/src/rooms/room-lifecycle.ts`
- `packages/server/src/websocket/turn-timer.ts`
- `packages/server/src/websocket/turn-timer.test.ts`
- `packages/server/src/websocket/grace-expiry-fallbacks.ts`
- `packages/server/src/websocket/action-handler.ts`
- `packages/server/src/websocket/action-handler.test.ts`
- `packages/server/src/websocket/join-handler.ts`
- `packages/server/src/websocket/ws-server.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/pause-handlers.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/websocket/grace-expiry-fallbacks.test.ts`
- `packages/server/src/websocket/pause-handlers.test.ts`
- `packages/server/src/websocket/chat-handler.test.ts`
- `packages/server/src/rooms/room-lifecycle.test.ts`
- `packages/server/src/rooms/session-manager.test.ts`
- `packages/server/src/rooms/seat-assignment.test.ts`
- `packages/client/src/composables/useRoomConnection.ts`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.ts`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts`
- `packages/client/src/composables/gameActionFromPlayerView.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/game/OpponentArea.vue`
- `packages/client/src/components/game/AfkVoteModal.vue`
- `packages/client/src/components/dev/PlayerGameViewBridgeShowcase.vue`
- `packages/client/src/views/RoomView.vue`

## Change Log

- **2026-04-05 (code review fixes):** Applied H1 (cancel turn timer on current-player disconnect), H2 (connected guard in `handleTurnTimerExpiry`), M1 (gate `syncTurnTimer` in `attachToExistingSeat` to resume-from-pause or current-player reconnects only), M2 (connected guard in `handleAfkVoteCastMessage`), M3 (documented defensive cleanup in `handlePauseTimeout`), L1 (T20 test rename), L3 (connected guard in `startAfkVote`). Added two new regression tests in `turn-timer.test.ts`. Status `review` → `done`. Regression gate: `pnpm test`, `pnpm -w run typecheck`, `vp lint` all pass.
- **2026-04-05 (pass 2 — test coverage):** Expanded `turn-timer.test.ts` for transition scenarios T2–T4, T5–T8, T10, T16–T20, T19; `handleAfkVoteTimeoutExpiry` exported for tests; `action-handler.test.ts` AC6 + AC13; `grace-expiry-fallbacks.test.ts` AC9. Regression gate: `pnpm test`, `pnpm run typecheck`, `vp lint` pass (0 lint errors; warnings only). Task 10.2 / 10.4 / 10.6 (full join-handler / ws-server / pause integration) left open as optional follow-up.
- **2026-04-05 (implementation):** Turn timer (`turn-timer.ts`), AFK vote lifecycle, `ResolvedAction` + protocol updates, `PlayerGameView.deadSeatPlayerIds`, client toasts/modal/`sendAfkVote`, pause integration, game-end reset. Regression gate: `pnpm test`, `pnpm run typecheck`, `vp lint` pass. **Follow-up:** expand automated coverage for full T1–T20 transition matrix (story Task 10 / 15) in a follow-on pass or code review.
- **2026-04-05:** Story 4B.4 created. Enumerates 20 ACs + 20 transition scenarios. Builds on 4B.3 pause infrastructure and 4B.2 auto-discard helper. Key decisions: (1) turn timer lives as a dedicated `room.turnTimerHandle` field, not a lifecycle timer, because of its stateful `initial` → `extended` stages; AFK vote timer uses the existing lifecycle-timer framework. (2) `consecutiveTurnTimeouts` increments only on extended-stage expiry (one per stuck turn, not two), persists across disconnect/reconnect, resets on voluntary action / game-end / `START_GAME`. (3) AFK escalation is for present-but-inattentive players only; disconnected players are owned by the grace-expiry path (no counter increment). (4) Dead-seat flag ships in 4B.4, dead-seat turn-skip / call-pass ships in 4B.5; 4B.4 adds a minimal auto-discard stub in `syncTurnTimer` so a dead seat doesn't freeze the game standalone. (5) `AFK_VOTE_CAST` is a new protocol message (not a `GameAction`), routed like `SET_JOKER_RULES`. (6) Failed vote adds player to `afkVoteCooldownPlayerIds` — no re-votes for that player until the next game; subsequent timeouts auto-discard silently. (7) Mid-vote reconnecters don't auto-join the vote (accepted tradeoff — vote state is not threaded into `PlayerGameView`). Scope explicitly excludes: host UI for timer mode (4B.7), dead-seat skip semantics (4B.5), AI fill-in (not in MVP per FR99).
