# Story 1.5: Discard Action with Joker Restrictions

Status: done

## Story

As a developer,
I want a discard action that removes a tile from the player's rack, adds it to their discard pool, advances the turn, and enforces Joker discard restrictions,
so that the core draw-discard loop is complete with basic rule enforcement.

## Acceptance Criteria

1. **Given** it is a player's turn and they have drawn a tile (or it's East's first turn with 14 tiles)
   **When** the player dispatches `DISCARD_TILE` with a valid tile ID from their rack
   **Then** the tile is removed from their rack, added to their discard pool, and the turn advances to the next player counterclockwise

2. **Given** a player attempts to discard
   **When** the tile ID is not in their rack
   **Then** `{ accepted: false, reason: 'TILE_NOT_IN_RACK' }` is returned with no state mutation

3. **Given** a player has a Joker in their rack
   **When** they attempt to discard the Joker
   **Then** `{ accepted: false, reason: 'CANNOT_DISCARD_JOKER' }` is returned (FR51)

4. **Given** it is East's first turn (14 tiles, no draw)
   **When** East dispatches `DISCARD_TILE`
   **Then** the discard succeeds without requiring a prior draw action (FR14)

5. **Given** a player discards a tile
   **When** checking the validate-then-mutate pattern
   **Then** all validation occurs before any state mutation — a rejected discard leaves state completely unchanged (AR3)

## Tasks / Subtasks

