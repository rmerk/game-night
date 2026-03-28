# Story 3A.6: Turn Advancement After Calls (Skip-Ahead)

Status: done

## Story

As a **developer**,
I want **play to continue counterclockwise from the caller's seat after a successful call, skipping any players between the discarder and the caller**,
So that **turn order follows NMJL rules after a call (FR13 post-call behavior)**.

## Acceptance Criteria

1. **AC1 — Turn set to caller after confirmed call:**
   Given a player successfully calls and confirms a group (not Mahjong),
   When the call resolves,
   Then the caller must now discard a tile, and `currentTurn` is set to the caller.

2. **AC2 — Next draw is counterclockwise from caller:**
   Given the caller discards after a call,
   When the turn advances (call window closes with no calls, or all pass),
   Then the next player counterclockwise from the CALLER draws — not from the original discarder.

3. **AC3 — Skip-ahead example (East discards, West calls):**
   Given East discards, and West calls,
   When the call resolves,
   Then South is skipped; West discards, then North draws next.

4. **AC4 — No-skip case (caller is next in turn order):**
   Given a call where the caller is the next player in turn order (no skip),
   When the call resolves,
   Then no players are skipped — play continues normally from the caller.

5. **AC5 — Resolved action includes fromPlayerId:**
   Given the resolved call action,
   When emitting the state update,
   Then the `resolvedAction` includes `fromPlayerId` (the discarder) so clients can animate the skip-ahead transition.

## Tasks / Subtasks

- [x] Task 1: Verify existing turn advancement after confirmed call (AC: 1, 5)
  - [x] 1.1 Read `handleConfirmCall` in `call-window.ts` — confirm it already sets `currentTurn = callerId` and `turnPhase = "discard"` for non-Mahjong calls (this was implemented in 3a-5)
  - [x] 1.2 Confirm `CALL_CONFIRMED` resolved action already includes `fromPlayerId` (discarder ID) — implemented in 3a-5
  - [x] 1.3 Write explicit tests asserting AC1 and AC5 if not already covered by 3a-5 tests (check existing `call-window.test.ts` for coverage)
  - [x] 1.4 If AC1 and AC5 are already fully tested, document this in dev notes and move on

- [x] Task 2: Verify turn advancement after caller's discard (AC: 2, 3, 4)
  - [x] 2.1 Trace the full flow: caller discards (`handleDiscardTile`) -> call window opens -> all pass or timer expires -> `closeCallWindow` -> turn advances. Confirm that `closeCallWindow` advances from the CALLER (who is now the discarder), NOT the original discarder from before the call
  - [x] 2.2 `closeCallWindow` uses `state.callWindow.discarderId` to determine next player. After the caller's discard, `discarderId` will be the CALLER's ID (set by `handleDiscardTile`). Verify this is correct — the skip-ahead should happen naturally because the new discard opens a new call window with the caller as discarder
  - [x] 2.3 Write integration test for AC3: East discards -> West calls pung -> confirm -> West discards -> all pass -> closeCallWindow -> verify `currentTurn` is North (next counterclockwise from West), NOT South (which would be next from East)
  - [x] 2.4 Write integration test for AC4: East discards -> South calls pung -> confirm -> South discards -> all pass -> closeCallWindow -> verify `currentTurn` is West (next counterclockwise from South) — no skip, normal flow
  - [x] 2.5 Write integration test: East discards -> North calls -> confirm -> North discards -> all pass -> verify `currentTurn` is East (wraps around, skipping South and West)

- [x] Task 3: Write comprehensive skip-ahead scenario tests (AC: 2, 3)
  - [x] 3.1 Write test: Full 3-player-skip scenario — East discards, North calls (skip South + West) -> verify turn order is North -> East -> South -> West after North discards
  - [x] 3.2 Write test: 1-player-skip — East discards, West calls (skip South) -> verify West discards, then North draws
  - [x] 3.3 Write test: consecutive calls in same game — verify turn order resets correctly each time
  - [x] 3.4 Write test: call after a previous call (chain) — East discards, West calls and discards, North calls West's discard -> verify East draws next (counterclockwise from North)

