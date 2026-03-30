# Story 5a.5: Discard Pool & Two-Step Discard Interaction

Status: done

## Story

As a **player**,
I want **to discard tiles with a clear two-step interaction (select then confirm) and see all players' discards arranged in chronological rows at each seat**,
So that **discarding feels rhythmic and safe, and I can read the table to track what's been played (FR17, FR122, UX-DR13)**.

## Acceptance Criteria

1. **AC1 — Tile selection:** When it is my turn and I have drawn a tile, tapping a tile in my rack lifts it (selected state: 8px lift + gold border) and a "Discard" confirm button appears in the fixed ActionZone above the rack (UX-DR13)
2. **AC2 — Confirm button position:** The confirm button appears inside the existing `ActionZone` component — the same fixed-size zone where call buttons will appear in 5a-6. The zone maintains fixed dimensions regardless of content (UX-DR13)
3. **AC3 — Discard execution:** Tapping the "Discard" confirm button dispatches the discard action. The tile animates from rack to discard pool using `--timing-tactile` (120ms). A tile clack sound trigger point is established (audio implementation deferred to Epic 7)
4. **AC4 — Re-selection:** Tapping a different tile while one is selected deselects the first tile (lowers) and selects the new tile (lifts) — only one tile selected at a time
5. **AC5 — Discard pool display:** Each player's discard pool displays in front of their seat in chronological rows matching physical play layout (FR122). Tiles render at `small` size (~30px)
6. **AC6 — Latest discard highlight:** The most recently discarded tile gets a brief gold pulse animation to draw attention (latest-discard state)
7. **AC7 — Immediate acknowledgment:** Tapping a tile starts the lift animation instantly (120ms, `--timing-tactile`) BEFORE server confirms — this is visual acknowledgment only, NOT an optimistic game state update (UX-DR31)

## Tasks / Subtasks

- [x] Task 1: Create `DiscardPool.vue` component (AC: 5, 6)
  - [x] 1.1 Accept `tiles: Tile[]` and `position: SeatPosition` props
  - [x] 1.2 Render tiles in chronological rows (6 tiles per row) at `small` size using existing `Tile.vue`
  - [x] 1.3 Rotate discard pool orientation based on seat position (top: normal, left: rotated, right: rotated)
  - [x] 1.4 Apply gold pulse animation on the last tile in the array (latest-discard state)
  - [x] 1.5 Responsive: compress rows on phone viewport
- [x] Task 2: Create `DiscardConfirm.vue` button component (AC: 1, 2, 3, 4)
  - [x] 2.1 Render a "Discard" button — this component will be mounted inside `GameTable.vue`'s `<ActionZone>` slot (see Task 4.3)
  - [x] 2.2 Show only when `selectedTileId` is non-null AND `isPlayerTurn` is true (turnPhase gating deferred to `useGameState` integration — for now, `isPlayerTurn` is sufficient guard)
  - [x] 2.3 On click, emit `discard` event with the selected tile ID
  - [x] 2.4 Style as Primary tier button (gold accent fill, dark text, `text-game-critical`)
  - [x] 2.5 Accessible: `aria-label="Discard selected tile"`, keyboard Enter/Space activation (native `<button>` behavior), 44px min height
