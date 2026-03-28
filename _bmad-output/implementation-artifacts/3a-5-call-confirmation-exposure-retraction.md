# Story 3A.5: Call Confirmation, Exposure & Retraction

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **the winning caller to confirm their call by selecting tiles to expose within 5 seconds, with the ability to retract if the group is invalid or they made a mistake**,
So that **calls are confirmed with a safety net for misclicks (FR24, FR25, FR57, FR58)**.

## Acceptance Criteria

1. **AC1 — Confirmation phase entry:** Given a player wins call priority (via `resolveCallWindow`), when they enter the confirmation phase, then `callWindow.status` changes to `"confirming"`, `callWindow.confirmingPlayerId` is set, a 5-second confirmation timer starts, and a `CALL_CONFIRMATION_STARTED` resolved action is emitted with the caller ID, call type, and timer duration.

2. **AC2 — Valid confirmation:** Given a valid `CONFIRM_CALL` action with tile IDs that form a legal group with the discarded tile, when the confirmation is processed, then the called tile is removed from the discard pool, the caller's selected tiles are removed from their rack, an `ExposedGroup` is created with `type`, `tiles` (called tile + rack tiles), and a fixed `identity` recorded at exposure time (FR55), the group is added to the caller's `exposedGroups`, and a `CALL_CONFIRMED` resolved action is emitted.

3. **AC3 — Exposure permanence:** Given exposed groups exist on a player, when any action attempts to modify, rearrange, or break apart an exposed group, then the attempt is rejected — exposure is permanent and irretractable once confirmed (FR58).

4. **AC4 — Invalid confirmation auto-retract:** Given a `CONFIRM_CALL` with tiles that don't form a valid group with the discarded tile, when the confirmation is processed, then the call is auto-retracted with no dead hand and no penalty (FR25). The retraction follows the same logic as explicit `RETRACT_CALL` (see AC5).

5. **AC5 — Explicit retraction with fallback:** Given a player dispatches `RETRACT_CALL` during the confirmation phase, when processed: (a) if other calls remain in the original call buffer, the next highest-priority caller enters the confirmation phase (new 5-second timer); (b) if no calls remain, the call window reopens with `status: "open"` and remaining time from the original timer, emitting `CALL_WINDOW_RESUMED`.

6. **AC6 — Confirmation timeout auto-retract:** Given the 5-second confirmation timer expires with no `CONFIRM_CALL` or `RETRACT_CALL`, when the timeout fires, then the server auto-retracts the call on the player's behalf using the same retraction logic as AC5.

7. **AC7 — Turn state after confirmed call:** Given a non-Mahjong call is successfully confirmed, when the state updates, then `currentTurn` is set to the caller, `turnPhase` is set to `"discard"` (caller must discard next), and `callWindow` is set to `null`. Story 3a-6 handles skip-ahead narration — this story only sets the correct turn state.

## Tasks / Subtasks

- [ ] Task 1: Extend types for confirmation phase (AC: 1, 2, 3)
  - [ ] 1.1 Add `"confirming"` to `CallWindowState.status` union in `game-state.ts`
  - [ ] 1.2 Add `confirmingPlayerId: string | null`, `confirmationExpiresAt: number | null`, and `remainingCallers: CallRecord[]` fields to `CallWindowState`
  - [ ] 1.3 Add `CONFIRM_CALL` and `RETRACT_CALL` to `GameAction` discriminated union in `actions.ts` — `ConfirmCallAction = { type: 'CONFIRM_CALL'; playerId: string; tileIds: string[] }`, `RetractCallAction = { type: 'RETRACT_CALL'; playerId: string }`
  - [ ] 1.4 Add `CALL_CONFIRMATION_STARTED`, `CALL_CONFIRMED`, `CALL_RETRACTED`, and `CALL_WINDOW_RESUMED` to `ResolvedAction` union in `game-state.ts`
  - [ ] 1.5 Write tests: type-level validation that new types compile correctly (create objects of each new type and assert structure)

