# Story 5a.6: Action Zone & Call Buttons

Status: review

## Story

As a **player**,
I want **call buttons to appear instantly in a fixed position during the call window, showing only my valid call options**,
So that **I can react quickly during the 3-5 second window without hunting for buttons (FR30, UX-DR22, UX-DR30)**.

## Acceptance Criteria

1. **AC1 — Valid-only call buttons:** When a tile is discarded by another player and a call window opens, only valid call buttons appear (e.g., "Pung" if I can Pung, "Mahjong" if applicable). No grayed-out buttons for invalid calls. A "Pass" button is always shown. (UX-DR22, UX-DR30)
2. **AC2 — Pass-only fallback:** When I have no valid calls and the call window opens, only the "Pass" button appears in the action zone.
3. **AC3 — Fixed action zone dimensions:** The action zone maintains a FIXED height (80px) and width regardless of how many buttons are displayed. Buttons center within the zone. The zone never resizes or repositions. (UX-DR13)
4. **AC4 — Urgent tier styling for call buttons:** Call buttons (Pung, Kong, Quint) use the Urgent tier: `state-call-window` fill (#D4A843), white text, `text-game-critical` sizing (20px semibold). Pass uses Secondary tier: chrome fill, border. (UX-DR30)
5. **AC5 — Mobile grid layout:** On phone viewport (<768px) with 4+ call options simultaneously, buttons stack in a 2x2 grid within the fixed action zone. (UX-DR14)
6. **AC6 — Accessibility:** `aria-live="assertive"` announces the call window. Auto-focus moves to the first call button for keyboard users. All buttons meet 44px minimum height. (UX-DR22)
7. **AC7 — Exit animation:** When the call window closes (all pass, timer expires, or call resolved), buttons exit with `--timing-exit` (150ms, ease-in) and the action zone returns to its default state (currently showing DiscardConfirm when applicable).

## Tasks / Subtasks

- [x] Task 1: Create `CallButtons.vue` component (AC: #1, #2, #4, #5, #6)
  - [x] 1.1 Define props interface accepting call options array and emitting call/pass actions
  - [x] 1.2 Render only valid call buttons + always-present Pass button
  - [x] 1.3 Apply Urgent tier styling for call buttons, Secondary tier for Pass
  - [x] 1.4 Implement responsive 2x2 grid layout for mobile (<768px) with 4+ buttons
  - [x] 1.5 Add `aria-live="assertive"` region and auto-focus to first call button
  - [x] 1.6 Implement exit animation with `--timing-exit` (150ms)
- [x] Task 2: Create `CallButtons.test.ts` with comprehensive test coverage (AC: #1-#7)
  - [x] 2.1 Test valid-only rendering (no grayed-out buttons)
  - [x] 2.2 Test pass-only fallback when no valid calls
  - [x] 2.3 Test event emission for each call type and pass
  - [x] 2.4 Test accessibility: aria-live, button semantics, min-height
  - [x] 2.5 Test exit animation class application
- [x] Task 3: Integrate `CallButtons.vue` into `GameTable.vue` ActionZone (AC: #3, #7)
  - [x] 3.1 Add `callWindow` prop to GameTable (typed as `CallWindowState | null`)
  - [x] 3.2 Add `validCallOptions` prop (typed as `CallType[]`)
  - [x] 3.3 Conditionally render CallButtons vs DiscardConfirm based on call window state
  - [x] 3.4 Wire call/pass emit events through GameTable
- [x] Task 4: Update `GameTable.test.ts` with integration tests (AC: #3, #7)
  - [x] 4.1 Test CallButtons renders when callWindow is open
  - [x] 4.2 Test DiscardConfirm renders when callWindow is null
  - [x] 4.3 Test call/pass events propagate through GameTable
- [x] Task 5: Create `CallButtonsShowcase.vue` dev page (or extend existing showcase)
  - [x] 5.1 Showcase scenarios: single call, multiple calls, pass-only, all call types, mobile grid
  - [x] 5.2 Add `/dev/call-buttons` route

## Dev Notes

### Component Architecture

**CallButtons.vue:**
- Location: `packages/client/src/components/game/CallButtons.vue`
- Props: `validCalls: CallType[]`, `callWindowStatus: "open" | "frozen" | "confirming"`
- Emits: `call(callType: CallType)`, `pass()`
- Renders inside `ActionZone`'s slot (sibling to DiscardConfirm — only one is visible at a time)
- The ActionZone is already a fixed 80px height toolbar with `role="toolbar"`
- Only renders when `callWindowStatus === "open"` — frozen/confirming states are future stories or handled by server state transitions

**Call type display labels:**

| CallType | Button Label | Notes |
|----------|-------------|-------|
| `"pung"` | "Pung" | 3 of a kind |
| `"kong"` | "Kong" | 4 of a kind |
| `"quint"` | "Quint" | 5 of a kind |
| `"news"` | "NEWS" | One of each wind |
| `"dragon_set"` | "Dragons" | One of each dragon |
| `"mahjong"` | "Mahjong" | Highest priority call |

**Rendering logic:**
- Iterate `validCalls` array to render Urgent-tier buttons
- Always append a Pass button (Secondary tier)
- If `validCalls.length === 0`, render Pass button only
- Button order: Mahjong first (if present), then Pung/Kong/Quint/NEWS/Dragons, then Pass last

### State Separation (CRITICAL — same pattern as 5a-5)

This story uses **mock data** for call window state. Real game state integration happens when `useGameState` composable is wired up. For now:
- `CallButtons` accepts `validCalls: CallType[]` and `callWindowStatus` as props
- `GameTable` accepts `callWindow: CallWindowState | null` and `validCallOptions: CallType[]` as props
- `GameTable` conditionally renders `CallButtons` (when `callWindow !== null && callWindow.status === "open"`) or `DiscardConfirm` (when no call window)
- Call/pass emits bubble up — the parent (or future composable) dispatches to the server

**No optimistic updates (HARD RULE):** The component is a pure renderer of server state. When a player clicks "Pung", we emit the event. The call window state change (open → frozen) comes from the server's next `STATE_UPDATE`. Do NOT locally mutate call window state.

### Shared Types to Import

From `@mahjong-game/shared`:
- `CallType` — `"pung" | "kong" | "quint" | "news" | "dragon_set" | "mahjong"`
- `CallWindowState` — `{ status: "open" | "frozen" | "confirming", discardedTile: Tile, ... }`

These types are already exported from the shared barrel (`packages/shared/src/index.ts`).

### Design Tokens to Use

| Purpose | Token/Class |
|---------|-------------|
| Call button background | `bg-state-call-window` (#D4A843) |
| Call button text | `text-white text-game-critical` (20px semibold) |
| Call button hover | Consider `hover:brightness-110` or `hover:opacity-90` (no explicit hover token for call-window — use subtle brightness shift) |
| Pass button background | `bg-chrome-surface` with `border border-chrome-border` |
| Pass button text | `text-text-primary text-interactive` (18px semibold) |
| Button min height | `min-h-11` (44px min tap target) |
| Button padding | `px-6` horizontal, inherits min-h for vertical |
| Button border radius | `rounded-md` (8px) |
| Button shadow | `shadow-tile` |
| Focus ring | `focus-ring-on-felt` (buttons sit over felt background) |
| Exit animation | `--timing-exit` (150ms) with ease-in |
| Button gap | `gap-2` (8px minimum between adjacent buttons — prevents mis-taps) |

### Reuse Existing Code — Do NOT Reinvent

- **`ActionZone.vue`** — already exists as a fixed-size slot container with `role="toolbar"` and `aria-label="Game actions"`. `CallButtons` renders inside its slot — do NOT create a new container
- **`DiscardConfirm.vue`** — already renders inside ActionZone. The GameTable must conditionally show CallButtons OR DiscardConfirm, never both simultaneously
- **`Tile.vue`** — NOT needed in this story (call buttons are text buttons, not tile renderers)
- **`useRackStore`** — NOT directly used by CallButtons (selection state is irrelevant during call window). But GameTable already uses it — ensure deselection happens when call window opens (tile selection is only valid during discard phase)

### Responsive Layout

**Desktop/Tablet (md: ≥768px):**
- Buttons render in a horizontal `flex` row, centered in the ActionZone
- `flex-wrap: wrap` with `gap-2` handles overflow gracefully

**Phone (<768px):**
- When 4+ buttons are present (e.g., Pung + Kong + Mahjong + Pass): use `grid grid-cols-2` for 2x2 layout
- When 1-3 buttons: horizontal flex row (same as desktop)
- Detection: computed based on `validCalls.length >= 3` (3 calls + Pass = 4 buttons total)

### Accessibility Requirements

1. **`aria-live="assertive"` region:** Wrap the CallButtons output in a `div[aria-live="assertive"]` so screen readers announce when call buttons appear
2. **Auto-focus:** When call buttons appear, programmatically focus the first call button (or Mahjong if present). Use `nextTick()` + `ref.value?.focus()` pattern
3. **Keyboard navigation:** Arrow keys between buttons are handled natively by the browser for `role="toolbar"` containers when buttons are `<button>` elements. No custom keyboard handler needed (lesson from 5a-5: native `<button>` handles Enter/Space automatically)
4. **Semantic HTML:** All buttons are `<button>` elements with descriptive `aria-label` (e.g., `aria-label="Call Pung"`, `aria-label="Pass on call"`)
5. **Button labels:** Use `text-game-critical` (20px semibold) for readability by the target demographic (40-70+)

### Exit Animation

When `callWindow` transitions from non-null to null (or status changes from "open"):
- Apply a CSS exit transition: `opacity 0` + `transform: scale(0.95)` over `--timing-exit` (150ms)
- Use a `v-if` with a `<Transition>` wrapper or Motion for Vue `<motion />` component
- The ActionZone container itself never animates — only the button content within it

### Anti-Patterns to Avoid

- **NO optimistic call window state updates** — component is a pure renderer of server state
- **NO raw hex colors** — use UnoCSS theme tokens (`bg-state-call-window`, not `bg-[#D4A843]`)
- **NO hardcoded transition durations** — use `--timing-exit` CSS custom property
- **NO `v-html`** anywhere
- **NO Options API** — `<script setup lang="ts">` only
- **NO barrel imports** within the client package
- **NO `setTimeout` for animations** — use CSS transitions/keyframes or `<Transition>`
- **NO game state in Pinia** — call window state comes from props (future: `useGameState` inject)
- **NO redundant keyboard handlers on `<button>` elements** — native buttons handle Enter/Space via click event (learned from 5a-5 code review: explicit `@keydown.enter`/`@keydown.space` causes double-fire)
- **NO disabled/grayed-out buttons** — only render valid call options. If a player can't call, they only see Pass
- **NO custom focus management beyond auto-focus** — `role="toolbar"` with native `<button>` children handles Tab/arrow key navigation

### Project Structure Notes

- New files go in `packages/client/src/components/game/` (consistent with DiscardPool, DiscardConfirm, ActionZone)
- Dev showcase goes in `packages/client/src/components/dev/` (consistent with DiscardShowcase, RackShowcase)
- Route added in `packages/client/src/router/index.ts` under DEV-only `/dev/call-buttons` path
- Tests co-located: `CallButtons.test.ts` next to `CallButtons.vue`

### Previous Story Intelligence (5a-5)

Key learnings from Story 5a-5 that directly apply:

1. **Native `<button>` keyboard handling:** Do NOT add `@keydown.enter` or `@keydown.space` handlers. Native `<button>` elements automatically convert these to click events. Adding both causes double-fire. This was caught in code review and fixed.
2. **ActionZone is a slot container:** `ActionZone.vue` is a simple `div[role="toolbar"]` with a `<slot />`. Components render inside it. The zone is fixed at 80px height (`min-h-20 h-20`).
3. **Discard confirm pattern:** `DiscardConfirm.vue` renders conditionally with `v-if` based on `selectedTileId !== null && isPlayerTurn`. CallButtons should follow the same conditional pattern but gated on `callWindow !== null`.
4. **GameTable integration pattern:** New action components render inside the `<ActionZone>` slot in GameTable. The GameTable component handles prop drilling and event bubbling.
5. **Test patterns:** Use `mount()` with `data-testid` queries. Set up Pinia in `beforeEach`. Mock `@vue-dnd-kit/core` when TileRack is in the component tree. Check rendered output and emitted events (blackbox testing).
6. **Dev showcase pattern:** Create a showcase component with multiple scenarios, add a DEV-only route in router.
7. **Gold accent button styling:** `bg-gold-accent text-text-primary text-game-critical min-h-11 px-6 rounded-md shadow-tile` — established in DiscardConfirm. Call buttons use a different tier (Urgent = call-window fill + white text) but same size/shape tokens.

### Git Intelligence

Recent commits show consistent patterns:
- `feat(client): ...` prefix for new components
- Components, tests, and showcases delivered together
- Integration tests added to existing test files (e.g., GameTable.test.ts)

### Cross-Session Intelligence

From claude-mem observations:
- **Keyboard double-fire bug (#67):** Native HTML button elements automatically convert Enter and Space keypresses into click events. Adding both `@keydown` and `@click` handlers causes double-firing. Always rely on native `<button>` click behavior.
- **Test validation (#65):** Pre-existing theme test failures (4 in client) are known and expected. Do not treat them as regressions.
- **Code review pattern (#63):** After implementation, the code review workflow validates story completion claims by running the full test suite and checking file lists match.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5A, Story 5A.6]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Call Window Flow, Component Structure, Action Dispatch]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR13, UX-DR22, UX-DR30, UX-DR14]
- [Source: packages/shared/src/types/game-state.ts — CallType, CallWindowState, CallRecord]
- [Source: packages/shared/src/engine/actions/call-window.ts — getValidCallOptions()]
- [Source: packages/client/src/components/game/ActionZone.vue — existing slot container]
- [Source: packages/client/src/components/game/GameTable.vue — integration target]
- [Source: _bmad-output/implementation-artifacts/5a-5-discard-pool-two-step-discard-interaction.md — previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Typecheck revealed missing `winningCall` property on `CallWindowState` mock in GameTable tests — fixed immediately
- Pre-existing 4 theme.test.ts failures confirmed as known baseline (cross-session intelligence #65)

### Completion Notes List

- Created `CallButtons.vue` with TDD approach: 21 unit tests written first, then component implementation
- Component renders only valid call buttons + always-present Pass, ordered Mahjong-first
- Urgent tier styling (gold bg, white text) for call buttons, Secondary tier (chrome bg, border) for Pass
- Responsive 2x2 grid on mobile (<768px) when 4+ buttons via `max-md:grid max-md:grid-cols-2`
- `aria-live="assertive"` region wraps all buttons, auto-focus on first button via `nextTick`
- CSS exit animation using `<Transition>` with `--timing-exit` custom property (150ms, ease-in)
- GameTable conditionally renders CallButtons (callWindow open) vs DiscardConfirm (no call window)
- 5 new GameTable integration tests verify conditional rendering and event propagation
- Dev showcase at `/dev/call-buttons` with 6 interactive scenarios
- No native button keyboard handlers added (lesson from 5a-5 double-fire bug)
- All 48 component tests pass (21 CallButtons + 27 GameTable), 0 regressions

### Change Log

- Story 5a-6 implementation complete (Date: 2026-03-30)

### File List

- packages/client/src/components/game/CallButtons.vue (new)
- packages/client/src/components/game/CallButtons.test.ts (new)
- packages/client/src/components/game/GameTable.vue (modified)
- packages/client/src/components/game/GameTable.test.ts (modified)
- packages/client/src/components/dev/CallButtonsShowcase.vue (new)
- packages/client/src/router/index.ts (modified)
