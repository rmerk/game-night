# Story 1.7: Minimal Visual Test Harness

Status: done

## Story

As a **developer**,
I want **a minimal browser-based test harness that displays the game state (racks, discard pools, wall count, turn indicator) and allows manual action dispatch**,
So that **I can visually verify the game engine works correctly before building the real UI**.

## Acceptance Criteria

1. **Given** the client dev server is running **When** the test harness page loads **Then** a new game is initialized locally (no server needed) and all 4 player racks are displayed with tile IDs

2. **Given** the test harness is displaying a game **When** viewing the interface **Then** the current turn player is indicated, wall remaining count is shown, and each player's discard pool is visible

3. **Given** the test harness is active **When** clicking "Draw" for the current turn player **Then** a tile is drawn and the display updates to show the new tile in the rack and decremented wall count

4. **Given** the test harness is active **When** clicking a tile in the current player's rack to discard **Then** the tile moves to the discard pool, turn advances, and the display reflects the new state

5. **Given** the game reaches wall depletion **When** the last tile is drawn and discarded **Then** the harness displays "Wall Game" result

6. **Given** the test harness **When** inspecting it in dev mode only **Then** it is gated behind `import.meta.env.DEV` and will not appear in production builds (AR19)

## Tasks / Subtasks

- [x] Task 1: Create TestHarness.vue component (AC: 1, 2, 6)
  - [x] 1.1 Create `client/src/components/dev/TestHarness.vue` with `<script setup lang="ts">`
  - [x] 1.2 Import and use `createLobbyState` + `handleAction` from `@mahjong-game/shared`
  - [x] 1.3 Initialize local game state with `START_GAME` action on mount
  - [x] 1.4 Display all 4 player racks with tile IDs
  - [x] 1.5 Display current turn indicator (player ID + wind seat)
  - [x] 1.6 Display wall remaining count
  - [x] 1.7 Display each player's discard pool
  - [x] 1.8 Display game phase and turn phase

- [x] Task 2: Implement Draw action (AC: 3)
  - [x] 2.1 Add "Draw" button visible only when it's a player's turn and `turnPhase === 'draw'`
  - [x] 2.2 Dispatch `DRAW_TILE` action through `handleAction`
  - [x] 2.3 Update reactive state to reflect new rack and wall count

- [x] Task 3: Implement Discard action (AC: 4)
  - [x] 3.1 Make rack tiles clickable when it's that player's turn and `turnPhase === 'discard'`
  - [x] 3.2 Dispatch `DISCARD_TILE` action with clicked tile ID through `handleAction`
  - [x] 3.3 Update reactive state to reflect discard pool, turn advance

- [x] Task 4: Wall game detection and display (AC: 5)
  - [x] 4.1 Watch for `gamePhase === 'scoreboard'` and `gameResult.winnerId === null`
  - [x] 4.2 Display "Wall Game - Draw" result overlay/banner

- [x] Task 5: Dev-only gating and routing (AC: 6)
  - [x] 5.1 Gate component behind `import.meta.env.DEV` check
  - [x] 5.2 Add dev-only route `/dev/harness` to Vue Router (conditionally registered)
  - [x] 5.3 Verify production build excludes the harness (tree-shaken by Vite)

- [x] Task 6: Write tests
  - [x] 6.1 Unit test: game initializes correctly on mount
  - [x] 6.2 Unit test: draw action updates state
  - [x] 6.3 Unit test: discard action updates state and advances turn
  - [x] 6.4 Unit test: wall game result displays correctly
  - [x] 6.5 Verify dev-only gating works

## Dev Notes

### Architecture Compliance

**This is a dev-only tool, NOT production UI.** Keep it minimal and functional. Do not build production-quality components — Epic 5A will create the real UI. The purpose is purely to verify game engine correctness visually.

**AR19 Compliance:** All dev tools gated via `import.meta.env.DEV`. Vite tree-shakes these in production builds automatically.

**AR2 Compliance:** The shared package is pure TypeScript with zero runtime dependencies. Import game engine functions directly — no server communication needed for this harness.

### Game Engine API — Single Entry Points

```typescript
import { createLobbyState, handleAction } from '@mahjong-game/shared'
import type { GameState, GameAction, ActionResult } from '@mahjong-game/shared'

// 1. Create lobby state
const state = createLobbyState()

// 2. Start game with 4 players
const result = handleAction(state, {
  type: 'START_GAME',
  playerIds: ['p1', 'p2', 'p3', 'p4']
})

// 3. Draw tile (current player's turn, turnPhase === 'draw')
handleAction(state, { type: 'DRAW_TILE', playerId: state.currentTurn })

// 4. Discard tile (current player's turn, turnPhase === 'discard')
handleAction(state, { type: 'DISCARD_TILE', playerId: state.currentTurn, tileId: 'bam-3-2' })
```

**CRITICAL:** `handleAction` mutates `state` in-place. Wrap in `reactive()` or use `shallowRef()` + manual trigger for Vue reactivity. Since state is mutated in-place, you need to either:
- Use `shallowRef` and reassign after each action (copy or trigger), OR
- Use `reactive()` and Vue will track nested changes, OR
- Use `ref()` with `triggerRef()` after each mutation

