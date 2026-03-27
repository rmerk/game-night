# Story 2.1: NMJL Card Data Schema & Loader

Status: done

## Story

As a **developer**,
I want **a JSON schema for NMJL card data using the color-group suit abstraction, and a loader that parses card files at runtime**,
So that **the card data is structured for machine-readable pattern matching and can be updated yearly without code changes**.

## Acceptance Criteria

1. **Given** the card schema types in shared/ **When** reviewing the TypeScript interfaces **Then** they support: `NMJLCard` with `year` and `categories`, `CardCategory` with `name` and `hands`, `HandPattern` with `id`, `points`, `exposure` (C/X), and `groups`, `GroupPattern` with `type` (single/pair/pung/kong/quint/sextet/news/dragon_set), `tile` requirement, `jokerEligible`, and `concealed` flag

2. **Given** the color-group abstraction **When** encoding a hand pattern **Then** colors A/B/C represent same-suit/different-suit relationships, value wildcards (N, N+1, N+2) represent consecutive values, and specific tiles (winds, dragons, flowers) are encoded by category (AR9)

3. **Given** a valid card JSON file (2026.json) **When** `loadCard('2026')` is called **Then** it returns a fully typed `NMJLCard` object with all categories and hand patterns parsed

4. **Given** an invalid or missing card file **When** `loadCard` is called **Then** it throws a descriptive error identifying what's wrong (missing file, malformed JSON, schema violation)

5. **Given** the card data directory **When** checking available card files **Then** `2026.json` exists as the current year's card and `2025.json` exists for internal testing of the yearly update process (FR48)

## Tasks / Subtasks

- [x] Task 1: Create card schema TypeScript types (AC: 1, 2)
  - [x] 1.1 Create `packages/shared/src/types/card.ts` with `NMJLCard`, `CardCategory`, `HandPattern`, `GroupPattern`, `TileRequirement`, `TileSpecific` interfaces
  - [x] 1.2 Export all new types from `packages/shared/src/index.ts`
  - [x] 1.3 Create `packages/shared/src/types/card.test.ts` — compile-time type tests verifying the interfaces accept valid data and reject invalid shapes

- [x] Task 2: Create card data JSON files (AC: 5)
  - [x] 2.1 Create `packages/shared/data/cards/` directory
  - [x] 2.2 Create `packages/shared/data/cards/2026.json` with all ~50+ NMJL 2026 hands encoded per the schema
  - [x] 2.3 Create `packages/shared/data/cards/2025.json` for testing the yearly update process
  - [x] 2.4 Create `packages/shared/data/card-schema.json` (optional JSON Schema for external validation) — SKIPPED: runtime validation in loader serves same purpose

- [x] Task 3: Create card loader (AC: 3, 4)
  - [x] 3.1 Create `packages/shared/src/card/card-loader.ts` with `loadCard(year: string): NMJLCard`
  - [x] 3.2 Implement JSON import + runtime schema validation (verify structure, types, group sizes, tile counts)
  - [x] 3.3 Create `packages/shared/src/card/card-loader.test.ts` — tests for valid loading, missing file, malformed JSON, schema violations

- [x] Task 4: Add card-related constants (AC: 1)
  - [x] 4.1 Add group type constants and group size mapping to `constants.ts` or new `card/constants.ts`
  - [x] 4.2 Export new constants from barrel

## Dev Notes

### Architecture Compliance

**AR9 (Decision 5): NMJL Card Data Schema** — This is the defining architectural decision for this story. Follow the schema from `game-architecture.md` exactly. The schema was validated in a spike (see card-schema-spike-2026-03-26.md) against 6 edge-case hands with zero issues.

**shared/ Package Rules:** Zero runtime dependencies. No `console.*`. No browser/Node APIs. The card loader must work in both client and server environments.

**File Creation Checklist:** Every new `.ts` file gets a co-located `.test.ts` file.

### Schema Types — EXACT Spec (from Architecture Decision 5)

```typescript
interface NMJLCard {
  year: number
  categories: CardCategory[]
}

interface CardCategory {
  name: string
  hands: HandPattern[]
}

interface HandPattern {
  id: string
  name?: string
  points: number
  exposure: 'X' | 'C'
  groups: GroupPattern[]
}

interface GroupPattern {
  type: 'single' | 'pair' | 'pung' | 'kong' | 'quint' | 'sextet' | 'news' | 'dragon_set'
  tile?: TileRequirement
  jokerEligible: boolean
  concealed?: boolean
}

interface TileRequirement {
  color?: string            // "A", "B", "C"
  value?: number | string   // exact number, or "N", "N+1", "N+2"
  category?: 'flower' | 'wind' | 'dragon'
  specific?: TileSpecific
}

type TileSpecific =
  | 'north' | 'south' | 'east' | 'west'       // specific wind
  | 'red' | 'green' | 'soap'                   // specific dragon
  | 'any'                                       // any tile in the category
  | `any_different:${number}`                   // Nth distinct tile (for mixed sets)
```

