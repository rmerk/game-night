# Story 5B.7: Recent Activity Indicator (Ticker)

Status: done

## Story

As a **player**,
I want **a subtle game-state ticker showing the last 2-3 events near the turn indicator**,
So that **when I look away briefly (sip of coffee, answer a question), I can re-orient at a glance (UX-DR33)**.

## Acceptance Criteria

1. **Given** game events occur (discards, calls, turn changes), **Then** the last 2-3 events display in compressed form near the turn indicator: e.g., "Linda discarded 8-Dot → Sarah called Pung → Sarah discarded North"

2. **Given** no new events occur for 10 seconds, **Then** the ticker fades out — it's transient, not permanent

3. **Given** the ticker styling, **When** checking visual weight, **Then** it uses `text-secondary` sizing (14px min), low opacity, and is positioned to not compete with primary game elements (rack, action zone, turn indicator)

4. **Given** the ticker data source, **Then** it reads from the same `resolvedAction` stream that updates the board — no separate system or additional WebSocket messages

5. **Given** the ticker on phone viewports, **Then** it either displays in a single compressed line or is hidden entirely on the smallest viewports — never competes with the action zone or rack

## Tasks / Subtasks

- [x] Task 1: Create activity ticker Pinia store (AC: #1, #2, #4)
  - [x] 1.1 Define `ActivityTickerRecord` interface: `id`, `text` (pre-formatted string), `timestamp`, `expiresAt`
  - [x] 1.2 Create `useActivityTickerStore` in `packages/client/src/stores/activityTicker.ts`
  - [x] 1.3 Implement `pushEvent(text: string)` — adds record, caps at 3 items, sets `expiresAt = now + 10_000`
  - [x] 1.4 Implement interval-based pruning (reuse pattern from `reactions.ts` — `setInterval` at 400ms, clear when empty)
  - [x] 1.5 Expose `items` (readonly ref) and `clear()` / `resetForRoomLeave()` for cleanup
  - [x] 1.6 Write co-located unit tests in `activityTicker.test.ts`

- [x] Task 2: Create ticker copy composable (AC: #1)
  - [x] 2.1 Create `packages/client/src/composables/activityTickerCopy.ts`
  - [x] 2.2 Implement `tickerCopyForAction(ra: ResolvedAction, playerNamesById: Record<string, string>, localPlayerId: string): string | null` — returns human-readable compressed text or `null` for events that shouldn't appear in the ticker
  - [x] 2.3 Events to render: `DRAW_TILE` ("X drew"), `DISCARD_TILE` ("X discarded [tile label]"), `CALL_PUNG`/`CALL_KONG`/`CALL_QUINT`/`CALL_NEWS`/`CALL_DRAGON_SET` ("X called [type]"), `CALL_CONFIRMED` ("X exposed [type]"), `JOKER_EXCHANGE` ("X exchanged a joker"), `MAHJONG_DECLARED` ("X declared Mahjong!"), `WALL_GAME` ("Wall game — no winner")
  - [x] 2.4 Events to skip (already shown via toasts or not useful in ticker): `CALL_WINDOW_OPENED`, `CALL_WINDOW_CLOSED`, `CALL_WINDOW_FROZEN`, `PASS_CALL`, `HOST_PROMOTED`, `ROOM_SETTINGS_CHANGED`, `PLAYER_JOINED`, `PLAYER_RECONNECTED`, `GAME_STARTED`, `SHOW_HAND`, `HAND_SHOWN`, `CHARLESTON_*`, `TURN_TIMER_*`, `AFK_*`, `DEPARTURE_*`, `SOCIAL_OVERRIDE_*`, `TABLE_TALK_*`, `REMATCH_*`, `CALL_RESOLVED`
  - [x] 2.5 Use "You" for local player actions (e.g., "You discarded 8-Dot")
  - [x] 2.6 Write co-located unit tests

- [x] Task 3: Create ActivityTicker Vue component (AC: #1, #2, #3, #5)
  - [x] 3.1 Create `packages/client/src/components/game/ActivityTicker.vue`
  - [x] 3.2 Render items from `useActivityTickerStore().items` joined with " → " separator
  - [x] 3.3 Style: `text-secondary` sizing, `text-text-on-felt/50` color (low opacity), `text-sm` for mobile
  - [x] 3.4 Fade-out transition: use Vue `<Transition>` with `--timing-tactile` (120ms) enter, `--timing-exit` (150ms) leave; entire ticker fades when store is empty (pruned after 10s)
  - [x] 3.5 Mobile responsive: `hidden sm:block` hides ticker on smallest viewports (<640px); OR render as single-line truncated with `truncate` class on xs viewports
  - [x] 3.6 Accessibility: `role="log"` with `aria-live="polite"` and `aria-label="Recent game activity"`
  - [x] 3.7 Write co-located unit tests in `ActivityTicker.test.ts`

- [x] Task 4: Integrate into GameTable (AC: #1, #4)
  - [x] 4.1 Import `ActivityTicker` and `useActivityTickerStore` in `GameTable.vue`
  - [x] 4.2 Add a new `watch` on `props.resolvedAction` (inside the existing switch or as a separate watcher) that calls `tickerCopyForAction()` and pushes to the store
  - [x] 4.3 Position `<ActivityTicker />` below the TurnIndicator in the play-phase template (near line 1184-1188 in GameTable.vue) — both desktop and mobile layouts
  - [x] 4.4 Only render during `gamePhase === 'play'` (not charleston, scoreboard, or lobby)
  - [x] 4.5 Call `activityTickerStore.clear()` on phase transitions (when entering play, to avoid stale items from prior games)
  - [x] 4.6 Add tests in `GameTable.test.ts` verifying ticker integration

- [x] Task 5: Tile label helper (AC: #1)
  - [x] 5.1 Check if a `humanTileLabel(tileId: string)` helper already exists in shared or client. If not, create a minimal one that converts tile IDs like `dot-8-2` → "8-Dot"
  - [x] 5.2 Use this in `tickerCopyForAction` for discard events

- [x] Task 6: Cleanup integration (AC: #2)
  - [x] 6.1 Wire `activityTickerStore.resetForRoomLeave()` wherever `reactionsStore.resetForRoomLeave()` is called (likely in `useRoomConnection.ts` via `resetSocialUiForSession`)

- [x] Task 7: Backpressure gate (all ACs)
  - [x] 7.1 Run `pnpm test && pnpm run typecheck && vp lint` — all must pass

## Dev Notes

### Architecture & Data Flow

The ticker is a **client-only rendering concern** — no server changes needed. It reads from the `resolvedAction` that the server already sends with every `STATE_UPDATE` message.

**Data flow:** Server `STATE_UPDATE` → `resolvedAction` prop on GameTable → watcher calls `tickerCopyForAction()` → pushes text to `useActivityTickerStore` → `<ActivityTicker />` renders items.

### Reuse the ReactionBubbleStack Pattern

`packages/client/src/stores/reactions.ts` is the direct template for the ticker store:
- Same auto-expiring item pattern with `setInterval` pruning at 400ms
- Same `expiresAt` timestamp for item TTL
- Same `clear()` / `resetForRoomLeave()` cleanup API
- **Difference:** Ticker items are text strings (not emojis), capped at 3 (not per-player), and expire after 10s (not 2.5s)

### Existing resolvedAction Event Wiring

GameTable.vue already has a `watch` on `props.resolvedAction` at line 709 with a switch statement handling toasts. The ticker watcher should be **separate** (not merged into that switch) to keep concerns isolated. Follow the same pattern:

```typescript
watch(() => props.resolvedAction, (ra) => {
  if (!ra) return;
  const text = tickerCopyForAction(ra, playerNamesById.value, props.localPlayer?.id ?? "");
  if (text) activityTickerStore.pushEvent(text);
});
```

### Toast Copy Pattern

Follow `resolvedActionToastCopy.ts` conventions — pure functions, no side effects, return a string. The ticker copy composable is similar but produces shorter, compressed text and covers more event types.

### Positioning

The TurnIndicator lives at `GameTable.vue:1184` inside the play-phase `<template v-else>` block. Place `<ActivityTicker />` directly below it. The TurnIndicator uses `inline-flex items-center gap-2 rounded-full px-4 py-2` — the ticker should be visually subordinate (smaller text, lower opacity).

### Design Tokens

- Typography: `text-secondary` = 14px min, regular weight (from UX spec)
- Color: `text-text-on-felt/50` or similar low-opacity text on felt background
- Animation timing: `--timing-tactile` (120ms) for enter, `--timing-exit` (150ms) for leave
- Easing: `--ease-tactile` (ease-out)
- Reduced motion: all timing collapses to 0ms automatically via theme.css

### Mobile Strategy

UX spec says: "displays in a single compressed line or is hidden entirely on the smallest viewports." Simplest approach: `hidden sm:block` to hide on xs (<640px). On sm+ viewports, show as a single line with `truncate` overflow.

### ResolvedAction Types Reference

Events the ticker should render (from `packages/shared/src/types/game-state.ts:239+`):
- `DRAW_TILE { playerId }` → "X drew"
- `DISCARD_TILE { playerId, tileId }` → "X discarded 8-Dot"
- `CALL_PUNG { playerId }` → "X called Pung"
- `CALL_KONG { playerId }` → "X called Kong"
- `CALL_QUINT { playerId }` → "X called Quint"
- `CALL_NEWS { playerId }` → "X called NEWS"
- `CALL_DRAGON_SET { playerId }` → "X called Dragon Set"
- `CALL_CONFIRMED { callerId, callType }` → "X exposed [callType]"
- `JOKER_EXCHANGE { playerId }` → "X exchanged a joker"
- `MAHJONG_DECLARED { winnerId }` → "X declared Mahjong!"
- `WALL_GAME` → "Wall game — no winner"

### Anti-Patterns to Avoid

1. **DO NOT create a new WebSocket message type** — ticker reads from existing `resolvedAction`
2. **DO NOT add server-side logic** — this is purely client-side rendering
3. **DO NOT merge ticker logic into the existing toast switch** — keep it in a separate watcher
4. **DO NOT use a SlideInPanel** — ticker is inline, not a panel
5. **DO NOT add the ticker to the scoreboard or charleston phases** — play phase only
6. **DO NOT store ticker history persistently** — it's transient, lost on reconnect (fine)
7. **DO NOT import from `vitest`** — use `vite-plus/test` for test utilities

### Testing Standards

- Co-located test files next to source: `activityTicker.test.ts`, `ActivityTicker.test.ts`, `activityTickerCopy.test.ts`
- `import { ... } from "vite-plus/test"` (not `vitest`)
- `setActivePinia(createPinia())` in `beforeEach` for store tests
- happy-dom environment for component tests
- Mock `@vue-dnd-kit/core` if needed in GameTable tests

### Previous Story Patterns (5B.6)

- **Component extraction:** 5B.6 created `BaseToggle` and `BaseNumberStepper` as reusable primitives. The ticker is NOT a reusable primitive — it's a game-specific component in `components/game/`
- **SlideInPanel integration:** 5B.6 added `"settings"` to `SlideInPanelId`. The ticker does NOT use the slide-in system
- **Accessibility:** 5B.6 established `role="switch"` for toggles, `role="spinbutton"` for steppers. Ticker should use `role="log"` (semantic for sequential event log)
- **Test pattern:** 5B.6 used `vi.mock("@vueuse/core")` with `importOriginal` for partial mocks. Ticker tests likely won't need VueUse mocks

### Cross-Session Intelligence

- Story 5B.5 established the `HAND_SHOWN` / `SHOW_HAND` resolved action pattern — same `resolvedAction` stream the ticker will consume
- Story 5B.3 added wall counter tension states that are purely visual (not resolved actions) — ticker should NOT try to display wall state changes
- Toast consolidation (4B retro) established `resolvedActionToastCopy.ts` as the single copy source — the ticker copy composable is a parallel concern (different output format and event coverage), not a replacement

### Project Structure Notes

- Store: `packages/client/src/stores/activityTicker.ts` (alongside `reactions.ts`)
- Composable: `packages/client/src/composables/activityTickerCopy.ts` (alongside `resolvedActionToastCopy.ts`)
- Component: `packages/client/src/components/game/ActivityTicker.vue` (alongside `TurnIndicator.vue`)
- All test files co-located with their source

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR33 Recent Activity Indicator]
- [Source: packages/client/src/stores/reactions.ts — Auto-expiring item store pattern]
- [Source: packages/client/src/composables/resolvedActionToastCopy.ts — Toast copy function pattern]
- [Source: packages/client/src/components/game/GameTable.vue:709-778 — resolvedAction watcher]
- [Source: packages/client/src/components/game/TurnIndicator.vue — Turn indicator positioning]
- [Source: packages/shared/src/types/game-state.ts:239-320 — ResolvedAction union type]
- [Source: packages/client/src/styles/theme.css — Animation timing tokens]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Implemented client-only activity ticker: Pinia store (10s TTL, max 3 lines, 400ms prune), `tickerCopyForAction` + `tileIdToTickerLabel`, `ActivityTicker` UI below `TurnIndicator` in play phase only, separate `resolvedAction` watcher, `GameTable` phase clear on enter play, `resetSocialUiForSession` cleanup.
- Backpressure gate: `pnpm test`, `pnpm run typecheck`, `vp lint` passed (2026-04-06).
- Pass 2: Added tests for phase-transition `clear()` (scoreboard → play) and for `ActivityTicker` responsive classes (`hidden` / `sm:block` / `truncate`); full gate re-run (2026-04-06).

### Change Log

- 2026-04-06: Story 5B.7 implementation complete; status → review.
- 2026-04-06: Pass 2 — extra test coverage for ticker clear on phase entry and mobile-hide layout classes; quality gates re-verified.
- 2026-04-06: Code review pass — all ACs validated, all tasks verified, exhaustive ResolvedAction switch confirmed (60/60 types), backpressure gate green. 0 HIGH, 0 MEDIUM, 1 LOW (design opinion on CALL_MAHJONG skip — valid choice). Status → done.

### File List

- `packages/client/src/stores/activityTicker.ts`
- `packages/client/src/stores/activityTicker.test.ts`
- `packages/client/src/composables/activityTickerCopy.ts`
- `packages/client/src/composables/activityTickerCopy.test.ts`
- `packages/client/src/composables/tileIdTickerLabel.ts`
- `packages/client/src/composables/tileIdTickerLabel.test.ts`
- `packages/client/src/components/game/ActivityTicker.vue`
- `packages/client/src/components/game/ActivityTicker.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/composables/useRoomConnection.ts`
