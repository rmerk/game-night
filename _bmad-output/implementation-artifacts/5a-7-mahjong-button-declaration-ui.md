# Story 5a.7: Mahjong Button & Declaration UI

Status: done

## Story

As a **player**,
I want **a persistent Mahjong button in a fixed position that I can always tap, triggering auto-validation with clear feedback**,
So that **declaring Mahjong is confident and unmissable — the climactic moment of the game (FR64, UX-DR30)**.

## Acceptance Criteria

1. **AC1 — Always visible:** The Mahjong button is always visible in the action zone regardless of game state (my turn, not my turn, call window open or closed). It is never hidden, never disabled. (FR64)
2. **AC2 — Primary tier styling:** The Mahjong button uses Primary tier: `bg-gold-accent`, dark text (`text-text-primary`), `text-game-critical` sizing (20px semibold). It is the ONE primary-styled button on screen during normal play. (UX-DR30)
3. **AC3 — Call window Mahjong:** When I tap the Mahjong button during an active call window, a `call` event is emitted with `callType: "mahjong"`. This takes priority over all other calls via existing server-side priority resolution.
4. **AC4 — Self-drawn Mahjong:** When I tap the Mahjong button on my turn (before discarding, after drawing), a `declareMahjong` event is emitted for self-drawn Mahjong via `DECLARE_MAHJONG` action.
5. **AC5 — Invalid declaration feedback:** When the server returns an invalid Mahjong result, only I see an inline notification with "Cancel" (withdraws, no penalty via `CANCEL_MAHJONG`) option. Other players see nothing. (FR66, UX-DR35 private-first principle)
6. **AC6 — Action zone coexistence:** The Mahjong button coexists with CallButtons during a call window (CallButtons already includes "Mahjong" when it's a valid call option — the persistent Mahjong button must NOT duplicate it). During non-call-window states, only the Mahjong button and DiscardConfirm (when applicable) are visible.
7. **AC7 — Keyboard accessibility:** Enter or Space activates the button. `aria-label="Declare Mahjong"`. Button meets 44px minimum height. (UX-DR43)

## Tasks / Subtasks

- [x] Task 1: Create `MahjongButton.vue` component (AC: #1, #2, #7)
  - [x] 1.1 Define props: `isCallWindowOpen: boolean` (controls whether click dispatches call vs declare)
  - [x] 1.2 Define emits: `declareMahjong()`, `callMahjong()`
  - [x] 1.3 Apply Primary tier styling: `bg-gold-accent text-text-primary text-game-critical min-h-11 px-6 rounded-md shadow-tile`
  - [x] 1.4 Add `aria-label="Declare Mahjong"` and ensure semantic `<button>` element
  - [x] 1.5 When `isCallWindowOpen` is true AND CallButtons already shows a Mahjong option, hide the persistent button to prevent duplication (use `v-show` or a prop)
- [x] Task 2: Create `MahjongButton.test.ts` with comprehensive test coverage (AC: #1-#4, #6-#7)
  - [x] 2.1 Test always renders (no v-if gating)
  - [x] 2.2 Test Primary tier styling classes
  - [x] 2.3 Test emits `declareMahjong` when clicked and `isCallWindowOpen` is false
  - [x] 2.4 Test emits `callMahjong` when clicked and `isCallWindowOpen` is true
  - [x] 2.5 Test accessibility: aria-label, button semantics, min-height class
  - [x] 2.6 Test hidden when call window includes mahjong in valid calls (no duplication)
- [x] Task 3: Create `InvalidMahjongNotification.vue` component (AC: #5)
  - [x] 3.1 Define props: `visible: boolean`, `message: string`
  - [x] 3.2 Define emits: `cancel()`
  - [x] 3.3 Render inline notification with Cancel button
  - [x] 3.4 Use `aria-live="polite"` for screen reader announcement
  - [x] 3.5 Apply error state styling: `bg-state-error/10 border-state-error text-state-error`
  - [x] 3.6 Add enter/exit transition with `--timing-entrance`/`--timing-exit`
- [x] Task 4: Create `InvalidMahjongNotification.test.ts` (AC: #5)
  - [x] 4.1 Test renders notification text when visible
  - [x] 4.2 Test does not render when not visible
  - [x] 4.3 Test emits `cancel` on Cancel button click
  - [x] 4.4 Test accessibility: aria-live region, button semantics
- [x] Task 5: Integrate into `GameTable.vue` ActionZone (AC: #1, #3, #4, #6)
  - [x] 5.1 Import MahjongButton and InvalidMahjongNotification
  - [x] 5.2 Add `invalidMahjong` prop (or similar) to GameTable for server error feedback
  - [x] 5.3 Add `declareMahjong` and `cancelMahjong` emits to GameTable
  - [x] 5.4 Restructure ActionZone content: MahjongButton is always rendered alongside CallButtons or DiscardConfirm
  - [x] 5.5 When call window is open AND `validCallOptions` includes `"mahjong"`, hide the persistent MahjongButton (CallButtons already renders the Mahjong call button)
  - [x] 5.6 Wire MahjongButton click → appropriate emit based on call window state
  - [x] 5.7 Show InvalidMahjongNotification conditionally, wire cancel emit
- [x] Task 6: Update `GameTable.test.ts` with integration tests (AC: #1, #3, #4, #6)
  - [x] 6.1 Test MahjongButton always renders when no call window
  - [x] 6.2 Test MahjongButton hidden when call window has mahjong in valid calls
  - [x] 6.3 Test MahjongButton visible when call window has NO mahjong in valid calls
  - [x] 6.4 Test declareMahjong event propagation
  - [x] 6.5 Test callMahjong event propagation during call window
  - [x] 6.6 Test InvalidMahjongNotification conditional rendering
- [x] Task 7: Create `MahjongButtonShowcase.vue` dev page
  - [x] 7.1 Scenarios: default state, during call window, after invalid declaration, with DiscardConfirm visible
  - [x] 7.2 Add `/dev/mahjong-button` route in router

## Dev Notes

### Component Architecture

**MahjongButton.vue:**
- Location: `packages/client/src/components/game/MahjongButton.vue`
- Props: `isCallWindowOpen: boolean`, `hideForCallDuplication: boolean`
- Emits: `declareMahjong()`, `callMahjong()`
- Always rendered in ActionZone (no `v-if` removal — use `v-show="!hideForCallDuplication"` to preserve DOM presence)
- Click handler checks `isCallWindowOpen` to determine which emit to fire

**InvalidMahjongNotification.vue:**
- Location: `packages/client/src/components/game/InvalidMahjongNotification.vue`
- Props: `visible: boolean`, `message: string`
- Emits: `cancel()`
- Renders above or within the ActionZone as an inline notification
- Only the declaring player sees this — private-first principle (FR66, UX-DR35)

### ActionZone Layout Restructure (CRITICAL)

The current GameTable ActionZone uses v-if/v-else to toggle between CallButtons and DiscardConfirm. This must be restructured for the always-visible Mahjong button:

**Current structure (GameTable.vue lines 136-154):**
```
<ActionZone>
  <Transition name="call-buttons">
    <CallButtons v-if="isCallWindowOpen" ... />
  </Transition>
  <DiscardConfirm v-if="!isCallWindowOpen" ... />
</ActionZone>
```

**New structure:**
```
<ActionZone>
  <!-- Mahjong button — always visible unless CallButtons already shows Mahjong -->
  <MahjongButton
    v-show="!callWindowHasMahjong"
    :is-call-window-open="isCallWindowOpen"
    :hide-for-call-duplication="callWindowHasMahjong"
    @declare-mahjong="emit('declareMahjong')"
    @call-mahjong="emit('call', 'mahjong')"
  />
  <!-- Call buttons — during call window -->
  <Transition name="call-buttons">
    <CallButtons v-if="isCallWindowOpen" ... />
  </Transition>
  <!-- Discard confirm — outside call window, when tile selected -->
  <DiscardConfirm v-if="!isCallWindowOpen" ... />
  <!-- Invalid mahjong notification -->
  <InvalidMahjongNotification
    :visible="invalidMahjongVisible"
    :message="invalidMahjongMessage"
    @cancel="emit('cancelMahjong')"
  />
</ActionZone>
```

**Key computed:**
```ts
const callWindowHasMahjong = computed(
  () => isCallWindowOpen.value && props.validCallOptions.includes("mahjong")
);
```

This avoids duplicate Mahjong buttons: when CallButtons renders its own Mahjong call button (highest priority in CALL_ORDER), the persistent MahjongButton hides.

### State Separation (CRITICAL — same pattern as 5a-5, 5a-6)

This story uses **mock data** for mahjong state. Real game state integration happens when `useGameState` composable is wired up. For now:
- `MahjongButton` accepts props — no direct game state access
- `GameTable` accepts new props for invalid mahjong feedback
- Emits bubble up — the parent (or future composable) dispatches to the server
- **No optimistic updates (HARD RULE):** The button emits events. Server confirms validity. Only then does the UI react.

### Shared Types to Import

From `@mahjong-game/shared`:
- `CallType` — already imported in GameTable
- `DeclareMahjongAction` — `{ type: "DECLARE_MAHJONG", playerId: string }`
- `CancelMahjongAction` — `{ type: "CANCEL_MAHJONG", playerId: string }`
- `CallMahjongAction` — `{ type: "CALL_MAHJONG", playerId: string, tileIds: string[] }`

Note: The component layer only emits events. Action construction happens in the parent/composable layer.

### Design Tokens to Use

| Purpose | Token/Class |
|---------|-------------|
| Mahjong button background | `bg-gold-accent` (Primary tier — same as DiscardConfirm) |
| Mahjong button hover | `hover:bg-gold-accent-hover` |
| Mahjong button text | `text-text-primary text-game-critical` (20px semibold) |
| Button min height | `min-h-11` (44px min tap target) |
| Button padding | `px-6` horizontal |
| Button border radius | `rounded-md` (8px) |
| Button shadow | `shadow-tile` |
| Focus ring | `focus-visible:focus-ring-on-felt` |
| Error notification bg | `bg-state-error/10` (10% opacity error background) |
| Error notification border | `border border-state-error` |
| Error notification text | `text-state-error` |
| Entrance animation | `--timing-entrance` (200ms) |
| Exit animation | `--timing-exit` (150ms) |

### Reuse Existing Code — Do NOT Reinvent

- **`ActionZone.vue`** — existing fixed-size slot container. MahjongButton renders inside it alongside other action components
- **`CallButtons.vue`** — already handles Mahjong as a call option (`CALL_ORDER[0] === "mahjong"`). When `validCalls` includes `"mahjong"`, CallButtons renders it with Urgent tier styling. The persistent MahjongButton MUST hide in this case to avoid duplication
- **`DiscardConfirm.vue`** — coexists with MahjongButton in non-call-window states. DiscardConfirm shows conditionally (tile selected + player turn), MahjongButton always shows
- **`useRackStore`** — already used by GameTable. Not directly used by MahjongButton

### Responsive Layout

The Mahjong button should render in the ActionZone's flex layout. Since the ActionZone is `flex items-center justify-center`, the MahjongButton will naturally center. When coexisting with DiscardConfirm, both buttons share the horizontal flex space with `gap-2`.

**Desktop/Tablet:** Buttons side by side in flex row
**Phone:** Same layout — Mahjong button and DiscardConfirm are both single buttons, no grid needed

### Accessibility Requirements

1. **Semantic HTML:** `<button>` element with `aria-label="Declare Mahjong"`
2. **Keyboard:** Native `<button>` handles Enter/Space → click automatically. Do NOT add `@keydown` handlers (lesson from 5a-5 double-fire bug)
3. **Focus ring:** `focus-visible:focus-ring-on-felt` (buttons sit over felt background)
4. **Invalid notification:** `aria-live="polite"` so screen readers announce the error without interrupting
5. **Button labels:** `text-game-critical` (20px semibold) for readability by target demographic (40-70+)

### Anti-Patterns to Avoid

- **NO optimistic Mahjong state updates** — emit the event, wait for server response
- **NO raw hex colors** — use UnoCSS theme tokens
- **NO hardcoded transition durations** — use `--timing-entrance`/`--timing-exit` CSS custom properties
- **NO `v-html`** anywhere
- **NO Options API** — `<script setup lang="ts">` only
- **NO barrel imports** within the client package — use specific file imports
- **NO `setTimeout` for animations** — use CSS transitions/keyframes or `<Transition>`
- **NO game state in Pinia** — mahjong state comes from props (future: `useGameState` inject)
- **NO redundant keyboard handlers on `<button>` elements** — native buttons handle Enter/Space via click event (5a-5 keyboard double-fire bug)
- **NO disabled Mahjong button** — FR64 says always clickable. Server validates; UI doesn't gatekeep
- **NO duplicate Mahjong buttons** — when CallButtons shows Mahjong call option, hide the persistent one

### Project Structure Notes

- New files in `packages/client/src/components/game/` (consistent with CallButtons, DiscardConfirm, ActionZone)
- Dev showcase in `packages/client/src/components/dev/` (consistent with CallButtonsShowcase, DiscardShowcase)
- Route added in `packages/client/src/router/index.ts` under DEV-only `/dev/mahjong-button` path
- Tests co-located: `MahjongButton.test.ts` next to `MahjongButton.vue`

### Previous Story Intelligence (5a-6)

Key learnings from Story 5a-6 that directly apply:

1. **Native `<button>` keyboard handling:** Do NOT add `@keydown.enter` or `@keydown.space` handlers. Native `<button>` elements automatically convert these to click events. Adding both causes double-fire.
2. **Exit animation bug:** In 5a-6, the `<Transition>` wrapper was initially inside CallButtons but needed to be in GameTable so the leave animation fires when the parent unmounts the component. Apply the same pattern for any transition on MahjongButton visibility.
3. **ActionZone is a slot container:** Fixed 80px height (`min-h-20 h-20`), `role="toolbar"`, `aria-label="Game actions"`. Components render inside its slot.
4. **GameTable integration pattern:** New action components render inside ActionZone. GameTable handles prop drilling and event bubbling.
5. **Test patterns:** `mount()` with `data-testid` queries, `setActivePinia(createPinia())` in `beforeEach`, mock `@vue-dnd-kit/core` when TileRack is in component tree (GameTable tests).
6. **Dev showcase pattern:** Create showcase with multiple scenarios, add DEV-only route.
7. **CallButtons already handles Mahjong:** `CALL_ORDER[0] === "mahjong"` — it renders first. The persistent MahjongButton must not duplicate this.

### Git Intelligence

Recent commits show consistent patterns:
- `feat(client): ...` prefix for new components
- `fix(ComponentName): ...` prefix for bug fixes
- Components, tests, and showcases delivered together
- Integration tests added to existing test files (e.g., GameTable.test.ts)

### Cross-Session Intelligence

From claude-mem observations:
- **Keyboard double-fire bug (#67):** Native HTML button elements auto-convert Enter/Space to click events. Always rely on native `<button>` click behavior only.
- **Pre-existing test failures (#65):** 4 theme test failures in client are known and expected. Do not treat as regressions.
- **Exit animation fix (5a-6 change log):** `<Transition>` must wrap the conditional parent, not live inside the conditionally rendered component — otherwise leave animations never fire.
- **Mock CallWindowState (#78):** Must include `winningCall: null` field.
- **Code review pattern (#63):** After implementation, code review validates story completion by running full test suite and checking file lists.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5A, Story 5A.7]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Action/State Protocol, Component Structure]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR13, UX-DR30, UX-DR35, UX-DR43]
- [Source: packages/shared/src/types/actions.ts — DeclareMahjongAction, CallMahjongAction, CancelMahjongAction]
- [Source: packages/shared/src/types/game-state.ts — CallType, CallWindowState]
- [Source: packages/client/src/components/game/GameTable.vue — integration target, current ActionZone structure]
- [Source: packages/client/src/components/game/CallButtons.vue — existing Mahjong call handling, CALL_ORDER]
- [Source: packages/client/src/components/game/ActionZone.vue — slot container]
- [Source: packages/client/src/components/game/DiscardConfirm.vue — coexisting Primary tier button]
- [Source: _bmad-output/implementation-artifacts/5a-6-action-zone-call-buttons.md — previous story learnings]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `vp test run src/components/game/MahjongButton.test.ts`
- `vp test run src/components/game/InvalidMahjongNotification.test.ts`
- `vp test run src/components/game/GameTable.test.ts`
- `vp test run src/components/game/MahjongButton.test.ts src/components/game/InvalidMahjongNotification.test.ts src/components/game/GameTable.test.ts`
- `vp test run src/components/game/MahjongButton.test.ts src/components/game/GameTable.test.ts`
- `vp test run src/components/game/MahjongButton.test.ts src/components/game/InvalidMahjongNotification.test.ts src/components/game/GameTable.test.ts` (post-review fixes)
- `pnpm test`
- `pnpm run typecheck`
- `pnpm lint` (repo has pre-existing warning-only baseline in `shared`, `client`, and `server`)
### Completion Notes List

- Implemented persistent `MahjongButton` with Primary tier styling, native button accessibility, and prop-driven `declareMahjong` vs `callMahjong` event dispatch.
- Added `InvalidMahjongNotification` with private inline feedback styling, polite live-region announcement, cancel affordance, and CSS transition timing based on design tokens.
- Restructured `GameTable` ActionZone so Mahjong is always rendered, hides only when `CallButtons` already includes Mahjong, re-emits `declareMahjong`/`cancelMahjong`, and surfaces invalid Mahjong feedback from props.
- Added component and integration coverage for render rules, event propagation, duplication hiding, and invalid-feedback rendering.
- Added `MahjongButtonShowcase` dev page with default, call-window, invalid-declaration, and discard-confirm scenarios plus `/dev/mahjong-button` registration.
- Fixed code review findings by making the Mahjong button aria-label reflect declare vs call behavior, adding `cancelMahjong` integration coverage in `GameTable`, and allowing the ActionZone to expand for stacked invalid-notification content.
### File List

- `_bmad-output/implementation-artifacts/5a-7-mahjong-button-declaration-ui.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/client/src/components/dev/MahjongButtonShowcase.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/InvalidMahjongNotification.test.ts`
- `packages/client/src/components/game/InvalidMahjongNotification.vue`
- `packages/client/src/components/game/MahjongButton.test.ts`
- `packages/client/src/components/game/MahjongButton.vue`
- `packages/client/src/dev-showcase-routes.ts`

### Change Log

- 2026-03-31: Implemented persistent Mahjong declaration UI, invalid Mahjong feedback, GameTable ActionZone integration, coverage updates, and dev showcase route.
- 2026-03-31: Resolved code review findings for Mahjong action labeling, invalid-notification layout resilience, and cancel-event integration coverage.

### Status

done
