# Story 3C.1: Joker Exchange Mechanic

Status: review

## Story

As a **player**,
I want **to exchange a natural tile from my rack for a Joker in any player's exposed group on my turn (before discarding)**,
so that **I can strategically acquire Jokers to complete my hand (FR53, FR54, FR55)**.

## Acceptance Criteria

1. **AC1 — Basic exchange:** Given it is my turn and I have drawn a tile (turnPhase === "discard"), when I dispatch `JOKER_EXCHANGE` with `{ jokerGroupId, naturalTileId }`, then the Joker is moved from the exposed group to my rack, and my natural tile replaces it in the exposed group.

2. **AC2 — Identity match succeeds:** Given an exposed group with identity "Kong of 3-Bam" containing a Joker, when I attempt to exchange with a 3-Bam from my rack, then the exchange succeeds — the natural tile matches the group's fixed identity (FR55).

3. **AC3 — Identity mismatch rejects:** Given an exposed group with identity "Kong of 3-Bam" containing a Joker, when I attempt to exchange with a 5-Dot from my rack, then `{ accepted: false, reason: 'TILE_DOES_NOT_MATCH_GROUP' }`.

4. **AC4 — No Joker in group rejects:** Given an exposed group with no Jokers, when I attempt a Joker exchange, then `{ accepted: false, reason: 'NO_JOKER_IN_GROUP' }`.

5. **AC5 — Multiple exchanges per turn:** Given it is my turn, when I perform a Joker exchange, then I can perform additional exchanges before discarding — multiple exchanges per turn are allowed (FR54). The `turnPhase` stays at `"discard"` after each exchange.

6. **AC6 — Not your turn rejects:** Given it is NOT my turn, when I attempt a Joker exchange, then `{ accepted: false, reason: 'NOT_YOUR_TURN' }`.

7. **AC7 — Already discarded rejects:** Given I have already discarded this turn (turnPhase !== "discard"), when I attempt a Joker exchange, then `{ accepted: false, reason: 'ALREADY_DISCARDED' }`.

8. **AC8 — Wrong phase rejects:** Given the game is not in play phase (e.g., charleston, lobby), when I attempt a Joker exchange, then `{ accepted: false, reason: 'WRONG_PHASE' }`.

9. **AC9 — Broadcast resolved action:** Given a Joker exchange succeeds, when the state update is broadcast, then the `resolvedAction` includes `{ type: "JOKER_EXCHANGE", playerId, jokerGroupId, jokerTileId, naturalTileId }` so all clients can animate the swap.

10. **AC10 — Exchange into any player's group:** Given another player has an exposed group containing a Joker, when I exchange with a matching natural tile from my rack, then the exchange succeeds — exchanges target ANY player's exposed groups, not just the exchanger's own.

11. **AC11 — Natural tile not in rack rejects:** Given I dispatch `JOKER_EXCHANGE` with a `naturalTileId` that is not in my rack, then `{ accepted: false, reason: 'TILE_NOT_IN_RACK' }`.

12. **AC12 — Invalid group ID rejects:** Given I dispatch `JOKER_EXCHANGE` with a `jokerGroupId` that does not correspond to any player's exposed group, then `{ accepted: false, reason: 'GROUP_NOT_FOUND' }`.

## Tasks / Subtasks

- [x] Task 1: Add `JokerExchangeAction` type to shared types (AC: 1, 9)
  - [x] 1.1 Add `JokerExchangeAction` interface to `packages/shared/src/types/actions.ts` with fields: `type: "JOKER_EXCHANGE"`, `playerId: string`, `jokerGroupId: string`, `naturalTileId: string`
  - [x] 1.2 Add `JokerExchangeAction` to the `GameAction` discriminated union in the same file
  - [x] 1.3 Add `JOKER_EXCHANGE` resolved action variant to `ResolvedAction` in `packages/shared/src/types/game-state.ts` with fields: `type: "JOKER_EXCHANGE"`, `playerId: string`, `jokerGroupId: string`, `jokerTileId: string`, `naturalTileId: string`

