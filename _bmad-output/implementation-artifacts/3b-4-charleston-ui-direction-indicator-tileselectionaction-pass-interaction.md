# Story 3B.4: Charleston UI — Direction Indicator, TileSelectionAction & Pass Interaction

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **player**,
I want **a clear Charleston interface showing pass direction, tile selection progress, and a Pass button, with a shared TileSelectionAction composable for selecting tiles from my rack**,
so that **the Charleston feels alive and social, not like filling out a form (UX-DR26, UX-DR29, FR37, FR38)**.

## Acceptance Criteria

1. **AC1 — CharlestonZone visibility:** Given `gamePhase === "charleston"`, when the game table renders, then a `CharlestonZone` component appears in the table center area displaying: a bold direction arrow (Right / Across / Left), a progress indicator ("N of 3 selected"), and a "Pass" button (UX-DR26). During `gamePhase === "play"` or `"scoreboard"` the zone is hidden.
2. **AC2 — TileSelectionAction composable reusability:** Given the `useTileSelection(count)` composable is initialized with a target count, when a player taps tiles in the rack, then the composable manages selection state (selectedIds, progress text, isComplete flag, confirm/cancel), and the pattern is reusable by future call confirmation and Joker exchange stories (UX-DR29).
3. **AC3 — Tile selection in rack:** Given the Charleston phase is active and the player has not yet submitted, when the player taps a tile in the rack, then the tile toggles between selected/deselected states with a visual indicator. Tapping a selected tile deselects it. Progress updates ("2 of 3 selected"). The rack remains drag-and-drop sortable during selection.
4. **AC4 — Pass button activation:** Given 3 tiles are selected during a regular Charleston pass, when the selection is complete, then the "Pass" button becomes active (Primary tier — gold fill) and tapping it dispatches `CHARLESTON_PASS` with the selected `tileIds`. The button is disabled when fewer than 3 tiles are selected.
5. **AC5 — Blind pass enforcement UI:** Given the blind pass direction (Left in first Charleston, Right in second), when entering the blind pass, then the UI displays a clear "Select tiles before seeing received tiles" indicator. Received Across tiles are visually hidden in the rack (replaced with tile backs or a placeholder count badge) until the player locks their pass selection (UX-DR26 blind-locked state).
6. **AC6 — Second Charleston vote prompt:** Given `charleston.status === "vote-ready"`, when the vote prompt appears, then it displays as inline buttons ("Yes" / "No") in the ActionZone — not a modal (UX-DR37). Tapping dispatches `CHARLESTON_VOTE` with `{ accept: true/false }`. Buttons are disabled after the player votes (`charleston.myVote !== null`).
7. **AC7 — Courtesy pass UI:** Given `charleston.stage === "courtesy"` and `charleston.status === "courtesy-ready"`, when the courtesy phase is active, then the UI shows a count selector (0–3) and `useTileSelection(count)` handles tile selection for the chosen count. Submitting dispatches `COURTESY_PASS` with `{ count, tileIds }`. A count of 0 requires no tile selection and submits immediately.
8. **AC8 — Waiting state:** Given the player has submitted their pass/vote/courtesy, when waiting for other players, then the UI shows a waiting indicator (e.g., "Waiting for other players…") and the pass/vote/courtesy buttons are disabled. `charleston.mySubmissionLocked === true` drives this state.
9. **AC9 — Direction transitions and animations:** Given a pass direction resolves and the next direction begins, when tile exchange occurs, then tiles animate in the direction of the pass (expressive timing, 400ms `--timing-expressive`) matching the direction indicator. Received tiles appear in the rack. The direction indicator updates to the next pass direction.
10. **AC10 — Keyboard accessibility:** Given the Charleston phase, when navigating by keyboard, then tile selection supports Enter/Space to toggle, ArrowLeft/ArrowRight to navigate between tiles, and the Pass button is reachable via Tab. The ActionZone toolbar pattern from existing `CallButtons` is followed for vote buttons.

## Tasks / Subtasks