- [x] Task 4: Edge case tests (AC: all)
  - [x] 4.1 Write test: wall depletion after caller's discard — caller discards, no calls, wall empty -> game ends as wall game (no draw error)
  - [x] 4.2 Write test: caller's discard gets called by another player — verify nested call flow works (call resolves, NEW caller discards, turn advances from NEW caller)
  - [x] 4.3 Write test: retraction during confirmation -> window reopens -> no call -> verify turn still advances correctly from the ORIGINAL discarder (since no call was confirmed)

- [x] Task 5: Backpressure gate and final validation (AC: all)
  - [x] 5.1 Run `pnpm -r test` — all tests pass (zero regressions)
  - [x] 5.2 Run `pnpm run typecheck` — no type errors
  - [x] 5.3 Run `pnpm lint` — no lint errors
  - [x] 5.4 Review all 5 ACs against test coverage — ensure each AC has at least one explicit test

## Dev Notes

### Key Insight: Skip-Ahead Is Likely Already Working

**This story may require minimal or no code changes.** The skip-ahead behavior should already work correctly because of how the existing code is structured:

1. **Story 3a-5 already sets `currentTurn = callerId`** after a confirmed non-Mahjong call (`handleConfirmCall`, `call-window.ts:676-679`)
2. **The caller then discards** (`handleDiscardTile` in `discard.ts`), which opens a NEW call window with the CALLER as the `discarderId`
3. **When that call window closes** (`closeCallWindow`), it advances turn to the next player counterclockwise from `callWindow.discarderId` — which is now the CALLER, not the original discarder
4. **The skip happens naturally** because the intermediate discard-from-caller resets the turn advancement origin point

**The primary work in this story is VERIFICATION through tests**, not implementation. The dev agent should:
1. Trace and verify the existing flow is correct
2. Write comprehensive integration tests proving skip-ahead works
3. Only write new code if a gap is found

### Architecture Patterns

