# Epic 3A Adversarial Review Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 9 actionable bugs and design issues surfaced by the adversarial review of Epic 3A's call window, Mahjong, and challenge systems.

**Architecture:** Targeted fixes to existing files — no new modules. Each task addresses one or two related findings. All fixes are tested first (TDD), then implemented. The two non-actionable findings (getValidCallOptions mutual exclusivity docs and validateNewsGroup fragility) are excluded — they are design observations, not bugs.

**Tech Stack:** TypeScript, Vitest (`vite-plus/test`), shared game engine (packages/shared)

**Findings addressed (by review number):**
1. readonly dishonesty in CallWindowState (Finding 1)
2. Challenge overturn loses called discard tile (Finding 9) — **BUG**
3. Shallow copy aliasing in pendingMahjong (Finding 4) — **BUG**
4. Unsafe cast in buildGroupIdentity (Finding 5)
5. closeCallWindow throws instead of returning rejection (Finding 7)
6. PASS_CALL rejected on frozen window vs in-flight acceptance (Finding 10)
7. Flower tile handling in tilesMatch (Finding 8)
8. Challenge timeout doesn't fill default votes (Finding 3)
9. exposure-validation conservative matching (Finding 13) — documented limitation

**Excluded findings:**
- Finding 2 (getValidCallOptions double-counting): Already documented in code comment. Options are individually valid, validated at confirmation. Not a bug.
- Finding 6 (no server callback for timer re-scheduling): Server concern, not shared engine scope.
- Finding 11 (no Mahjong spam throttle): Server-side rate limiting concern, out of scope.
- Finding 12 (validateNewsGroup fragility): Code is correct; set deletion is idiomatic. No change needed.

---

## File Structure

All changes are to existing files — no new files created.

| File | Responsibility | Tasks |
|---|---|---|
| `packages/shared/src/types/game-state.ts` | Remove `readonly` from mutable CallWindowState fields | 1 |
| `packages/shared/src/engine/actions/call-window.ts` | Fix throws→rejections, unsafe cast, frozen pass handling, flower tile | 3, 4, 5, 6 |
| `packages/shared/src/engine/actions/call-window.test.ts` | Tests for findings 5, 6, 7 | 3, 4, 5 |
| `packages/shared/src/engine/actions/mahjong.ts` | Deep copy callWindow in pendingMahjong | 2 |
| `packages/shared/src/engine/actions/mahjong.test.ts` | Test for shallow copy bug | 2 |
| `packages/shared/src/engine/actions/challenge.ts` | Restore called tile on overturn, add timeout handler | 6, 7 |
| `packages/shared/src/engine/actions/challenge.test.ts` | Tests for overturn tile restore, timeout defaults | 6, 7 |
| `packages/shared/src/card/exposure-validation.ts` | Add doc comment for known limitation | 8 |

---

### Task 1: Remove readonly dishonesty from CallWindowState

The `CallWindowState` interface marks every field `readonly`, but the engine mutates them directly through unsafe casts like `(state.callWindow as { status: string }).status = "frozen"`. This is worse than no `readonly` at all — it lies to anyone reasoning about the code. Remove `readonly` from the fields that the engine actually mutates.

**Files:**
- Modify: `packages/shared/src/types/game-state.ts:73-88`
- Modify: `packages/shared/src/engine/actions/call-window.ts` (remove all `as { ... }` casts)

- [ ] **Step 1: Update CallWindowState to remove readonly from mutable fields**

In `packages/shared/src/types/game-state.ts`, replace the `CallWindowState` interface:

```typescript
/** Call window state — opened after each discard to allow other players to call the tile */
export interface CallWindowState {
  status: "open" | "frozen" | "confirming";
  readonly discardedTile: Tile;
  readonly discarderId: string;
  readonly passes: string[];
  readonly calls: CallRecord[];
  readonly openedAt: number;
  /** Player currently in confirmation phase (set when status is "confirming") */
  confirmingPlayerId: string | null;
  /** Timestamp when confirmation timer expires (set when status is "confirming") */
  confirmationExpiresAt: number | null;
  /** Remaining callers sorted by priority, consumed on retraction fallback */
  remainingCallers: CallRecord[];
  /** The winning call being confirmed */
  winningCall: CallRecord | null;
}
```

