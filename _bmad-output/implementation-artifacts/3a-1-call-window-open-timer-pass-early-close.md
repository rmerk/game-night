# Story 3A.1: Call Window — Open, Timer, Pass & Early Close

Status: done

## Story

As a **developer**,
I want **a call window that opens after each discard with a configurable timer, allows players to pass, and closes early when all players have passed**,
So that **other players have a fair, timed opportunity to claim each discarded tile (FR19, FR20)**.

## Acceptance Criteria (BDD)

1. **Call window opens after discard:**
   - **Given** a player discards a tile
   - **When** the discard action resolves
   - **Then** a call window opens with state `callWindow: { discardedTileId, discarderId, status: 'open', remainingMs, passes: [discarderId] }` and the discarder is auto-marked as passed

2. **Timer expires with no calls:**
   - **Given** an open call window
   - **When** the configurable timer (default 5s, range 3-5s from host settings) expires with no calls
   - **Then** the call window closes (`callWindow` set to `null`), no call is resolved, and the next player in turn order draws from the wall

3. **All players pass closes early:**
   - **Given** an open call window with 3 non-discarder players
   - **When** all 3 players dispatch `PASS_CALL`
   - **Then** the call window closes immediately without waiting for the timer

4. **Discarder cannot call:**
   - **Given** a player who is the discarder
   - **When** they attempt to dispatch `PASS_CALL` or any call action
   - **Then** `{ accepted: false, reason: 'DISCARDER_CANNOT_CALL' }` is returned

5. **Already passed validation:**
   - **Given** a player who already passed
   - **When** they attempt to pass again
   - **Then** `{ accepted: false, reason: 'ALREADY_PASSED' }` is returned

6. **No window validation:**
   - **Given** no call window is open (`callWindow` is `null`)
   - **When** a player dispatches `PASS_CALL`
   - **Then** `{ accepted: false, reason: 'NO_CALL_WINDOW' }` is returned

7. **Wrong phase validation:**
   - **Given** the game is not in `play` phase
   - **When** a player dispatches `PASS_CALL`
   - **Then** `{ accepted: false, reason: 'WRONG_PHASE' }` is returned

8. **Call window only opens during play phase:**
   - **Given** a game not in `play` phase
   - **When** any state transition occurs
   - **Then** no call window is opened

## Tasks / Subtasks

