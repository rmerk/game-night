# Story 5a.4: Game Table Layout (Immersive Table)

Status: done

## Story

As a **player**,
I want **a full-width felt game table with my rack at the bottom, opponents at cardinal positions, and a central area for discards and wall counter**,
So that **it feels like sitting at a real Mahjong table with friends (UX-DR10, UX-DR11)**.

## Acceptance Criteria

1. **Given** the GameTable layout on iPad landscape (1024px, primary target) **When** rendering the game view **Then** the felt surface is full-width (no persistent sidebar), the player's rack anchors the bottom, opponent areas are at top/left/right positions, and the central area contains discard pool placeholders and wall counter placeholder (UX-DR10)

2. **Given** opponent areas **When** rendering player presence **Then** each opponent position shows: avatar circle with player initial and name, connection status dot, and a placeholder slot for exposed groups below — using the same space whether video is present or not (UX-DR23)

3. **Given** a desktop viewport (>1024px) **When** rendering **Then** the layout uses extra space for larger video frame placeholders and more generous spacing — not a stretched tablet layout

4. **Given** a phone viewport (<768px) **When** rendering **Then** opponent areas compress to small avatars (~40px), discard pool placeholders compress, and a bottom bar placeholder appears for future NMJL/chat/A/V toggles

5. **Given** the felt table center area **When** checking minimum height **Then** it occupies at least 40% of viewport height on all devices (UX-DR16)

6. **Given** device orientation change **When** rotating the device mid-game **Then** the layout adapts fluidly with no game state loss, no modal interruptions, and panel state preserved (UX-DR18)

7. **Given** mobile safe areas **When** rendering fixed-bottom elements (rack, bottom bar) **Then** `padding-bottom: env(safe-area-inset-bottom)` is applied to avoid overlap with iPhone home indicator (UX-DR19)

8. **Given** the action zone above the rack **When** defining the layout region **Then** a fixed-size container component ("ActionZone") is created that maintains fixed dimensions regardless of content, never resizes or repositions, and centers child content (UX-DR13). This is the single location for all player action buttons across all game states.

9. **Given** game table regions (opponent areas, discard pool placeholders, action zone) **When** building the layout in this story **Then** regions are implemented as placeholder containers with correct sizing and positioning — subsequent stories (5A.5 discard pool, 5A.6 call buttons, 5A.8 turn indicator) populate these with real components.

## Tasks / Subtasks

- [x] Task 1: Create `GameTable.vue` layout component (AC: 1, 3, 4, 5)
  - [x] 1.1 Create `GameTable.vue` in `packages/client/src/components/game/` using CSS Grid as the primary layout engine
  - [x] 1.2 Define grid areas: `opponent-top`, `opponent-left`, `opponent-right`, `table-center`, `action-zone`, `rack-area`, `bottom-bar` (mobile only)
  - [x] 1.3 Apply `bg-felt-teal` full-width felt surface — NO persistent sidebar, NO chrome panels consuming horizontal space during gameplay
  - [x] 1.4 Set `min-height: 100dvh` on the game table container (use `dvh` for mobile browser chrome)
  - [x] 1.5 Enforce center area minimum height: at least 40% of viewport height (`min-h-[40dvh]`)
  - [x] 1.6 Responsive grid breakpoints:
    - Desktop (≥1024px): Full immersive table with generous spacing
    - Tablet (768px–1023px): Adapted table, smaller opponent areas
    - Phone (<768px): Progressive disclosure, compressed opponents, bottom bar visible

