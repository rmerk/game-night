# Story 3.3: Dead Hand Detection & Enforcement

Status: done

<!-- Ultimate context engine analysis completed — Story 3C.3 (FR76–FR79, UX-DR35). Second pass: AC13 resolvedAction privacy, tile math, broadcast redaction, key-files table, 3C.2 continuity. -->

## Story

As a **player**,
I want **automatic dead hand detection and enforcement when rule violations occur, with the dead hand player continuing to draw and discard but unable to win or call**,
so that **rule integrity is maintained without ending the game prematurely (FR76, FR77, FR78, FR79)**.

## Acceptance Criteria

1. **AC1 — Invalid Mahjong confirm (already implemented; verify + regression):** Given `pendingMahjong` is active for a player who received `INVALID_MAHJONG_WARNING`, when they dispatch `CONFIRM_INVALID_MAHJONG`, then `state.players[playerId].deadHand === true` and `resolved` includes `DEAD_HAND_ENFORCED` with reason `CONFIRMED_INVALID_DECLARATION` (FR76). Cancel path (`CANCEL_MAHJONG`) must not set dead hand.

2. **AC2 — Invalid irretractable exposure:** Given a player has one or more `exposedGroups` committed (past confirmation — tiles are on the table), when the engine determines those groups are **invalid for the loaded NMJL card** (e.g. card-data edge case, or post-mutation invalidation such as after a Joker swap), then that player is marked `deadHand: true` and play continues. (Do **not** auto-retract calls that have already produced `CALL_CONFIRMED` — dead hand is the sanction per GDD retraction boundary.)

3. **AC3 — Wrong hand tile count:** Given the server/engine detects a player whose **total concealed + exposed tile count** is inconsistent with the legal count for the current `turnPhase` / game situation (excluding transient call-window states where counts differ by design), when that inconsistency is detected on a validated code path (e.g. start of `DRAW_TILE` / `DISCARD_TILE` / after `CALL_CONFIRMED` / after `JOKER_EXCHANGE`), then dead hand is enforced for that player automatically.

4. **AC4 — Draw / discard loop (FR77):** Given `deadHand: true`, when it is that player’s turn, they **draw** (when `turnPhase === "draw"`) and **discard** (when `turnPhase === "discard"`) normally — no special phase skip. Existing handlers must not reject draw/discard solely because of dead hand.

5. **AC5 — No calls (FR77):** Given `deadHand: true`, when a call window is open, that player **cannot** submit `CALL_*` (including `CALL_MAHJONG`) — existing `DEAD_HAND_CANNOT_CALL` behavior must remain. Pass: dead hand players must still be able to **pass** so the window can close (they are not “calling”).

6. **AC6 — Others may call dead player’s discards (FR78):** Given player D has `deadHand: true`, when D discards and a call window opens, **other** (non-dead) players may call D’s discard per existing rules. D cannot call others’ discards.

7. **AC7 — Exposed tiles visible (FR79):** Given a dead hand player, their `exposedGroups` remain in `GameState` and appear in all players’ filtered views (`exposedGroups` by player id) as today.

8. **AC8 — Private dead hand indicator (UX-DR35):** Given `PlayerGameView`, the **affected** client receives `myDeadHand: true` iff `gameState.players[myPlayerId].deadHand === true`. **Other** players’ views must **not** include a per-opponent dead-hand flag (no public broadcast of “who is dead”). Spectator view: omit `myDeadHand` or set false only. **See AC13** — `resolvedAction` must not undermine this for non-affected clients.

9. **AC9 — Client UI (affected player only):** Given `myDeadHand === true`, the affected player’s UI shows a persistent subtle **“Dead Hand”** badge near their rack: `text-secondary` with `state-error` coral border; call controls hidden/disabled during call windows; Mahjong control remains visible but shows inline **“Dead hand — cannot declare.”** when activated (UX-DR35). Other seats show **no** badge.

10. **AC10 — Challenge integration:** Mahjong challenge overturn flow that already sets `deadHand` on the winner ([`challenge.ts`](packages/shared/src/engine/actions/challenge.ts)) remains unchanged and must still pass tests.

11. **AC11 — Out of scope:** Social Override must not undo dead hands (FR84) — no code changes in 3C.4 scope here; Table Talk dead hand (3C.5) will **call into** the same `deadHand` flag — document extension point only.

12. **AC12 — Validation gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass at repo root.

