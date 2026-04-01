# Story 5A.10: Shared Primitive Extraction & Tile Readability Validation

Status: done

## Story

As a **developer**,
I want **to extract shared UI primitives from the components built in this epic and validate tile readability at minimum size with the target demographic**,
So that **the component library is DRY and tiles are proven readable before dependent epics build on them (UX-DR39, UX-DR40, UX-DR45)**.

## Acceptance Criteria

1. **AC1 - Shared primitives extracted:** Extract the following reusable primitives from the existing Epic 5A implementation: `BaseButton` (44px minimum target, press states, focus ring, tier styling), `BasePanel` (consistent background/border/shadow/radius treatment), `BaseBadge` (turn indicator, wall counter, status dot / pill treatment), and `BaseToast` (enter/exit animation, optional auto-dismiss, positioning contract). These must be real consumer-driven primitives derived from existing components, not speculative abstractions.
2. **AC2 - Existing epic components refactored:** Refactor the existing Epic 5A components to consume the shared primitives so duplicate button, panel, and badge implementations are removed from current UI code. Preserve current behavior, accessibility semantics, and visual hierarchy while consolidating repeated styling.
3. **AC3 - Tile readability validated at minimum width:** Validate tile readability using a full 152-tile rendering surface at the current `tile-min-width` of `30px`. Suit symbols, Arabic corner numerals, and tile identity must be clearly distinguishable, validated by at least one person from the target demographic (40-70+) or by the developer's honest arm's-length iPad assessment.
4. **AC4 - Minimum width adjusted if readability fails:** If readability is not acceptable at `30px`, raise the single source of truth for `tile-min-width` to `32px` or `34px` and update all current consumers and validation surfaces so future Epic 5+ work inherits the corrected size automatically.
5. **AC5 - Deferred primitives stay deferred:** Do **not** extract `BaseOverlay`, `BaseInput`, `BaseToggle`, `BaseSelect`, `BaseNumberStepper`, or `MobileBottomBar` as primitives in this story. This story is limited to the primitives already justified by Epic 5A consumers.

## Tasks / Subtasks