- [x] Task 2: Create `handleJokerExchange` action handler (AC: 1–12)
  - [x] 2.1 Create `packages/shared/src/engine/actions/joker-exchange.ts`
  - [x] 2.2 Implement `handleJokerExchange(state: GameState, action: JokerExchangeAction): ActionResult` following validate-then-mutate pattern
  - [x] 2.3 Validation checks (in order):
    - `state.gamePhase !== "play"` → `WRONG_PHASE`
    - `state.currentTurn !== action.playerId` → `NOT_YOUR_TURN`
    - `state.turnPhase !== "discard"` → `ALREADY_DISCARDED` (must have drawn but not yet discarded)
    - Parse `jokerGroupId` to find the target exposed group → `GROUP_NOT_FOUND` if invalid
    - Check natural tile exists in player's rack → `TILE_NOT_IN_RACK`
    - Call `validateJokerExchange(exposedGroup, naturalTile)` from `joker-eligibility.ts` → map `ExchangeResult.reason` to appropriate rejection reasons (`NO_JOKER_IN_GROUP`, `TILE_DOES_NOT_MATCH_GROUP`)
  - [x] 2.4 Mutation (after validation):
    - Find Joker tile in exposed group (use the one returned by `validateJokerExchange`)
    - Remove Joker from exposed group's `tiles` array
    - Add natural tile to exposed group's `tiles` array (same position as removed Joker)
    - Remove natural tile from player's rack
    - Add Joker to player's rack
    - Do NOT change `turnPhase` — stays at `"discard"` to allow more exchanges
  - [x] 2.5 Return `{ accepted: true, resolved: { type: "JOKER_EXCHANGE", playerId, jokerGroupId, jokerTileId, naturalTileId } }`

- [x] Task 3: Register handler in game engine and exports (AC: all)
  - [x] 3.1 Add `case "JOKER_EXCHANGE": return handleJokerExchange(state, action)` to `handleAction()` switch in `packages/shared/src/engine/game-engine.ts`
  - [x] 3.2 Export `handleJokerExchange` from `packages/shared/src/index.ts`
  - [x] 3.3 Export `JokerExchangeAction` type from `packages/shared/src/index.ts`

- [x] Task 4: Add server-side action parsing (AC: 1, 9)
  - [x] 4.1 In `packages/server/src/websocket/action-handler.ts`, add `JOKER_EXCHANGE` case to `validateActionPayload()` — validate `jokerGroupId` is string, `naturalTileId` is string
  - [x] 4.2 Add `JOKER_EXCHANGE` case to `parseGameAction()` — construct `{ type: "JOKER_EXCHANGE", playerId, jokerGroupId, naturalTileId }`

- [x] Task 5: Write comprehensive tests (AC: 1–12)
  - [x] 5.1 Create `packages/shared/src/engine/actions/joker-exchange.test.ts`
  - [x] 5.2 Test: successful exchange — Joker moves to rack, natural tile moves to group, resolved action correct (AC1, AC2, AC9)
  - [x] 5.3 Test: identity mismatch rejection (AC3)
  - [x] 5.4 Test: no Joker in group rejection (AC4)
  - [x] 5.5 Test: multiple exchanges in one turn — perform two exchanges sequentially, verify both succeed and turnPhase remains "discard" (AC5)
  - [x] 5.6 Test: not your turn rejection (AC6)
  - [x] 5.7 Test: already discarded / wrong turnPhase rejection (AC7)
  - [x] 5.8 Test: wrong game phase rejection (AC8)
  - [x] 5.9 Test: exchange into another player's exposed group (AC10)
  - [x] 5.10 Test: natural tile not in rack rejection (AC11)
  - [x] 5.11 Test: invalid group ID rejection (AC12)
  - [x] 5.12 Test: multi-Joker group — exchange removes only one Joker, group still has others (edge case)
  - [x] 5.13 Test: exchange with wind tile matching wind group identity
  - [x] 5.14 Test: exchange with dragon tile matching dragon group identity

