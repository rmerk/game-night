# Story 5A.2: Tile Component & SVG Sprite Sheet

Status: done

## Story

As a **player**,
I want **to see beautifully rendered, clearly readable Mahjong tiles that look like premium acrylic tiles**,
So that **I can identify every tile at a glance on both desktop and mobile (UX-DR20)**.

## Acceptance Criteria

1. **AC1 — SVG Sprite Sheet:** Given the SVG sprite sheet, when checking its contents, then all 152 tile faces are defined as `<symbol>` elements with IDs matching the tile ID convention (e.g., `#bam-3`, `#wind-north`, `#joker`, `#flower-a`) (AR18)

2. **AC2 — Tile.vue Rendering:** Given the Tile.vue component, when rendering a tile, then it uses `<use href="#tile-id">` to reference the sprite sheet, displays the tile face on a white base with subtle drop shadow (`shadow-tile`) and `radius-lg` (12px) for the acrylic feel

3. **AC3 — Tile States:** Given tile states, when interacting with tiles, then the component supports: default, hover (lifts 4px on desktop), selected (lifts 8px + gold border), disabled (reduced opacity), and face-down (back pattern) (UX-DR20)

4. **AC4 — Size Variants:** Given tile variants, when rendering in different contexts, then three size variants work: `standard` (~50px for rack), `small` (~30px for exposed groups/discards at `tile-min-width`), and `celebration` (larger for fan-out)

5. **AC5 — Accessibility Markup:** Given accessibility requirements, when inspecting tile markup, then each tile has `role="button"` and `aria-label` describing the tile (e.g., "3 of Bamboo"), and suit is conveyed via shape/pattern in addition to color (UX-DR41)

6. **AC6 — Corner Indices:** Given all suited tiles (Craks, Bams, Dots), when rendered at any size, then Arabic numeral corner indices are visible for accessibility — experienced players can read Chinese characters, newcomers need the number

## Tasks / Subtasks