- [x] Task 2: Create `OpponentArea.vue` placeholder component (AC: 2, 3, 4)
  - [x] 2.1 Create `OpponentArea.vue` in `packages/client/src/components/game/` with props: `position: 'top' | 'left' | 'right'`, `player: { name: string; initial: string; connected: boolean } | null`
  - [x] 2.2 Render avatar circle with player initial and name using design tokens (`radius-full`, `text-interactive`)
  - [x] 2.3 Add connection status dot (green=connected, grey=disconnected) using `state-success` / `text-secondary` tokens
  - [x] 2.4 Reserve space below avatar for exposed groups placeholder (empty div with correct sizing)
  - [x] 2.5 Size variants by viewport:
    - Desktop (≥1024px): ~140x96px placeholder (large video frame size)
    - iPad (~1024px): ~120x80px placeholder
    - Phone (<768px): ~40px avatar circle only with name below
  - [x] 2.6 When `player` is null, render empty seat placeholder ("Waiting..." text)

- [x] Task 3: Create `ActionZone.vue` container component (AC: 8)
  - [x] 3.1 Create `ActionZone.vue` in `packages/client/src/components/game/` as a fixed-size slot container
  - [x] 3.2 Set fixed dimensions: consistent height (~80px) and full rack-width, centered above the rack area
  - [x] 3.3 Use flexbox to center child content horizontally and vertically
  - [x] 3.4 Accept `<slot>` for child content (call buttons, discard confirm, Mahjong button will plug in later)
  - [x] 3.5 CRITICAL: The zone MUST maintain fixed size regardless of content — no resizing, no repositioning
  - [x] 3.6 Add `role="toolbar"` and `aria-label="Game actions"` for accessibility

- [x] Task 4: Create `MobileBottomBar.vue` placeholder component (AC: 4)
  - [x] 4.1 Create `MobileBottomBar.vue` in `packages/client/src/components/game/` — visible only on phone (<768px)
  - [x] 4.2 Render placeholder toggle buttons for: NMJL Card, Chat, A/V controls (non-functional placeholders)
  - [x] 4.3 Apply `min-tap` (44px) to all buttons, use `chrome-surface` background
  - [x] 4.4 Apply `padding-bottom: env(safe-area-inset-bottom)` for iPhone home indicator

- [x] Task 5: Integrate TileRack into layout (AC: 1, 7)
  - [x] 5.1 Import and render existing `TileRack.vue` in the `rack-area` grid zone
  - [x] 5.2 Pass mock tile data (reuse pattern from RackShowcase)
  - [x] 5.3 Apply `padding-bottom: env(safe-area-inset-bottom)` to the rack area on mobile
  - [x] 5.4 Verify rack + action zone + bottom bar do not exceed available space at 375px viewport

- [x] Task 6: Safe area and orientation handling (AC: 6, 7)
  - [x] 6.1 Add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` if not already present in `index.html`
  - [x] 6.2 Apply `env(safe-area-inset-bottom)` to all fixed-bottom elements
  - [x] 6.3 Apply `env(safe-area-inset-top)` awareness for landscape notch/Dynamic Island avoidance
  - [x] 6.4 Verify layout adapts on orientation change (CSS handles this — no JS orientation listeners needed)

- [x] Task 7: Create dev showcase and route (AC: all)
  - [x] 7.1 Create `GameTableShowcase.vue` in `components/dev/` with test scenarios: 4 players, 3 players (1 waiting), phone viewport, desktop viewport
  - [x] 7.2 Add `/dev/table` route in router
  - [x] 7.3 Verify all responsive breakpoints visually

- [x] Task 8: Write comprehensive tests (AC: all)
  - [x] 8.1 GameTable.vue rendering tests: grid areas present, felt background applied, rack rendered
  - [x] 8.2 OpponentArea.vue tests: avatar renders with initial, name displayed, connection status dot, null player shows placeholder
  - [x] 8.3 ActionZone.vue tests: fixed dimensions, slot content renders centered, role="toolbar" present
  - [x] 8.4 MobileBottomBar.vue tests: renders only on phone viewport concept (test the component renders, visibility is CSS-driven)
  - [x] 8.5 Layout integration tests: all regions present, center area has min-height constraint class
  - [x] 8.6 Accessibility tests: landmark roles, safe-area padding classes applied

## Dev Notes

### Architecture Compliance

- **DOM/SVG rendering** — NO canvas, NO game engine. Standard Vue components with CSS Grid layout.
- **State separation** — This is a layout-only story. No game state integration yet. Use mock data for player info and tile data. In production, game state flows via `inject(gameStateKey)` from `RoomView.vue`.
- **No optimistic updates** — Layout is static; no server interaction in this story.
- **Component-level viewport adaptation** — Components read their container size and adapt internally (CSS responsive utilities), not page-level media queries restructuring DOM.

### Layout Strategy — CSS Grid

Use CSS Grid as the primary layout engine for `GameTable.vue`. Grid areas map directly to game table regions:

```
Desktop/iPad (≥1024px):                 Phone (<768px):
┌──────────────────────────────┐        ┌──────────────────────┐
│        opponent-top          │        │    opponent-top       │
├──────┬──────────────┬────────┤        ├──────────────────────┤
│      │              │        │        │    table-center       │
│ opp  │ table-center │  opp   │        │  (opponents inline)  │
│ left │  (discards)  │ right  │        │                      │
│      │              │        │        ├──────────────────────┤
├──────┴──────────────┴────────┤        │    action-zone       │
│        action-zone           │        ├──────────────────────┤
├──────────────────────────────┤        │    rack-area         │
│        rack-area             │        ├──────────────────────┤
└──────────────────────────────┘        │    bottom-bar        │
                                        └──────────────────────┘
