# Story 3C.6: Wall End & Last Tile Rules

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **player**,
I want **the last tile in the wall to follow proper NMJL rules — self-drawn Mahjong is allowed, and the last discard can be called for any valid purpose**,
so that **end-game scenarios play correctly and create natural tension (FR102, FR103)**.

## Acceptance Criteria

1. **AC1 — Self-drawn Mahjong on last wall tile (FR102):** Given the wall has exactly **one** tile remaining, when the current player **draws** that tile and it **completes a valid hand**, then they may `DECLARE_MAHJONG` before discarding; on success the game ends on the scoreboard with **self-drawn** scoring — **all three losers pay double** the hand value (same as any other self-drawn win; the “last tile” case is not an exception that changes payment structure).

2. **AC2 — Last discard: full call menu (FR103):** Given the **last tile was drawn and discarded** (wall now empty) and a **call window is open** on that discard, when players evaluate calls, then **Pung, Kong, Quint, NEWS, Dragon set, and Mahjong** remain available wherever the existing validation rules already allow them — the engine **must not** restrict the last discard to Mahjong-only or otherwise special-case “empty wall” to reduce call types.

3. **AC3 — Wall game after last discard, no calls:** Given the last discard and **no** player calls (all pass or timer resolves to close), when the call window closes, then the game ends as a **wall game** — `gamePhase === "scoreboard"`, `winnerId: null`, **no** score/payment changes (consistent with Story 1.6 / `WALL_GAME`).

4. **AC4 — Mahjong on last discard:** Given the last discard and a player **calls and confirms Mahjong**, when the hand validates, then **standard discard Mahjong** scoring applies — **discarder pays double**, other two non-winners pay single (existing `confirmMahjongCall` / scoring paths).

5. **AC5 — Non-Mahjong call then discard (empty wall):** Given the last discard and a player calls **Pung/Kong/Quint/NEWS/Dragon set** (not Mahjong), when the call **confirms** and the exposed group is created, then the caller’s turn is **discard** with **no** tiles left to draw; their discard **opens a normal call window**; if that window closes with **no** Mahjong (all pass), the game ends as a **wall game**. (No further draws are possible; sequential call windows on discards still apply until resolution.)

6. **AC6 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass.

## Tasks / Subtasks

- [x] Task 1: Gap analysis & engine verification (AC: 1–5)
  - [x] 1.1 Trace `DRAW_TILE` → `DISCARD_TILE` when `wall.length === 1` before draw (last tile); confirm `DECLARE_MAHJONG` is legal in `turnPhase === "discard"` with `callWindow === null` (`packages/shared/src/engine/actions/mahjong.ts`).
  - [x] 1.2 Confirm **no** branch in `handleCallAction` / `getValidCallOptions` / `closeCallWindow` restricts call types when `state.wall.length === 0` (beyond normal validation).
  - [x] 1.3 Confirm `closeCallWindow` wall-game path when wall empty and no calls (`packages/shared/src/engine/actions/call-window.ts` ~370–377).
  - [x] 1.4 Confirm non-Mahjong `handleConfirmCall` sets `currentTurn` + `turnPhase: "discard"` with wall empty (`call-window.ts` ~766–775).
- [x] Task 2: Tests — last-tile scenarios (AC: 1–5)
  - [x] 2.1 **Self-drawn on empty wall after draw:** With wall drained to **1** tile, current player draws, rack matches a real pattern from the loaded card — assert `DECLARE_MAHJONG` succeeds, `gameResult.selfDrawn === true`, and `calculatePayments` / `gameResult.payments` reflect **double** from all three losers (reuse pattern-setup techniques from `mahjong.test.ts`).
  - [x] 2.2 **Last discard — non-Mahjong call permitted:** With empty wall after last discard, assert a legal **Pung** (or Kong) can be registered and confirmed if rack + discard satisfy rules (may use fixture manipulation similar to `wall-depletion.test.ts` `setupForLastDraw`).
  - [x] 2.3 **Chain: Pung on last discard → discard → pass all → wall game:** Full engine path ending in `WALL_GAME` / `winnerId: null`.
  - [x] 2.4 **Mahjong on last discard:** Assert discarder pays double / others single per `scoring.ts` (extend or add focused test if missing).
  - [x] 2.5 Extend `packages/shared/src/engine/actions/wall-depletion.test.ts` or add `wall-end-last-tile.test.ts` — keep co-located `*.test.ts` convention.
- [x] Task 3: Protocol / broadcaster (AC: 3–5, only if gaps)
  - [x] 3.1 If no new fields: document “no protocol change expected.” If `PlayerGameView` needs a flag for “last tile” UX later, **out of scope** unless epic requires it — default: **no** new wire fields for 3C.6.
- [x] Task 4: Client (optional / minimal)
  - [x] 4.1 Only if ACs require user-visible copy (e.g., tooltip “Last tile”) — check `ux-design-specification.md` / `GameTable` / wall counter; otherwise **defer** to Epic 5B polish. Prefer **no** client change if engine + tests satisfy epic.