- [x] Task 1: Create SVG sprite sheet with all tile faces (AC: #1, #6)
  - [x]1.1 Create `packages/client/src/components/tiles/tile-assets/tiles.svg` with all 152 tile faces as `<symbol>` elements
  - [x]1.2 Use kebab-case IDs matching tile type system: `bam-1` through `bam-9`, `crak-1` through `crak-9`, `dot-1` through `dot-9`, `wind-north`, `wind-east`, `wind-west`, `wind-south`, `dragon-red`, `dragon-green`, `dragon-soap`, `flower-a`, `flower-b`, `joker`
  - [x]1.3 Include Arabic numeral corner indices on all suited tiles (Craks, Bams, Dots) for accessibility — must be readable at 30px tile width
  - [x]1.4 Apply color-blind safe design: each suit has unique shape/pattern distinguishers (bamboo sticks, Chinese numerals, circles) IN ADDITION to color
  - [x]1.5 Design tile back pattern as a separate `<symbol id="tile-back">`

- [x] Task 2: Create `tiles.css` with CSS custom properties for suit colors (AC: #1)
  - [x]2.1 Create `packages/client/src/components/tiles/tile-assets/tiles.css` with CSS custom properties that map to design tokens from `design-tokens.ts`
  - [x]2.2 Properties: `--tile-suit-bam` (#2D8B46), `--tile-suit-crak` (#C23B22), `--tile-suit-dot` (#2E5FA1) — reference the UnoCSS token values
  - [x]2.3 Include `--tile-base-bg` (white), `--tile-base-border`, `--tile-back-pattern` properties for theming

- [x] Task 3: Create Tile.vue component (AC: #2, #3, #4, #5)
  - [x]3.1 Create `packages/client/src/components/tiles/Tile.vue` using `<script setup lang="ts">`
  - [x]3.2 Props: `tile: Tile` (from `@mahjong-game/shared`), `size: 'standard' | 'small' | 'celebration'` (default: `'standard'`), `state: 'default' | 'hover' | 'selected' | 'disabled' | 'face-down'` (default: `'default'`), `interactive: boolean` (default: `true`)
  - [x]3.3 Render using `<svg><use :href="spriteHref" /></svg>` pattern where `spriteHref` is computed from tile properties
  - [x]3.4 Map tile to SVG symbol ID: suited tiles → `{suit}-{value}`, winds → `wind-{value}`, dragons → `dragon-{value}`, flowers → `flower-{value}`, jokers → `joker`
  - [x]3.5 Apply white base background, `shadow-tile`, `radius-lg` (12px) for acrylic look
  - [x]3.6 Set `role="button"` when interactive, `aria-label` computed from tile (e.g., "3 of Bamboo", "North Wind", "Red Dragon", "Flower A", "Joker")
  - [x]3.7 Face-down state: render `<use href="#tile-back">` instead of tile face

- [x] Task 4: Implement tile states with CSS/UnoCSS (AC: #3)
  - [x]4.1 Default state: flat on surface, no transform
  - [x]4.2 Hover state (desktop only via `@media (hover: hover)`): `translateY(-4px)` with `timing-tactile` (120ms) transition
  - [x]4.3 Selected state: `translateY(-8px)` + gold border (`gold-accent` token) with `timing-tactile` transition
  - [x]4.4 Disabled state: `opacity: 0.5`, `pointer-events: none`
  - [x]4.5 Use CSS custom properties from `theme.css` for timing: `var(--timing-tactile)`, `var(--ease-tactile)`
  - [x]4.6 All transitions respect `prefers-reduced-motion` (already overridden to 0ms in theme.css)

- [x] Task 5: Implement size variants (AC: #4)
  - [x]5.1 `standard`: width ~50px (for player rack on iPad landscape)
  - [x]5.2 `small`: width 30px (`tile-min-width` — for exposed groups, discard pools)
  - [x]5.3 `celebration`: width ~70px (for fan-out display)
  - [x]5.4 Maintain aspect ratio across all sizes (tiles are taller than wide, ~3:4 ratio)
  - [x]5.5 Ensure SVG symbols scale cleanly at all sizes without pixel artifacts

- [x] Task 6: Create TileBack.vue component (AC: #3)
  - [x]6.1 Create `packages/client/src/components/tiles/TileBack.vue` for concealed/face-down tiles
  - [x]6.2 Render tile back pattern with same base styling (white base, shadow, radius) as Tile.vue
  - [x]6.3 Accept `size` prop matching Tile.vue variants

- [x] Task 7: Write unit tests (AC: all)
  - [x]7.1 Create `packages/client/src/components/tiles/Tile.test.ts`
  - [x]7.2 Test SVG symbol ID mapping for each tile category (suited, wind, dragon, flower, joker)
  - [x]7.3 Test `aria-label` generation for each tile type
  - [x]7.4 Test size variant class application
  - [x]7.5 Test state class application (default, hover, selected, disabled, face-down)
  - [x]7.6 Test face-down renders tile-back symbol instead of tile face
  - [x]7.7 Test `role="button"` present when interactive, absent when not
  - [x]7.8 Verify sprite sheet contains all 152 symbols (parse SVG file)
  - [x]7.9 Create `packages/client/src/components/tiles/TileBack.test.ts` with size variant tests

- [x]Task 8: Create dev showcase route for visual verification (AC: all)
  - [x]8.1 Create `packages/client/src/components/dev/TileShowcase.vue` displaying all unique tile faces at each size variant
  - [x]8.2 Show all 34 unique faces: 27 suited (9 bam + 9 crak + 9 dot), 4 winds, 3 dragons, 2 flowers, 1 joker, plus tile back
  - [x]8.3 Display tile state variations (default, hover, selected, disabled, face-down)
  - [x]8.4 Add route `/dev/tiles` gated on `import.meta.env.DEV` (same pattern as `/dev/theme`)
  - [x]8.5 Include 30px minimum width rendering for readability validation (story 5A.10 dependency)

## Dev Notes

### Architecture Compliance

- **Rendering approach:** DOM/SVG with CSS transitions — NO canvas, NO game engine. Standard web rendering provides browser-native accessibility for free.
- **Single SVG sprite sheet:** All 152 faces as `<symbol>` elements in one file → one cacheable asset, resolution-independent scaling.
- **Component location:** `packages/client/src/components/tiles/` — matches architecture file structure exactly.
- **Tile ID to SVG ID mapping:** Strip the copy number from the tile's `id` field. Tile `bam-3-2` maps to SVG symbol `#bam-3`. This is critical — the SVG only has 34 unique faces (+ joker + tile-back), not 152 individual symbols.

### Tile Face Count (34 unique faces + tile back)

| Category | Tiles | Symbol IDs |
|----------|-------|------------|
| Bamboo (Bam) | 9 | `bam-1` through `bam-9` |
| Cracks (Crak) | 9 | `crak-1` through `crak-9` |
| Dots | 9 | `dot-1` through `dot-9` |
| Winds | 4 | `wind-north`, `wind-east`, `wind-west`, `wind-south` |
| Dragons | 3 | `dragon-red`, `dragon-green`, `dragon-soap` |
| Flowers | 2 | `flower-a`, `flower-b` |
| Joker | 1 | `joker` |
| Tile Back | 1 | `tile-back` |
| **Total** | **38 symbols** | (34 faces + 1 joker + 1 tile-back + 2 flowers = 38) |

### Tile ID → SVG Symbol ID Mapping Logic

```typescript
function tileToSymbolId(tile: Tile): string {
  switch (tile.category) {
    case 'suited': return `${tile.suit}-${tile.value}`     // "bam-3"
    case 'wind':   return `wind-${tile.value}`             // "wind-north"
    case 'dragon': return `dragon-${tile.value}`           // "dragon-red"
    case 'flower': return `flower-${tile.value}`           // "flower-a"
    case 'joker':  return 'joker'                          // "joker"
  }
}
```

### Tile Visual Design Requirements (from GDD + UX Spec)

- **Base style:** Clean & minimal — white tile base, colored art, subtle drop shadow
- **Craks (1-9):** Simplified Chinese numerals with corner Arabic numerals for accessibility
- **Bams (1-9):** Stylized bamboo sticks with modernized bird motif on 1-Bam
- **Dots (1-9):** Geometric circle patterns, symmetric and satisfying
- **Winds (N/E/W/S):** English letters with distinctive typographic treatment and unique color accents
- **Dragons:** Color-coded symbols — Red: 中, Green: 發, White/Soap: bordered rectangle
- **Flowers:** Distinct floral illustrations for A and B types
- **Jokers:** Bold, distinctive, instantly recognizable, playful and mischievous feel
- **All suited tiles MUST have Arabic numeral corner indices** for the 40-70+ demographic

### Color References (from design-tokens.ts)

| Token | Hex | Usage |
|-------|-----|-------|
| `suit-bam` | #2D8B46 | Bamboo tile artwork (green) |
| `suit-crak` | #C23B22 | Crack tile artwork (red) |
| `suit-dot` | #2E5FA1 | Dot tile artwork (blue) |
| `gold-accent` | #C4A35A | Selected tile border |
| `shadow-tile` | warm-toned subtle | Tile depth on felt |
| `radius-lg` | 12px | Tile border radius (acrylic feel) |

### Size Variant Specifications

| Variant | Width | Use Context | Notes |
|---------|-------|-------------|-------|
| `standard` | ~50px | Player rack on iPad landscape (1024px) | Primary size, most visible |
| `small` | 30px | Exposed groups, discard pools, opponent tiles | `tile-min-width` — must be readable |
| `celebration` | ~70px | Winning hand fan-out display | Larger for dramatic reveal |

Tiles maintain a consistent aspect ratio (~3:4 width:height, matching real mahjong tile proportions). Height computed from width.

### Tile State CSS Approach

Use CSS classes on the tile wrapper element, NOT inline styles:

```
.tile                    → base styles (white bg, shadow-tile, radius-lg)
.tile--hover             → translateY(-4px) via @media(hover:hover)
.tile--selected          → translateY(-8px) + gold border
.tile--disabled          → opacity: 0.5, pointer-events: none
.tile--face-down         → shows tile-back symbol
.tile--size-standard     → width: 50px
.tile--size-small        → width: 30px
.tile--size-celebration  → width: 70px
```

Use UnoCSS utility classes where possible, but tile-specific transitions may need scoped CSS within the component for the `transform` + `transition` combinations.

### Accessibility Requirements

- `role="button"` on interactive tiles, `role="img"` on non-interactive display tiles
- `aria-label` examples: "3 of Bamboo", "North Wind", "Red Dragon", "Soap Dragon", "Flower A", "Joker"
- Suit identity conveyed by **shape/pattern AND color** — each suit has a unique visual shape (sticks, numerals, circles) distinguishable without color
- Corner Arabic numerals must be readable at 30px width for the 40-70+ demographic
- Minimum 14px text anywhere on tile at smallest size
- WCAG AA contrast (4.5:1) between tile art and white background

### SVG Sprite Sheet Import Strategy

Import the SVG sprite sheet as a URL in Vite and inject it into the document, OR inline it as a hidden SVG at the top of the component tree. The `<use href="...#symbol-id">` approach requires the SVG to be in the same document or referenced via URL.

**Recommended approach:** Inline the sprite SVG in `App.vue` (or a dedicated `TileSpriteProvider.vue` component) so all `<use href="#...">` references work without cross-origin issues:

```vue
<!-- App.vue or TileSpriteProvider.vue -->
<template>
  <div style="display:none" v-html="spriteContent" />
  <!-- OR -->
  <svg style="display:none" aria-hidden="true">
    <!-- inline all <symbol> elements here -->
  </svg>
</template>
```

**IMPORTANT:** Do NOT use `v-html` (eslint-plugin-vue `vue/no-v-html` rule is set to error). Instead, use a raw SVG import via Vite's `?raw` suffix and render it via a custom component that parses the SVG safely, OR simply inline the `<symbol>` elements directly.

**Simplest compliant approach:** Create a `TileSprite.vue` component that contains the `<svg>` with all `<symbol>` elements directly in its template. This avoids `v-html` entirely.

### Previous Story (5A.1) Intelligence

**Key patterns established:**
- Design tokens in `design-tokens.ts` shared between `uno.config.ts` and tests
- CSS custom properties in `theme.css` for runtime-switchable values (timing, mood, dark mode)
- Dev showcase pattern: component at `/dev/*` route gated on `import.meta.env.DEV`
- Test approach: direct token validation + manual visual verification via showcase
- UnoCSS with `presetWind4()` — use utility classes, no raw values

**Files created in 5a-1 (DO NOT recreate or modify unless necessary):**
- `packages/client/src/styles/design-tokens.ts`
- `packages/client/src/styles/theme.css`
- `packages/client/src/styles/base.css`
- `packages/client/uno.config.ts` (modified)
- `packages/client/src/main.ts` (modified — imports theme.css, base.css before virtual:uno.css)

**Debug learnings from 5a-1:**
- UnoCSS `?raw` CSS import not supported in Vitest environment — use `node:fs` readFileSync instead for reading CSS in tests
- `@unocss/core` createGenerator not resolvable from test files — test token definitions directly instead

### Project Structure Notes

**New files this story creates:**

```
packages/client/src/components/tiles/
├── Tile.vue                    # Main tile component
├── Tile.test.ts                # Unit tests
├── TileBack.vue                # Face-down tile component
├── TileBack.test.ts            # Unit tests
├── TileSprite.vue              # Hidden SVG sprite provider (all <symbol> elements)
└── tile-assets/
    ├── tiles.svg               # SVG sprite sheet with all 38 <symbol> elements
    └── tiles.css               # CSS custom properties for suit colors
```

**Dev showcase (add to existing dev/ directory):**

```
packages/client/src/components/dev/
└── TileShowcase.vue            # Visual verification of all tiles at all sizes/states
```

**Router update:** Add `/dev/tiles` route to `packages/client/src/router/index.ts` (same dev-gated pattern as `/dev/theme`)

### Technology Versions & Libraries

| Library | Version | Usage in This Story |
|---------|---------|---------------------|
| Vue 3 | ^3.5 | `<script setup lang="ts">`, Composition API |
| Vite | ^8.0 | Build tool, `?raw` imports for SVG |
| UnoCSS | ^66.0 | Utility classes for tile styling |
| Vitest | (workspace) | Unit tests with happy-dom |
| @vue/test-utils | ^2.4.6 | Component mounting in tests |
| TypeScript | ^5.8 | Strict mode, shared types |

**DO NOT install new dependencies.** All required libraries are already in `package.json`.

### Testing Standards

- Co-located tests: `Tile.test.ts` next to `Tile.vue`
- Use `describe`/`it`/`expect` from Vitest
- Mount components with `@vue/test-utils` `mount()`
- Test environment: `happy-dom` (configured in `vite.config.ts`)
- Run full regression after: `pnpm test` from root should pass all packages
- Expected existing test count: ~809 (591 shared + 51 client + 167 server)

### Anti-Patterns to Avoid

- **NO raw hex colors** — always use UnoCSS tokens or CSS custom properties
- **NO hardcoded transition durations** — use `var(--timing-tactile)` etc.
- **NO `v-html`** — eslint rule `vue/no-v-html` is set to error
- **NO canvas rendering** — DOM/SVG only for browser-native accessibility
- **NO optimistic state updates** — tiles render from server state only (client-local arrangement is the one exception via Pinia `useRackStore`)
- **NO Options API** — always `<script setup lang="ts">` with Composition API
- **NO runtime prop validation** — use `defineProps<{}>()` with TypeScript generics
- **NO scoped styles if UnoCSS utilities suffice** — use utility classes first, scoped CSS only for complex transitions

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5A, Story 5A.2]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — SVG Tile Rendering, Client Components, File Structure]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Tile Display, Tile States, Accessibility]
- [Source: _bmad-output/planning-artifacts/gdd.md — Tile Types and Visual Design]
- [Source: _bmad-output/implementation-artifacts/5a-1-design-system-foundation.md — Design Tokens, Dev Learnings]
- [Source: packages/shared/src/types/tiles.ts — Tile type definitions]
- [Source: packages/shared/src/constants.ts — SUITS, WINDS, DRAGONS, FLOWERS constants]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- No blocking issues encountered during implementation.
- Pre-existing 4 test failures in `theme.test.ts` (hex case sensitivity `#E8896E` vs `#e8896e`) — unrelated to this story.

### Completion Notes List

- Created SVG sprite sheet with 38 symbols (27 suited + 4 winds + 3 dragons + 2 flowers + 1 joker + 1 tile-back)
- Created TileSprite.vue provider component that inlines all symbols into the DOM (avoids v-html, compliant with no-v-html eslint rule)
- Created Tile.vue with full state support (default, hover, selected, disabled, face-down), 3 size variants (standard 50px, small 30px, celebration 70px), accessibility markup (role, aria-label, keyboard navigation)
- Created TileBack.vue standalone component for face-down tiles
- Created tiles.css with CSS custom properties for suit colors
- Created TileShowcase.vue dev page at /dev/tiles with all faces, sizes, states, and 30px readability validation section
- 45 new tests: symbol ID mapping, aria-label generation, size variants, state classes, face-down rendering, accessibility roles, click/keyboard interactions, sprite sheet symbol coverage (both component and file)
- Full regression: shared 591 passed, client 94 passed (4 pre-existing failures in theme.test.ts)

### Change Log

- 2026-03-29: Implemented story 5A.2 — Tile component, SVG sprite sheet, TileBack, TileShowcase, 45 tests
- 2026-03-29: Code review — replaced hardcoded #c4a35a hex with var(--tile-accent-gold) CSS custom property in Tile.vue (anti-pattern compliance). Added --tile-accent-gold to tiles.css.

### File List

- packages/client/src/components/tiles/tile-assets/tiles.svg (NEW)
- packages/client/src/components/tiles/tile-assets/tiles.css (NEW)
- packages/client/src/components/tiles/TileSprite.vue (NEW)
- packages/client/src/components/tiles/Tile.vue (NEW)
- packages/client/src/components/tiles/TileBack.vue (NEW)
- packages/client/src/components/tiles/Tile.test.ts (NEW)
- packages/client/src/components/tiles/TileBack.test.ts (NEW)
- packages/client/src/components/dev/TileShowcase.vue (NEW)
- packages/client/src/router/index.ts (MODIFIED — added /dev/tiles route)
- packages/client/src/main.ts (MODIFIED — import tiles.css)