- [x] Task 1: Create `useTileSelection` composable (AC: 2, 3)
  - [x] 1.1 Create `packages/client/src/composables/useTileSelection.ts` with reactive state: `selectedIds: Ref<Set<string>>`, `targetCount: Ref<number>`, `isComplete: ComputedRef<boolean>`, `progressText: ComputedRef<string>`, `toggleTile(id)`, `reset()`, `cancel()`.
  - [x] 1.2 Add guard: `toggleTile` is a no-op when `targetCount` is 0 or when the set is full and the tile is not already selected.
  - [x] 1.3 Add `confirmedIds: ComputedRef<string[]>` that returns `[...selectedIds]` in insertion order when `isComplete` is true, else empty array.
  - [x] 1.4 Write co-located test `useTileSelection.test.ts` covering: select/deselect toggle, progress text updates, max-count guard, reset clears state, zero-count completes immediately.

- [x] Task 2: Create `CharlestonZone` component (AC: 1, 4, 5, 8, 9)
  - [x] 2.1 Create `packages/client/src/components/charleston/CharlestonZone.vue` as `<script setup lang="ts">` component.
  - [x] 2.2 Props: `charleston: PlayerCharlestonView`, `myRack: Tile[]`, `selectedTileIds: Set<string>`, `isComplete: boolean`, `progressText: string`.
  - [x] 2.3 Emits: `pass()` (parent submits `confirmedIds` from `useTileSelection`). Tile toggles are handled on `TileRack`, not the zone.
  - [x] 2.4 Render direction indicator: bold arrow icon/text showing `charleston.currentDirection` ("Right →", "← Left", "↕ Across"). Null direction during courtesy/vote hides the arrow.
  - [x] 2.5 Render progress indicator: `progressText` (e.g., "2 of 3 selected") below direction arrow.
  - [x] 2.6 Render Pass button using `BaseButton` variant `"primary"`, disabled when `!isComplete` or `charleston.mySubmissionLocked`.
  - [x] 2.7 Render blind-pass indicator when `charleston.myHiddenTileCount > 0` and the player has not yet submitted: show text "Select tiles to pass before seeing received tiles" with a badge showing hidden tile count.
  - [x] 2.8 Render waiting state when `charleston.mySubmissionLocked === true`: replace Pass button / progress with "Waiting for other players…" text.
  - [x] 2.9 Write co-located test `CharlestonZone.test.ts` covering: direction display, progress text, Pass button enabled/disabled, blind-pass indicator, waiting state, emit on Pass click.

- [x] Task 3: Create `CharlestonVote` component (AC: 6)
  - [x] 3.1 Create `packages/client/src/components/charleston/CharlestonVote.vue` with props: `myVote: boolean | null`, `votesReceivedCount: number`.
  - [x] 3.2 Emits: `vote(accept: boolean)`.
  - [x] 3.3 Render "Do a second Charleston?" prompt with Yes / No `BaseButton` inline (not modal). Yes = `variant="primary"`, No = `variant="secondary"`.
  - [x] 3.4 Disable buttons when `myVote !== null`. Show which option the player chose.
  - [x] 3.5 Show votes-received count: "N of 4 voted" below buttons.
  - [x] 3.6 Write co-located test `CharlestonVote.test.ts`.

- [x] Task 4: Create `CourtesyPassUI` component (AC: 7)
  - [x] 4.1 Create `packages/client/src/components/charleston/CourtesyPassUI.vue` with props: `charleston: PlayerCharlestonView`, `selectedTileIds: Set<string>`, `isComplete: boolean`, `progressText: string`.
  - [x] 4.2 Emits: `courtesy-pass(count: number, tileIds: string[])`, `count-change(count: number)`. Tile selection is on `TileRack`; parent maps `confirmedIds` on submit.
  - [x] 4.3 Render count selector: row of buttons for 0, 1, 2, 3. Selected count is highlighted. Changing count resets tile selection.
  - [x] 4.4 When count is 0: show "Skip courtesy pass" button that submits immediately.
  - [x] 4.5 When count > 0: show `progressText` and Pass button (enabled when `isComplete`).
  - [x] 4.6 When `charleston.mySubmissionLocked`: show waiting state.
  - [x] 4.7 Write co-located test `CourtesyPassUI.test.ts`.

