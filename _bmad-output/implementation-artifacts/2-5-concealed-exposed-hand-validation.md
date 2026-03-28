# Story 2.5: Concealed/Exposed Hand Validation

Status: review

## Story

As a **developer**,
I want **validation that checks whether a declared hand's concealed and exposed groups match the NMJL card requirements**,
so that **concealed hands cannot be won by calling discards and mixed C/X requirements are enforced at the group level (FR60, FR61, FR62)**.

## Acceptance Criteria

1. **Concealed hand rejection:** Given a hand marked as Concealed (C) on the card, when a player declares Mahjong, then validation confirms that ALL groups were formed by drawing from the wall — no groups were formed via calls (FR62).
2. **Exposed hand permissiveness:** Given a hand marked as Exposed (X) on the card, when a player declares Mahjong, then validation allows groups formed via calls (exposed) or from the wall (concealed) — both are valid.
3. **Mixed group-level validation:** Given a hand with mixed concealed/exposed requirements at the group level, when validating, then each group is checked individually against its specific concealed/exposed requirement on the card (FR61).
4. **Concealed hand disqualification:** Given a player pursuing a concealed hand who called a discard (resulting in an exposed group), when validating against concealed-only patterns, then validation correctly rejects the hand — the exposed group disqualifies all concealed-only patterns.
5. **Exposed group tracking integration:** Given the exposed groups tracking in game state, when a group is formed via a call, then it is permanently marked as exposed and this flag is used during Mahjong validation.

## Tasks / Subtasks

- [x] Task 1: Create exposure validation module (AC: 1, 2, 3, 4)
  - [x] 1.1 Create `packages/shared/src/card/exposure-validation.ts` with `validateExposure(exposedGroups: ExposedGroup[], pattern: HandPattern): ExposureResult`
  - [x] 1.2 Implement concealed hand check: if `pattern.exposure === 'C'`, reject if `exposedGroups.length > 0` (any call disqualifies the entire concealed hand)
  - [x] 1.3 Implement exposed hand check: if `pattern.exposure === 'X'`, always pass — exposed hands allow any combination of called and self-drawn groups
  - [x] 1.4 Implement group-level concealed check: for hands with `GroupPattern.concealed === true` on specific groups, verify those specific groups are NOT present in `exposedGroups` (they must be formed from wall draws)
  - [x] 1.5 Return `ExposureResult`: `{ valid: true }` or `{ valid: false, reason: string }` following the existing `ExchangeResult` pattern from `joker-eligibility.ts`