```

On phone, left/right opponents move into a horizontal row within the table-center area (or above discard placeholders) to preserve vertical space. The center area must ALWAYS occupy ≥40% of viewport height.

### Responsive Breakpoints — UnoCSS

Use UnoCSS responsive prefixes aligned with the UX spec breakpoints:
- **Phone**: `<768px` (default styles)
- **Tablet**: `md:` prefix (≥768px)
- **Desktop**: `lg:` prefix (≥1024px)

```vue
<!-- Example: opponent area sizing -->
<div class="w-10 h-10 md:w-20 md:h-16 lg:w-35 lg:h-24">
```

Use `dvh` units (dynamic viewport height) for the outer container to handle mobile browser chrome appearing/disappearing. Fallback to `vh` for browsers without `dvh` support.

### Key Layout Rules from UX Spec

1. **Felt surface is ALWAYS full-width** — no persistent chrome panels during gameplay
2. **All overlays (NMJL, chat) slide OVER the felt** — never restructure the layout beneath
3. **Video frames at seat positions are first-class layout elements** — avatar circles occupy the same space when camera is off (no layout shift)
4. **Container-based component sizing** — use parent-relative sizing, not purely viewport-based. CSS container queries where supported.
5. **Maximum width cap** — on ultra-wide viewports (>1920px), constrain the game table to prevent absurd stretching. Use `max-w-screen-2xl` or similar.

### Design Tokens to Use

- **Felt background**: `bg-felt-teal` (from UnoCSS theme)
- **Chrome surfaces**: `bg-chrome-surface` for bottom bar, panels
- **Avatar circles**: `rounded-full`, `bg-chrome-surface-dark`, `text-white`, `text-interactive` sizing
- **Connection dot**: `bg-state-success` (connected), `bg-text-secondary` (disconnected)
- **Spacing**: 4px-based scale — `gap-2` (8px), `gap-3` (12px), `gap-4` (16px)
- **Action zone**: `bg-transparent` (sits on felt), `min-h-20` (~80px fixed)
- **Mobile bottom bar**: `bg-chrome-surface`, `shadow-panel`, `min-tap` (44px buttons)
- **Safe area**: `pb-[env(safe-area-inset-bottom)]` via custom UnoCSS rule or inline style

### Tile Component Reuse

Import and use `TileRack.vue` from story 5a-3. It already handles:
- Horizontal flex layout with drag-and-drop sorting
- Phone viewport horizontal scroll (min-width 30px, overflow-x auto)
- Keyboard navigation (ArrowLeft/Right, Enter to select)
- Passive state (not player's turn)
- Location: `packages/client/src/components/game/TileRack.vue`

For mock tile data, reuse the approach from `RackShowcase.vue` — import tile factories from `@mahjong-game/shared/testing/helpers`.

### Placeholder Strategy

This story creates the layout SCAFFOLD. Subsequent stories plug in real components:
- **5A.5**: `DiscardPool` → fills `table-center` discard areas
- **5A.6**: `CallButtons` → fills `ActionZone` slot during call windows
- **5A.7**: `MahjongButton` → fills `ActionZone` slot as persistent element
- **5A.8**: `TurnIndicator`, `WallCounter`, `Scoreboard` → fills table-center and opponent areas

Placeholders should use:
- Dashed borders (`border-dashed border-white/30`) to indicate "slot for future component"
- Label text inside ("Discard Pool", "Wall Counter", etc.) for dev clarity
- Correct sizing so future components drop in without layout changes
- Visible ONLY in dev mode (`import.meta.env.DEV`) — production shows empty space

### Previous Story Intelligence (5a-3)

**Patterns established to follow:**
- SVG sprite provider `TileSprite.vue` must be in DOM — already imported in `App.vue` chain
- Tile ID mapping: `bam-3-2` → symbol `#bam-3` (strip copy) — handled inside Tile.vue
- UnoCSS shortcuts for repeated patterns — extract to `uno.config.ts` if reusing button/avatar styles across components
- Co-located tests next to components
- Dev showcases at `/dev/*` routes for visual verification

