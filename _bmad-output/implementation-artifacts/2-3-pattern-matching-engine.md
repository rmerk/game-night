# Story 2.3: Pattern Matching Engine

Status: review

## Story

As a **developer**,
I want **a pattern matching engine that validates whether a set of 14 tiles matches any hand pattern on the NMJL card, supporting all pattern types including wildcards, mixed-tile groups, and Joker substitution**,
So that **Mahjong declarations can be auto-validated with zero-tolerance accuracy (FR49, FR65)**.

## Acceptance Criteria

1. **Valid hand match:** Given 14 tiles forming a valid hand, `validateHand(tiles, card)` returns `{ patternId, patternName, points }`.
2. **No match:** Given 14 tiles matching no hand, `validateHand(tiles, card)` returns `null`.
3. **Color-group wildcards:** Engine resolves A/B/C color groups to actual suits and matches all valid suit assignments (6 permutations for 3-color hands).
4. **Value wildcards:** Engine handles N, N+1, N+2 with value boundaries (N=8 means N+1=9, no N+2 possible) and only matches valid consecutive sequences.
5. **Mixed-tile groups:** Engine matches NEWS (one of each wind) and dragon_set (one of each dragon) correctly, not treating them as same-tile groups.
6. **Joker substitution:** Engine accepts Jokers as valid substitutes in groups of 3+ and correctly identifies the matched pattern.
7. **All red tests green:** ALL 71 `test.fails` tests from Story 2.2 pass — the test suite IS the specification.
8. **Performance:** Validation completes in under 100ms for any tile set (NFR8).

## Tasks / Subtasks

- [x] Task 1: Phase 1 — Fast filter to eliminate impossible hands (AC: 2, 8)
  - [x] 1.1 Create `categorizePlayerTiles(tiles)` — builds a summary of tile counts by category (suited per suit/value, winds, dragons, flowers, jokers)
  - [x] 1.2 Create `filterFeasibleHands(tileSummary, card)` — for each hand, check basic feasibility: enough tiles in the right categories, right suit count, enough jokers for groups needing them
  - [x] 1.3 Early exit: reject tile arrays that aren't exactly 14 tiles (returns null immediately)
- [x] Task 2: Phase 2 — Suit permutation and value range enumeration (AC: 3, 4)
  - [x] 2.1 Create `getSuitPermutations(pattern)` — extract distinct color letters from pattern, generate valid permutations (1 color = 3, 2 colors = 6, 3 colors = 6, no colors = 1)
  - [x] 2.2 Create `getValueRanges(pattern)` — extract N/N+1/N+2 usage, compute valid N range (1 to 9 bounded by max offset), return array of N values to try. Fixed values only = [0] sentinel
  - [x] 2.3 Create `resolvePattern(pattern, suitMapping, nValue)` — produce a concrete pattern with all wildcards resolved to specific suits and values
- [x] Task 3: Phase 2 — Group matching with Joker allocation (AC: 1, 5, 6)
  - [x] 3.1 Create `buildTilePool(tiles)` — index tiles by identity key (e.g., `suited:bam:3`, `wind:north`, `dragon:red`, `flower:a`, `joker`) with counts
  - [x] 3.2 Create `tryFillGroups(pool, concretePattern)` — for each group, attempt to fill from pool; Jokers substitute only in groups of 3+ (`jokerEligible`); pairs and singles must be exact matches
  - [x] 3.3 Handle NEWS groups: require one each of N/E/W/S from pool (Jokers can substitute if `jokerEligible`)
  - [x] 3.4 Handle dragon_set groups: require one each of red/green/soap from pool (Jokers can substitute if `jokerEligible`)
  - [x] 3.5 Handle `specific: "any"` tiles — try each possible value in the category (any wind, any dragon, any flower)
  - [x] 3.6 Handle `any_different:N` tiles — track which specifics have been claimed by previous groups to ensure distinct picks
- [x] Task 4: Assemble `validateHand` with Phase 1 + Phase 2 pipeline (AC: 1, 2, 7)
  - [x] 4.1 Wire up: filter → for each surviving hand → for each suit permutation → for each value range → resolve → fill → return best match (highest points)
  - [x] 4.2 Return `MatchResult` with `patternId`, `patternName` (from `hand.name ?? hand.id`), and `points`
  - [x] 4.3 Convert all 71 `test.fails` to `test` in `pattern-matcher.test.ts` — all must pass
- [x] Task 5: Performance validation and edge case hardening (AC: 7, 8)
  - [x] 5.1 Validation completes in <100ms (full suite runs in ~88ms for all 287 tests)
  - [x] 5.2 Verify all 6 suit permutation tests pass (section 2.3 in test file)
  - [x] 5.3 Verify all value boundary tests pass (section 2.4 — N=1, N=7, N=8)
  - [x] 5.4 Verify mixed-tile group tests pass (section 2.5 — NEWS, dragon_set)
  - [x] 5.5 Verify Joker substitution tests pass (section 2.6 — quints, sextets needing Jokers)
  - [x] 5.6 Verify Joker eligibility enforcement tests pass (section 2.7 — accept in kong, reject in pair/single)
  - [x] 5.7 Verify concealed hand acceptance test passes (section 2.8 — ev-5 valid concealed)
  - [x] 5.8 Verify negative tests still pass (section 2.9 — non-matching, incomplete, empty)
  - [x] 5.9 Run backpressure gate: `pnpm -r test && pnpm run typecheck && vp lint`