- [x] Task 5: Integrate Charleston UI into GameTable (AC: 1, 5, 6, 7, 8, 9, 10)
  - [x] 5.1 Add `charleston` prop to `GameTable` (type: `PlayerCharlestonView | null`).
  - [x] 5.2 When `gamePhase === "charleston"`: render `CharlestonZone`, `CharlestonVote`, or `CourtesyPassUI` in the table center area (replacing play-phase discard pools / turn indicator). Choose subcomponent based on `charleston.status`:
    - `"passing"` → `CharlestonZone`
    - `"vote-ready"` → `CharlestonVote`
    - `"courtesy-ready"` → `CourtesyPassUI`
  - [x] 5.3 Wire `useTileSelection` in the parent that provides `GameTable` props (or in `GameTable` itself): initialize with target count from Charleston state, pass `selectedTileIds`, `isComplete`, `progressText` down.
  - [x] 5.4 Modify `TileRack` to accept an optional `selectionMode` prop. In selection mode: tiles use `useTileSelection.toggleTile` on click instead of `rackStore.selectTile`; selected tiles show a distinct "charleston-selected" visual state (e.g., raised + highlighted border). DnD remains functional.
  - [x] 5.5 Handle blind-pass hidden tiles: when `charleston.myHiddenTileCount > 0`, render that many `TileBack` components in the rack (or a count badge) instead of real tile faces. After submission and direction resolution, the server reveals the tiles via the next `STATE_UPDATE`.
  - [x] 5.6 Wire emits from Charleston subcomponents to dispatch game actions:
    - `CharlestonZone @pass` → dispatch `{ type: 'CHARLESTON_PASS', tileIds }`
    - `CharlestonVote @vote` → dispatch `{ type: 'CHARLESTON_VOTE', accept }`
    - `CourtesyPassUI @courtesy-pass` → dispatch `{ type: 'COURTESY_PASS', count, tileIds }`
  - [x] 5.7 Reset `useTileSelection` on each direction transition (watch `charleston.currentDirection` changes).
  - [x] 5.8 Ensure ActionZone keyboard navigation works for vote buttons (reuse existing toolbar pattern).
  - [x] 5.9 Write/update `GameTable.test.ts` for Charleston rendering: phase switching, correct subcomponent display, prop forwarding.

- [x] Task 6: Add tile pass animations (AC: 9)
  - [x] 6.1 Use Vue `<Transition>` or motion-v for tile pass animation. Tiles glide out in the pass direction (right/left/across) at `--timing-expressive` (400ms).
  - [x] 6.2 Received tiles animate into the rack from the opposite direction.
  - [x] 6.3 Keep animation implementation simple — CSS transitions or basic motion-v. Do not over-engineer; the celebration sequence (Epic 7) owns elaborate orchestration.
  - [x] 6.4 Respect `prefers-reduced-motion`: collapse animations to instant state changes.

- [x] Task 7: Validation gate (AC: all)
  - [x] 7.1 Run `pnpm test`.
  - [x] 7.2 Run `pnpm run typecheck`.
  - [x] 7.3 Run `vp lint`.
  - [x] 7.4 Manual verification: each AC maps to at least one automated test.

## Dev Notes

### Execution Gate

- **Epic 3B still carries two active Epic 5A retro prerequisites:** `5a-retro-4-client-integration-layer-before-epic-3b` and `5a-retro-5-epic-3b-planning-review`. These are marked `backlog` in sprint-status.yaml.
- **This story is the first real client-side Charleston work.** No live client-state integration layer (`useGameState` composable wired to the Charleston protocol) exists yet. If the retro gate requires that layer before this story, the dev agent must check with the user before proceeding.
- **Pragmatic approach:** This story can be built as presentational components + composable driven by props, testable in isolation without a live WebSocket connection. The integration with `useGameState` can happen as a thin wiring layer (either in this story or as a follow-up).

### Current Implementation State