- [x] Task 2: Create `validateHandWithExposure` composite function (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Create `validateHandWithExposure(tiles: Tile[], exposedGroups: ExposedGroup[], card: NMJLCard): MatchResult | null` in `exposure-validation.ts`
  - [x] 2.2 This wraps the existing `validateHand` — first run tile matching via `validateHand`, then check exposure constraints via `validateExposure`
  - [x] 2.3 Filter feasible patterns by exposure BEFORE running the expensive pattern match: if player has exposed groups, skip all `exposure: 'C'` patterns immediately (fast Phase 1 filter enhancement)
  - [x] 2.4 For group-level concealed checks, match exposed groups against resolved pattern groups by type and identity
- [x] Task 3: Create `filterAchievableByExposure` utility (AC: 4)
  - [x] 3.1 Create `filterAchievableByExposure(exposedGroups: ExposedGroup[], card: NMJLCard): HandPattern[]` — returns hands still achievable given current exposed state
  - [x] 3.2 If `exposedGroups.length > 0`, filter out all `exposure: 'C'` hands
  - [x] 3.3 For remaining hands, check group-level concealed constraints against existing exposed groups
  - [x] 3.4 This supports future hand guidance (Epic 5B) — pre-filter before closeness ranking
- [x] Task 4: Co-located tests (AC: 1, 2, 3, 4, 5)
  - [x] 4.1 Create `packages/shared/src/card/exposure-validation.test.ts`
  - [x] 4.2 Test concealed hand with no exposed groups → valid
  - [x] 4.3 Test concealed hand with exposed groups → rejected
  - [x] 4.4 Test exposed hand with any mix of groups → valid
  - [x] 4.5 Test group-level concealed constraints: hand where some groups marked `concealed: true` and player has those specific groups exposed → rejected
  - [x] 4.6 Test group-level concealed constraints: hand where concealed groups are NOT exposed → valid
  - [x] 4.7 Test `validateHandWithExposure` end-to-end: valid tiles + valid exposure → MatchResult
  - [x] 4.8 Test `validateHandWithExposure`: valid tiles but exposure violation → null
  - [x] 4.9 Test `filterAchievableByExposure`: verify concealed hands removed when player has exposed groups
  - [x] 4.10 Integration test with real 2026 card data: pick a known concealed hand, validate with/without exposed groups
  - [x] 4.11 Integration test: pick a known exposed hand, validate both ways succeed
- [x] Task 5: Export and backpressure (all ACs)
  - [x] 5.1 Export new functions and types from `packages/shared/src/index.ts` barrel
  - [x] 5.2 Run backpressure gate: `pnpm -r test && pnpm run typecheck && vp lint`
  - [x] 5.3 Verify all existing 336+ tests still pass (zero regressions)

## Dev Notes

### Scope Boundary

**IN scope:**
- `validateExposure(exposedGroups, pattern)` — pure exposure constraint checker
- `validateHandWithExposure(tiles, exposedGroups, card)` — composite validator wrapping `validateHand` + exposure check
- `filterAchievableByExposure(exposedGroups, card)` — pre-filter for future hand guidance
- Co-located tests in `exposure-validation.test.ts`
- Barrel exports in `index.ts`

**OUT of scope:**
- Modifying `validateHand` in `pattern-matcher.ts` — wrap it, don't touch it
- Hand guidance engine / closeness ranking (Epic 5B)
- Mahjong declaration action handler (Epic 3A, Story 3A.7)
- Call action handlers that populate `ExposedGroup` (Epic 3A)
- Dead hand detection from concealed hand violations (Epic 3C, Story 3C.3)

### Existing Code — What Already Works

**Pattern matcher** (`card/pattern-matcher.ts`):
- `validateHand(tiles, card)` validates 14 tiles against all card patterns
- Returns `MatchResult { patternId, patternName, points }` or `null`
- Has NO exposure awareness — checks tiles only, ignoring how groups were formed
- Phase 1 feasibility filter + Phase 2 backtracking match
- 100+ tests already green

**Card data schema** (`types/card.ts`):
- `HandPattern.exposure`: `'X' | 'C'` — hand-level concealed/exposed marker
- `GroupPattern.concealed?: boolean` — group-level concealed flag
- Card loader already validates: `exposure === 'C'` hands have `concealed: true` on ALL groups (verified in card-loader.test.ts)

**ExposedGroup type** (`types/game-state.ts:22-27`):
```typescript
export interface ExposedGroup {
  readonly type: GroupType;
  readonly tiles: Tile[];
  readonly identity: GroupIdentity;
}
```
- `GroupIdentity` has `type`, `suit?`, `value?`, `wind?`, `dragon?`
- `PlayerState.exposedGroups: ExposedGroup[]` already in game state
- Identity is fixed at exposure time, never changes (Story 2.4)

**Joker eligibility patterns** (`card/joker-eligibility.ts`):
- Follow its result type pattern: `{ valid: true, ... } | { valid: false, reason: string }`
- Pure functions, no side effects, no game state mutation

**Card data facts** (from `2026.json` and card-integrity tests):
- 54 hands total across 7 categories
- Mix of C and X hands — card loader validates `concealed` flags match `exposure` marker
- All hands sum to exactly 14 tiles

### Critical Implementation Details

1. **Concealed hand = zero exposed groups.** If `pattern.exposure === 'C'`, the player must have `exposedGroups.length === 0`. Any single call disqualifies ALL concealed patterns. This is the simplest and most important check.

2. **Group-level concealed is more nuanced.** Some hands may have a mix of `concealed: true` and `concealed: false/undefined` groups. For these, you must match which exposed groups correspond to which pattern groups. Use `ExposedGroup.identity` (type + suit/value/wind/dragon) to match against resolved `GroupPattern` requirements. However — current 2026 card data has C hands with ALL groups concealed and X hands with NO groups concealed, so group-level mixed validation is forward-looking but must still be implemented correctly.

3. **Do NOT modify `pattern-matcher.ts`.** The exposure validation is a separate layer. `validateHandWithExposure` calls `validateHand` first, then checks exposure constraints on the result. This preserves the existing test suite and separation of concerns.

4. **Exposure pre-filter optimization.** Before running expensive pattern matching, filter out infeasible patterns: if the player has any exposed groups, immediately eliminate all `exposure: 'C'` patterns. This goes in `validateHandWithExposure` as an optimization, not in the pattern matcher itself.

5. **`filterAchievableByExposure` for future hand guidance.** Epic 5B's hand guidance engine will need to know which hands are still achievable given the player's current exposed groups. This function provides that filter. It's a simple function now but prevents the guidance engine from suggesting concealed hands to a player who already called.

6. **Test data construction.** Reuse `buildTilesForHand` from `joker-eligibility.test.ts` to construct valid tile sets for known hands. Create `ExposedGroup` objects manually (as Story 2.4 did) since actual call mechanics aren't implemented yet.

### Previous Story Intelligence (Story 2.4)

- `ExposedGroup` type now has `GroupType` (not string) and `GroupIdentity` — type-safe
- `isJokerEligibleGroup` uses Set-based lookup — follow this pattern for any type-based lookups
- `ExchangeResult` pattern: discriminated union with `valid: true/false` — replicate for `ExposureResult`
- All 336 tests passed at story 2.4 completion
- `buildTilesForHand` helper in `joker-eligibility.test.ts` generates valid tile arrays — reuse in tests
- Test imports: `import { describe, test, expect } from 'vite-plus/test'`
- Backpressure gate: `pnpm -r test && pnpm run typecheck && vp lint`

### Git Intelligence

Recent commits show the pattern:
- `feat(shared): implement Joker eligibility and exchange validation` — story 2.4
- `feat(shared): implement pattern matching engine for NMJL hand validation` — story 2.3
- Commit message format: `feat(shared): <description>` for new features in shared package

### Testing Framework

- `import { describe, test, expect } from 'vite-plus/test'`
- Co-located: `exposure-validation.ts` → `exposure-validation.test.ts`
- Run: `pnpm -r test` from root or `vp test` from shared/

### Project Structure Notes

- New file: `packages/shared/src/card/exposure-validation.ts`
- New file: `packages/shared/src/card/exposure-validation.test.ts`
- Modified: `packages/shared/src/index.ts` (barrel exports)
- No changes to existing `pattern-matcher.ts` or `game-state.ts`
- No new dependencies needed

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.5]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — NMJL Pattern Matching Algorithm, exposure validation in Phase 1]
- [Source: _bmad-output/planning-artifacts/gdd.md — FR60/FR61/FR62: Concealed/Exposed hand rules]
- [Source: _bmad-output/implementation-artifacts/2-4-joker-eligibility-substitution-validation.md — ExposedGroup type, test patterns]
- [Source: packages/shared/src/card/pattern-matcher.ts — validateHand API, no exposure logic]
- [Source: packages/shared/src/types/card.ts — HandPattern.exposure, GroupPattern.concealed]
- [Source: packages/shared/src/types/game-state.ts — ExposedGroup, GroupIdentity, PlayerState]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Initial test assertion assumed all exposed hands have no concealed groups. Discovery: `sp-1` is an exposed hand with mixed group-level concealed constraints (4 concealed groups). Fixed test assertions to reflect actual 2026 card data.