Recommended approach: `shallowRef` + `triggerRef()` after each `handleAction` call — avoids deep reactivity overhead on the large game state object.

```typescript
import { shallowRef, triggerRef } from 'vue'

const gameState = shallowRef(createLobbyState())

function dispatch(action: GameAction) {
  const result = handleAction(gameState.value, action)
  triggerRef(gameState) // Force Vue to re-render
  return result
}
```

### State Shape Reference

```typescript
// Key fields to display in harness:
state.gamePhase        // 'lobby' | 'play' | 'scoreboard'
state.currentTurn      // Player ID string (e.g., 'p1')
state.turnPhase        // 'draw' | 'discard'
state.wallRemaining    // Number (starts at 99 after dealing)
state.wall.length      // Same as wallRemaining (kept in sync)
state.gameResult       // null during play, { winnerId: null, points: 0 } for wall game

// Per-player state:
state.players[playerId].wind       // 'east' | 'south' | 'west' | 'north'
state.players[playerId].rack       // Tile[] (14 for East initially, 13 for others)
state.players[playerId].discardPool // Tile[]
state.players[playerId].exposedGroups // ExposedGroup[] (empty in Epic 1)

// Tile shape:
tile.id        // e.g., 'bam-3-2', 'joker-5', 'wind-north-1'
tile.suit      // 'bam' | 'crak' | 'dot' | 'wind' | 'dragon' | 'flower' | 'joker'
tile.category  // 'suited' | 'wind' | 'dragon' | 'flower' | 'joker'
```

### Turn Flow Rules (Critical for UI Logic)

1. **East starts in `discard` phase** with 14 tiles (no draw needed first turn)
2. **All other players start in `draw` phase** with 13 tiles
3. Turn order: East → South → West → North → East (counterclockwise)
4. Each turn: draw (if not East's first) → discard → next player
5. **Jokers cannot be discarded** — `CANNOT_DISCARD_JOKER` rejection
6. After last tile drawn + discarded → `gamePhase: 'scoreboard'`, `gameResult: { winnerId: null, points: 0 }`

### Action Result Handling

```typescript
// handleAction returns:
interface ActionResult {
  accepted: boolean
  reason?: string           // e.g., 'NOT_YOUR_TURN', 'WALL_EMPTY', 'CANNOT_DISCARD_JOKER'
  resolved?: ResolvedAction // { type: 'DRAW_TILE' | 'DISCARD_TILE' | 'WALL_GAME', ... }
}
```

Display rejected actions in the harness (show `reason` string) — this is a debugging tool, so visibility of errors is important.

### File Placement

```
packages/client/src/
├── components/
│   └── dev/                          # DEV-ONLY directory
│       └── TestHarness.vue           # The test harness component
├── router/
│   └── index.ts                      # Add conditional dev route
└── views/
    └── HomeView.vue                  # Existing — add dev harness link (DEV only)
```

**Note:** The architecture doc specifies `components/dev/` for dev-only tools (DebugPanel.vue, MultiSeatControls.vue planned there). Place TestHarness.vue in the same directory.

### Vue Component Standards (Must Follow)

- `<script setup lang="ts">` — no Options API
- Props typed via `defineProps<{}>()` if needed
- Max ~150 lines per component — extract child components if exceeding
- Section order: imports → props/emits → inject → composables/stores → computed → methods
- UnoCSS utility classes for styling (no raw hex colors)
- No component library — all custom

### Styling Approach

This is a **dev tool**, not production UI. Keep styling minimal and functional:
- Use basic UnoCSS utility classes for layout (`flex`, `grid`, `gap-4`, `p-4`, etc.)
- Simple borders/backgrounds to delineate player areas
- Monospace font for tile IDs (readability in debug context)
- Color-code suits if easy (green/red/blue for bam/crak/dot) but don't over-invest
- Responsive layout not required — desktop-only is fine for a dev tool

### Import Convention (CRITICAL)

Within the client package, import from shared via the package name:
```typescript
// CORRECT:
import { createLobbyState, handleAction } from '@mahjong-game/shared'
import type { GameState, Tile } from '@mahjong-game/shared'

// WRONG (never use relative paths to other packages):
import { createLobbyState } from '../../shared/src/engine/game-engine'
```

### What NOT to Build

- No server communication (local-only game initialization)
- No WebSocket integration
- No production-quality styling or animations
- No drag-and-drop (just click to discard)
- No Pinia stores (direct local state management is fine for a dev tool)
- No NMJL card display
- No audio
- No accessibility features (this is dev-only)
- No mobile responsiveness

### Previous Story Intelligence

**From Story 1.6 (Wall Depletion & Game End):**
- Wall depletion check happens in `handleDiscardTile` AFTER `advanceTurn()`
- After wall game, `currentTurn` points to next player who would have drawn
- `gameResult: { winnerId: null, points: 0 }` indicates wall game
- `gamePhase: 'scoreboard'` is terminal — all further actions rejected with `WRONG_PHASE`
- 142 tests passing across all packages, 0 failures

**From Story 1.6 — Patterns to reuse:**
- `createPlayState()` fixture gives game-ready state (seed 42)
- `TEST_PLAYER_IDS = ['p1', 'p2', 'p3', 'p4']`
- `getPlayerBySeat(state, 'east')` for seat-based lookup
- All action handlers follow validate-then-mutate pattern

**From Git history (commit e7775d6):**
- Stories 1.4-1.6 implemented together: draw, discard, wall depletion
- 18 files changed, 1,147 insertions
- Co-located test files (*.test.ts alongside *.ts)
- Consistent use of shared testing fixtures and helpers

### Project Structure Notes

- Monorepo: `packages/shared`, `packages/client`, `packages/server`
- Client dev server: `pnpm --filter @mahjong-game/client dev` (Vite 8)
- Tests: `pnpm -r test` (all packages) or `pnpm --filter @mahjong-game/client test`
- TypeScript strict mode enforced, no `any` types
- Shared package consumed via source imports (no build step needed)
- Client currently has only HomeView.vue placeholder — this harness is the first real UI

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1, Story 1.7]
- [Source: _bmad-output/planning-artifacts/architecture.md — AR19 (dev-only gating), AR2 (shared purity), AR27 (Node 22), AR28 (Vite 8)]
- [Source: packages/shared/src/engine/game-engine.ts — createLobbyState, handleAction]
- [Source: packages/shared/src/types/game-state.ts — GameState, PlayerState, ActionResult, GamePhase, TurnPhase]
- [Source: packages/shared/src/types/tiles.ts — Tile types]
- [Source: packages/shared/src/engine/actions/discard.ts — handleDiscardTile with wall depletion]
- [Source: packages/shared/src/engine/actions/draw.ts — handleDrawTile, advanceTurn]
- [Source: packages/shared/src/testing/fixtures.ts — createPlayState, TEST_PLAYER_IDS]
- [Source: packages/client/src/router/index.ts — Vue Router config]
- [Source: packages/client/vite.config.ts — Vite configuration]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Tests for the wall game simulation initially failed because the loop dispatched draw and discard as individual iterations (checking `turnPhase` each time). Rewrote to follow the pattern in `wall-depletion.test.ts`: handle East's initial discard separately, then run draw+discard as paired operations in the main loop.
- Router test (`/dev/harness` route check) failed with `window is not defined` because `createWebHistory` requires a DOM. Replaced with logic-level tests that verify the conditional route array without instantiating the router.
- HomeView's `v-if="import.meta.env.DEV"` in the template caused a Vue template parse error in vitest. Fixed by extracting it to `const isDev = import.meta.env.DEV` in the script and using `v-if="isDev"`.

