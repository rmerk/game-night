# Story 5B.6: Settings Panel & Dealing Style Options

Status: done

## Story

As a **host player**,
I want **a settings panel accessible between games where I can configure timer, Joker rules, dealing style, and hand guidance**,
So that **I can customize the game for my group's preferences (FR4, FR11)**.

## Acceptance Criteria

1. **Given** the settings panel **When** the host opens it between games **Then** it displays configurable options: timer mode (15/20/25/30 seconds or no timer), Joker rules (standard or simplified), dealing style (instant or animated traditional), and hand guidance toggle (on/off for all players)

2. **Given** the animated traditional dealing option (FR11) **When** selected and a new game starts **Then** a visual wall-building animation, dice roll to determine break point, and tiles dealt in groups plays before racks populate — faithful to the physical ritual

3. **Given** any player (not just the host) **When** wanting to view current settings **Then** a collapsible settings summary is accessible showing all active game settings (FR6)

4. **Given** the settings panel component **When** building UI elements **Then** BaseToggle and BaseNumberStepper primitives are extracted if not already available — these are the first consumers requiring toggle and stepper components

## Tasks / Subtasks

- [x] Task 1: Extract BaseToggle primitive component (AC: 4)
  - [x] 1.1 Create `packages/client/src/components/ui/BaseToggle.vue` — binary on/off switch with `modelValue: boolean`, label slot, disabled state
  - [x] 1.2 Style with UnoCSS: 44px min-height, `gold-accent` filled color, `focus-ring-on-chrome` for keyboard focus
  - [x] 1.3 ARIA: `role="switch"`, `aria-checked`, `aria-label` prop
  - [x] 1.4 Unit tests: `BaseToggle.test.ts` — renders, toggles on click, emits `update:modelValue`, disabled state, keyboard Enter/Space

