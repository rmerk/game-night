# Story 5B.5: Show Hands & Post-Game Social

Status: done

## Story

As a player,
I want to optionally reveal my rack after a game ends so friends can see what I was building,
so that the post-game social moment mirrors the in-person tradition of showing hands (FR130, FR133).

## Acceptance Criteria

1. **AC1: Show Hand Button Appears on Scoreboard**
   - **Given** a game ends (scoreboard phase)
   - **When** the scoreboard is displayed
   - **Then** each player independently sees a "Show My Hand" button — optional, not automatic

2. **AC2: Show My Hand Action & Server Broadcast**
   - **Given** a player taps "Show My Hand"
   - **When** the action is dispatched
   - **Then** the server broadcasts their full rack to all clients via `STATE_UPDATE` with `resolvedAction: { type: 'HAND_SHOWN', playerId }` — their tiles become visible

3. **AC3: Multiple Players Reveal Hands**
   - **Given** multiple players show their hands
   - **When** viewing the table
   - **Then** each revealed hand displays at or near the respective player's seat area — visible to all, laid out clearly

4. **AC4: Post-Game Social Features Remain Active**
   - **Given** the post-game phase
   - **When** checking social features
   - **Then** voice chat, text chat, and reactions remain fully active — the Lingering phase is social time (FR133)

5. **AC5: Phase Restriction Enforcement**
   - **Given** the `SHOW_HAND` action
   - **When** checking phase restrictions
   - **Then** it is only valid during the `scoreboard` phase — attempts during other phases are rejected

## Tasks / Subtasks

### Task 1: Wire shownHands through Client Data Pipeline (AC: 1, 2, 3)
- [x] 1.1 Add `shownHands: Record<string, Tile[]>` to `GameTablePropsFromView` in `mapPlayerGameViewToGameTable.ts`
- [x] 1.2 Map `view.shownHands` in `mapPlayerGameViewToGameTableProps()` function
- [x] 1.3 Add `shownHands` prop to `GameTable.vue` `defineProps`
- [x] 1.4 Pass `shownHands` through from `RoomView.vue` → `GameTable.vue` binding

### Task 2: Add sendShowHand to Connection Composable (AC: 2)
- [x] 2.1 Add `sendShowHand()` method to `useRoomConnection.ts` — sends `{ type: 'ACTION', action: { type: 'SHOW_HAND', playerId: myPlayerId } }`
- [x] 2.2 Expose `sendShowHand` from `useRoomConnection` return object

### Task 3: Show My Hand Button in Scoreboard (AC: 1, 2)
- [x] 3.1 Add `hasShownHand: boolean` and `@showHand` emit to `Scoreboard.vue` props/emits
- [x] 3.2 Add "Show My Hand" button below payment section — visible to ALL players (not host-only)
- [x] 3.3 Button states: default "Show My Hand" → disabled "Hand Shown" after click
- [x] 3.4 Wire `@showHand` event through `GameTable.vue` → `RoomView.vue` → `conn.sendShowHand()`

### Task 4: Shown Hand Tile Display (AC: 3)
- [x] 4.1 Create `ShownHand.vue` component — renders a row of Tile components for a revealed hand
- [x] 4.2 Props: `tiles: Tile[]`, `playerName: string`, `position: 'top' | 'left' | 'right' | 'local'`
- [x] 4.3 Minimum tile face width 28px for legibility (40-70+ demographic per UX spec)
- [x] 4.4 Responsive: horizontal scroll or wrap on small viewports
- [x] 4.5 Render `ShownHand` in/adjacent to `OpponentArea` for each player in `shownHands` during scoreboard phase
- [x] 4.6 Render local player's shown hand near their rack area (or below scoreboard) if they revealed

### Task 5: Handle HAND_SHOWN Resolved Action (AC: 2, 3)
- [x] 5.1 Add `HAND_SHOWN` to `resolvedActionToastCopy.ts` — e.g. "{playerName} showed their hand"
- [x] 5.2 Wire toast in `GameTable.vue` resolved action watcher (existing `switch` on `ra.type`)

### Task 6: Scoreboard Integration & Phase Gating (AC: 5)
- [x] 6.1 Only render "Show My Hand" button when `gamePhase === 'scoreboard'`
- [x] 6.2 Only render `ShownHand` displays during scoreboard phase
- [x] 6.3 Verify existing engine `handleShowHand` rejects non-scoreboard-phase actions (already tested in `show-hand.test.ts`)

### Task 7: Testing (AC: 1-5)
- [x] 7.1 `Scoreboard.test.ts` — "Show My Hand" button renders, emits, disabled after click
- [x] 7.2 `ShownHand.test.ts` — renders tile row, respects min width, handles empty array
- [x] 7.3 `mapPlayerGameViewToGameTable.test.ts` — `shownHands` mapped through to props
- [x] 7.4 `GameTable.test.ts` — shown hands display during scoreboard, hidden otherwise
- [x] 7.5 `OpponentArea` or integration — shown hand appears adjacent to correct opponent
- [x] 7.6 Verify `resolvedActionToastCopy` for `HAND_SHOWN` returns expected string