13. **AC13 — Resolved-action privacy (UX-DR35):** Given `STATE_UPDATE` is sent to every session, when `resolvedAction` is `DEAD_HAND_ENFORCED` (or includes a dead-hand sanction with identifying `playerId`), then **non-affected** clients must **not** receive a payload that identifies the dead-hand player. Implement redaction in [`broadcastGameState`](packages/server/src/websocket/state-broadcaster.ts) (e.g. omit `resolvedAction` for viewers where `resolvedAction.playerId !== viewerId`, or substitute a non-identifying stub). The affected player still receives the full `resolved` for local UI/animation. **Note:** `INVALID_MAHJONG_WARNING` currently includes `playerId` in the global broadcast — optional hardening in the same pass for consistency with private-first UX.

## Tasks / Subtasks

- [x] Task 1: Protocol + broadcast privacy (AC: 8, 12, 13)
  - [x] 1.1 Add `myDeadHand: boolean` to [`packages/shared/src/types/protocol.ts`](packages/shared/src/types/protocol.ts) `PlayerGameView`. Document: `SpectatorGameView` does not expose peer dead-hand state; omit `myDeadHand` or document as always `false` if the type is extended.
  - [x] 1.2 In [`packages/server/src/websocket/state-broadcaster.ts`](packages/server/src/websocket/state-broadcaster.ts) `buildPlayerView`, set `myDeadHand: playerState?.deadHand ?? false`.
  - [x] 1.3 **Privacy:** Update `broadcastGameState` so `DEAD_HAND_ENFORCED` (and optionally `INVALID_MAHJONG_WARNING`) is **not** sent identically to all peers when it identifies another player — implement per-recipient filtering per AC13.
  - [x] 1.4 Update [`state-broadcaster.test.ts`](packages/server/src/websocket/state-broadcaster.test.ts): `PlayerGameView` includes `myDeadHand`; add cases for “other player does not receive identifying dead-hand resolvedAction.”

- [x] Task 2: Engine — exposure revalidation + dead hand (AC: 2, 7, 12)
  - [x] 2.1 Add a shared helper (e.g. [`packages/shared/src/engine/dead-hand.ts`](packages/shared/src/engine/dead-hand.ts)) that, given `GameState` + `playerId`, determines whether all **committed** `exposedGroups` for that player are still valid for `state.card` (delegate to `filterAchievableByExposure` + `validateExposure` from [`exposure-validation.ts`](packages/shared/src/card/exposure-validation.ts) — not `validateHandWithExposure`, which is winning-hand-only and would false-positive during play).
  - [x] 2.2 Invoke revalidation where exposures can become invalid **after** confirmation — **minimum:** after successful [`handleJokerExchange`](packages/shared/src/engine/actions/joker-exchange.ts) (validate the **exposed group owner’s** groups that were mutated). Optionally: defensive check at start of `DRAW_TILE` / `DISCARD_TILE` for the current player.
  - [x] 2.3 When invalid: set `deadHand: true` on the **affected** player, return `accepted: true` with `resolved: { type: "DEAD_HAND_ENFORCED", playerId, reason: "INVALID_EXPOSED_GROUPS" }` (or a dedicated reason string agreed in `ResolvedAction` typing). Re-export helpers from [`packages/shared/src/index.ts`](packages/shared/src/index.ts) only if needed by server/tests.

- [x] Task 3: Engine — rack / hand count invariant (AC: 3, 4, 12)
  - [x] 3.1 **Tile math:** Concealed tiles live in `player.rack`; exposed tiles live in `player.exposedGroups` only. “Hand size” for invariants is typically `rack.length + sum(exposedGroups[].tiles.length)` (same as other validators). Document expected totals **per** `turnPhase` for the **current player** when they act (e.g. `discard` phase before discarding: 14 concealed tiles in rack after a wall draw; `draw` phase: 13 in rack — align with existing [`draw.ts`](packages/shared/src/engine/actions/draw.ts) / [`discard.ts`](packages/shared/src/engine/actions/discard.ts) behavior). **Exclude** or special-case: `callWindow` / `charleston` / `scoreboard` where counts differ by design.
  - [x] 3.2 Implement `assertLegalHandTileCount(state, playerId)` (or equivalent) on selected handlers only — avoid running on every tick if it risks false positives.
  - [x] 3.3 On mismatch: set `deadHand: true`, return `DEAD_HAND_ENFORCED` with reason `TILE_COUNT_MISMATCH`. Unit tests: **mutate** fixture rack/exposed lengths to simulate impossible states (no production path should normally hit this).