### Completion Notes List

- Implemented `validateExposure()` — pure exposure constraint checker with hand-level (C/X) and group-level concealed validation
- Implemented `validateHandWithExposure()` — composite validator wrapping `validateHand` + exposure pre-filter optimization that eliminates all `exposure: 'C'` patterns before expensive matching when player has exposed groups
- Implemented `filterAchievableByExposure()` — pre-filter for future hand guidance (Epic 5B) that returns hands still achievable given current exposed state
- `ExposureResult` discriminated union follows `ExchangeResult` pattern from joker-eligibility.ts
- Group-level concealed matching uses `ExposedGroup.identity` to match against `GroupPattern` by type + value/suit/wind/dragon
- 18 new tests added covering all ACs, including integration tests with real 2026 card data
- All 354 tests pass (332 shared + 1 server + 21 client), zero regressions
- Typecheck and lint pass cleanly (0 errors)
- Did NOT modify `pattern-matcher.ts` — exposure validation is a separate layer as specified

### Change Log

- 2026-03-27: Implemented concealed/exposed hand validation (Story 2.5) — `validateExposure`, `validateHandWithExposure`, `filterAchievableByExposure` with 18 co-located tests

### File List

- `packages/shared/src/card/exposure-validation.ts` (new)
- `packages/shared/src/card/exposure-validation.test.ts` (new)
- `packages/shared/src/index.ts` (modified — added barrel exports)