## Dev Notes

### Algorithm — Constraint Satisfaction with Backtracking

From architecture document — two-phase approach:

**Phase 1 — Filter impossible hands (fast):**
For each hand on the card, check basic feasibility: enough tiles in the right categories (suited, winds, dragons, flowers), right number of distinct suits. Eliminates 80-90% of hands cheaply.

**Phase 2 — Attempt assignment (per surviving hand):**
```
for each suitPermutation (max 6):
  for each valueRange (max 7-9):
    resolve concrete pattern
    try to fill groups from tile pool
    if all groups filled → match found
```

Total worst case per hand: ~42 attempts (6 suits x 7 values). With ~10 hands surviving Phase 1, ~420 total — trivial.

**Joker allocation:** Jokers can substitute in groups of 3+ (jokerEligible). The pool has 0-8 Jokers. When filling a group, use natural tiles first, then fill remaining slots with available Jokers. Greedy allocation works: try to fill each group in order. If a group can't be filled (not enough natural tiles + Jokers), the entire hand fails. No complex backtracking across groups needed because each group's tiles are non-overlapping (except for Joker pool).

### Existing Code — What Already Exists

**Stub to replace:** `packages/shared/src/card/pattern-matcher.ts` (13 lines)
```typescript
export interface MatchResult { patternId: string; patternName: string; points: number; }
export function validateHand(_tiles: Tile[], _card: NMJLCard): MatchResult | null { return null; }
```

**Red tests to turn green:** `packages/shared/src/card/pattern-matcher.test.ts` (916 lines)
- 54 hand-specific tests (one per hand, all 7 categories)
- 6 suit permutation tests
- 3 value boundary tests (N=1, N=7, N=8)
- 3 mixed-tile group tests (NEWS, dragon_set, both)
- 3 Joker substitution tests (quints, sextets)
- 2 Joker eligibility tests (accept in kong, reject in pair/single)
- 1 concealed hand acceptance test
- 3 negative tests (non-matching, incomplete, empty)
- `buildTilesForHand` helper — generates valid 14-tile arrays for any hand pattern
- Currently use `test.fails` — must be changed to `test` when matcher works

**Key types** (from `packages/shared/src/types/card.ts`):
- `GroupType`: single | pair | pung | kong | quint | sextet | news | dragon_set
- `TileRequirement`: `{ color?, value?, category?, specific? }`
- `GroupPattern`: `{ type, tile?, jokerEligible, concealed? }`
- `HandPattern`: `{ id, name?, points, exposure, groups[] }`
- `NMJLCard`: `{ year, categories[] }`

**Tile types** (from `packages/shared/src/types/tiles.ts`):
- `Tile` discriminated union: SuitedTile | WindTile | DragonTile | FlowerTile | JokerTile
- ID format: `{suit}-{value}-{copy}` (e.g., `bam-3-2`)
- Categories: suited, wind, dragon, flower, joker

**Constants** (from `packages/shared/src/constants.ts`):
- `GROUP_SIZES`: { single: 1, pair: 2, pung: 3, kong: 4, quint: 5, sextet: 6, news: 4, dragon_set: 3 }
- `SUITS`: ["bam", "crak", "dot"]
- `WINDS`: ["north", "east", "west", "south"]
- `DRAGONS`: ["red", "green", "soap"]
- `FLOWERS`: ["a", "b"]

**Card data:** `packages/shared/data/cards/2026.json` — 54 hands across 7 categories

### Critical Implementation Details

1. **Color wildcards (A/B/C):** Same letter = same suit. Different letter = different suit. Pattern may use 0, 1, 2, or 3 color letters. Extract distinct colors from all groups in a hand, then generate permutations of suit assignments.

2. **Value wildcards:** `"N"` = any value 1-9. `"N+1"` = N+1. `"N+2"` = N+2. If pattern uses N+2, then N range is 1..7. If N+1, N range is 1..8. If only N, range is 1..9. Some patterns have fixed values (e.g., `value: 2`) — these aren't wildcards.

3. **NEWS group:** 4 tiles, one each of north/east/west/south. No `tile` field on the GroupPattern. jokerEligible is true (can substitute Jokers). Each wind tile must be distinct.

4. **dragon_set group:** 3 tiles, one each of red/green/soap. No `tile` field. jokerEligible is true.

5. **`specific: "any"`:** Any single tile in the category. For flowers: "a" or "b". For winds: any one wind. For dragons: any one dragon. The matcher must try each possibility.

6. **`any_different:N`:** The Nth distinct tile from a category across the entire hand. E.g., if a hand has two dragon groups with `any_different:1` and `any_different:2`, the first picks one dragon and the second picks a different one.

