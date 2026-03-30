# Story 5A.1: Design System Foundation

Status: done

## Story

As a **developer**,
I want **the UnoCSS design system configured with all color tokens, typography roles, spacing scale, animation tokens, and accessibility utilities**,
so that **every subsequent UI component is built on a consistent, token-driven foundation with no raw values (UX-DR1 through UX-DR9)**.

## Acceptance Criteria

### AC1: Color Tokens (UX-DR1)
```gherkin
Given the UnoCSS configuration is loaded
When a developer uses token names in templates (e.g., bg-felt-teal, text-suit-bam)
Then the correct color values are applied, including:
  - Felt: felt-teal (~#2A6B6B)
  - Chrome: chrome-surface (~#F5F0E8), chrome-surface-dark (~#2C2A28), chrome-border (~#D4CFC5), chrome-elevated
  - Accent: gold-accent (~#C4A35A), gold-accent-hover
  - Suit: suit-bam (green), suit-crak (red), suit-dot (blue)
  - Text: text-primary (~#2C2420), text-secondary, text-on-felt, text-on-dark (~#E8E0D4)
  - State: state-turn-active, state-call-window, state-success, state-error, state-warning
  - Wall counter: wall-normal, wall-warning, wall-critical
  - Hand guidance: guidance-achievable, guidance-distant
  - Celebration: celebration-gold, celebration-dim
And dark mode (prefers-color-scheme: dark) remaps chrome-layer tokens (cream → charcoal)
  while felt and gold tokens remain constant
```

### AC2: Typography System (UX-DR2)
```gherkin
Given the UnoCSS shortcuts are defined
When a developer applies text-game-critical, text-interactive, text-body, text-card-pattern, or text-secondary
Then the correct size, weight, and font-family are applied:
  - text-game-critical: 20px minimum, semibold
  - text-interactive: 18px minimum, semibold
  - text-body: 16px minimum, regular
  - text-card-pattern: 16px minimum, monospace/tabular
  - text-secondary: 14px minimum, regular
And no text anywhere renders below 14px
And no light/thin weights (100-300) are used
```

### AC3: Animation Tokens (UX-DR3)
```gherkin
Given CSS custom properties are defined in theme.css
When components reference animation timing tokens
Then four tiers are available:
  - --timing-tactile: 120ms, ease-out (tile lift, button press, rack snap)
  - --timing-expressive: 400ms, cubic-bezier(0.16, 1, 0.3, 1) (celebration, mood crossfade)
  - --timing-entrance: 200ms, ease-out (element entry)
  - --timing-exit: 150ms, ease-in (element exit)
And under prefers-reduced-motion, ALL durations override to 0ms
```

### AC4: Spacing & Sizing Utilities (UX-DR4, UX-DR5)
```gherkin
Given the UnoCSS theme defines a spacing scale
When a developer uses spacing utilities
Then a 4px-based scale is available: 4/8/12/16/24/32/48/64/96
And a min-tap shortcut provides 44px min-h and min-w (WCAG tap target)
And border radius scale is defined: sm (4px), md (8px), lg (12px), full
And warm-toned shadows are defined: shadow-tile, shadow-panel, shadow-modal
```

### AC5: Focus Ring Tokens (UX-DR6)
```gherkin
Given interactive elements need visible focus indicators
When focus ring utility classes are applied
Then three context-adaptive variants are available (2px solid, 2px offset):
  - focus-ring-on-chrome: #8C7038 (4.12:1 contrast)
  - focus-ring-on-felt: #F5F0E8 (5.42:1 contrast)
  - focus-ring-on-dark: #C4A35A (5.95:1 contrast)
All meeting WCAG 3:1 UI component contrast minimum
```

### AC6: Error & State Colors (UX-DR7)
```gherkin
Given mode-adaptive error styling is needed
When the app runs in light mode
Then state-error renders as #B8553A (4.21:1 on chrome-surface)
When the app runs in dark mode
Then state-error renders as #E8896E (5.61:1 on dark chrome)
```

### AC7: Mood-Switching Mechanism (UX-DR8, UX-DR9)
```gherkin
Given a CSS class is applied to the root element
When mood-arriving, mood-playing, or mood-lingering is set
Then CSS custom properties remap automatically:
  - Mood-specific surface, emphasis, and gold temperature tokens resolve
  - Components using mood-aware tokens update without modification
And mood-specific gold temperature shifts are defined:
  - Arriving: warmer/amber tone
  - Playing: cooler/brass tone
  - Lingering: softer/muted tone
```

