# Story 7.1: Felt Texture & Three Moods Transitions

Status: done

## Story

As a **player**,
I want **a rich felt table texture and gentle visual mood transitions between Arriving (warm lobby), Playing (focused table), and Lingering (relaxed scoreboard)**,
So that **the game feels like a real table and the visual atmosphere matches the emotional arc of game night (UX-DR8, UX-DR9, UX-DR49)**.

## Acceptance Criteria

1. **Felt texture during Playing mood** — Deep teal felt (`felt-teal`) with CSS grain/noise overlay for material authenticity dominates the view during gameplay. The surface reads as a physical material, not a flat color.

2. **Arriving mood (lobby)** — Warmer, lighter tones dominate: soft cream and warm gold, no felt visible, player presence (video/avatars) is the visual focus. Gold accent shifts to warmer/amber (`--mood-gold-temp` → `#d4a843`).

3. **Playing mood (active game)** — Deep teal felt commands the space, UI chrome recedes to edges, tiles and interactions take center stage. Gold accent shifts to cooler/brass (`--mood-gold-temp` → `#b89b52`).

4. **Lingering mood (scoreboard)** — Felt recedes, softer warm tones return but deeper than lobby, generous spacing, unhurried layout. Gold accent shifts to softer/muted (`--mood-gold-temp` → `#b8976e`).

5. **Mood transitions as crossfades** — Transitions between moods are gentle crossfades (1–2 seconds using `timing-expressive`) orchestrated via Motion for Vue — not hard cuts.

6. **Existing mood foundation preserved** — The existing `mood-arriving`/`mood-playing`/`mood-lingering` CSS classes and `--mood-surface`/`--mood-emphasis`/`--mood-gold-temp` tokens already work (Story 5A.1). This story adds the felt texture, grain overlay, mood-specific visual weight shifts, and crossfade transitions on top of that foundation.

7. **Reduced motion** — When `prefers-reduced-motion` is active, crossfades collapse to instant switches — no motion, same visual states.

## Tasks / Subtasks

- [x] Task 1: Felt Grain/Noise Overlay (AC: 1)
  - [x] 1.1 Create CSS grain/noise overlay that sits on top of `felt-teal` background — use a CSS-only technique (SVG filter `<feTurbulence>` or repeating tiny noise pattern via `background-image`). No external image assets.
  - [x] 1.2 Apply the grain overlay to the game table surface in GameTable.vue when in Playing mood
  - [x] 1.3 Ensure grain does not interfere with tile readability, text contrast, or interactive element hit targets
  - [x] 1.4 Grain should be `aria-hidden="true"` (decorative)
  - [x] 1.5 Write test: grain overlay element is present during playing phase

- [x] Task 2: Mood Class Application (AC: 2, 3, 4, 6)
  - [x] 2.1 Apply `mood-arriving` class on the root game container during lobby phase (RoomView.vue lobby state)
  - [x] 2.2 Apply `mood-playing` class during active game phases (dealing, charleston, gameplay)
  - [x] 2.3 Apply `mood-lingering` class during scoreboard and rematch phases (already partially done in GameTable.vue)
  - [x] 2.4 Ensure mood class is applied at a level where both RoomView lobby and GameTable gameplay can be styled
  - [x] 2.5 Write tests: correct mood class applied for each game phase

- [x] Task 3: Mood-Specific Visual Weight (AC: 2, 3, 4)
  - [x] 3.1 Arriving: hide felt surface, show chrome-surface background, gold accent uses warm amber variant
  - [x] 3.2 Playing: felt-teal dominates, grain overlay active, chrome recedes to panel edges only
  - [x] 3.3 Lingering: soften felt (reduce opacity or blend with warm tones), warmer background returns, generous spacing applied
  - [x] 3.4 Use existing `--mood-surface`, `--mood-emphasis`, `--mood-gold-temp` tokens — no new custom properties needed

- [x] Task 4: Crossfade Transitions via Motion for Vue (AC: 5, 7)
  - [x] 4.1 Implement mood transitions using Motion for Vue's animation API — animate opacity and CSS custom property shifts over 1–2s with `timing-expressive` easing
  - [x] 4.2 Architecture decision: use Motion for Vue `<motion />` component wrapping the mood container, NOT raw CSS transitions — per AR21 (all animations in one system)
  - [x] 4.3 Handle `prefers-reduced-motion`: Motion for Vue handles this natively (animations collapse to instant), verify it works for mood crossfades
  - [x] 4.4 Write test: mood transition uses Motion for Vue (not setTimeout chains)
  - [x] 4.5 Write test: reduced-motion preference results in instant mood switch (no animation duration)

