# Story 3A.4: Call Window Freeze & Priority Resolution

Status: done

## Story

As a developer,
I want the call window to freeze when any player clicks a call, and for the server to resolve all buffered calls by priority (Mahjong > seat position) at resolution time,
so that call resolution is fair and deterministic with no fastest-click advantage (FR21, FR22, FR23, FR26).

## Acceptance Criteria

1. **AC1 — Freeze on first call:** When any player dispatches a call action during an open call window, `callWindow.status` changes to `"frozen"`, a `CALL_WINDOW_FROZEN` resolved action is emitted with the caller ID, and no further calls should be accepted from players who see the freeze (but see AC2).

2. **AC2 — In-flight calls accepted:** Call actions arriving while the window is `"frozen"` are still accepted into the call buffer. These represent in-flight calls sent before the sender received the freeze notification. The server does not reject late calls.

3. **AC3 — Non-Mahjong priority by seat position:** When multiple non-Mahjong calls are in the buffer at resolution time, the call from the player closest counterclockwise from the discarder wins (FR23).

4. **AC4 — Mahjong beats non-Mahjong:** When both Mahjong and non-Mahjong calls are in the buffer, the Mahjong call always wins regardless of seat position (FR21).

5. **AC5 — Multiple Mahjong by seat position:** When multiple Mahjong calls are in the buffer, the Mahjong call from the player closest counterclockwise from the discarder wins (FR22).

6. **AC6 — Losing calls silently discarded:** After priority resolution, losing callers' calls are silently discarded with no penalty and no notification to the losing caller.

7. **AC7 — Resolution returns winning call:** The `resolveCallWindow` function returns an `ActionResult` with the winning `CallRecord` so subsequent stories (3a-5) can enter the confirmation phase.

## Tasks / Subtasks

- [x] Task 1: Extend `CallWindowState.status` to include `"frozen"` (AC: 1)
  - [x] 1.1 Add `"frozen"` to the `CallWindowState.status` union type in `game-state.ts`
  - [x] 1.2 Add `CALL_WINDOW_FROZEN` to the `ResolvedAction` discriminated union in `game-state.ts`

- [x] Task 2: Implement freeze-on-first-call in `handleCallAction` (AC: 1, 2)
  - [x] 2.1 Modify `handleCallAction` to set `callWindow.status = "frozen"` when the first call is recorded and `status === "open"`
  - [x] 2.2 Return `CALL_WINDOW_FROZEN` resolved action (with `callerId`) when freeze triggers
  - [x] 2.3 Continue accepting calls when `status === "frozen"` (in-flight calls)
  - [x] 2.4 Write tests: first call freezes window, resolved action contains caller ID
  - [x] 2.5 Write tests: second call accepted while frozen, call buffer contains both calls
  - [x] 2.6 Write tests: pass actions rejected when window is frozen (`CALL_WINDOW_FROZEN` reason)

- [x] Task 3: Implement seat-position priority helper (AC: 3, 5)
  - [x] 3.1 Create `getSeatDistance(fromSeat, toSeat)` — returns counterclockwise distance (1-3) from discarder to caller using `SEATS` constant
  - [x] 3.2 Create `resolveCallPriority(calls, discarderSeatWind, players)` — sorts buffered calls by: (a) Mahjong first, (b) seat distance ascending
  - [x] 3.3 Write tests: seat distance calculation for all 4 seat positions as discarder
  - [x] 3.4 Write tests: priority resolution with 2 non-Mahjong calls at different seats
  - [x] 3.5 Write tests: priority resolution with 3 non-Mahjong calls

- [x] Task 4: Implement Mahjong priority over non-Mahjong (AC: 4, 5)
  - [x] 4.1 Ensure `resolveCallPriority` always ranks any Mahjong call above non-Mahjong regardless of seat
  - [x] 4.2 Write tests: Mahjong call beats closer-seated non-Mahjong call
  - [x] 4.3 Write tests: multiple Mahjong calls resolved by seat position
  - [x] 4.4 Write tests: single Mahjong call among multiple non-Mahjong calls wins

