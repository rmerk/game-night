# Story 1.3: Game State Machine & Dealing

Status: done

## Story

As a **developer**,
I want **a game state machine that initializes a game with 4 seats, assigns winds, deals tiles correctly, and manages game phases**,
So that **a game can be started with correct initial state per NMJL rules**.

## Acceptance Criteria

1. **Given** a new game is created with 4 player IDs **When** the game state is initialized **Then** each player is assigned a unique wind (East, South, West, North) and `gamePhase` is set to `play`

2. **Given** a game is initialized **When** tiles are dealt **Then** East receives 14 tiles, and South, West, North each receive 13 tiles

3. **Given** tiles are dealt **When** checking the wall **Then** the wall contains exactly 152 - 14 - 13 - 13 - 13 = 99 remaining tiles

4. **Given** a game is initialized **When** checking the initial game state **Then** `currentTurn` is set to the East player, all discard pools are empty, no exposed groups exist, and scores are initialized to 0

5. **Given** the game state **When** inspecting the state shape **Then** it includes: `gamePhase`, `players` (with wind, rack, exposedGroups, discardPool), `wall`, `wallRemaining`, `currentTurn`, `scores`, and `callWindow: null`

## Tasks / Subtasks

- [x] Task 1: Define game state types (AC: #5)
  - [x] 1.1 Create `packages/shared/src/types/game-state.ts` with `GameState`, `GamePhase`, `PlayerState`, `SeatWind`, `ActionResult` types
  - [x] 1.2 Create `packages/shared/src/types/actions.ts` with `GameAction` discriminated union (start with `START_GAME` action; other action types will be added in stories 1.4-1.6)
  - [x] 1.3 Write type-level tests in `packages/shared/src/types/game-state.test.ts`
- [x] Task 2: Implement create-game and dealing logic (AC: #1, #2, #3)
  - [x] 2.1 Create `packages/shared/src/engine/state/create-game.ts` — `createGame(playerIds: string[], seed?: number): GameState`
  - [x] 2.2 Create `packages/shared/src/engine/state/dealing.ts` — `dealTiles(wall: Tile[]): { hands: Record<SeatWind, Tile[]>, remainingWall: Tile[] }`
  - [x] 2.3 Write tests in `create-game.test.ts` and `dealing.test.ts`
- [x] Task 3: Implement game engine entry point (AC: #4, #5)
  - [x] 3.1 Create `packages/shared/src/engine/game-engine.ts` — `createLobbyState()` and `handleAction(state, action): ActionResult`
  - [x] 3.2 Implement `START_GAME` action handler in `packages/shared/src/engine/actions/game-flow.ts`
  - [x] 3.3 Write tests in `game-engine.test.ts` and `game-flow.test.ts`
- [x] Task 4: Update barrel exports and test helpers (AC: all)
  - [x] 4.1 Update `packages/shared/src/index.ts` with new type and function exports
  - [x] 4.2 Add `createTestState()` to `packages/shared/src/testing/helpers.ts`
  - [x] 4.3 Add game state fixtures to `packages/shared/src/testing/fixtures.ts`
- [x] Task 5: Run full test suite — `pnpm -r test` must pass with zero failures

## Dev Notes

### Critical Game Rules for Dealing

- **East gets 14 tiles**, South/West/North get 13 each. Total dealt: 53. Wall remainder: 99.
- **East does NOT draw on their first turn** — they evaluate their 14-tile hand and discard one to begin play.
- Play proceeds **counterclockwise**: East -> South -> West -> North -> East.
- `gamePhase` starts as `'play'` in Epic 1 (Charleston phase is added in Epic 3B).
- `callWindow` must be present in state shape as `null` (call mechanics added in Epic 3A).
- Wind assignment must be deterministic — first player ID maps to East, second to South, etc.

### Architecture Compliance

**Validate-then-mutate pattern (HARD REQUIREMENT):**
Every action handler must follow: validate (read-only) -> mutate -> return `ActionResult`.
```typescript
function handleStartGame(state: GameState, action: StartGameAction): ActionResult {
  // 1. Validate — no mutations above this line
  if (state.gamePhase !== 'lobby') {
    return { accepted: false, reason: 'WRONG_PHASE' }
  }
  // 2. Mutate — only reached if all validation passed
  // ... deal tiles, assign winds, set phase
  // 3. Return result
  return { accepted: true, resolved: { type: 'GAME_STARTED' } }
}
```

**ActionResult type:**
```typescript
interface ActionResult {
  accepted: boolean
  reason?: string
  resolved?: ResolvedAction
}
```

**Three composed state machines (phase discrimination):**
1. **Game-level:** `lobby -> charleston -> play -> scoreboard -> rematch`
2. **Turn-level:** `draw -> evaluate -> discard -> callWindow -> resolve`
3. **Call window:** `open -> frozen -> confirm/retract -> resolve`

For this story, only implement game-level phase transition from `lobby` to `play`.

### Required Type Definitions

**GameState** (per architecture — implement exactly this shape):
```typescript
interface GameState {
  gamePhase: GamePhase
  players: Record<string, PlayerState>
  wall: Tile[]
  wallRemaining: number
  currentTurn: string               // playerId of East
  turnPhase: TurnPhase              // 'discard' (East evaluates hand, must discard)
  lastDiscard: null
  callWindow: null
  scores: Record<string, number>    // all initialized to 0
}

type GamePhase = 'lobby' | 'charleston' | 'play' | 'scoreboard' | 'rematch'
type TurnPhase = 'draw' | 'discard' | 'callWindow'
type SeatWind = 'east' | 'south' | 'west' | 'north'

interface PlayerState {
  id: string
  seatWind: SeatWind
  rack: Tile[]
  exposedGroups: ExposedGroup[]     // empty array initially
  discardPool: Tile[]               // empty array initially
}
```

**Note on `turnPhase`:** East starts with 14 tiles and must discard. Set `turnPhase` to `'discard'` initially — East skips the draw phase on their first turn.

**GameAction discriminated union:**
```typescript
type GameAction =
  | { type: 'START_GAME'; playerIds: string[]; seed?: number }
  // Future stories add: DRAW_TILE, DISCARD_TILE, etc.
```

### File Structure Requirements

Create files in these exact locations per architecture:

| File | Purpose |
|------|---------|
| `packages/shared/src/types/game-state.ts` | GameState, GamePhase, PlayerState, SeatWind, TurnPhase, ActionResult, ExposedGroup types |
| `packages/shared/src/types/game-state.test.ts` | Type-level tests |
| `packages/shared/src/types/actions.ts` | GameAction discriminated union |
| `packages/shared/src/engine/state/create-game.ts` | `createGame()` function |
| `packages/shared/src/engine/state/create-game.test.ts` | Unit tests for create-game |
| `packages/shared/src/engine/state/dealing.ts` | `dealTiles()` function |
| `packages/shared/src/engine/state/dealing.test.ts` | Unit tests for dealing |
| `packages/shared/src/engine/game-engine.ts` | `createGameEngine()`, `handleAction()` |
| `packages/shared/src/engine/game-engine.test.ts` | Game engine tests |
| `packages/shared/src/engine/actions/game-flow.ts` | START_GAME action handler |
| `packages/shared/src/engine/actions/game-flow.test.ts` | Game flow action tests |
| `packages/shared/src/testing/fixtures.ts` | Pre-built game state fixtures |

### Library & Framework Requirements

- **No external state machine library** — pure TypeScript with phase discriminator
- **No runtime dependencies in shared/** — only devDependencies (Vitest)
- **Vitest ^4.0** for testing with co-located test files (`foo.ts` -> `foo.test.ts`)
- **Seeded PRNG** — reuse `createWall(seed)` from Story 1.2 for deterministic dealing in tests
- **No Math.random() in shared/** — all randomness via seeded PRNG for reproducibility

### Testing Requirements

**Tests must cover:**
- Wind assignment: 4 players, each gets unique wind, first player = East
- Tile counts: East=14, South/West/North=13 each, wall=99
- State shape: all required fields present with correct initial values
- Determinism: same seed produces identical game state
- Action validation: START_GAME rejected if not in lobby phase
- ActionResult: correct `accepted`/`reason`/`resolved` values

**Use seeded wall for deterministic tests:**
```typescript
const state = createGame(['p1', 'p2', 'p3', 'p4'], 42)
// Same seed always produces same initial state
```

**Testing patterns from Story 1.2 to follow:**
- `expectTypeOf` for type-level tests on discriminated unions
- Vitest with `restoreMocks: true`, `clearMocks: true`
- Descriptive test names in `describe`/`it` blocks

### Anti-Patterns to Avoid

- **DO NOT** create a `Tile.suit` field on GameState — tiles are referenced by ID, never by index
- **DO NOT** implement turn loop, draw, or discard — those are Stories 1.4 and 1.5
- **DO NOT** implement Charleston — that's Epic 3B
- **DO NOT** add roomId/roomCode to GameState yet — multiplayer is Epic 4A
- **DO NOT** use `console.log` in shared/ — no console, no browser/Node APIs
- **DO NOT** import from barrel (`..`) within shared/ — use direct file imports (e.g., `../types/game-state`)
- **DO NOT** add `ExposedGroup` fields beyond type stub — full implementation is Epic 3A

### Previous Story Intelligence

**From Story 1.2 (Tile Definitions & Wall Creation):**
- Tile ID convention: `{suit}-{value}-{copy}` (suited), `wind-{direction}-{copy}`, `dragon-{color}-{copy}`, `flower-{type}-{copy}`, `joker-{copy}`
- White Dragon = "soap" (not "white")
- `createWall(seed?)` returns shuffled `Tile[]` of 152 tiles — USE THIS for dealing
- `createAllTiles()` returns deterministic unshuffled `Tile[]`
- Test helpers available: `generateShuffledWall(seed?)`, `buildHand(tileIds[])`, `suitedTile()`, `windTile()`, `dragonTile()`, `flowerTile()`, `jokerTile()`
- Constants available: `TILE_COUNT=152`, `JOKER_COUNT=8`, `MAX_PLAYERS=4`, `SEATS=['east','south','west','north']`
- All tiles are `readonly` — do not attempt to mutate tile properties
- 42 existing tests passing — do not break them

### Project Structure Notes

- Monorepo: `packages/shared/`, `packages/client/`, `packages/server/`
- shared/ has zero runtime deps, only devDeps (vitest, typescript)
- Internal imports use direct file paths, not barrel: `import { Tile } from '../types/tiles'`
- Barrel exports only in `index.ts` for package public API
- TypeScript strict mode enabled globally via `tsconfig.base.json`
- Node.js 22 LTS, pnpm workspaces, `"type": "module"` throughout

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.3]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#Decision 1 — Game State Machine]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#shared/ Package Structure]
- [Source: _bmad-output/planning-artifacts/gdd.md#Dealing and Seating]
- [Source: _bmad-output/planning-artifacts/gdd.md#Core Gameplay Loop]
- [Source: _bmad-output/implementation-artifacts/1-2-tile-definitions-wall-creation.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with zero failures.

### Completion Notes List

- Implemented GameState, GamePhase, TurnPhase, SeatWind, PlayerState, ExposedGroup, ActionResult, ResolvedAction types
- Implemented GameAction discriminated union with START_GAME action
- Implemented dealTiles() — East gets 14, others get 13, wall remainder = 99
- Implemented createGame() — assigns winds deterministically, deals tiles via seeded PRNG, initializes all state fields
- Implemented createLobbyState() and handleAction() game engine entry points
- Implemented handleStartGame() with validate-then-mutate pattern (rejects if not in lobby phase)
- Added createTestState() helper and game state fixtures for future stories
- Updated barrel exports in index.ts with all new types and functions
- All 5 acceptance criteria verified by 56 new tests (10 type-level + 7 dealing + 27 create-game + 6 game-flow + 6 game-engine)
- Full suite: 100 tests passing across all packages (98 shared + 1 client + 1 server), zero regressions

### Change Log

- 2026-03-26: Story 1.3 implementation complete — game state machine, dealing, and game engine
- 2026-03-26: Code review fixes — removed misleading `readonly` from `GameState` fields, added `playerIds` validation in `handleStartGame` (returns `INVALID_PLAYER_COUNT`/`DUPLICATE_PLAYER_IDS` instead of throwing), changed `LOBBY_STATE` singleton to `createLobbyFixture()` factory function, added 3 new validation tests (103 total)

### File List

New files:
- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/game-state.test.ts`
- `packages/shared/src/types/actions.ts`
- `packages/shared/src/engine/state/create-game.ts`
- `packages/shared/src/engine/state/create-game.test.ts`
- `packages/shared/src/engine/state/dealing.ts`
- `packages/shared/src/engine/state/dealing.test.ts`
- `packages/shared/src/engine/game-engine.ts`
- `packages/shared/src/engine/game-engine.test.ts`
- `packages/shared/src/engine/actions/game-flow.ts`
- `packages/shared/src/engine/actions/game-flow.test.ts`
- `packages/shared/src/testing/fixtures.ts`

Modified files:
- `packages/shared/src/index.ts`
- `packages/shared/src/testing/helpers.ts`
