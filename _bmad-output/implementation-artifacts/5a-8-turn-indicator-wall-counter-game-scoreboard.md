# Story 5A.8: Turn Indicator, Wall Counter & Game Scoreboard

Status: done

## Story

As a **player**,
I want **to always know whose turn it is, how many tiles remain in the wall, and the current game score**,
So that **I can read the game state at a glance from across the room on a propped-up iPad (UX-DR24)**.

## Acceptance Criteria

1. **AC1 - Active turn clarity:** The active player's seat area has a `state-turn-active` warm glow that is visible from across the room on iPad, and a persistent turn indicator badge shows that player's name.
2. **AC2 - Wall counter visibility:** A wall counter displays `Wall: NN` at the top center of the felt area and remains visible to all players throughout active play. It replaces the current dev-only placeholder in `GameTable.vue`.
3. **AC3 - Normal wall state:** When `wallRemaining > 20`, the wall counter uses the neutral `wall-normal` presentation.
4. **AC4 - Warning wall state:** When `wallRemaining <= 20`, the wall counter transitions to `wall-warning` styling and announces the state change via `aria-live="polite"`.
5. **AC5 - Critical wall state:** When `wallRemaining <= 10`, the wall counter transitions to `wall-critical` styling and announces the stronger urgency state via `aria-live="polite"`.
6. **AC6 - Compact score visibility during play:** During active play, each player's current session score is visible in a compact form near that player's seat area or in a clearly associated summary row.
7. **AC7 - Scoreboard phase breakdown:** When the game enters `gamePhase: "scoreboard"`, the UI shows a full scoring breakdown for the completed game: winner name if any, hand pattern/value when applicable, payment amounts per player, and updated cumulative session totals. Wall-game copy must render correctly when `winnerId === null`.
8. **AC8 - Skip-ahead turn narration:** When turn order skips seats after a resolved call, the turn indicator visually narrates the jump by briefly passing over skipped seats before settling on the new active seat, using the expressive timing token (`400ms`).

## Tasks / Subtasks