- [x] Task 1: Extract the shared primitive layer in `packages/client/src/components/ui/` from existing Epic 5A consumers (AC: #1, #2)
  - [x] 1.1 Create `BaseButton.vue` as a thin native-button wrapper for the tiers already present in the codebase: primary Mahjong/discard, urgent call-window, secondary chrome, and subtle-danger/cancel styling only if needed by an existing consumer.
  - [x] 1.2 Create `BasePanel.vue` for the repeated dark/chrome surface treatments currently duplicated across scoreboard, status shells, and mobile control surfaces.
  - [x] 1.3 Create `BaseBadge.vue` for pill-style status UI and status-dot treatment used by turn indicators, wall state, active-seat labels, and connection presence.
  - [x] 1.4 Create `BaseToast.vue` from the existing inline notification pattern so it supports the current invalid-Mahjong feedback use case plus optional timed dismissal for future consumers.
- [x] Task 2: Refactor existing Epic 5A components to consume the new primitives without changing their behavior contracts (AC: #2, #5)
  - [x] 2.1 Refactor `MahjongButton.vue`, `DiscardConfirm.vue`, and `CallButtons.vue` to use `BaseButton` while preserving current `aria-label`s, action-zone focus behavior, and variant hierarchy.
  - [x] 2.2 Refactor `InvalidMahjongNotification.vue` to consume `BaseToast` and `BaseButton` while keeping inline placement and the current private-warning behavior.
  - [x] 2.3 Refactor `TurnIndicator.vue`, `WallCounter.vue`, the local-player status shell in `GameTable.vue`, and any clearly duplicated seat-status pills in `OpponentArea.vue` to use `BaseBadge` and/or `BasePanel` where appropriate.
  - [x] 2.4 Refactor `Scoreboard.vue`, `SessionScores.vue`, and any other obvious shared-surface containers to use `BasePanel` styling rather than repeated panel class strings.
  - [x] 2.5 Audit `MobileBottomBar.vue` as a consumer only. It may consume `BaseButton` and/or `BasePanel` if that reduces duplication, but the `MobileBottomBar` component itself must **not** be extracted as a new primitive.
- [x] Task 3: Centralize tile minimum-size configuration and perform readability validation (AC: #3, #4)
  - [x] 3.1 Replace duplicated hardcoded small-tile width values in `Tile.vue`, `TileBack.vue`, `TileRackItem.vue`, and any related validation surfaces with a single source of truth for `tile-min-width`.
  - [x] 3.2 Extend the current tile validation surface so it can render the full 152-tile set at `tile-min-width`, not just the unique face catalog.
  - [x] 3.3 Record the validation outcome in the story completion notes or implementation notes: device/context used, whether 30px passed, and the final chosen minimum width.
  - [x] 3.4 If 30px fails, bump the shared minimum-width source to 32px or 34px and update all current consumers and tests that depend on the small-tile size.
- [x] Task 4: Preserve quality through focused tests and showcase coverage (AC: #1-#5)
  - [x] 4.1 Add focused tests for each new primitive component covering variant rendering, forwarded attributes, accessible semantics, and any timing/dismissal behavior.
  - [x] 4.2 Update affected consumer tests so they continue to assert behavior rather than implementation details after the primitive refactor.
  - [x] 4.3 Extend the existing dev showcase surface(s) to verify primitive variants and the tile-readability validation workflow without creating throwaway verification code.

### Review Follow-ups (AI)

- [x] [AI-Review][Medium] Ensure the new primitive and shared tile-sizing tests are tracked with the story's final change set so the documented coverage ships with the refactor (`packages/client/src/components/ui/BaseButton.test.ts`, `packages/client/src/components/ui/BaseBadge.test.ts`, `packages/client/src/components/ui/BasePanel.test.ts`, `packages/client/src/components/ui/BaseToast.test.ts`, `packages/client/src/components/tiles/tile-sizing.test.ts`).

## Dev Notes

### Current Implementation State

- The design-token foundation already exists in `packages/client/uno.config.ts` and `packages/client/src/styles/design-tokens.ts`, including `min-tap`, `shadow-tile`, `shadow-panel`, and the three context-specific focus-ring shortcuts. The problem is **consumer duplication**, not missing tokens.
- Repeated button styling already exists across `MahjongButton.vue`, `DiscardConfirm.vue`, `CallButtons.vue`, and the cancel action inside `InvalidMahjongNotification.vue`. These currently differ mostly by visual tier, not by structure.
- Repeated panel / badge styling already exists across `TurnIndicator.vue`, `WallCounter.vue`, `Scoreboard.vue`, `SessionScores.vue`, the local-player status shell inside `GameTable.vue`, and pieces of `OpponentArea.vue`.
- `InvalidMahjongNotification.vue` already contains the clearest toast-like enter/exit animation contract in the repo and is the right starting point for `BaseToast`.
- Small-tile sizing is currently duplicated: `Tile.vue` uses `30px` for `size="small"`, `TileBack.vue` mirrors that size, and `TileRackItem.vue` also hardcodes a `30px` minimum width.
- The current `TileShowcase.vue` already includes a "30px Readability Validation" section, but it renders the unique face catalog rather than a full 152-tile validation surface.

### State Separation Guardrails

- This is a **client-only UI refactor and validation story**. Stay inside `packages/client/src/`.
- Do **not** move any game rules, scoring, or action validation into the client while extracting primitives.
- Do **not** introduce Pinia or a global UI store just to support primitives. Existing prop/event composition is sufficient.
- Do **not** import WebSocket code into primitive components. They must remain presentation-layer building blocks.
- Do **not** touch `packages/shared/` or `packages/server/` unless a read-only type import is already required by an existing client consumer.

### Existing Components To Reuse

- **Buttons / controls:** `MahjongButton.vue`, `DiscardConfirm.vue`, `CallButtons.vue`, and the cancel action in `InvalidMahjongNotification.vue` define the real button variants this story should support.
- **Panel surfaces:** `Scoreboard.vue`, `SessionScores.vue`, `MobileBottomBar.vue`, `TurnIndicator.vue`, `WallCounter.vue`, and the local-player status shell in `GameTable.vue` are the current panel-style consumers.
- **Badges / pills / dots:** `TurnIndicator.vue`, `WallCounter.vue`, the "Current turn" pills in `GameTable.vue` and `OpponentArea.vue`, and the connection status dot in `OpponentArea.vue` establish the badge vocabulary to consolidate.
- **Toast behavior:** `InvalidMahjongNotification.vue` already proves the needed animation and inline-notification pattern; extract from it rather than building a new unrelated toast system.
- **Tile validation:** `Tile.vue`, `TileBack.vue`, `TileRackItem.vue`, and `TileShowcase.vue` are the immediate tile-readability consumers.

### Primitive Extraction Guardrails

1. `BaseButton` should remain a **thin wrapper around a real `<button>`**. Preserve native keyboard activation and forwarded `aria-*`, `data-testid`, `tabindex`, and extra `class` attributes. Do **not** build a polymorphic `as` API or an oversized variant system.
2. `BasePanel` should standardize surface treatment, not absorb layout responsibilities. Consumers should still own their flex/grid structure, spacing, and content semantics.
3. `BaseBadge` should solve the repeated pill/status-dot patterns that already exist. It does **not** need to become a general typography framework.
4. `BaseToast` should support the current invalid-Mahjong warning pattern plus optional auto-dismiss for future reuse, but this story does **not** justify a global toast manager, portal system, or overlay stack.
5. `ActionZone.vue` already manages roving focus for its buttons. Any button primitive must remain compatible with that pattern and keep the underlying buttons focusable and discoverable via DOM queries.
6. `MobileBottomBar` is a **consumer**, not a primitive to extract in this story. Reuse shared button/panel building blocks inside it if helpful, but do not promote it into the shared primitive layer.

### Tile Readability Validation Guardrails

1. The validation surface must be based on the **full 152-tile wall**, not only the unique face set. Use existing shared tile/wall helpers if possible rather than hand-curating another demo dataset.
2. Establish a **single source of truth** for `tile-min-width` so the chosen value drives `Tile.vue`, `TileBack.vue`, `TileRackItem.vue`, and any showcase/test helpers together. Duplicated raw `30px` / `32px` / `34px` literals are not acceptable after this refactor.
3. If readability fails at 30px, update all **current** consumers immediately. If future consumers like exposed groups or celebration fan-out are not yet implemented, make sure the shared source of truth is what they will inherit later.
4. Keep the existing Arabic numeral corner indices and accessibility labels intact. Readability work is about validating and adjusting the visual minimum size, not redesigning tile semantics.

### Architecture Compliance

- The architecture requires **semantic HTML, ARIA labels, keyboard navigation, 44px tap targets, prefers-reduced-motion support, and WCAG intent from the start**.
- The current client stack is already sufficient: Vue 3, UnoCSS, VueUse, Motion for Vue, and the existing token system cover everything this story needs. No new dependency is justified.
- The project context requires components to stay under roughly **150 lines**. If primitive logic starts bloating any consumer, extract small helper composables instead of growing monolithic components.
- The project uses **UnoCSS shortcuts and design tokens** for shared visual language. Repeated class bundles belong in primitives or existing token shortcuts, not copied across more feature components.
- The UI must continue to honor `prefers-reduced-motion` via the existing timing-token approach. Do not introduce ad hoc animation timings inside primitives that bypass those tokens.

### Library / Framework Requirements

- Use the existing client stack and versions already present in the repo: `vue ^3.5.0`, `pinia ^3.0.0`, `@vueuse/core ^14.2.0`, `motion-v ^2.0.0`, `unocss ^66.0.0`, and `@vue-dnd-kit/core ^2.0.0`.
- Keep imports from `vite-plus/test` in tests, not `vitest`.
- Vue 3's current fallthrough-attribute guidance still supports forwarding `class`, `style`, and `aria-*` attributes to a single-root component. If a primitive needs tighter control over where attrs land, use Vue's explicit attr-forwarding pattern rather than dropping accessibility attributes on the floor.
- WCAG/W3C target-size guidance still treats **44x44 CSS pixels** as the correct minimum interactive target size. Reuse the existing `min-tap` / `min-h-11` approach instead of inventing a different sizing rule.
- WAI-ARIA toolbar guidance still expects roving-focus behavior inside multi-button toolbars. Do not break the action-zone keyboard model while wrapping buttons in a primitive.

### File Structure Notes

- Keep the new shared primitives in `packages/client/src/components/ui/`.
- Leave existing feature components in their current feature folders (`game/`, `scoreboard/`, `tiles/`, `dev/`). This story is not permission for a repo-wide folder reorganization.
- If tile-size logic needs a reusable helper, place it either next to the tile components or in an existing client styles/token module. Pick one source of truth and keep it obvious.
- Do not introduce import aliases. Use relative imports inside the client package.

### Testing Requirements

- Add focused primitive tests: `BaseButton.test.ts`, `BasePanel.test.ts`, `BaseBadge.test.ts`, and `BaseToast.test.ts`.
- Update consumer tests where behavior is exercised today: `CallButtons.test.ts`, `MahjongButton.test.ts`, `DiscardConfirm.test.ts`, `InvalidMahjongNotification.test.ts`, `TurnIndicator.test.ts`, `WallCounter.test.ts`, `Scoreboard.test.ts`, `MobileBottomBar.test.ts`, `GameTable.test.ts`, `Tile.test.ts`, and `TileBack.test.ts` as needed.
- Keep tests blackbox-focused. Assert rendered semantics, visible text, forwarded `aria-label`s / `data-testid`s, focusability, dismissal behavior, and emitted events. Do **not** assert internal implementation details like which primitive component name appears in the DOM.
- Add a validation-oriented test or helper assertion around the centralized `tile-min-width` source of truth so width changes are deliberate and visible in review.
- The dev showcase should make it easy to inspect button tiers, panel/badge reuse, and the final tile-readability surface manually.

### Suggested File Targets

- `packages/client/src/components/ui/BaseButton.vue`
- `packages/client/src/components/ui/BaseButton.test.ts`
- `packages/client/src/components/ui/BasePanel.vue`
- `packages/client/src/components/ui/BasePanel.test.ts`
- `packages/client/src/components/ui/BaseBadge.vue`
- `packages/client/src/components/ui/BaseBadge.test.ts`
- `packages/client/src/components/ui/BaseToast.vue`
- `packages/client/src/components/ui/BaseToast.test.ts`
- `packages/client/src/components/game/MahjongButton.vue`
- `packages/client/src/components/game/DiscardConfirm.vue`
- `packages/client/src/components/game/CallButtons.vue`
- `packages/client/src/components/game/InvalidMahjongNotification.vue`
- `packages/client/src/components/game/TurnIndicator.vue`
- `packages/client/src/components/game/WallCounter.vue`
- `packages/client/src/components/game/OpponentArea.vue`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/MobileBottomBar.vue`
- `packages/client/src/components/scoreboard/Scoreboard.vue`
- `packages/client/src/components/scoreboard/SessionScores.vue`
- `packages/client/src/components/tiles/Tile.vue`
- `packages/client/src/components/tiles/TileBack.vue`
- `packages/client/src/components/game/TileRackItem.vue`
- `packages/client/src/components/dev/TileShowcase.vue`
- `packages/client/src/components/dev/<shared-primitives-showcase>.vue` (only if extending existing showcases is clearly not enough)
- `packages/client/src/dev-showcase-routes.ts`

### Previous Story Intelligence (5A.9)

Key learnings from `5a-9-keyboard-navigation-accessibility-foundation.md` that apply directly here:

1. **Extend the existing integration surfaces instead of creating parallel ones.** Recent UI stories have succeeded by editing `GameTable.vue` and current feature components in place.
2. **Preserve the current accessibility baseline.** Recent stories established `aria-live` regions, native buttons, roving-focus patterns, and context-specific focus rings. Primitive extraction must not weaken any of that.
3. **Recent UI stories ship as a bundle.** The successful pattern is: focused component changes + targeted tests + a dev showcase route or showcase extension.
4. **Primitive extraction was intentionally deferred until now.** Earlier stories explicitly avoided broad refactors so that this story could extract from real usage. Now that the components exist, consolidate them rather than introducing speculative abstractions.
5. **Keep placeholders quiet and future work separate.** The keyboard story already created placeholder chat/controls surfaces; this story should reduce duplication without accidentally pulling Epic 6A / 6B scope forward.

### Git Intelligence

Recent commit patterns relevant to this story:

- `feat(KeyboardAccessibility): implement keyboard navigation and accessibility features`
- `feat(GameStatus): implement turn indicator, wall counter, and scoreboard UI`
- `feat(MahjongButton): implement persistent button with invalid declaration feedback`

Actionable takeaways:

- Recent Epic 5A work updates the story artifact, sprint status, feature components, tests, and dev showcase routes together.
- The current implementation style favors **targeted refactors inside existing files** over broad architectural churn.
- The last few UI stories introduced exactly the consumers this story needs to consolidate: action-zone buttons, status shells, badges, scoreboard surfaces, and inline notification treatment.
- Accessibility behavior is already embedded into these consumers, so the safest extraction path is to **wrap and preserve** current semantics rather than rewrite interaction models.

### Latest Technical Information

- Current WAI-ARIA toolbar guidance still recommends a **single tab stop plus arrow-key roving focus** for grouped action controls. `BaseButton` must remain compatible with `ActionZone.vue`'s existing roving-focus implementation.
- Current WCAG/W3C target-size guidance still uses **44 by 44 CSS pixels** as the touch-target benchmark. The repo's `min-tap` / `min-h-11` utilities are still the correct baseline for shared buttons.
- Current Vue 3 guidance for fallthrough attributes still supports forwarding accessibility and test attributes through single-root components. If a primitive needs manual attr placement, use Vue's explicit attr-forwarding pattern instead of dropping attrs accidentally.
- The installed client stack is already current enough for this story. This is a refactor-and-validation story, not a dependency-upgrade story.

### Scope Boundaries

- This story is about **shared UI primitives plus tile readability validation**, not a general design-system rewrite.
- This story does **not** add global overlay infrastructure, input primitives, toggle/select/stepper primitives, or a toast manager/store.
- This story does **not** change gameplay rules, WebSocket flows, or server validation.
- This story does **not** move the existing Epic 5A feature components into a new architecture. Create the minimum shared layer needed and refactor consumers onto it.
- This story does **not** treat the unique-face showcase as sufficient proof of the 152-tile readability acceptance criterion.

### Anti-Patterns To Avoid

- **NO** polymorphic mega-primitives with `as`, `href`, router-link support, or variants that have no current consumer.
- **NO** loss of native button semantics, forwarded `aria-*`, `data-testid`, or roving-focus compatibility in the action zone.
- **NO** broad theme or folder refactors beyond the minimum shared primitive layer.
- **NO** duplicated raw `30px` / `32px` / `34px` literals remaining after the tile-size refactor.
- **NO** silent "30px is fine" acceptance without an explicit validation surface and recorded outcome.
- **NO** extraction of `MobileBottomBar`, `BaseOverlay`, `BaseInput`, `BaseToggle`, `BaseSelect`, or `BaseNumberStepper` in this story.
- **NO** regressions to current `aria-live`, focus-ring, or 44px target-size behavior while consolidating styles.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 5A notes, Stories 5A.1-5A.10, UX-DR39, UX-DR40, UX-DR45]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` - core stack, UnoCSS/Vue/Motion guidance, semantic HTML and accessibility requirements, client-only architecture]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - 44px target-size expectation, same-place-every-time interaction model, protect-the-rhythm principle, primary iPad readability expectations]
- [Source: `_bmad-output/project-context.md` - component size guidance, testing rules, UnoCSS shortcut guidance, accessibility non-negotiables, package boundaries]
- [Source: `_bmad-output/implementation-artifacts/5a-9-keyboard-navigation-accessibility-foundation.md` - previous-story learnings, file-target patterns, accessibility guardrails]
- [Source: `packages/client/src/styles/design-tokens.ts` - existing token and shortcut inventory (`min-tap`, focus rings, panel/tile shadows)]
- [Source: `packages/client/uno.config.ts` - current UnoCSS theme/shortcut wiring]
- [Source: `packages/client/src/components/game/CallButtons.vue` - urgent and secondary button tier duplication]
- [Source: `packages/client/src/components/game/MahjongButton.vue` - primary button tier duplication]
- [Source: `packages/client/src/components/game/DiscardConfirm.vue` - primary button tier duplication]
- [Source: `packages/client/src/components/game/InvalidMahjongNotification.vue` - current toast-like animation and cancel action pattern]
- [Source: `packages/client/src/components/game/TurnIndicator.vue` - badge/pill surface duplication]
- [Source: `packages/client/src/components/game/WallCounter.vue` - badge/panel surface duplication with state tones]
- [Source: `packages/client/src/components/game/OpponentArea.vue` - current turn pill and connection-status dot patterns]
- [Source: `packages/client/src/components/game/GameTable.vue` - local-player status shell, action-zone composition, placeholder surfaces]
- [Source: `packages/client/src/components/scoreboard/Scoreboard.vue` - panel surface duplication]
- [Source: `packages/client/src/components/scoreboard/SessionScores.vue` - repeated inner panel row treatment]
- [Source: `packages/client/src/components/tiles/Tile.vue` - small tile width source and accessible tile semantics]
- [Source: `packages/client/src/components/tiles/TileBack.vue` - duplicate small tile width source]
- [Source: `packages/client/src/components/game/TileRackItem.vue` - duplicate tile minimum width source]
- [Source: `packages/client/src/components/dev/TileShowcase.vue` - existing 30px readability surface to extend]
- [Source: `packages/client/package.json` - installed client dependency versions]
- [External: WAI-ARIA APG Toolbar Pattern - https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/]
- [External: W3C WCAG Technique C44 (44x44 CSS pixels) - https://www.w3.org/WAI/WCAG21/Techniques/css/C44]
- [External: Vue 3 Fallthrough Attributes - https://vuejs.org/guide/components/attrs.html]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `vp test run src/components/ui/BaseButton.test.ts`
- `vp test run src/components/ui/BasePanel.test.ts`
- `vp test run src/components/ui/BaseBadge.test.ts`
- `vp test run src/components/ui/BaseToast.test.ts`
- `vp test run src/components/game/MobileBottomBar.test.ts src/components/game/WallCounter.test.ts src/components/game/GameTable.test.ts`
- `vp test run src/components/ui/BaseButton.test.ts src/components/ui/BasePanel.test.ts src/components/ui/BaseBadge.test.ts src/components/ui/BaseToast.test.ts src/components/game/MahjongButton.test.ts src/components/game/DiscardConfirm.test.ts src/components/game/CallButtons.test.ts src/components/game/InvalidMahjongNotification.test.ts src/components/game/TurnIndicator.test.ts src/components/game/WallCounter.test.ts src/components/game/OpponentArea.test.ts src/components/game/GameTable.test.ts src/components/game/MobileBottomBar.test.ts src/components/scoreboard/Scoreboard.test.ts`
- `vp test run src/components/tiles/tile-sizing.test.ts src/components/tiles/Tile.test.ts src/components/tiles/TileBack.test.ts`
- `vp test run`
- `vp run test`
- `vp run typecheck && vp lint`
- `vp test run src/components/game/WallCounter.test.ts src/components/game/CallButtons.test.ts`
- `vp test run src/components/ui/BaseButton.test.ts src/components/ui/BasePanel.test.ts src/components/ui/BaseBadge.test.ts src/components/ui/BaseToast.test.ts src/components/game/CallButtons.test.ts src/components/game/GameTable.test.ts src/components/game/WallCounter.test.ts src/components/tiles/tile-sizing.test.ts src/components/tiles/Tile.test.ts src/components/tiles/TileBack.test.ts`

### Implementation Plan

- Extract a minimal `components/ui/` layer directly from the Epic 5A consumers that already exist, with no speculative abstractions beyond the variants currently required.
- Refactor the existing game/status/scoreboard consumers onto the shared primitives while preserving accessibility semantics, keyboard behavior, and visual hierarchy.
- Centralize `tile-min-width`, extend the tile showcase into a true 152-tile validation surface, and record whether 30px holds or must be raised to 32px/34px.

### Completion Notes List

- Extracted `BaseButton`, `BasePanel`, `BaseBadge`, and `BaseToast` into `packages/client/src/components/ui/` as consumer-driven Epic 5A primitives.
- Refactored the current Epic 5A consumers onto the shared primitives without changing their public behavior, roving-focus compatibility, or accessibility semantics.
- Centralized small-tile sizing in `packages/client/src/components/tiles/tile-sizing.ts`; `Tile.vue`, `TileBack.vue`, `TileRackItem.vue`, and `/dev/tiles` now inherit the same `tile-min-width` source.
- Extended `/dev/theme` to showcase the new primitive variants and `/dev/tiles` to render the full 152-tile wall at the shared minimum width.
- Manual readability outcome: developer visual review of the `/dev/tiles` 152-tile surface in the current dev session found the corner numerals too small at `30px`, so the shared `tile-min-width` was raised to `32px` (`43px` tall small tiles) for all current consumers.
- Confirmed the new primitive and shared tile-sizing tests are included in the final change set and tracked in the File List: `BaseButton.test.ts`, `BaseBadge.test.ts`, `BasePanel.test.ts`, `BaseToast.test.ts`, and `tile-sizing.test.ts`.
- `packages/client` test suite passes (`vp test run`), repo-level typecheck/lint pass (`vp run typecheck && vp lint`), and the full repo test suite now passes (`vp run test`).
- Addressed the AI review findings by keeping `WallCounter`'s live-region message synchronized with the current warning/critical count and ensuring `CallButtons` autofocuses the lone Pass action without stealing focus from real call buttons.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5a-10-shared-primitive-extraction-tile-readability-validation.md`
- `packages/client/src/components/dev/ThemeShowcase.vue`
- `packages/client/src/components/dev/TileShowcase.vue`
- `packages/client/src/components/game/CallButtons.vue`
- `packages/client/src/components/game/DiscardConfirm.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/InvalidMahjongNotification.vue`
- `packages/client/src/components/game/MahjongButton.vue`
- `packages/client/src/components/game/MobileBottomBar.vue`
- `packages/client/src/components/game/OpponentArea.vue`
- `packages/client/src/components/game/TileRackItem.vue`
- `packages/client/src/components/game/WallCounter.test.ts`
- `packages/client/src/components/game/WallCounter.vue`
- `packages/client/src/components/game/TurnIndicator.vue`
- `packages/client/src/components/scoreboard/Scoreboard.vue`
- `packages/client/src/components/scoreboard/SessionScores.vue`
- `packages/client/src/components/scoreboard/format-signed-number.ts`
- `packages/client/src/components/tiles/Tile.test.ts`
- `packages/client/src/components/tiles/Tile.vue`
- `packages/client/src/components/tiles/TileBack.test.ts`
- `packages/client/src/components/tiles/TileBack.vue`
- `packages/client/src/components/tiles/tile-sizing.test.ts`
- `packages/client/src/components/tiles/tile-sizing.ts`
- `packages/client/src/components/ui/BaseBadge.test.ts`
- `packages/client/src/components/ui/BaseBadge.vue`
- `packages/client/src/components/ui/BaseButton.test.ts`
- `packages/client/src/components/ui/BaseButton.vue`
- `packages/client/src/components/ui/BasePanel.test.ts`
- `packages/client/src/components/ui/BasePanel.vue`
- `packages/client/src/components/ui/BaseToast.test.ts`
- `packages/client/src/components/ui/BaseToast.vue`

### Change Log

- 2026-04-01: Extracted shared UI primitives, refactored Epic 5A consumers onto them, centralized `tile-min-width`, expanded the dev showcases, and completed manual readability validation by raising the shared small-tile width from `30px` to `32px`.
- 2026-04-01: Closed the remaining AI review follow-up by confirming the primitive and tile-sizing tests are tracked in the final change set and rerunning repo-wide validation.
- 2026-04-01: Senior AI review found two medium accessibility regressions in `WallCounter` and `CallButtons`; both were fixed and verified with targeted client tests.

### Senior Developer Review (AI)

- Reviewer: GPT-5.4
- Date: 2026-04-01
- Outcome: Approved after fixes
- Findings fixed:
  - `packages/client/src/components/game/WallCounter.vue`: the hidden status message now stays aligned with the current warning/critical count instead of leaving stale text after the first threshold transition.
  - `packages/client/src/components/game/CallButtons.vue`: the pass-only call-window state now autofocuses the lone valid action, while call-button states keep focus on the first actual call action.
- Verification:
  - `vp test run src/components/game/WallCounter.test.ts src/components/game/CallButtons.test.ts`
  - `vp test run src/components/ui/BaseButton.test.ts src/components/ui/BasePanel.test.ts src/components/ui/BaseBadge.test.ts src/components/ui/BaseToast.test.ts src/components/game/CallButtons.test.ts src/components/game/GameTable.test.ts src/components/game/WallCounter.test.ts src/components/tiles/tile-sizing.test.ts src/components/tiles/Tile.test.ts src/components/tiles/TileBack.test.ts`

### Status

done
