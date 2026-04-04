# Story 3C.9: Call confirmation uses shared `useTileSelection`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **Epic 3A call confirmation tile selection to use the same `useTileSelection` composable as Charleston (Story 3B.4)**,
so that **selection behavior, accessibility, and tests stay consistent (Epic 3B / epics note; supersedes ad hoc 3A.5 selection UI)**.

## Acceptance Criteria

1. **AC1 — `useTileSelection` drives confirmation selection:** Given `callWindow.status === "confirming"` and the local player is `confirmingPlayerId`, when they select tiles from their rack for a non-Mahjong winning call, then selection state (toggle, progress text, completeness) is managed by [`useTileSelection`](../../packages/client/src/composables/useTileSelection.ts) using the same API patterns as Charleston (see [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) + [`TileRack.vue`](../../packages/client/src/components/game/TileRack.vue) `charlestonSelectionMode`). Prefer **one composable instance** with a **computed `targetCount`** that returns `0` when not in an active selection phase, or a second instance if you can prove clean lifecycle/reset — document the choice in completion notes.

   **Rack interactivity (do not miss):** [`rackInteractive`](../../packages/client/src/components/game/GameTable.vue) is `props.isPlayerTurn` during play when not in Charleston. The confirming player is **not** necessarily `currentTurn` — extend the computed (or equivalent) so the local confirmer’s rack accepts taps/toggles for `useTileSelection` while in confirmation.

2. **AC2 — Target count from winning call:** Given `callWindow.winningCall` is set ([`CallWindowState`](../../packages/shared/src/types/game-state.ts)), when deriving how many rack tiles the player must select for exposure, then use the **same numeric counts** as the private `REQUIRED_FROM_RACK` map in [`gameActionFromPlayerView.ts`](../../packages/client/src/composables/gameActionFromPlayerView.ts) (pung: 2, kong: 3, quint: 4, news: 3, dragon_set: 2, mahjong: 0 for “no multi-select”). **Prefer exporting** a small `getRequiredRackCountForCallType(callType)` (or re-exporting the map) from that module so confirmation `targetCount` and `tileIdsForCall` **cannot drift**. For **Mahjong** confirmation, the engine **ignores** `tileIds` on [`handleConfirmCall`](../../packages/shared/src/engine/actions/call-window.ts) but the WebSocket layer still requires a **non-empty** `tileIds` array per [`validateCallTileIdsField`](../../packages/server/src/websocket/action-handler.ts) — send a **single valid rack tile ID** as a placeholder with documented rationale, or adjust server validation in shared scope if product agrees (do not leave the client unable to submit).

3. **AC3 — `CONFIRM_CALL` / `RETRACT_CALL` wired from UI:** Given the confirmation phase, when the confirming player presses **Confirm** (with `isComplete` for non-Mahjong) or **Retract**, then [`RoomView`](../../packages/client/src/views/RoomView.vue) sends `ACTION` payloads matching [`ConfirmCallAction` / `RetractCallAction`](../../packages/shared/src/types/actions.ts) via [`useRoomConnection.sendGameAction`](../../packages/client/src/composables/useRoomConnection.ts). Extend [`buildGameActionFromTableEvent`](../../packages/client/src/composables/gameActionFromPlayerView.ts) (or a dedicated helper) to construct `{ type: "CONFIRM_CALL", playerId, tileIds }` and `{ type: "RETRACT_CALL", playerId }` — **do not** mutate local `GameState` on the client.

4. **AC4 — No duplicate ad hoc selection state:** Given [`tileIdsForCall`](../../packages/client/src/composables/gameActionFromPlayerView.ts) auto-picks tiles for the initial `CALL_*` actions during the **open** window, when this story is complete, then **confirmation-phase** rack selection is **not** implemented as a separate one-off `Set`/toggle implementation; it flows through `useTileSelection` (thin wrappers allowed). If the initial call and confirmation must share tile choice, align behavior with engine expectations (winning [`CallRecord`](../../packages/shared/src/types/game-state.ts) already carries `tileIds` from the call — confirmation may replace that choice with the user’s final `confirmedIds`).