### Task 8: Backpressure Gate
- [x] 8.1 `pnpm test && pnpm run typecheck && vp lint` passes

## Dev Notes

### CRITICAL: Existing Infrastructure (DO NOT Reinvent)

The engine, types, and broadcast pipeline for show-hands are **already fully implemented**. Do NOT create new action handlers, types, or state fields. Use what exists:

| Layer | What Exists | File |
|-------|-------------|------|
| Action type | `ShowHandAction { type: 'SHOW_HAND'; playerId: string }` | `packages/shared/src/types/actions.ts:176-180` |
| Engine handler | `handleShowHand()` — validates scoreboard phase, copies rack to `shownHands`, idempotent | `packages/shared/src/engine/actions/show-hand.ts` |
| Engine tests | Phase check, player check, idempotency, multiple players | `packages/shared/src/engine/actions/show-hand.test.ts` |
| GameState field | `shownHands: Record<string, Tile[]>` | `packages/shared/src/types/game-state.ts:219` |
| Resolved action | `{ type: 'HAND_SHOWN'; playerId: string }` | `packages/shared/src/types/game-state.ts:398` |
| Engine dispatch | `handleShowHand` called from `game-engine.ts:114-115` | `packages/shared/src/engine/game-engine.ts` |
| View builder | `shownHands` passed through in `buildPlayerView()` line 197 | `packages/server/src/websocket/state-broadcaster.ts` |
| Protocol type | `shownHands: Record<string, Tile[]>` on `PlayerGameView` line 220 | `packages/shared/src/types/protocol.ts` |
| Action handler | `SHOW_HAND` parsed and routed at line 95, 266-267 | `packages/server/src/websocket/action-handler.ts` |
| GameState init | `shownHands` initialized as `{}` | `packages/shared/src/engine/state/create-game.ts` |

**This story is 100% client-side UI work.** Server and engine are done.

### What's Missing (Your Job)

1. **`mapPlayerGameViewToGameTable.ts`** — does NOT map `shownHands` yet (not in `GameTablePropsFromView`)
2. **`useRoomConnection.ts`** — no `sendShowHand()` helper (can use `sendGameAction()` but a named helper is cleaner)
3. **`Scoreboard.vue`** — no "Show My Hand" button
4. **`GameTable.vue`** — no rendering of shown hands; no prop for `shownHands`
5. **`OpponentArea.vue`** — no hand display capability
6. **`resolvedActionToastCopy.ts`** — no `HAND_SHOWN` entry
7. **New component needed:** `ShownHand.vue` to render a revealed hand as a tile row

### Connection Composable Pattern

Use `sendGameAction()` (NOT `sendRaw` which `sendRematch`/`sendEndSession` use — those are room-level, not game actions). `sendGameAction` wraps in `{ type: 'ACTION', action }` per protocol:
```typescript
function sendShowHand(): void {
  sendGameAction({ type: "SHOW_HAND", playerId: playerGameView.value!.myPlayerId });
}
```

### Scoreboard Button Placement

The Scoreboard currently has two sections: host footer (Play Again / End Session) and non-host waiting message. The "Show My Hand" button should be:
- **Above** the host footer, visible to ALL players (not gated by `viewerIsHost`)
- Different visual treatment from host controls — use `variant="secondary"` or a distinct style
- Show disabled state with "Hand Shown" text after successful reveal

### Shown Hand Display Strategy

**Implement Option A — At Seat Positions:** Render shown tiles below/adjacent to each `OpponentArea` during scoreboard phase. This matches the physical experience of laying tiles on the table. Pass `shownHands[playerId]` tiles to a `ShownHand` sibling component next to each `OpponentArea` in `GameTable.vue`.

### Tile Rendering — Use Existing Tile.vue

Reuse `packages/client/src/components/tiles/Tile.vue`. Props:
- `tile: Tile` — the tile data object
- `size?: TileDisplaySize` — defaults to `"standard"`, use `"small"` or a compact size for shown hands
- `state?: TileState` — use `"default"` (face-up display)
- `interactive?: boolean` — set to `false` for static display (no hover/click)

Sizes are defined in `packages/client/src/components/tiles/tile-sizing.ts`. Also available: `TileBack.vue` for face-down tiles (not needed here).

### Resolved Action Toast Pattern

Per CLAUDE.md: resolved-action toasts use shared copy in `packages/client/src/composables/resolvedActionToastCopy.ts`. Wire via the existing `watch` on `resolvedAction` and `switch` on `ra.type` in `GameTable.vue` (around line 665, after the `REMATCH_WAITING_FOR_PLAYERS` case at line 715). Add a `HAND_SHOWN` case there.

### AC4 Note: Social Features Already Active

AC4 (chat, reactions remain active during post-game) is **already satisfied** by existing implementation — chat and reactions are not gated by game phase. No new work needed. Verify in testing that social features still work during scoreboard phase (smoke test only).

### RoomView Event Wiring