- [x] Task 2: Extract BaseNumberStepper primitive component (AC: 4)
  - [x] 2.1 Create `packages/client/src/components/ui/BaseNumberStepper.vue` — increment/decrement with `modelValue: number`, `min`, `max`, `step` props, label slot
  - [x] 2.2 Style: 44px min-height buttons, `gold-accent` highlight, `text-interactive` (18px min) for labels
  - [x] 2.3 ARIA: `role="spinbutton"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
  - [x] 2.4 Unit tests: `BaseNumberStepper.test.ts` — renders value, increments, decrements, clamps to min/max, disabled state, keyboard arrows

- [x] Task 3: Add "settings" to SlideInPanel infrastructure (AC: 1)
  - [x] 3.1 Extend `SlideInPanelId` in `stores/slideInPanel.ts`: add `"settings"` to union type
  - [x] 3.2 Add `openSettings()`, `toggleSettings()` methods mirroring `openChat()`/`toggleChat()`
  - [x] 3.3 Add `SLIDE_IN_SETTINGS_PANEL_ROOT_ID` to `slideInPanelIds.ts`
  - [x] 3.4 Update `SlideInReferencePanels.vue`: add third `<SlideInPanel>` for settings with `contentId` and `open` binding
  - [x] 3.5 Add settings toggle button to bottom bar (mobile) and game chrome (desktop) — gear icon
  - [x] 3.6 Unit tests for store: `toggleSettings()` opens/closes, opening settings closes chat/nmjl

- [x] Task 4: Refactor RoomSettingsPanel to use new primitives (AC: 1, 3)
  - [x] 4.1 Replace `<select>` for Joker rules with `<BaseToggle>` (standard vs simplified)
  - [x] 4.2 Replace `<select>` for hand guidance with `<BaseToggle>` (on vs off)
  - [x] 4.3 Replace `<input type="number">` for turn duration with `<BaseNumberStepper>` (min=15, max=30, step=5)
  - [x] 4.4 Replace `<select>` for timer mode with `<BaseToggle>` (timed vs none) — conditionally show stepper
  - [x] 4.5 Keep `<select>` for dealing style (two distinct labeled options: "Instant" / "Animated traditional") OR convert to `<BaseToggle>` if binary toggle fits
  - [x] 4.6 Host vs viewer split: host sees editable controls, non-host sees read-only summary values
  - [x] 4.7 Keep existing `emit('change', patch)` pattern — server remains authoritative
  - [x] 4.8 Remove `<details>` wrapper — panel now lives inside SlideInPanel
  - [x] 4.9 Update existing `RoomSettingsPanel.test.ts` for new primitive usage

- [x] Task 5: Wire settings panel into GameTable and RoomView (AC: 1, 3)
  - [x] 5.1 In `GameTable.vue`: remove the absolute-positioned `<RoomSettingsPanel>` (line ~931-937) — it now lives in SlideInReferencePanels
  - [x] 5.2 Pass `roomSettings`, `canEditRoomSettings`, `gamePhase` as props to `SlideInReferencePanels` (or provide via inject)
  - [x] 5.3 In `RoomView.vue` lobby: keep inline `<RoomSettingsPanel>` for lobby state (lobby has no SlideInPanel chrome)
  - [x] 5.4 Wire `@change` from settings panel through to `conn.sendSetRoomSettings()`
  - [x] 5.5 Ensure settings panel closes when game phase transitions to play/charleston (not editable)

- [x] Task 6: Animated traditional dealing sequence (AC: 2)
  - [x] 6.1 Create `packages/client/src/components/game/DealingAnimation.vue` — full-table overlay that plays dealing animation
  - [x] 6.2 Wall-building phase: render 152 tile backs in rectangular wall formation using CSS grid/flex, stagger entrance with `timing-expressive` (400ms)
  - [x] 6.3 Dice roll phase: animate two dice showing random roll → break point calculation (use simple CSS transform rotate + settle)
  - [x] 6.4 Dealing phase: tiles move from wall to player positions in groups — 4 rounds of 3 tiles each to E/S/W/N, then 1 each + 1 extra to East
  - [x] 6.5 Completion: emit `done` event, parent transitions to normal rack view
  - [x] 6.6 Respect `prefers-reduced-motion`: skip to instant deal if OS preference set
  - [x] 6.7 Total animation duration ~3-5 seconds; use `timing-expressive` and `ease-expressive` tokens
  - [x] 6.8 In `GameTable.vue`: show `<DealingAnimation>` when `gamePhase === 'play'` AND `dealingStyle === 'animated'` AND game just started (first turn, no discards yet)
  - [x] 6.9 Unit tests: `DealingAnimation.test.ts` — renders, emits `done` on completion, respects reduced-motion

- [x] Task 7: Integration testing (AC: 1-4)
  - [x] 7.1 BaseToggle renders and emits correctly in settings context
  - [x] 7.2 BaseNumberStepper clamps values and emits patches
  - [x] 7.3 SlideInPanel settings opens/closes, mutually exclusive with chat/nmjl
  - [x] 7.4 Host can edit settings, non-host sees read-only summary
  - [x] 7.5 Settings locked during play (controls disabled, locked message shown)
  - [x] 7.6 ROOM_SETTINGS_CHANGED toast fires for other players
  - [x] 7.7 DealingAnimation plays when animated dealing selected

- [x] Task 8: Backpressure gate
  - [x] 8.1 `pnpm test && pnpm run typecheck && vp lint` passes

## Dev Notes

### Existing Infrastructure — DO NOT Reinvent

The settings system is **already built** from Story 4B.7. The dev agent must extend, not replace:

| Layer | What Exists | File |
|-------|-------------|------|
| Types | `RoomSettings`, `DealingStyle`, `TimerMode` | `packages/shared/src/types/room-settings.ts` |
| Defaults | `DEFAULT_ROOM_SETTINGS` (dealingStyle: "instant") | `packages/shared/src/types/room-settings.ts` |
| Server validation | `mergeRoomSettings()`, `applyRoomSettingsUpdate()` | `packages/server/src/rooms/room-settings.ts` |
| Server handler | `handleSetRoomSettings()` — host check + between-games check | `packages/server/src/websocket/join-handler.ts:84-100` |
| Protocol | `SetRoomSettingsMessage` (client→server partial patch) | `packages/shared/src/types/protocol.ts:62-70` |
| Resolved action | `ROOM_SETTINGS_CHANGED` with `changedKeys`, `previous`, `next` | `packages/shared/src/types/game-state.ts:456-462` |
| Client sender | `sendSetRoomSettings(patch)` | `packages/client/src/composables/useRoomConnection.ts:179-181` |
| Toast copy | `toastCopyRoomSettingsChanged(ra)` | `packages/client/src/composables/resolvedActionToastCopy.ts` |
| Formatters | `humanLabel()`, `humanValue()`, `canEditRoomSettings()` | `packages/client/src/composables/roomSettingsFormatters.ts` |
| UI component | `RoomSettingsPanel.vue` — `<details>` collapsible, native selects/inputs | `packages/client/src/components/game/RoomSettingsPanel.vue` |

### Current RoomSettingsPanel Placement

- **GameTable.vue:931-937** — absolute positioned `left-2 top-14 z-40`, shows during in-game phases
- **RoomView.vue:624-629** — inline in lobby view
- Both pass `settings`, `canEdit`, `phase` props and wire `@change` to `sendSetRoomSettings`

### SlideInPanel Architecture

The SlideInPanel system uses a **Pinia store** (`stores/slideInPanel.ts`) with a single `activePanel` ref. Only one panel can be open at a time. Current panel IDs: `"chat" | "nmjl"`.

**Key files to extend:**
- `stores/slideInPanel.ts` — add `"settings"` to `SlideInPanelId` union, add `openSettings()`/`toggleSettings()`
- `components/chat/slideInPanelIds.ts` — add `SLIDE_IN_SETTINGS_PANEL_ROOT_ID`
- `components/chat/SlideInReferencePanels.vue` — add third `<SlideInPanel>` with settings content

**SlideInPanel props:** `open`, `label`, `contentId`, `closeOnBackdrop?` (default true), `mobilePlacement?` ("bottom" default)

### Design System Tokens

- **Animation:** `--timing-tactile: 120ms` (panel open/close), `--timing-expressive: 400ms` (dealing animation)
- **Color:** `gold-accent` (~#C4A35A) for interactive highlights, `chrome-surface` for panel background
- **Typography:** Interactive labels 18px min, semibold 600-700 weight
- **Sizing:** 44px min-height for all interactive elements
- **Focus:** `focus-ring-on-chrome` for keyboard focus on chrome surfaces

### BaseToggle Spec

- Binary switch: on/off (or two labeled options)
- Props: `modelValue: boolean`, `disabled?: boolean`, `label?: string`
- 44px min-height, `gold-accent` fill when on, `chrome-border` when off
- `role="switch"`, `aria-checked="true|false"`
- Keyboard: Enter/Space to toggle

### BaseNumberStepper Spec

- Increment/decrement with constrained range
- Props: `modelValue: number`, `min: number`, `max: number`, `step?: number` (default 1), `disabled?: boolean`, `label?: string`
- `role="spinbutton"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Keyboard: ArrowUp/ArrowDown to increment/decrement
- Display current value between - and + buttons