- [x] Task 5: Validation gate (AC: 6)
  - [x] 5.1 `pnpm test && pnpm run typecheck && vp lint`

## Dev Notes

### Scope boundaries

- **In scope:** Engine correctness and **test coverage** for FR102/FR103 end-game behavior; scoring consistency for self-drawn vs discard Mahjong at wall end; wall-game termination after final call windows.
- **Out of scope unless gaps found:** New action types; broadcaster changes; rich UI for “last tile” drama; Epic 3C.7 concealed validation; Epic 3C.8–3C.9 client wiring.

### Existing implementation (do not reinvent)

| Behavior | Where |
| -------- | ----- |
| Last discard still opens call window | `handleDiscardTile` (`discard.ts`) — comment notes GDD FR20; wall depletion does not skip call window |
| Wall game when call window closes, empty wall, no calls | `closeCallWindow` (`call-window.ts`) |
| Self-drawn Mahjong scoring (3× double losers) | `handleDeclareMahjong` + `calculatePayments` (`mahjong.ts`, `scoring.ts`) — existing tests in `mahjong.test.ts` for self-drawn payments |
| Wall depletion integration tests | `wall-depletion.test.ts` |

Story 3C.6 is largely **NMJL acceptance verification** on top of Epic **1.6** — add **missing** scenario tests rather than rewriting flow.

### Implementation hints

- Use **`createPlayState()`** and `drainWallTo` pattern from `wall-depletion.test.ts` (`drainWallTo`, `setupForLastDraw`).
- For AC1, injecting a **winnable** hand may require **fixture helpers** (`injectTilesIntoRack`, tile builders in `packages/shared/src/testing/`) and a valid **pattern** from the card loaded in the test state.
- **Validate-then-mutate** everywhere; rejections return `{ accepted: false, reason }` with **no** partial mutation.

### Validation checklist

Paste from [`story-validation-checklist.md`](story-validation-checklist.md):

- Invalid actions: zero mutation; exhaustive `GameAction` handling if new reasons added.
- If touching `state-broadcaster.ts` or `PlayerGameView`: run `state-broadcaster.test.ts` and relevant WS tests.

### Project structure notes

- Shared logic only in `packages/shared`; server validates actions; client renders from `STATE_UPDATE` (`project-context.md`).
- Co-locate tests; import from `vite-plus/test`.

### Cross-session intelligence

- Epic 3C ordering: Table Talk / Social Override complete — no dependency for wall-end rules.
- Retro note: Stories **3C.8–3C.9** track client `STATE_UPDATE` → `GameTable` and call confirmation UX — **not** blockers for 3C.6 engine work.

### Previous story intelligence (3C.5)

- Source: [`3c-5-table-talk-report-majority-vote-dead-hand.md`](3c-5-table-talk-report-majority-vote-dead-hand.md)
- Production WebSocket → `GameTable` wiring may still be partial; 3C.6 **does not** depend on live client integration for engine ACs.

### Git intelligence (recent)

- Recent work merged Epic 3B retro follow-through and `PlayerGameView`→`GameTable` bridge — unrelated to wall-end rules; avoid mixing refactors into 3C.6.

### References

- [`epics.md`](../planning-artifacts/epics.md) — Story 3C.6 (lines ~2366–2393), Epic 3C intro (~612–618), FR102/FR103
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — Wall exhaustion / wall game (~674–677), call window determinism
- [`gdd.md`](../planning-artifacts/gdd.md) — Cross-check FR101–FR103 if cited in epic (wall game vs last-tile Mahjong)
- [`project-context.md`](../project-context.md) — Server authority, validate-then-mutate, testing
- Engine: `packages/shared/src/engine/actions/discard.ts`, `draw.ts`, `call-window.ts`, `mahjong.ts`, `wall-depletion.test.ts`

### Latest tech / versions

- No new dependencies expected. Stack per `project-context.md` (TypeScript 5.9, Vitest via `vite-plus/test`).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent).

### Debug Log References

_None._

### Completion Notes List

- **Task 1 (gap analysis):** No engine code changes required. Verified: `handleDeclareMahjong` allows self-drawn path only when `turnPhase === "discard"` and `callWindow === null` (last draw leaves discard phase with no call window until a discard). `handleCallAction` / `getValidCallOptions` do not read `state.wall`; no empty-wall branch restricts call types. `closeCallWindow` ends in `WALL_GAME` when `wall.length === 0` after clearing a call window with no pending calls. Non-Mahjong `handleConfirmCall` sets `currentTurn` to caller and `turnPhase: "discard"` regardless of wall length (lines 766–775 in `call-window.ts`).
- **Task 2:** Added [`packages/shared/src/engine/actions/wall-end-last-tile.test.ts`](../../packages/shared/src/engine/actions/wall-end-last-tile.test.ts) covering AC1–AC5. Joker-based Pung on last discard uses `setupForLastDrawWithWestJokerPung` so two Jokers are in West’s rack before the final draw (deterministic; avoids relying on duplicate naturals in the seeded wall after the last draw). **Follow-up:** AC3 **timer** path (`closeCallWindow(..., "timer_expired")` with empty wall) and AC4 **full integration** (`CALL_MAHJONG` → `resolveCallWindow` → `handleConfirmCall` after South’s last-discard, via `setupEastMahjongOnSouthLastDiscard`) added after code review second pass.
- **Tasks 3–4:** No protocol/broadcaster or client changes; deferred “last tile” UX to Epic 5B per story scope.

