# Story 2.6: Scoring & Payment Calculation

Status: done

## Story

As a **developer**,
I want **a scoring module that retrieves point values from validated hands and calculates correct payment distribution for both discard and self-drawn Mahjong**,
So that **session scores are accurate per NMJL payment rules (FR71, FR72, FR73, FR74)**.

## Acceptance Criteria

1. **Given** a validated Mahjong hand from a discard, **When** calculating payments, **Then** the discarder pays 2× the hand's point value and the other 2 losers each pay 1× the hand's point value (FR71)

2. **Given** a self-drawn Mahjong (from the wall), **When** calculating payments, **Then** all 3 losers pay 2× the hand's point value (FR72)

3. **Given** a wall game (draw, no winner), **When** calculating payments, **Then** all payments are 0 — no score changes (FR73)

4. **Given** a validated hand, **When** looking up the point value, **Then** the value matches the NMJL card's assigned points for that pattern (FR74, typically 25–60 points)

5. **Given** multiple games in a session, **When** cumulating scores, **Then** the scoring module returns per-game payments that can be summed for session totals (supporting FR75)

6. **Given** the payment calculation, **When** verifying the math, **Then** the sum of all payments in a game is zero-sum — the winner's gain equals the total of all losers' payments

## Tasks / Subtasks

- [x] Task 1: Extend GameResult type to support Mahjong wins (AC: 1, 2, 3)
  - [x] 1.1 Add `MahjongGameResult` to the `GameResult` discriminated union in `types/game-state.ts`
  - [x] 1.2 Add `PaymentBreakdown` type: `Record<string, number>` mapping playerId → payment amount
  - [x] 1.3 Ensure `WallGameResult` remains unchanged (wall game = no payments)

- [x] Task 2: Implement `calculatePayments` pure function (AC: 1, 2, 3, 6)
  - [x] 2.1 Create `packages/shared/src/engine/scoring.ts`
  - [x] 2.2 Implement discard Mahjong calculation: discarder pays 2× hand value, other 2 losers pay 1× each, winner receives 4× total
  - [x] 2.3 Implement self-drawn Mahjong calculation: all 3 losers pay 2× hand value each, winner receives 6× total
  - [x] 2.4 Implement wall game calculation: all payments = 0
  - [x] 2.5 Enforce zero-sum invariant: assert `sum(all payments) === 0`

- [x] Task 3: Implement `lookupHandPoints` function (AC: 4)
  - [x] 3.1 Given a `patternId`, look up `HandPattern.points` from loaded `NMJLCard` data
  - [x] 3.2 Return point value (number) or null if pattern not found

- [x] Task 4: Write comprehensive tests (AC: 1, 2, 3, 4, 5, 6)
  - [x] 4.1 Create `packages/shared/src/engine/scoring.test.ts`
  - [x] 4.2 Test discard Mahjong: correct per-player payments with known hand values (25, 30, 50 points)
  - [x] 4.3 Test self-drawn Mahjong: correct per-player payments with known hand values
  - [x] 4.4 Test wall game: all payments zero
  - [x] 4.5 Test zero-sum property for all scenarios
  - [x] 4.6 Test point lookup against real 2026 card data (multiple hand patterns)
  - [x] 4.7 Test session accumulation: sum per-game payments across multiple rounds
  - [x] 4.8 Test edge cases: highest/lowest point values in 2026 card

- [x] Task 5: Export from barrel and verify integration (AC: all)
  - [x] 5.1 Add exports to `packages/shared/src/index.ts`
  - [x] 5.2 Run full test suite: `pnpm -r test && pnpm run typecheck`
  - [x] 5.3 Verify zero regressions on existing 354 tests

## Dev Notes

### Architecture & Patterns

**Module location:** `packages/shared/src/engine/scoring.ts` (co-located test: `scoring.test.ts`)

