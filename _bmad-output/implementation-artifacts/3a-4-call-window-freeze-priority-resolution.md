# Story 3A.4: Call Window Freeze & Priority Resolution

Status: ready-for-dev

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

- [ ] Task 1: Extend `CallWindowState.status` to include `"frozen"` (AC: 1)
  - [ ] 1.1 Add `"frozen"` to the `CallWindowState.status` union type in `game-state.ts`
  - [ ] 1.2 Add `CALL_WINDOW_FROZEN` to the `ResolvedAction` discriminated union in `game-state.ts`

- [ ] Task 2: Implement freeze-on-first-call in `handleCallAction` (AC: 1, 2)
  - [ ] 2.1 Modify `handleCallAction` to set `callWindow.status = "frozen"` when the first call is recorded and `status === "open"`
  - [ ] 2.2 Return `CALL_WINDOW_FROZEN` resolved action (with `callerId`) when freeze triggers
  - [ ] 2.3 Continue accepting calls when `status === "frozen"` (in-flight calls)
  - [ ] 2.4 Write tests: first call freezes window, resolved action contains caller ID
  - [ ] 2.5 Write tests: second call accepted while frozen, call buffer contains both calls
  - [ ] 2.6 Write tests: pass actions rejected when window is frozen (`CALL_WINDOW_FROZEN` reason)

- [ ] Task 3: Implement seat-position priority helper (AC: 3, 5)
  - [ ] 3.1 Create `getSeatDistance(fromSeat, toSeat)` — returns counterclockwise distance (1-3) from discarder to caller using `SEATS` constant
  - [ ] 3.2 Create `resolveCallPriority(calls, discarderSeatWind, players)` — sorts buffered calls by: (a) Mahjong first, (b) seat distance ascending
  - [ ] 3.3 Write tests: seat distance calculation for all 4 seat positions as discarder
  - [ ] 3.4 Write tests: priority resolution with 2 non-Mahjong calls at different seats
  - [ ] 3.5 Write tests: priority resolution with 3 non-Mahjong calls

- [ ] Task 4: Implement Mahjong priority over non-Mahjong (AC: 4, 5)
  - [ ] 4.1 Ensure `resolveCallPriority` always ranks any Mahjong call above non-Mahjong regardless of seat
  - [ ] 4.2 Write tests: Mahjong call beats closer-seated non-Mahjong call
  - [ ] 4.3 Write tests: multiple Mahjong calls resolved by seat position
  - [ ] 4.4 Write tests: single Mahjong call among multiple non-Mahjong calls wins

- [ ] Task 5: Implement `resolveCallWindow` function (AC: 3, 4, 5, 6, 7)
  - [ ] 5.1 Create `resolveCallWindow(state)` that: validates call window is frozen with calls, resolves priority, returns winning `CallRecord` in the `ActionResult`
  - [ ] 5.2 Losing calls are discarded from the buffer — no mutation to losing players' state
  - [ ] 5.3 The resolved action type is `CALL_RESOLVED` with `winningCall: CallRecord` and `losingCallerIds: string[]`
  - [ ] 5.4 Write tests: single call resolves immediately as winner
  - [ ] 5.5 Write tests: two competing calls — winner determined by seat position
  - [ ] 5.6 Write tests: resolution with Mahjong vs non-Mahjong
  - [ ] 5.7 Write tests: resolution with no calls returns rejection
  - [ ] 5.8 Write tests: resolution when window is not frozen returns rejection

- [ ] Task 6: Wire `resolveCallWindow` and update `handlePassCall` for frozen state (AC: 1, 6)
  - [ ] 6.1 Update `handlePassCall` to reject with `CALL_WINDOW_FROZEN` when `status === "frozen"`
  - [ ] 6.2 Register a `RESOLVE_CALL_WINDOW` action type in `game-engine.ts` dispatcher (or trigger resolution automatically — see Dev Notes)
  - [ ] 6.3 Update `closeCallWindow` to handle pending calls: if `calls.length > 0`, route to `resolveCallWindow` instead of advancing turn
  - [ ] 6.4 Write tests: pass rejected during frozen state
  - [ ] 6.5 Write tests: close with pending calls triggers resolution instead of turn advance
  - [ ] 6.6 Export new public functions from `index.ts` barrel

- [ ] Task 7: Backpressure gate and final validation (AC: all)
  - [ ] 7.1 Run `pnpm -r test` — all tests pass
  - [ ] 7.2 Run `pnpm run typecheck` — no type errors
  - [ ] 7.3 Run `vp lint` — no lint errors

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

### Debug Log References

### Completion Notes List

### File List