- [x] Task 4: Engine — verify existing paths (AC: 1, 5, 6, 10, 12)
  - [x] 4.1 Confirm [`handleConfirmInvalidMahjong`](packages/shared/src/engine/actions/mahjong.ts) + [`handleDeclareMahjong`](packages/shared/src/engine/actions/mahjong.ts) dead-hand guards; extend [`mahjong.test.ts`](packages/shared/src/engine/actions/mahjong.test.ts) if gaps.
  - [x] 4.2 Confirm [`handleCallAction`](packages/shared/src/engine/actions/call-window.ts) / `handleCallMahjong` reject dead hands; confirm [`handlePassCall`](packages/shared/src/engine/actions/call-window.ts) still allows passes for dead players.
  - [x] 4.3 Add/adjust integration tests: dead discarder → other player may `CALL_PUNG` (or pass); dead player cannot call.

- [x] Task 5: Client — UX-DR35 (AC: 9, 12)
  - [x] 5.1 Thread `myDeadHand` from `PlayerGameView` into UI: add a `myDeadHand` prop (or derive from injected/room state) on [`GameTable.vue`](packages/client/src/components/game/GameTable.vue) and any parent that maps server `STATE_UPDATE` to table props (today many flows use dev showcases — update types and showcases so production wiring is trivial).
  - [x] 5.2 Badge near **local** rack in [`GameTable.vue`](packages/client/src/components/game/GameTable.vue) or a small child (e.g. player hand strip); UnoCSS: `text-secondary`, border color from [`design-tokens.ts`](packages/client/src/styles/design-tokens.ts) `state-error`.
  - [x] 5.3 [`GameTable.vue`](packages/client/src/components/game/GameTable.vue) → [`CallButtons.vue`](packages/client/src/components/game/CallButtons.vue) (`hideCallsForDeadHand`): hide call buttons when `myDeadHand` and a call window applies to the local player (`ActionZone.vue` remains a layout wrapper only).
  - [x] 5.4 [`MahjongButton.vue`](packages/client/src/components/game/MahjongButton.vue): if `myDeadHand`, show inline **“Dead hand — cannot declare.”** on activate; do not emit `declareMahjong`. Add/adjust component tests per [`MahjongButton.test.ts`](packages/client/src/components/game/MahjongButton.test.ts) patterns.
  - [x] 5.5 If no production table route is wired for all flows, a **dev-only** showcase (under existing `import.meta.env.DEV` gating) is acceptable for the badge — same pattern as Story 3C.2 host UI fallback.

- [x] Task 6: Validation gate (AC: 12)
  - [x] 6.1 `pnpm test && pnpm run typecheck && vp lint` from repo root.

## Change Log

- **2026-04-03:** Story 3C.3 implemented — `myDeadHand` protocol, per-recipient `resolvedAction` redaction for dead-hand / invalid-mahjong warnings, `dead-hand.ts` helpers with post–joker-exchange exposure revalidation and tile-count enforcement wired into [`draw.ts`](packages/shared/src/engine/actions/draw.ts) after a successful wall draw (skipped when `shouldRunTileCountInvariant` is false). Not hooked on [`discard.ts`](packages/shared/src/engine/actions/discard.ts) or [`joker-exchange.ts`](packages/shared/src/engine/actions/joker-exchange.ts): tests and exchange flows can temporarily move off 14-in-discard invariants; discard-before-draw setups would false-positive. `GameTable` / `CallButtons` / `MahjongButton` UX; sprint status later set **done** (2026-04-03).
- **2026-04-03:** Code review follow-up — tile-count wiring + story/task doc alignment + stronger dead-hand call-window tests.
- **2026-04-03:** Story marked **done** — code review addressed; sprint status synced.
- **2026-04-03:** GDS dev-story second pass — regression gates and DoD checklist completed; Dev Agent Record updated.

## Dev Notes

### Intent (FR76–FR79, UX-DR35)

Dead hand is a **per-player flag** for the rest of the **current** `GameState` / match. It blocks winning and calling; it does **not** block drawing/discarding. Other players infer nothing from the wire except behavior (no public dead-hand label) — only **`myDeadHand`** communicates privacy-safe state to self. [Source: `_bmad-output/planning-artifacts/gdd.md` — Dead Hand; `_bmad-output/planning-artifacts/ux-design-specification.md` — Dead Hand Indicator (UX-DR35)]