**Follow validate-then-mutate pattern.** This module is a pure calculation layer — no state mutation. It receives inputs and returns an immutable payment breakdown. The caller (future action handler in Story 3A.7) will apply mutations to `state.scores`.

**No exceptions for game rule violations.** Return rejection objects instead of throwing. Exceptions only for genuine bugs.

**Result type pattern:** Follow the discriminated union pattern established by `ExchangeResult` and `ExposureResult`:
```typescript
type ScoringResult =
  | { valid: true; payments: Record<string, number>; winnerId: string; points: number }
  | { valid: false; reason: string };
```

### Payment Calculation Spec

| Scenario | Winner Receives | Discarder Pays | Other Losers Pay (each) |
|----------|----------------|----------------|-------------------------|
| Discard Mahjong | +4× hand value | −2× hand value | −1× hand value |
| Self-Drawn Mahjong | +6× hand value | N/A | −2× hand value (all 3) |
| Wall Game | 0 | 0 | 0 |

**Example (30-point hand, discard Mahjong):**
- Winner: +120, Discarder: −60, Loser A: −30, Loser B: −30 → sum = 0 ✓

**Example (30-point hand, self-drawn Mahjong):**
- Winner: +180, Loser A: −60, Loser B: −60, Loser C: −60 → sum = 0 ✓

### Function Signatures

```typescript
// Main scoring function
export function calculatePayments(params: {
  winnerId: string;
  allPlayerIds: string[];    // all 4 player IDs
  points: number;            // from MatchResult.points or HandPattern.points
  selfDrawn: boolean;
  discarderId?: string;      // required when selfDrawn === false
}): Record<string, number>;  // { playerId: payment_amount }

// Point value lookup from card data
export function lookupHandPoints(
  patternId: string,
  card: NMJLCard
): number | null;

// Wall game helper (trivial but explicit)
export function calculateWallGamePayments(
  allPlayerIds: string[]
): Record<string, number>;  // all zeros
```

### Type Extensions

Extend `GameResult` in `types/game-state.ts`:
```typescript
// Current:
type GameResult = WallGameResult;

// After:
type GameResult = WallGameResult | MahjongGameResult;

interface MahjongGameResult {
  readonly winnerId: string;
  readonly patternId: string;
  readonly patternName: string;
  readonly points: number;
  readonly selfDrawn: boolean;
  readonly discarderId?: string;
  readonly payments: Record<string, number>;
}
```

The existing `WallGameResult` (`{ winnerId: null; points: 0 }`) stays unchanged. Use a discriminant (`winnerId === null`) to distinguish wall game from Mahjong.

### Existing Code to Reuse

| What | Where | How |
|------|-------|-----|
| `MatchResult` (patternId, points) | `card/pattern-matcher.ts` | Input to scoring — provides `points` |
| `HandPattern.points` | `types/card.ts` | Point values from NMJL card data |
| `NMJLCard` + `loadCard()` | `card/card-loader.ts` | Load card for point lookup tests |
| `TEST_PLAYER_IDS` | `testing/fixtures.ts` | Use `["p1","p2","p3","p4"]` in tests |
| `createTestState()` | `testing/helpers.ts` | Create game states for integration tests |
| `buildTilesForHand()` | `testing/tile-builders.ts` | Build 14-tile hands for lookup tests |

### Testing Strategy

**Test file:** `packages/shared/src/engine/scoring.test.ts`

**Test structure:**
```
describe('calculatePayments')
  describe('discard Mahjong')
    - 25-point hand → winner +100, discarder −50, others −25 each
    - 30-point hand → winner +120, discarder −60, others −30 each
    - 50-point hand → winner +200, discarder −100, others −50 each
    - zero-sum check for each
  describe('self-drawn Mahjong')
    - 25-point hand → winner +150, all losers −50 each
    - 30-point hand → winner +180, all losers −60 each
    - 50-point hand → winner +300, all losers −100 each
    - zero-sum check for each
  describe('wall game')
    - all payments = 0
    - zero-sum trivially satisfied
  describe('edge cases')
    - winnerId not in allPlayerIds → rejection
    - discarderId missing for discard Mahjong → rejection
    - discarderId === winnerId → rejection (can't discard to yourself)
    - points <= 0 → rejection

describe('lookupHandPoints')
  - known pattern IDs from 2026 card → correct point values
  - unknown pattern ID → null
  - multiple patterns with different points → each resolves correctly

describe('session accumulation')
  - sum payments from 3 games → correct cumulative totals
  - mix of discard, self-drawn, wall game → correct running totals
```

