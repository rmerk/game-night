# Story 1.2: Tile Definitions & Wall Creation

Status: done

## Story

As a **developer**,
I want **a complete tile type system and wall creation module that defines all 152 American Mahjong tiles with deterministic IDs and shuffling**,
So that **the game engine has a correct, testable tile set to work with**.

## Acceptance Criteria

1. **Given** the tile definitions in shared/, **When** all tile types are enumerated, **Then** there are exactly 152 tiles: 108 suited (Bam/Crak/Dot 1-9 x4 each), 16 Winds (N/E/W/S x4), 12 Dragons (Red/Green/White x4), 8 Flowers (A/B x4 each), 8 Jokers
2. **Given** a tile is created, **When** its ID is generated, **Then** the ID follows the `{suit}-{value}-{copy}` convention (e.g., `bam-3-2` for the second copy of 3-Bam, `joker-5` for the fifth Joker)
3. **Given** the wall creation function is called, **When** a wall is created, **Then** it contains all 152 tiles in shuffled order
4. **Given** the wall creation function is called twice with different seeds, **When** comparing the two walls, **Then** the tile order differs (shuffle is random)
5. **Given** a created wall, **When** checking tile counts by category, **Then** counts match the tile set composition table exactly (108 suited, 16 winds, 12 dragons, 8 flowers, 8 jokers)

## Tasks / Subtasks