Do NOT modify these types. They are the architecture specification. Additional utility types (e.g., `GroupType`, `GroupSizeMap`) are fine, but the core interfaces must match exactly.

### Color-Group Abstraction — Critical Understanding

This is the most important concept for encoding hands:

- **Same letter = same suit.** `color: "A"` on two groups means those groups share a suit. The matcher tries all 3! = 6 suit permutations (A=Bam/B=Crak/C=Dot, etc.).
- **Different letters = different suits.** `color: "A"` and `color: "B"` on two groups guarantees different suits.
- **Value wildcards:** `"N"` = any value 1-9. `"N+1"` = one more than N. `"N+2"` = two more than N. N+2 constrains N ≤ 7.
- **Non-suited tiles** (winds, dragons, flowers) use `category` + `specific` instead of `color` + `value`.

### Implicit Group Composition Rules

- **`news` type** has NO `tile` field — composition is always one each of North, East, West, South. Jokers can substitute.
- **`dragon_set` type** has NO `tile` field — composition is always one each of Red, Green, Soap. Jokers can substitute.
- **`specific: "any"`** means "any one specific tile in the category, all copies matching." For `{ category: "dragon", specific: "any", type: "pair" }` → pair of Red OR pair of Green OR pair of Soap. Matcher tries each option.
- **`any_different:N`** is for hands needing "different" tiles from same category without specifying which. E.g., "pung of one dragon + pung of a different dragon" → `any_different:1` + `any_different:2`. Uncommon but must be supported.

### Card Loader Design