### What already exists (do not reinvent)

| Mechanism | Location |
|-----------|----------|
| `PlayerState.deadHand` | [`packages/shared/src/types/game-state.ts`](packages/shared/src/types/game-state.ts) |
| Initialized in `createGame` | [`packages/shared/src/engine/state/create-game.ts`](packages/shared/src/engine/state/create-game.ts) |
| Invalid Mahjong → confirm → dead hand | [`handleConfirmInvalidMahjong`](packages/shared/src/engine/actions/mahjong.ts), `DEAD_HAND_ENFORCED` |
| Declare Mahjong blocked | [`handleDeclareMahjong`](packages/shared/src/engine/actions/mahjong.ts) — `DEAD_HAND` |
| Calls blocked | [`handleCallAction`](packages/shared/src/engine/actions/call-window.ts), [`handleCallMahjong`](packages/shared/src/engine/actions/call-window.ts) — `DEAD_HAND_CANNOT_CALL` |
| Challenge overturn → dead hand | [`packages/shared/src/engine/actions/challenge.ts`](packages/shared/src/engine/actions/challenge.ts) |
| Non-mahjong confirm invalid group → **retraction** (pre-commit) | [`handleConfirmCall`](packages/shared/src/engine/actions/call-window.ts) — Story 3C.3 adds **post-commit** invalidation path |

### Privacy / protocol

- **Never** add `deadHand: Record<playerId, boolean>` to public or spectator views.
- **Do** add **`myDeadHand`** only on `PlayerGameView`, derived from the viewer’s own `PlayerState` in [`buildPlayerView`](packages/server/src/websocket/state-broadcaster.ts). Matches project-context server authority and filtered views. [Source: `_bmad-output/project-context.md` — Server Authority, State Access]

### Invalid exposure (irretractable)

GDD: once tiles are exposed past confirmation, invalidity → dead hand, not retraction. [`handleConfirmCall`](packages/shared/src/engine/actions/call-window.ts) currently rejects invalid groups **before** mutation. Story 3C.3 covers **later** invalidity (Joker exchange altering a group, card validation edge cases, etc.). Reuse [`validateHandWithExposure`](packages/shared/src/card/exposure-validation.ts) / related exports as appropriate.

### Tile count mismatch

Use as a **safety net** for impossible states (bugs, desync). Document expected counts clearly in helper comments to avoid rejecting legal call-window situations — **wrong invariant is worse than a missed detection.**

### ResolvedAction privacy (critical)

[`broadcastGameState`](packages/server/src/websocket/state-broadcaster.ts) uses `resolvedActionForViewer` so `DEAD_HAND_ENFORCED` / `INVALID_MAHJONG_WARNING` are not broadcast identically to all peers. [`sendCurrentState`](packages/server/src/websocket/state-broadcaster.ts) omits `resolvedAction` on resync messages — there is no cross-player identification of dead-hand events on that path (acceptable for UX-DR35).

### New game / rematch

`deadHand` is per-match. [`createGame`](packages/shared/src/engine/state/create-game.ts) initializes `deadHand: false` for all players — no extra clear logic needed if new games always go through `createGame`.

### Previous story continuity (3C.2)

Story 3C.2 added `jokerRulesMode` and [`handleJokerExchange`](packages/shared/src/engine/actions/joker-exchange.ts) guardrails. This story **must not** regress Joker exchange under standard mode. Post-exchange **exposure revalidation** runs after a successful exchange only.

### Cross-story boundaries

- **3C.4 Social Override:** must not apply to dead hands (FR84) — no implementation here.
- **3C.5 Table Talk:** will set `deadHand` via shared enforcement — leave a single internal helper if useful (e.g. `applyDeadHand(state, playerId, reason)`).

### Testing standards

- Co-located `*.test.ts`, `vite-plus/test` imports, [`createPlayState`](packages/shared/src/testing/fixtures.ts) / tile builders.
- Server: follow [`action-handler.test.ts`](packages/server/src/websocket/action-handler.test.ts) / join-handler patterns for protocol fields.

### Project Structure Notes

- Shared logic in `packages/shared`; per-player view in `packages/server`; Vue in `packages/client` with UnoCSS tokens from [`design-tokens.ts`](packages/client/src/styles/design-tokens.ts) (`state-error`, text-secondary).

### Key files (expected touch list)