- [x] Task 6: Validation gate (AC: all)
  - [x] 6.1 `pnpm test`
  - [x] 6.2 `pnpm run typecheck`
  - [x] 6.3 `vp lint`

## Dev Notes

### Implementation Scope

**Shared package only + server action parsing.** No client UI changes in this story — the Joker exchange UI will be built in Epic 5B or as a follow-up story. This story implements:
- The `JOKER_EXCHANGE` action type (shared types)
- The `handleJokerExchange` action handler (shared engine)
- Server-side payload validation and parsing (server action-handler)
- Comprehensive tests (shared)

### jokerGroupId Convention

The architecture specifies exposed group IDs as `{playerId}-group-{index}` (e.g., `player-2-group-0`). However, `ExposedGroup` does **not** currently have an `id` field — groups are stored as an array in `PlayerState.exposedGroups`.

**Implementation approach:** Parse `jokerGroupId` in the handler:
```typescript
// Parse "player-2-group-0" → ownerPlayerId="player-2", groupIndex=0
const match = action.jokerGroupId.match(/^(.+)-group-(\d+)$/);
if (!match) return { accepted: false, reason: "GROUP_NOT_FOUND" };
const [, ownerPlayerId, groupIndexStr] = match;
const groupIndex = parseInt(groupIndexStr, 10);
const ownerPlayer = state.players[ownerPlayerId];
if (!ownerPlayer) return { accepted: false, reason: "GROUP_NOT_FOUND" };
const exposedGroup = ownerPlayer.exposedGroups[groupIndex];
if (!exposedGroup) return { accepted: false, reason: "GROUP_NOT_FOUND" };
```

This avoids adding an `id` field to `ExposedGroup` (which would be a breaking change touching many files). The group ID is computed from context — this is consistent with how groups are referenced in the architecture.

### Reuse validateJokerExchange from joker-eligibility.ts

The heavy lifting for tile-identity matching is **already implemented** in `packages/shared/src/card/joker-eligibility.ts`:

```typescript
export function validateJokerExchange(exposedGroup: ExposedGroup, offeredTile: Tile): ExchangeResult;
```

This returns `{ valid: true, jokerTile: Tile }` or `{ valid: false, reason: string }`. The action handler should:
1. Perform game-state validations (phase, turn, rack ownership)
2. Delegate tile/group validation to `validateJokerExchange`
3. Map the result's `reason` string to the appropriate rejection code:
   - `"Group contains no Joker tiles"` → `"NO_JOKER_IN_GROUP"`
   - `"Offered tile does not match group identity"` → `"TILE_DOES_NOT_MATCH_GROUP"`

### Tile Swap Mutation

The mutation must swap tiles in a specific order to avoid dangling references:

```typescript
// 1. Find the Joker in the group (returned by validateJokerExchange)
const jokerIndex = exposedGroup.tiles.findIndex(t => t.id === jokerTile.id);
// 2. Remove natural tile from player's rack
const naturalTileIndex = player.rack.findIndex(t => t.id === action.naturalTileId);
const [naturalTile] = player.rack.splice(naturalTileIndex, 1);
// 3. Replace Joker with natural tile in group (same position)
exposedGroup.tiles[jokerIndex] = naturalTile;
// 4. Add Joker to player's rack
player.rack.push(jokerTile);
```

Position preservation in step 3 is important — replacing at the same index keeps the group's visual ordering stable.

### Turn Phase Stays "discard"

After a Joker exchange, `state.turnPhase` must remain `"discard"`. This is what allows multiple exchanges per turn (AC5). The player still needs to discard after all exchanges are complete. No turn advancement happens.

### Existing Action Handler Pattern

Follow `discard.ts` as the closest structural analog:
- Same game phase check (`"play"`)
- Same turn ownership check (`currentTurn === playerId`)
- Same turn phase check (`"discard"`)
- Same rack lookup pattern (`player.rack.findIndex(t => t.id === ...)`)