5. **AC5 — UX / accessibility:** Given UX-DR29 / TileSelectionAction expectations in [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md), when in confirmation selection mode, then show progress (e.g. “2 of 3 selected”), provide clear **Confirm** / **Cancel or Retract** affordances, and keep [`TileRack`](../../packages/client/src/components/game/TileRack.vue) keyboard/focus behavior coherent (mirror Charleston selected styling or add a parallel `callConfirmationSelectionMode` prop if cleaner).

6. **AC6 — Tests:** Given existing [`GameTable.test.ts`](../../packages/client/src/components/game/GameTable.test.ts), [`CallButtons.test.ts`](../../packages/client/src/components/game/CallButtons.test.ts), and [`useTileSelection.test.ts`](../../packages/client/src/composables/useTileSelection.test.ts), when the refactor lands, then add or update tests so that **confirm/retract** paths and selection gating remain covered; add unit tests for new `buildGameActionFromTableEvent` branches if implemented.

7. **AC7 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass ([`AGENTS.md`](../../AGENTS.md)).

## Tasks / Subtasks

- [x] Task 1: Confirmation phase UI + composable wiring (AC: 1–2, 5)
  - [x] 1.0 **Rack interactivity:** Update [`rackInteractive`](../../packages/client/src/components/game/GameTable.vue) (and any `TileRack` `:is-player-turn` binding) so the **confirming** local player can interact with the rack even when `isPlayerTurn` is false.
  - [x] 1.1 Detect **confirming** state: `props.callWindow?.status === "confirming"` and `props.callWindow.confirmingPlayerId === props.localPlayer?.id` (props come from [`mapPlayerGameViewToGameTable`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) — `callWindow` is already passed through; `validCallOptions` is only non-empty when `status === "open"`, which is correct).
  - [x] 1.2 Add `useTileSelection`-driven selection for non-Mahjong calls with `targetCount` from `winningCall.callType` (use exported count helper per AC2). Reset selection when leaving confirming phase or when `winningCall` / `confirmationExpiresAt` changes (watchers similar to Charleston direction changes in [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue)).
  - [x] 1.3 **Mahjong:** No multi-tile selection — expose **Confirm Mahjong** / **Retract** only; build `CONFIRM_CALL` with placeholder `tileIds` per AC2.
  - [x] 1.4 **TileRack:** Extend props so confirming players use toggle from `useTileSelection` (reuse or generalize `charlestonSelectionMode` / `charlestonToggleTile` naming if needed — avoid breaking Charleston).
  - [x] 1.5 **Action zone:** While confirming, hide or disable [`CallButtons`](../../packages/client/src/components/game/CallButtons.vue) / [`DiscardConfirm`](../../packages/client/src/components/game/DiscardConfirm.vue) as appropriate; show confirmation toolbar (progress + confirm + retract).

- [x] Task 2: Action builders + RoomView (AC: 3–4)
  - [x] 2.1 Add table events, e.g. `confirmCall` / `retractCall` emits on [`GameTable`](../../packages/client/src/components/game/GameTable.vue), handled in [`RoomView.vue`](../../packages/client/src/views/RoomView.vue) → `sendFromView`.
  - [x] 2.2 Implement `buildGameActionFromTableEvent` cases for `CONFIRM_CALL` and `RETRACT_CALL` with validation against current `PlayerGameView` (confirming player, phase).
  - [x] 2.3 Remove or shrink any redundant selection helpers created only for calls — keep [`tileIdsForCall`](../../packages/client/src/composables/gameActionFromPlayerView.ts) for **open-window** `CALL_*` actions where still needed.

- [x] Task 3: Tests + checklist (AC: 6–7)
  - [x] 3.1 Component or composable tests for confirming-phase bindings (fixture `CallWindowState` with `status: "confirming"`, `winningCall`, `confirmingPlayerId`).
  - [x] 3.2 Unit tests for new `GameAction` builders.
  - [x] 3.3 Walk the **Validation checklist** section in this story before review; if protocol/broadcaster unchanged, skip broadcaster integration tests except the regression (QA) bullet as applicable.

