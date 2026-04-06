# Story 5B.3: Wall Counter States & Tension Styling

Status: review

## Story

As a **player**,
I want **the wall counter to visually shift from neutral to warning to critical as tiles run out**,
So that **I feel the natural tension of the shrinking wall without an artificial timer (FR100, UX-DR24)**.

## Acceptance Criteria

1. **AC1 — Normal state:** Given tiles remaining > 20, the counter displays in `wall-normal` neutral styling (current behavior — verify preserved).

2. **AC2 — Warning transition:** Given tiles remaining drop to ≤ 20, the counter transitions to `wall-warning` amber styling with a subtle animation using `timing-expressive` (400ms, `ease-expressive` curve).

3. **AC3 — Critical transition:** Given tiles remaining drop to ≤ 10, the counter transitions to `wall-critical` stronger urgency styling with the same `timing-expressive` animation.

4. **AC4 — Accessibility:** Given each state transition, `aria-live="polite"` announces the state change for screen readers (already implemented — verify preserved and extend if styling changes affect announcements).

5. **AC5 — Configurable thresholds:** Given the warning/critical thresholds, they are configurable constants (not hardcoded in the component) for gameplay tuning.

## Tasks / Subtasks

- [x] Task 1: Extract threshold constants (AC: #5)
  - [x] 1.1 Create `wallCounterThresholds` constants in `packages/shared/src/constants/` (or co-locate in an appropriate shared constants file) — `WARNING_THRESHOLD = 20`, `CRITICAL_THRESHOLD = 10`
  - [x] 1.2 Import and use these constants in `WallCounter.vue` replacing the hardcoded `20` and `10`
  - [x] 1.3 Update existing tests to import from shared constants

- [x] Task 2: Add animated state transitions (AC: #2, #3)
  - [x] 2.1 Add CSS transition on the `BaseBadge` wall-counter variant for `border-color`, `color`, and `background-color` properties using design system animation tokens (`--timing-expressive: 400ms`, `--ease-expressive`)
  - [x] 2.2 Consider adding a subtle scale pulse or glow on threshold crossing (optional — keep it organic, not gamified)
  - [x] 2.3 Ensure `prefers-reduced-motion` disables all transition animations (tokens auto-collapse to 0ms under media query — verify this works for CSS transitions added here)

- [x] Task 3: Enhance visual differentiation between states (AC: #1, #2, #3)
  - [x] 3.1 Evaluate if the current `BaseBadge` wall-counter tone classes are visually distinct enough with the new transitions — the existing tokens (`wall-normal: #4A9B6E`, `wall-warning: #D4A843`, `wall-critical: #B8553A`) should be preserved
  - [x] 3.2 Consider adding a subtle background tint shift per state (e.g., slight amber bg wash for warning, slight coral bg wash for critical) while keeping `bg-chrome-surface-dark/85` as the base
  - [x] 3.3 Ensure broadcast readability — the counter must be legible from across the room on a propped-up iPad (UX principle)

- [x] Task 4: Preserve and verify accessibility (AC: #4)
  - [x] 4.1 Verify `aria-live="polite"` announcements still fire correctly with the new transition approach
  - [x] 4.2 Ensure color is not the only indicator — text content "Wall: NN" and screen reader announcements must convey state independently of color

- [x] Task 5: Update tests (AC: all)
  - [x] 5.1 Add tests for animated transitions (verify correct CSS transition properties are applied)
  - [x] 5.2 Add tests for threshold constants being imported from shared (not hardcoded)
  - [x] 5.3 Verify existing tests still pass (state boundaries, aria-live announcements)
  - [x] 5.4 Add `prefers-reduced-motion` test if feasible in happy-dom environment

## Dev Notes

### Current Implementation (Shipped for 5B.3)

**`packages/client/src/components/game/WallCounter.vue`**:
- Single prop: `wallRemaining: number`
- `computed` derives tone: `normal | warning | critical` using `WALL_WARNING_THRESHOLD` / `WALL_CRITICAL_THRESHOLD` from `@mahjong-game/shared`
- `watch` on `[tone, wallRemaining]` updates `liveMessage` shallowRef for `aria-live` region
- Renders `BaseBadge` with `variant="wall-counter"` and `:tone="tone"`
- `aria-live="polite"` hidden div for threshold announcements; visible label remains `Wall: NN`

**`packages/client/src/components/ui/BaseBadge.vue`** (`wall-counter` variant):
- Utility classes: `inline-flex items-center rounded-full border bg-chrome-surface-dark/85`, plus `wall-counter-tone-transition` and per-tone `wall-counter-wash-{normal|warning|critical}`
- Scoped CSS: transitions use `var(--timing-expressive)` / `var(--ease-expressive)`; panel shadow DRY’d via `--wall-counter-panel-shadow`; inset washes for warning/critical; `@media (prefers-reduced-motion: reduce)` sets `transition-duration: 0ms` on the transition class (belt-and-suspenders with `theme.css` token collapse)
- Tone border/text classes unchanged:
  - `normal` → `border-wall-normal text-text-on-felt`
  - `warning` → `border-wall-warning text-wall-warning`
  - `critical` → `border-wall-critical text-wall-critical`

**`packages/client/src/styles/design-tokens.ts`**:
- `wall.normal: "#4A9B6E"` (green), `wall.warning: "#D4A843"` (gold), `wall.critical: "#B8553A"` (rust)

**`packages/client/src/components/game/GameTable.vue`**:
- WallCounter rendered at line ~1021 in the table center area
- Receives `wallRemaining` prop (default: 70)
- Hidden during scoreboard phase

### What This Story Adds

This story is an **enhancement**, not a rewrite. The core three-state system already works. The additions are:

1. **Animated transitions** between states (the current implementation snaps instantly between styles)
2. **Configurable thresholds** extracted to shared constants
3. **Visual polish** to make state transitions feel organic and tension-building

### Architecture & Pattern Compliance

- **Animation approach:** Use CSS `transition` properties referencing the design system's animation custom properties (`--timing-expressive`, `--ease-expressive`). Per architecture doc: "No raw CSS transition properties with hardcoded durations. Use Motion for Vue for all animated elements, or reference the animation custom properties if CSS transitions are unavoidable." Since this is a color/border transition (not a layout animation), CSS transitions with custom properties are the correct approach — Motion for Vue `<motion />` is overkill for simple property transitions.
- **Reduced motion:** The animation token custom properties collapse to `0ms` under `prefers-reduced-motion` media query. Verify that CSS transitions referencing these tokens also collapse. If not, add an explicit media query rule.
- **Shared constants:** Place thresholds in `packages/shared/` so both server (future wall-end logic) and client can reference them. Appropriate location: `packages/shared/src/constants/` or add to an existing constants file if one exists for game tuning values.
- **No new Pinia stores** needed — this is purely a UI enhancement driven by the existing `wallRemaining` prop.
- **No new WebSocket messages** — the server already sends `wallRemaining` in `PlayerGameView`.

### Files to Modify

| File | Change |
|------|--------|
| `packages/shared/src/constants/` (new or existing) | Add `WALL_WARNING_THRESHOLD`, `WALL_CRITICAL_THRESHOLD` |
| `packages/shared/src/index.ts` | Export new constants |
| `packages/client/src/components/game/WallCounter.vue` | Import thresholds from shared; add CSS transition classes |
| `packages/client/src/components/ui/BaseBadge.vue` | Add `transition` CSS properties to wall-counter variant |
| `packages/client/src/components/game/WallCounter.test.ts` | Update tests for constants import, add transition tests |

### Anti-Patterns to Avoid

- **Do NOT** wrap the counter in a `<motion />` component for simple color transitions — CSS transitions with design tokens are the correct tool here
- **Do NOT** add new design tokens for animation — use the existing `--timing-expressive` and `--ease-expressive` custom properties
- **Do NOT** change the existing wall color tokens — they were chosen for broadcast readability and contrast
- **Do NOT** add a separate animation library or system — the project's animation architecture is Motion for Vue + CSS custom properties
- **Do NOT** add game state tracking for "previous wall count" in Pinia — the component already tracks tone transitions via its `watch`

### Testing Standards

- Import from `vite-plus/test` (not `vitest`)
- Client tests use `happy-dom` (not jsdom)
- Co-locate test files: `WallCounter.test.ts` next to `WallCounter.vue`
- Existing test file has 5 tests covering all state boundaries and aria-live — extend, don't replace

### Previous Story Intelligence (5B.2)

From Story 5B.2 (Hand Guidance Engine):
- **Props not inject** pattern confirmed for passing data down through component tree
- **No hard CI timing assertions** — any animation timing tests should be structural (checking classes exist), not timing-based
- **Test pattern:** `mount(Component, { props })` with `await wrapper.setProps()` for state transitions
- **UnoCSS shortcuts** are defined in `design-tokens.ts` `themeShortcuts` — add new shortcuts there if needed

### Cross-Session Intelligence

From injected context:
- Story 5B.1 and 5B.2 both completed successfully with clean GDS code reviews
- Toast pattern was consolidated during 4B retrospective follow-through (obs 956-957) — if any toast is needed for wall state, use the established pattern in `resolvedActionToastCopy.ts` (though this story likely needs no toasts)
- The codebase is in a clean state on `main` branch

### Git Intelligence

Recent commits show the project follows:
- Conventional Commits: `feat(client):`, `feat:`, `chore:` prefixes
- Feature-scoped commits grouping related changes
- TypeScript strict mode throughout

### Project Structure Notes

- Alignment: This story follows the established pattern of shared constants consumed by client components
- No path alias issues — use `@mahjong-game/shared` for cross-package imports
- UnoCSS config at root `uno.config.ts` imports from `src/styles/design-tokens.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5B, Story 5B.3]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Animation Tokens, Design System Foundation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Wall Counter, Tension Design]
- [Source: _bmad-output/implementation-artifacts/5a-8-turn-indicator-wall-counter-game-scoreboard.md — Original wall counter story]
- [Source: _bmad-output/implementation-artifacts/5b-2-hand-guidance-engine-card-highlighting.md — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

None

### Completion Notes List

- Added `WALL_WARNING_THRESHOLD` / `WALL_CRITICAL_THRESHOLD` to `packages/shared/src/constants.ts` and wired `WallCounter.vue` + tests to `@mahjong-game/shared`.
- `BaseBadge` wall-counter variant: scoped CSS transitions use `var(--timing-expressive)` and `var(--ease-expressive)`; `transition-property` includes `box-shadow` for inset wash + panel shadow. Replaced `shadow-panel` utility with scoped `wall-counter-wash-*` classes so inset amber/coral washes animate without fighting utilities.
- Optional scale pulse (task 2.2) omitted to avoid over-gamification; inset wash provides organic tension.
- `prefers-reduced-motion`: transitions use the same CSS variables as `theme.css` (already `0ms` under `prefers-reduced-motion`); covered by existing `packages/client/src/styles/theme.test.ts` rather than happy-dom media-query simulation (task 5.4).
- Second pass (dev-story): DRY panel shadow in scoped CSS via `--wall-counter-panel-shadow`; explicit `prefers-reduced-motion` rule on `.wall-counter-tone-transition`; BaseBadge tests for all three wall-counter tones; WallCounter test for wash class change warning→critical; `GameTable.test` uses `WALL_WARNING_THRESHOLD`; Dev Notes “Current Implementation” updated to match shipped code.

### Change Log

- 2026-04-06: Implemented Story 5B.3 — shared thresholds, wall-counter tone transitions + inset washes, tests updated; status → review.
- 2026-04-06: Second pass — CSS DRY + reduced-motion fallback, broader tests, Dev Notes sync, GameTable test alignment with shared thresholds.

### File List

- `packages/shared/src/constants.ts`
- `packages/shared/src/index.ts`
- `packages/client/src/components/game/WallCounter.vue`
- `packages/client/src/components/game/WallCounter.test.ts`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/ui/BaseBadge.vue`
- `packages/client/src/components/ui/BaseBadge.test.ts`