- [x] Task 1: Add DiscardTileAction type and DISCARD_TILE resolved variant (AC: #1, #5)
  - [x] 1.1 Add `DiscardTileAction` interface to `packages/shared/src/types/actions.ts` with `type: 'DISCARD_TILE'` and `tileId: string` fields
  - [x] 1.2 Add `DISCARD_TILE` variant to `ResolvedAction` union in `packages/shared/src/types/game-state.ts` with `playerId` and `tileId`
  - [x] 1.3 Export `DiscardTileAction` from `packages/shared/src/index.ts`

- [x] Task 2: Implement handleDiscardTile action handler (AC: #1, #2, #3, #4, #5)
  - [x] 2.1 Create `packages/shared/src/engine/actions/discard.ts` with `handleDiscardTile(state, action)` function
  - [x] 2.2 Implement validation gates in order: gamePhase check, currentTurn check, turnPhase check (allow 'discard'), tile existence check, Joker restriction check
  - [x] 2.3 Implement mutation section: remove tile from rack, add to discardPool, set `lastDiscard`, call `advanceTurn(state)`
  - [x] 2.4 Return `ActionResult` with resolved `{ type: 'DISCARD_TILE', playerId, tileId }`

- [x] Task 3: Wire handler into game engine dispatcher (AC: #1)
  - [x] 3.1 Add `DISCARD_TILE` case to `handleAction` switch in `packages/shared/src/engine/game-engine.ts`
  - [x] 3.2 Export `handleDiscardTile` from `packages/shared/src/index.ts`

- [x] Task 4: Write comprehensive tests (AC: #1, #2, #3, #4, #5)
  - [x] 4.1 Create `packages/shared/src/engine/actions/discard.test.ts`
  - [x] 4.2 Test: successful discard removes tile from rack, adds to discardPool, advances turn
  - [x] 4.3 Test: successful discard returns `{ accepted: true, resolved: { type: 'DISCARD_TILE', playerId, tileId } }`
  - [x] 4.4 Test: reject NOT_YOUR_TURN when wrong player discards
  - [x] 4.5 Test: reject TILE_NOT_IN_RACK when tile not found
  - [x] 4.6 Test: reject CANNOT_DISCARD_JOKER when discarding a Joker tile (FR51)
  - [x] 4.7 Test: East's first turn — turnPhase starts as 'discard', discard succeeds without prior draw (FR14)
  - [x] 4.8 Test: reject MUST_DRAW_FIRST when turnPhase is 'draw' (non-East, mid-game)
  - [x] 4.9 Test: reject WRONG_PHASE when gamePhase is not 'play'
  - [x] 4.10 Test: state completely unchanged on any rejected action (verify rack, discardPool, currentTurn, turnPhase)
  - [x] 4.11 Test: lastDiscard is set correctly after successful discard
  - [x] 4.12 Test: turn advances counterclockwise after discard (east->south->west->north cycle)
  - [x] 4.13 Test: discarding a regular tile while holding Jokers succeeds (Joker restriction only blocks Joker discard, not discard when holding Jokers)

- [x] Task 5: Run full regression suite and verify (AC: #1-#5)
  - [x] 5.1 Run `pnpm -r test` — all existing tests pass (0 regressions)
  - [x] 5.2 All new discard tests pass

## Dev Notes

### Architecture Requirements

**Validate-Then-Mutate Pattern (AR3 — HARD REQUIREMENT):**
Every action handler must follow: validate (read-only) -> mutate (only if valid) -> return ActionResult. A rejected action MUST leave state completely unchanged. Never throw exceptions for game rule violations — use result objects.

**Validation Gate Order (follow this exact sequence):**
1. `gamePhase === 'play'` — reject with `WRONG_PHASE`
2. `currentTurn === action.playerId` — reject with `NOT_YOUR_TURN`
3. `turnPhase === 'discard'` — reject with `MUST_DRAW_FIRST` (East's first turn starts with turnPhase='discard', so this naturally passes for East)
4. Tile exists in player's rack — reject with `TILE_NOT_IN_RACK`
5. Tile is not a Joker — reject with `CANNOT_DISCARD_JOKER` (FR51)

**Mutation Sequence (only after ALL validation passes):**
1. Remove tile from `state.players[playerId].rack` using `findIndex` by tile ID
2. Push tile to `state.players[playerId].discardPool`
3. Set `state.lastDiscard = { tile, discarderId: playerId }`
4. Call `advanceTurn(state)` — already implemented in `draw.ts`, reuse it

### Joker Restriction Details (FR51)

- Jokers in the rack CANNOT be discarded. Return `CANNOT_DISCARD_JOKER`.
- Check tile type: Joker tiles have category `'joker'` in the Tile type system.
- This is the ONLY Joker-related restriction in the discard action. Other Joker rules (exchange, eligibility, substitution) belong to later stories.
- If a Joker is somehow discarded (should be impossible), it's a dead tile no one can call (FR52) — but that enforcement belongs in Epic 3A call validation, not here.

### East's First Turn (FR14)

- After dealing, East has 14 tiles and `turnPhase` is set to `'discard'` (not `'draw'`).
- East does NOT draw on their first turn — they evaluate their 14-tile hand and discard.
- The turnPhase check (`turnPhase === 'discard'`) naturally handles this: East starts in 'discard' phase, so DISCARD_TILE is valid immediately.
- No special East-specific code path needed — the existing state initialization handles it.

### Turn Advancement

- `advanceTurn(state)` is already implemented and exported from `packages/shared/src/engine/actions/draw.ts`.
- It cycles `currentTurn` through SEATS order (east->south->west->north) and resets `turnPhase` to `'draw'`.
- Import and call it at end of mutation section — do NOT reimplement.

### lastDiscard Field

- `GameState.lastDiscard` already exists in the type definition (currently `null`).
- Set it to `{ tile, discarderId: playerId }` after removing the tile from the rack.
- This field is consumed by the call window system (Epic 3A) — for now, just set it correctly.

### Existing Code to Reuse (DO NOT REINVENT)

| What | Location | Usage |
|------|----------|-------|
| `advanceTurn(state)` | `packages/shared/src/engine/actions/draw.ts` | Call after discard to advance turn |
| `SEATS` constant | `packages/shared/src/constants.ts` | Turn order reference |
| `handleDrawTile` pattern | `packages/shared/src/engine/actions/draw.ts` | Reference for validate-then-mutate structure |
| `createPlayState()` | `packages/shared/src/testing/fixtures.ts` | Test fixture — creates game in play phase |
| `TEST_PLAYER_IDS` | `packages/shared/src/testing/fixtures.ts` | `['p1', 'p2', 'p3', 'p4']` |
| Tile builder functions | `packages/shared/src/testing/tile-builders.ts` | `suitedTile()`, `jokerTile()` for test setup |
| `buildHand()` | `packages/shared/src/testing/helpers.ts` | Build hands for test scenarios |
| `GameAction` union | `packages/shared/src/types/actions.ts` | Add DiscardTileAction variant |
| `ResolvedAction` union | `packages/shared/src/types/game-state.ts` | Add DISCARD_TILE variant |
| `handleAction` dispatcher | `packages/shared/src/engine/game-engine.ts` | Add DISCARD_TILE case |
| `index.ts` barrel | `packages/shared/src/index.ts` | Export new types and handler |

### Tile Type System (for Joker Detection)

Tiles use a discriminated union with `category` field:
- `SuitedTile` — category: suited tile (bam, crak, dot)
- `WindTile` — category: wind
- `DragonTile` — category: dragon
- `FlowerTile` — category: flower
- `JokerTile` — category: joker

To check if a tile is a Joker, check the tile's type/category field. Tile IDs follow `{suit}-{value}-{copy}` pattern (e.g., `bam-3-2`). Joker IDs: `joker-1` through `joker-8`.

### File Locations (Exact Paths)

**New files:**
- `packages/shared/src/engine/actions/discard.ts` — handler
- `packages/shared/src/engine/actions/discard.test.ts` — tests

**Modified files:**
- `packages/shared/src/types/actions.ts` — add DiscardTileAction to GameAction union
- `packages/shared/src/types/game-state.ts` — add DISCARD_TILE to ResolvedAction union
- `packages/shared/src/engine/game-engine.ts` — add DISCARD_TILE case to handleAction switch
- `packages/shared/src/index.ts` — export DiscardTileAction type and handleDiscardTile function

### Testing Standards

- Co-located tests: `discard.test.ts` next to `discard.ts`
- Use `createPlayState()` from `testing/fixtures.ts` for test setup
- Use `TEST_PLAYER_IDS` (`['p1', 'p2', 'p3', 'p4']`) for consistent player references
- Use tile builder functions from `testing/tile-builders.ts` for constructing test hands
- Verify state unchanged on rejected actions (check rack, discardPool, currentTurn, turnPhase, wallRemaining)
- No snapshot tests — use specific assertions on ActionResult and state fields
- Never throw for rule violations — always test ActionResult `{ accepted, reason }`
- Follow the 11-test pattern established in Story 1.4 (`draw.test.ts`)
- Test runner: `pnpm -r test` runs all three packages
- Previous test count: 112 tests in shared package — expect 0 regressions

### Previous Story Learnings (from Story 1.4)

- `advanceTurn()` was NOT called by DRAW_TILE — it was reserved specifically for DISCARD_TILE. Call it here.
- turnPhase discrimination (`'draw' | 'discard' | 'callWindow'`) provides state guards — no separate boolean flags needed.
- East's first turn naturally handled: turnPhase starts as 'discard' after deal, DRAW_TILE correctly rejected.
- WALL_EMPTY guard was added in review — consider edge cases for discard too (though discard doesn't interact with wall).
- Use factory functions (not singletons) for test fixtures.
- Use direct file imports within shared/ (e.g., `import { SEATS } from '../../constants'`), NOT barrel imports.
- Review feedback: strengthen state-unchanged tests to verify the attempting player's rack specifically.

### Import Convention (within shared/)

```typescript
// CORRECT: Direct file imports within shared/
import { SEATS } from '../../constants'
import type { GameState } from '../../types/game-state'
import type { ActionResult } from '../../types/game-state'
import { advanceTurn } from './draw'

// WRONG: Never import from barrel within same package
import { SEATS } from '../..'  // NO
```

### Project Structure Notes

- Monorepo: `@mahjong-game/shared`, `@mahjong-game/client`, `@mahjong-game/server`
- All game logic in shared/ — client and server both consume it
- shared/ has zero runtime dependencies
- TypeScript strict mode, no `any` types
- No `console.*` in shared/ — Logger interface for injection

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.5]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Action Handler Pattern, Validate-Then-Mutate]
- [Source: _bmad-output/planning-artifacts/gdd.md — FR51 Joker Discard Restriction, FR14 East's First Turn]
- [Source: _bmad-output/project-context.md — Critical Implementation Rules, Testing Rules]
- [Source: _bmad-output/implementation-artifacts/1-4-turn-loop-draw-action.md — Previous Story Patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Implemented `handleDiscardTile` following validate-then-mutate pattern with 5 validation gates: gamePhase, currentTurn, turnPhase, tile existence, Joker restriction
- Joker detection uses `tile.category === 'joker'` (discriminated union)
- Reused `advanceTurn()` from `draw.ts` — no reimplementation
- East's first turn naturally handled: `turnPhase` starts as `'discard'` after deal, no special code path needed
- Widened `GameState.lastDiscard` type from `null` to `{ tile: Tile; discarderId: string } | null`
- Fixed pre-existing `as Record<string, unknown>` casts in `game-flow.test.ts` and `game-engine.test.ts` to use direct property assignment (GameState properties are mutable)
- Updated type test in `game-state.test.ts` to match new `lastDiscard` union type
- 12 new tests added in `discard.test.ts`, all passing
- Full regression suite: 126 tests across all 3 packages (124 shared + 1 server + 1 client), 0 failures

### Change Log

- 2026-03-26: Implemented DISCARD_TILE action handler with Joker restrictions. Added DiscardTileAction type, DISCARD_TILE resolved variant, handleDiscardTile handler, engine dispatch wiring, barrel exports, and 12 comprehensive tests.
- 2026-03-26 (code-review): Added null guard in handleDiscardTile for corrupt-state detection. Extracted duplicate getPlayerBySeat helper from draw.test.ts and discard.test.ts into testing/helpers.ts. Added DRAW_TILE and DISCARD_TILE engine dispatch integration tests to game-engine.test.ts. Full suite: 128 tests, 0 failures.
- 2026-03-26 (code-review-2): Added wallRemaining assertion to state-unchanged test (Task 4.10 spec compliance). Full suite: 142 tests, 0 failures.

### File List

**New files:**
- `packages/shared/src/engine/actions/discard.ts` — handleDiscardTile action handler
- `packages/shared/src/engine/actions/discard.test.ts` — 12 comprehensive tests

**Modified files:**
- `packages/shared/src/types/actions.ts` — added DiscardTileAction interface to GameAction union
- `packages/shared/src/types/game-state.ts` — added DISCARD_TILE to ResolvedAction union, widened lastDiscard type
- `packages/shared/src/types/game-state.test.ts` — updated lastDiscard type assertion
- `packages/shared/src/engine/game-engine.ts` — added DISCARD_TILE case to handleAction switch
- `packages/shared/src/engine/game-engine.test.ts` — fixed Record<string, unknown> cast; added DRAW_TILE and DISCARD_TILE dispatch integration tests
- `packages/shared/src/engine/actions/discard.ts` — added null guard for corrupt-state detection
- `packages/shared/src/engine/actions/game-flow.test.ts` — fixed Record<string, unknown> casts
- `packages/shared/src/engine/actions/draw.test.ts` — replaced local getPlayerBySeat with shared helper import
- `packages/shared/src/testing/helpers.ts` — added getPlayerBySeat helper
- `packages/shared/src/index.ts` — exported DiscardTileAction type and handleDiscardTile function