`RoomView.vue` already wires `@rematch` and `@end-session` events from `GameTable` to connection methods (lines ~675-676). Follow the same pattern: add `@showHand` event on the `<GameTable>` binding, wire to `conn.sendShowHand()`.

### Testing Patterns from 5B.4

- Use `setActivePinia(createPinia())` in `beforeEach` for client tests
- Mock `@vue-dnd-kit/core` in component tests
- happy-dom environment (not jsdom)
- Import test utilities from `vite-plus/test` (not `vitest`)
- Real assertions throughout — no placeholder `.toBeTruthy()` on rendered output

### Project Structure Notes

**New files:**
- `packages/client/src/components/game/ShownHand.vue` — alongside OpponentArea (renders at seat positions, not inside scoreboard)
- `packages/client/src/components/game/ShownHand.test.ts`

**Modified files (full paths):**
- `packages/client/src/components/scoreboard/Scoreboard.vue` — add Show My Hand button
- `packages/client/src/components/scoreboard/Scoreboard.test.ts` — button tests
- `packages/client/src/components/game/GameTable.vue` — shownHands prop, ShownHand rendering, HAND_SHOWN toast
- `packages/client/src/components/game/GameTable.test.ts` — shown hands tests
- `packages/client/src/composables/mapPlayerGameViewToGameTable.ts` — add shownHands mapping
- `packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts` — mapping test
- `packages/client/src/composables/useRoomConnection.ts` — add sendShowHand()
- `packages/client/src/composables/resolvedActionToastCopy.ts` — add HAND_SHOWN copy
- `packages/client/src/views/RoomView.vue` — wire @showHand event from GameTable to connection

### Cross-Session Intelligence

- This story adds a **player-level** action (not host-only) to the scoreboard phase established in 5B.4.
- `mood-lingering` class is already applied during scoreboard/rematch phases in GameTable — no mood changes needed.

### Anti-Patterns to Avoid

- **DO NOT** create new engine action handlers — `handleShowHand` already exists and is tested
- **DO NOT** add `shownHands` to server types or state — already there
- **DO NOT** modify `state-broadcaster.ts` — `shownHands` already passes through
- **DO NOT** gate "Show My Hand" on `viewerIsHost` — every player can show their own hand
- **DO NOT** use optimistic updates — wait for `STATE_UPDATE` confirmation per architecture rules
- **DO NOT** auto-reveal hands — the button must be voluntary per FR130

### References

- [Source: epics.md#Epic-5B, Story 5B.5] — User story, ACs, FR130/FR133
- [Source: game-architecture.md#PlayerGameView] — View filtering, shownHands field
- [Source: game-architecture.md#WebSocket-Protocol] — STATE_UPDATE + resolvedAction pattern
- [Source: ux-design-specification.md#Post-Game-Flow] — "Show Hands" prompt, Lingering mood
- [Source: ux-design-specification.md#Tile-Display] — Min tile face width 28-32px for legibility
- [Source: CLAUDE.md#Gotchas] — Resolved-action toast wiring pattern

## Dev Agent Record

### Agent Model Used

Cursor Agent (Composer)

### Debug Log References

### Completion Notes List

- Story 5B.5 implemented: `shownHands` mapped to `GameTable`; `sendShowHand()` on `useRoomConnection`; scoreboard “Show My Hand” for all players; `ShownHand` at seats + local below scoreboard + mobile fallbacks for left/right; `HAND_SHOWN` toast + `toastCopyHandShown`; tests and backpressure gate green.
- **Pass 2 (gds-dev-story):** `pnpm test`, `pnpm run typecheck`, and `vp lint` all passed (lint: 0 errors). DoD checklist reviewed against implementation: ACs 1–3, 5, and HAND_SHOWN toast verified in code and tests. **AC4:** Text chat remains available during scoreboard via existing Card/Chat toggles and `SlideInReferencePanels` (see `GameTable.test.ts` — chat focus return during scoreboard). Reaction *chrome* is hidden during scoreboard per AC10 UX (`reactionUiAllowed` in `GameTable.vue`); no change this pass — consistent with story Dev Notes that AC4 needs no additional feature work.

### Change Log

- 2026-04-06: Implemented client UI for post-game show hands (5B.5).
- 2026-04-06: Pass 2 — full regression gates + DoD validation; story remains **review** (no code changes).
- 2026-04-06: Pass 3 (gds-code-review) — added right opponent + mobile fallback shown hand tests to GameTable.test.ts. Story → **done**.

### File List

- `packages/client/src/composables/mapPlayerGameViewToGameTable.ts`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts`
- `packages/client/src/composables/useRoomConnection.ts`
- `packages/client/src/composables/resolvedActionToastCopy.ts`
- `packages/client/src/composables/resolvedActionToastCopy.test.ts`
- `packages/client/src/components/game/ShownHand.vue`
- `packages/client/src/components/game/ShownHand.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/scoreboard/Scoreboard.vue`
- `packages/client/src/components/scoreboard/Scoreboard.test.ts`
- `packages/client/src/views/RoomView.vue`