7. **Joker substitution in pool:** When building the tile pool, Joker tiles (category "joker") go into a separate Joker count. When filling a group with `jokerEligible: true`, natural tiles are matched first, then remaining slots filled from Joker pool. Groups with `jokerEligible: false` (pairs, singles) cannot use Jokers at all.

8. **Concealed/exposed validation:** Story 2.3 validates that tiles match the pattern. Story 2.5 adds the concealed/exposed constraint check against exposed groups. The test file has a `test.todo` for concealed rejection (deferred to 2.5). The concealed acceptance test (ev-5) just verifies the tiles match — no exposure context needed.

### Scope Boundary

**IN scope:** Implement `validateHand(tiles, card)` that takes a flat Tile[] and NMJLCard, returns MatchResult | null. Make all 71 red tests green.

**OUT of scope:**
- Concealed/exposed constraint validation against exposed groups (Story 2.5)
- Joker exchange validation (Story 2.4)
- Hand guidance / closeness ranking (Epic 5B)
- Scoring / payment calculation (Story 2.6)
- The `validateHand` signature stays as `(tiles: Tile[], card: NMJLCard)` — no `exposed` parameter yet (Story 2.5 will extend)

### Previous Story Intelligence (Story 2.2)

- `buildTilesForHand` helper is well-tested and reliable — it generates valid 14-tile arrays by resolving color/value wildcards and implicit groups
- `loadCard('2026')` is fast and cached — safe to call in test setup
- Lint warnings (6) are all type assertions in test helpers — acceptable
- Test count at 2.2 completion: 238 passed + 71 expected fail + 1 todo
- After 2.3: those 71 `test.fails` become regular `test` and should all pass
- The `MatchResult` interface and `validateHand` export already exist in barrel `shared/src/index.ts`

### Testing Framework
- `import { describe, test, expect } from 'vite-plus/test'`
- `restoreMocks: true`, `clearMocks: true` in vitest config
- Run: `pnpm -r test` from root or `vp test` from shared/
- Backpressure gate: `pnpm -r test && pnpm run typecheck && vp lint`

### Project Structure Notes
- All implementation in `packages/shared/src/card/pattern-matcher.ts` — replace stub with real implementation
- Keep helper functions private (not exported from barrel) unless needed by other modules
- Test file `pattern-matcher.test.ts` already exists — only change `test.fails` to `test`
- No new files needed unless implementation exceeds 300 lines (extract to helpers in same directory if so)
- No new dependencies needed

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.3]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Novel Pattern: NMJL Pattern Matching Algorithm]
- [Source: _bmad-output/project-context.md — shared/ Package Rules, Tile References, Performance Rules]
- [Source: _bmad-output/implementation-artifacts/2-2-card-data-integrity-test-suite.md — Dev Notes, Completion Notes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Code Review

**Verdict: Approved** (Claude Opus 4.6 code-reviewer)

Findings addressed in commit `fix(shared): address code review findings for story 2-3`:
1. Removed unused `groupCount` field from `best` match tracking (dead code from draft tiebreaker approach)
2. Simplified redundant ternary `t.category === "suited" ? "suited" : t.category` to `t.category`

### Debug Log References

### Completion Notes List

- Implemented two-phase pattern matching: Phase 1 fast feasibility filter eliminates ~80-90% of hands, Phase 2 does constraint satisfaction with suit permutations × value ranges × group matching
- Joker allocation uses backtracking (tries variable joker counts per eligible group) rather than greedy allocation, which is necessary for hands where a pung needs to share natural tiles with a non-joker-eligible pair (e.g., wd-3)
- Returns highest-scoring match (not first match) to handle cases where tiles for a high-point hand (e.g., ev-4 at 35pts) also match a lower-point hand (e.g., ev-2 at 25pts) that appears earlier in card iteration
- sp-7 (NEWS Singles Frame) and wd-1 (NEWS Double Kong) generate structurally identical tiles (4 winds + 2 suited kongs + dragon pair) at the same point value (25pts). Test relaxed to accept either match since `validateHand` is a pure function and must return the same result for identical inputs.
- Fixed `buildRandomNonMatchingTiles` test helper: original 7 bam pairs (values 1-7) matched sp-4 (Suited Pairs). Changed to cross-suit pairs that match no hand pattern.
- All 287 tests pass, 1 todo (concealed/exposed validation deferred to Story 2.5)
- Full suite runs in ~88ms (well under 100ms NFR8 target)

### Change Log

- `packages/shared/src/card/pattern-matcher.ts` — replaced 13-line stub with ~300-line pattern matching engine
- `packages/shared/src/card/pattern-matcher.test.ts` — converted 71 `test.fails` to `test`; fixed `buildRandomNonMatchingTiles` to use cross-suit pairs; relaxed sp-7 test to accept wd-1 (equivalent match)

### File List

- `packages/shared/src/card/pattern-matcher.ts`
- `packages/shared/src/card/pattern-matcher.test.ts`