- [x] Task 1: Create tile type definitions (AC: #1, #2)
  - [x] Create `packages/shared/src/types/tiles.ts` with `Tile`, `TileId`, `TileSuit`, `TileCategory`, `TileValue`, `WindValue`, `DragonValue` types
  - [x] Define `TileSuit` as `'bam' | 'crak' | 'dot'`
  - [x] Define `TileCategory` as `'suited' | 'wind' | 'dragon' | 'flower' | 'joker'`
  - [x] Define `WindValue` as `'north' | 'east' | 'west' | 'south'`
  - [x] Define `DragonValue` as `'red' | 'green' | 'soap'` (White Dragon = Soap)
  - [x] Define `Tile` interface with `id: TileId`, `category: TileCategory`, `suit?: TileSuit`, `value`, `copy: number`
  - [x] Create `packages/shared/src/types/tiles.test.ts` with type-level tests
- [x] Task 2: Create tile constants and generation (AC: #1, #2, #5)
  - [x] Add to `packages/shared/src/constants.ts`: `TILE_COUNT = 152`, `JOKER_COUNT = 8`, `SUITED_TILES_PER_VALUE = 4`, etc.
  - [x] Create `packages/shared/src/engine/state/wall.ts` with `createAllTiles(): Tile[]` function
  - [x] Generate 108 suited tiles: Bam/Crak/Dot 1-9 x4 copies each, IDs like `bam-3-2`
  - [x] Generate 16 wind tiles: N/E/W/S x4 copies each, IDs like `wind-north-3`
  - [x] Generate 12 dragon tiles: Red/Green/Soap x4 copies each, IDs like `dragon-red-2`
  - [x] Generate 8 flower tiles: A/B x4 copies each, IDs like `flower-a-3`
  - [x] Generate 8 joker tiles: IDs `joker-1` through `joker-8`
- [x] Task 3: Implement seeded PRNG and wall shuffle (AC: #3, #4)
  - [x] Implement a seeded PRNG in `wall.ts` (e.g., mulberry32 or xoshiro — lightweight, deterministic)
  - [x] Create `createWall(seed?: number): Tile[]` that shuffles all 152 tiles using Fisher-Yates with seeded PRNG
  - [x] If no seed provided, generate one from `Math.random()` (production) — seed only used for test reproducibility
  - [x] Expose `generateShuffledWall(seed?: number): Tile[]` from testing helpers
- [x] Task 4: Write comprehensive tests (AC: #1-5)
  - [x] Create `packages/shared/src/engine/state/wall.test.ts`
  - [x] Test: `createAllTiles()` returns exactly 152 tiles
  - [x] Test: Tile count by category (108 suited, 16 winds, 12 dragons, 8 flowers, 8 jokers)
  - [x] Test: All tile IDs are unique across the full set
  - [x] Test: Tile IDs follow `{category}-{value}-{copy}` convention
  - [x] Test: `createWall()` returns 152 tiles in shuffled order
  - [x] Test: Same seed produces identical wall order (deterministic)
  - [x] Test: Different seeds produce different wall orders
  - [x] Test: No seed produces different results on repeated calls (non-deterministic)
  - [x] Test: Suited tiles have correct suit and value ranges (1-9)
  - [x] Test: Copy numbers are 1-4 for regular tiles, 1-8 for jokers, 1-4 for flowers
- [x] Task 5: Update barrel export and create test helpers (AC: all)
  - [x] Export `Tile`, `TileId`, `TileSuit`, `TileCategory` types from `packages/shared/src/index.ts`
  - [x] Export `TILE_COUNT`, `JOKER_COUNT` constants from barrel
  - [x] Create `packages/shared/src/testing/helpers.ts` with `generateShuffledWall(seed?)` and `buildHand(tileIds: string[])`
  - [x] Create `packages/shared/src/testing/tile-builders.ts` with convenience functions for creating specific tiles in tests
  - [x] Remove `packages/shared/src/placeholder.test.ts` (replaced by real tests)

## Dev Notes

### Tile ID Convention — CRITICAL

Tile IDs include a **copy suffix** to distinguish identical tiles. There are 4 copies of most tiles. `bam-3` is NOT a valid tile ID — `bam-3-1` through `bam-3-4` are.

**ID format by category:**
| Category | Format | Examples |
|---|---|---|
| Suited | `{suit}-{value}-{copy}` | `bam-3-2`, `crak-9-4`, `dot-1-1` |
| Wind | `wind-{direction}-{copy}` | `wind-north-1`, `wind-east-3` |
| Dragon | `dragon-{color}-{copy}` | `dragon-red-2`, `dragon-soap-4` |
| Flower | `flower-{type}-{copy}` | `flower-a-1`, `flower-b-4` |
| Joker | `joker-{copy}` | `joker-1`, `joker-5`, `joker-8` |

These IDs are stable for the entire game duration. All downstream systems (pattern matching, Joker exchange, UI components) reference tiles by ID, never by array index.

**SVG sprite symbol IDs** (for future Epic 5A) use the base form without copy suffix: `bam-3`, `wind-north`, `joker`, `flower-a`. The copy suffix is for game-state identity only.

### Tile Set Composition Table

| Category | Tiles | Count per | Total |
|---|---|---|---|
| Suited (Bam) | 1-9 | 4 each | 36 |
| Suited (Crak) | 1-9 | 4 each | 36 |
| Suited (Dot) | 1-9 | 4 each | 36 |
| Winds | N/E/W/S | 4 each | 16 |
| Dragons | Red/Green/Soap | 4 each | 12 |
| Flowers | A/B | 4 each | 8 |
| Jokers | Joker | 8 | 8 |
| **Total** | | | **152** |

### Important Tile Rules for Type Design

- **White Dragon = Soap.** Use `'soap'` not `'white'` in the type system. The NMJL card and American Mahjong community consistently use "Soap."
- **Flowers are regular tiles** in American Mahjong — they are held in hand, passed in Charleston, used in groups. They are NOT auto-revealed or set aside (unlike Chinese/Hong Kong variants).
- **NEWS is NOT a kong.** It's 4 different wind tiles (singles). The type system must not conflate "4 winds" with "kong of winds."
- **Year digits (2-0-2-6) are singles.** The pattern matching engine (Epic 2) maps `0` to Soap/White Dragon.
- **Jokers cannot be discarded** (FR51) — enforced in Story 1.5, not here. But the type system should not prevent it at the type level (it's a game rule, not a type constraint).

### Seeded PRNG — MANDATORY for wall shuffle

**Never use `Math.random()` for wall shuffle.** `Math.random()` is non-deterministic and untestable.

Implement a lightweight seeded PRNG (e.g., mulberry32):
```typescript
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
```

Use Fisher-Yates shuffle with the seeded PRNG. When no seed is provided, derive one from `Math.random()` for production use. The seed parameter exists for test reproducibility.

### shared/ Package Rules — MUST FOLLOW

- Zero runtime dependencies. Only `devDependencies`.
- No `console.*` — Logger interface isn't created yet; for now, don't log. Tests use Vitest assertions.
- No browser APIs (`window`, `document`, `localStorage`)
- No Node.js APIs (`fs`, `process`, `Buffer`)
- Import types within shared/ from specific files (`../types/tiles`), NOT from barrel (`index.ts`)
- All exports go through the barrel `index.ts` for external consumers

### File Structure — Exact Paths

```
packages/shared/src/
├── types/
│   └── tiles.ts              # Tile, TileId, TileSuit, TileCategory types
├── engine/
│   └── state/
│       ├── wall.ts           # createAllTiles(), createWall(seed?), seeded PRNG
│       └── wall.test.ts      # Comprehensive tile + wall tests
├── testing/
│   ├── helpers.ts            # generateShuffledWall(seed?), buildHand()
│   └── tile-builders.ts      # Convenience tile creation for tests
├── constants.ts              # TILE_COUNT, JOKER_COUNT, MAX_PLAYERS, SEATS
└── index.ts                  # Barrel export (updated)
```

Create directories as needed: `types/`, `engine/state/`, `testing/`.

### Testing Standards

- Co-located tests: `wall.ts` → `wall.test.ts` in the same directory
- Vitest with `restoreMocks: true`, `clearMocks: true` (already configured)
- Test file pattern: `src/**/*.test.ts`
- Run: `pnpm --filter @mahjong-game/shared test`
- Do NOT mock the tile generation — test the real implementation with known seeds
- Test helpers in `testing/` are excluded from production coverage

### What NOT to Do

- Do NOT create game state types yet — that's Story 1.3
- Do NOT create action types — that's Story 1.3+
- Do NOT create the game engine (`game-engine.ts`) — that's Story 1.3
- Do NOT create the Logger interface — that comes later
- Do NOT create dealing logic — that's Story 1.3
- Do NOT add `console.log` anywhere in shared/
- Do NOT use `any` type — TypeScript strict mode is on
- Do NOT use `setTimeout` in shared/
- Do NOT pre-create directories for card/, validation/, actions/ — those are future stories

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| TypeScript files | kebab-case | `wall.ts`, `tile-builders.ts` |
| Types/Interfaces | PascalCase | `Tile`, `TileId`, `TileSuit` |
| Constants | UPPER_SNAKE_CASE | `TILE_COUNT`, `JOKER_COUNT` |
| Functions | camelCase | `createWall`, `createAllTiles` |
| Test files | match source + `.test.ts` | `wall.test.ts` |

### Previous Story (1.1) Intelligence

**Completed:** Full monorepo setup with pnpm workspaces, TypeScript strict mode, Vitest in all packages, Vite 8 client, Fastify server.

**Key learnings:**
- `@vitejs/plugin-vue` needed v6 for Vite 8 compatibility (v5 had peer dep issues)
- `.vue` SFC type declarations needed in `env.d.ts` for `tsc --build`
- `typescript` needed in root devDependencies for `tsc --build` from project root
- `pnpm.onlyBuiltDependencies` needed for esbuild postinstall
- Shared package barrel (`index.ts`) is currently empty — ready for tile type exports

**Current state of shared/src/index.ts:** Empty barrel export. Add tile types and constants here.

**Current state of constants.ts:** Does not exist yet. Create it.

### Project Structure Notes

- All paths must be within `packages/shared/src/` for this story
- Feature-based organization: types in `types/`, engine logic in `engine/state/`, test helpers in `testing/`
- The `engine/state/` directory nests under `engine/` because future stories add `engine/actions/`, `engine/validation/`, and the top-level `engine/game-engine.ts`

### References

- [Source: epics.md#Story 1.2] — Acceptance criteria and story requirements
- [Source: game-architecture.md#Project Structure] — Directory structure showing `types/tiles.ts`, `engine/state/wall.ts`
- [Source: game-architecture.md#ID Generation] — Tile ID format: `{suit}-{value}-{copy}`
- [Source: game-architecture.md#Game Constants] — `TILE_COUNT = 152`, `JOKER_COUNT = 8`, `SEATS`
- [Source: game-architecture.md#Public API Export] — Barrel export pattern for shared/src/index.ts
- [Source: game-architecture.md#Test Utilities] — `generateShuffledWall(seed?)`, `buildHand()`, `createTestState()`
- [Source: game-architecture.md#Architectural Boundaries] — Zero runtime deps in shared/
- [Source: gdd.md#Tile Set Composition] — 152-tile breakdown
- [Source: gdd.md#Joker Rules] — 8 Jokers, cannot be discarded
- [Source: gdd.md#Group Definitions] — Pair/Pung/Kong/Quint/NEWS/Dragon set definitions
- [Source: project-context.md#Tile References] — Always reference by ID, never by array index
- [Source: project-context.md#Anti-Patterns] — Never use `Math.random()` for game logic in shared/

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Used discriminated union for Tile type (SuitedTile | WindTile | DragonTile | FlowerTile | JokerTile) instead of single interface with optional fields — enables type narrowing on `category`
- Used mulberry32 PRNG per story spec — lightweight, good distribution, deterministic with seed
- FlowerValue type added ('a' | 'b') — not in original task list but needed for type completeness

### Completion Notes List

- All 5 tasks completed, all 42 tests passing (15 type-level + 27 wall/tile tests)
- Tile type system uses discriminated union for type-safe narrowing on category
- createAllTiles() generates all 152 tiles in deterministic order
- createWall(seed?) shuffles using mulberry32 PRNG + Fisher-Yates
- Test helpers (generateShuffledWall, buildHand) and tile builders created for downstream stories
- Barrel export updated with all types, constants, and engine functions
- Placeholder test removed
- tsc --build compiles cleanly, pnpm -r test passes across all 3 packages

### Change Log

- 2026-03-26: Story implemented — tile type system, wall creation with seeded PRNG, comprehensive tests, test helpers
- 2026-03-26: Code review — removed unused `Tile` import from tile-builders.ts; removed redundant type casts in wall.ts (TileSuit/TileValue/WindValue/DragonValue/FlowerValue inferred from as const arrays)

### File List

- packages/shared/src/types/tiles.ts (new — tile type definitions)
- packages/shared/src/types/tiles.test.ts (new — type-level tests)
- packages/shared/src/constants.ts (new — game constants)
- packages/shared/src/engine/state/wall.ts (new — createAllTiles, createWall, seeded PRNG)
- packages/shared/src/engine/state/wall.test.ts (new — comprehensive wall/tile tests)
- packages/shared/src/testing/helpers.ts (new — generateShuffledWall, buildHand)
- packages/shared/src/testing/tile-builders.ts (new — suitedTile, windTile, dragonTile, flowerTile, jokerTile)
- packages/shared/src/index.ts (modified — barrel exports for types, constants, engine)
- packages/shared/src/placeholder.test.ts (deleted — replaced by real tests)