- [x] Task 5: Implement `resolveCallWindow` function (AC: 3, 4, 5, 6, 7)
  - [x] 5.1 Create `resolveCallWindow(state)` that: validates call window is frozen with calls, resolves priority, returns winning `CallRecord` in the `ActionResult`
  - [x] 5.2 Losing calls are discarded from the buffer — no mutation to losing players' state
  - [x] 5.3 The resolved action type is `CALL_RESOLVED` with `winningCall: CallRecord` and `losingCallerIds: string[]`
  - [x] 5.4 Write tests: single call resolves immediately as winner
  - [x] 5.5 Write tests: two competing calls — winner determined by seat position
  - [x] 5.6 Write tests: resolution with Mahjong vs non-Mahjong
  - [x] 5.7 Write tests: resolution with no calls returns rejection
  - [x] 5.8 Write tests: resolution when window is not frozen returns rejection

- [x] Task 6: Wire `resolveCallWindow` and update `handlePassCall` for frozen state (AC: 1, 6)
  - [x] 6.1 Update `handlePassCall` to reject with `CALL_WINDOW_FROZEN` when `status === "frozen"`
  - [x] 6.2 Register a `RESOLVE_CALL_WINDOW` action type in `game-engine.ts` dispatcher (or trigger resolution automatically — see Dev Notes)
  - [x] 6.3 Update `closeCallWindow` to handle pending calls: if `calls.length > 0`, route to `resolveCallWindow` instead of advancing turn
  - [x] 6.4 Write tests: pass rejected during frozen state
  - [x] 6.5 Write tests: close with pending calls triggers resolution instead of turn advance
  - [x] 6.6 Export new public functions from `index.ts` barrel

- [x] Review Follow-ups (AI)
  - [x] [AI-Review][HIGH] Add ALREADY_CALLED guard in handleCallAction — reject if player already has a call in callWindow.calls buffer. Without this, a player can submit multiple call types (e.g., pung then mahjong) and corrupt priority resolution. Add test for duplicate caller rejection. [call-window.ts:152]
  - [x] [AI-Review][MED] Document that resolveCallWindow intentionally leaves callWindow non-null after resolution (for story 3a-5 confirmation phase). Add a brief comment in the function and a note in Dev Notes explaining this is by design, not an omission. [call-window.ts:337]

- [x] Task 7: Backpressure gate and final validation (AC: all)
  - [x] 7.1 Run `pnpm -r test` — all tests pass
  - [x] 7.2 Run `pnpm run typecheck` — no type errors
  - [x] 7.3 Run `vp lint` — no lint errors

## Dev Notes

### Architecture Patterns

