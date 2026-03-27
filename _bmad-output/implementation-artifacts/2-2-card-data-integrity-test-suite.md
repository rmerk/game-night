# Story 2.2: Card Data Integrity Test Suite

Status: ready-for-dev

## Story

As a **developer**,
I want **an exhaustive test suite that validates the NMJL card data file for correctness, completeness, and consistency before any pattern matching code is written**,
so that **the card data is proven correct and the test suite defines the "done" criteria for the pattern matcher (red-green-refactor)**.

## Acceptance Criteria

1. **Parseability & uniqueness:** All hands are parseable, no duplicate pattern IDs, every hand has a point value, group sizes are valid for their type (pair=2, pung=3, kong=4, quint=5, sextet=6, news=4, dragon_set=3).
2. **Joker eligibility consistency:** Jokers are eligible only in groups of 3+ (pung, kong, quint, sextet, news, dragon_set), never in pairs or singles (FR50).
3. **Hand completeness:** Every hand sums to exactly 14 tiles across all groups, every category on the card has at least one hand, and total hand count matches expected (~50+ hands).
4. **Concealed/exposed encoding:** Every hand has an exposure marker (C or X), and concealed hands have appropriate group-level concealed flags (FR60, FR61).
5. **Red pattern-matcher tests:** Tests for hand validation against all 50+ patterns exist and FAIL (red), defining the acceptance criteria the matcher must satisfy.
6. **Edge cases:** Wildcard suit resolution (A/B/C mapping to Bam/Crak/Dot), consecutive value wildcards (N, N+1, N+2 with boundary cases like 8-9), mixed-tile groups (NEWS, Dragon sets), and hands requiring Jokers (quints where only 4 natural copies exist).

## Tasks / Subtasks

- [ ] Task 1: Card data integrity tests — `shared/src/card/card-integrity.test.ts` (AC: 1, 2, 3, 4)
  - [ ] 1.1 Structural integrity: all 54 hands parseable, no duplicate IDs, every hand has positive points
  - [ ] 1.2 Group size validation: each group's type matches its expected size via `GROUP_SIZES`
  - [ ] 1.3 Joker eligibility: groups of 3+ have `jokerEligible: true`, pairs/singles have `jokerEligible: false`
  - [ ] 1.4 Tile count: every hand sums to exactly 14 tiles
  - [ ] 1.5 Category completeness: all 7 categories present, each has at least 1 hand, total ≥ 50
  - [ ] 1.6 Exposure validation: every hand has `exposure` of `"C"` or `"X"`, concealed hands have `concealed: true` on all groups
  - [ ] 1.7 `news` and `dragon_set` groups have no `tile` field (composition is implicit)
  - [ ] 1.8 Non-NEWS/dragon_set groups have a `tile` field with valid `TileRequirement`
  - [ ] 1.9 Color consistency: within a hand, same color letter always means same suit (A≠B≠C)
  - [ ] 1.10 Value wildcard validity: N+2 patterns constrain N ≤ 7
- [ ] Task 2: Red pattern-matcher tests — `shared/src/card/pattern-matcher.test.ts` (AC: 5, 6)
  - [ ] 2.1 Create test helper: `buildTilesForHand(handId, suitMapping, valueMapping)` → generates a valid 14-tile array for a given hand pattern
  - [ ] 2.2 Write one `test` per hand (all 54 hands from 2026 card) calling a not-yet-implemented `validateHand(tiles, card)` → these tests must compile but FAIL at runtime
  - [ ] 2.3 Edge case tests: wildcard suit resolution across all 6 permutations
  - [ ] 2.4 Edge case tests: consecutive value boundary (N=7 with N+2=9, N=8 with N+1=9 only)
  - [ ] 2.5 Edge case tests: mixed-tile groups (NEWS with 4 winds, dragon_set with 3 dragons)
  - [ ] 2.6 Edge case tests: quint/sextet hands requiring Joker substitution (only 4 natural copies exist)
  - [ ] 2.7 Edge case tests: Joker in eligible positions accepted, Joker in pairs/singles rejected
  - [ ] 2.8 Edge case tests: concealed hand validation (reject if any group is exposed)
  - [ ] 2.9 Negative tests: 14 random tiles that match NO pattern → returns null
  - [ ] 2.10 Stub `validateHand` function in `pattern-matcher.ts` that returns `null` (makes red tests compile)
- [ ] Task 3: Exports and integration (AC: all)
  - [ ] 3.1 Export `validateHand` from `shared/src/card/pattern-matcher.ts` (stub only)
  - [ ] 3.2 Add `validateHand` to barrel exports in `shared/src/index.ts`
  - [ ] 3.3 Run full test suite: integrity tests pass (green), pattern-matcher tests fail (red)

## Dev Notes

### Architecture Compliance
- File location: `packages/shared/src/card/card-integrity.test.ts` (confirmed by architecture table)
- File location: `packages/shared/src/card/pattern-matcher.ts` (stub) and `pattern-matcher.test.ts` (red tests)
- shared/ rules: zero runtime deps, no `console.*`, no browser/Node APIs
- Co-located test files per project convention
- Import card data via `loadCard('2026')` from `../card/card-loader` (within-package import, not barrel)