### Animated Dealing Sequence

**Instant dealing (current default):** Tiles appear in racks immediately after game start. No animation needed.

**Animated traditional (new):** Client-only visual overlay on game start:
1. **Wall building** (~1s): 152 tile-backs animate into rectangular wall formation
2. **Dice roll** (~0.8s): Two dice roll → show break point
3. **Dealing** (~2s): Tiles fly from wall to player positions in correct mahjong order:
   - 4 rounds: 3 tiles each to E→S→W→N
   - 1 round: 1 tile each to E→S→W→N + 1 extra to East (14 total for East, 13 others)
4. **Reveal** (~0.5s): Tiles flip face-up in player's rack with cascading stagger

**Important:** This is a **client-only visual effect**. The server deals instantly regardless. The animation plays while the client already has the dealt tiles in state — it's purely cosmetic, delaying rack display until animation completes.

**Reduced motion:** If `prefers-reduced-motion` is set, skip directly to instant deal regardless of setting.

### Anti-Patterns to Avoid

- **DO NOT** create a new Pinia store for room settings — room settings come from server via `PlayerGameView.roomSettings`, not local state
- **DO NOT** modify server-side room-settings logic — it's complete and working
- **DO NOT** add new protocol messages — `SET_ROOM_SETTINGS` already handles all fields
- **DO NOT** duplicate SlideInPanel state — use the existing `useSlideInPanelStore`
- **DO NOT** add settings panel content inside `GameTable.vue` directly — it goes inside `SlideInReferencePanels.vue`
- **DO NOT** use `<BaseToggle>` for dealing style if the two options need descriptive labels ("Instant" vs "Animated traditional") — a select or radio group may be clearer
- **DO NOT** use `sendRaw` for settings changes — use `sendSetRoomSettings()` which already exists