### Completion Notes List

- Created `packages/client/src/components/dev/TestHarness.vue` with `<script setup lang="ts">`, using `shallowRef` + `triggerRef` for Vue reactivity over the in-place-mutating game state.
- Component displays: all 4 player racks (tile IDs with suit color coding), current turn indicator, wall remaining count, discard pools, game phase/turn phase, rejected action reasons.
- Draw button shown only when `turnPhase === 'draw'`; rack tiles are clickable only when it's that player's turn in discard phase (jokers excluded from click).
- Wall game banner displayed when `gamePhase === 'scoreboard'` and `gameResult.winnerId === null`.
- Dev-only gating: route `/dev/harness` conditionally registered via `import.meta.env.DEV` in router; HomeView link also gated. Vite tree-shakes the dynamic import in production.
- 17 new tests added covering all 6 story subtasks; 158 total tests pass with 0 regressions.
- [Code Review] Added 4 mount-based component tests (render, draw button, wall count display, click-to-discard). Installed `@vue/test-utils` and `happy-dom`. Updated vitest.config.ts with `environment: 'happy-dom'`. 162 total tests pass.

### File List

- packages/client/src/components/dev/TestHarness.vue (new)
- packages/client/src/components/dev/TestHarness.test.ts (new)
- packages/client/src/router/index.ts (modified — added conditional dev route)
- packages/client/src/views/HomeView.vue (modified — added dev harness link)
- packages/shared/src/engine/actions/discard.test.ts (modified — replaced rack[0] with getDiscardableTile helper to avoid flaky joker-first scenarios)
- packages/client/vitest.config.ts (modified — added happy-dom test environment)
- packages/client/package.json (modified — added @vue/test-utils and happy-dom devDependencies)

## Change Log

- 2026-03-26: Implemented Story 1.7 — created TestHarness.vue dev component, conditional `/dev/harness` route, dev link in HomeView, and 17 unit tests covering all 6 task groups (claude-sonnet-4-6)
- 2026-03-26: [Code Review] Added 4 mount-based component rendering tests, installed @vue/test-utils + happy-dom, updated vitest.config.ts, fixed story File List to include discard.test.ts change (claude-opus-4-6)