### Key Constants (from Story 2.1)
```typescript
GROUP_SIZES: { single: 1, pair: 2, pung: 3, kong: 4, quint: 5, sextet: 6, news: 4, dragon_set: 3 }
GROUP_TYPES: ['single', 'pair', 'pung', 'kong', 'quint', 'sextet', 'news', 'dragon_set']
```

### Card Data Facts (from Story 2.1 completion)
- 2026 card: 54 hands across 7 categories (2468, Quints, Consecutive Run, 13579, Winds-Dragons, 369, Singles and Pairs)
- Year digit 0 → Soap dragon
- Pairs: always `jokerEligible: false`; singles: always `jokerEligible: false`
- Groups of 3+: always `jokerEligible: true`
- `news` and `dragon_set` types: NO `tile` field (implicit composition)
- All other groups: MUST have a `tile` field

### Implicit Group Composition (Critical for Test Helpers)
- `news` = one each of N/E/W/S (4 tiles)
- `dragon_set` = one each of Red/Green/Soap (3 tiles)
- `specific: "any"` = any one specific tile in the category (matcher tries each)
- `any_different:N` = Nth distinct tile from a category

### Red Test Strategy
The pattern-matcher tests are intentionally written to FAIL. They define the acceptance criteria for Story 2.3. The approach:
1. Create a stub `validateHand()` that returns `null`
2. Write tests expecting specific match results for each hand
3. Tests compile but fail — this is the "red" in red-green-refactor
4. Story 2.3 implements the real `validateHand()` to make them green

### Building Valid Tile Arrays for Red Tests
For each hand pattern, the test helper must:
1. Read the hand's `groups` array
2. Resolve color-group wildcards (A→bam, B→crak, C→dot, or any permutation)
3. Resolve value wildcards (N→concrete value within valid range)
4. Expand `news` → [north, south, east, west], `dragon_set` → [red, green, soap]
5. For quints/sextets, fill with Jokers beyond the 4 natural copies
6. Return exactly 14 tiles as `Tile[]` (using tile IDs like `bam-3-1`)

### Existing Tile Types (from packages/shared/src/types/tiles.ts)
- `TileSuit`: `'bam' | 'crak' | 'dot'`
- `TileCategory`: `'suited' | 'wind' | 'dragon' | 'flower' | 'joker'`
- `WindValue`: `'north' | 'south' | 'east' | 'west'`
- `DragonValue`: `'red' | 'green' | 'soap'`
- `FlowerValue`: `'flower'`
- Tile ID format: `{suit}-{value}-{copy}` (e.g., `bam-3-1`)

### Existing Test Utilities
- `createTestState`, `buildHand`, `generateShuffledWall` in `@mahjong-game/shared/testing/helpers`
- Import within shared/ via relative path: `../testing/helpers`

### validateHand Stub Signature
```typescript
import type { Tile, NMJLCard } from '../types/card'

interface MatchResult {
  patternId: string
  patternName: string
  points: number
}

export function validateHand(tiles: Tile[], card: NMJLCard): MatchResult | null {
  return null // Stub — Story 2.3 implements
}
```

### Testing Framework
- Vitest (via `vite-plus/test`): `import { describe, test, expect } from 'vite-plus/test'`
- `restoreMocks: true`, `clearMocks: true` in vitest config
- Run: `pnpm -r test` from root or `vp test` from shared/

### Previous Story Intelligence (Story 2.1)
- 43 new tests added (16 type + 15 loader + 12 validation error), all passing
- Total test count at story completion: 205 (183 shared + 1 server + 21 client)
- `loadCard('2026')` returns fully validated `NMJLCard` — safe to use directly in tests
- `validateAndParse` is exported from `card-loader.ts` (not barrel) for direct testing
- JSON imports use static `import` with `resolveJsonModule: true`

### Story Boundary
This story delivers:
- `card-integrity.test.ts` — green tests validating card data correctness
- `pattern-matcher.test.ts` — red tests defining pattern matcher acceptance criteria
- `pattern-matcher.ts` — stub with `validateHand()` returning null

This story does NOT implement:
- The actual pattern matching algorithm (Story 2.3)
- Joker exchange validation (Story 2.4)
- Concealed/exposed hand validation logic (Story 2.5)
- Scoring/payment calculation (Story 2.6)

### Project Structure Notes
- All new files in `packages/shared/src/card/` — consistent with architecture table
- Barrel export in `packages/shared/src/index.ts` — add `validateHand` and `MatchResult` type
- No new dependencies needed

### References
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.2]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Card Data Schema, Pattern Matching Algorithm, Testing Requirements]
- [Source: _bmad-output/project-context.md — Testing Rules, shared/ Package Rules, Tile References]
- [Source: _bmad-output/implementation-artifacts/2-1-nmjl-card-data-schema-loader.md — Dev Notes, File List]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