The loader must:
1. Import the JSON file (static import or dynamic — see below)
2. Validate structure at runtime (don't trust raw JSON)
3. Return a fully typed `NMJLCard` object
4. Throw descriptive errors for any issues

**JSON Import Strategy:** Since shared/ must be environment-agnostic (no `fs`, no `fetch`), the card data should be imported as static JSON modules. TypeScript supports `import cardData from '../data/cards/2026.json'` with `resolveJsonModule: true` in tsconfig. The `loadCard` function validates and returns the typed data.

```typescript
// card-loader.ts approach:
import card2026 from '../../data/cards/2026.json'
import card2025 from '../../data/cards/2025.json'

const cards: Record<string, unknown> = {
  '2026': card2026,
  '2025': card2025,
}

export function loadCard(year: string): NMJLCard {
  const raw = cards[year]
  if (!raw) throw new Error(`Card data not found for year: ${year}`)
  return validateAndParse(raw) // Runtime validation
}
```

**Runtime Validation (`validateAndParse`):** Write a focused validation function that checks:
- `year` is a number
- `categories` is a non-empty array
- Each category has `name` (string) and `hands` (non-empty array)
- Each hand has `id` (string), `points` (positive number), `exposure` ('X' or 'C'), `groups` (non-empty array)
- Each group has valid `type`, `jokerEligible` (boolean), optional `concealed` (boolean)
- `tile` field present where required (not for `news`/`dragon_set`), absent/optional where not
- Joker eligibility follows rules: true only for groups of size 3+ (pung, kong, quint, sextet, news, dragon_set)
- Each hand's groups sum to exactly 14 tiles
- No duplicate hand IDs across the card

Do NOT use a schema validation library (no Zod, no Ajv). Write the validation manually to keep shared/ dependency-free.

### Group Size Constants

```typescript
export const GROUP_SIZES: Record<GroupPattern['type'], number> = {
  single: 1,
  pair: 2,
  pung: 3,
  kong: 4,
  quint: 5,
  sextet: 6,
  news: 4,
  dragon_set: 3,
}
```

Use this map in validation (hand total = 14) and later in the pattern matcher.

### Card Data Encoding — Practical Guidance

The 2026 NMJL card has ~50+ hands across categories like:
- 2468 (even number hands)
- Quints
- Consecutive Run
- 13579 (odd number hands)
- Winds-Dragons
- 369
- Singles and Pairs

Each hand must be encoded following the spike examples (see references). Key encoding patterns:
- **Year digits (2-0-2-6):** 0 → Soap dragon (`{ category: "dragon", specific: "soap" }`)
- **Same suit across groups:** Use same color letter (A, A, A)
- **Different suits across groups:** Use different color letters (A, B, C)
- **Pairs always have `jokerEligible: false`** — NMJL rule
- **Singles always have `jokerEligible: false`** — NMJL rule
- **All groups of 3+ have `jokerEligible: true`** (unless the hand specifically restricts it, which is rare)

### What NOT to Build

- **No pattern matching engine** — that's Story 2.3
- **No hand guidance** — that's deferred to Epic 5B
- **No Joker exchange validation** — that's Story 2.4
- **No scoring** — that's Story 2.6
- **No red tests for the pattern matcher** — that's Story 2.2's job. Do NOT pre-implement Story 2.2.
- **No card display UI** — that's Epic 5B
- **No JSON Schema validation library** — manual validation keeps shared/ dependency-free

### Critical: Story Boundary Enforcement

Epic 1 retrospective identified story scope bleed as a challenge. This story delivers ONLY:
1. TypeScript type definitions for the card schema
2. Card data JSON files (2026 + 2025)
3. A loader function that parses and validates card files
4. Tests for the loader

Do NOT write pattern matching tests, hand validation logic, or anything belonging to Stories 2.2-2.6. The Epic 2 story boundaries encode TDD methodology — Story 2.2 writes red tests, Story 2.3 makes them green. Pre-implementing would destroy the safety net.

### Existing Code to Reuse

**Tile type system** — already defined in `packages/shared/src/types/tiles.ts`:
- `TileSuit = 'bam' | 'crak' | 'dot'`
- `TileCategory = 'suited' | 'wind' | 'dragon' | 'flower' | 'joker'`
- `TileValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9`
- `WindValue = 'north' | 'east' | 'west' | 'south'`
- `DragonValue = 'red' | 'green' | 'soap'`
- `FlowerValue = 'a' | 'b'`

**Constants** — in `packages/shared/src/constants.ts`:
- `SUITS`, `WINDS`, `DRAGONS`, `FLOWERS`, `TILE_VALUES` — use these in validation, not hardcoded arrays

**Barrel exports** — `packages/shared/src/index.ts` — add new types and card loader here

### Testing Strategy

**card.test.ts (type tests):**
- Verify interfaces compile with valid data
- Verify type errors for invalid shapes (use `@ts-expect-error` annotations)
- Test `TileSpecific` template literal type accepts valid strings, rejects invalid

**card-loader.test.ts:**
- `loadCard('2026')` returns valid `NMJLCard` with correct year
- `loadCard('2026')` returns object with non-empty categories
- `loadCard('9999')` throws "Card data not found"
- Malformed data throws descriptive error (test by mocking)
- All loaded hands have exactly 14 tiles (sum of group sizes)
- All loaded hands have non-empty group arrays
- No duplicate hand IDs across entire card
- All groups have valid `type` values
- Joker eligibility is correct per group type (false for pairs/singles, true for 3+)
- Concealed hands have appropriate group-level concealed flags

**card-integrity.test.ts** — Story 2.2 will create the exhaustive test suite. Do NOT create this file in Story 2.1. Only test the loader's validation logic, not card data correctness.

### File Placement

```
packages/shared/
├── src/
│   ├── types/
│   │   ├── card.ts              # NEW — NMJLCard, HandPattern, GroupPattern, TileRequirement
│   │   └── card.test.ts         # NEW — Type-level tests
│   ├── card/
│   │   ├── card-loader.ts       # NEW — loadCard(), validateAndParse()
│   │   └── card-loader.test.ts  # NEW — Loader validation tests
│   ├── constants.ts             # MODIFIED — add GROUP_SIZES map
│   └── index.ts                 # MODIFIED — export new types + loadCard
├── data/
│   └── cards/
│       ├── 2026.json            # NEW — Full 2026 NMJL card data
│       └── 2025.json            # NEW — Previous year for testing
```

### Import Convention (CRITICAL)

Within the shared package, import from specific files:
```typescript
// CORRECT (within shared/):
import type { NMJLCard, HandPattern } from '../types/card'
import { GROUP_SIZES } from '../constants'

// WRONG (within shared/):
import type { NMJLCard } from '@mahjong-game/shared'
```

From other packages (client/server):
```typescript
// CORRECT (from client or server):
import type { NMJLCard, HandPattern } from '@mahjong-game/shared'
import { loadCard } from '@mahjong-game/shared'
```

### tsconfig.json Requirement

Ensure `resolveJsonModule: true` is set in `packages/shared/tsconfig.json` to support importing `.json` files. Check if already set before modifying.

### Previous Epic Intelligence

**From Epic 1 Retrospective:**
- Max 2 review rounds per story target (action item from retro)
- Apply defensive coding patterns proactively — don't wait for review to find the same issue in multiple places
- Story boundary enforcement is critical — do NOT pre-implement Stories 2.2-2.6
- Model consistency: use Opus throughout Epic 2

**From Story 1.7 (last completed story):**
- 162 tests passing across all packages, 0 failures
- `shallowRef` + `triggerRef` pattern for Vue reactivity over mutated game state
- `import.meta.env.DEV` for dev-only gating (not relevant for this story but pattern to know)
- Co-located test files remain the standard

**From Git history (4 commits total):**
- Clean monorepo structure with pnpm workspaces
- TypeScript strict mode throughout
- Test fixtures and helpers in `shared/src/testing/`
- Existing testing infrastructure: Vitest, co-located `.test.ts` files

### Project Structure Notes

- Monorepo: `packages/shared`, `packages/client`, `packages/server`
- Tests: `pnpm -r test` (all packages) or `pnpm --filter @mahjong-game/shared test`
- TypeScript strict mode enforced, no `any` types
- Shared package consumed via source imports (no build step needed)
- No existing `card/` directory in shared/src — this story creates it

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.1 (lines 866-893)]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Decision 5: NMJL Card Data Schema (lines 575-633)]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Novel Pattern: NMJL Pattern Matching Algorithm (lines 1398-1478)]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Directory Structure, card/ section (lines 1027-1048)]
- [Source: _bmad-output/planning-artifacts/card-schema-spike-2026-03-26.md — Schema validation with 6 edge-case hands]
- [Source: _bmad-output/planning-artifacts/gdd.md — NMJL Card Data Schema Requirements (lines 684-717)]
- [Source: _bmad-output/planning-artifacts/gdd.md — Tile Set Composition (lines 192-203)]
- [Source: _bmad-output/planning-artifacts/gdd.md — Joker Rules (lines 364-379)]
- [Source: _bmad-output/planning-artifacts/gdd.md — Group Definitions (lines 233-246)]
- [Source: _bmad-output/project-context.md — shared/ Package Rules, Testing Rules]
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-03-26.md — Action items for Epic 2]
- [Source: packages/shared/src/types/tiles.ts — Existing tile type definitions]
- [Source: packages/shared/src/constants.ts — Existing tile constants (SUITS, WINDS, etc.)]
- [Source: packages/shared/src/index.ts — Barrel exports to extend]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Client test flake: TestHarness discard test occasionally fails due to seed-based joker-first draw. Pre-existing issue, not related to this story.