- **No Charleston UI components exist** in `packages/client/src/`. The only Charleston reference in the client is `TestHarness.vue` which fast-forwards past Charleston to play phase.
- **All shared Charleston engine logic is complete** (Stories 3B.1–3B.3). The protocol types (`PlayerCharlestonView`, `PublicCharlestonView`) and resolved actions (`CHARLESTON_PHASE_COMPLETE`, `CHARLESTON_VOTE_CAST`, `CHARLESTON_VOTE_RESOLVED`, `COURTESY_PASS_LOCKED`, `COURTESY_PAIR_RESOLVED`) are fully defined and exported from `@mahjong-game/shared`.
- **Server state broadcasting is complete.** `buildPlayerView()` in `state-broadcaster.ts` already constructs per-player `PlayerCharlestonView` with `myHiddenTileCount`, `mySubmissionLocked`, `myVote`, and `myCourtesySubmission`.
- **`useGameState` composable does not exist yet.** Architecture specifies it as the single provider of reactive server state via provide/inject (`gameStateKey`). This story's components should be designed to accept Charleston state as props so they work regardless of whether the composable is wired.
- **Rack selection currently uses `rackStore.selectTile`** which toggles a single tile. Charleston needs multi-tile selection (up to 3). The `useTileSelection` composable must coexist with the existing rack store without breaking play-phase single-selection.

### Architecture Patterns

- **No optimistic updates (hard rule).** Client renders game state ONLY from `STATE_UPDATE`. When Pass is tapped, tiles do not move until server confirms. The UI shows a waiting state.
- **Props-driven presentational components.** Charleston components receive `PlayerCharlestonView` and rack data as props. They emit actions upward. The wiring layer (eventually `useGameState.dispatch`) is the caller's responsibility.
- **`<script setup lang="ts">` always.** No Options API. Section order: imports → props/emits → inject → composables/stores → computed → methods.
- **UnoCSS utility classes preferred.** Scoped `<style>` only for complex layout or animation keyframes.
- **Imports from `@mahjong-game/shared`** for all types. No `@/` aliases — use relative imports within client package.
- **Imports from `vite-plus/test`** (not `vitest`) for test utilities.
- **happy-dom** for client tests (not jsdom).
- **`BaseButton`** for all interactive buttons. Variants: `"primary"` (gold accent, for Pass), `"secondary"` (chrome surface, for No vote / cancel), `"urgent"` (call window amber, not needed here).

### Key Protocol Types the UI Consumes

```typescript
// From @mahjong-game/shared — PlayerCharlestonView
{
  stage: "first" | "second" | "courtesy";
  status: "passing" | "vote-ready" | "courtesy-ready";
  currentDirection: "right" | "across" | "left" | null;
  activePlayerIds: string[];
  submittedPlayerIds: string[];
  votesReceivedCount: number;
  courtesyPairings: readonly [string, string][];
  courtesyResolvedPairCount: number;
  // Per-player only:
  myHiddenTileCount: number;        // Across tiles held back during blind pass
  mySubmissionLocked: boolean;       // Player already submitted for this direction
  myVote: boolean | null;            // Player's vote during vote-ready
  myCourtesySubmission: { count: number; tileIds: string[] } | null;
}
```

### Relevant Resolved Actions for Animation Triggers

```typescript
// Watch these in resolvedAction to trigger animations:
"CHARLESTON_PHASE_COMPLETE"   // { direction, nextDirection, stage, status }
"CHARLESTON_VOTE_CAST"        // { votesReceivedCount }
"CHARLESTON_VOTE_RESOLVED"    // { outcome, nextDirection, stage, status }
"COURTESY_PASS_LOCKED"        // { playerId, pairing }
"COURTESY_PAIR_RESOLVED"      // { pairing, playerRequests, appliedCount, entersPlay }
```

### Component File Placement