| Area | Files |
|------|--------|
| Protocol | [`packages/shared/src/types/protocol.ts`](packages/shared/src/types/protocol.ts) |
| Resolved types | [`packages/shared/src/types/game-state.ts`](packages/shared/src/types/game-state.ts) (`ResolvedAction` reasons if extended) |
| Broadcaster | [`packages/server/src/websocket/state-broadcaster.ts`](packages/server/src/websocket/state-broadcaster.ts) |
| Broadcaster tests | [`packages/server/src/websocket/state-broadcaster.test.ts`](packages/server/src/websocket/state-broadcaster.test.ts) |
| Dead-hand helpers | New `packages/shared/src/engine/dead-hand.ts` (suggested) + optional [`packages/shared/src/index.ts`](packages/shared/src/index.ts) re-exports |
| Joker exchange | [`packages/shared/src/engine/actions/joker-exchange.ts`](packages/shared/src/engine/actions/joker-exchange.ts) |
| Draw / discard | [`packages/shared/src/engine/actions/draw.ts`](packages/shared/src/engine/actions/draw.ts), [`discard.ts`](packages/shared/src/engine/actions/discard.ts) (if invariants hook here) |
| Game engine | [`packages/shared/src/engine/game-engine.ts`](packages/shared/src/engine/game-engine.ts) — only if new actions are added (unlikely for automatic enforcement) |
| Client | [`GameTable.vue`](packages/client/src/components/game/GameTable.vue), [`ActionZone.vue`](packages/client/src/components/game/ActionZone.vue), [`MahjongButton.vue`](packages/client/src/components/game/MahjongButton.vue), dev showcases under [`components/dev/`](packages/client/src/components/dev/) |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3C, Story 3C.3]
- [Source: `_bmad-output/planning-artifacts/gdd.md` — Dead Hand Triggers & Behavior, Retraction boundary]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Dead Hand Indicator (UX-DR35)]
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` — Social governance (Table Talk / dead hand interplay at epic level)]
- [Source: `_bmad-output/project-context.md` — Validate-then-mutate, WebSocket protocol, no optimistic updates]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- Exposure revalidation uses `filterAchievableByExposure` + `validateExposure` (not `validateHandWithExposure`, which requires a winning 14-tile match and would false-positive during normal play).
- Tile-count enforcement (`enforceDeadHandIfTileCountMismatch`) runs after successful [`handleDrawTile`](packages/shared/src/engine/actions/draw.ts) when `shouldRunTileCountInvariant` is true (call window, charleston, `pendingMahjong` skipped). Not run on discard or joker exchange (avoids false positives with test fixtures and temporary 15-tile exchange setups).
- Call UI: `CallButtons` gained `hideCallsForDeadHand` (Pass remains); `ActionZone.vue` unchanged (wrapper only).

### Definition of Done (second pass — 2026-04-03)

**GDS dev-story Steps 6–7 (self-check):** `pnpm test`, `pnpm run typecheck`, and `vp lint` passed at repo root. File List reconciled with `git status` / `git diff --name-only` (including untracked `dead-hand.ts`, `dead-hand.test.ts`, story file). Checklist from `.claude/skills/gds-dev-story/checklist.md` satisfied for review readiness.

```
Definition of Done: PASS

Story status: **done** — 3c-3-dead-hand-detection-enforcement
Completion Score: checklist items verified (context, ACs, tests, docs, gates)
Quality Gates: pnpm test OK; pnpm run typecheck OK; vp lint OK (0 errors)
Test Results: shared + client + server test suites passed
Documentation: File List complete; Change Log updated
```

**AC spot-check:** AC13 — `resolvedActionForViewer` in `state-broadcaster.ts` omits `DEAD_HAND_ENFORCED` / `INVALID_MAHJONG_WARNING` for non-subject viewers; `myDeadHand` on `PlayerGameView`. AC3 — `enforceDeadHandIfTileCountMismatch` invoked after successful draw only; helper remains unit-tested for impossible states. Task 5.3 met via `GameTable` → `CallButtons` (`hideCallsForDeadHand`); `ActionZone` remains a pass-through wrapper.

### File List

- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/engine/dead-hand.ts`
- `packages/shared/src/engine/dead-hand.test.ts`
- `packages/shared/src/engine/actions/joker-exchange.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/CallButtons.vue`
- `packages/client/src/components/game/MahjongButton.vue`
- `packages/client/src/components/game/MahjongButton.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3c-3-dead-hand-detection-enforcement.md`