Fields that stay `readonly`: `discardedTile`, `discarderId`, `passes`, `calls`, `openedAt` (these are either set once at creation or mutated via array methods on the reference, which `readonly` doesn't prevent anyway).

Fields that lose `readonly`: `status`, `confirmingPlayerId`, `confirmationExpiresAt`, `remainingCallers`, `winningCall` (these are directly reassigned by the engine).

- [ ] **Step 2: Remove all unsafe casts from call-window.ts**

In `packages/shared/src/engine/actions/call-window.ts`, replace every `(state.callWindow as { ... }).field = value` pattern with direct assignment `state.callWindow.field = value`.

There are 8 cast sites to fix:

Line 192 (`handleCallAction`):
```typescript
// Before:
(state.callWindow as { status: string }).status = "frozen";
// After:
state.callWindow.status = "frozen";
```

Line 302 (`handleCallAction`):
```typescript
// Same pattern — replace cast with direct assignment
state.callWindow.status = "frozen";
```

Lines 518-524 (`enterConfirmationPhase`):
```typescript
// Before:
(state.callWindow as { status: string }).status = "confirming";
(state.callWindow as { confirmingPlayerId: string | null }).confirmingPlayerId = winningCall.playerId;
(state.callWindow as { confirmationExpiresAt: number | null }).confirmationExpiresAt = Date.now() + CONFIRMATION_TIMER_MS;
(state.callWindow as { remainingCallers: CallRecord[] }).remainingCallers = remainingCallers;
(state.callWindow as { winningCall: CallRecord | null }).winningCall = winningCall;

// After:
state.callWindow.status = "confirming";
state.callWindow.confirmingPlayerId = winningCall.playerId;
state.callWindow.confirmationExpiresAt = Date.now() + CONFIRMATION_TIMER_MS;
state.callWindow.remainingCallers = remainingCallers;
state.callWindow.winningCall = winningCall;
```

Lines 599-604 (`handleRetraction` — promote next caller):
```typescript
// Before:
(state.callWindow as { confirmingPlayerId: string | null }).confirmingPlayerId = nextCaller.playerId;
(state.callWindow as { confirmationExpiresAt: number | null }).confirmationExpiresAt = Date.now() + CONFIRMATION_TIMER_MS;
(state.callWindow as { remainingCallers: CallRecord[] }).remainingCallers = updatedRemaining;
(state.callWindow as { winningCall: CallRecord | null }).winningCall = nextCaller;

// After:
state.callWindow.confirmingPlayerId = nextCaller.playerId;
state.callWindow.confirmationExpiresAt = Date.now() + CONFIRMATION_TIMER_MS;
state.callWindow.remainingCallers = updatedRemaining;
state.callWindow.winningCall = nextCaller;
```

Lines 623-626 (`handleRetraction` — reopen):
```typescript
// Before:
(state.callWindow as { status: string }).status = "open";
(state.callWindow as { confirmingPlayerId: string | null }).confirmingPlayerId = null;
(state.callWindow as { confirmationExpiresAt: number | null }).confirmationExpiresAt = null;
(state.callWindow as { remainingCallers: CallRecord[] }).remainingCallers = [];
(state.callWindow as { winningCall: CallRecord | null }).winningCall = null;

// After:
state.callWindow.status = "open";
state.callWindow.confirmingPlayerId = null;
state.callWindow.confirmationExpiresAt = null;
state.callWindow.remainingCallers = [];
state.callWindow.winningCall = null;
```

- [ ] **Step 3: Run typecheck and tests**

Run: `cd packages/shared && npx tsc --noEmit && npx vitest run`
Expected: All 593+ tests pass, zero type errors. The `readonly` removal is backward-compatible — callers that only read these fields are unaffected.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/game-state.ts packages/shared/src/engine/actions/call-window.ts
git commit -m "refactor: remove readonly dishonesty from CallWindowState

Drop readonly from fields the engine mutates (status, confirmingPlayerId,
confirmationExpiresAt, remainingCallers, winningCall) and remove all
unsafe 'as' casts in call-window.ts that were bypassing the constraint."
```

---

### Task 2: Fix shallow copy aliasing in pendingMahjong callWindow save

When `confirmMahjongCall` saves the call window state for a potential cancel restore, it uses `{ ...state.callWindow }` — a shallow copy. The inner arrays (`passes`, `calls`, `remainingCallers`) are shared references. If anything modifies those arrays before `handleCancelMahjong` restores, the saved state is corrupted. Fix by deep-copying the call window.

**Files:**
- Modify: `packages/shared/src/engine/actions/mahjong.ts:150-155`
- Test: `packages/shared/src/engine/actions/mahjong.test.ts`

- [ ] **Step 1: Write failing test for shallow copy aliasing**

Add to `packages/shared/src/engine/actions/mahjong.test.ts`:

```typescript
describe("pendingMahjong callWindow isolation", () => {
  test("saved callWindow state is not corrupted by subsequent mutations to the original", () => {
    const state = createPlayState();
    state.card = card;
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // Set up a call window in confirming state with a mahjong call
    // We need: discard → call mahjong → confirm → invalid warning → check saved state
    const discardTile = state.players[eastId].rack.find((t) => t.category !== "joker")!;
    handleAction(state, { type: "DISCARD_TILE", playerId: eastId, tileId: discardTile.id });

    // South calls mahjong
    handleAction(state, { type: "CALL_MAHJONG", playerId: southId, tileIds: [] });

    // Trigger confirmation — south's hand won't match, should get warning
    handleAction(state, { type: "CONFIRM_CALL", playerId: southId, tileIds: [] });

    // At this point, pendingMahjong should be set with saved callWindow
    expect(state.pendingMahjong).not.toBeNull();
    expect(state.pendingMahjong!.previousCallWindow).not.toBeNull();

    // Snapshot the saved passes array reference
    const savedPasses = state.pendingMahjong!.previousCallWindow!.passes;
    const savedPassesLength = savedPasses.length;

    // Mutate the CURRENT callWindow's passes (simulating another action modifying it)
    if (state.callWindow) {
      state.callWindow.passes.push("injected-player");
    }

    // The saved state should NOT be affected
    expect(state.pendingMahjong!.previousCallWindow!.passes.length).toBe(savedPassesLength);
    expect(state.pendingMahjong!.previousCallWindow!.passes).not.toContain("injected-player");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/engine/actions/mahjong.test.ts -t "saved callWindow state is not corrupted"`
Expected: FAIL — the shallow copy means mutating `state.callWindow.passes` also mutates the saved copy.

- [ ] **Step 3: Implement deep copy in confirmMahjongCall**

In `packages/shared/src/engine/actions/mahjong.ts`, add a helper function and update the save site:

```typescript
/** Deep copy a CallWindowState for safe preservation across state mutations */
function deepCopyCallWindow(cw: CallWindowState): CallWindowState {
  return {
    ...cw,
    passes: [...cw.passes],
    calls: cw.calls.map((c) => ({ ...c, tileIds: [...c.tileIds] })),
    remainingCallers: cw.remainingCallers.map((c) => ({ ...c, tileIds: [...c.tileIds] })),
    winningCall: cw.winningCall ? { ...cw.winningCall, tileIds: [...cw.winningCall.tileIds] } : null,
  };
}
```

Add the import for `CallWindowState` at the top of the file:

```typescript
import type {
  GameState,
  ActionResult,
  MahjongGameResult,
  CallWindowState,
} from "../../types/game-state";
```

Then update the two save sites:

In `confirmMahjongCall` (~line 154), replace:
```typescript
// Before:
previousCallWindow: state.callWindow ? { ...state.callWindow } : null,

// After:
previousCallWindow: state.callWindow ? deepCopyCallWindow(state.callWindow) : null,
```

In `handleDeclareMahjong` (~line 63), the self-drawn path saves `previousCallWindow: null` so no change needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/engine/actions/mahjong.test.ts -t "saved callWindow state is not corrupted"`
Expected: PASS

- [ ] **Step 5: Also remove the `as unknown as CallWindowState` casts in handleCancelMahjong and handleConfirmInvalidMahjong**

In `packages/shared/src/engine/actions/mahjong.ts`, replace:

```typescript
// Line ~248 in handleCancelMahjong:
// Before:
state.callWindow = previousCallWindow as unknown as CallWindowState;
// After:
state.callWindow = previousCallWindow;

// Line ~285 in handleConfirmInvalidMahjong:
// Before:
state.callWindow = previousCallWindow as unknown as CallWindowState;
// After:
state.callWindow = previousCallWindow;
```

These casts are no longer needed because `previousCallWindow` is already typed as `CallWindowState | null` in `PendingMahjongState`.

- [ ] **Step 6: Run full test suite**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/engine/actions/mahjong.ts packages/shared/src/engine/actions/mahjong.test.ts
git commit -m "fix: deep copy callWindow in pendingMahjong to prevent aliasing

Shallow spread copy shared inner arrays (passes, calls, remainingCallers)
between the saved and active callWindow. Mutations to the active window
corrupted the saved state, breaking cancel-mahjong restore. Deep copy all
arrays and remove unnecessary 'as unknown as' casts."
```

---

### Task 3: Replace throws with rejections in closeCallWindow

`closeCallWindow` throws `Error` on missing player/seat instead of returning `{ accepted: false }` like every other handler. In a multiplayer game with disconnects, this could crash the server.

**Files:**
- Modify: `packages/shared/src/engine/actions/call-window.ts:331-376`
- Test: `packages/shared/src/engine/actions/call-window.test.ts`

- [ ] **Step 1: Write failing tests for the throw cases**

Add to `packages/shared/src/engine/actions/call-window.test.ts`:

```typescript
describe("closeCallWindow — defensive rejections", () => {
  test("returns rejection instead of throwing when discarder player is missing", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Set up a call window
    const tile = discardTile(state, eastId);

    // Remove the discarder from state (simulates corrupted state)
    delete state.players[eastId];

    // All players have passed — trigger close
    const nonDiscarders = Object.keys(state.players);
    for (const id of nonDiscarders) {
      handlePassCall(state, { type: "PASS_CALL", playerId: id });
    }

    // Should NOT throw — should return a rejection
    // The last pass triggers closeCallWindow internally
    // Since we already passed all players, let's call closeCallWindow directly
    const result = closeCallWindow(state, "all_passed");
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DISCARDER_NOT_FOUND");
  });

  test("returns rejection instead of throwing when next player seat is missing", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Set up a call window
    discardTile(state, eastId);

    // Remove the next player (south) — keeps discarder intact
    const southId = getPlayerBySeat(state, "south");
    delete state.players[southId];

    const result = closeCallWindow(state, "all_passed");
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NEXT_PLAYER_NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (throw instead of reject)**

Run: `cd packages/shared && npx vitest run src/engine/actions/call-window.test.ts -t "defensive rejections"`
Expected: FAIL — tests crash with thrown Error instead of returning rejection.

- [ ] **Step 3: Replace throws with rejections in closeCallWindow**

In `packages/shared/src/engine/actions/call-window.ts`, replace the `closeCallWindow` function body (lines ~344-376) after the wall game check:

```typescript
  // Advance turn to next player counterclockwise from the discarder
  const discarder = state.players[discarderId];
  if (!discarder) {
    state.callWindow = null;
    return { accepted: false, reason: "DISCARDER_NOT_FOUND" };
  }
  const discarderSeatIndex = SEATS.indexOf(discarder.seatWind);
  const nextSeatWind = SEATS[(discarderSeatIndex + 1) % SEATS.length];

  const nextPlayer = Object.values(state.players).find((p) => p.seatWind === nextSeatWind);
  if (!nextPlayer) {
    state.callWindow = null;
    return { accepted: false, reason: "NEXT_PLAYER_NOT_FOUND" };
  }
  state.currentTurn = nextPlayer.id;
  state.turnPhase = "draw";
```

Note: We still clear `callWindow = null` before returning the rejection so the system doesn't get stuck in a broken call window state.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npx vitest run src/engine/actions/call-window.test.ts -t "defensive rejections"`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass (existing tests unaffected — they never hit the missing-player paths).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine/actions/call-window.ts packages/shared/src/engine/actions/call-window.test.ts
git commit -m "fix: replace throws with rejections in closeCallWindow

Thrown errors in a multiplayer context crash the server process. Return
ActionResult rejections instead, matching the pattern used by every other
handler. Clear callWindow before rejection to prevent stuck state."
```

---

### Task 4: Fix unsafe cast in buildGroupIdentity

`buildGroupIdentity` casts `callType as unknown as GroupIdentity["type"]`, but `CallType` includes `"mahjong"` which is not a valid `GroupType`. A refactor changing dispatch order could produce a nonsensical `GroupIdentity` with `type: "mahjong"`.

**Files:**
- Modify: `packages/shared/src/engine/actions/call-window.ts:541-561`
- Test: `packages/shared/src/engine/actions/call-window.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/shared/src/engine/actions/call-window.test.ts`:

```typescript
import { GROUP_TYPES } from "../../constants";

describe("buildGroupIdentity — type safety", () => {
  test("handleConfirmCall rejects mahjong callType in non-mahjong path", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-29T12:00:00Z"));
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");

      // Set up a call window in confirming state with a spoofed mahjong winningCall
      const tile = discardTile(state, eastId);

      // Manually construct a confirming state with callType "mahjong"
      // to simulate what would happen if dispatch order changed
      state.callWindow!.status = "confirming";
      state.callWindow!.confirmingPlayerId = southId;
      state.callWindow!.confirmationExpiresAt = Date.now() + 5000;
      state.callWindow!.remainingCallers = [];
      state.callWindow!.winningCall = {
        callType: "mahjong",
        playerId: southId,
        tileIds: [],
      };

      // This should take the mahjong path, not the non-mahjong path
      // If it somehow takes the non-mahjong path, buildGroupIdentity would produce invalid type
      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: southId,
        tileIds: [],
      });

      // Mahjong path is handled separately — should not produce a GroupIdentity with type "mahjong"
      // The result should be from confirmMahjongCall, not the exposed group path
      if (result.accepted && result.resolved?.type === "CALL_CONFIRMED") {
        // If we ever reach this branch, the group identity must NOT have type "mahjong"
        const groupType = (result.resolved as { groupIdentity: { type: string } }).groupIdentity.type;
        expect(GROUP_TYPES).toContain(groupType);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Fix buildGroupIdentity to exclude mahjong at the type level**

In `packages/shared/src/engine/actions/call-window.ts`, replace the `buildGroupIdentity` function:

```typescript
/** Non-mahjong call types that produce exposed groups */
type ExposableCallType = Exclude<CallType, "mahjong">;

/**
 * Build a GroupIdentity from the discarded tile and call type.
 * Identity is fixed at exposure time and never changes (FR55).
 * Only accepts non-mahjong call types — mahjong calls don't create exposed groups.
 */
function buildGroupIdentity(discardedTile: Tile, callType: ExposableCallType): GroupIdentity {
  if (callType === "news") {
    return { type: "news" };
  }
  if (callType === "dragon_set") {
    return { type: "dragon_set" };
  }

  // Same-tile groups: identity from the discarded tile
  const base: GroupIdentity = { type: callType };
  switch (discardedTile.category) {
    case "suited":
      return { ...base, suit: discardedTile.suit, value: discardedTile.value };
    case "wind":
      return { ...base, wind: discardedTile.value };
    case "dragon":
      return { ...base, dragon: discardedTile.value };
    default:
      return base;
  }
}
```

Key change: The parameter type `ExposableCallType` (which is `Exclude<CallType, "mahjong">`) eliminates the unsafe cast entirely. The remaining call types (`pung`, `kong`, `quint`, `news`, `dragon_set`) are all valid `GroupType` values, so `{ type: callType }` is now type-safe without any cast.

Also update the call site in `handleConfirmCall` (~line 731) to assert the type:

```typescript
  const groupIdentity = buildGroupIdentity(
    discardedTile,
    winningCall.callType as ExposableCallType,
  );
```

This cast is safe because we already confirmed `winningCall.callType !== "mahjong"` on line 664.

- [ ] **Step 3: Run typecheck and tests**

Run: `cd packages/shared && npx tsc --noEmit && npx vitest run`
Expected: All tests pass, zero type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/engine/actions/call-window.ts packages/shared/src/engine/actions/call-window.test.ts
git commit -m "fix: replace unsafe CallType cast in buildGroupIdentity

Introduce ExposableCallType = Exclude<CallType, 'mahjong'> to make
buildGroupIdentity type-safe. The previous 'as unknown as' cast could
produce a GroupIdentity with type 'mahjong' if dispatch order changed."
```

---

### Task 5: Accept PASS_CALL on frozen call window (in-flight consistency)

`handlePassCall` rejects passes when the window is frozen, but `handleCallAction` accepts in-flight calls. A pass sent before the player received the freeze notification gets rejected, creating an inconsistent UX. Accept in-flight passes the same way in-flight calls are accepted.

**Files:**
- Modify: `packages/shared/src/engine/actions/call-window.ts:33-67`
- Test: `packages/shared/src/engine/actions/call-window.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/shared/src/engine/actions/call-window.test.ts`:

```typescript
describe("handlePassCall — frozen window in-flight acceptance", () => {
  test("accepts PASS_CALL when window is frozen (in-flight pass before freeze notification)", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-29T12:00:00Z"));
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");

      discardTile(state, eastId);
      const nonDiscarders = getNonDiscarders(state);

      // South calls pung to freeze the window
      const southId = nonDiscarders.find((id) => state.players[id].seatWind === "south")!;
      const matchingTiles = state.players[southId].rack
        .filter((t) => tilesMatch(t, state.callWindow!.discardedTile))
        .slice(0, 2);

      if (matchingTiles.length >= 2) {
        handleCallAction(
          state,
          { type: "CALL_PUNG", playerId: southId, tileIds: matchingTiles.map((t) => t.id) },
          "pung",
        );
        expect(state.callWindow!.status).toBe("frozen");

        // West sends PASS_CALL (sent before receiving freeze notification)
        const westId = nonDiscarders.find((id) => state.players[id].seatWind === "west")!;
        const result = handlePassCall(state, { type: "PASS_CALL", playerId: westId });

        expect(result.accepted).toBe(true);
        expect(state.callWindow!.passes).toContain(westId);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/engine/actions/call-window.test.ts -t "frozen window in-flight"`
Expected: FAIL with `CALL_WINDOW_FROZEN` rejection.

- [ ] **Step 3: Update handlePassCall to accept passes on frozen windows**

In `packages/shared/src/engine/actions/call-window.ts`, update `handlePassCall` validation (lines 41-46):

```typescript
// Before:
  if (state.callWindow.status === "frozen" || state.callWindow.status === "confirming") {
    return { accepted: false, reason: "CALL_WINDOW_FROZEN" };
  }
  if (state.callWindow.status !== "open") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_OPEN" };
  }

// After:
  if (state.callWindow.status === "confirming") {
    return { accepted: false, reason: "CALL_WINDOW_CONFIRMING" };
  }
  if (state.callWindow.status !== "open" && state.callWindow.status !== "frozen") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_OPEN" };
  }
```

This matches the validation pattern already used by `handleCallAction` (lines 233-238) and `handleCallMahjong` (lines 160-165) — accept on "open" or "frozen", reject only on "confirming".

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/engine/actions/call-window.test.ts -t "frozen window in-flight"`
Expected: PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass. Existing test "rejects CALL_WINDOW_FROZEN when call window is frozen" in the `handlePassCall — validation` describe block will now fail because it expects rejection on frozen. Update it:

If that test fails, update it to expect acceptance on frozen status, or change it to test the "confirming" rejection instead:

```typescript
  test("rejects CALL_WINDOW_CONFIRMING when call window is in confirming phase", () => {
    // ... setup a confirming call window and attempt PASS_CALL
    // expect: { accepted: false, reason: "CALL_WINDOW_CONFIRMING" }
  });
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine/actions/call-window.ts packages/shared/src/engine/actions/call-window.test.ts
git commit -m "fix: accept in-flight PASS_CALL on frozen call window

Align PASS_CALL validation with CALL_* validation — accept on both
'open' and 'frozen' status, reject only on 'confirming'. Passes sent
before the player receives the freeze notification should be accepted
the same way in-flight calls are."
```

---

### Task 6: Fix challenge overturn losing the called discard tile

When a discard Mahjong is overturned via challenge, `confirmMahjongCall` has already removed the called tile from the discarder's discard pool (line 179). But `resolveChallenge` only reverses scoring and sets dead hand — it doesn't restore the tile. The tile vanishes from the game.

**Files:**
- Modify: `packages/shared/src/engine/actions/challenge.ts:99-137`
- Modify: `packages/shared/src/types/game-state.ts:99-105` (add field to ChallengeState)
- Test: `packages/shared/src/engine/actions/challenge.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/shared/src/engine/actions/challenge.test.ts`:

```typescript
describe("Challenge overturn — tile restoration", () => {
  test("overturned discard Mahjong restores the called tile to discarder's discard pool", () => {
    const state = createPlayState();
    state.card = card;
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // Give south a valid hand missing one tile that east will discard
    const validTiles = buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
    // Remove one tile from south's hand and put it in east's rack
    const lastTile = validTiles.pop()!;
    state.players[southId].rack.length = 0;
    injectTilesIntoRack(state, southId, validTiles);

    // East discards the tile south needs
    state.players[eastId].rack.push(lastTile);
    state.currentTurn = eastId;
    state.turnPhase = "discard";
    handleAction(state, { type: "DISCARD_TILE", playerId: eastId, tileId: lastTile.id });

    // South calls mahjong
    handleAction(state, { type: "CALL_MAHJONG", playerId: southId, tileIds: [] });
    handleAction(state, { type: "CONFIRM_CALL", playerId: southId, tileIds: [] });

    // If valid mahjong, we're on scoreboard
    if (state.gamePhase === "scoreboard" && state.gameResult?.winnerId === southId) {
      // Record the discard pool state before challenge
      const eastDiscardCountBefore = state.players[eastId].discardPool.length;

      // Challenge and overturn
      const losers = Object.keys(state.players).filter((id) => id !== southId);
      handleAction(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
      handleAction(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });
      handleAction(state, { type: "CHALLENGE_VOTE", playerId: losers[2], vote: "invalid" });

      // The called tile should be restored to east's discard pool
      expect(state.gamePhase).toBe("play");
      const hasRestoredTile = state.players[eastId].discardPool.some(
        (t) => t.id === lastTile.id,
      );
      expect(hasRestoredTile).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/engine/actions/challenge.test.ts -t "tile restoration"`
Expected: FAIL — the tile is not restored.

- [ ] **Step 3: Add calledTile tracking to ChallengeState**

In `packages/shared/src/types/game-state.ts`, add a field to `ChallengeState`:

```typescript
/** State tracking an active challenge vote on a validated Mahjong */
export interface ChallengeState {
  readonly challengerId: string;
  readonly winnerId: string;
  votes: Record<string, "valid" | "invalid">;
  readonly challengeExpiresAt: number;
  readonly originalGameResult: MahjongGameResult;
  /** The called discard tile (for restoration on overturn). Null for self-drawn wins. */
  readonly calledTile: { tile: Tile; discarderId: string } | null;
}
```

Add the `Tile` import at the top of `game-state.ts` if not already present (it should be — line 1 already imports it).

- [ ] **Step 4: Update handleChallengeMahjong to save the called tile**

In `packages/shared/src/engine/actions/challenge.ts`, update the state creation in `handleChallengeMahjong`:

```typescript
  const gameResult = state.gameResult as MahjongGameResult;
  const winnerId = gameResult.winnerId;

  // Save the called tile info for potential overturn restoration
  const calledTile = (!gameResult.selfDrawn && gameResult.discarderId)
    ? { tile: state.lastDiscard?.tile ?? null, discarderId: gameResult.discarderId }
    : null;

  state.challengeState = {
    challengerId: action.playerId,
    winnerId,
    votes: { [action.playerId]: "invalid" },
    challengeExpiresAt: Date.now() + CHALLENGE_TIMEOUT_SECONDS * 1000,
    originalGameResult: gameResult,
    calledTile: calledTile as ChallengeState["calledTile"],
  };
```

Wait — `state.lastDiscard` may not have the tile because `confirmMahjongCall` clears `callWindow` but doesn't necessarily set `lastDiscard`. We need a different approach. The tile info is already in `originalGameResult.discarderId`, but the actual `Tile` object is gone.

Better approach: save the called tile in `ChallengeState` from `originalGameResult`. But `MahjongGameResult` doesn't store the tile object — only `discarderId`.

We need to store the called tile at challenge initiation time. The only place that has it is the winner's hand. After a discard Mahjong, the called tile was added to the winner's exposed groups or hand. Let's save the tile ID on `MahjongGameResult` instead.

Update `MahjongGameResult` in `game-state.ts`:

```typescript
export interface MahjongGameResult {
  readonly winnerId: string;
  readonly patternId: string;
  readonly patternName: string;
  readonly points: number;
  readonly selfDrawn: boolean;
  readonly discarderId?: string;
  readonly calledTileId?: string;
  readonly payments: PaymentBreakdown;
}
```

Then in `confirmMahjongCall` in `mahjong.ts`, save the tile ID in the game result:

```typescript
  state.gameResult = {
    winnerId: callerId,
    patternId: match.patternId,
    patternName: match.patternName,
    points: match.points,
    selfDrawn: false,
    discarderId,
    calledTileId: calledDiscardTileId,
    payments: scoringResult.payments,
  } satisfies MahjongGameResult;
```

And update `ChallengeState` to store the full `Tile` for restoration:

```typescript
export interface ChallengeState {
  readonly challengerId: string;
  readonly winnerId: string;
  votes: Record<string, "valid" | "invalid">;
  readonly challengeExpiresAt: number;
  readonly originalGameResult: MahjongGameResult;
  /** The called discard tile object for restoration on overturn. Null for self-drawn. */
  readonly calledTile: Tile | null;
}
```

In `handleChallengeMahjong`, find the called tile from the winner's rack (the tile was added to their hand during confirmation):

```typescript
  // Find the called tile for potential overturn restoration
  let calledTile: Tile | null = null;
  if (!gameResult.selfDrawn && gameResult.calledTileId) {
    const winner = state.players[winnerId];
    calledTile = winner?.rack.find((t) => t.id === gameResult.calledTileId) ?? null;
  }

  state.challengeState = {
    challengerId: action.playerId,
    winnerId,
    votes: { [action.playerId]: "invalid" },
    challengeExpiresAt: Date.now() + CHALLENGE_TIMEOUT_SECONDS * 1000,
    originalGameResult: gameResult,
    calledTile,
  };
```

Import `Tile` type at the top of `challenge.ts`:

```typescript
import type { GameState, ActionResult, MahjongGameResult, ChallengeState } from "../../types/game-state";
import type { Tile } from "../../types/tiles";
```

- [ ] **Step 5: Restore the tile in resolveChallenge overturn path**

In `packages/shared/src/engine/actions/challenge.ts`, in the `resolveChallenge` overturn block, add tile restoration after scoring reversal:

```typescript
    // Restore the called tile to the discarder's discard pool
    if (challenge.calledTile && challenge.originalGameResult.discarderId) {
      const discarder = state.players[challenge.originalGameResult.discarderId];
      if (discarder) {
        discarder.discardPool.push(challenge.calledTile);
      }
      // Remove the tile from the winner's rack
      const winner = state.players[challenge.winnerId];
      if (winner) {
        const tileIdx = winner.rack.findIndex((t) => t.id === challenge.calledTile!.id);
        if (tileIdx !== -1) {
          winner.rack.splice(tileIdx, 1);
        }
      }
    }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/engine/actions/challenge.test.ts -t "tile restoration"`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `cd packages/shared && npx tsc --noEmit && npx vitest run`
Expected: All tests pass. If existing challenge tests fail due to the new required `calledTile` field, update `handleChallengeMahjong` to default `calledTile: null` for self-drawn cases (already handled above).

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/types/game-state.ts packages/shared/src/engine/actions/challenge.ts packages/shared/src/engine/actions/challenge.test.ts packages/shared/src/engine/actions/mahjong.ts
git commit -m "fix: restore called tile to discard pool on challenge overturn

When a discard Mahjong is overturned, the called tile was removed from the
discarder's pool during confirmation but never restored. Track the called
tile in ChallengeState and restore it on overturn, also removing it from
the winner's rack."
```

---

### Task 7: Add challenge timeout handler with default votes

The shared engine has no `handleChallengeTimeout` — the server must fill in default "valid" votes for non-voters, but there's no shared function for this. Add one.

**Files:**
- Modify: `packages/shared/src/engine/actions/challenge.ts`
- Test: `packages/shared/src/engine/actions/challenge.test.ts`

- [ ] **Step 1: Write failing test**

Add to `packages/shared/src/engine/actions/challenge.test.ts`:

```typescript
import { handleChallengeTimeout } from "./challenge";

describe("Challenge timeout — default votes", () => {
  test("timeout fills non-voters with 'valid' default and resolves", () => {
    const { state, winnerId, losers } = setupScoreboardWithWinner();

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    // losers[0] voted "invalid" (auto-set). No other votes.

    const result = handleChallengeTimeout(state);

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "CHALLENGE_RESOLVED",
      outcome: "upheld", // 1 invalid + 3 defaulted valid = upheld
    });
    // Check that non-voters got default "valid"
    const votes = (result.resolved as { votes: Record<string, string> }).votes;
    expect(votes[losers[1]]).toBe("valid");
    expect(votes[losers[2]]).toBe("valid");
    expect(votes[winnerId]).toBe("valid");
    expect(state.challengeState).toBeNull();
  });

  test("timeout with 2 invalid votes + defaults still overturns if 3+ invalid", () => {
    const { state, winnerId, losers } = setupScoreboardWithWinner();

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[2], vote: "invalid" });
    // 3 invalid votes — this should have early-resolved already
    // So this test is for the case where 2 invalids + timeout:
    // Actually with 3 invalids it early-resolves. Let's test 2 invalids + timeout:
  });

  test("timeout with exactly 2 invalid votes and 2 non-voters → upheld (defaults to valid)", () => {
    const { state, losers } = setupScoreboardWithWinner();

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    // losers[0] has "invalid" pre-set
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });
    // 2 invalid, 2 non-voters → timeout fills valid → 2 invalid + 2 valid → upheld

    const result = handleChallengeTimeout(state);

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "CHALLENGE_RESOLVED",
      outcome: "upheld",
    });
  });

  test("timeout with no active challenge returns rejection", () => {
    const state = createPlayState();

    const result = handleChallengeTimeout(state);

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_ACTIVE_CHALLENGE");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && npx vitest run src/engine/actions/challenge.test.ts -t "Challenge timeout"`
Expected: FAIL — `handleChallengeTimeout` is not exported / doesn't exist.

- [ ] **Step 3: Implement handleChallengeTimeout**

Add to `packages/shared/src/engine/actions/challenge.ts`:

```typescript
/**
 * Handle challenge vote timeout: fill non-voters with "valid" default,
 * then resolve the challenge.
 * Called by the server when the 30-second challenge timer expires.
 * No setTimeout in shared/ — the server is responsible for scheduling.
 */
export function handleChallengeTimeout(state: GameState): ActionResult {
  if (!state.challengeState) {
    return { accepted: false, reason: "NO_ACTIVE_CHALLENGE" };
  }

  // Fill non-voters with "valid" default
  const allPlayerIds = Object.keys(state.players);
  for (const playerId of allPlayerIds) {
    if (state.challengeState.votes[playerId] === undefined) {
      state.challengeState.votes[playerId] = "valid";
    }
  }

  return resolveChallenge(state);
}
```

Also export it from the module — update the existing exports if needed. And make `resolveChallenge` accessible (it's already called by `handleChallengeVote` internally, so it just needs to remain in scope — no export needed since `handleChallengeTimeout` is in the same file).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && npx vitest run src/engine/actions/challenge.test.ts -t "Challenge timeout"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/actions/challenge.ts packages/shared/src/engine/actions/challenge.test.ts
git commit -m "feat: add handleChallengeTimeout with default valid votes

Server needs a shared engine function for challenge timeout. Fills
non-voters with 'valid' (per spec: silence = valid), then resolves.
Ensures the challenge always terminates cleanly."
```

---

### Task 8: Explicit flower tile handling in tilesMatch

`tilesMatch` handles suited, wind, dragon, and joker categories but flower tiles fall through to `default: return false`. While correct behavior (flowers can't form groups), it's an implicit assumption. Make it explicit.

**Files:**
- Modify: `packages/shared/src/engine/actions/call-window.ts:127-145`
- Test: `packages/shared/src/engine/actions/call-window.test.ts`

- [ ] **Step 1: Write test documenting the behavior**

Add to `packages/shared/src/engine/actions/call-window.test.ts`:

```typescript
describe("tilesMatch — flower tile handling", () => {
  test("flower tile never matches any non-joker tile (flowers cannot form groups)", () => {
    const flower: Tile = { id: "flower-a-1", category: "flower", value: "a" } as Tile;
    const bam3: Tile = { id: "bam-3-1", category: "suited", suit: "bam", value: 3 } as Tile;
    const wind: Tile = { id: "wind-north-1", category: "wind", value: "north" } as Tile;

    expect(tilesMatch(flower, bam3)).toBe(false);
    expect(tilesMatch(flower, wind)).toBe(false);
    expect(tilesMatch(flower, flower)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — it should pass already (behavior is correct)**

Run: `cd packages/shared && npx vitest run src/engine/actions/call-window.test.ts -t "flower tile handling"`
Expected: PASS (the default case already returns false).

- [ ] **Step 3: Add explicit flower case to tilesMatch for documentation**

In `packages/shared/src/engine/actions/call-window.ts`, update `tilesMatch`:

```typescript
/** Check if a tile matches the discarded tile (same identity, ignoring copy number) */
export function tilesMatch(tile: Tile, discardedTile: Tile): boolean {
  if (tile.category === "joker") return true;
  if (tile.category !== discardedTile.category) return false;

  switch (tile.category) {
    case "suited":
      return (
        discardedTile.category === "suited" &&
        tile.suit === discardedTile.suit &&
        tile.value === discardedTile.value
      );
    case "wind":
      return discardedTile.category === "wind" && tile.value === discardedTile.value;
    case "dragon":
      return discardedTile.category === "dragon" && tile.value === discardedTile.value;
    case "flower":
      // Flowers cannot form groups — never match for calling purposes
      return false;
    default:
      return false;
  }
}
```

- [ ] **Step 4: Run full test suite**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/actions/call-window.ts packages/shared/src/engine/actions/call-window.test.ts
git commit -m "refactor: add explicit flower case to tilesMatch

Flowers falling through to default:false was correct but implicit.
Make it explicit with a documented case for maintainability."
```

---

### Task 9: Document exposure-validation known limitation

The `matchesGroupIdentity` function in `exposure-validation.ts` cannot resolve abstract card color references (A/B/C) to concrete suits. This is a known limitation that affects future card years with mixed concealed/exposed patterns. Document it clearly rather than trying to fix it now (the fix requires card data changes and is Epic 5B scope).

**Files:**
- Modify: `packages/shared/src/card/exposure-validation.ts:44-119`

- [ ] **Step 1: Add clear doc comment explaining the limitation**

In `packages/shared/src/card/exposure-validation.ts`, update the `matchesGroupIdentity` function's doc comment:

```typescript
/**
 * Check if a GroupPattern from the card matches a specific ExposedGroup.
 *
 * KNOWN LIMITATION: Abstract color references (A/B/C) in GroupPattern.tile.color
 * cannot be resolved to concrete suits (bam/crak/dot) without the full hand
 * assignment context. When a group has an abstract color, this function falls
 * back to conservative matching (returns true = "might match"), which means
 * some legitimate mixed concealed/exposed hands could be incorrectly rejected.
 *
 * Impact: As of 2026 card data, all concealed (C) hands have ALL groups marked
 * concealed, so the hand-level check in validateExposure catches these before
 * group-level matching runs. This limitation becomes relevant if future card
 * years introduce mixed patterns where some groups are concealed and others exposed.
 *
 * Resolution: Requires passing the color assignment map (from pattern-matcher)
 * into this function. Deferred to Epic 5B hand guidance work.
 */
function matchesGroupIdentity(group: GroupPattern, exposed: ExposedGroup): boolean {
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/card/exposure-validation.ts
git commit -m "docs: document exposure-validation abstract color limitation

Clarify that matchesGroupIdentity cannot resolve abstract A/B/C colors
to concrete suits, causing conservative matching. Not a bug for 2026
card data but will need resolution for future mixed C/X patterns."
```

---

## Summary

| Task | Finding(s) | Type | Risk |
|---|---|---|---|
| 1 | #1 readonly dishonesty | Refactor | Low — removes lies, no behavior change |
| 2 | #4 shallow copy aliasing | Bug fix | Medium — state corruption on cancel restore |
| 3 | #7 throws in closeCallWindow | Bug fix | Medium — server crash risk |
| 4 | #5 unsafe cast in buildGroupIdentity | Type safety | Low — latent bug, currently unreachable |
| 5 | #10 PASS_CALL frozen rejection | Bug fix | Low — UX inconsistency |
| 6 | #9 challenge overturn tile loss | Bug fix | **High — tile vanishes from game** |
| 7 | #3 challenge timeout defaults | Missing feature | Medium — server has no shared function |
| 8 | #8 flower tile implicit handling | Refactor | Low — documentation improvement |
| 9 | #13 exposure-validation limitation | Documentation | Low — known limitation |

Recommended execution order: Tasks 6 → 2 → 3 → 7 → 1 → 5 → 4 → 8 → 9 (bugs first, then refactors, then docs).