### Code Review (GDS adversarial — 2026-04-04)

- **AC validation:** AC1–AC5 covered by [`wall-end-last-tile.test.ts`](../../packages/shared/src/engine/actions/wall-end-last-tile.test.ts) with real engine paths (including AC3 `timer_expired` and AC4 `CALL_MAHJONG` integration — see **Test hardening**); AC6 verified: `pnpm test`, `pnpm run typecheck`, `vp lint` (lint reports 1 pre-existing warning in `mapPlayerGameViewToGameTable.test.ts`, 0 errors).
- **Engine vs story:** `handleCallAction` does not read `state.wall` (no empty-wall call-type restriction). `closeCallWindow` wall-game path at `call-window.ts` ~370–377. `handleDeclareMahjong` requires `turnPhase === "discard"` and `callWindow === null` (`mahjong.ts`). Non-Mahjong `handleConfirmCall` sets discard turn at ~766–775.
- **Git vs File List (transparency):** Working tree also modified `.claude/skills/gds-create-story/workflow.md`, `.cursor/skills/gds-create-story/workflow.md`, `_bmad/gds/workflows/4-production/gds-create-story/workflow.md` — **not** part of 3C.6 deliverables; omit from File List intentionally. Untracked `3c-7-concealed-hand-validation-at-mahjong.md` is a separate story artifact.
- **Low:** The AC2 micro-test that calls `getValidCallOptions(rack, discard)` does not pass `GameState`; it only restates that the helper has no wall parameter. Full AC2 coverage relies on the integration Pung test and static analysis of `handleCallAction`.

### Code review — second pass (2026-04-04)

- **Deeper engine sweep:** `handleCallMahjong` (lines ~161–218), `resolveCallWindow`, `confirmMahjongCall`, and `handleCallAction` contain **no** `state.wall` reads. Only `closeCallWindow` uses `wall.length` (wall-game termination). `getValidCallOptions` is rack+discard-only and does not list `"mahjong"` — Mahjong uses `CALL_MAHJONG` / confirmation separately (expected design).
- **AC3 wording:** Tests exercise **all-pass** → `closeCallWindow(..., "all_passed")`. *(Superseded for timer by “Test hardening” below.)*
- **AC4:** Synthetic confirming `callWindow` test validates payment splits via `confirmMahjongCall`. *(Superseded for full call flow by “Test hardening” below.)*
- **AC6:** Second-pass gates: `pnpm test`, `pnpm run typecheck`, `vp lint` all pass.

### Test hardening (2026-04-04)

- **AC3 timer:** Added explicit test **`closeCallWindow(state, "timer_expired")`** with empty wall and no calls — same `WALL_GAME` / `winnerId: null` outcome as the all-pass path.
- **AC4 integration:** Added **`CALL_MAHJONG` → `resolveCallWindow` → `handleConfirmCall`** after South draws the last wall tile and discards the ev-3 missing tile; East wins with discard-Mahjong payments (`setupEastMahjongOnSouthLastDiscard`). Supplements the synthetic AC4 test; uses per-tile rack moves (same pattern as AC4) so tiles are not bulk-removed from play.
- **Second-pass gaps closed:** The prior “Low” notes on AC3 timer vs all-pass and AC4 synthetic-only coverage are **addressed** by these tests.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3c-6-wall-end-last-tile-rules.md`
- `packages/shared/src/engine/actions/wall-end-last-tile.test.ts`

## Change Log

- **2026-04-04:** Story file created via GDS create-story workflow; sprint status set to **ready-for-dev**. Ultimate context engine analysis completed — comprehensive developer guide created.
- **2026-04-04:** Implementation complete: added Story 3C.6 acceptance tests (`wall-end-last-tile.test.ts`); gap analysis confirmed existing engine behavior; no protocol/client changes. Story and sprint status set to **review**. Validation: `pnpm test`, `pnpm run typecheck`, `vp lint`.
- **2026-04-04:** GDS code review complete; story and sprint status set to **done** (ACs verified, gates re-run).
- **2026-04-04:** GDS code review **second pass** — adversarial re-check of call/Mahjong paths vs `wall`; no new issues; story note appended.
- **2026-04-04:** Test hardening: AC3 `timer_expired` wall-game test + AC4 full `CALL_MAHJONG` integration path in `wall-end-last-tile.test.ts`; story Dev Agent Record and code review sections updated.