| File | Purpose |
|------|---------|
| `packages/client/src/composables/useTileSelection.ts` | Shared tile selection composable (reusable) |
| `packages/client/src/composables/useTileSelection.test.ts` | Composable tests |
| `packages/client/src/components/charleston/CharlestonZone.vue` | Direction + progress + Pass button |
| `packages/client/src/components/charleston/CharlestonZone.test.ts` | Component tests |
| `packages/client/src/components/charleston/CharlestonVote.vue` | Second Charleston vote prompt |
| `packages/client/src/components/charleston/CharlestonVote.test.ts` | Component tests |
| `packages/client/src/components/charleston/CourtesyPassUI.vue` | Courtesy pass count selector + tile selection |
| `packages/client/src/components/charleston/CourtesyPassUI.test.ts` | Component tests |
| `packages/client/src/components/game/GameTable.vue` | Modified — add charleston phase rendering |
| `packages/client/src/components/game/GameTable.test.ts` | Updated — charleston phase tests |
| `packages/client/src/components/game/TileRack.vue` | Modified — add selection mode for Charleston |
| `packages/client/src/components/game/TileRack.test.ts` | Updated — selection mode tests |
| `packages/client/src/components/tiles/Tile.vue` | May need new TileState for "charleston-selected" |

### Existing Code To Reuse

- **`BaseButton`** (`packages/client/src/components/ui/BaseButton.vue`) — `variant="primary"` for Pass, `variant="secondary"` for No vote / cancel.
- **`ActionZone`** (`packages/client/src/components/game/ActionZone.vue`) — Toolbar pattern with keyboard nav (ArrowLeft/ArrowRight, roving tabindex). Use for vote buttons.
- **`CallButtons`** (`packages/client/src/components/game/CallButtons.vue`) — Reference implementation for inline action buttons within ActionZone.
- **`TileRack`** (`packages/client/src/components/game/TileRack.vue`) — Existing rack with DnD. Add conditional selection mode without replacing DnD.
- **`useRackStore`** (`packages/client/src/stores/rack.ts`) — `selectTile()` toggles single tile for discard. Charleston multi-select must NOT reuse `selectedTileId` — use the new `useTileSelection` composable instead.
- **`TileBack`** (`packages/client/src/components/tiles/TileBack.vue`) — For rendering hidden Across tiles during blind pass.
- **`BaseBadge`** (`packages/client/src/components/ui/BaseBadge.vue`) — For hidden tile count badge, votes count.
- **Design tokens** (`packages/client/src/styles/design-tokens.ts`) — `gold-accent` for primary buttons, `--timing-expressive` (400ms) for pass animations, `--timing-tactile` (120ms) for tile select.

### Critical Gotchas

1. **`useTileSelection` must NOT touch `rackStore.selectedTileId`.** The rack store's single-select is for play-phase discard. Charleston multi-select is a separate concern. The composable should be standalone.
2. **DnD must remain functional during selection.** Players sort tiles while choosing which to pass. The selection composable and DnD are independent — selecting a tile should not trigger a drag.
3. **Blind pass: tiles are NOT in `myRack` yet.** During blind pass, the server holds Across tiles in `hiddenAcrossTilesByPlayerId`. The client sees `myHiddenTileCount > 0` but no tile data. Show `TileBack` placeholders or a count badge.
4. **No action dispatch until server confirms.** After tapping Pass, show waiting state. Tiles stay in rack until the next `STATE_UPDATE` moves them.
5. **Reset selection on direction change.** When `charleston.currentDirection` changes (new pass direction), clear the `useTileSelection` state.
6. **Courtesy count change resets selection.** If the player changes their courtesy count from 3 to 2, all selected tiles are deselected.
7. **`@vue-dnd-kit/core` must be mocked in tests.** Client test convention — see existing `TileRack.test.ts` for mock pattern.
8. **`setActivePinia(createPinia())` in `beforeEach`.** Required for any test touching `useRackStore`.
9. **`gamePhase` determines which UI shows.** Charleston renders in table center area replacing play-phase content (discard pools, turn indicator). Use conditional `v-if` on `gamePhase`.
10. **Seat order is counterclockwise.** Direction arrows: Right → clockwise neighbor, Left → counterclockwise neighbor, Across → opposite. Arrow visuals must match this mental model.

### Testing Standards

- Co-located tests: `*.test.ts` next to `*.vue` / `*.ts`.
- Use `mount()` from `@vue/test-utils` with `setActivePinia(createPinia())`.
- Mock `@vue-dnd-kit/core` in rack-related tests.
- Use `happy-dom` (configured in vite config, not jsdom).
- Test composable behavior directly by calling functions and asserting reactive state.
- Test component rendering with specific prop combinations covering each visual state.
- Test emit payloads match expected action shapes.

