# Story 1.6: Wall Depletion & Game End

Status: review

## Story

As a developer,
I want the game to detect wall depletion and end as a wall game (draw) with no payments when the last tile is drawn and discarded without a Mahjong declaration,
so that games can end naturally when the wall runs out.

## Acceptance Criteria

1. **Given** the wall has 1 tile remaining
   **When** a player draws the last tile and then discards
   **Then** the game transitions to `gamePhase: 'scoreboard'` with a wall game result (`winnerId: null`, `points: 0`, all payments zero) (FR73, FR101)

2. **Given** a wall game occurs
   **When** checking scores
   **Then** no score changes are applied — all payment values are 0

3. **Given** the wall is empty
   **When** the next player in turn order would draw
   **Then** the game has already ended — no draw action is possible

4. **Given** a game is in progress
   **When** checking `wallRemaining` throughout the game
   **Then** it accurately reflects 99 minus the total number of tiles drawn

## Tasks / Subtasks

- [x] Task 1: Add wall game result type and WALL_GAME resolved action (AC: #1)
  - [x] 1.1 Add `WallGameResult` interface to `packages/shared/src/types/game-state.ts` with `winnerId: null`, `points: 0`
  - [x] 1.2 Add `WALL_GAME` variant to `ResolvedAction` union: `{ type: 'WALL_GAME' }`
  - [x] 1.3 Add optional `gameResult` field to `GameState`: `GameResult | null` (where `GameResult = WallGameResult` for now — Mahjong result added in later epic)
  - [x] 1.4 Export new types from `packages/shared/src/index.ts`

- [x] Task 2: Implement wall depletion check in discard handler (AC: #1, #2)
  - [x] 2.1 In `handleDiscardTile` (`packages/shared/src/engine/actions/discard.ts`), after mutation and `advanceTurn()`, check if `state.wall.length === 0`
  - [x] 2.2 If wall empty after discard: set `state.gamePhase = 'scoreboard'`, set `state.gameResult = { winnerId: null, points: 0 }`, do NOT change scores (they stay at 0)
  - [x] 2.3 Return resolved action as `WALL_GAME` instead of `DISCARD_TILE` when wall depletion triggers
  - [x] 2.4 Important: `advanceTurn()` still runs before the wall check — the turn advances, THEN the game ends. This means `currentTurn` points to the next player who would have drawn (but won't).

- [x] Task 3: Verify draw handler already blocks on empty wall (AC: #3)
  - [x] 3.1 Confirm `handleDrawTile` already returns `{ accepted: false, reason: 'WALL_EMPTY' }` when `state.wall.length === 0` — this was added in Story 1.4
  - [x] 3.2 Add additional test: draw rejected when `gamePhase === 'scoreboard'` (WRONG_PHASE guard covers this)

- [x] Task 4: Write comprehensive tests (AC: #1, #2, #3, #4)
  - [x] 4.1 Create `packages/shared/src/engine/actions/wall-depletion.test.ts` (dedicated test file for wall depletion scenarios)
  - [x] 4.2 Test: discard with 1 wall tile remaining → gamePhase transitions to 'scoreboard'
  - [x] 4.3 Test: wall game sets `gameResult` to `{ winnerId: null, points: 0 }`
  - [x] 4.4 Test: wall game returns resolved action `{ type: 'WALL_GAME' }`
  - [x] 4.5 Test: scores unchanged after wall game — all players remain at 0
  - [x] 4.6 Test: draw rejected with WALL_EMPTY after wall depleted
  - [x] 4.7 Test: draw rejected with WRONG_PHASE when gamePhase is 'scoreboard'
  - [x] 4.8 Test: discard rejected with WRONG_PHASE when gamePhase is 'scoreboard'
  - [x] 4.9 Test: wallRemaining accurately tracks wall depletion through multiple draw-discard cycles
  - [x] 4.10 Test: advanceTurn still runs before game end — currentTurn points to next player
  - [x] 4.11 Test: discard with 2+ wall tiles remaining does NOT trigger wall game (normal flow continues)
  - [x] 4.12 Test: full game simulation — play through until wall depletion, verify final state

- [x] Task 5: Run full regression suite (AC: #1-#4)
  - [x] 5.1 Run `pnpm -r test` — all existing tests pass (0 regressions)
  - [x] 5.2 All new wall depletion tests pass

## Dev Notes

### Architecture Requirements

**Validate-Then-Mutate Pattern (AR3 — HARD REQUIREMENT):**
Every action handler must follow: validate (read-only) → mutate (only if valid) → return ActionResult. A rejected action MUST leave state completely unchanged. Never throw exceptions for game rule violations — use result objects.

**Wall Depletion Logic Location:**
The wall depletion check belongs in `handleDiscardTile`, NOT in `handleDrawTile`. Here's why:
- The game end trigger is: "last tile drawn AND discarded without Mahjong"
- `handleDrawTile` already blocks on empty wall (WALL_EMPTY)
- After the last draw, the player must still discard. Only AFTER that discard does the game end.
- Future: In Epic 3A, the call window system will sit between discard and game end — the last discard can still be called for Mahjong or other purposes. For now (Epic 1, no calling system), the game ends immediately after discard when wall is empty.

**Return Value Decision:**
When wall depletion triggers, return `{ type: 'WALL_GAME' }` as the resolved action (not `DISCARD_TILE`). The client needs to know this was a game-ending event to trigger the "Wall Game — draw" display and transition to scoreboard. The discard itself happened (tile moved to pool), but the significant event is the game ending.

### Implementation Details

**Modification to `handleDiscardTile`:**
```typescript
// After existing mutation section (splice, push, lastDiscard, advanceTurn):
if (state.wall.length === 0) {
  state.gamePhase = 'scoreboard'
  state.gameResult = { winnerId: null, points: 0 }
  return {
    accepted: true,
    resolved: { type: 'WALL_GAME' },
  }
}

// Existing return for normal discard:
return {
  accepted: true,
  resolved: { type: 'DISCARD_TILE', playerId: action.playerId, tileId: action.tileId },
}
```

**GameState addition:**
```typescript
export interface WallGameResult {
  readonly winnerId: null
  readonly points: 0
}

// For now, GameResult is only WallGameResult. MahjongResult added in Epic 2/3.
export type GameResult = WallGameResult

export interface GameState {
  // ... existing fields ...
  gameResult: GameResult | null  // null during active play
}
```

**`createLobbyState()` and `createGame()` updates:**
Both must initialize `gameResult: null`.

### What NOT to Implement

- **Mahjong on last tile:** A player drawing the last tile may declare Mahjong (self-drawn). This requires the Mahjong declaration system (Epic 3A). For now, the only option after drawing the last tile is to discard.
- **Last discard calling:** The last discard can be called for Mahjong or other purposes. This requires the call window system (Epic 3A). For now, the discard immediately ends the game.
- **Scoring/payments:** Wall game has zero payments. The scoring engine (`scoring.ts`) doesn't exist yet and isn't needed — scores simply stay at 0.
- **Hot wall toggle:** House rule variant for last-tile behavior. Deferred to post-MVP.
- **Celebration sequence:** UI concern (Epic 5B). The engine just sets the state.

### Existing Code to Reuse (DO NOT REINVENT)

| What | Location | Usage |
|------|----------|-------|
| `handleDiscardTile` | `packages/shared/src/engine/actions/discard.ts` | Modify to add wall depletion check |
| `handleDrawTile` | `packages/shared/src/engine/actions/draw.ts` | Already has WALL_EMPTY guard — verify, don't duplicate |
| `advanceTurn(state)` | `packages/shared/src/engine/actions/draw.ts` | Already called by discard — no change needed |
| `createGame()` | `packages/shared/src/engine/state/create-game.ts` | Add `gameResult: null` to initial state |
| `createLobbyState()` | `packages/shared/src/engine/game-engine.ts` | Add `gameResult: null` to lobby state |
| `createPlayState()` | `packages/shared/src/testing/fixtures.ts` | Use for test setup — creates game with 99 wall tiles |
| `TEST_PLAYER_IDS` | `packages/shared/src/testing/fixtures.ts` | `['p1', 'p2', 'p3', 'p4']` |
| `getPlayerBySeat()` | `packages/shared/src/testing/helpers.ts` | Get player by seat wind in tests |
| `suitedTile()`, `jokerTile()` | `packages/shared/src/testing/tile-builders.ts` | Build tiles for test scenarios |
| `handleAction` dispatcher | `packages/shared/src/engine/game-engine.ts` | No change needed — routes to `handleDiscardTile` |

### Test Setup for Wall Depletion

To test wall depletion, you need a game state where the wall has very few tiles. Two approaches:

**Approach 1: Direct state manipulation (preferred for unit tests):**
```typescript
const state = createPlayState()
// Drain the wall to 1 tile
state.wall.splice(0, state.wall.length - 1)
state.wallRemaining = state.wall.length  // Must stay in sync!
```

**Approach 2: Full game simulation (for integration test):**
```typescript
// Play through draw-discard cycles until wall is nearly empty
// Use handleAction dispatcher for each action
```

**Critical: Keep `wallRemaining` in sync with `wall.length`.** The `handleDrawTile` handler updates `wallRemaining` after each draw. When manually setting up test state, update both fields.

### File Locations (Exact Paths)

**New files:**
- `packages/shared/src/engine/actions/wall-depletion.test.ts` — dedicated wall depletion tests

**Modified files:**
- `packages/shared/src/types/game-state.ts` — add `WallGameResult`, `GameResult`, `WALL_GAME` resolved action, `gameResult` field
- `packages/shared/src/engine/actions/discard.ts` — add wall depletion check after mutation
- `packages/shared/src/engine/state/create-game.ts` — add `gameResult: null` to initial state
- `packages/shared/src/engine/game-engine.ts` — add `gameResult: null` to `createLobbyState()`
- `packages/shared/src/index.ts` — export new types (`WallGameResult`, `GameResult`)

### Testing Standards

- Co-located tests: `wall-depletion.test.ts` in the actions directory (it's testing discard behavior under wall depletion conditions)
- Use `createPlayState()` from `testing/fixtures.ts` for test setup
- Use `TEST_PLAYER_IDS` (`['p1', 'p2', 'p3', 'p4']`) for consistent player references
- Use `getPlayerBySeat()` from `testing/helpers.ts` for seat-based lookups
- Verify state transitions: `gamePhase`, `gameResult`, `scores`, `wallRemaining`
- Verify no regressions: existing discard behavior unchanged when wall has tiles
- Test runner: `pnpm -r test` runs all three packages
- Previous test count: 128 tests across all 3 packages — expect 0 regressions

### Previous Story Learnings (from Story 1.5)

- `advanceTurn()` is called by DISCARD_TILE — reuse it, don't reimplement
- `turnPhase` discrimination (`'draw' | 'discard' | 'callWindow'`) provides state guards
- East's first turn starts with `turnPhase: 'discard'` — dealt 14 tiles, no draw needed
- Null guard added for corrupt-state detection in `handleDiscardTile` — maintain this pattern
- Use direct file imports within shared/ (e.g., `import { SEATS } from '../../constants'`), NOT barrel imports
- Strengthen state-unchanged tests to verify specific player state
- Extracted shared `getPlayerBySeat` helper — reuse it

### Import Convention (within shared/)

```typescript
// CORRECT: Direct file imports within shared/
import type { GameState, ActionResult, GameResult } from '../../types/game-state'
import { advanceTurn } from './draw'

// WRONG: Never import from barrel within same package
import { GameState } from '..//..'  // NO
```

### Edge Cases to Consider

1. **East's first turn ends the game:** If wall has exactly 1 tile after dealing (impossible with 152 tiles and 53 dealt, but good edge case test), East discards without drawing → game ends
2. **wallRemaining consistency:** Must always equal `state.wall.length`. Every mutation that touches the wall must update both.
3. **gamePhase gate prevents post-game actions:** Both `handleDrawTile` and `handleDiscardTile` check `gamePhase === 'play'` first. Once phase is 'scoreboard', all game actions are rejected.
4. **Scores at 0:** `createGame()` initializes all scores to 0. Wall game doesn't change them. Verify they're still 0 after game end.

### Project Structure Notes

- Monorepo: `@mahjong-game/shared`, `@mahjong-game/client`, `@mahjong-game/server`
- All game logic in shared/ — client and server both consume it
- shared/ has zero runtime dependencies
- TypeScript strict mode, no `any` types
- No `console.*` in shared/ — Logger interface for injection

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.6]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Action Handler Pattern, Validate-Then-Mutate, Game Phase: scoreboard]
- [Source: _bmad-output/planning-artifacts/gdd.md — FR73 Wall Game Trigger, FR101 Wall Game No Payments, Wall End and Last Tile Rules]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Wall Game End State, Rematch Flow]
- [Source: _bmad-output/project-context.md — Critical Implementation Rules, Testing Rules]
- [Source: _bmad-output/implementation-artifacts/1-5-discard-action-with-joker-restrictions.md — Previous Story Patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

Initial test run had 4 failures due to East's first turn starting in 'discard' phase (14 tiles, no draw). Tests incorrectly tried to draw for East. Fixed by using `setupForLastDraw` helper that first has East discard, then sets up South for the draw-discard scenario.

### Completion Notes List

- Added `WallGameResult` interface and `GameResult` type to game-state.ts
- Added `WALL_GAME` variant to `ResolvedAction` union
- Added `gameResult: GameResult | null` field to `GameState`
- Modified `handleDiscardTile` to check `state.wall.length === 0` after mutation — transitions to scoreboard phase with wall game result
- `advanceTurn()` still runs before wall check — turn advances, then game ends
- Updated `createGame()` and `createLobbyState()` to initialize `gameResult: null`
- Exported `WallGameResult` and `GameResult` from barrel index
- 12 new tests in `wall-depletion.test.ts` including full game simulation
- Full regression suite: 142 tests across all 3 packages (140 shared + 1 server + 1 client), 0 failures

### Change Log

- 2026-03-26: Implemented wall depletion detection and game end. Added WallGameResult/GameResult types, WALL_GAME resolved action, wall depletion check in discard handler, gameResult field on GameState. 12 comprehensive tests including full game simulation.

### File List

**New files:**
- `packages/shared/src/engine/actions/wall-depletion.test.ts` — 12 wall depletion tests

**Modified files:**
- `packages/shared/src/types/game-state.ts` — added WallGameResult, GameResult, WALL_GAME resolved action, gameResult field
- `packages/shared/src/engine/actions/discard.ts` — added wall depletion check after advanceTurn
- `packages/shared/src/engine/state/create-game.ts` — added gameResult: null to initial state
- `packages/shared/src/engine/game-engine.ts` — added gameResult: null to createLobbyState()
- `packages/shared/src/index.ts` — exported WallGameResult and GameResult types