- **Validate-then-mutate** — every handler: validate (read-only) → mutate (only if valid) → return `ActionResult`. Zero partial mutations on rejection.
- **Discriminated unions** — extend `GameAction`, `ResolvedAction`, `CallWindowState.status` with new variants. Exhaustiveness checking via `default: never` in switch statements.
- **Pure functions in shared/** — no `console.*`, no browser/Node APIs, no runtime deps. `resolveCallPriority` and `getSeatDistance` must be pure.

### Key Implementation Decisions

**Freeze trigger:** The first call action changes `callWindow.status` from `"open"` to `"frozen"`. Subsequent calls are still buffered (AC2). The `CALL_WINDOW_FROZEN` resolved action carries `{ callerId }` so clients know who called first.

**Resolution trigger:** Resolution is NOT automatic on freeze. In the full flow (story 3a-5), the winning caller enters a confirmation phase. For THIS story, `resolveCallWindow` is a callable function that determines the winner from buffered calls. Story 3a-5 will wire the confirmation/retraction flow that calls it. For now, also update `closeCallWindow` so that if the window closes (timer expires) with pending calls, it routes to resolution instead of silently dropping them (fixing the pre-existing issue noted in 3a-3 review).

**Seat distance calculation:** Use the `SEATS` constant (`["east", "south", "west", "north"]`) which represents counterclockwise order. Distance from discarder to caller = `(callerIndex - discarderIndex + 4) % 4`. Distance 0 = same seat (invalid), distances 1-3 = counterclockwise proximity. Lower distance = higher priority.

**`handlePassCall` during freeze:** Reject with `CALL_WINDOW_FROZEN`. Once the window is frozen, passing is meaningless — resolution is based on buffered calls, not remaining passers.

**Mahjong call type:** Story 3a-7 implements `CALL_MAHJONG` fully. For THIS story, include `"mahjong"` in the `CallType` union and handle it in priority resolution, but do NOT implement `handleCallMahjong` validation. The priority algorithm must be ready for Mahjong calls even though the full Mahjong action isn't wired yet.

### Existing Code to Modify

| File | Change |
|------|--------|
| `packages/shared/src/types/game-state.ts` | Add `"frozen"` to `CallWindowState.status`, add `"mahjong"` to `CallType`, add `CALL_WINDOW_FROZEN` and `CALL_RESOLVED` to `ResolvedAction` |
| `packages/shared/src/types/actions.ts` | Add `ResolveCallWindowAction` type to `GameAction` union (if using explicit action) |
| `packages/shared/src/engine/actions/call-window.ts` | Modify `handleCallAction` for freeze, add `getSeatDistance`, `resolveCallPriority`, `resolveCallWindow`, update `handlePassCall` for frozen rejection, update `closeCallWindow` for pending calls |
| `packages/shared/src/engine/actions/call-window.test.ts` | Add all new test cases |
| `packages/shared/src/engine/game-engine.ts` | Register new action type if using explicit `RESOLVE_CALL_WINDOW` action |
| `packages/shared/src/index.ts` | Export new functions |

### Existing Code to Reuse

- **`SEATS` constant** from `constants.ts` — counterclockwise seat order array
- **`CallRecord` type** — already captures `{ callType, playerId, tileIds }` in the call buffer
- **`callWindow.calls[]`** — already implemented as a buffer for multiple calls
- **`callWindow.discarderId`** — already tracked, needed for seat distance calculation
- **`setupCallScenario` / `setupPatternCallScenario`** test helpers — extend for multi-player call scenarios
- **`getNonDiscarders` / `injectTilesIntoRack`** test helpers — reuse for setting up competing callers

### Testing Standards

- Co-located tests in `call-window.test.ts`
- Red-green-refactor: write failing tests first
- Zero-mutation-on-rejection tests for all new rejection paths
- Derive expected values from data (seat positions, call types) — never hardcode magic numbers
- Use `SEATS` constant in tests for seat distance assertions
- Test all 4 seats as discarder for distance calculation completeness
- Test edge case: all 3 non-discarders call simultaneously

### Previous Story Intelligence (3a-3)

**Patterns established:**
- `handleCallAction` uses a shared validation path with branching for pattern-defined vs same-tile calls
- `REQUIRED_FROM_RACK` maps `CallType` to required tile count
- Test helpers `setupCallScenario` and `setupPatternCallScenario` handle call window setup
- `isPatternDefinedCall` distinguishes NEWS/Dragon from Pung/Kong/Quint

**Review findings to carry forward:**
- `closeCallWindow` wall-empty branch silently drops pending calls — THIS story must fix this by routing to `resolveCallWindow` when calls are buffered
- Test helper `setupPatternCallScenario` relies on seed 42 — maintain this convention
- All new exports must be added to `index.ts` barrel

**Codebase stats:** 435 tests passing, typecheck clean, lint 0 errors as of 3a-3 completion.

### Project Structure Notes

- All changes in `packages/shared/src/` — this is pure game logic
- No client/ or server/ changes needed for this story
- File creation checklist: no new files needed — extend existing `call-window.ts` and `call-window.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3A.4 section, FR21/FR22/FR23/FR26]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Call Window Mechanics (Decision 6), Priority Resolution]
- [Source: _bmad-output/planning-artifacts/gdd.md — Calling System section, Call Priority]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Freeze Behavior, Priority Display]
- [Source: _bmad-output/project-context.md — Validate-Then-Mutate, shared/ Package Rules, Testing Rules]
- [Source: _bmad-output/implementation-artifacts/3a-3-pattern-defined-group-calls-news-dragon-sets.md — Previous story learnings, R2 deferred observations]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- Extended `CallWindowState.status` to include `"frozen"` and `CallType` to include `"mahjong"`
- Added `CALL_WINDOW_FROZEN` and `CALL_RESOLVED` to `ResolvedAction` discriminated union
- Modified `handleCallAction` to freeze window on first call (returns `CALL_WINDOW_FROZEN` resolved action)
- In-flight calls accepted while frozen (returns call-type resolved action)
- Modified `handlePassCall` to reject with `CALL_WINDOW_FROZEN` when window is frozen
- Implemented `getSeatDistance(fromSeat, toSeat)` — counterclockwise distance using `SEATS` constant
- Implemented `resolveCallPriority(calls, discarderSeatWind, players)` — sorts by Mahjong-first then seat distance
- Implemented `resolveCallWindow(state)` — resolves winner, clears buffer, returns `CALL_RESOLVED`
- Updated `closeCallWindow` to route to `resolveCallWindow` when calls are buffered (fixes pre-existing issue from 3a-3)
- Updated existing tests to expect `CALL_WINDOW_FROZEN` on first call instead of call-type resolved action
- Added 27 new tests (435 → 462 total), all passing
- Backpressure gate: tests pass, typecheck clean, lint 0 errors
- Resolved review R1 finding [HIGH]: Added ALREADY_CALLED guard in handleCallAction — rejects duplicate calls from same player with zero mutations
- Resolved review R1 finding [MED]: Added JSDoc comment to resolveCallWindow documenting intentional non-null callWindow after resolution (for 3a-5 confirmation phase)
- Added 2 new tests for duplicate caller rejection (462 → 464 total), all passing
- Backpressure gate post-review-fixes: 464 tests pass, typecheck clean, lint 0 errors

### Change Log

- 2026-03-27: Implemented call window freeze and priority resolution (Story 3A.4)
- 2026-03-27: Code review R1 — Changes Requested (1 HIGH, 1 MED, 1 LOW)
- 2026-03-27: Resolved code review R1 findings — 2 items fixed (HIGH + MED), LOW was informational only
- 2026-03-28: Code review R2 — Approved

## Senior Developer Review (AI)

### Review Metadata
- **Review Date:** 2026-03-27
- **Review Cycle:** R1
- **Outcome:** Changes Requested

### Summary

Solid implementation — all 7 ACs are correctly implemented with clean architecture (validate-then-mutate, pure functions, discriminated unions). 27 new tests with good assertion quality (no hardcoded constants, derived expected values). One genuine bug found: missing duplicate-caller guard.

### Action Items

- [x] [HIGH] Add ALREADY_CALLED guard in handleCallAction — a player can currently submit multiple calls on the same discard (e.g., pung then mahjong), inserting duplicate entries in the call buffer and corrupting priority resolution. Add `callWindow.calls.some(c => c.playerId === action.playerId)` check before mutation. Add test. [call-window.ts:152]
- [x] [MED] Document that resolveCallWindow intentionally leaves callWindow non-null (status frozen, empty calls array) after resolution. Story 3a-5 needs the window alive for confirmation phase. Add comment in function + Dev Notes. [call-window.ts:337]
- [LOW] Task 6.2 description mentions "Register a RESOLVE_CALL_WINDOW action type in game-engine.ts dispatcher" — the chosen approach (internal trigger via closeCallWindow) is architecturally sound. No code change needed; noting for task description accuracy.

### File List

- packages/shared/src/types/game-state.ts (modified)
- packages/shared/src/engine/actions/call-window.ts (modified)
- packages/shared/src/engine/actions/call-window.test.ts (modified)
- packages/shared/src/index.ts (modified)

## Senior Developer Review (AI) — R2

### Review Metadata
- **Review Date:** 2026-03-28
- **Review Cycle:** R2
- **Outcome:** Approved

### Summary

All R1 findings resolved. ALREADY_CALLED guard correctly implemented at call-window.ts:175 with zero-mutation-on-rejection verified (2 new tests added). JSDoc comment on resolveCallWindow documents the intentional non-null callWindow design. All 7 ACs fully implemented with 464 tests passing. Code quality clean: pure functions, validate-then-mutate pattern followed throughout, no security issues. Test assertions use derived values from SEATS constant and test data — no hardcoded magic numbers. File list matches git reality. No new issues found.

### Action Items

None — clean review.