- [x] Task 1: Define `CallWindowState` interface and `PassCallAction` type (AC: #1, #4, #6)
  - [x] 1.1 Add `CallWindowState` to `types/game-state.ts` — replace `callWindow: null` with `callWindow: CallWindowState | null`
  - [x] 1.2 Add `PassCallAction` to `types/actions.ts` and extend `GameAction` union
  - [x] 1.3 Add `CALL_WINDOW_OPENED` and `CALL_WINDOW_CLOSED` to `ResolvedAction` union
  - [x] 1.4 Add `PASS_CALL` to `ResolvedAction` union (for tracking who passed)
  - [x] 1.5 Add call window constants to `constants.ts`: `DEFAULT_CALL_WINDOW_MS`, `MIN_CALL_WINDOW_MS`, `MAX_CALL_WINDOW_MS`
- [x] Task 2: Implement `handlePassCall` action handler (AC: #3, #4, #5, #6, #7)
  - [x] 2.1 Create `engine/actions/call-window.ts` with `handlePassCall`
  - [x] 2.2 Follow validate-then-mutate: check phase, check callWindow exists, check callWindow.status === 'open', check not discarder, check not already passed
  - [x] 2.3 Mutate: push playerId to `callWindow.passes`
  - [x] 2.4 Early close detection: if `passes.length === 4` (all players including auto-passed discarder), close the window — set `callWindow = null`, set `turnPhase = 'draw'`, advance to next player
  - [x] 2.5 Return appropriate `ResolvedAction`
- [x] Task 3: Modify `handleDiscardTile` to open call window (AC: #1)
  - [x] 3.1 After discard mutation, instead of calling `advanceTurn(state)` unconditionally, open the call window
  - [x] 3.2 Set `state.turnPhase = 'callWindow'`
  - [x] 3.3 Set `state.callWindow = { status: 'open', discardedTile, discarderId, passes: [discarderId], calls: [], openedAt: Date.now() }`
  - [x] 3.4 Do NOT call `advanceTurn` — the call window must resolve first (next turn advancement happens when window closes)
  - [x] 3.5 Wall depletion check: if wall is empty after discard, STILL open call window (last discard can be called per GDD rules)
- [x] Task 4: Implement call window close/expiry logic (AC: #2)
  - [x] 4.1 Create `closeCallWindow(state)` helper in `call-window.ts`
  - [x] 4.2 On close: set `callWindow = null`, advance turn to next player counterclockwise from discarder, set `turnPhase = 'draw'`
  - [x] 4.3 Special case: if wall is empty AND window closes with no calls, end game as wall game
  - [x] 4.4 Timer expiry is server-side only (not in shared/) — add a note for server integration
- [x] Task 5: Register `PASS_CALL` in the game engine dispatcher (AC: all)
  - [x] 5.1 Add `PASS_CALL` case to `handleAction` switch in `game-engine.ts`
  - [x] 5.2 Ensure exhaustive check still works with new action type
- [x] Task 6: Write comprehensive tests (AC: all)
  - [x] 6.1 Create `engine/actions/call-window.test.ts`
  - [x] 6.2 Test: discard opens call window with correct initial state
  - [x] 6.3 Test: discarder is auto-passed in `callWindow.passes`
  - [x] 6.4 Test: PASS_CALL accepted for non-discarder, adds to passes
  - [x] 6.5 Test: PASS_CALL rejected for discarder → `DISCARDER_CANNOT_CALL`
  - [x] 6.6 Test: PASS_CALL rejected for already-passed player → `ALREADY_PASSED`
  - [x] 6.7 Test: PASS_CALL rejected when no call window → `NO_CALL_WINDOW`
  - [x] 6.8 Test: PASS_CALL rejected when wrong phase → `WRONG_PHASE`
  - [x] 6.9 Test: all 3 non-discarders pass → call window closes, turn advances
  - [x] 6.10 Test: partial passes (1 of 3, 2 of 3) → call window remains open
  - [x] 6.11 Test: call window close advances to next player counterclockwise from discarder
  - [x] 6.12 Test: wall empty + all pass → wall game ends
  - [x] 6.13 Test: discard no longer calls advanceTurn directly (regression)
  - [x] 6.14 Test: `closeCallWindow` resets `callWindow` to `null`
- [x] Task 7: Update barrel exports
  - [x] 7.1 Export new types from `index.ts`
  - [x] 7.2 Export `handlePassCall`, `closeCallWindow` from `index.ts`
  - [x] 7.3 Run `pnpm -r test` and `pnpm run typecheck` to verify zero regressions

## Dev Notes

### Architecture & Pattern Compliance

**Validate-then-mutate pattern is mandatory.** Every action handler must follow: validate (read-only) → mutate (only if valid) → return `ActionResult`. See existing handlers `handleDrawTile` and `handleDiscardTile` for exact pattern.

**Discriminated union results.** Follow the `{ accepted: true, resolved: ... } | { accepted: false, reason: '...' }` pattern established in Epic 2. Never throw exceptions for game rule violations.

**Shared package rules apply.** No `console.*` (use Logger interface if needed), no browser APIs, no Node APIs, no `setTimeout`. Timer logic lives in server/, not shared/. The shared engine only tracks state — it does not manage real-time timers.

### Critical Implementation Details

**Discard handler modification (BREAKING CHANGE from Epic 1):**
The current `handleDiscardTile` in `packages/shared/src/engine/actions/discard.ts` calls `advanceTurn(state)` at line 38. This MUST change:
- Remove the `advanceTurn(state)` call
- Instead, open the call window: set `turnPhase = 'callWindow'` and populate `callWindow`
- Turn advancement now happens when the call window closes (via `closeCallWindow`)
- **Wall depletion special case**: Current code at lines 41-48 ends the game on wall depletion after discard. This needs adjustment — per GDD, the last discard CAN be called. Open the call window even if the wall is empty. Only end as wall game when the call window closes with no calls AND the wall is empty.

**This is the most important regression risk in this story.** Existing tests for discard/turn advancement will break and must be updated to account for the call window phase.

**Call window state shape:**
```typescript
interface CallWindowState {
  readonly status: 'open';  // Story 3A.4 adds 'frozen', Story 3A.5 adds 'confirming'
  readonly discardedTile: Tile;
  readonly discarderId: string;
  readonly passes: string[];  // Player IDs who passed (includes discarder)
  readonly calls: never[];    // Empty array — populated in Story 3A.2
  readonly openedAt: number;  // Date.now() timestamp for server timer reference
}
```

**Why `calls: never[]`?** This story doesn't implement call actions (Story 3A.2 does). Using `never[]` prevents accidental use while reserving the field. Story 3A.2 will widen this to `CallRecord[]`.

**Early close detection:**
After each `PASS_CALL`, check if `callWindow.passes.length === 4` (MAX_PLAYERS). All 4 players must be in the passes array (discarder is auto-added on open, 3 non-discarders pass manually). When all 4 have passed, call `closeCallWindow(state)`.

**Turn advancement after close:**
`closeCallWindow` must advance to the next player counterclockwise from the **discarder** (not from `currentTurn`). Use the same seat-order logic as `advanceTurn` in `draw.ts` (line 42-53), but reference the discarder's seat. Note: in Story 3A.6, after a successful call, turn advances from the *caller's* seat — but that's a different story.

**Timer is NOT in shared/:**
The shared engine tracks `openedAt` so the server can compute remaining time. The actual `setTimeout` for timer expiry lives in server/ (using `GameTimer` class pattern described in architecture). When the server timer fires, it calls `closeCallWindow(state)` from shared/. This story only builds the shared/ logic — the server timer wiring is done in Epic 4A (Story 4A.5).

### Constants to Add

```typescript
// constants.ts
export const DEFAULT_CALL_WINDOW_MS = 5000;
export const MIN_CALL_WINDOW_MS = 3000;
export const MAX_CALL_WINDOW_MS = 5000;
```

### New Action Type

```typescript
// actions.ts — add to GameAction union
export interface PassCallAction {
  readonly type: "PASS_CALL";
  readonly playerId: string;
}
```

### ResolvedAction Extensions

```typescript
// game-state.ts — add to ResolvedAction union
| { readonly type: "CALL_WINDOW_OPENED"; readonly discarderId: string; readonly discardedTileId: string }
| { readonly type: "CALL_WINDOW_CLOSED"; readonly reason: 'all_passed' | 'timer_expired' }
| { readonly type: "PASS_CALL"; readonly playerId: string }
```

### File Structure

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/types/game-state.ts` | MODIFY | Add `CallWindowState`, update `callWindow` type, extend `ResolvedAction` |
| `packages/shared/src/types/actions.ts` | MODIFY | Add `PassCallAction`, extend `GameAction` union |
| `packages/shared/src/constants.ts` | MODIFY | Add call window timing constants |
| `packages/shared/src/engine/actions/call-window.ts` | CREATE | `handlePassCall`, `closeCallWindow` |
| `packages/shared/src/engine/actions/call-window.test.ts` | CREATE | Comprehensive test suite |
| `packages/shared/src/engine/actions/discard.ts` | MODIFY | Open call window instead of advancing turn |
| `packages/shared/src/engine/actions/discard.test.ts` | MODIFY | Update tests for call window behavior |
| `packages/shared/src/engine/game-engine.ts` | MODIFY | Add `PASS_CALL` to dispatcher switch |
| `packages/shared/src/index.ts` | MODIFY | Export new types and functions |

### Testing Strategy

**Framework:** Vitest (co-located tests). Use `vi.useFakeTimers()` if any `Date.now()` dependency matters.

**Test helper usage:**
- Use `createTestState()` from `testing/helpers.ts` to get a full game state with 4 players
- Use `handleAction(state, { type: 'START_GAME', playerIds: TEST_PLAYER_IDS })` then manually progress to discard phase
- Use `handleAction(state, { type: 'DISCARD_TILE', playerId, tileId })` to trigger call window open

**Multi-step test pattern (established in Epic 1):**
```typescript
// Setup: start game, draw, discard to trigger call window
const state = createLobbyState();
handleAction(state, { type: 'START_GAME', playerIds: TEST_PLAYER_IDS });
// East has 14 tiles, skips draw, goes straight to discard
const eastPlayer = getPlayerBySeat(state, 'east');
const tileToDiscard = eastPlayer.rack[0];
handleAction(state, { type: 'DISCARD_TILE', playerId: eastPlayer.id, tileId: tileToDiscard.id });
// Now callWindow should be open
expect(state.callWindow).not.toBeNull();
expect(state.turnPhase).toBe('callWindow');
```

**Regression tests to update:**
The existing `discard.test.ts` tests expect `advanceTurn` to be called after discard. These must be updated to expect `turnPhase === 'callWindow'` instead. The `advanceTurn` behavior now happens on call window close.

### Previous Story Intelligence

**From Story 2-6 (Scoring & Payment Calculation):**
- Discriminated union result pattern works well — apply same for `CallWindowState` status and `ActionResult`
- `buildTilesForHand` in `testing/tile-builders.ts` available for building test scenarios
- TDD methodology: write red tests first, then implement
- Code review found return type improvements — consider actionable rejection reasons from the start

**From Epic 2 Retrospective:**
- **Action item:** Extend test helpers for multi-step action sequences — `createTestState` needs to support discard → call window → pass flows. Consider adding `advanceToCallWindow(state)` test helper.
- **Action item:** Validate `vi.useFakeTimers()` works — this is the first timer-dependent story. Test `Date.now()` usage in `openedAt`.
- **Action item:** 7+ new action types coming in Epic 3A — extend `GameAction` and `ResolvedAction` unions cleanly. Plan for `PASS_CALL` now; Stories 3A.2-3A.8 will add `CALL_PUNG`, `CALL_KONG`, `CALL_QUINT`, `CALL_MAHJONG`, `CONFIRM_CALL`, `RETRACT_CALL`, etc.

### Git Intelligence

**Recent commit patterns:**
- Convention: `feat(shared): <description>` for features
- All changes in Epic 2 were in `packages/shared/src/`
- 375 passing tests as baseline — zero regressions expected
- Test count will grow significantly with call window tests

**Backpressure gate:** `pnpm -r test && pnpm run typecheck` — run before marking done.

### Cross-Story Dependencies

**This story enables:**
- Story 3A.2 (Call Actions): Adds `CALL_PUNG`, `CALL_KONG`, `CALL_QUINT` — these will push records to `callWindow.calls` and transition status to `'frozen'`
- Story 3A.4 (Call Window Freeze): Adds `'frozen'` status to `CallWindowState` and priority resolution
- Story 3A.6 (Turn Advancement After Calls): Modifies `closeCallWindow` to advance from caller's seat instead of discarder's
- Story 4A.5 (Action/State Protocol): Wires server-side `GameTimer` to call `closeCallWindow` on timer expiry

**This story depends on:**
- Epic 1 (done): Game state machine, turn loop, discard action, `advanceTurn`
- No dependency on Epic 2 (pattern matcher not needed)

### Project Structure Notes

- All changes within `packages/shared/src/` — no client or server changes
- New file `engine/actions/call-window.ts` follows existing pattern: `draw.ts`, `discard.ts`, `game-flow.ts`
- Co-located test file `engine/actions/call-window.test.ts`
- Barrel exports updated in `index.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3A, Story 3A.1]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — AR10: Server-timed call window]
- [Source: _bmad-output/planning-artifacts/gdd.md — FR19, FR20: Call window mechanics]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Calling Flow UX Journey]
- [Source: _bmad-output/project-context.md — Validate-then-mutate, Server Authority, shared/ rules]
- [Source: packages/shared/src/engine/actions/discard.ts — Current discard handler to modify]
- [Source: packages/shared/src/engine/actions/draw.ts:42-53 — advanceTurn seat-order logic to reuse]
- [Source: packages/shared/src/types/game-state.ts:70 — `callWindow: null` placeholder to replace]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Implemented `CallWindowState` interface with `status: 'open'`, `discardedTile`, `discarderId`, `passes`, `calls: never[]`, `openedAt`
- Added `PassCallAction` to `GameAction` discriminated union and `PASS_CALL`, `CALL_WINDOW_OPENED`, `CALL_WINDOW_CLOSED` to `ResolvedAction`
- Created `handlePassCall` following validate-then-mutate pattern with 5 validation checks
- Created `closeCallWindow` with turn advancement from discarder's seat and wall depletion detection
- Modified `handleDiscardTile` to open call window instead of calling `advanceTurn` — this is a breaking change from Epic 1 requiring updates to existing tests
- Registered `PASS_CALL` in game engine dispatcher with exhaustive type check
- 16 new tests in `call-window.test.ts` covering all 8 acceptance criteria
- Updated 3 existing test files (discard.test.ts, wall-depletion.test.ts, game-engine.test.ts) and 1 client test file (TestHarness.test.ts) to account for call window phase
- Updated type test (game-state.test.ts) for new `CallWindowState | null` type
- All 391 tests pass (369 shared + 1 server + 21 client) with zero regressions
- TypeScript compilation clean across all 3 packages
- Lint clean (zero errors)
- `vi.useFakeTimers()` validated working for `Date.now()` in openedAt test

### File List

- packages/shared/src/types/game-state.ts (MODIFIED) — Added CallWindowState interface, updated GameState.callWindow type, extended ResolvedAction union
- packages/shared/src/types/game-state.test.ts (MODIFIED) — Updated callWindow type assertion, added CallWindowState import
- packages/shared/src/types/actions.ts (MODIFIED) — Added PassCallAction interface, extended GameAction union
- packages/shared/src/constants.ts (MODIFIED) — Added DEFAULT_CALL_WINDOW_MS, MIN_CALL_WINDOW_MS, MAX_CALL_WINDOW_MS
- packages/shared/src/engine/actions/call-window.ts (CREATED) — handlePassCall and closeCallWindow implementations
- packages/shared/src/engine/actions/call-window.test.ts (CREATED) — 15 tests covering all acceptance criteria
- packages/shared/src/engine/actions/discard.ts (MODIFIED) — Opens call window after discard instead of calling advanceTurn
- packages/shared/src/engine/actions/discard.test.ts (MODIFIED) — Updated for call window behavior
- packages/shared/src/engine/actions/wall-depletion.test.ts (MODIFIED) — Updated for call window phase in wall depletion flow
- packages/shared/src/engine/game-engine.ts (MODIFIED) — Added PASS_CALL case to handleAction dispatcher
- packages/shared/src/engine/game-engine.test.ts (MODIFIED) — Updated discard dispatch test, added PASS_CALL dispatch test
- packages/shared/src/index.ts (MODIFIED) — Exported new types and functions
- packages/client/src/components/dev/TestHarness.test.ts (MODIFIED) — Updated for call window behavior in draw, discard, and wall game tests