### Key Types Reference

```typescript
// ExposedGroup (game-state.ts)
interface ExposedGroup {
  readonly type: GroupType;        // "pung" | "kong" | "quint" | etc.
  readonly tiles: Tile[];          // Actual tiles including Jokers
  readonly identity: GroupIdentity; // Fixed at exposure time
}

// GroupIdentity (game-state.ts)
interface GroupIdentity {
  readonly type: GroupType;
  readonly suit?: string;
  readonly value?: number | string;
  readonly wind?: string;
  readonly dragon?: string;
}

// Tile (tiles.ts)
interface Tile {
  id: string;          // e.g., "bam-3-2"
  category: TileCategory; // "suited" | "wind" | "dragon" | "flower" | "joker"
  suit?: string;
  value?: number | string;
}

// ActionResult (game-state.ts)
type ActionResult =
  | { accepted: true; resolved?: ResolvedAction }
  | { accepted: false; reason: string };
```

### Test Setup Pattern

```typescript
import { describe, it, expect } from "vite-plus/test";
import { createPlayState } from "../../testing/fixtures";
import { suitedTile, jokerTile } from "../../testing/tile-builders";
import { handleJokerExchange } from "./joker-exchange";

describe("handleJokerExchange", () => {
  function setupExchangeScenario() {
    const state = createPlayState(); // seed 42, deterministic
    // Ensure current player is in discard phase (has drawn)
    state.turnPhase = "discard";
    const currentPlayerId = state.currentTurn;
    const currentPlayer = state.players[currentPlayerId];

    // Create a target: another player with an exposed group containing a Joker
    const targetPlayerId = Object.keys(state.players).find(id => id !== currentPlayerId)!;
    const targetPlayer = state.players[targetPlayerId];

    // Build an exposed group: Kong of 3-Bam with one Joker
    const bam3_1 = suitedTile("bam", 3, 1);
    const bam3_2 = suitedTile("bam", 3, 2);
    const bam3_3 = suitedTile("bam", 3, 3);
    const joker = jokerTile(1);
    targetPlayer.exposedGroups.push({
      type: "kong",
      tiles: [bam3_1, bam3_2, bam3_3, joker],
      identity: { type: "kong", suit: "bam", value: 3 },
    });

    // Give current player a matching tile (bam-3-4)
    const matchingTile = suitedTile("bam", 3, 4);
    currentPlayer.rack.push(matchingTile);

    const jokerGroupId = `${targetPlayerId}-group-${targetPlayer.exposedGroups.length - 1}`;

    return { state, currentPlayerId, currentPlayer, targetPlayerId, targetPlayer, matchingTile, joker, jokerGroupId };
  }

  // ... tests using this setup
});
```

### Existing Joker Eligibility Tests

`packages/shared/src/card/joker-eligibility.test.ts` already tests `validateJokerExchange` with multiple scenarios (identity matching, no-Joker groups, suited/wind/dragon groups). The action handler tests can focus on game-state-level concerns (turn phase, player turn, rack membership) and delegate tile-matching edge cases to the existing eligibility tests.

### Files to Create

| File | Package | Purpose |
|------|---------|---------|
| `packages/shared/src/engine/actions/joker-exchange.ts` | shared | Action handler |
| `packages/shared/src/engine/actions/joker-exchange.test.ts` | shared | Tests |

### Files to Modify

| File | Package | Change |
|------|---------|--------|
| `packages/shared/src/types/actions.ts` | shared | Add `JokerExchangeAction` interface + union member |
| `packages/shared/src/types/game-state.ts` | shared | Add `JOKER_EXCHANGE` to `ResolvedAction` union |
| `packages/shared/src/engine/game-engine.ts` | shared | Add case in `handleAction()` switch |
| `packages/shared/src/index.ts` | shared | Export handler and type |
| `packages/server/src/websocket/action-handler.ts` | server | Add validation + parsing cases |