- [ ] Task 2: Implement confirmation phase entry after call resolution (AC: 1)
  - [ ] 2.1 Create `enterConfirmationPhase(state, winningCall, remainingCallers)` function in `call-window.ts` that: sets `status = "confirming"`, sets `confirmingPlayerId`, stores `remainingCallers`, starts 5-second timer (`confirmationExpiresAt = Date.now() + 5000`), returns `ActionResult` with `CALL_CONFIRMATION_STARTED` resolved action
  - [ ] 2.2 Wire `resolveCallWindow` to call `enterConfirmationPhase` with the winning call and losing callers (instead of returning the winner directly)
  - [ ] 2.3 Write tests: after resolution, callWindow.status is `"confirming"` with correct confirmingPlayerId
  - [ ] 2.4 Write tests: remainingCallers contains losing callers sorted by priority (for fallback on retraction)
  - [ ] 2.5 Write tests: CALL_CONFIRMATION_STARTED resolved action contains callerId, callType, and timerDuration

- [ ] Task 3: Implement `handleConfirmCall` action handler (AC: 2, 4, 7)
  - [ ] 3.1 Create `handleConfirmCall(state, action, logger)` in `call-window.ts` following validate-then-mutate pattern
  - [ ] 3.2 Validation: reject if `callWindow` is null or `status !== "confirming"` (`NO_CONFIRMATION_PHASE`), reject if `action.playerId !== callWindow.confirmingPlayerId` (`NOT_CONFIRMING_PLAYER`), reject if any tile ID not in caller's rack (`TILE_NOT_IN_RACK`)
  - [ ] 3.3 Validation: verify tile IDs + discarded tile form a valid group matching the original call type. Reuse existing validation logic: `tilesMatch` for same-tile groups, `validateNewsGroup`/`validateDragonSetGroup` for pattern-defined groups. If invalid, auto-retract (call `handleRetraction` internally) and return `CALL_RETRACTED` with `reason: "INVALID_GROUP"` — not a rejection, but a successful retraction
  - [ ] 3.4 Mutation on valid confirmation: remove discarded tile from discarder's `discardPool`, remove selected tiles from caller's `rack`, create `ExposedGroup` with fixed identity (use tile face values to determine group identity — e.g., "Kong of 3-Bam"), add group to caller's `exposedGroups`
  - [ ] 3.5 Mutation on valid confirmation: set `currentTurn = callerId`, set `turnPhase = "discard"`, set `callWindow = null`
  - [ ] 3.6 Return `CALL_CONFIRMED` resolved action with: callerId, callType, exposedTileIds, calledTileId, fromPlayerId (discarder), groupIdentity
  - [ ] 3.7 Write tests: valid pung confirmation — tiles removed from rack, discard removed from pool, exposed group created with correct identity
  - [ ] 3.8 Write tests: valid kong confirmation — 3 tiles from rack + 1 discarded tile
  - [ ] 3.9 Write tests: valid quint confirmation — 4 tiles from rack + 1 discarded tile
  - [ ] 3.10 Write tests: valid NEWS confirmation — 3 wind tiles from rack + 1 discarded wind tile, with Joker substitution
  - [ ] 3.11 Write tests: valid dragon set confirmation — 2 dragon tiles from rack + 1 discarded dragon tile, with Joker substitution
  - [ ] 3.12 Write tests: invalid group auto-retracts (tiles don't match call type)
  - [ ] 3.13 Write tests: wrong player attempts confirmation — rejected with zero mutations
  - [ ] 3.14 Write tests: tile not in rack — rejected with zero mutations
  - [ ] 3.15 Write tests: no confirmation phase active — rejected with zero mutations
  - [ ] 3.16 Write tests: after valid confirmation, currentTurn is caller and turnPhase is "discard"

- [ ] Task 4: Implement `handleRetractCall` and retraction fallback logic (AC: 5, 6)
  - [ ] 4.1 Create `handleRetraction(state, logger)` internal helper in `call-window.ts` — shared by explicit retract, invalid confirmation, and timeout
  - [ ] 4.2 Retraction with remaining callers: pop next caller from `remainingCallers`, call `enterConfirmationPhase` for them (new 5-second timer), return `CALL_RETRACTED` with `nextCallerId`
  - [ ] 4.3 Retraction with no remaining callers: calculate remaining time from original call window timer, if time remains set `callWindow.status = "open"` and clear confirmation fields, return `CALL_WINDOW_RESUMED` with `remainingTime`. If no time remains, close call window and advance turn (next player draws)
  - [ ] 4.4 Create `handleRetractCall(state, action, logger)` action handler — validates confirming player, delegates to `handleRetraction`
  - [ ] 4.5 Write tests: retraction with 2 remaining callers — next highest priority caller enters confirmation
  - [ ] 4.6 Write tests: retraction with 1 remaining caller — that caller enters confirmation
  - [ ] 4.7 Write tests: retraction with 0 remaining callers and time remaining — window reopens as "open"
  - [ ] 4.8 Write tests: retraction with 0 remaining callers and no time remaining — window closes, next player draws
  - [ ] 4.9 Write tests: wrong player attempts retraction — rejected with zero mutations
  - [ ] 4.10 Write tests: retraction when not in confirmation phase — rejected

- [ ] Task 5: Implement confirmation timeout handling (AC: 6)
  - [ ] 5.1 Create `handleConfirmationTimeout(state, logger)` that validates confirmation phase is active and delegates to `handleRetraction`
  - [ ] 5.2 Wire timeout into `closeCallWindow` or create a separate trigger path — the server timer calls this when 5 seconds expire
  - [ ] 5.3 Write tests: timeout triggers auto-retraction with same behavior as explicit RETRACT_CALL
  - [ ] 5.4 Write tests: timeout with remaining callers promotes next caller
  - [ ] 5.5 Write tests: timeout with no remaining callers reopens or closes window

- [ ] Task 6: Implement exposure permanence validation (AC: 3)
  - [ ] 6.1 Verify that no existing action handler mutates `exposedGroups` after creation (audit `handleDiscard`, `handleDraw`, call handlers)
  - [ ] 6.2 Add a defensive check: if any future action attempts to splice/modify `exposedGroups`, the type system and readonly modifiers prevent it. Add a comment documenting the immutability contract.
  - [ ] 6.3 Write tests: exposed groups persist unchanged through subsequent discard and draw actions
  - [ ] 6.4 Write tests: exposed group count and tile contents are stable across multiple turns

- [ ] Task 7: Wire new actions into game engine dispatcher and exports (AC: all)
  - [ ] 7.1 Register `CONFIRM_CALL` and `RETRACT_CALL` action types in `game-engine.ts` dispatcher (`handleAction` switch statement)
  - [ ] 7.2 Register `CONFIRMATION_TIMEOUT` if using an explicit action type for server-triggered timeout
  - [ ] 7.3 Export all new public functions from `index.ts` barrel
  - [ ] 7.4 Write integration tests: full call flow — discard → call → freeze → resolve → confirm → exposed group created → turn advances
  - [ ] 7.5 Write integration tests: full retraction flow — discard → call → freeze → resolve → retract → fallback caller confirms
  - [ ] 7.6 Write integration tests: full timeout flow — discard → call → freeze → resolve → timeout → window reopens

- [ ] Task 8: Backpressure gate and final validation (AC: all)
  - [ ] 8.1 Run `pnpm -r test` — all tests pass (zero regressions)
  - [ ] 8.2 Run `pnpm run typecheck` — no type errors
  - [ ] 8.3 Run `pnpm lint` — no lint errors
  - [ ] 8.4 Verify all 7 ACs are satisfied by reviewing test coverage against each AC

## Dev Notes

### Architecture Patterns

- **Validate-then-mutate** — every handler: validate (read-only) → mutate (only if valid) → log → return `ActionResult`. Zero partial mutations on rejection.
- **Discriminated unions** — extend `GameAction`, `ResolvedAction`, `CallWindowState.status` with new variants. Exhaustiveness checking via `default: never` in switch statements.
- **Pure functions in shared/** — no `console.*`, no browser/Node APIs, no runtime deps. Logger injected, never imported.
- **Server authority** — clients submit actions, server validates and broadcasts. No optimistic updates.

### Key Implementation Decisions

**Confirmation phase entry:** After `resolveCallWindow` determines the winner, the function now enters the confirmation phase instead of returning the winner directly. The `callWindow` state was intentionally left non-null by story 3a-4 for exactly this purpose (see JSDoc comment on `resolveCallWindow` in `call-window.ts:340`).

**Retraction cascading:** When a call is retracted (explicit, invalid, or timeout), the system checks `remainingCallers` — sorted by priority from the original resolution. This avoids re-running `resolveCallPriority`. The losing callers are stored at resolution time and consumed on retraction.

**Window reopening:** When all callers retract and time remains, the window reopens as `"open"` — NOT `"frozen"`. This allows other players to make new calls. The remaining time is calculated from the original `openedAt` timestamp.

**Exposed group identity:** Fixed at exposure time per FR55. Use the discarded tile's face value and the call type to determine identity (e.g., "Kong of 3-Bam"). For pattern-defined groups, identity is "NEWS" or "Dragon Set". Jokers in the group don't change the identity — they substitute for the natural tile they represent.

**Turn state after confirmation:** Set `currentTurn = callerId` and `turnPhase = "discard"`. The caller must discard next. Do NOT handle skip-ahead narration or `fromPlayerId` in the resolved action for turn advancement — that's story 3a-6's responsibility. However, DO include `fromPlayerId` (the discarder) in `CALL_CONFIRMED` so 3a-6 can use it.

**Mahjong call confirmation:** For this story, if the confirmed call type is `"mahjong"`, do NOT enter the discard phase. Instead, leave the state ready for story 3a-7 to handle Mahjong declaration/validation. Set `turnPhase = "mahjong_declared"` or similar — coordinate with 3a-7's expected state. For now, treat Mahjong confirmation the same as other calls but skip the `turnPhase = "discard"` step. Add a TODO comment for 3a-7 integration.

**Confirmation timer:** The 5-second timer is tracked via `confirmationExpiresAt` timestamp on the state. The server is responsible for scheduling and firing the timeout (not shared/ — no `setTimeout` in shared/). The `handleConfirmationTimeout` function in shared/ is pure — the server calls it when its timer fires.

### Existing Code to Modify

| File | Change |
|------|--------|
| `packages/shared/src/types/game-state.ts` | Add `"confirming"` to `CallWindowState.status`, add `confirmingPlayerId`, `confirmationExpiresAt`, `remainingCallers` fields, add new `ResolvedAction` variants |
| `packages/shared/src/types/actions.ts` | Add `ConfirmCallAction`, `RetractCallAction` to `GameAction` union |
| `packages/shared/src/engine/actions/call-window.ts` | Add `enterConfirmationPhase`, `handleConfirmCall`, `handleRetractCall`, `handleRetraction`, `handleConfirmationTimeout`; modify `resolveCallWindow` to enter confirmation phase |
| `packages/shared/src/engine/actions/call-window.test.ts` | Add all new test cases (~40+ tests expected) |
| `packages/shared/src/engine/game-engine.ts` | Register `CONFIRM_CALL`, `RETRACT_CALL`, `CONFIRMATION_TIMEOUT` in action dispatcher |
| `packages/shared/src/index.ts` | Export new functions |

### Existing Code to Reuse

- **`resolveCallWindow(state)`** — already determines winner and leaves callWindow alive. Modify to enter confirmation phase.
- **`resolveCallPriority(calls, discarderSeatWind, players)`** — reuse for ordering remainingCallers at resolution time.
- **`tilesMatch(tile, discardedTile)`** — reuse for validating same-tile group confirmation.
- **`validateNewsGroup(rackTiles, discardedTile)`** — reuse for NEWS confirmation validation.
- **`validateDragonSetGroup(rackTiles, discardedTile)`** — reuse for Dragon set confirmation validation.
- **`isPatternDefinedCall(callType)`** — reuse to branch validation logic.
- **`getSeatDistance(fromSeat, toSeat)`** — reuse for priority ordering of remaining callers.
- **`SEATS` constant** — counterclockwise seat order.
- **`GROUP_SIZES` constant** — expected tile count per group type (pung=3, kong=4, quint=5, news=4, dragon_set=3).
- **`ExposedGroup` type** — already defined with `type`, `tiles`, and `identity` fields.
- **`setupCallScenario` / `setupPatternCallScenario`** test helpers — extend for confirmation phase scenarios.
- **`getNonDiscarders` / `injectTilesIntoRack`** test helpers — reuse for setting up confirming players.
- **`closeCallWindow(state, reason)`** — may need modification to handle confirmation timeout path.

### Critical Gotchas

1. **Discarded tile removal from discard pool:** The called tile must be removed from the discarder's `discardPool` on confirmation — NOT on call resolution. Until confirmed, the tile stays in the pool (retraction might return it).
2. **Tile IDs, not indices:** Always reference tiles by ID (`bam-3-2`). The `tileIds` in `CONFIRM_CALL` are rack tile IDs. Never use array indices.
3. **Joker substitution in groups:** Jokers can substitute for any tile in groups of 3+. The `ExposedGroup.identity` reflects the natural tile identity, not the Joker. A "Kong of 3-Bam" with 2 Jokers is still "Kong of 3-Bam".
4. **NEWS/Dragon set validation:** These are pattern-defined groups (different wind/dragon tiles), not same-tile groups. Validation must verify the combination of tiles + discard forms a complete set, with Joker substitution allowed.
5. **No `setTimeout` in shared/:** Timer scheduling is the server's job. `confirmationExpiresAt` is a timestamp for the server to check against. The `handleConfirmationTimeout` function is called BY the server when the timer fires.
6. **Remaining time calculation:** When reopening the window after all callers retract, calculate: `originalDuration - (now - openedAt)`. If ≤ 0, close the window and advance the turn instead.
7. **`callWindow = null` cleanup:** Only set `callWindow = null` after successful confirmation. Retraction keeps callWindow alive for fallback callers or window reopen.
8. **Readonly modifiers:** `ExposedGroup` fields are readonly. Once created, they cannot be mutated. This is type-level enforcement — don't attempt runtime freezing.

### Testing Standards

- Co-located tests in `call-window.test.ts`
- Red-green-refactor: write failing tests first
- Zero-mutation-on-rejection tests for all new rejection paths
- Derive expected values from data — never hardcode magic numbers
- Use `SEATS` constant in tests for seat position assertions
- Use `GROUP_SIZES` for expected tile counts
- Test helpers: extend `setupCallScenario` for confirmation phase setup
- Expect ~40+ new tests (464 existing → ~505+ total)
- Use `vi.useFakeTimers()` for confirmation timeout tests

### Previous Story Intelligence (3a-4)

**Patterns established:**
- `handleCallAction` uses shared validation path with branching for pattern-defined vs same-tile calls
- `REQUIRED_FROM_RACK` maps `CallType` to required tile count from rack
- Test helpers `setupCallScenario` and `setupPatternCallScenario` handle call window setup with seed 42
- `isPatternDefinedCall` distinguishes NEWS/Dragon from Pung/Kong/Quint
- `resolveCallWindow` intentionally leaves `callWindow` non-null after resolution (documented via JSDoc)
- `ALREADY_CALLED` guard prevents duplicate calls from same player

**Code review findings carried forward:**
- Always add EVERY new export to `index.ts` barrel
- Document intentional design decisions with comments (especially non-obvious state retention)
- Zero-mutation-on-rejection is verified by comparing state before/after rejected actions

**Codebase stats at 3a-4 completion:** 464 tests passing, typecheck clean, lint 0 errors.

### Forward Compatibility Notes

- **Story 3a-6 (turn advancement):** Will use `fromPlayerId` in `CALL_CONFIRMED` resolved action to animate skip-ahead. Ensure this field is included.
- **Story 3a-7 (Mahjong declaration):** Will need Mahjong-specific confirmation flow. This story should handle `callType === "mahjong"` by NOT setting `turnPhase = "discard"` — instead set a phase that 3a-7 can pick up.
- **Story 3b-4 (TileSelectionAction):** The UX spec notes that call confirmation tile selection should later be refactored to use a shared `TileSelectionAction` composable when Epic 3B ships. For now, implement the server-side logic without assuming any client-side composable.
- **Joker exchange (3c-1):** Uses `ExposedGroup.identity` to determine what tile a Joker represents. Ensure identity is correctly recorded.

### Project Structure Notes

- All changes in `packages/shared/src/` — this is pure game logic
- No client/ or server/ changes needed for this story
- No new files needed — extend existing `call-window.ts`, `call-window.test.ts`, `game-state.ts`, `actions.ts`, `game-engine.ts`, `index.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 3A.5 section, FR24/FR25/FR55/FR57/FR58]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Decision 6: Call Window Synchronization, Retraction Flow, ExposedGroup types]
- [Source: _bmad-output/planning-artifacts/gdd.md — Call Confirmation section, Exposure Rules, Retraction Boundary]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Calling Flow (confirmation phase, retraction, point of no return), TileSelectionAction pattern]
- [Source: _bmad-output/project-context.md — Validate-Then-Mutate, shared/ Package Rules, Testing Rules, Tile References, ExposedGroup identity]
- [Source: _bmad-output/implementation-artifacts/3a-4-call-window-freeze-priority-resolution.md — resolveCallWindow design, callWindow non-null after resolution, ALREADY_CALLED guard, test helper patterns]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