### Event Wiring Pattern (from 5B.5)

Settings changes follow the established pattern:
1. `RoomSettingsPanel` emits `@change` with `Partial<RoomSettings>` patch
2. Parent wires to `conn.sendSetRoomSettings(patch)`
3. Server validates, applies, broadcasts `ROOM_SETTINGS_CHANGED`
4. All clients receive `STATE_UPDATE` with new settings
5. Toast shows for non-initiating players via `resolvedActionToastCopy.ts`

### Project Structure Notes

```
packages/client/src/
  components/
    ui/
      BaseToggle.vue          # NEW — reusable toggle primitive
      BaseToggle.test.ts      # NEW
      BaseNumberStepper.vue   # NEW — reusable stepper primitive
      BaseNumberStepper.test.ts # NEW
      SlideInPanel.vue        # EXISTING — no changes needed
    game/
      RoomSettingsPanel.vue   # MODIFY — replace native controls with primitives, remove <details>
      RoomSettingsPanel.test.ts # MODIFY — update for new primitives
      DealingAnimation.vue    # NEW — animated dealing overlay
      DealingAnimation.test.ts # NEW
      GameTable.vue           # MODIFY — remove inline RoomSettingsPanel, add DealingAnimation
    chat/
      SlideInReferencePanels.vue # MODIFY — add settings SlideInPanel
      slideInPanelIds.ts      # MODIFY — add settings panel ID
  stores/
    slideInPanel.ts           # MODIFY — add "settings" to union, add toggle/open methods
  views/
    RoomView.vue              # MODIFY — keep lobby settings inline, wire settings toggle for game
```

### Testing Standards

- Import test utils from `vite-plus/test` (NOT `vitest`)
- `setActivePinia(createPinia())` in `beforeEach`
- Mock `@vue-dnd-kit/core` in component tests
- happy-dom environment
- Co-locate test files with source

### Previous Story Intelligence (5B.5)

- ShownHand component stands **alongside** OpponentArea in GameTable, not nested inside — follow same composition pattern for DealingAnimation
- Event wiring: child emits → GameTable forwards → RoomView → connection composable
- Toast pattern: add case to `resolvedActionToastCopy.ts` + wire in GameTable watcher
- All 5B.5 tests passed backpressure gate cleanly

### Cross-Session Intelligence

- Story 4B.7 (commit f920135) built the full room settings system — RoomSettingsPanel, server validation, protocol, toast notifications
- Settings are editable only during "lobby", "scoreboard", "rematch" phases — enforced at both UI and server level
- `canEditRoomSettings(isHost, phase)` helper in `roomSettingsFormatters.ts` centralizes permission check
- Debounced duration input (300ms) already implemented in RoomSettingsPanel

### Git Intelligence

Recent commits show 5B story pattern: client-only UI work, prop-driven components, existing server infrastructure consumed without modification.