- [x] Task 4: Regression gate (AC: 7)
  - [x] 4.1 Run `pnpm test && pnpm run typecheck && vp lint`.

## Dev Notes

### Scope boundaries

- **In scope:** Client-only refactor and wiring: `useTileSelection` for call confirmation, `CONFIRM_CALL` / `RETRACT_CALL` from production `GameTable` → `RoomView`, tests, UX parity with Charleston selection patterns.
- **Out of scope:** Epic **6A** chat; Epic **4B** full reconnection; engine changes **unless** required to resolve AC2 server/client mismatch for Mahjong `CONFIRM_CALL` (coordinate with shared/server reviewers if you change [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts)).

### Critical hazards (second pass)

| Hazard | Mitigation |
| ------ | ---------- |
| Confirmer not “current turn” | Extend `rackInteractive` / tile interaction gating per AC1 (see Task 1.0). |
| `REQUIRED_FROM_RACK` drift | Export one source of truth for rack tile **count** vs `winningCall.callType` (AC2). |
| Charleston vs play | Charleston and call confirmation never overlap (`gamePhase`); still use a **single** `useTileSelection` with computed `targetCount` if it simplifies resets. |
| `rackStore.selectedTileId` vs multi-select | Clear discard selection when entering call-confirmation selection (see Three-tier state). |
| Timer UX | Optional: derive remaining time from `confirmationExpiresAt` and [`CONFIRMATION_TIMER_MS`](../../packages/shared/src/engine/actions/call-window.ts) (exported from `@mahjong-game/shared`). |

### Existing implementation (do not reinvent)

| Concern | Location |
| ------- | -------- |
| `useTileSelection` API | [`packages/client/src/composables/useTileSelection.ts`](../../packages/client/src/composables/useTileSelection.ts) |
| Charleston usage + resets | [`packages/client/src/components/game/GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) (lines ~116–159) |
| Rack selection modes | [`packages/client/src/components/game/TileRack.vue`](../../packages/client/src/components/game/TileRack.vue) |
| Auto tile pick for **open** call window | [`packages/client/src/composables/gameActionFromPlayerView.ts`](../../packages/client/src/composables/gameActionFromPlayerView.ts) — `tileIdsForCall` |
| Engine confirmation + retraction | [`packages/shared/src/engine/actions/call-window.ts`](../../packages/shared/src/engine/actions/call-window.ts) — `handleConfirmCall`, `handleRetractCall` |
| Live room wiring | [`packages/client/src/views/RoomView.vue`](../../packages/client/src/views/RoomView.vue), [`packages/client/src/composables/useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) |
| Progress + pass UX reference (Charleston) | [`packages/client/src/components/charleston/CharlestonZone.vue`](../../packages/client/src/components/charleston/CharlestonZone.vue) — parity for progress copy and confirm affordance, not necessarily same layout |
| Dev fixture with `callWindow` | [`KeyboardAccessibilityShowcase.vue`](../../packages/client/src/components/dev/KeyboardAccessibilityShowcase.vue) — can extend mock for confirming phase manual testing |
| Epic 3A.5 requirements (5s confirm, retract) | [`epics.md`](../planning-artifacts/epics.md) — Story 3A.5 (~lines 1242–1272) |

### Architecture compliance

- **AR5 / no optimistic updates:** [`game-architecture.md`](../planning-artifacts/game-architecture.md) — selections are client-only until `ACTION` is acknowledged via `STATE_UPDATE`; do not remove tiles from rack optimistically.
- **Three-tier state:** [`project-context.md`](../project-context.md) — Pinia [`useRackStore`](../../packages/client/src/stores/rack.ts) remains for order/selection that is **not** this multi-select flow; avoid conflicting `rackStore.selectedTileId` while in call-confirmation multi-select (deselect discard selection when entering confirmation mode if needed).

### Technical requirements (guardrails)