- [x] Task 5: Integration & Visual Verification (AC: 1–7)
  - [x] 5.1 Verify all three moods render correctly in ThemeShowcase dev route (`/dev/theme`)
  - [x] 5.2 Verify WCAG AA contrast maintained across all mood states (text-on-felt, focus rings, gold accents)
  - [x] 5.3 Verify dark mode works correctly with all three moods (chrome inverts, felt stays constant)
  - [x] 5.4 Run backpressure gate: `pnpm test && pnpm run typecheck && vp lint`

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Extract `feltGrainBgImage` SVG constant to a shared style constant so ThemeShowcase.vue and GameTable.vue don't drift when grain parameters change [ThemeShowcase.vue:5, GameTable.vue:580]
- [ ] [AI-Review][LOW] Replace hardcoded `#3d2e26` in GameTable scoreboard gradient with a design token — pre-existing anti-pattern [GameTable.vue:956]

## Dev Notes

### Existing Foundation (DO NOT recreate)

The mood system foundation was built in Story 5A.1. These already exist and work:

- **`packages/client/src/styles/theme.css`** — Defines `--mood-surface`, `--mood-emphasis`, `--mood-gold-temp` CSS custom properties. Contains `.mood-arriving`, `.mood-playing`, `.mood-lingering` class selectors that remap these tokens. Dark mode overrides exist for all three moods. Reduced-motion override zeros all `--timing-*` tokens.
- **`packages/client/src/styles/design-tokens.ts`** — Exports `themeColors` (includes `felt.teal`, `chrome.*`, `gold.*`, `focus.*`), `themeShortcuts`, etc. Consumed by `uno.config.ts`.
- **`packages/client/uno.config.ts`** — Registers all theme colors, spacing, radius, shadows, and shortcuts. Wind4 auto-generates CSS variables.
- **`packages/client/src/components/dev/ThemeShowcase.vue`** — Has mood switcher UI with `currentMood` ref. Toggles mood classes on `document.documentElement`. Use this for visual verification.
- **`packages/client/src/components/game/GameTable.vue:953`** — Already applies `mood-lingering` during scoreboard/rematch phases with a gradient overlay.

### What This Story Adds