```
6945129 feat: implement Show Hands & Post-Game Social feature
8a6f517 refactor: enhance token efficiency in input discovery workflows
ca72852 feat: Story 5B.3 wall counter thresholds and tone styling
1860b9b feat(client): implement hand guidance engine and NMJL card highlighting
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5B, Story 5B.6]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Decision 4: Room Lifecycle, Configuration Tiers]
- [Source: _bmad-output/planning-artifacts/game-ux-spec.md — Shared UI Primitives (BaseToggle, BaseNumberStepper, BaseSelect)]
- [Source: _bmad-output/planning-artifacts/game-ux-spec.md — Settings Panel Layout, Design Direction B]
- [Source: _bmad-output/planning-artifacts/game-gdd.md — FR4, FR6, FR11, Dealing mechanics]

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation session 2026-04-06).

### Debug Log References

- SlideInReferencePanels tests: extended `@vueuse/core` mock with `importOriginal` so `RoomSettingsPanel`’s `useDebounceFn` resolves.
- DealingAnimation tests: hoisted `usePreferredReducedMotion` mock via `vi.mock("@vueuse/core")` for deterministic reduced-motion vs timed sequence.

### Completion Notes List

- Pass 2 (2026-04-06): Accessibility polish on primitives — when a visible `<label>` is present, the switch/spinbutton no longer duplicates an `aria-label` (explicit `ariaLabel` still overrides); `BaseNumberStepper` uses `tabindex=-1` when disabled. Removed redundant `aria-label` props from `RoomSettingsPanel` where labels suffice; kept richer `aria-label` for hand guidance. Updated tests accordingly; full gate re-run passed.
- Implemented `BaseToggle` and `BaseNumberStepper` with ARIA and client tests.
- Extended slide-in store with `settings`; added `RoomSettingsPanel` to `SlideInReferencePanels` (embedded variant); gear toggles on desktop chrome and `MobileBottomBar`.
- Refactored `RoomSettingsPanel` to toggles + stepper; lobby keeps inline panel with heading; slide-in uses outer header only.
- `DealingAnimation` overlay with wall/dice/deal phases; `GameTable` gates on `play`, `animated`, empty discards, and one-shot completion per play segment; `prefers-reduced-motion` skips animation.
- `humanValue` for dealing style uses label “Animated traditional” for toasts.

### Change Log

- 2026-04-06: Code review pass — added timer mode and dealing style toggle tests to `RoomSettingsPanel.test.ts`; replaced `<label for>` with `<span>` + `aria-labelledby` in `BaseNumberStepper.vue` for spec-compliant spinbutton labelling. Full backpressure gate passed (500 tests, typecheck, lint). Status → done.
- 2026-04-06: Pass 2 — a11y polish on `BaseToggle` / `BaseNumberStepper`, `RoomSettingsPanel` label duplication, tests; `pnpm test`, `typecheck`, `vp lint` passed.
- 2026-04-06: Story 5B.6 implementation complete; status → review; sprint status updated.

### File List

- `packages/client/src/components/ui/BaseToggle.vue`, `BaseToggle.test.ts`
- `packages/client/src/components/ui/BaseNumberStepper.vue`, `BaseNumberStepper.test.ts`
- `packages/client/src/stores/slideInPanel.ts`, `slideInPanel.test.ts`
- `packages/client/src/components/chat/slideInPanelIds.ts`
- `packages/client/src/components/chat/SlideInReferencePanels.vue`, `SlideInReferencePanels.test.ts`
- `packages/client/src/components/game/RoomSettingsPanel.vue`, `RoomSettingsPanel.test.ts`
- `packages/client/src/components/game/GameTable.vue`, `GameTable.test.ts`
- `packages/client/src/components/game/MobileBottomBar.vue`, `MobileBottomBar.test.ts`
- `packages/client/src/components/game/DealingAnimation.vue`, `DealingAnimation.test.ts`
- `packages/client/src/composables/roomSettingsFormatters.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/5b-6-settings-panel-dealing-style-options.md`