### Completion Notes List

- Created TypeScript type definitions matching architecture Decision 5 exactly: `NMJLCard`, `CardCategory`, `HandPattern`, `GroupPattern`, `TileRequirement`, `TileSpecific`, `GroupType`
- Added `GROUP_TYPES` array and `GROUP_SIZES` record constants to shared constants
- Created 2026 card data with 54 hands across 7 categories (2468, Quints, Consecutive Run, 13579, Winds-Dragons, 369, Singles and Pairs)
- Created 2025 card data with 7 hands across 4 categories for yearly update testing
- Implemented `loadCard()` with comprehensive runtime validation: structure checks, type validation, 14-tile group sum enforcement, duplicate ID detection, joker eligibility rules, news/dragon_set implicit tile constraints
- All validation is manual (no Zod/Ajv) to keep shared/ dependency-free
- JSON imports use static `import` with `resolveJsonModule: true` (already set in base tsconfig)
- 16 type tests + 15 loader tests + 12 validation error tests = 43 new tests, all passing
- Full regression suite: 205 tests passing (183 shared + 1 server + 21 client)

### Change Log

- 2026-03-27: Story 2.1 implementation complete — card schema types, card data (2026+2025), loader with runtime validation, tests
- 2026-03-27: Code review fix — added 12 validation error path tests to card-loader.test.ts, exported validateAndParse for direct testing

### File List

- packages/shared/src/types/card.ts (NEW)
- packages/shared/src/types/card.test.ts (NEW)
- packages/shared/src/card/card-loader.ts (NEW)
- packages/shared/src/card/card-loader.test.ts (NEW)
- packages/shared/data/cards/2026.json (NEW)
- packages/shared/data/cards/2025.json (NEW)
- packages/shared/src/constants.ts (MODIFIED — added GROUP_TYPES, GROUP_SIZES)
- packages/shared/src/index.ts (MODIFIED — added card type exports, loadCard export, GROUP_TYPES/GROUP_SIZES exports)