**Problems from 5a-3 to avoid:**
- Hardcoded hex colors caught in code review — always use CSS custom properties or UnoCSS tokens
- DnD Kit `makeDraggable`/`makeDroppable` must actually be called (not just imported) — applicable if adding any DnD in this story (unlikely)
- Pre-existing test failures: 4 tests in `theme.test.ts` are known failures from 5a-1. Do not fix or regress further.

**Current test counts (must not regress):** shared 591 passed, client 132 passed (4 pre-existing theme.test.ts failures), server 183 passed

### Git Intelligence

Recent commits show consistent patterns:
- Commit messages use Conventional Commits format: `feat(client):`, `fix(client):`, `test(server):`
- Components in `components/game/` directory
- Dev showcases in `components/dev/`
- Routes in `router/index.ts`
- Stores in `stores/`

### Project Structure Notes

**New files to create:**
- `packages/client/src/components/game/GameTable.vue` — main layout component
- `packages/client/src/components/game/GameTable.test.ts` — co-located tests
- `packages/client/src/components/game/OpponentArea.vue` — opponent seat placeholder
- `packages/client/src/components/game/OpponentArea.test.ts` — co-located tests
- `packages/client/src/components/game/ActionZone.vue` — fixed-size action container
- `packages/client/src/components/game/ActionZone.test.ts` — co-located tests
- `packages/client/src/components/game/MobileBottomBar.vue` — phone bottom bar
- `packages/client/src/components/game/MobileBottomBar.test.ts` — co-located tests
- `packages/client/src/components/dev/GameTableShowcase.vue` — dev showcase

**Files to modify:**
- `packages/client/src/router/index.ts` — add `/dev/table` route

**Do NOT create files in any other location.** Follow existing patterns from 5a-1, 5a-2, 5a-3.

### Anti-Patterns to Avoid

- **NO raw hex colors** — use CSS custom properties from theme.css and UnoCSS tokens
- **NO hardcoded transition durations** — use `var(--timing-tactile)`, `var(--ease-tactile)` etc.
- **NO `v-html`** — direct template rendering only
- **NO Options API** — Composition API with `<script setup lang="ts">` only
- **NO barrel imports within package** — import directly from source files
- **NO game state in this story** — use mock/prop data. Game state integration happens when `RoomView` is built
- **NO page-level media queries restructuring DOM** — use UnoCSS responsive classes on components
- **NO persistent sidebar or chrome panels** — felt is always full-width (Direction B: Immersive Table)
- **NO canvas or game engine** — standard Vue components with CSS Grid