- [x] Task 3: Wire tile selection into two-step discard flow (AC: 1, 4, 7)
  - [x] 3.1 Leverage existing `useRackStore.selectTile()` — already implements toggle and single-selection
  - [x] 3.2 Ensure TileRack only allows selection when `isPlayerTurn` is true (already enforced by TileRack's passive state)
  - [x] 3.3 On discard confirm, call `rackStore.deselectTile()` to clear selection
- [x] Task 4: Integrate DiscardPool and DiscardConfirm into GameTable layout (AC: 2, 5)
  - [x] 4.1 Replace the dev placeholder "Discard Pool" div in `GameTable.vue` with actual `DiscardPool` components
  - [x] 4.2 Render 4 discard pools (one per player seat) in the table-center area
  - [x] 4.3 Replace the dev placeholder inside `<ActionZone>` with `<DiscardConfirm>`: pass `selectedTileId` from `useRackStore()`, `isPlayerTurn` from existing props. Handle `@discard` event by calling `rackStore.deselectTile()` (and emitting up for future server dispatch)
  - [x] 4.4 Add `discardPools` prop to GameTable for passing per-seat discard data
- [x] Task 5: Create dev showcase and route (AC: all)
  - [x] 5.1 Create `DiscardShowcase.vue` in `components/dev/`
  - [x] 5.2 Scenarios: empty pool, partial pool (6 tiles = 1 row), full pool (18+ tiles = 3+ rows), latest-discard highlight, two-step discard interaction demo
  - [x] 5.3 Add `/dev/discard` route in `router/index.ts`
- [x] Task 6: Write comprehensive tests (AC: all)
  - [x] 6.1 `DiscardPool.test.ts` — renders tiles in rows, latest tile highlight, empty state, responsive behavior
  - [x] 6.2 `DiscardConfirm.test.ts` — shows/hides based on selection + turn state, emits discard event, keyboard accessible
  - [x] 6.3 Integration test — select tile → confirm → discard emitted → selection cleared

## Dev Notes

### Architecture Compliance

- **DOM/SVG rendering only** — NO canvas, NO game engine
- **No optimistic updates (HARD RULE):** The tile does NOT leave the rack until the server confirms via `STATE_UPDATE`. The lift animation on tap is purely visual acknowledgment. The actual rack mutation comes from the server. Components are pure renderers of server-confirmed state
- **State separation:** This story uses mock data for discard pools. Real game state integration happens when `useGameState` composable is wired up. For now, DiscardPool accepts `tiles: Tile[]` as a prop. DiscardConfirm emits an event — the parent (or future composable) dispatches to the server
- **Component-level viewport adaptation** — use UnoCSS responsive prefixes, no page-level media query DOM restructuring

### Component Architecture

**DiscardPool.vue:**
- Location: `packages/client/src/components/game/DiscardPool.vue`
- Props: `tiles: Tile[]`, `position: "top" | "left" | "right" | "bottom"`
- Renders existing `Tile.vue` at `size="small"` — do NOT create a new tile component
- Row layout: `flex flex-wrap` with 6 tiles per row (use `max-w` constraint or explicit chunking via computed)
- Latest discard: detect last element in `tiles` array, apply CSS animation class
- Gold pulse animation: use `@keyframes` with `gold-accent` color, 1 cycle, 600ms duration using `--timing-expressive`
- Position-based rotation: top pool reads left-to-right (normal), left/right pools may need `writing-mode` or rotation based on UX spec — start with all pools reading left-to-right (simplest), iterate if UX review requests rotation

**DiscardConfirm.vue:**
- Location: `packages/client/src/components/game/DiscardConfirm.vue`
- Props: `selectedTileId: string | null`, `isPlayerTurn: boolean`
- Emits: `discard(tileId: string)`
- Mounted inside `GameTable.vue`'s `<ActionZone>` slot — the ActionZone is already a fixed 80px height toolbar
- Only visible when: `selectedTileId !== null && isPlayerTurn` (turnPhase gating deferred to `useGameState` integration — `isPlayerTurn` already implies discard phase in the current mock-data context)
- Primary button tier: `bg-gold-accent text-text-primary text-game-critical min-h-11 px-6 rounded-md shadow-tile`
- Hover: `hover:bg-gold-accent-hover`
- Focus: `focus-ring-on-felt` (button sits over felt background)

### Reuse Existing Code — Do NOT Reinvent

- **`Tile.vue`** — use directly with `size="small"` for discard pool tiles. All tile rendering, states, and accessibility are already implemented
- **`useRackStore`** — `selectedTileId` and `selectTile()`/`deselectTile()` already exist. The two-step flow is: rack store manages selection, DiscardConfirm reads `selectedTileId`, on confirm it emits the ID and calls `deselectTile()`
- **`ActionZone.vue`** — already created as a fixed-size slot container with `role="toolbar"`. DiscardConfirm renders inside its slot
- **`TileSprite.vue`** — must already be in DOM (mounted in App.vue) for `<use href="#bam-3">` to work. No action needed
- **Tile sort helpers in rack store** — the `tileSortKey()` function is NOT needed for discard pools (discards are chronological, not sorted)

### Design Tokens to Use

| Purpose | Token/Class |
|---------|-------------|
| Discard pool tile size | `size="small"` (30×40px via Tile.vue) |
| Gold pulse animation | `gold-accent` (#C4A35A) for keyframe color |
| Confirm button bg | `bg-gold-accent` / `hover:bg-gold-accent-hover` |
| Confirm button text | `text-text-primary text-game-critical` (20px semibold) |
| Button focus ring | `focus-ring-on-felt` |
| Button min height | `min-h-11` (44px min tap target) |
| Tactile timing | `--timing-tactile` (120ms) for tile lift and discard animation |
| Expressive timing | `--timing-expressive` (400ms) for gold pulse highlight |
| Tile shadow | `shadow-tile` |

### File Structure

**New files to create:**
- `packages/client/src/components/game/DiscardPool.vue`
- `packages/client/src/components/game/DiscardPool.test.ts`
- `packages/client/src/components/game/DiscardConfirm.vue`
- `packages/client/src/components/game/DiscardConfirm.test.ts`
- `packages/client/src/components/dev/DiscardShowcase.vue`

**Modified files:**
- `packages/client/src/components/game/GameTable.vue` — replace dev placeholder with DiscardPool components
- `packages/client/src/router/index.ts` — add `/dev/discard` route

### GameTable Integration Details

Current `GameTable.vue` has a dev-only placeholder div for "Discard Pool" at lines 66-71. Replace this with actual `DiscardPool` components. The table-center area needs to show:
- Bottom player's discard pool (the local player) — positioned closest to the rack
- Top player's discard pool — positioned at the top of the center area
- Left/right player's discard pools — positioned to the sides

For this story, pass discard pool data via props (mock data in showcase, real data when `useGameState` is wired). GameTable props will need to expand to accept discard pool data per player, OR DiscardPool components can be slotted/composed differently.

**Recommended approach:** Add `discardPools` prop to GameTable:
```typescript
discardPools?: {
  bottom?: Tile[];
  top?: Tile[];
  left?: Tile[];
  right?: Tile[];
}
```

### Discard Pool Layout in Table Center

The table-center area currently has `min-h-[40dvh]` and uses `flex flex-col items-center justify-center`. The 4 discard pools should be arranged to reflect the physical table — each player's discards are in front of their seat. A simple approach:

```
          [Top pool]
[Left pool]        [Right pool]
         [Bottom pool]
```

Use a CSS grid or nested flex layout within table-center. Keep the wall counter placeholder in the center between pools.

### Two-Step Discard Flow (End-to-End)

1. Player taps tile in rack → `useRackStore.selectTile(tileId)` fires → tile enters `selected` state (8px lift + gold border) — this is existing behavior
2. DiscardConfirm reads `rackStore.selectedTileId` — when non-null + player's turn + discard phase → button renders in ActionZone
3. Player taps "Discard" → DiscardConfirm emits `discard(tileId)` → parent handles dispatch (future: `gameState.dispatch({ type: 'DISCARD_TILE', playerId, tileId })`)
4. Parent calls `rackStore.deselectTile()` to clear selection
5. Server processes, broadcasts `STATE_UPDATE` → rack updates, discard pool updates
6. DiscardPool reactively shows new tile with gold pulse on latest entry

**For this story:** Steps 3-5 are mocked. The showcase demonstrates steps 1-3 with mock callbacks. Real server integration comes when `useGameState` is connected.

### Animation Notes

- **Tile lift on selection:** Already implemented in `Tile.vue` via `selected` state (8px translate-y + gold border)
- **Gold pulse on latest discard:** New CSS animation. Use `@keyframes discard-pulse` that briefly intensifies the `shadow-tile` with `gold-accent` color, then returns to normal. Apply via a `latest-discard` class on the last tile element. Duration: ~600ms using `--timing-expressive`. Respect `prefers-reduced-motion` — collapse to instant opacity change
- **Discard tile animation (rack → pool):** Defer full animation to when `useGameState` is wired. For now, tiles simply appear in the pool. The animation will use Motion for Vue's `<motion />` component when real state transitions are available
- **Sound trigger point:** Add a comment `// TODO: audioStore.play('tile-discard')` where the discard confirm fires — actual audio is Epic 7

### Previous Story Intelligence (5a-4)

Key patterns established:
- CSS Grid for game table layout — maintain the existing grid structure
- `data-testid` on all regions for testing
- Dev placeholders visible only with `import.meta.env.DEV`
- `OpponentPlayer` interface imported from `OpponentArea.vue`
- UnoCSS responsive prefixes: default = phone, `md:` = tablet, `lg:` = desktop
- `dvh` units for outer container height
- Safe area handling on rack area
- GameTableShowcase with scenario switching pattern

Problems from 5a-4 to avoid:
- Don't hardcode hex colors — use CSS custom properties or UnoCSS tokens
- Pre-existing test failures: 4 tests in `theme.test.ts` are known failures from 5a-1 — do NOT try to fix these

### Testing Standards

- **Framework:** Vitest with happy-dom (not jsdom)
- **Co-located:** test files next to source files
- **Imports:** `import { describe, test, expect, vi, beforeEach } from 'vite-plus/test'`
- **Component tests:** `@vue/test-utils` `mount()` with `data-testid` queries
- **Pinia in tests:** `setActivePinia(createPinia())` in `beforeEach`, or `createTestingPinia({ createSpy: vi.fn })` for component mount
- **DnD Kit mock:** `vi.mock('@vue-dnd-kit/core')` in component tests that render TileRack
- **Blackbox testing:** Test rendered output and emitted events, never `wrapper.vm.*`
- **Async:** `await flushPromises()` after state changes
- **Accessibility:** Assert `role`, `aria-label`, keyboard activation in tests

**Current test counts (baseline — zero regressions allowed):**
- shared: 591 passed (1 todo)
- client: 170 passed (4 pre-existing failures in theme.test.ts)
- server: 183 passed

### Anti-Patterns to Avoid

- NO optimistic game state updates — tiles don't move until server confirms
- NO raw hex colors — use UnoCSS theme tokens
- NO hardcoded transition durations — use `--timing-*` CSS custom properties
- NO `v-html` anywhere
- NO Options API — `<script setup lang="ts">` only
- NO barrel imports within the client package — use relative paths
- NO `setTimeout` for animations — use CSS transitions/keyframes or Motion for Vue
- NO game state in Pinia — discard pool data comes from props (future: inject)
- NO creating a new tile rendering component — reuse `Tile.vue`
- NO tile references by array index — use tile IDs

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5A, Story 5A.5]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Vue Component Pattern, Client State Architecture, Animation Architecture]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Effortless Interactions, Two-Step Discard, Discard Pool, UX-DR13/DR31]
- [Source: _bmad-output/planning-artifacts/gdd.md — FR17, FR122, Discard mechanics, Table Reading]
- [Source: _bmad-output/project-context.md — Server Authority, State Access, Anti-Patterns]
- [Source: _bmad-output/implementation-artifacts/5a-4-game-table-layout-immersive-table.md — Layout patterns, design tokens, file structure]
- [Source: packages/shared/src/engine/actions/discard.ts — handleDiscardTile, ResolvedAction types]
- [Source: packages/shared/src/types/game-state.ts — PlayerState.discardPool, GameState.lastDiscard]
- [Source: packages/client/src/stores/rack.ts — useRackStore, selectedTileId, selectTile/deselectTile]
- [Source: packages/client/src/components/game/ActionZone.vue — Fixed 80px slot container]
- [Source: packages/client/src/components/tiles/Tile.vue — size="small", state="selected"]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Created `DiscardPool.vue` — renders tiles in chronological rows of 6 at `small` size using existing `Tile.vue`. Applies gold pulse CSS animation on the last tile (`latest-discard` class). Respects `prefers-reduced-motion`. Responsive max-width constraint for phone viewports.
- Created `DiscardConfirm.vue` — primary gold accent button with `v-if` guard on `selectedTileId !== null && isPlayerTurn`. Emits `discard(tileId)` on click/Enter/Space. Accessible with `aria-label`, 44px min height.
- Leveraged existing `useRackStore` for tile selection (toggle, single-selection, deselect) — no new state management needed.
- Integrated both components into `GameTable.vue`: replaced "Discard Pool" dev placeholder with 4 `DiscardPool` components in a CSS grid layout (top/bottom/left/right). Replaced "Action Buttons" placeholder with `DiscardConfirm` wired to rack store. Added `discardPools` prop and `discard` emit to GameTable.
- Created `DiscardShowcase.vue` with 5 scenarios (empty, partial, full, latest-highlight, interactive two-step) and added `/dev/discard` route.
- Wrote 22 new tests: 9 for DiscardPool, 8 for DiscardConfirm, 5 integration tests in GameTable covering discard pool rendering and the full select→confirm→deselect flow.
- All tests pass. Zero regressions (shared: 591, client: 191 + 4 pre-existing theme failures, server: 183). Typecheck and lint pass.
- Code review fix: removed redundant `@keydown.enter`/`@keydown.space` handlers from DiscardConfirm (native `<button>` already handles keyboard activation via click). Consolidated 2 keyboard tests into 1 native button assertion.

### Change Log

- 2026-03-30: Implemented story 5a-5 — DiscardPool, DiscardConfirm, GameTable integration, dev showcase, comprehensive tests

### File List

- `packages/client/src/components/game/DiscardPool.vue` (new)
- `packages/client/src/components/game/DiscardPool.test.ts` (new)
- `packages/client/src/components/game/DiscardConfirm.vue` (new)
- `packages/client/src/components/game/DiscardConfirm.test.ts` (new)
- `packages/client/src/components/dev/DiscardShowcase.vue` (new)
- `packages/client/src/components/game/GameTable.vue` (modified)
- `packages/client/src/components/game/GameTable.test.ts` (modified)
- `packages/client/src/router/index.ts` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