### AC8: Dark Mode Support
```gherkin
Given the user's system preference is dark mode
When the app loads
Then chrome-layer tokens remap (cream → charcoal)
And felt-teal and gold-accent remain constant
And all text contrast ratios maintain WCAG AA compliance
```

### AC9: Visual Verification
```gherkin
Given all tokens are configured
When a theme showcase page is loaded at /dev/theme (dev-only route)
Then all color swatches, typography roles, spacing scale, animation timings,
     focus rings, shadows, and mood variants are visible for manual verification
```

## Tasks / Subtasks

- [x] Task 1: UnoCSS theme configuration (AC: 1,4)
  - [x] 1.1 Define color tokens in `uno.config.ts` theme.colors — all felt, chrome, accent, suit, text, state, wall, guidance, celebration tokens
  - [x] 1.2 Define spacing scale (4px base): 4/8/12/16/24/32/48/64/96
  - [x] 1.3 Define border radius scale: sm (4px), md (8px), lg (12px), full
  - [x] 1.4 Define warm-toned shadow scale: shadow-tile, shadow-panel, shadow-modal
  - [x] 1.5 Define `min-tap` shortcut → `min-h-11 min-w-11` (44px)
- [x] Task 2: Typography shortcuts (AC: 2)
  - [x] 2.1 Define UnoCSS shortcuts for text-game-critical (20px, semibold)
  - [x] 2.2 Define text-interactive (18px, semibold)
  - [x] 2.3 Define text-body (16px, regular)
  - [x] 2.4 Define text-card-pattern (16px, monospace/tabular)
  - [x] 2.5 Define text-secondary (14px, regular)
- [x] Task 3: CSS custom properties file (AC: 3,5,7,8)
  - [x] 3.1 Create `packages/client/src/styles/theme.css` with animation timing custom properties
  - [x] 3.2 Add easing custom properties (ease-out, cubic-bezier, ease-in)
  - [x] 3.3 Add prefers-reduced-motion media query overriding all durations to 0ms
  - [x] 3.4 Add focus ring custom properties (3 context-adaptive variants)
  - [x] 3.5 Add mood-switching CSS custom properties (mood-arriving, mood-playing, mood-lingering classes)
  - [x] 3.6 Add dark mode overrides via prefers-color-scheme: dark
  - [x] 3.7 Add mood-specific gold temperature token overrides
- [x] Task 4: Base styles (AC: 2,6,8)
  - [x] 4.1 Create `packages/client/src/styles/base.css` with reset and global typography defaults
  - [x] 4.2 Set minimum font size (14px floor) on body
  - [x] 4.3 Import theme.css and base.css in main.ts (alongside virtual:uno.css)
- [x] Task 5: Theme showcase page (AC: 9)
  - [x] 5.1 Create `ThemeShowcase.vue` in `packages/client/src/components/dev/`
  - [x] 5.2 Display all color swatches with token names and hex values
  - [x] 5.3 Display typography roles with sample text at each size
  - [x] 5.4 Display spacing scale, border radius, and shadow examples
  - [x] 5.5 Display focus ring variants on each background
  - [x] 5.6 Add mood toggle buttons to preview mood-switching mechanism
  - [x] 5.7 Add dark mode toggle for manual testing
  - [x] 5.8 Register /dev/theme route (dev-only, gated on import.meta.env.DEV)
- [x] Task 6: Tests (AC: 1-8)
  - [x] 6.1 Unit test: UnoCSS config generates expected color token CSS
  - [x] 6.2 Unit test: Typography shortcuts produce correct font-size and font-weight
  - [x] 6.3 Unit test: Mood class switching remaps custom properties
  - [x] 6.4 Unit test: Dark mode overrides apply correctly
  - [x] 6.5 Unit test: Reduced motion media query sets all durations to 0ms

## Dev Notes

### Architecture Compliance

**Styling approach:** UnoCSS utility-first with `presetWind4`. All design tokens defined in `uno.config.ts` theme section. CSS custom properties in `theme.css` for values that need runtime switching (animations, moods, dark mode). Components use utility classes (`bg-felt-teal`, `text-game-critical`) — never raw hex values in `.vue` files.

