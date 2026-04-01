# Story 5A.9: Keyboard Navigation & Accessibility Foundation

Status: done

## Story

As a **player using keyboard or assistive technology**,
I want **full keyboard navigation with Tab zones, arrow key movement, and visible focus indicators on every interactive element**,
So that **the game is playable without a mouse and the accessibility foundation is solid from day one (FR119, UX-DR43, NFR31)**.

## Acceptance Criteria

1. **AC1 - Zone-level tab order:** Pressing Tab cycles through the currently implemented gameplay zones in this order: Rack -> Action buttons -> Chat placeholder -> Controls, with a visible gold focus ring (`2px solid`, `2px offset`) on the focused element using the correct context token (`focus-ring-on-felt`, `focus-ring-on-chrome`, or `focus-ring-on-dark`).
2. **AC2 - Rack arrow navigation:** In the rack zone, Arrow keys move focus between individual tiles, and Enter or Space toggles selection for the focused tile.
3. **AC3 - Action-zone arrow navigation:** In the action zone, Arrow keys move focus between the currently available controls (`MahjongButton`, `CallButtons`, `DiscardConfirm`, `Pass`) and Enter or Space activates the focused native button.
4. **AC4 - Chat placeholder exit behavior:** A lightweight chat placeholder exists only to establish the accessibility contract for future Epic 6A work, and pressing Escape while focused in that placeholder exits back to the gameplay zones.
5. **AC5 - Skip link:** A "Skip to game table" link appears on keyboard focus before the main game UI and jumps directly to the primary gameplay region.
6. **AC6 - Semantic/accessibility baseline:** Interactive controls use semantic HTML where appropriate, preserve meaningful `aria-label`s, and do not regress the existing accessible tile labels, toolbar labeling, or live-region behavior already added in earlier stories.
7. **AC7 - Reduced-motion compliance:** Under `prefers-reduced-motion`, all newly added or updated keyboard/focus transitions still resolve to `0ms` through the existing timing-token system rather than ad hoc overrides.

## Tasks / Subtasks