### Testing Standards

- **Co-located tests:** `GameTable.test.ts` next to `GameTable.vue`, etc.
- **Environment:** Vitest with happy-dom (configured in `vitest.config.ts`)
- **Component testing:** Use `@vue/test-utils` mount() — behavioral/blackbox assertions
- **Test data:** Use mock player objects, not real game state
- **Run full suite:** `pnpm -r test` must pass with zero regressions

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5A, Story 5A.4]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Project Structure, Vue Component Pattern, Client State]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Direction B (Immersive Table), UX-DR10/11/13/15/16/18/19/23, Breakpoint Strategy, Responsive Design]
- [Source: _bmad-output/planning-artifacts/gdd.md — Game Table layout, FR100]
- [Source: _bmad-output/implementation-artifacts/5a-3-tilerack-with-drag-and-drop-sort.md — Previous story patterns, test counts]
- [Source: _bmad-output/project-context.md — State access rules, CSS rules, component rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No blockers or debug issues encountered during implementation.

### Completion Notes List

- Implemented full CSS Grid-based immersive game table layout with responsive breakpoints (phone <768px, tablet 768-1023px, desktop ≥1024px)
- GameTable.vue uses CSS Grid with data-testid regions for all game areas, `bg-felt-teal` full-width felt surface, `min-h-[100dvh]` for mobile browser chrome, `max-w-screen-2xl` for ultra-wide constraint
- OpponentArea.vue renders avatar circles with player initials, connection status dots (green/grey), responsive sizing, and "Waiting..." placeholder for null players
- ActionZone.vue is a fixed-size (80px height) slot container with `role="toolbar"` and `aria-label="Game actions"` — maintains fixed dimensions regardless of content
- MobileBottomBar.vue renders 3 disabled placeholder buttons (Card, Chat, A/V) with `min-tap` (44px) sizing and `bg-chrome-surface` background
- TileRack integrated in rack-area with safe-area padding `pb-[env(safe-area-inset-bottom)]`
- Updated viewport meta tag with `viewport-fit=cover` for iOS safe area inset support
- On phone, left/right opponents render inline within table-center area to preserve vertical space
- Dev placeholders (Discard Pool, Wall Counter, Action Buttons, Exposed Groups) visible only in dev mode via `import.meta.env.DEV`
- GameTableShowcase.vue at `/dev/table` with scenario switching (4 players, 3 players)
- All design tokens used from UnoCSS theme — no hardcoded colors
- 38 new tests added (10 GameTable, 8 OpponentArea, 6 ActionZone, 7 MobileBottomBar, 7 integration/accessibility)
- Test results: shared 591 passed, client 170 passed (4 pre-existing theme.test.ts failures), server 183 passed — zero regressions

### Change Log

- 2026-03-30: Implemented story 5a-4 Game Table Layout (Immersive Table) — all 8 tasks complete with 38 new tests
- 2026-03-30: Code review fixes — deduplicated OpponentPlayer interface, fixed tablet breakpoint to md: for 3-column grid, fixed double safe-area padding on phone, removed redundant CSS class

### File List

**New files:**
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/game/OpponentArea.vue`
- `packages/client/src/components/game/OpponentArea.test.ts`
- `packages/client/src/components/game/ActionZone.vue`
- `packages/client/src/components/game/ActionZone.test.ts`
- `packages/client/src/components/game/MobileBottomBar.vue`
- `packages/client/src/components/game/MobileBottomBar.test.ts`
- `packages/client/src/components/dev/GameTableShowcase.vue`

**Modified files:**
- `packages/client/src/router/index.ts` — added `/dev/table` route
- `packages/client/index.html` — added `viewport-fit=cover` to viewport meta tag