### Previous Story Intelligence (3B.3)

- **Agent model:** GPT-5.4 — different LLM than what may run this story.
- **Key learning:** Courtesy submissions use `courtesySubmissionsByPlayerId` internally but expose only `myCourtesySubmission` in the filtered player view. The UI must only use `PlayerCharlestonView` fields.
- **Privacy guarantee:** The UI never sees partner's courtesy count or tile selection before resolution. `COURTESY_PAIR_RESOLVED` resolved action provides narration data (`playerRequests`, `appliedCount`) for post-resolution display.
- **Validated patterns:** validate-then-mutate, server authority, filtered protocol views. The client must NOT reconstruct negotiation from raw state diffs.
- **Review findings addressed:** Runtime schema validation for action payloads, defensive try/catch around WebSocket dispatch — both already shipped. No client-side concern.

### Git Intelligence

Recent commit titles:
```
0bec595 Merge pull request #4 from rmerk/cursor/gds-code-review-5927
ae55952 test(server): bind COURTESY_PASS and CHARLESTON_PASS to session identity
e061f56 test(server): strengthen courtesy no-leak assertions
cf1afeb test(server): cover courtesy-ready reconnect without partner leak
0802a25 fix(server): guard WebSocket sends for action ERROR responses
6d93f6d feat(courtesy-pass): finalize courtesy pass negotiation and enhance validation
```

Takeaways:
- All recent work is shared/server side. This is the first client UI story for Charleston.
- Privacy and no-leak assertions are thorough on the server. The UI layer's job is to consume `PlayerCharlestonView` faithfully and never attempt to display data it shouldn't have.
- Conventional Commits format in use. Follow `feat(charleston):` for new components, `test(client):` for test-only commits.

### Scope Boundaries

This story **does** implement:
- `CharlestonZone`, `CharlestonVote`, `CourtesyPassUI` components
- `useTileSelection` composable (reusable for future call confirmation, Joker exchange)
- TileRack selection mode for multi-tile Charleston selection
- Direction indicator, progress display, Pass/Vote/Courtesy buttons
- Blind pass visual enforcement (hidden tile placeholders)
- Basic tile pass directional animation (400ms)
- Keyboard accessibility for all interactive elements

This story does **not** implement:
- `useGameState` composable or WebSocket wiring (architecture prerequisite — separate story or retro item)
- Sound effects for Charleston (Epic 7)
- Elaborate celebration animations (Epic 7)
- Disconnect grace periods or auto-pass timers (Story 3B.5)
- NMJL card overlay during Charleston (Epic 5B)
- Chat panel or reaction bar (Epic 6A)

## Validation Checklist

