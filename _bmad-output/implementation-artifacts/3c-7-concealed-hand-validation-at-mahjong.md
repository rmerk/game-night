# Story 3C.7: Concealed Hand Validation at Mahjong

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **player**,
I want **Mahjong validation to check that concealed hand requirements are satisfied — groups in concealed (C) hands must have been formed from the wall, not from calls**,
so that **concealed hand wins are legitimate and the card's C/X markings are enforced (FR62)**.

## Acceptance Criteria

1. **AC1 — Concealed (C) pattern, no call-formed exposures:** Given a player declares Mahjong (self-drawn or discard path) with tiles matching a **Concealed (C)** hand on the card, when validation runs, then **no** group that the card requires to be concealed may have been formed **via a discard call** — i.e. any exposure created through `CONFIRM_CALL` / call confirmation must disqualify a concealed-only pattern (consistent with [`validateExposure`](../../packages/shared/src/card/exposure-validation.ts) for `pattern.exposure === "C"`).

2. **AC2 — Concealed-only pattern + prior call:** Given a player has **at least one** exposed group created from a **completed call** (discard-based exposure), when they attempt Mahjong on a **concealed-only** pattern, then `validateHandWithExposure` yields **no** valid match for that concealed pattern, and the engine follows the **invalid Mahjong** path from Story 3A.8 — `INVALID_MAHJONG_WARNING`, `pendingMahjong` set, player may cancel or confirm (dead hand) — implemented via existing `handleDeclareMahjong` / `confirmMahjongCall` behavior when `validateHandWithExposure` returns `null`.

3. **AC3 — Mixed group-level C/X (exposed hand on card):** Given a hand pattern with **mixed** group-level concealed flags (`GroupPattern.concealed`), when validating, then each group marked concealed on the card must **not** be represented by an exposure that was **formed via a discard call**; groups not marked concealed may be exposed from calls (FR62, extending Story 2.5). **Implementation note:** Today [`validateExposure`](../../packages/shared/src/card/exposure-validation.ts) treats any matching `ExposedGroup` as a violation for `group.concealed === true`. This story **refines** that to key off **exposure source** (call vs non-call) per epic requirement — see Tasks.

4. **AC4 — Exposed group metadata (foundation):** Given any `ExposedGroup` created or mutated by the engine, when persisted on `PlayerState`, then it includes metadata recording **how** the exposure was formed — at minimum distinguishing **`call`** (discard call confirmation) from **`wall`** (future: e.g. concealed-kong promotion or other non-call exposures). All current production creation paths in [`handleConfirmCall`](../../packages/shared/src/engine/actions/call-window.ts) set the source to **`call`**. Tests that manually construct `ExposedGroup` must supply the field or use a documented default.

5. **AC5 — Out of scope — Hand guidance (FR63):** Given the hand guidance system (Epic **5B**), when a player has exposed groups, filtering concealed-only patterns in the UI is **not** implemented in this story — epic explicitly defers FR63 to Epic 5B; [`filterAchievableByExposure`](../../packages/shared/src/card/exposure-validation.ts) remains available for future use.

6. **AC6 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass.

## Tasks / Subtasks

- [x] Task 1: Gap analysis & design (AC: 1–4)
  - [x] 1.1 Trace `validateHandWithExposure` → `validateExposure` → `matchesCallSourcedExposedGroup` / `matchesGroupIdentity` in [`exposure-validation.ts`](../../packages/shared/src/card/exposure-validation.ts). Document interaction with [`filterCardByExposure`](../../packages/shared/src/card/exposure-validation.ts) (concealed patterns removed when `exposedGroups.length > 0`).
  - [x] 1.2 Read **KNOWN LIMITATION** comment (abstract color A/B/C) in `matchesGroupIdentity` — if 3C.7 touches matching logic, add tests or a short follow-up note; do not expand scope to full Epic 5B hand guidance.
  - [x] 1.3 Grep `exposedGroups.push` / all `ExposedGroup` construction in `packages/shared/src` (excluding tests); confirm only [`call-window.ts`](../../packages/shared/src/engine/actions/call-window.ts) creates production exposures today.
  - [x] 1.4 Specify `ExposedGroup` extension in [`game-state.ts`](../../packages/shared/src/types/game-state.ts): e.g. `exposureSource: 'call' | 'wall'` (or equivalent naming consistent with codebase). Update [`protocol.ts`](../../packages/shared/src/types/protocol.ts) / `PlayerGameView` if `ExposedGroup` is mirrored on the wire — run broadcaster tests if touched.