- **Validate-then-mutate** — every handler: validate (read-only) -> mutate (only if valid) -> log -> return `ActionResult`. Zero partial mutations on rejection.
- **Discriminated unions** — `GameAction`, `ResolvedAction`, `CallWindowState.status` with exhaustiveness checking via `default: never` in switch statements.
- **Pure functions in shared/** — no `console.*`, no browser/Node APIs, no runtime deps. Logger injected, never imported.
- **Server authority** — clients submit actions, server validates and broadcasts. No optimistic updates.
- **No `setTimeout` in shared/** — timer scheduling is the server's job.

### Existing Code Flow (Trace the Happy Path)

```
1. Player A discards (handleDiscardTile)
   -> turnPhase = "callWindow"
   -> callWindow.discarderId = Player A
   -> callWindow.status = "open"

2. Player C calls pung (handleCallAction)
   -> call recorded in callWindow.calls[]
   -> callWindow.status = "frozen"

3. All other players pass / timer expires (closeCallWindow)
   -> calls exist, routes to resolveCallWindow()

4. resolveCallWindow() -> enterConfirmationPhase()
   -> callWindow.status = "confirming"
   -> confirmingPlayerId = Player C

5. Player C confirms (handleConfirmCall)
   -> exposed group created
   -> currentTurn = Player C (callerId)
   -> turnPhase = "discard"
   -> callWindow = null

6. Player C discards (handleDiscardTile)
   -> turnPhase = "callWindow"
   -> NEW callWindow.discarderId = Player C  <-- KEY: this is now Player C, not Player A
   -> callWindow.status = "open"

7. All pass (closeCallWindow)
   -> next player = counterclockwise from Player C  <-- SKIP-AHEAD happens here naturally
   -> currentTurn = next player after Player C
   -> turnPhase = "draw"
```

### Existing Code to Reference (Not Modify)

| File | What to Reference |
|------|-------------------|
| `packages/shared/src/engine/actions/call-window.ts:592-695` | `handleConfirmCall` — sets `currentTurn = callerId`, `turnPhase = "discard"`, includes `fromPlayerId` in resolved action |
| `packages/shared/src/engine/actions/call-window.ts:275-320` | `closeCallWindow` — advances turn counterclockwise from `callWindow.discarderId` |
| `packages/shared/src/engine/actions/discard.ts:9-59` | `handleDiscardTile` — opens new call window with `discarderId = action.playerId` |
| `packages/shared/src/engine/actions/draw.ts:42-53` | `advanceTurn` — advances to next counterclockwise player, sets `turnPhase = "draw"` |
| `packages/shared/src/constants.ts:17` | `SEATS` — `["east", "south", "west", "north"]` counterclockwise order |

### Existing Code to Reuse

- **`setupCallScenario` / `setupPatternCallScenario`** — test helpers for setting up 4-player game state with call window
- **`injectTilesIntoRack`** — test helper for placing specific tiles into a player's rack
- **`getNonDiscarders`** — test helper for getting player IDs of non-discarding players
- **`handleAction`** — game engine dispatcher, use for integration tests
- **`createTestState`** or `createGame` — state factory for test setup
- **`SEATS` constant** — for seat position assertions

### Critical Gotchas

1. **No new action types needed.** This story does NOT add new `GameAction` or `ResolvedAction` variants. The skip-ahead is an emergent behavior of existing action handlers.
2. **Do NOT modify `handleConfirmCall`.** Story 3a-5 already correctly sets `currentTurn` and includes `fromPlayerId`. Verify, don't rewrite.
3. **Do NOT modify `closeCallWindow`.** It already advances from `callWindow.discarderId`. The skip happens because a new callWindow is created with the caller as discarder when they discard.
4. **Do NOT modify `advanceTurn`.** It advances from `currentTurn`, which is already correct after a call.
5. **`fromPlayerId` is for CLIENT animation only.** It exists in the `CALL_CONFIRMED` resolved action so the client can visually narrate the skip. The server logic doesn't use it for turn advancement.
6. **Wall depletion edge case:** After a caller discards and no one calls, if the wall is empty, `closeCallWindow` handles this correctly (transitions to scoreboard with `WALL_GAME`). Verify this works in the skip-ahead path.
7. **Tile IDs, not indices:** Always reference tiles by ID (`bam-3-2`). Never use array indices.
8. **Seed 42 for tests:** Existing test helpers use seed 42 for deterministic wall/tile generation. Follow this convention.

### Testing Standards

- Co-located tests in `call-window.test.ts` (or create a new `turn-advancement.test.ts` if the file is getting too large — dev agent's discretion)
- Derive expected values from data (use `SEATS` constant, player objects) — never hardcode magic strings
- Zero-mutation-on-rejection tests if any new rejection paths exist
- Integration tests should trace full multi-step flows: discard -> call -> confirm -> discard -> close -> assert turn
- Use `vi.useFakeTimers()` if any timer-dependent scenarios
- Expect ~10-15 new tests (492 existing -> ~505+ total)

### Previous Story Intelligence (3a-5)

**Patterns established:**
- `handleConfirmCall` already sets `currentTurn = callerId` and `turnPhase = "discard"` for non-Mahjong calls (lines 676-679)
- `CALL_CONFIRMED` resolved action includes `fromPlayerId` (the discarder) at line 691
- `handleRetraction` with no remaining callers and no time: closes window and advances turn via closeCallWindow logic
- 492 tests passing at completion of 3a-5
- `buildGroupIdentity` creates group identity from discarded tile and call type
- Test helpers `setupCallScenario` and `setupPatternCallScenario` handle 4-player game setup with seed 42

**Code review findings carried forward:**
- Always add EVERY new export to `index.ts` barrel
- Document intentional design decisions with comments
- Zero-mutation-on-rejection verified by state comparison

### Forward Compatibility Notes

- **Story 3a-7 (Mahjong declaration):** Mahjong calls skip the discard phase entirely — `turnPhase` is NOT set to `"discard"`. Turn advancement after Mahjong is irrelevant (game ends). This story only handles non-Mahjong call advancement.
- **Story 5A.7 (Turn Indicator UI):** Will use `fromPlayerId` from `CALL_CONFIRMED` to animate the skip-ahead transition — turn indicator visually passes over skipped seats before landing on the caller's seat (UX-DR32, 400ms `timing-expressive`).
- **Story 4A.5 (Action/State Protocol):** Will wire turn advancement over WebSocket. The shared/ engine logic is the source of truth.

### UX Context (For Reference — Not Implemented Here)

Per the UX design specification:
- "Skip-ahead rule: after a call, play continues counterclockwise from the caller. Players in between are skipped. The UI must visually narrate this transition."
- "Turn skip after call: Turn indicator moves to caller, skipped players visually passed over" (State Narration table)
- "State transitions are always visible: When play skips ahead after a call... the UI visually narrates every transition."
- This visual narration is Epic 5A's responsibility (Story 5A.7). Story 3a-6 ensures the ENGINE state is correct for clients to render.

### Project Structure Notes

- All changes in `packages/shared/src/` — this is pure game logic
- No client/ or server/ changes needed
- Likely NO new files needed — integration tests added to existing test files
- If no code changes are needed (only tests), no new exports to `index.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3A.6 section, FR13 post-call behavior]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Decision 6: Call Window Synchronization, Turn Advancement After Call Resolution]
- [Source: _bmad-output/planning-artifacts/gdd.md — Play Direction and Turn Order, Call Confirmation section]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Skip-ahead rule, State Narration table, Turn Indicator]
- [Source: _bmad-output/implementation-artifacts/3a-5-call-confirmation-exposure-retraction.md — handleConfirmCall turn state, fromPlayerId, code review findings]
- [Source: _bmad-output/project-context.md — Validate-Then-Mutate, shared/ Package Rules, Testing Rules]
- [Source: packages/shared/src/engine/actions/call-window.ts — closeCallWindow, handleConfirmCall implementation]
- [Source: packages/shared/src/engine/actions/discard.ts — handleDiscardTile, new call window with caller as discarder]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Task 1: AC1 (currentTurn = callerId) already tested at call-window.test.ts:2401. AC5 (fromPlayerId in CALL_CONFIRMED) already tested at call-window.test.ts:2418. No new tests needed for Task 1 — existing 3a-5 tests fully cover these ACs.
- Task 2: Traced full flow verifying skip-ahead works via existing code structure (handleConfirmCall → handleDiscardTile → closeCallWindow chain). Wrote 4 integration tests for AC2/AC3/AC4 covering skip, no-skip, and wrap-around scenarios.
- Task 3: Wrote 4 comprehensive scenario tests — 3-player skip with full turn order verification, 1-player skip, consecutive calls, and chained calls.
- Task 4: Wrote 3 edge case tests — wall depletion after caller's discard, nested calls (caller's discard gets called), and retraction with window reopen falling back to original discarder.
- Task 5: Full regression suite (525 tests across 3 packages), typecheck, and lint all pass clean. Zero new code changes needed — skip-ahead works entirely through existing implementation.

### AC Coverage Map

| AC | Test(s) |
|----|---------|
| AC1 | call-window.test.ts:2401 (existing), turn-advancement.test.ts — all executeCallFlow assertions |
| AC2 | turn-advancement.test.ts — "AC2: East discards, North calls → East draws" |
| AC3 | turn-advancement.test.ts — "AC3: East discards, West calls → North draws" |
| AC4 | turn-advancement.test.ts — "AC4: East discards, South calls → West draws" |
| AC5 | call-window.test.ts:2418 (existing) |

### File List

- packages/shared/src/engine/actions/turn-advancement.test.ts (new)
- packages/shared/src/testing/helpers.ts (modified — extracted shared test helpers)
- packages/shared/src/engine/actions/call-window.test.ts (modified — uses shared helpers)
- _bmad-output/implementation-artifacts/3a-6-turn-advancement-after-calls-skip-ahead.md (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

## Change Log

- 2026-03-28: Story 3a-6 implemented. No code changes required — skip-ahead behavior was already working via existing handleConfirmCall → handleDiscardTile → closeCallWindow chain. Added 11 new integration tests in turn-advancement.test.ts verifying all 5 ACs including skip-ahead, no-skip, wrap-around, chained calls, wall depletion, nested calls, and retraction edge cases. Total tests: 525 (up from 514).
- 2026-03-28: Code review R1 fixes applied. Extracted `getNonDiscarders` and `injectTilesIntoRack` to shared testing helpers (eliminates duplication between call-window.test.ts and turn-advancement.test.ts). Fixed misleading "3-player skip" test name to "2-player skip". Replaced per-test timer boilerplate with beforeEach/afterEach. All 525 tests pass, typecheck clean.