1. **Felt grain/noise overlay** — CSS-only technique on the game table surface. The current implementation is flat `bg-felt-teal`. This story adds material texture.
2. **Mood class application at the right DOM level** — Currently `mood-lingering` is applied only inside GameTable. The lobby needs `mood-arriving`, and the transition from lobby→game needs the class to change at a parent level (likely `RoomView.vue`'s root `<div>`).
3. **Visual weight shifts per mood** — Arriving hides the felt and shows chrome; Playing shows felt prominently; Lingering softens felt. This is CSS-level work using existing tokens.
4. **Crossfade transitions** — Motion for Vue animate the mood switch (opacity, color property shifts) over 1–2s. NOT raw CSS `transition` — the architecture mandates Motion for Vue for all animations.

### Architecture Compliance

- **Animation system:** Motion for Vue (`motion-v` v2.0, already installed) — per architecture AR21, ALL animations use this library. Do NOT use raw CSS transitions or setTimeout chains for mood crossfades.
- **Import:** `import { Motion } from 'motion-v'` (or `<motion />` component in templates)
- **Reduced motion:** Motion for Vue respects `prefers-reduced-motion` natively. theme.css also zeros `--timing-*` tokens. Both systems cooperate — no manual `matchMedia` checks needed.
- **Dark mode:** Chrome-layer tokens remap in dark mode (cream → charcoal). Felt and gold stay constant. Mood classes have dark mode overrides in theme.css. New work must not break this.
- **UnoCSS utility classes** for layout/styling — never hardcoded color values. Reference tokens via `bg-felt-teal`, `text-text-on-felt`, etc.

### File Structure

Files to **modify**:
- `packages/client/src/views/RoomView.vue` — Apply mood class on root container based on game phase (lobby → arriving, game → playing/lingering)
- `packages/client/src/components/game/GameTable.vue` — Add felt grain overlay, ensure mood-playing is applied during gameplay, coordinate with RoomView mood class
- `packages/client/src/styles/theme.css` — May need additional mood-specific CSS custom properties for felt opacity/visibility if needed for mood weight shifts
- `packages/client/src/styles/design-tokens.ts` — Only if new token entries are needed (likely not)
- `packages/client/src/components/dev/ThemeShowcase.vue` — Update to demonstrate grain overlay and mood transitions

Files to **create**:
- None expected. Grain overlay should be inline CSS/SVG in GameTable, not a separate component.

### Testing Standards

- Co-located test files (`*.test.ts` next to source)
- Use `happy-dom` environment (not jsdom)
- `setActivePinia(createPinia())` in `beforeEach` for any store tests
- Blackbox component testing — test behavior (rendered output, class presence), not internals
- Import test utilities from `vite-plus/test` (not `vitest`)
- Use `@vue/test-utils` for component mounting
- `prefers-reduced-motion` testing: mock `window.matchMedia` or check that Motion for Vue skips animation

### Anti-Patterns to Avoid

- **DO NOT** create a new composable just for mood state — the mood class is derived from game phase, which is already available in RoomView via `lobbyState`/`playerGameView`
- **DO NOT** use raw CSS `transition` property for mood crossfades — use Motion for Vue per architecture
- **DO NOT** use an external image file for grain/noise texture — CSS-only technique (SVG filter or generated pattern)
- **DO NOT** add new Pinia store for mood — mood is derived from game phase, not independent client state
- **DO NOT** hardcode any color values in components — always use UnoCSS tokens or CSS custom properties from theme.css
- **DO NOT** duplicate mood class logic in both RoomView and GameTable — decide on one authoritative level for the mood class

### Cross-Session Intelligence

- Epic 6B (just completed) established patterns for Motion for Vue usage in `PlayerPresence.vue` (fade transitions for video/avatar switching) and `DealingAnimation.vue` — follow the same import and usage patterns
- GameTable.vue is a large component (~960 lines). The mood-lingering class is applied via a computed class at line 953. Extend this pattern rather than introducing a new approach
- The ThemeShowcase dev route already has a mood switcher — this is the primary visual verification tool during development

### Project Structure Notes

- Alignment: All token references go through UnoCSS theme config → design-tokens.ts. No variance needed.
- The mood class should ideally be set at the RoomView level (or `document.documentElement`) so it affects both lobby UI and GameTable. ThemeShowcase already sets it on `documentElement` — consider the same approach for production.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 7, Story 7.1] — Acceptance criteria and user story
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` §Color Tokens, §Mood Emphasis] — Mood switching mechanism, token definitions
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` lines 238–245] — Motion for Vue as unified animation system, Three Moods use Motion layout animations
- [Source: `packages/client/src/styles/theme.css`] — Existing mood CSS classes and custom properties
- [Source: `packages/client/src/styles/design-tokens.ts`] — Token values consumed by UnoCSS
- [Source: `packages/client/src/components/game/GameTable.vue:953`] — Existing mood-lingering application
- [Source: `packages/client/src/components/dev/ThemeShowcase.vue`] — Dev mood switcher tool

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: CSS-only SVG `<feTurbulence>` grain overlay added to GameTable.vue as first child of `#gameplay-region`. Uses `feltGrainBgImage` script constant for the data URI, UnoCSS classes for opacity-50/mix-blend-overlay/bg-[length:200px_200px]. Conditionally rendered `v-if="!isScoreboardPhase && gamePhase !== 'rematch'"` — includes charleston per Task 2.2 (charleston is part of Playing mood). 5 tests added.
- Task 2: `moodClass` computed added to RoomView.vue root div (single authoritative source). Lobby → mood-arriving, active phases → mood-playing, scoreboard/rematch → mood-lingering. Removed duplicate mood-lingering from GameTable.vue `:class` binding. 4 tests in RoomView.test.ts + 2 updated GameTable tests. 1,663 total tests pass.
- Task 3: CSS-only visual weight shifts in theme.css. Arriving: `[data-testid="room-view-root"].mood-arriving` overrides `bg-felt-teal` with `var(--mood-surface)` warm cream + `color: var(--text-primary)`. Playing: no additional CSS needed — GameTable `bg-felt-teal` already fills viewport. Lingering: `::before` pseudo-element on game-table uses `color-mix(in srgb, var(--mood-surface) 15%, transparent)` gradient overlay. All token-based, no new custom properties.
- Task 4: Imperative `animate()` from `motion-v` (justified over `<Motion>` component — class-swap crossfade requires imperative orchestration). Pattern: fade-out (0.4s) → `displayedMoodClass` update → nextTick → fade-in (1.0s). `TIMING_EXPRESSIVE_EASE = [0.16, 1, 0.3, 1]`. Race condition guard via `currentCrossfadeAnimation`. Manual `prefersReducedMotion()` check (standalone `animate()` does NOT auto-respect media query — only `<Motion>` component does). `isMounted` guard + `onUnmounted` cleanup. 2 tests: `animate()` called on mood change; `animate()` NOT called with reduced-motion active.
- Task 5: ThemeShowcase.vue updated with "Felt Grain Overlay (AC 1)" section (felt-teal demo with identical grain overlay). WCAG AA verified — all mood state contrast ratios pass (existing pairs unchanged; arriving mode #2c2420 on #faf5ec is ~16:1). Dark mode overrides for all 3 moods confirmed in theme.css. Backpressure gate: 611 tests pass, typecheck clean, lint 0 errors.

### File List

- packages/client/src/components/game/GameTable.vue
- packages/client/src/components/game/GameTable.test.ts
- packages/client/src/views/RoomView.vue
- packages/client/src/views/RoomView.test.ts
- packages/client/src/styles/theme.css
- packages/client/src/components/dev/ThemeShowcase.vue