- [x] Task 2: Validation logic (AC: 1–3)
  - [x] 2.1 Update `validateExposure` / helpers so group-level concealed checks consult **`exposureSource`** (or equivalent): discard-call exposures invalidate concealed-required groups; wall-sourced exposures follow NMJL rules for whether they still violate `group.concealed` — **default:** wall-sourced exposures in `exposedGroups` still count as “exposed melds” for patterns that require the group to remain fully concealed on the rack unless product rules say otherwise (document decision in code comment).
  - [x] 2.2 Ensure `handleDeclareMahjong` and `confirmMahjongCall` unchanged in **control flow** except where they must pass new fields; both already use `validateHandWithExposure` ([`mahjong.ts`](../../packages/shared/src/engine/actions/mahjong.ts)).
- [x] Task 3: Wire creation path (AC: 4)
  - [x] 3.1 In `handleConfirmCall`, set `exposureSource: 'call'` when building `ExposedGroup` (lines ~759–763 area).
  - [x] 3.2 Update any other production constructors (if found in Task 1.3); joker exchange and similar paths may **mutate** tiles but not create new groups — verify.
- [x] Task 4: Tests (AC: 1–4, 6)
  - [x] 4.1 **Unit:** Extend [`exposure-validation.test.ts`](../../packages/shared/src/card/exposure-validation.test.ts) — cases for `exposureSource` + mixed group-level patterns; preserve existing 2026 card integration tests.
  - [x] 4.2 **Engine:** Add or extend [`mahjong.test.ts`](../../packages/shared/src/engine/actions/mahjong.test.ts) — `DECLARE_MAHJONG` with concealed-only tile match but exposed group with `exposureSource: 'call'` → `INVALID_MAHJONG_WARNING` + `pendingMahjong`; optionally mirror for `confirmMahjongCall` / `CALL_MAHJONG` confirmation path.
  - [x] 4.3 Co-locate `*.test.ts`; import from `vite-plus/test`.
- [x] Task 5: Protocol / server / client (AC: 4–6)
  - [x] 5.1 If `ExposedGroup` gains a field, ensure server action validation and [`state-broadcaster`](../../packages/server/) / types stay aligned — run `state-broadcaster.test.ts` if under test.
  - [x] 5.2 **Client:** Only if wire shape changes require UI updates; otherwise document “no mandatory client change for 3C.7.”
- [x] Task 6: Validation gate (AC: 6)
  - [x] 6.1 `pnpm test && pnpm run typecheck && vp lint`

## Dev Notes

### Scope boundaries

- **In scope:** Engine-level concealed/exposure validation at Mahjong time; `ExposedGroup` provenance metadata; tests proving ACs; alignment with Story **2.5** / [`exposure-validation.ts`](../../packages/shared/src/card/exposure-validation.ts) and Story **3A.8** invalid Mahjong flow.
- **Out of scope:** Epic **5B** hand guidance UI (FR63); rich “illegal concealed” copy; new game actions unless strictly required.

### Existing implementation (do not reinvent)

| Behavior | Where |
| -------- | ----- |
| Composite tile + exposure validation | `validateHandWithExposure`, `validateExposure` — [`exposure-validation.ts`](../../packages/shared/src/card/exposure-validation.ts) |
| Self-drawn / discard Mahjong | `handleDeclareMahjong`, `confirmMahjongCall` — [`mahjong.ts`](../../packages/shared/src/engine/actions/mahjong.ts) |
| Invalid Mahjong warning + pending state | `INVALID_MAHJONG_WARNING`, `pendingMahjong` — [`mahjong.ts`](../../packages/shared/src/engine/actions/mahjong.ts); tests in [`mahjong.test.ts`](../../packages/shared/src/engine/actions/mahjong.test.ts) (`describe("Invalid Mahjong Warning Flow"`…) |
| Exposed group creation from calls | [`handleConfirmCall`](../../packages/shared/src/engine/actions/call-window.ts) |
| Pre-filter for future guidance | `filterAchievableByExposure` — [`exposure-validation.ts`](../../packages/shared/src/card/exposure-validation.ts) |