| Requirement | Detail |
| ----------- | ------ |
| `CallWindowState` fields | [`status`](../../packages/shared/src/types/game-state.ts), `confirmingPlayerId`, `confirmationExpiresAt`, `winningCall`, `remainingCallers` |
| Timer | Display optional countdown using `confirmationExpiresAt` — not required by epics for 3C.9 but improves UX |
| Server payload | `CONFIRM_CALL` requires unique `tileIds` per [`validateCallTileIdsField`](../../packages/server/src/websocket/action-handler.ts) |
| Confirmation duration | Engine uses [`CONFIRMATION_TIMER_MS`](../../packages/shared/src/engine/actions/call-window.ts) (5000 ms); `PlayerGameView` exposes `confirmationExpiresAt` on [`CallWindowState`](../../packages/shared/src/types/game-state.ts) for countdown UI |
| Imports | `vite-plus/test` in tests; no `@/` aliases ([`CLAUDE.md`](../../CLAUDE.md)) |

### Likely files to touch

| File | Change |
| ---- | ------ |
| [`GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) | Confirming UI, `useTileSelection` integration, emits |
| [`TileRack.vue`](../../packages/client/src/components/game/TileRack.vue) | Optional props for call-confirmation selection |
| [`gameActionFromPlayerView.ts`](../../packages/client/src/composables/gameActionFromPlayerView.ts) | `CONFIRM_CALL` / `RETRACT_CALL` builders |
| [`RoomView.vue`](../../packages/client/src/views/RoomView.vue) | Wire new emits to `sendFromView` |
| [`GameTable.test.ts`](../../packages/client/src/components/game/GameTable.test.ts) | Confirming-phase coverage |
| [`gameActionFromPlayerView.test.ts`](../../packages/client/src/composables/gameActionFromPlayerView.test.ts) (create if missing) | Action builder tests for `CONFIRM_CALL` / `RETRACT_CALL` |

### Testing requirements

- Co-located `*.test.ts`; imports from `vite-plus/test`.
- Pinia: `setActivePinia(createPinia())` in `beforeEach` for components using stores ([`CLAUDE.md`](../../CLAUDE.md)).

### Anti-patterns (do not)

- Calling `handleAction` / mutating a local authoritative `GameState` on the client.
- Duplicating `useTileSelection`’s toggle/`Set` logic inline in `GameTable` for confirmation.
- Sending `CONFIRM_CALL` without verifying the server’s `tileIds` constraints.

### Validation checklist

Copy of [`story-validation-checklist.md`](story-validation-checklist.md) — run at review; **this story** is client-only and typically does **not** require `state-broadcaster.test.ts` unless protocol filters change.

#### Filtered views and privacy

- No hidden tile identities or peer pass selections leak via `buildPlayerView` / `state-broadcaster` / serialized `STATE_UPDATE` (add or extend broadcaster tests when changing filters).
- Internal engine fields that must stay server-private are not exposed on `PlayerGameView` / protocol types.

#### Action handlers

- Invalid actions rejected with **zero mutation** (include rejection tests for wrong phase, duplicate submission, bad tile IDs).
- Validate-then-mutate order preserved; early returns before any state write.

#### Reconnect and transport (when Charleston, courtesy, or phase-specific state exists)

- First payload after reconnect restores filtered game view (not lobby-only) where required by existing join-handler behavior.
- Integration or WS test covers at least one reconnect path when the story touches connection lifecycle.

#### After changing the broadcaster or protocol filters

- Run [`packages/server/src/websocket/state-broadcaster.test.ts`](../../packages/server/src/websocket/state-broadcaster.test.ts).
- Run relevant WebSocket integration tests (e.g. `full-game-flow.test.ts`).

#### Regression (QA)

- Existing `state-broadcaster` and integration tests stay green; add one case when new serialized fields are introduced.

### Project structure notes

- **No import aliases** — relative imports or `@mahjong-game/shared` per [`CLAUDE.md`](../../CLAUDE.md).

### Cross-session intelligence

- Epic **3B** / **3C.8**: Charleston already uses `useTileSelection`; **3C.8** explicitly deferred call-confirmation refactor to this story.
- **claude-mem (Apr 2026):** Joker exchange and Charleston patterns emphasized canonical `GameAction` types and validate-then-mutate — mirror for client **dispatch** (validation = “is this the right event for this view?” only).

### Previous story intelligence (3C.8)

- Source: [`3c-8-websocket-client-state-update-to-gametable.md`](3c-8-websocket-client-state-update-to-gametable.md) — `RoomView` + `buildGameActionFromTableEvent` + rack reconciliation; extend emits, do not bypass `useRoomConnection`.

### Git intelligence (recent commits)

- `7488be4` — WebSocket `STATE_UPDATE` → `GameTable` (Story 3C.8).
- `2d710f2` — `useRackStore` reset on room leave — preserve on confirmation flows (no new cross-room leaks).

### References

- [`epics.md`](../planning-artifacts/epics.md) — Epic 3C intro; Story 3C.9 (~lines 2446–2464); Story 3A.5 call confirmation (~lines 1242–1272)
- [`ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) — UX-DR29 TileSelectionAction / “Select N tiles from rack”
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — WebSocket, server authority
- [`project-context.md`](../project-context.md) — Client/server split, testing

