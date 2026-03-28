# Story 3A.7: Mahjong Declaration & Auto-Validation

Status: done

## Story

As a **developer**,
I want **players to declare Mahjong either from a discard (during call window) or from a self-drawn tile (before discarding), with auto-validation against the NMJL card before revealing to other players**,
So that **the climactic moment of the game is correctly validated and both win paths work (FR64, FR65, FR69)**.

## Acceptance Criteria

1. **Given** an open call window **When** a player dispatches `CALL_MAHJONG` **Then** the call is recorded with type `mahjong` and takes priority over all other calls in the buffer (FR21)

2. **Given** it is a player's turn and they have drawn a tile that completes their hand **When** the player dispatches `DECLARE_MAHJONG` before discarding **Then** auto-validation runs against the NMJL card data using the pattern matcher from Epic 2

3. **Given** the player's 14 tiles match a valid hand pattern on the card **When** auto-validation succeeds **Then** the game transitions to `gamePhase: 'scoreboard'`, the winning hand and pattern are recorded in `gameResult`, scoring is calculated per Story 2.6, and a `MAHJONG_DECLARED` resolved action is emitted with winner ID, pattern name, points, selfDrawn flag, and discarder ID (if applicable)

4. **Given** a discard Mahjong (from calling another player's discard) **When** scoring is calculated **Then** the discarder pays 2x, other losers pay 1x (FR71)

5. **Given** a self-drawn Mahjong (from the wall) **When** scoring is calculated **Then** all 3 losers pay 2x (FR72)

6. **Given** the auto-validation fails (hand does not match any card pattern) **When** the result is returned **Then** the action is rejected with reason `INVALID_HAND` — the declaring player is privately notified, no game state change occurs (Story 3a-8 will add the cancel/confirm UX on top of this)

7. **Given** the Mahjong button **When** checking its availability **Then** it is always available to the player — never disabled or hidden (FR64). The server validates; the client always allows the attempt.

## Tasks / Subtasks

- [x] Task 1: Add action types (AC: #1, #2)
  - [x] Add `CallMahjongAction` to `actions.ts` — `type: "CALL_MAHJONG"`, `playerId`, `tileIds` (rack tiles forming the hand, excluding the called discard)
  - [x] Add `DeclareMahjongAction` to `actions.ts` — `type: "DECLARE_MAHJONG"`, `playerId` (self-drawn, no tileIds needed — full rack is validated)
  - [x] Add both to `GameAction` union
  - [x] Add `MAHJONG_DECLARED` to `ResolvedAction` union — `winnerId`, `patternId`, `patternName`, `points`, `selfDrawn`, `discarderId?`
  - [x] Export new types from `index.ts`

- [x] Task 2: Implement `handleCallMahjong` in call-window.ts (AC: #1)
  - [x] Validate: `gamePhase === "play"`, call window is open or frozen, player is not the discarder
  - [x] Record call with `callType: "mahjong"` in `callWindow.calls[]`
  - [x] Freeze call window (same pattern as existing `handleCallAction`)
  - [x] Return `{ accepted: true, resolved: { type: "CALL_MAHJONG", playerId } }`
  - [x] NOTE: Validation of the actual hand happens at confirmation time (Task 4), NOT at call time — this matches existing call pattern where group validity is checked at CONFIRM_CALL, not at call submission

- [x] Task 3: Implement `handleDeclareMahjong` in new file `mahjong.ts` (AC: #2, #3, #5, #6)
  - [x] Validate: `gamePhase === "play"`, `currentTurn === action.playerId`, `turnPhase === "discard"` (player has already drawn)
  - [x] Build full tile set: `player.rack` (14 tiles after draw)
  - [x] Call `validateHandWithExposure(allTiles, player.exposedGroups, card)` — card must be loaded into game state or accessible
  - [x] If match is null: return `{ accepted: false, reason: "INVALID_HAND" }` (AC #6)
  - [x] If match found: calculate payments via `calculatePayments({ winnerId, allPlayerIds, points: match.points, selfDrawn: true })`
  - [x] Set `state.gamePhase = "scoreboard"`, populate `state.gameResult` as `MahjongGameResult`
  - [x] Update `state.scores` with payment amounts
  - [x] Return resolved `MAHJONG_DECLARED` with `selfDrawn: true`

- [x] Task 4: Handle Mahjong confirmation in `handleConfirmCall` (AC: #1, #3, #4, #6)
  - [x] Update the TODO at call-window.ts:670 — when `winningCall.callType === "mahjong"`:
  - [x] Build full tile set: caller's rack tiles + the called discard tile = 14 tiles
  - [x] Call `validateHandWithExposure(allTiles, player.exposedGroups, card)`
  - [x] If invalid: reject confirmation, emit `CALL_RETRACTED` with reason `"INVALID_HAND"`, promote next caller or reopen window (same as existing retraction flow)
  - [x] If valid: calculate payments via `calculatePayments({ winnerId, allPlayerIds, points, selfDrawn: false, discarderId: callWindow.discarderId })`
  - [x] Set `state.gamePhase = "scoreboard"`, populate `state.gameResult` as `MahjongGameResult`
  - [x] Remove the called tile from the discarder's discard pool
  - [x] Update `state.scores` with payment amounts
  - [x] Return resolved `MAHJONG_DECLARED` with `selfDrawn: false, discarderId`

- [x] Task 5: Wire into game-engine.ts dispatcher (AC: all)
  - [x] Add `case "CALL_MAHJONG"` → route to dedicated `handleCallMahjong`
  - [x] Add `case "DECLARE_MAHJONG"` → route to `handleDeclareMahjong(state, action)`
  - [x] Update exhaustive switch — TypeScript will enforce this
  - [x] Export new handlers and constants from `index.ts`

- [x] Task 6: NMJL card access in game state (AC: #2, #3)
  - [x] Chose Option A: Added `card: NMJLCard | null` to `GameState` (set at game start via `createGame`)
  - [x] `createGame` now calls `loadCard("2026")` and stores the card on `GameState`
  - [x] `createLobbyState` sets `card: null`

- [x] Task 7: Comprehensive tests (AC: all)
  - [x] Self-drawn Mahjong happy path: draw tile, hand matches, game ends with scoreboard
  - [x] Discard Mahjong happy path: call mahjong during call window, confirm, hand matches, game ends
  - [x] Mahjong priority over other calls: pung + mahjong in buffer → mahjong wins
  - [x] Multiple Mahjong calls: seat distance tie-breaking
  - [x] Invalid self-drawn Mahjong: hand doesn't match → rejected, play continues
  - [x] Invalid discard Mahjong at confirmation: hand doesn't match → auto-retraction, next caller promoted or window reopens
  - [x] Scoring: discard Mahjong → discarder pays 2x, others 1x
  - [x] Scoring: self-drawn Mahjong → all losers pay 2x
  - [x] State transition: `gamePhase` goes to `"scoreboard"`, `gameResult` populated correctly
  - [x] Wrong phase rejections: declare during lobby, during call window, without drawing first
  - [x] Call mahjong when no call window open → rejected
  - [x] Call mahjong as the discarder → rejected
  - [x] Zero-mutation-on-rejection: verify state unchanged after rejected mahjong attempts

- [x] Task 8: Regression verification
  - [x] Run full test suite (`pnpm -r test`): 559 tests pass (537+1+21), 0 failures
  - [x] Typecheck passes (`tsc --noEmit`), lint passes (no new errors)
  - [x] Verify existing call window tests still pass (pung/kong/quint/news/dragon_set unchanged)
  - [x] Verify existing scoring tests still pass

## Dev Notes

### Two Mahjong Paths

This story implements two distinct paths to Mahjong:

1. **Self-drawn Mahjong (`DECLARE_MAHJONG`):** Player draws from wall, hand completes a pattern, player declares before discarding. This bypasses the call window entirely. Validation uses `validateHandWithExposure(rack, exposedGroups, card)` where rack has 14 tiles (13 + drawn tile).

2. **Discard Mahjong (`CALL_MAHJONG`):** During an open call window, player calls mahjong on the discarded tile. Goes through call priority resolution (mahjong beats all other calls per FR21). At confirmation, the full hand (13 rack tiles + called discard = 14) is validated. This uses the existing call→freeze→confirm flow from Stories 3a-4/3a-5.

### Architecture Compliance

- **Validate-then-mutate:** All validation before any mutation. Zero partial mutations on rejection.
- **Action handler pattern:** validate → mutate → log → return `ActionResult`. Follow `handleConfirmCall` and `handleDiscardTile` as templates.
- **Discriminated unions:** Extend `GameAction` and `ResolvedAction` with new variants. The `default: never` exhaustive check in `game-engine.ts:61` will enforce all cases are handled.
- **Pure functions in shared/:** No `console.*`, no browser/Node APIs. Logger injected if needed.
- **Server authority:** Client always allows Mahjong button (FR64). Server validates. No optimistic updates.
- **No setTimeout in shared/:** Timer scheduling is the server's job.

### Key Dependencies — Existing Code to Use (NOT Reinvent)

| Need | Use This | File |
|------|----------|------|
| Hand validation | `validateHandWithExposure(tiles, exposedGroups, card)` | `card/exposure-validation.ts:125` |
| Match result type | `MatchResult { patternId, patternName, points }` | `card/pattern-matcher.ts:5` |
| Payment calculation | `calculatePayments({ winnerId, allPlayerIds, points, selfDrawn, discarderId })` | `engine/scoring.ts:22` |
| Game result type | `MahjongGameResult` (already defined) | `types/game-state.ts:48` |
| Wall game result | `WallGameResult` (already defined) | `types/game-state.ts:39` |
| Call priority resolution | `resolveCallPriority()` — mahjong already has highest priority (priority 0) | `engine/actions/call-window.ts:337` |
| Call window freeze | `handleCallAction()` — existing freeze-on-first-call logic | `engine/actions/call-window.ts:166` |
| Confirmation flow | `handleConfirmCall()` — has TODO at line 670 for mahjong path | `engine/actions/call-window.ts:592` |
| Retraction flow | `handleRetraction()` — reuse for invalid mahjong auto-retraction | `engine/actions/call-window.ts:530` |
| Card loading | `loadCard()` | `card/card-loader.ts` |
| Exposed group types | `ExposedGroup`, `GroupIdentity` | `types/game-state.ts:22-27` |

### CRITICAL: `validateHandWithExposure` Expects 14 Tiles

The `validateHandWithExposure` function checks `tiles.length !== 14` and returns null if not 14. The `tiles` parameter is the FULL hand (rack tiles), NOT rack + exposed groups. Exposed groups are passed separately.

- **Self-drawn:** Player's rack has 14 tiles after drawing (13 + drawn tile). Pass `player.rack` directly.
- **Discard Mahjong:** Player's rack has 13 tiles + called discard = 14. Build the combined array: `[...player.rack, calledDiscardTile]`.

### CRITICAL: NMJL Card Must Be Accessible to Action Handlers

The `handleAction` function in `game-engine.ts` only receives `(state, action)`. The NMJL card data is needed for `validateHandWithExposure`. Options:

1. **Add `card: NMJLCard` to `GameState`** — simplest, set in `createGame()`. The card is immutable once loaded.
2. **Pass as extra parameter** — requires changing handler signatures.

Check `createGame` in `engine/state/create-game.ts` to see if it already loads a card. If yes, store it on `GameState`. If not, add card loading there.

### Existing TODO in call-window.ts

At line 668-670, the `handleConfirmCall` function already has a branch for mahjong:
```typescript
if (winningCall.callType === "mahjong") {
  // Mahjong confirmation — don't set to discard phase; story 3a-7 handles this
  // TODO: Story 3a-7 will handle Mahjong declaration validation flow
  state.currentTurn = callerId;
}
```
Replace this TODO with the full Mahjong validation, scoring, and game-end logic.

### Call Priority — Already Handled

`resolveCallPriority` already sorts mahjong calls to highest priority (priority 0). Multiple mahjong calls are tie-broken by seat distance (closest counterclockwise from discarder). No changes needed to priority resolution.

### Forward Compatibility (Story 3a-8)

Story 3a-8 will add:
- Private warning for invalid declarations (instead of just rejecting)
- Cancel/Confirm options after invalid warning
- Dead hand enforcement on confirmed invalid declaration
- Challenge mechanism for validated declarations

For now, this story simply **rejects** invalid declarations with `reason: "INVALID_HAND"`. Story 3a-8 will wrap this with the cancel/confirm UX. Design the rejection path so 3a-8 can extend it without refactoring.

### Test Helpers to Reuse

- `createPlayState(seed?)` / `createGame()` — game state factory
- `getPlayerBySeat(state, seat)` — find player by seat wind
- `getNonDiscarders(state)` — get non-discarding player IDs
- `injectTilesIntoRack(state, playerId, tiles)` — set specific tiles in a player's rack
- `setupCallScenario` / `setupPatternCallScenario` — set up call window scenarios
- `buildHand(tileIds)` — construct tile arrays from IDs
- `TEST_PLAYER_IDS`, `TEST_SEED` (42) — standard test constants
- Use `vi.useFakeTimers()` for timer-dependent scenarios

### Testing Strategy: Building Valid Hands

To test Mahjong declaration, you need to construct hands that actually match NMJL card patterns. Approaches:
1. Load the real 2026 card data and pick a simple pattern (low group count)
2. Use `injectTilesIntoRack` to set exactly the right tiles
3. Verify with `validateHandWithExposure` directly in a sanity test before using in integration tests
4. For invalid hand tests: use random tiles that deliberately don't match any pattern

### Project Structure Notes

- New file: `packages/shared/src/engine/actions/mahjong.ts` + `mahjong.test.ts`
- Modified files: `types/actions.ts`, `types/game-state.ts` (if adding card field), `engine/game-engine.ts`, `engine/actions/call-window.ts`, `index.ts`
- All changes in `packages/shared/src/` — pure game logic, no client/server changes
- Co-locate tests next to source: `mahjong.ts` → `mahjong.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3A, Story 3A.7 lines 1248-1279]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Game State Machine, Call Window Protocol, Pattern Matching Algorithm]
- [Source: packages/shared/src/types/game-state.ts — GameState, MahjongGameResult, CallType, ResolvedAction]
- [Source: packages/shared/src/types/actions.ts — GameAction union]
- [Source: packages/shared/src/card/exposure-validation.ts:125 — validateHandWithExposure]
- [Source: packages/shared/src/card/pattern-matcher.ts:5 — MatchResult interface]
- [Source: packages/shared/src/engine/scoring.ts — calculatePayments, ScoringResult]
- [Source: packages/shared/src/engine/actions/call-window.ts:668-670 — TODO for mahjong confirmation]
- [Source: packages/shared/src/engine/game-engine.ts — handleAction dispatcher, exhaustive switch]
- [Source: _bmad-output/implementation-artifacts/3a-6-turn-advancement-after-calls-skip-ahead.md — Previous story intelligence]
- [Source: _bmad-output/project-context.md — Technology stack and project rules]

## Previous Story Intelligence (3a-6)

- **No code changes were needed** for 3a-6 — skip-ahead behavior worked via existing implementation chain. 11 integration tests were added.
- **Total tests at completion:** 525 across 3 packages
- **Key test helpers extracted:** `getNonDiscarders`, `injectTilesIntoRack` moved to shared testing helpers
- **Code review fixes applied:** Shared helper extraction, misleading test name fix, timer boilerplate cleanup
- **Pattern established:** Integration tests trace full multi-step flows (discard → call → confirm → discard → close → assert)
- **Gotcha from 3a-6:** `fromPlayerId` in `CALL_CONFIRMED` is for client animation only, not for turn advancement logic

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- Implemented two distinct Mahjong paths: self-drawn (`DECLARE_MAHJONG`) and discard (`CALL_MAHJONG` + `CONFIRM_CALL`)
- Added `card: NMJLCard | null` to `GameState` — `createGame` now loads the 2026 card via `loadCard("2026")`
- `handleCallMahjong` is a dedicated handler (not routed through `handleCallAction`) because mahjong calls skip tile validation at call time
- Restructured `handleConfirmCall` to branch early for mahjong calls — mahjong path skips exposed group creation and delegates to `confirmMahjongCall`
- Invalid mahjong at confirmation triggers the existing retraction flow (promote next caller or reopen window)
- 34 tests covering both paths, scoring, priority, rejections, exposed groups, and zero-mutation guarantees
- Total test count: 559 (up from 525)

### Change Log

- 2026-03-28: [Code Review Fix] Fixed tile array construction in `handleDeclareMahjong` and `confirmMahjongCall` to include exposed group tiles when calling `validateHandWithExposure`. Without this fix, players with any exposed groups could never declare Mahjong. Added 2 tests covering exposed-group scenarios for both self-drawn and discard Mahjong paths. Total tests: 34.
- 2026-03-28: Implemented Mahjong declaration and auto-validation (Story 3A.7). Added `CallMahjongAction`, `DeclareMahjongAction`, `MAHJONG_DECLARED` resolved action. Created `mahjong.ts` with `handleDeclareMahjong` and `confirmMahjongCall`. Added `handleCallMahjong` to `call-window.ts`. Updated `handleConfirmCall` for mahjong confirmation path. Added `card: NMJLCard | null` to `GameState`, loaded in `createGame`. Wired both actions into game engine dispatcher. 32 comprehensive tests added.

### File List

- packages/shared/src/types/actions.ts (modified) — added CallMahjongAction, DeclareMahjongAction, updated GameAction union
- packages/shared/src/types/game-state.ts (modified) — added card field to GameState, CALL_MAHJONG and MAHJONG_DECLARED to ResolvedAction
- packages/shared/src/engine/actions/mahjong.ts (new) — handleDeclareMahjong, confirmMahjongCall
- packages/shared/src/engine/actions/mahjong.test.ts (new) — 32 comprehensive tests
- packages/shared/src/engine/actions/call-window.ts (modified) — added handleCallMahjong, updated handleConfirmCall for mahjong path
- packages/shared/src/engine/game-engine.ts (modified) — added CALL_MAHJONG and DECLARE_MAHJONG dispatcher cases, card: null in createLobbyState
- packages/shared/src/engine/state/create-game.ts (modified) — loads card via loadCard("2026")
- packages/shared/src/index.ts (modified) — exports new types and handlers