- [x] Task 1: Add zone-level keyboard structure in `GameTable.vue` without breaking the current prop-driven layout (AC: #1, #4, #5)
  - [x] 1.1 Add a keyboard-only skip link before the main game table that targets the primary gameplay region.
  - [x] 1.2 Introduce explicit, labeled focus zones for rack, actions, chat placeholder, and controls so top-level tab order is stable and testable.
  - [x] 1.3 Keep the implementation extensible for the future NMJL/card zone from `UX-DR43` without faking the full card panel in this story.
  - [x] 1.4 Do not move game-state ownership into Pinia or WebSocket-aware code while adding focus management.
- [x] Task 2: Strengthen rack keyboard behavior using the existing tile/rack architecture (AC: #1, #2, #6, #7)
  - [x] 2.1 Reuse `TileRack.vue`, `TileRackItem.vue`, and `Tile.vue` rather than inventing a separate keyboard-only rack component.
  - [x] 2.2 Convert the rack from "every tile is tabbable" to a zone-friendly roving-focus model so Tab enters the rack once and Arrow keys handle intra-rack movement.
  - [x] 2.3 Preserve existing tile selection semantics and drag/drop compatibility; do not break the `@vue-dnd-kit/core` setup already established in `RackDnDSetup`.
  - [x] 2.4 Audit focus styling in tile-related components so focused tiles use the correct context-adaptive focus treatment instead of bespoke hardcoded outlines where that conflicts with UX tokens.
- [x] Task 3: Add proper arrow-key navigation and focus preservation to the action zone (AC: #1, #3, #6, #7)
  - [x] 3.1 Treat the `ActionZone.vue` toolbar as a single-entry focus zone, following the horizontal toolbar pattern: Tab enters/leaves, ArrowLeft/ArrowRight move among available buttons.
  - [x] 3.2 Preserve native button activation for `MahjongButton`, `CallButtons`, and `DiscardConfirm`; do not replace native Enter/Space behavior with custom click emulation unless unavoidable.
  - [x] 3.3 Handle dynamic button sets cleanly when call windows open/close so focus lands on a valid available control instead of being lost.
  - [x] 3.4 Keep existing `aria-label`s (`Game actions`, `Call Pung`, `Pass on call`, `Declare Mahjong`, etc.) intact or improved, never weakened.
- [x] Task 4: Introduce lightweight placeholder zones for future chat/controls work without stealing scope from later epics (AC: #1, #4, #6)
  - [x] 4.1 Add a minimal chat placeholder focus target that is obviously non-final UI but is keyboard reachable and supports Escape-to-exit behavior.
  - [x] 4.2 Update the controls placeholder surface so it can participate in keyboard navigation; avoid using fully disabled elements if they must remain tabbable for the zone contract.
  - [x] 4.3 Keep the placeholders visually quiet and clearly secondary so this story does not become Epic 6A chat UI or Epic 6B A/V controls work.
- [x] Task 5: Add focused tests and a dev verification surface for the new accessibility contract (AC: #1-#7)
  - [x] 5.1 Expand `GameTable.test.ts` to cover skip-link presence, top-level zone order, and Escape behavior from the chat placeholder.
  - [x] 5.2 Expand `TileRack.test.ts` to cover the roving-focus/tab-stop model instead of only asserting that every tile exposes `tabindex="0"`.
  - [x] 5.3 Add action-zone tests for ArrowLeft/ArrowRight focus movement and focus preservation when available controls change.
  - [x] 5.4 Update any touched tests to use `vite-plus/test` imports consistently.
  - [x] 5.5 Add or extend a dev showcase scenario that lets the developer manually verify keyboard traversal across rack, actions, chat placeholder, and controls.

## Dev Notes

### Current Implementation State

- `GameTable.vue` is already the integration hub for the table, action zone, rack area, turn indicator, wall counter, and mobile placeholder controls.
- `TileRack.vue` already has partial keyboard support: the rack is a `role="list"`, tiles sit inside `role="listitem"` wrappers, ArrowLeft/ArrowRight logic exists, and interactive tiles are focusable.
- The current rack behavior does **not** yet satisfy the zone-based contract because every interactive tile is individually tabbable, which makes Tab walk tile-by-tile instead of entering the rack as one zone.
- `ActionZone.vue` already exposes `role="toolbar"` with `aria-label="Game actions"`, which is the correct semantic starting point, but it currently lacks toolbar-style roving focus behavior.
- `CallButtons.vue` already focuses the first available call button when valid calls change, which is useful for this story and should be preserved rather than replaced.
- `MobileBottomBar.vue` already provides placeholder controls for NMJL/chat/A/V on phone, but its buttons are currently `disabled`, so they are not viable participants in keyboard zone traversal as written.
- There is currently **no** skip link, **no** explicit chat placeholder focus target, and **no** shared zone coordinator/composable for keyboard traversal across game-table regions.

### State Separation Guardrails

- **No optimistic game-state updates.** This story is keyboard/focus/accessibility work only.
- **No Pinia for game state.** Keep game-critical state prop-driven and future-compatible with `useGameState`.
- **No WebSocket imports in components.** Keyboard navigation must stay entirely in the client presentation layer.
- **No shared-engine changes** in `packages/shared/` for this story. This is a client accessibility foundation task.

### Existing Components To Reuse

- **`GameTable.vue`** remains the orchestration point for zone order and skip-link placement.
- **`TileRack.vue` + `TileRackItem.vue` + `Tile.vue`** already contain most of the rack interaction semantics; extend them instead of replacing them.
- **`ActionZone.vue`**, **`MahjongButton.vue`**, **`CallButtons.vue`**, and **`DiscardConfirm.vue`** already use native buttons and should stay that way.
- **`MobileBottomBar.vue`** is the obvious placeholder controls surface to adapt rather than creating a second parallel controls bar.
- **`InvalidMahjongNotification.vue`**, **`TurnIndicator.vue`**, and **`WallCounter.vue`** already establish the current accessibility baseline (`aria-live`, semantic status messaging). Do not regress them while reshaping focus flow.

### Accessibility Implementation Guardrails

1. Follow the zone model from `FR119` / `UX-DR43`: Tab moves between zones, Arrow keys move within a zone, Enter/Space activates the focused control, Escape exits the chat placeholder.
2. For the action cluster, treat the toolbar as a **single tab stop** with horizontal Arrow navigation. This is the right accessibility model for `role="toolbar"`.
3. Preserve native semantics wherever possible. Use real `<button type="button">` for actionable controls and placeholders that need to be keyboard reachable. Avoid extra key handlers on native buttons unless they are strictly for Arrow-key focus movement.
4. Do **not** break the current tile-label accessibility already provided by `Tile.vue` (`aria-label` per tile identity). If tile markup changes, preserve the label quality and focusability.
5. If a placeholder control must remain visible in the tab order, prefer `aria-disabled="true"` plus guarded no-op behavior over the `disabled` attribute, because disabled controls cannot receive focus.
6. Keep focus-ring styling aligned with existing design tokens. This story should reduce bespoke focus styling, not add more one-off outlines.
7. Respect `prefers-reduced-motion` through the existing timing tokens in theme CSS. Do not add custom timers/transitions that bypass the token system.

### Architecture Compliance

- The architecture and project context require **semantic HTML, ARIA labels, keyboard navigation, 44px tap targets, prefers-reduced-motion, and WCAG AA intent** from the start.
- The project uses a **server-authoritative game-state model**. Keyboard/focus changes must not assume client-side authority over game actions.
- The project context explicitly says **keep components under ~150 lines** and extract child components or composables when needed. If zone/focus logic makes `GameTable.vue` or `TileRack.vue` too large, move reusable logic into a client composable rather than bloating the component.
- The architecture shows a general `client/src/composables/` location for reusable UI logic. A small shared focus/roving-tabindex helper belongs there if both rack and action zones need it.

### Library / Framework Requirements

- Current client package versions in repo: `vue ^3.5.0`, `pinia ^3.0.0`, `@vue-dnd-kit/core ^2.0.0`, `@vueuse/core ^14.2.0`, `motion-v ^2.0.0`, `unocss ^66.0.0`.
- No new dependency is justified for this story. The existing stack already supports the required behavior.
- Live accessibility guidance for horizontal toolbars recommends **roving tabindex** with Tab entering/leaving the toolbar as one stop and Arrow keys moving among controls. Align the action zone with that pattern.
- Current drag-and-drop accessibility guidance for the DnD Kit ecosystem expects the activator element to stay focusable and keyboard operable (`Enter`/`Space` activate, `Escape` cancels, Arrow keys move during keyboard drag). Do not accidentally break the rack's existing keyboard-compatible drag surface while adding zone navigation.
- Current reduced-motion guidance still favors honoring `prefers-reduced-motion` by disabling non-essential motion and preserving non-motion alternatives. The project already implements this via timing tokens set to `0ms`; keep using that approach.

### File Structure Notes

- Stay inside `packages/client/src/` for all code changes.
- Keep gameplay UI work under the **existing repo reality**: `packages/client/src/components/game/`. Do **not** reorganize current components into a new `components/actions/` folder as part of this story.
- If you extract reusable keyboard/focus logic, place it in `packages/client/src/composables/` rather than inventing a new utilities folder.
- Do not introduce import aliases. Use relative imports inside `client/` and `@mahjong-game/shared` across package boundaries.

### Testing Requirements

- Use `vite-plus/test`, not `vitest`, for any new or touched tests.
- Keep tests blackbox-focused. Assert keyboard interactions, rendered semantics, focusability contracts, and emitted behavior, not `wrapper.vm`.
- Continue to mock `@vue-dnd-kit/core` where existing game-component tests already do so.
- Use `setActivePinia(createPinia())` where affected tests still touch store-backed UI such as the rack store.
- Replace weak keyboard tests that only assert "handler doesn't throw" with assertions about actual tab-stop/attribute behavior where happy-dom makes that practical.
- You do **not** need a full E2E suite for this story, but the dev showcase should make manual keyboard verification easy.

### Suggested File Targets

- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/game/TileRack.vue`
- `packages/client/src/components/game/TileRack.test.ts`
- `packages/client/src/components/game/TileRackItem.vue`
- `packages/client/src/components/tiles/Tile.vue`
- `packages/client/src/components/game/ActionZone.vue`
- `packages/client/src/components/game/CallButtons.vue`
- `packages/client/src/components/game/CallButtons.test.ts`
- `packages/client/src/components/game/MahjongButton.vue`
- `packages/client/src/components/game/DiscardConfirm.vue`
- `packages/client/src/components/game/MobileBottomBar.vue`
- `packages/client/src/components/game/MobileBottomBar.test.ts`
- `packages/client/src/composables/<focus-navigation-helper>.ts` (only if extracted to keep components small)
- `packages/client/src/components/dev/<keyboard-accessibility-showcase>.vue` or an extension of the existing game-table/game-status showcase
- `packages/client/src/dev-showcase-routes.ts`

### Previous Story Intelligence (5A.8)

Key learnings from `5a-8-turn-indicator-wall-counter-game-scoreboard.md` that apply directly here:

1. **Keep `GameTable.vue` as the integration hub.** Recent UI stories have succeeded by extending the existing table rather than creating parallel containers.
2. **Prop-driven boundaries are working.** Accessibility/focus state should remain local UI behavior, not a reason to couple components to future room-state plumbing.
3. **Recent stories land as bundles.** The repo pattern is component update + focused tests + `GameTable` integration + dev showcase in one story.
4. **Reuse existing semantics before inventing new ones.** The action zone toolbar role, tile labels, call-button labels, and live regions are already good building blocks.
5. **Primitive extraction is still deferred to `5A.10`.** Do not use this story as a reason to start broad shared-component refactors.

### Git Intelligence

Recent commit patterns relevant to this story:

- `feat(GameStatus): implement turn indicator, wall counter, and scoreboard UI`
- `feat(MahjongButton): implement persistent button with invalid declaration feedback`

Actionable takeaways:

- Recent client UI work updates the story artifact, sprint status, components, tests, and showcase routes together.
- The recent implementation pattern favors targeted edits in existing integration files (`GameTable.vue`, `GameTable.test.ts`, `dev-showcase-routes.ts`) over creating new entry points.
- Accessibility improvements have already been added incrementally (`aria-live`, button labels, toolbar role), so this story should extend that baseline instead of rewriting it.

### Latest Technical Information

- The client stack in `packages/client/package.json` is already current enough for this story; no package upgrade or dependency addition is warranted.
- WAI-ARIA Authoring Practices for toolbars still recommend a single tab stop with roving tabindex and Arrow-key navigation inside the toolbar. That matches the desired action-zone behavior here.
- The DnD Kit accessibility guidance still centers on **focusable activators plus keyboard operations** rather than custom non-semantic drag surfaces. Keep the rack keyboardable while avoiding conflicts between zone navigation and drag interactions.
- MDN/WCAG guidance for `prefers-reduced-motion` still supports disabling non-essential animation. The project's existing timing-token approach (`0ms` overrides) remains a good fit and should not be bypassed with custom animation code.

### Scope Boundaries

- This story establishes the **keyboard/accessibility foundation**, not the final screen-reader polish from Epic `8.4`.
- This story does **not** implement real chat, real NMJL card navigation, real settings, or real A/V controls.
- This story does **not** introduce Playwright E2E coverage unless a tiny targeted check becomes clearly necessary.
- This story does **not** extract shared primitives (`BaseButton`, `BaseInput`, `BasePanel`) ahead of `5A.10`.

### Anti-Patterns To Avoid

- **NO** tab order that walks every tile individually before leaving the rack zone
- **NO** custom keyboard handlers that duplicate native button activation semantics
- **NO** focusable placeholders that look final or imply real chat/control functionality already exists
- **NO** `disabled` placeholder buttons if those controls are meant to participate in the tab-zone contract
- **NO** Pinia/global-store focus manager for what should be local UI behavior
- **NO** hardcoded raw colors or one-off focus outlines when design tokens already exist
- **NO** broad folder reorganization while implementing this accessibility foundation
- **NO** regressions to existing `aria-live`, `aria-label`, or 44px-target behavior from previous stories

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - FR119, NFR28-NFR31, UX-DR6, UX-DR43, Story 5A.9 acceptance criteria]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` - accessibility constraints, client composables location, server-authoritative state model, Vue/Pinia/UnoCSS stack]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - desktop keyboard as first-class input, same-place-every-time interaction model, broadcast-style hierarchy]
- [Source: `_bmad-output/project-context.md` - component size guidance, state-tier separation, testing rules, accessibility non-negotiables]
- [Source: `_bmad-output/implementation-artifacts/5a-8-turn-indicator-wall-counter-game-scoreboard.md` - previous-story learnings and recent repo patterns]
- [Source: `packages/client/src/components/game/GameTable.vue` - current integration hub and missing zone scaffolding]
- [Source: `packages/client/src/components/game/TileRack.vue` - current arrow-key rack behavior and current multi-tab-stop limitation]
- [Source: `packages/client/src/components/tiles/Tile.vue` - current tile labels, focusability, and focus styling]
- [Source: `packages/client/src/components/game/ActionZone.vue` - current toolbar semantics]
- [Source: `packages/client/src/components/game/CallButtons.vue` - current first-button focus behavior and native button labels]
- [Source: `packages/client/src/components/game/MobileBottomBar.vue` - current placeholder controls surface]
- [Source: `packages/client/package.json` - current client dependency versions]
- [External: WAI-ARIA APG Toolbar Pattern - https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/]
- [External: DnD Kit accessibility guidance - https://docs.dndkit.com/guides/accessibility]
- [External: MDN `prefers-reduced-motion` - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `vp test run src/components/game/GameTable.test.ts`
- `vp test run src/components/game/TileRack.test.ts`
- `vp test run src/components/game/MobileBottomBar.test.ts`
- `vp test run src/components/tiles/Tile.test.ts src/components/game/TileRack.test.ts src/components/game/GameTable.test.ts src/components/game/MobileBottomBar.test.ts`
- `pnpm test`
- `pnpm run typecheck`
- `vp lint`

### Implementation Plan

- Keep `GameTable.vue` as the accessibility orchestration surface by adding the skip link, gameplay region target, and lightweight placeholder zones without introducing any game-state coupling.
- Convert the rack and action zone to roving-focus models so Tab enters each cluster once while Arrow keys handle intra-zone movement and dynamic focus recovery.
- Reuse the existing placeholder and button surfaces, including `MobileBottomBar.vue`, so the keyboard contract lands now without pulling real chat, NMJL card, or A/V scope into this story.

### Completion Notes List

- Added a keyboard-only skip link, gameplay-region target, chat placeholder, and controls placeholder surface in `GameTable.vue` so top-level keyboard traversal is explicit and stable.
- Converted the rack to a roving-tabindex model that keeps a single Tab entry point, preserves tile selection and drag/drop behavior, and includes the Sort button inside the rack's Arrow-key flow.
- Updated `ActionZone.vue` to manage toolbar roving focus and preserve focus when call-window controls appear or disappear while keeping native button activation semantics intact.
- Reused `MobileBottomBar.vue` as a quiet, focusable controls placeholder using `aria-disabled` instead of disabled buttons so the placeholder remains keyboard reachable.
- Added focused coverage for skip-link/zone order, chat Escape behavior, rack roving focus, sort-button traversal, and action-zone focus recovery, plus a dedicated keyboard accessibility showcase route for manual verification.

### File List

- `_bmad-output/implementation-artifacts/5a-9-keyboard-navigation-accessibility-foundation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/client/src/components/dev/KeyboardAccessibilityShowcase.vue`
- `packages/client/src/components/game/ActionZone.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/MobileBottomBar.test.ts`
- `packages/client/src/components/game/MobileBottomBar.vue`
- `packages/client/src/components/game/TileRack.test.ts`
- `packages/client/src/components/game/TileRack.vue`
- `packages/client/src/components/game/TileRackItem.vue`
- `packages/client/src/components/tiles/Tile.vue`
- `packages/client/src/dev-showcase-routes.ts`

### Status

done