## Latest tech information

- Vue 3.5 Composition API — `computed`, `watch`, `shallowRef` patterns already match [`useTileSelection`](../../packages/client/src/composables/useTileSelection.ts); no new dependency required.

## Project context reference

See [`project-context.md`](../project-context.md) — sections on Server Authority, Vue components, tile IDs, and WebSocket protocol.

## Story completion status

Ultimate context engine analysis completed — comprehensive developer guide created for Story 3C.9.

**Second pass (2026-04-04):** Added rack-interactivity hazard for confirming players (not always current turn), `REQUIRED_FROM_RACK` single-source-of-truth guidance, full embedded validation checklist, `CONFIRMATION_TIMER_MS` / `confirmationExpiresAt`, CharlestonZone and dev-showcase references, Task 1.0 for `rackInteractive`.

## Dev Agent Record

### Agent Model Used

Cursor agent (GPT-5.1)

### Debug Log References

### Completion Notes List

- **Single `useTileSelection`:** `tileTargetCount` combines Charleston (`gamePhase === "charleston"`) and play-phase call confirmation (`winningCall` + `getRequiredRackCountForCallType`). Mahjong confirmation uses `targetCount` 0 from the composable; UI uses **Confirm Mahjong** / **Retract** only and sends `CONFIRM_CALL` with the first rack tile id as placeholder (server `validateCallTileIdsField` requires non-empty `tileIds`; engine ignores tile ids for Mahjong per `handleConfirmCall`).
- **`rackMultiSelectMode`:** `charlestonSelectionMode || callConfirmationSelectionMode` drives `TileRack` multi-select (same `charleston-*` props; doc comment updated).
- **Follow-up pass (implementation review):** Replaced dual watchers with a single `callConfirmationIdentityKey` reset (winning-call identity only; avoids clearing selection on timer-only `confirmationExpiresAt` churn). `CONFIRM_CALL` **non-Mahjong** `tileIds` are ordered via `rackStore.tileOrder` when possible. `pickPatternCallTiles` / `tileIdsForCall` count paths use `getRequiredRackCountForCallType` internally. Confirmation toolbar shows optional **seconds remaining** (`useNow` + `confirmationExpiresAt`) and `aria-live="polite"` on progress copy.

### File List

- `packages/client/src/composables/gameActionFromPlayerView.ts`
- `packages/client/src/composables/gameActionFromPlayerView.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `packages/client/src/components/game/TileRack.vue`
- `packages/client/src/views/RoomView.vue`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-04: Story 3C.9 — `useTileSelection` for call confirmation, `CONFIRM_CALL` / `RETRACT_CALL` wiring, tests, sprint status → review.
- 2026-04-04: Follow-up — confirmation reset keyed by winning-call identity; rack-order `tileIds`; `getRequiredRackCountForCallType` in open-window pick helpers; countdown + `aria-live` on confirmation toolbar.
- 2026-04-04: GDS code review — AC7 verified (`pnpm test`, `pnpm run typecheck`, `vp lint`); File List updated; story and sprint status → done.
- 2026-04-04: Code review pass 2 — AC7 re-run (same commands); added unit tests for `confirmCall` rejection when `tileIds` has duplicates or includes an id not on `myRack`.
