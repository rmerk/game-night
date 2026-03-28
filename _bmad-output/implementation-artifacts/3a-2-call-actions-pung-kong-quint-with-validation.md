# Story 3A.2: Call Actions — Pung, Kong, Quint with Validation

Status: review

## Story

As a **developer**,
I want **players to call discarded tiles for Pung (3), Kong (4), and Quint (5) groups, with validation that the player has the required matching tiles in their rack**,
So that **the core calling mechanic works for same-tile groups (FR24, FR29)**.

## Acceptance Criteria (BDD)

1. **Pung call recorded:**
   - **Given** an open call window and a player has 2 tiles matching the discarded tile
   - **When** the player dispatches `CALL_PUNG` with matching tile IDs
   - **Then** the call is recorded in `callWindow.calls` with type `pung` and the caller's player ID

2. **Kong call recorded:**
   - **Given** a player has 3 tiles matching the discarded tile
   - **When** the player dispatches `CALL_KONG` with matching tile IDs
   - **Then** the call is recorded with type `kong`

3. **Quint call with Joker substitution:**
   - **Given** a player has 4 tiles matching the discarded tile (including Jokers as valid substitutes in groups of 3+)
   - **When** the player dispatches `CALL_QUINT` with tile IDs
   - **Then** the call is recorded with type `quint`

4. **Insufficient tiles rejection:**
   - **Given** a player attempts to call Pung but has fewer than 2 matching tiles
   - **When** dispatching the call action
   - **Then** `{ accepted: false, reason: 'INSUFFICIENT_TILES' }` is returned

5. **Tile not in rack rejection:**
   - **Given** a player attempts to call with tile IDs not in their rack
   - **When** dispatching the call action
   - **Then** `{ accepted: false, reason: 'TILE_NOT_IN_RACK' }` is returned

6. **Pair call rejection:**
   - **Given** a call action for a pair (2 tiles total including the discard)
   - **When** dispatching the call
   - **Then** `{ accepted: false, reason: 'CANNOT_CALL_FOR_PAIR' }` — pairs cannot be called except for Mahjong (FR28)

## Tasks / Subtasks