**Run with:** `pnpm -r test` (from root) or `cd packages/shared && npx vitest run`

**Backpressure gate:** `pnpm -r test && pnpm run typecheck`

### Project Structure Notes

- Scoring module at `packages/shared/src/engine/scoring.ts` — alongside existing `engine/` modules (wall, dealing, create-game, actions/)
- NOT in `card/` — scoring is game engine logic that consumes card data, not card system logic
- Barrel export from `packages/shared/src/index.ts` — follow existing pattern of adding new exports
- Import `NMJLCard` and `HandPattern` types from `types/card.ts`

### Previous Story Intelligence (Story 2-5)

**Key learnings to apply:**
- Use `buildTilesForHand()` from `testing/tile-builders.ts` for any hand construction in tests
- Follow discriminated union result pattern: `{ valid: true, ... } | { valid: false, reason }`
- All 354 tests pass as of story 2-5 completion — baseline for zero-regression check
- Commit convention: `feat(shared): <description>` for new features
- Code review found duplicated helpers — use shared test utilities, don't copy-paste

**Established patterns to follow:**
- Pure functions with no side effects
- Set-based lookups for type checking
- Co-located test files
- Real card data in integration tests (import `loadCard` with `2026.json`)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.6]
- [Source: _bmad-output/planning-artifacts/gdd.md#Scoring and Payment Rules]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#Scoring Module]
- [Source: packages/shared/src/types/game-state.ts — GameResult, GameState.scores]
- [Source: packages/shared/src/types/card.ts — HandPattern.points]
- [Source: packages/shared/src/card/pattern-matcher.ts — MatchResult]
- [Source: _bmad-output/implementation-artifacts/2-5-concealed-exposed-hand-validation.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Implemented `calculatePayments()` — pure function for discard Mahjong (discarder 2×, others 1×) and self-drawn Mahjong (all losers 2×) with input validation and zero-sum guarantee
- Implemented `calculateWallGamePayments()` — trivial zero-payment helper
- Implemented `lookupHandPoints()` — pattern ID to point value lookup from NMJLCard data
- Extended `GameResult` union type with `MahjongGameResult` interface (winnerId, patternId, patternName, points, selfDrawn, discarderId, payments)
- Added `PaymentBreakdown` type alias (`Record<string, number>`)
- Added `ScoringResult` discriminated union type following ExchangeResult/ExposureResult pattern
- 21 new tests covering all 3 payment scenarios, zero-sum verification, edge case rejections with specific reason strings, point lookup against real 2026 card data, and session accumulation across multiple games
- All 375 tests pass (353 shared + 1 server + 21 client), zero regressions
- Typecheck and lint pass cleanly

### Code Review Fixes Applied
- Refactored `calculatePayments` return type from `PaymentBreakdown | null` to `ScoringResult` discriminated union (`{ valid: true; payments } | { valid: false; reason }`) to follow established codebase pattern (ExchangeResult, ExposureResult) and provide actionable rejection reasons for downstream consumers (Story 3A.7)

### File List

- `packages/shared/src/engine/scoring.ts` (new)
- `packages/shared/src/engine/scoring.test.ts` (new)
- `packages/shared/src/types/game-state.ts` (modified — added MahjongGameResult, PaymentBreakdown, extended GameResult union)
- `packages/shared/src/index.ts` (modified — added barrel exports for scoring functions and types)