### Implementation hints

- **Validate-then-mutate** for all actions; invalid Mahjong uses warning + pending state (not hard reject) per existing patterns.
- Use **`createPlayState()`**, `injectTilesIntoRack`, tile builders from [`packages/shared/src/testing/`](../../packages/shared/src/testing/).
- If `ExposedGroup` changes, update **shared barrel** exports if needed ([`packages/shared/src/index.ts`](../../packages/shared/src/index.ts)).

### Validation checklist

Paste from [`story-validation-checklist.md`](story-validation-checklist.md):

- Invalid actions: zero mutation; exhaustive `GameAction` handling if new rejection reasons added.
- If touching `state-broadcaster.ts` or `PlayerGameView`: run `state-broadcaster.test.ts` and relevant WebSocket tests.

### Project structure notes

- Shared logic in `packages/shared`; server validates; client renders from `STATE_UPDATE` ([`project-context.md`](../project-context.md)).

### Cross-session intelligence

- Epic 3C: Joker exchange, dead hands, social/table-talk, and wall-end stories establish engine patterns; 3C.7 tightens **card C/X** vs **call-based exposure** alignment.
- Stories **3C.8–3C.9** (client `STATE_UPDATE` → `GameTable`, call confirmation + `useTileSelection`) are **not** prerequisites for this engine story.

### Previous story intelligence (3C.6)

- Source: [`3c-6-wall-end-last-tile-rules.md`](3c-6-wall-end-last-tile-rules.md) — FR102/FR103 verification style; same validation gate; co-located engine tests.

### References

- [`epics.md`](../planning-artifacts/epics.md) — Story 3C.7 (lines ~2394–2420), FR60–FR62, Epic 3C intro
- [`game-architecture.md`](../planning-artifacts/game-architecture.md) — scoring / turn authority (if needed)
- [`project-context.md`](../project-context.md) — server authority, testing, validate-then-mutate

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented `ExposureSource` + optional `exposureSource` on `ExposedGroup` with `getExposureSource()` defaulting omitted fields to `"call"`.
- `validateExposure`: full `pattern.exposure === "C"` unchanged (any table meld fails); group-level `concealed` uses discard-call-only matching via `matchesCallSourcedExposedGroup`.
- `filterAchievableByExposure` updated to use the same call-sourced rule for group-level concealed flags.
- `handleConfirmCall` sets `exposureSource: "call"`; protocol `PlayerGameView` uses shared `ExposedGroup` type — no duplicate edits; server broadcaster passes through; full test suite green.
- **Client:** No mandatory UI change — new field is optional on the wire with backward-compatible default.
- Code review (2026-04-04): Task 1.1 subtask updated to name `matchesCallSourcedExposedGroup` (replacing obsolete `matchesAnyExposedGroup`); added engine test `3C.7: discard confirmation — concealed-only…` in `mahjong.test.ts`; removed unsafe `as SuitedTile` in `mapPlayerGameViewToGameTable.test.ts` helper (lint).

### File List

- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/card/exposure-validation.ts`
- `packages/shared/src/engine/actions/call-window.ts`
- `packages/shared/src/card/exposure-validation.test.ts`
- `packages/shared/src/engine/actions/mahjong.test.ts`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts` (code review: lint-only helper typing for `SuitedTile` test tiles)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3c-7-concealed-hand-validation-at-mahjong.md`

### Change Log

- 2026-04-04 — Story 3C.7 implemented: exposure provenance, concealed validation at Mahjong, tests, gates passed; status → review.
- 2026-04-04 — Code review follow-up: Task 1.1 text fix, 3C.7 discard confirmation engine test, client composable test lint fix; File List updated.
- 2026-04-04 — Code review complete; status → done (sprint-status synced).

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (gds-create-story workflow).