**No component library:** Every UI element is purpose-built. This story creates the token foundation; actual components come in stories 5A.2-5A.10.

### Key Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/client/uno.config.ts` | **MODIFY** | Add theme colors, spacing, radius, shadows, shortcuts |
| `packages/client/src/styles/theme.css` | **NEW** | Animation tokens, focus rings, mood switching, dark mode custom properties |
| `packages/client/src/styles/base.css` | **NEW** | CSS reset, global typography defaults, font imports |
| `packages/client/src/main.ts` | **MODIFY** | Import theme.css and base.css |
| `packages/client/src/components/dev/ThemeShowcase.vue` | **NEW** | Visual verification page |
| `packages/client/src/router/index.ts` | **MODIFY** | Add /dev/theme route (dev-only) |

### Existing UnoCSS Configuration

The current `uno.config.ts` uses:
- `presetWind4` (Tailwind-compatible utilities)
- `transformerVariantGroup` (group variant syntax)
- `transformerDirectives` (@apply directives)

Extend the existing config by adding `theme` and `shortcuts` — do NOT replace the preset or transformers.

### Color Token Implementation Strategy

**In `uno.config.ts` theme.colors:**
```typescript
// Direct color tokens for UnoCSS utility classes (bg-felt-teal, text-suit-bam, etc.)
colors: {
  felt: { teal: '#2A6B6B' },
  chrome: { surface: '#F5F0E8', 'surface-dark': '#2C2A28', border: '#D4CFC5', elevated: '...' },
  gold: { accent: '#C4A35A', 'accent-hover': '...' },
  suit: { bam: '...', crak: '...', dot: '...' },
  // ... etc
}
```

**In `theme.css` for runtime-switchable values:**
```css
:root {
  /* Mood tokens — remapped by .mood-* classes */
  --mood-surface: var(--color-chrome-surface);
  --mood-emphasis: var(--color-gold-accent);
  /* Animation tokens */
  --timing-tactile: 120ms;
  /* etc. */
}
.mood-arriving { --mood-gold-temp: ...; }
.mood-playing { --mood-gold-temp: ...; }
.mood-lingering { --mood-gold-temp: ...; }
```

### Dark Mode Strategy

Use `prefers-color-scheme: dark` media query in `theme.css` to remap chrome-layer tokens:
- `chrome-surface` → charcoal (`#2C2A28`)
- `chrome-elevated` → slightly lighter charcoal
- `text-primary` → light cream (`#E8E0D4`)
- `state-error` → brighter coral (`#E8896E`)
- Felt teal and gold accent stay constant

UnoCSS `dark:` variant can also be used in templates for component-level dark overrides.

### Font Strategy

- **UI Font:** Inter (system font stack fallback: -apple-system, BlinkMacSystemFont, Segoe UI, etc.)
- **Card Font:** Specify `font-mono` or a tabular-specific font for NMJL hand notation
- **Display Font:** Not needed for this story (wordmark/celebration text comes in Epic 7)
- Load Inter via CDN link in `index.html` or as a local asset — prefer CDN for simplicity

### Mood Mechanism Details

Root element gets a CSS class (`mood-arriving` default during lobby). The class remaps a subset of CSS custom properties:

- `--mood-surface` — primary background tint
- `--mood-emphasis` — accent emphasis level
- `--mood-gold-temp` — gold color temperature shift

Components that need mood-awareness use `var(--mood-*)` tokens. Components that don't (most) use static tokens like `bg-felt-teal`. This means:
- Mood transitions (Epic 7) require zero component changes
- This story only defines the token structure and class mechanism, NOT the transitions

### Testing Approach

- UnoCSS config validation: Generate CSS output and verify token presence
- Theme showcase: Manual visual verification (this is the primary QA tool)
- Component tests: Mount a minimal component with each token and verify computed styles
- Dark mode: Verify token remapping in CSS output
- Reduced motion: Verify `@media (prefers-reduced-motion: reduce)` rules present

### Contrast Validation Reference

All color pairs are pre-validated from the UX spec:

| Pair | Ratio | WCAG |
|------|-------|------|
| text-primary on chrome-surface | 13.41:1 | AAA |
| text-on-felt on felt-teal | 6.15:1 | AA |
| text-primary on gold-accent | 5.95:1 | AA |
| text-on-dark on chrome-surface-dark | 10.92:1 | AAA |
| focus-ring-on-chrome (#8C7038) | 4.12:1 | AA (components) |
| focus-ring-on-felt (#F5F0E8) | 5.42:1 | AA |
| focus-ring-on-dark (#C4A35A) | 5.95:1 | AA |
| state-error light on chrome-surface | 4.21:1 | AA |
| state-error dark on chrome-surface-dark | 5.61:1 | AA |

### What NOT to Build

- No actual game components (tiles, rack, etc.) — those are stories 5A.2+
- No font preloading or optimization — keep simple for now
- No Motion for Vue integration beyond the CSS custom properties — animation wiring comes per-component
- No lint rule enforcement for raw hex values — add as enhancement later if needed
- Do NOT delete or modify `TestHarness.vue` — it's a working dev tool from Epic 1

### Previous Story Context

This is the first story in Epic 5A. No previous UI story exists. The client package has:
- Vue 3 + Vite + UnoCSS + Pinia + Vue Router all configured and working
- A `TestHarness.vue` dev component with basic game state integration
- Routes: `/` (home) and `/dev/harness` (dev-only)
- `uno.config.ts` with presetWind4 but NO custom theme tokens yet
- No `styles/` directory — needs to be created

### Project Structure Notes

- New files go in `packages/client/src/styles/` (theme.css, base.css)
- Theme showcase component goes in `packages/client/src/components/dev/` (alongside TestHarness)
- All configuration stays in `packages/client/uno.config.ts`
- Import order in main.ts: `import 'virtual:uno.css'` should come AFTER theme.css and base.css imports

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5A, Story 5A.1]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR1 through UX-DR9]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Frontend stack, CSS approach, UnoCSS config]
- [Source: packages/client/uno.config.ts — existing UnoCSS configuration to extend]
- [Source: packages/client/src/main.ts — entry point for style imports]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- UnoCSS `?raw` CSS import not supported in vite-plus test environment; used `node:fs` readFileSync instead
- `@unocss/core` createGenerator not resolvable from within `src/` test files; tested token definitions directly
- Design tokens extracted to `src/styles/design-tokens.ts` to allow both `uno.config.ts` and tests to import

### Completion Notes List
- All 6 tasks completed with 30 new tests (20 token definition tests + 10 CSS custom property tests)
- Full regression suite passes: 591 shared + 51 client + 167 server = 809 tests, 0 failures
- Build verified successful (88KB JS + 6.4KB CSS gzipped)
- Lint passes for new files (pre-existing lint warnings in other packages remain unchanged)

### Change Log
- 2026-03-29: Implemented design system foundation — all color tokens, typography shortcuts, animation/mood/dark mode CSS custom properties, base styles, theme showcase page, and comprehensive tests
- 2026-03-29: Code review fixes — chrome-layer tokens now use CSS custom properties for dark mode remapping (AC8), dark mode toggle made functional via .theme-dark class, removed invalid min-font-size CSS, fixed classList mutation in ThemeShowcase, fixed sub-14px text sizes

### File List
- `packages/client/uno.config.ts` — MODIFIED: imports design tokens from src/styles/design-tokens.ts
- `packages/client/src/styles/design-tokens.ts` — NEW: exported color tokens, spacing, radius, shadows, shortcuts
- `packages/client/src/styles/theme.css` — NEW: animation timing, easing, focus ring, mood switching, dark mode CSS custom properties
- `packages/client/src/styles/base.css` — NEW: global typography defaults, Inter font stack, 14px minimum
- `packages/client/src/main.ts` — MODIFIED: imports theme.css and base.css before virtual:uno.css
- `packages/client/src/components/dev/ThemeShowcase.vue` — NEW: visual verification page for all design tokens
- `packages/client/src/router/index.ts` — MODIFIED: added /dev/theme route (dev-only)
- `packages/client/src/uno-config.test.ts` ��� NEW: 20 tests for color tokens, spacing, radius, shadows, shortcuts
- `packages/client/src/styles/theme.test.ts` — NEW: 10 tests for CSS custom properties (timing, motion, focus, mood, dark mode)
