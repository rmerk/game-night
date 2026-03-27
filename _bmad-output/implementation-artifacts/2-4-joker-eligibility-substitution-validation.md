# Story 2.4: Joker Eligibility & Substitution Validation

Status: done

## Story

As a **developer**,
I want **a Joker eligibility system that enforces where Jokers can and cannot substitute, and validates Joker exchanges against exposed groups**,
so that **Joker rules are correctly enforced for hand validation and future Joker exchange mechanics (FR50, FR53, FR55)**.

## Acceptance Criteria

1. **Groups of 3+ accept Jokers:** Given a group of size 3+ (pung, kong, quint, sextet, news, dragon_set), Jokers can substitute for any tile in the group.
2. **Pairs/singles reject Jokers:** Given a pair or single tile group, Jokers CANNOT substitute — the group must contain only natural tiles (FR50).
3. **Exchange validates identity match:** Given an exposed group with a fixed identity (e.g., "Kong of 3-Bam"), a Joker exchange is accepted only if the offered natural tile matches the group's identity exactly (FR55).
4. **Exchange rejects no-Joker groups:** Given an exposed group containing no Jokers, a Joker exchange is rejected.
5. **Multi-Joker exchange:** Given multiple Jokers in a single exposed group (e.g., a Quint with 2 Jokers), any single Joker can be exchanged if the natural tile matches the group identity.

## Tasks / Subtasks

- [x] Task 1: Create Joker eligibility utility functions (AC: 1, 2)
  - [x] 1.1 Create `packages/shared/src/card/joker-eligibility.ts` with `isJokerEligibleGroup(groupType: GroupType): boolean` — returns true for groups of 3+ (pung, kong, quint, sextet, news, dragon_set), false for pair/single
  - [x] 1.2 Create `canSubstituteJoker(group: GroupPattern, position: number): boolean` — checks `jokerEligible` flag on the group pattern and validates position is within group size
  - [x] 1.3 Co-located tests in `joker-eligibility.test.ts`: test all 8 GroupType values, boundary cases
- [x] Task 2: Create Joker exchange validation (AC: 3, 4, 5)
  - [x] 2.1 Create `validateJokerExchange(exposedGroup: ExposedGroup, offeredTile: Tile): ExchangeResult` in `joker-eligibility.ts`
  - [x] 2.2 Validate: group must contain at least one Joker tile (AC 4)
  - [x] 2.3 Validate: offered tile must match the group's identity — for suited groups, same suit+value; for wind groups, a matching wind; for dragon groups, a matching dragon (AC 3, FR55)
  - [x] 2.4 Return `{ valid: true, jokerTile: Tile }` (the specific Joker being exchanged) or `{ valid: false, reason: string }`
  - [x] 2.5 Handle multi-Joker groups: return the first Joker found in the group (AC 5)
  - [x] 2.6 Co-located tests: valid exchanges, identity mismatch, no-Joker group, multi-Joker group
- [x] Task 3: Extend ExposedGroup type with identity tracking (AC: 3)
  - [x] 3.1 Add `identity` field to `ExposedGroup` interface in `game-state.ts`: `readonly identity: { type: GroupType; suit?: string; value?: number | string; wind?: string; dragon?: string }`
  - [x] 3.2 This is a type extension — the actual population of identity happens in Epic 3A when groups are exposed via calls. For now, tests create ExposedGroup objects with identity manually.
  - [x] 3.3 Update `game-state.test.ts` type tests to include the new identity field
- [x] Task 4: Integration with existing pattern matcher (AC: 1, 2)
  - [x] 4.1 Verify `validateHand` in `pattern-matcher.ts` already respects `jokerEligible` — it does (confirmed in Story 2.3). No changes needed, just add integration tests.
  - [x] 4.2 Add integration tests in `joker-eligibility.test.ts`: validate that a hand with Jokers in eligible positions passes `validateHand`, and Jokers in ineligible positions fail
- [x] Task 5: Export and backpressure (all ACs)
  - [x] 5.1 Export new functions from `packages/shared/src/index.ts` barrel
  - [x] 5.2 Run backpressure gate: `pnpm -r test && pnpm run typecheck && vp lint`
  - [x] 5.3 Verify all existing 287+ tests still pass (zero regressions)

## Dev Notes

### Scope Boundary

**IN scope:**
- `isJokerEligibleGroup` utility
- `canSubstituteJoker` utility
- `validateJokerExchange` for exposed group validation
- Extending `ExposedGroup` type with identity
- Integration tests with existing pattern matcher

**OUT of scope:**
- Joker exchange game action handler (Epic 3C, Story 3C.1)
- Joker exchange timing rules (own turn, before discard) (Epic 3C)
- Simplified Joker rules host option (Epic 3C, Story 3C.2)
- Populating `ExposedGroup.identity` from actual calls (Epic 3A)

### Existing Code — What Already Works

**Pattern matcher Joker handling** (`pattern-matcher.ts`):
- `tryMatch` already checks `g.jokerEligible` (renamed as `g.jok` in resolved groups)
- Joker pool is tracked separately, allocated only to eligible groups
- Backtracking allocation handles cases where greedy fails (e.g., wd-3)
- 6 Joker-specific tests already pass in `pattern-matcher.test.ts`