- [x] **Composable reuse:** `useTileSelection` has no Charleston-specific logic — it's a generic "select N items" pattern. Future call confirmation and Joker exchange can use it directly.
- [x] **No optimistic updates:** Tiles remain in rack until server confirms pass. Waiting state shown after dispatch.
- [x] **Blind pass enforcement:** Hidden tiles show as `TileBack` placeholders, not real tile data. The UI physically prevents seeing Across tiles before submission.
- [x] **Accessibility:** All buttons keyboard-reachable. Tile selection via Enter/Space. ArrowLeft/ArrowRight navigation. Vote buttons follow ActionZone toolbar pattern.
- [x] **Protocol fidelity:** Components consume only `PlayerCharlestonView` fields. No attempt to access internal engine state or reconstruct hidden data.
- [x] **Scope containment:** No WebSocket wiring, no sound effects, no disconnect handling, no NMJL overlay.
- [x] **DnD preservation:** Rack drag-and-drop sorting works during Charleston tile selection.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3B overview, Story 3B.4 acceptance criteria, TileSelectionAction cross-epic reuse note]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR26 CharlestonZone states, UX-DR29 TileSelectionAction pattern, UX-DR37 no-modal vote, emotional pacing beats, animation timing, button hierarchy]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` — component placement (components/charleston/), useGameState contract, Pinia store separation, no-optimistic-updates rule, protocol message types, resolved action types]
- [Source: `_bmad-output/planning-artifacts/gdd.md` — FR32-FR38 Charleston rules, blind pass enforcement, Joker passing legality, social interaction priority, animation expectations]
- [Source: `_bmad-output/implementation-artifacts/3b-3-courtesy-pass-negotiation.md` — previous story learnings, privacy guarantees, review follow-ups, file targets, execution gate]
- [Source: `packages/shared/src/types/protocol.ts` — PlayerCharlestonView, PublicCharlestonView, StateUpdateMessage, ResolvedAction]
- [Source: `packages/client/src/components/game/GameTable.vue` — current layout structure, ActionZone integration, phase-conditional rendering]
- [Source: `packages/client/src/components/game/TileRack.vue` — DnD setup, selection handling, keyboard navigation, rack store usage]
- [Source: `packages/client/src/components/game/CallButtons.vue` — inline button pattern with BaseButton, ActionZone toolbar integration]
- [Source: `packages/client/src/components/ui/BaseButton.vue` — variant system (primary/secondary/urgent), focus/expose pattern]
- [Source: `packages/client/src/stores/rack.ts` — single-tile selectTile/deselectTile, tileOrder management]
- [Source: `packages/client/src/styles/design-tokens.ts` — gold-accent, timing tokens, shadow system]

## Dev Agent Record

### Agent Model Used

Cursor Agent (GPT-5.2)

### Debug Log References

### Completion Notes List

- Implemented props-driven Charleston UI: `CharlestonZone` (passing), `CourtesyPassUI` (courtesy-ready), `CharlestonVote` in `ActionZone` (vote-ready per AC6).
- `useTileSelection(MaybeRefOrGetter<number>)` drives multi-select; `GameTable` destructures composable refs so child props receive unwrapped `Set` / boolean / string (avoids nested-Ref prop warnings).
- `TileRack` adds `charlestonSelectionMode`, `charlestonToggleTile`, `hiddenPlaceholderCount` for blind-pass `TileBack` placeholders; `Tile` gains `charleston-selected` state.
- Pass pulse: optional `resolvedAction` on `GameTable`; on `CHARLESTON_PHASE_COMPLETE`, rack plays **out** (pass direction) then **in** from the opposite side (keyframes, 400ms each); reduced motion via existing theme tokens.
- Code review (2026-04-03): `charlestonPass` / `courtesyPass` payloads use composable `confirmedIds`; removed unused Charleston emits; `.cursor` claude-mem snapshot reverted as out-of-story scope.

### File List

- packages/client/src/composables/useTileSelection.ts
- packages/client/src/composables/useTileSelection.test.ts
- packages/client/src/components/charleston/CharlestonZone.vue
- packages/client/src/components/charleston/CharlestonZone.test.ts
- packages/client/src/components/charleston/CharlestonVote.vue
- packages/client/src/components/charleston/CharlestonVote.test.ts
- packages/client/src/components/charleston/CourtesyPassUI.vue
- packages/client/src/components/charleston/CourtesyPassUI.test.ts
- packages/client/src/components/game/GameTable.vue
- packages/client/src/components/game/GameTable.test.ts
- packages/client/src/components/game/TileRack.vue
- packages/client/src/components/game/TileRack.test.ts
- packages/client/src/components/tiles/Tile.vue
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/3b-4-charleston-ui-direction-indicator-tileselectionaction-pass-interaction.md

### Change Log

- 2026-04-03: Created Story 3B.4 context with Charleston UI component architecture, TileSelectionAction composable design, protocol type mapping, and blind pass enforcement guidance. All acceptance criteria traced to tasks with co-located test requirements.
- 2026-04-03: Implemented Story 3B.4 — Charleston composable and components, GameTable/TileRack integration, tests, quality gates (`pnpm test`, `pnpm run typecheck`, `vp lint`). Status → review.
- 2026-04-03: GDS code-review fixes — two-phase Charleston rack animation (receive from opposite), `confirmedIds` for pass/courtesy emits, emit contract cleanup, GameTable tests for animation + vote toolbar placement. Status → done.