### Scope Boundaries

**This story implements:**
- `JOKER_EXCHANGE` action type and handler (validate-then-mutate)
- Server-side payload validation and parsing
- Comprehensive unit tests for all acceptance criteria
- Resolved action for client broadcast

**This story does NOT implement:**
- Client UI for Joker exchange (Epic 5B / future story — UX spec calls for tap-Joker-in-group interaction)
- Simplified Joker rules host option (Story 3C.2 — separate story)
- Dead hand triggered by invalid exchange (Story 3C.3)
- Any changes to `ExposedGroup` type structure (no `id` field added)

### Previous Story Context (3B.5)

- 3B.5 was server-only (Charleston disconnect auto-pass). Added `selectRandomNonJokerTiles` and `applyCharlestonAutoAction` to `join-handler.ts`.
- Used canonical shared action types (`CharlestonPassAction`, etc.) for auto-action dispatch — same pattern should be followed here for type safety.
- 7 integration tests using real-timer pattern with `setGracePeriodMs(200)`.
- All 215 server tests and 1165 total tests passing after 3B.5.

### Cross-Session Intelligence

- Tile type system uses `category` field for runtime filtering (confirmed in 3B.5 code review). Joker filtering: `tile.category === "joker"`.
- `validateJokerExchange` in `joker-eligibility.ts` was built in Epic 2 (Story 2.4) and is well-tested. Reuse it — do not reimplement identity matching.
- Group identity is set at exposure time in `handleConfirmCall` (`call-window.ts` line ~700) via `buildGroupIdentity()`. The identity never changes after exposure.

### References

- Epic 3C story requirements: `_bmad-output/planning-artifacts/epics.md` lines 2122–2170
- GDD Joker exchange rules: `_bmad-output/planning-artifacts/gdd.md` lines 371–373
- Architecture GameAction types: `_bmad-output/planning-artifacts/game-architecture.md` lines 381, 422
- Architecture exposed group ID convention: `_bmad-output/planning-artifacts/game-architecture.md` line 947
- Architecture joker-exchange.ts file location: `_bmad-output/planning-artifacts/game-architecture.md` line 1008
- UX Joker exchange interaction: `_bmad-output/planning-artifacts/ux-design-specification.md` line 956
- Joker eligibility validation: `packages/shared/src/card/joker-eligibility.ts`
- Discard handler (pattern reference): `packages/shared/src/engine/actions/discard.ts`
- Call confirmation (group exposure): `packages/shared/src/engine/actions/call-window.ts`
- Game engine dispatcher: `packages/shared/src/engine/game-engine.ts`
- Server action handler: `packages/server/src/websocket/action-handler.ts`
- Shared barrel exports: `packages/shared/src/index.ts`
- Type definitions: `packages/shared/src/types/actions.ts`, `packages/shared/src/types/game-state.ts`

## Change Log

- 2026-04-03: Implemented `JOKER_EXCHANGE` (shared types, `handleJokerExchange`, engine registration, server parse/validate), added `joker-exchange.test.ts` (14 cases). Sprint status: in-progress → review.

## Dev Agent Record

### Agent Model Used

Cursor Agent (GPT-5.2)

### Debug Log References

### Completion Notes List

- Joker exchange uses `{ownerId}-group-{index}` parsing and delegates identity/Joker checks to `validateJokerExchange`. Natural tile is swapped into the group at the Joker’s index; `turnPhase` remains `discard` for multiple exchanges per turn. Tests use unique synthetic tile IDs when pushing to racks to avoid collisions with dealt hands (seed 42).

### File List

- `packages/shared/src/types/actions.ts`
- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/engine/actions/joker-exchange.ts`
- `packages/shared/src/engine/actions/joker-exchange.test.ts`
- `packages/shared/src/engine/game-engine.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/websocket/action-handler.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3c-1-joker-exchange-mechanic.md`