**Card data Joker validation** (`card-loader.ts:145-154`):
- Loader enforces `jokerEligible: true` for groups of 3+
- Loader enforces `jokerEligible: false` for pairs/singles
- Card integrity tests verify this for all 54 hands

**ExposedGroup type** (`game-state.ts:12-16`):
```typescript
export interface ExposedGroup {
  readonly type: string;
  readonly tiles: Tile[];
}
```
Currently a stub — needs `identity` field for exchange validation.

**Constants** (`constants.ts`):
- `GROUP_SIZES`: { single: 1, pair: 2, pung: 3, kong: 4, quint: 5, sextet: 6, news: 4, dragon_set: 3 }

**Key types** (`types/card.ts`):
- `GroupType`: single | pair | pung | kong | quint | sextet | news | dragon_set
- `GroupPattern.jokerEligible: boolean`

**Tile types** (`types/tiles.ts`):
- `Tile` discriminated union with `category` field
- JokerTile has `category: "joker"`
- Tile ID format: `{suit}-{value}-{copy}` (e.g., `bam-3-2`, `joker-5`)

### Critical Implementation Details

1. **Group identity for exchange validation:** When a group is exposed (Epic 3A), its identity is fixed. For example, a "Kong of 3-Bam" will always be 3-Bam even if Jokers are exchanged in/out. The `ExposedGroup.identity` field captures this. Story 2.4 defines the type and validation logic; Epic 3A populates it.

2. **ExposedGroup.type should use `GroupType`:** Currently typed as `string` — change to `GroupType` for type safety.

3. **Exchange returns a specific Joker tile:** When multiple Jokers exist in a group, the exchange function returns the first Joker found. The caller (Epic 3C action handler) removes that tile from the group and adds it to the player's rack.

4. **No game state mutations here:** This story creates pure validation functions. The actual exchange action (mutating game state — removing Joker from group, adding to rack, placing natural tile in group) belongs in Epic 3C.

### Previous Story Intelligence (Story 2.3)

- Backtracking Joker allocation (not greedy) was necessary for some hands — the eligibility functions should respect this by not making assumptions about allocation order
- `buildTilesForHand` helper generates valid tile arrays including Joker substitutions — reuse in integration tests
- sp-7/wd-1 ambiguity: structurally identical tiles can match multiple patterns — not relevant to Joker eligibility but good to know
- All tests import from `vite-plus/test`: `import { describe, test, expect } from 'vite-plus/test'`
- Backpressure gate: `pnpm -r test && pnpm run typecheck && vp lint`

### Testing Framework
- `import { describe, test, expect } from 'vite-plus/test'`
- Co-located: `joker-eligibility.ts` → `joker-eligibility.test.ts`
- Run: `pnpm -r test` from root or `vp test` from shared/

### Project Structure Notes
- New file: `packages/shared/src/card/joker-eligibility.ts`
- New file: `packages/shared/src/card/joker-eligibility.test.ts`
- Modified: `packages/shared/src/types/game-state.ts` (extend ExposedGroup)
- Modified: `packages/shared/src/types/game-state.test.ts` (type tests)
- Modified: `packages/shared/src/index.ts` (barrel exports)
- No new dependencies needed

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.4 (lines 966-992)]
- [Source: _bmad-output/project-context.md — shared/ Package Rules, Tile References]
- [Source: _bmad-output/implementation-artifacts/2-3-pattern-matching-engine.md — Joker allocation approach, test patterns]
- [Source: FR50: Standard NMJL Joker rules — 8 Jokers, substitute in groups of 3+]
- [Source: FR53: Joker exchange — swap natural tile for Joker in exposed group]
- [Source: FR55: Group identity fixed at exposure]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Implemented `isJokerEligibleGroup` using a Set-based lookup for O(1) eligibility checks across all 8 GroupType values
- Implemented `canSubstituteJoker` that validates both the `jokerEligible` flag and position bounds against GROUP_SIZES
- Implemented `validateJokerExchange` with identity matching for suited (suit+value), wind, and dragon groups; returns the first Joker tile found in multi-Joker groups
- Extended `ExposedGroup` interface: changed `type` from `string` to `GroupType` for type safety, added `GroupIdentity` interface and `identity` field
- Added integration test confirming `isJokerEligibleGroup` agrees with card data `jokerEligible` flags across all 54 hands
- All 336 tests pass across all packages (shared: 314+1 todo, server: 1, client: 21), zero regressions
- Typecheck and lint pass clean (0 errors)

### Change Log

- 2026-03-27: Implemented Story 2.4 — Joker eligibility utilities, exchange validation, ExposedGroup type extension, integration tests
- 2026-03-27: Code review — approved. All 5 ACs verified, all 15 subtasks confirmed complete, 0 issues found. Clean review.

### File List

- `packages/shared/src/card/joker-eligibility.ts` (new) — isJokerEligibleGroup, canSubstituteJoker, validateJokerExchange
- `packages/shared/src/card/joker-eligibility.test.ts` (new) — 25 tests: unit + integration
- `packages/shared/src/types/game-state.ts` (modified) — ExposedGroup type extended with GroupIdentity, type changed to GroupType
- `packages/shared/src/types/game-state.test.ts` (modified) — Added ExposedGroup and GroupIdentity type tests
- `packages/shared/src/index.ts` (modified) — Exported new functions and types