- [x] Task 1: Build turn-state UI for seat areas and the local player surface (AC: #1, #6, #8)
  - [x] 1.1 Create a dedicated turn-indicator component in `packages/client/src/components/game/` rather than burying the logic inside `GameTable.vue`.
  - [x] 1.2 Extend `OpponentArea.vue` to accept prop-driven turn-state and compact-score data without introducing Pinia or direct game-state injection.
  - [x] 1.3 Add a matching compact status treatment for the local player's seat area so all four players have visible score/turn context.
  - [x] 1.4 Apply `state-turn-active` glow styling only to the active seat and keep the inactive seats visually quiet.
  - [x] 1.5 Implement skip-ahead narration from seat-order data using shared seat order (`east -> south -> west -> north`) instead of ad hoc position logic.
- [x] Task 2: Create a reusable `WallCounter.vue` component (AC: #2, #3, #4, #5)
  - [x] 2.1 Accept a prop-driven wall count (`wallRemaining`) and compute `normal | warning | critical` state from the story thresholds: `>20`, `<=20`, `<=10`.
  - [x] 2.2 Render the wall counter at the top-center of the felt table area with always-visible badge styling.
  - [x] 2.3 Add `aria-live="polite"` support for state transitions so warning/critical changes are announced without spamming every decrement.
  - [x] 2.4 Use existing theme tokens/classes only: `wall-normal`, `wall-warning`, `wall-critical`, `text-game-critical`, and existing focus/text tokens as needed.
- [x] Task 3: Create scoreboard UI in the architecture-aligned location (AC: #7)
  - [x] 3.1 Create `packages/client/src/components/scoreboard/Scoreboard.vue`.
  - [x] 3.2 If needed to keep files under the 150-line component guideline, split cumulative totals or player rows into a small child such as `SessionScores.vue` in the same folder.
  - [x] 3.3 Make the scoreboard prop-driven from shared game data shapes (`GameResult`, player names, payments, scores), with no WebSocket or room-state logic inside the component.
  - [x] 3.4 Render both Mahjong-win and wall-game variants correctly.
  - [x] 3.5 Scope this story to scoreboard display only. Do not implement rematch buttons, show-hands flow, celebration sequencing, or host controls here.
- [x] Task 4: Integrate new status components into the current table flow (AC: #1, #2, #6, #7, #8)
  - [x] 4.1 Add the minimum prop surface to `GameTable.vue` needed to drive turn state, wall count, scoreboard rendering, and score display from parent state.
  - [x] 4.2 Replace the current wall-counter placeholder in `GameTable.vue` with the real `WallCounter` component.
  - [x] 4.3 Wire seat-area turn glow and compact score display into `OpponentArea.vue` and the local-player area without disturbing the existing discard/action/rack layout.
  - [x] 4.4 Gate scoreboard rendering off `gamePhase === "scoreboard"` while keeping the active-play table intact for `gamePhase === "play"`.
  - [x] 4.5 Keep everything prop-driven and mockable for showcases/tests because `RoomView` and `useGameState` are not yet present in the codebase.
- [x] Task 5: Add focused component and integration coverage (AC: #1-#8)
  - [x] 5.1 Add `WallCounter.test.ts` covering visibility, threshold boundaries, and polite announcement behavior.
  - [x] 5.2 Add tests for the turn indicator / seat-status rendering and skip-ahead narration behavior.
  - [x] 5.3 Add `Scoreboard.test.ts` covering Mahjong-win and wall-game variants plus cumulative totals rendering.
  - [x] 5.4 Update `GameTable.test.ts` for the new prop surface, wall counter integration, active-seat styling, compact scores, and scoreboard-phase rendering.
- [x] Task 6: Add a dev showcase for fast visual verification (AC: #1, #2, #5, #7, #8)
  - [x] 6.1 Create a showcase in `packages/client/src/components/dev/` that demonstrates at least: normal play, warning wall state, critical wall state, scoreboard phase, and a skip-ahead turn transition.
  - [x] 6.2 Register the showcase in `packages/client/src/dev-showcase-routes.ts` using the same pattern as the recent `MahjongButtonShowcase.vue`.

## Dev Notes

### Current Implementation State

- `GameTable.vue` already contains the correct central integration point for this story, but it still has a dev-only wall-counter placeholder and no real turn/score/scoreboard UI.
- `OpponentArea.vue` currently renders avatar, name, and connection status only. It is the right existing surface for active-turn glow and compact score display.
- There is currently **no** `RoomView.vue`, **no** `useGameState.ts`, and **no** `gameStateKey` usage in `packages/client/src`. This story must remain prop-driven and mock-friendly instead of trying to wire full room state.
- `packages/client/src/components/scoreboard/` does not exist yet, but the architecture reserves that folder for scoreboard-phase UI. Create it here instead of inventing another location.

### State Separation Guardrails

- **No optimistic game-state updates.** These components render server-confirmed state only.
- **No Pinia for game state.** Pinia remains client-local UI state only; game state stays prop-driven for now and later comes from injected `useGameState`.
- **No WebSocket imports in components.** Event transport belongs outside the UI layer.
- **No new shared engine logic** in `client/`. This story is presentation and light state-derivation only.

### Recommended Prop Surface

Use the smallest prop surface that supports both active-play and scoreboard views. At minimum, `GameTable.vue` will likely need prop-driven access to:

- `currentTurnPlayerId` or equivalent turn owner identifier
- `wallRemaining`
- `gamePhase`
- `scores`
- `gameResult`
- turn-transition context sufficient to narrate skip-ahead behavior

If skip narration cannot be derived cleanly from just the current turn, add a small explicit transition prop rather than coupling the component to protocol history or global state.

### Shared Types and Constants to Reuse

From `@mahjong-game/shared`:

- `GamePhase`
- `GameResult`
- `MahjongGameResult`
- `WallGameResult`
- `SeatWind`
- `SEATS`

Use shared seat order rather than duplicating turn-order knowledge inside the client.

### UI / Layout Guidance

- The game table already follows the "broadcast overlay" hierarchy from UX: rack/action zone are primary, discard pools and wall counter are secondary, and richer informational UI should stay visually lighter.
- The wall counter belongs in the felt center area, top-center, replacing the existing placeholder in `GameTable.vue`.
- Turn state is a **seat-position notification**, not a toast and not an action-zone element.
- Compact scores during play must be glanceable, but secondary to tile interaction. Keep them visible without competing with the rack and action buttons.
- The scoreboard should feel like the first scoreboard pass, not the full lingering/rematch experience. Do **not** pull in later-story scope like rematch, settings, or show-hands controls.

### Threshold and Scope Clarifications

- Use the story acceptance criteria thresholds **now**: warning at `<=20`, critical at `<=10`.
- The UX document calls these "suggested thresholds" for later tuning, but this story explicitly fixes them for the implementation.
- `5A.8` includes a **basic game scoreboard** with updated cumulative totals.
- `5B.4` is where the broader session-scoreboard/rematch flow matures. Do not steal that scope into this story.
- `5B.7` owns the recent-activity ticker; do not add it here even though it will eventually sit near the turn indicator.

### Reuse Existing Code - Do NOT Reinvent

- **`GameTable.vue`** is the integration hub for the central table, action zone, and rack layout.
- **`OpponentArea.vue`** already owns the seat-position avatar/name surface.
- **`GameTableShowcase.vue`** and **`MahjongButtonShowcase.vue`** establish the project's DEV showcase pattern: scenario toggles at top, felt background, mock props, focused visual states.
- **`themeColors` / Uno tokens** already define `state-turn-active`, `wall.normal`, `wall.warning`, and `wall.critical`.
- **`GameState.scores`** and **`GameState.gameResult`** already exist in shared types. Reuse those data shapes rather than inventing a parallel scoreboard model.

### Primitive Extraction Boundary

- **Do not extract `BaseBadge` in this story.** Epic `5A.10` is the explicit primitive-extraction story.
- It is acceptable for `TurnIndicator` and `WallCounter` to each own local badge-style markup for now, as long as the implementation is clean and easy to refactor later.
- Likewise, do not introduce `BasePanel` here unless it already emerges naturally and remains purely local. The shared primitive belongs to `5A.10`.

### Accessibility Requirements

1. Use semantic text and status markup; do not rely on color alone for turn/wall state.
2. `aria-live="polite"` is required for wall-state changes and appropriate for turn-indicator narration.
3. Keep readable sizing aligned with the established `text-game-critical` / `text-interactive` scale.
4. Maintain the existing mobile/tablet layout guarantees, especially the center-area minimum height and the readability-first bias for iPad.

### Testing Requirements

- Use `vite-plus/test`, not `vitest`.
- Keep tests blackbox-focused. Assert rendered output, classes, emitted behavior, and visible state changes, not `wrapper.vm`.
- Continue to mock `@vue-dnd-kit/core` in `GameTable.test.ts` because `TileRack` remains in the component tree.
- Use `setActivePinia(createPinia())` where store-backed UI is still present in `GameTable`.
- Add explicit threshold tests for `21`, `20`, `10`, and `9` remaining tiles.
- Add at least one test that proves wall-game scoreboard rendering works when `winnerId === null`.
- Add at least one test that proves skip-ahead narration does not assume only adjacent seat changes.

### Suggested File Targets

- `packages/client/src/components/game/TurnIndicator.vue`
- `packages/client/src/components/game/WallCounter.vue`
- `packages/client/src/components/game/OpponentArea.vue`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/scoreboard/Scoreboard.vue`
- `packages/client/src/components/scoreboard/Scoreboard.test.ts`
- `packages/client/src/components/dev/<new-status-showcase>.vue`
- `packages/client/src/dev-showcase-routes.ts`

Keep exact filenames aligned with the existing PascalCase Vue-component convention and the architecture's `components/scoreboard/` placement.

### Previous Story Intelligence (5A.7)

Key learnings from `5a-7-mahjong-button-declaration-ui` that apply directly here:

1. **Prop-driven boundaries worked well.** Keep presentation components dumb and let future parent/composable layers own action dispatch and server state.
2. **Action-zone layout can stack vertically.** `ActionZone.vue` was adjusted so inline notifications can coexist with buttons; do not regress its layout while adding status UI elsewhere.
3. **DEV showcase pattern is established.** Ship new components with scenario-driven showcases instead of relying only on integration tests.
4. **Recent component work lands as a bundle.** The current repo pattern is component + tests + GameTable integration + showcase in the same story.
5. **Native controls should stay native.** Do not add unnecessary keyboard event machinery when semantic HTML already provides the right behavior.

### Git Intelligence

Recent work patterns from the latest commits:

- Use feature-scoped commits such as `feat(MahjongButton): ...` for substantive client UI additions.
- Deliver component, test, integration, story artifact, and showcase updates together.
- Prefer targeted updates to existing integration files (`GameTable.vue`, `GameTable.test.ts`, `dev-showcase-routes.ts`) rather than inventing parallel entry points.

### Latest Technical Information

- The current pinned client stack is already modern and sufficient for this story: Vue `3.5.31`, Pinia `3.0.4`, UnoCSS `66.6.7`, VueUse `14.2.1`, and Vitest `4.1.1` via `vite-plus/test`.
- Continue using Vue 3 Composition API with `<script setup lang="ts">`.
- Continue using UnoCSS theme tokens and shortcuts rather than hardcoded CSS values or ad hoc scoped-style palettes.
- No new dependency is justified for this story.

### Project Structure Notes

- Stay inside `packages/client/src/components/` for all UI work.
- Create the new scoreboard folder exactly where the architecture expects it: `packages/client/src/components/scoreboard/`.
- Do not introduce import aliases. Use relative imports inside the client package and `@mahjong-game/shared` across package boundaries.
- Keep new Vue components under 150 lines when practical; split row/list helpers if the scoreboard gets dense.

### Anti-Patterns to Avoid

- **NO** premature shared primitive extraction (`BaseBadge`, `BasePanel`) in this story
- **NO** game-state storage in Pinia
- **NO** direct WebSocket or protocol handling in Vue components
- **NO** raw hex colors or hardcoded palette values in components
- **NO** scoreboard/rematch/show-hands scope creep from later stories
- **NO** assumptions that turn changes are always adjacent; call resolution can skip seats
- **NO** scoreboard implementation that breaks wall-game rendering

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 5A.8 acceptance criteria]
- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 5A.10 primitive extraction boundary]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` - client folder structure and `components/scoreboard/` placement]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` - server-authoritative state and shared `scores` / `gameResult` data]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - broadcast-overlay hierarchy, seat-position notifications, wall counter, scoreboard purpose, and accessibility cues]
- [Source: `_bmad-output/project-context.md` - Vue/Pinia/UnoCSS/testing rules and no-optimistic-update guardrails]
- [Source: `packages/client/src/components/game/GameTable.vue` - current wall-counter placeholder and integration target]
- [Source: `packages/client/src/components/game/OpponentArea.vue` - current seat-area surface]
- [Source: `packages/client/src/components/dev/GameTableShowcase.vue` - existing showcase pattern]
- [Source: `packages/client/src/components/dev/MahjongButtonShowcase.vue` - scenario-driven showcase pattern]
- [Source: `packages/client/src/styles/design-tokens.ts` - existing turn/wall theme tokens]
- [Source: `packages/shared/src/types/game-state.ts` - `GamePhase`, `GameResult`, `scores`, `SeatWind`]
- [Source: `packages/shared/src/constants.ts` - `SEATS` counterclockwise order]
- [Source: `_bmad-output/implementation-artifacts/5a-7-mahjong-button-declaration-ui.md` - previous-story learnings]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `git log -5 --oneline`
- `git log -5 --stat --oneline`

### Completion Notes List

- Added `TurnIndicator`, `WallCounter`, and scoreboard components plus shared seat-summary types to keep turn, wall, and score UI prop-driven and architecture-aligned.
- Updated `GameTable.vue`, `OpponentArea.vue`, and the local player surface to show active-seat glow, compact session scores, scoreboard-phase gating, and skip-ahead turn narration using shared `SEATS` order.
- Added focused tests for turn narration, seat-status rendering, wall thresholds/live announcements, scoreboard variants, and `GameTable` integration, plus a new game-status dev showcase route.
- Verified the story with `pnpm test && pnpm run typecheck && vp lint` from the repo root; lint completed with existing workspace warnings but no errors.
- Post-review follow-up: moved the wall counter to a true top-center slot in the felt area and added a regression test to lock in the layout requirement.
- Post-review follow-up: updated the scoreboard to keep rendering a payment breakdown for wall games with zero deltas, plus a regression test for the wall-game variant.

### File List

- `_bmad-output/implementation-artifacts/5a-8-turn-indicator-wall-counter-game-scoreboard.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/client/src/components/dev/GameStatusShowcase.vue`
- `packages/client/src/components/dev/GameTableShowcase.vue`
- `packages/client/src/components/game/ActionZone.test.ts`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/OpponentArea.test.ts`
- `packages/client/src/components/game/OpponentArea.vue`
- `packages/client/src/components/game/TurnIndicator.test.ts`
- `packages/client/src/components/game/TurnIndicator.vue`
- `packages/client/src/components/game/WallCounter.test.ts`
- `packages/client/src/components/game/WallCounter.vue`
- `packages/client/src/components/game/seat-types.ts`
- `packages/client/src/components/scoreboard/Scoreboard.test.ts`
- `packages/client/src/components/scoreboard/Scoreboard.vue`
- `packages/client/src/components/scoreboard/SessionScores.vue`
- `packages/client/src/dev-showcase-routes.ts`

### Change Log

- 2026-03-31: Implemented turn indicator, wall counter, scoreboard display, focused tests, and dev showcase support for Story 5A.8.
- 2026-03-31: Fixed code-review findings for wall counter placement and wall-game payment breakdown rendering.

### Status

done