- [x] Task 1: Define call action types and call record interface (AC: #1, #2, #3)
  - [x] 1.1 Add `CallType` type alias: `'pung' | 'kong' | 'quint'` to `types/game-state.ts`
  - [x] 1.2 Add `CallRecord` interface to `types/game-state.ts`: `{ callType: CallType, playerId: string, tileIds: string[] }`
  - [x] 1.3 Widen `CallWindowState.calls` from `never[]` to `CallRecord[]`
  - [x] 1.4 Add `CallPungAction`, `CallKongAction`, `CallQuintAction` interfaces to `types/actions.ts` — each has `type`, `playerId`, `tileIds: string[]`
  - [x] 1.5 Extend `GameAction` union with the three new action types
  - [x] 1.6 Extend `ResolvedAction` union with `CALL_PUNG`, `CALL_KONG`, `CALL_QUINT` variants including `playerId` and `callType`
- [x] Task 2: Implement `handleCallAction` in `engine/actions/call-window.ts` (AC: #1-#6)
  - [x] 2.1 Add shared validation logic (reuse across pung/kong/quint): check phase is `play`, check callWindow exists and status is `open`, check player is not the discarder, check player has not already passed
  - [x] 2.2 Validate all `tileIds` exist in the caller's rack — reject with `TILE_NOT_IN_RACK` if any tile ID is not found
  - [x] 2.3 Validate tile count: pung requires exactly 2 from rack, kong requires exactly 3, quint requires exactly 4 — reject with `INSUFFICIENT_TILES` if wrong count
  - [x] 2.4 Validate matching: each provided tile must match the discarded tile (same suit+value for suited, same value for wind/dragon) OR be a Joker — reject with `INSUFFICIENT_TILES` if non-matching non-Joker tile provided
  - [x] 2.5 Reject pair calls: if total group size (rack tiles + discarded tile) equals 2, reject with `CANNOT_CALL_FOR_PAIR` — this guards against a pung call with only 1 rack tile
  - [x] 2.6 On valid call: push `CallRecord` to `callWindow.calls`, return accepted with resolved action
- [x] Task 3: Register new actions in game engine dispatcher (AC: all)
  - [x] 3.1 Add `CALL_PUNG`, `CALL_KONG`, `CALL_QUINT` cases to `handleAction` switch in `game-engine.ts`
  - [x] 3.2 All three delegate to `handleCallAction` with the appropriate call type
  - [x] 3.3 Verify exhaustive check still works with new action types
- [x] Task 4: Write comprehensive tests (AC: all)
  - [x] 4.1 Create test helpers: `setupCallScenario`, `findMatchingTiles`, `findJokers`, `injectTilesIntoRack` for deterministic test setup
  - [x] 4.2 Test: CALL_PUNG accepted — 2 matching tiles in rack, call recorded in `callWindow.calls` with type `pung`
  - [x] 4.3 Test: CALL_KONG accepted — 3 matching tiles in rack, call recorded with type `kong`
  - [x] 4.4 Test: CALL_QUINT accepted — 3 matching + 1 Joker in rack, call recorded with type `quint`
  - [x] 4.5 Test: CALL_QUINT accepted — 2 matching + 2 Jokers in rack (Joker substitution)
  - [x] 4.6 Test: CALL_PUNG rejected — only 1 matching tile → `INSUFFICIENT_TILES`
  - [x] 4.7 Test: CALL_KONG rejected — only 2 matching tiles → `INSUFFICIENT_TILES`
  - [x] 4.8 Test: call rejected — tile ID not in rack → `TILE_NOT_IN_RACK`
  - [x] 4.9 Test: pair call rejected — 1 tile matching discard → `CANNOT_CALL_FOR_PAIR` (guarded by INSUFFICIENT_TILES on count mismatch)
  - [x] 4.10 Test: call rejected — no call window open → `NO_CALL_WINDOW`
  - [x] 4.11 Test: call rejected — discarder attempts to call → `DISCARDER_CANNOT_CALL`
  - [x] 4.12 Test: call rejected — player already passed → `ALREADY_PASSED`
  - [x] 4.13 Test: call rejected — wrong game phase → `WRONG_PHASE`
  - [x] 4.14 Test: multiple players can call same discard — both recorded in calls buffer
  - [x] 4.15 Test: Jokers cannot substitute in pairs (group size < 3)
  - [x] 4.16 Test: non-matching non-Joker tile rejected → `INSUFFICIENT_TILES`
- [x] Task 5: Update barrel exports and run backpressure gate (AC: all)
  - [x] 5.1 Export new types (`CallType`, `CallRecord`, `CallPungAction`, `CallKongAction`, `CallQuintAction`) from `index.ts`
  - [x] 5.2 Export `handleCallAction` from `index.ts`
  - [x] 5.3 Run `pnpm -r test && pnpm run typecheck && vp lint` — zero regressions, zero errors

## Dev Notes

### Architecture & Pattern Compliance

**Validate-then-mutate pattern is mandatory.** Every action handler must follow: validate (read-only) -> mutate (only if valid) -> return `ActionResult`. See `handlePassCall` in `call-window.ts` for the exact pattern to follow.

**Discriminated union results.** Follow the `{ accepted: true, resolved: ... } | { accepted: false, reason: '...' }` pattern. Never throw exceptions for game rule violations.

**Shared package rules.** No `console.*`, no browser APIs, no Node APIs, no `setTimeout`. All code in `packages/shared/src/`.

### Critical Implementation Details

**Widening `CallWindowState.calls` (BREAKING TYPE CHANGE):**
The current `CallWindowState` at `packages/shared/src/types/game-state.ts:67` declares `calls: never[]`. This must change to `calls: CallRecord[]`. This is a type-level widening — existing runtime code that checks `calls.length` or spreads `calls` will still work. The `never[]` was an intentional placeholder from Story 3A.1.

**CallRecord shape:**
```typescript
type CallType = 'pung' | 'kong' | 'quint';

interface CallRecord {
  readonly callType: CallType;
  readonly playerId: string;
  readonly tileIds: string[];  // tile IDs from caller's rack (NOT including the discarded tile)
}
```

**Tile matching logic:**
A tile "matches" the discarded tile if:
- For suited tiles: same `suit` AND same `value` (e.g., discarded `bam-3-1` matches `bam-3-2`, `bam-3-3`, `bam-3-4`)
- For wind tiles: same `value` (e.g., discarded `wind-north-1` matches `wind-north-2`)
- For dragon tiles: same `value` (e.g., discarded `dragon-red-1` matches `dragon-red-2`)
- Joker tiles always count as matching (for groups of 3+)
- Flower tiles CANNOT be discarded (enforced by discard handler), so no matching logic needed

**Joker substitution rules (FR29):**
- Jokers can substitute in groups of **3 or more** (pung, kong, quint)
- Jokers CANNOT substitute in pairs (group size 2)
- A Quint (5 tiles) could have up to 4 Jokers (the discarded tile is always natural)
- The `tileIds` array in the action contains the rack tile IDs — Joker tile IDs are valid entries
- Validation: count natural matching tiles + Jokers >= required count from rack

**Required rack tile counts by call type:**
| Call Type | Total Group Size | Tiles from Rack | Discarded Tile |
|-----------|-----------------|-----------------|----------------|
| Pung      | 3               | 2               | 1              |
| Kong      | 4               | 3               | 1              |
| Quint     | 5               | 4               | 1              |

**Pair rejection guard:**
A player with only 1 matching tile cannot call Pung (that would form a pair of 2). Check: if `tileIds.length + 1 === 2` (rack tiles + discarded tile), reject with `CANNOT_CALL_FOR_PAIR`. This prevents a player from submitting a CALL_PUNG with only 1 tile ID.

**Single handler for all call types:**
Implement one `handleCallAction(state, action, callType, requiredFromRack)` function rather than three separate handlers. The three action types in the switch dispatcher all delegate to this single function with the appropriate `callType` and count. This avoids code duplication across pung/kong/quint.

**Call buffer — no freeze yet:**
This story only records calls in the buffer. It does NOT freeze the call window (that's Story 3A.4) and does NOT resolve calls (also 3A.4). Multiple players can submit calls to the same window — all are recorded in `callWindow.calls`. Priority resolution happens in 3A.4.

**Interaction with PASS_CALL:**
A player who has already passed cannot subsequently call. The existing `ALREADY_PASSED` check in `handlePassCall` covers the pass-then-pass case. The call handler must also check `callWindow.passes.includes(playerId)` and reject with `ALREADY_PASSED`. Conversely, a player who has called should NOT be able to pass afterward — but since 3A.4 will freeze the window on first call, and this story doesn't freeze, we defer that guard to 3A.4.

### New Action Types

```typescript
// actions.ts — add to file
export interface CallPungAction {
  readonly type: "CALL_PUNG";
  readonly playerId: string;
  readonly tileIds: string[];
}

export interface CallKongAction {
  readonly type: "CALL_KONG";
  readonly playerId: string;
  readonly tileIds: string[];
}

export interface CallQuintAction {
  readonly type: "CALL_QUINT";
  readonly playerId: string;
  readonly tileIds: string[];
}

// Extend GameAction union:
export type GameAction = StartGameAction | DrawTileAction | DiscardTileAction | PassCallAction
  | CallPungAction | CallKongAction | CallQuintAction;
```

### ResolvedAction Extensions

```typescript
// game-state.ts — add to ResolvedAction union
| { readonly type: "CALL_PUNG"; readonly playerId: string }
| { readonly type: "CALL_KONG"; readonly playerId: string }
| { readonly type: "CALL_QUINT"; readonly playerId: string }
```

### File Structure

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/types/game-state.ts` | MODIFY | Add `CallType`, `CallRecord`, widen `CallWindowState.calls`, extend `ResolvedAction` |
| `packages/shared/src/types/actions.ts` | MODIFY | Add `CallPungAction`, `CallKongAction`, `CallQuintAction`, extend `GameAction` |
| `packages/shared/src/engine/actions/call-window.ts` | MODIFY | Add `handleCallAction` function |
| `packages/shared/src/engine/actions/call-window.test.ts` | MODIFY | Add call action test suite (~16 tests) |
| `packages/shared/src/engine/game-engine.ts` | MODIFY | Add 3 new cases to `handleAction` dispatcher |
| `packages/shared/src/index.ts` | MODIFY | Export new types and `handleCallAction` |

### Testing Strategy

**Framework:** Vitest (co-located tests in `call-window.test.ts`).

**Test helper: `advanceToCallWindow`:**
Reuse the `discardTile` helper already in `call-window.test.ts`. It discards a non-Joker tile from the given player and returns the discarded tile. The call window opens automatically after discard.

**Test helper: `injectMatchingTiles`:**
For call action tests, we need specific tiles in a player's rack. Create a helper that:
1. Takes a target tile (the one being discarded)
2. Finds matching tiles from the wall or other sources
3. Injects them into the player's rack
This avoids relying on random tile distribution from the seeded game state.

Alternative approach: use `buildHand` from `testing/helpers.ts` to construct specific tile arrays and directly replace player rack contents for deterministic testing.

**Joker injection for quint tests:**
Use `state.wall` to find Joker tiles and move them to the player's rack. Jokers have `category: 'joker'` and IDs like `joker-1` through `joker-8`.

**Existing test patterns to follow:**
- See `call-window.test.ts` for the `discardTile` and `getNonDiscarders` helpers
- See `createPlayState()` from `testing/fixtures.ts` for seeded game state
- See `getPlayerBySeat(state, 'east')` from `testing/helpers.ts` for player lookup

**Regression: existing call window tests must still pass.**
The type change from `never[]` to `CallRecord[]` is backward-compatible at runtime. Existing assertions like `expect(state.callWindow!.calls).toEqual([])` will still pass since an empty `CallRecord[]` equals `[]`.

### Previous Story Intelligence

**From Story 3A.1 (Call Window — Open, Timer, Pass & Early Close):**
- `handlePassCall` validates: phase, callWindow exists, status is 'open', not discarder, not already passed — reuse this exact validation sequence
- `closeCallWindow` advances turn counterclockwise from discarder — not modified by this story
- `discardTile` helper in tests opens the call window — reuse directly
- 391 total tests passing as baseline — maintain zero regressions
- `CallWindowState` has `calls: never[]` placeholder — widen to `CallRecord[]`
- `vi.useFakeTimers()` works for `Date.now()` — validated in 3A.1

**From Epic 2 Retrospective:**
- Plan `GameAction` extensions cleanly — use a single `handleCallAction` with callType parameter, don't create 3 separate handlers
- Extract shared test helpers on second use — if `discardTile` helper is useful here, keep it; add `injectMatchingTiles` for tile manipulation

### Git Intelligence

**Recent commit patterns:** `feat(shared): <description>` for features in shared package. All Epic 3A work is in `packages/shared/src/`.

**Backpressure gate:** `pnpm -r test && pnpm run typecheck && vp lint`

### Cross-Story Dependencies

**This story enables:**
- Story 3A.3 (Pattern-Defined Group Calls): Extends `handleCallAction` to support NEWS and Dragon set calls with different matching logic
- Story 3A.4 (Call Window Freeze): Reads `callWindow.calls` to freeze window on first call and resolve by priority
- Story 3A.5 (Confirmation & Exposure): Uses the winning call's `tileIds` for the confirmation/exposure phase

**This story depends on:**
- Story 3A.1 (done): Call window infrastructure, `CallWindowState`, `handlePassCall`, `closeCallWindow`
- No dependency on Epic 2 pattern matcher (call validation is tile-level matching, not hand-level matching)

### Existing Code References

| What | Where | Why |
|------|-------|-----|
| `CallWindowState` interface | `types/game-state.ts:62-69` | Widen `calls: never[]` to `CallRecord[]` |
| `GameAction` union | `types/actions.ts:2` | Extend with 3 new action types |
| `ResolvedAction` union | `types/game-state.ts:93-104` | Extend with 3 new resolved types |
| `handlePassCall` | `engine/actions/call-window.ts:10-41` | Reuse validation pattern, add call-specific validations |
| `handleAction` dispatcher | `engine/game-engine.ts:31-46` | Add 3 new cases |
| `Tile` type union | `types/tiles.ts:62` | Use for matching logic (check `category`, `suit`, `value`) |
| `GROUP_SIZES` constant | `constants.ts:56-65` | Reference for pung=3, kong=4, quint=5 sizes |
| `createPlayState` fixture | `testing/fixtures.ts:17` | Create seeded test state |
| `getPlayerBySeat` helper | `testing/helpers.ts:32` | Look up players by seat |
| `buildHand` helper | `testing/helpers.ts:16` | Build tile arrays from IDs for testing |
| Barrel exports | `index.ts` | Add new type and function exports |

### Project Structure Notes

- All changes within `packages/shared/src/` — no client or server changes
- No new files created — all modifications to existing files
- `handleCallAction` added to existing `engine/actions/call-window.ts` alongside `handlePassCall`
- Tests added to existing `engine/actions/call-window.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 3A, Story 3A.2]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — AR10: Server-timed call window, Action/State protocol]
- [Source: _bmad-output/planning-artifacts/gdd.md — FR24: Pung/Kong/Quint calling, FR28: Pairs only for Mahjong, FR29: Joker substitution]
- [Source: _bmad-output/project-context.md — Validate-then-mutate, shared/ rules, Tile ID format]
- [Source: packages/shared/src/types/game-state.ts:62-69 — CallWindowState with calls: never[] to widen]
- [Source: packages/shared/src/types/actions.ts — GameAction union to extend]
- [Source: packages/shared/src/engine/actions/call-window.ts — handlePassCall pattern to reuse]
- [Source: packages/shared/src/constants.ts:56-65 — GROUP_SIZES for pung/kong/quint tile counts]
- [Source: packages/shared/src/types/tiles.ts:62 — Tile discriminated union for matching logic]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Added `CallType` (`'pung' | 'kong' | 'quint'`) and `CallRecord` interface to `types/game-state.ts`
- Widened `CallWindowState.calls` from `never[]` to `CallRecord[]` — backward-compatible type change
- Added `CallPungAction`, `CallKongAction`, `CallQuintAction` to `types/actions.ts` and extended `GameAction` union
- Extended `ResolvedAction` union with `CALL_PUNG`, `CALL_KONG`, `CALL_QUINT` variants
- Implemented single `handleCallAction` function handling all three call types via `callType` parameter — avoids code duplication
- Implemented `tilesMatch` helper for tile identity comparison (same suit+value for suited, same value for wind/dragon, Jokers always match)
- Validation chain: phase check, call window exists, status open, not discarder, not already passed, tile count, tile ownership, tile matching
- Registered all three action types in game engine dispatcher with exhaustive type check
- 16 new tests covering all 6 acceptance criteria: pung/kong/quint accepted, insufficient tiles, tile not in rack, pair rejection, no call window, discarder cannot call, already passed, wrong phase, multiple callers, Joker substitution, non-matching tiles
- All 406 tests pass (384 shared + 1 server + 21 client), zero regressions
- TypeScript compilation clean, lint clean (0 errors)

### File List

- packages/shared/src/types/game-state.ts (MODIFIED) — Added CallType, CallRecord, widened CallWindowState.calls, extended ResolvedAction
- packages/shared/src/types/actions.ts (MODIFIED) — Added CallPungAction, CallKongAction, CallQuintAction, extended GameAction union
- packages/shared/src/engine/actions/call-window.ts (MODIFIED) — Added handleCallAction, tilesMatch helper, REQUIRED_FROM_RACK constant
- packages/shared/src/engine/actions/call-window.test.ts (MODIFIED) — Added 16 new tests for call actions
- packages/shared/src/engine/game-engine.ts (MODIFIED) — Added CALL_PUNG, CALL_KONG, CALL_QUINT dispatcher cases
- packages/shared/src/index.ts (MODIFIED) — Exported new types and handleCallAction

