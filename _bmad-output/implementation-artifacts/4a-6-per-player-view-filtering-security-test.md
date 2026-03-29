# Story 4A.6: Per-Player View Filtering & Security Test

Status: done

## Story

As a **developer**,
I want **the state broadcaster to build per-recipient views that include only the player's own rack and publicly visible information, with an explicit test verifying no rack data leaks**,
So that **the information boundary is airtight — no cheating by inspecting WebSocket traffic (AR31, NFR43)**.

## Acceptance Criteria

### AC1: buildPlayerView — Correct View for Each Player
```gherkin
Given the state broadcaster function buildPlayerView(room, gameState, playerId)
When building a view for player-0
Then the view includes player-0's rack tiles in myRack
And does NOT include any other player's rack tiles anywhere in the response
```

### AC2: All Four Players Receive Correctly Filtered Views
```gherkin
Given a 4-player game with distinct rack tiles per player
When building views for all 4 players
Then each view contains: roomId, roomCode, gamePhase, players (public info only),
  myPlayerId, myRack (only their own), exposedGroups (all players — public),
  discardPools (all — public), wallRemaining, currentTurn, callWindow, scores,
  lastDiscard, gameResult, pendingMahjong, challengeState
And NO view contains any other player's rack tiles (verified via JSON stringification)
```

### AC3: Exhaustive Security Assertions in state-broadcaster.test.ts (AR31 Hard Requirement)
```gherkin
Given state-broadcaster.test.ts
When running the test suite
Then there are explicit assertions that for EACH of 4 players,
  no other player's rack tiles appear anywhere in their PlayerGameView
This is a hard requirement, not an assumption (AR31)
```

### AC4: Spectator View Preparation (Post-MVP Architecture)
```gherkin
Given a spectator view function buildSpectatorView(room, gameState)
When called
Then no player's rack is included — public information only
And the SpectatorGameView type is defined in shared/types/protocol.ts
```

### AC5: SHOW_HAND Action During Scoreboard Phase
```gherkin
Given the SHOW_HAND action during scoreboard phase
When a player sends SHOW_HAND
Then their full rack is broadcast to all clients via STATE_UPDATE
And this is the ONLY scenario where rack data is shared
And it only works during scoreboard phase (rejected in other phases)
```

## Tasks / Subtasks

- [x] Task 1: Expand state-broadcaster.test.ts with exhaustive 4-player security assertions (AC: #3)
  - [x] Create 4-player test game state with distinct, identifiable rack tiles per player
  - [x] For EACH player, build view and assert no other player's rack tile IDs appear in JSON.stringify(view)
  - [x] Verify all required public fields present in each view (AC: #2)
  - [x] Verify wall tiles are never leaked in any player view
  - [x] Test edge case: player with empty rack (all tiles exposed)
  - [x] Test edge case: player not found in gameState (graceful fallback)
- [x] Task 2: Add SpectatorGameView type and buildSpectatorView function (AC: #4)
  - [x] Define `SpectatorGameView` interface in `packages/shared/src/types/protocol.ts`
  - [x] Export from `packages/shared/src/index.ts`
  - [x] Implement `buildSpectatorView(room, gameState)` in state-broadcaster.ts
  - [x] Write tests: no rack data in spectator view, all public fields present
- [x] Task 3: Implement SHOW_HAND action (AC: #5)
  - [x] Define `ShowHandAction` type in `packages/shared/src/types/actions.ts`
  - [x] Add `SHOW_HAND` to `GameAction` union and `HAND_SHOWN` to `ResolvedAction` union
  - [x] Add `shownHands` field to `GameState` (Record<string, Tile[]> for hands voluntarily shown)
  - [x] Implement handler in game engine: validate scoreboard phase, add rack to shownHands
  - [x] Include `shownHands` in `PlayerGameView` and `SpectatorGameView`
  - [x] Write tests: success during scoreboard, rejection in other phases, view contains shown hands
- [x] Task 4: Verify no regressions (all existing 710 tests pass)
  - [x] Run `pnpm -r test` and confirm zero regressions (744 total: 591 shared + 21 client + 132 server)

## Dev Notes

### Critical Security Context (AR31 + NFR43)

This story exists because **view filtering security is too critical to be a secondary concern**. AR31 explicitly requires `state-broadcaster.test.ts` to verify no rack data leaks — this is a hard requirement, not an assumption. NFR43 mandates that opponent racks are **never transmitted** to other clients.

The `buildPlayerView` function and basic tests already exist from story 4a-5. This story **expands** the test coverage to be exhaustive (4 players, all edge cases) and adds new features (spectator view, SHOW_HAND).

### What Already Exists (From Story 4a-5)

**Files already created — extend, don't recreate:**
- `packages/server/src/websocket/state-broadcaster.ts` — has `buildPlayerView()` and `broadcastGameState()`
- `packages/server/src/websocket/state-broadcaster.test.ts` — has basic 2-player filtering tests (7 tests)
- `packages/shared/src/types/protocol.ts` — has `PlayerGameView` interface

**Existing `buildPlayerView` signature:**
```typescript
buildPlayerView(room: Room, gameState: GameState, playerId: string): PlayerGameView
```

**Existing `broadcastGameState` signature:**
```typescript
broadcastGameState(room: Room, gameState: GameState, resolvedAction?: ResolvedAction): void
```

**Current test helpers to reuse:** `createMockWs()`, `createMockLogger()`, `createTestPlayer()`, `createTestRoom()`, `createTestGameState()`, `mockSend()`, `parseSentMessage()`

### What Must Change

1. **state-broadcaster.test.ts** — Expand `createTestGameState()` to include 4 players with unique tile IDs. Add exhaustive security assertions per AC3. Add spectator view tests.
2. **state-broadcaster.ts** — Add `buildSpectatorView()` function.
3. **shared/types/protocol.ts** — Add `SpectatorGameView` interface.
4. **shared/types/actions.ts** — Add `ShowHandAction` to the `GameAction` union.
5. **shared/types/game-state.ts** — Add `shownHands: Record<string, Tile[]>` to `GameState`. Add `SHOW_HAND` to `ResolvedAction`.
6. **shared/engine/** — Add SHOW_HAND action handler (validate scoreboard phase, add to shownHands).
7. **state-broadcaster.ts** — Include `shownHands` in `PlayerGameView` output.
8. **shared/types/protocol.ts** — Add `shownHands` field to `PlayerGameView`.

### Exhaustive 4-Player Test Strategy

Create a test fixture with 4 players, each with completely distinct tile IDs:
- player-0: `bam-1-1`, `bam-2-1`, `bam-3-1` (identifiable by "bam" prefix)
- player-1: `crak-1-1`, `crak-2-1`, `crak-3-1` (identifiable by "crak" prefix)
- player-2: `dot-1-1`, `dot-2-1`, `dot-3-1` (identifiable by "dot" prefix)
- player-3: `wind-north-1`, `wind-south-1`, `wind-east-1` (identifiable by "wind" prefix)

For each player's view, JSON.stringify the entire view and assert NONE of the other 3 players' tile IDs appear anywhere.

### SpectatorGameView Design

```typescript
interface SpectatorGameView {
  roomId: string;
  roomCode: string;
  gamePhase: GamePhase;
  players: PlayerPublicInfo[];
  exposedGroups: Record<string, ExposedGroup[]>;
  discardPools: Record<string, Tile[]>;
  wallRemaining: number;
  currentTurn: string;
  turnPhase: TurnPhase;
  callWindow: CallWindowState | null;
  scores: Record<string, number>;
  lastDiscard: { tile: Tile; discarderId: string } | null;
  gameResult: GameResult | null;
  shownHands: Record<string, Tile[]>;
  // NO myPlayerId, NO myRack — spectators see no racks
}
```

### SHOW_HAND Implementation Notes

- Only valid during `gamePhase === "scoreboard"`
- Adds player's rack to `gameState.shownHands[playerId]`
- Idempotent — showing hand twice is a no-op
- `shownHands` is included in both `PlayerGameView` and `SpectatorGameView`
- This is the ONLY mechanism where rack data becomes public — and only voluntarily, post-game

### Anti-Patterns to Avoid

- **DO NOT** add any field that exposes opponent rack data in PlayerGameView
- **DO NOT** include wall tile contents in any view (only `wallRemaining` count)
- **DO NOT** log rack contents at info/debug level (Pino v9.x, never log racks in production per AR13)
- **DO NOT** create a new state-broadcaster file — extend the existing one
- **DO NOT** mock the game engine in tests — use real test state fixtures

### Previous Story Learnings (4a-5)

- Token→playerId resolution pattern is established in `room.tokenMap`
- `findSessionByWs()` on RoomManager handles reverse WebSocket→player lookup
- Stale WebSocket guard: check `session.ws !== ws` before processing
- Added warning log in `buildPlayerView` when playerId not found — keep this pattern
- All 710 tests passing (571 shared + 21 client + 118 server), 0 regressions, lint: 0 errors

### Project Structure Notes

- All new types go in `packages/shared/src/types/` and export from `packages/shared/src/index.ts`
- SHOW_HAND handler goes in `packages/shared/src/engine/` (same pattern as other action handlers)
- Test files co-located: `state-broadcaster.test.ts` next to `state-broadcaster.ts`
- Follow validate-then-mutate pattern for SHOW_HAND handler
- Use tile IDs (e.g., `bam-1-1`), never array indices

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4A, Story 4A.6]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#Decision-2-WebSocket-Protocol — view filtering test requirement]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#Security-Model — information boundary]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#AR31 — hard requirement for state-broadcaster.test.ts]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#NFR43 — opponent racks never transmitted]
- [Source: _bmad-output/project-context.md#Information-Boundary]
- [Source: packages/server/src/websocket/state-broadcaster.ts — existing implementation]
- [Source: packages/server/src/websocket/state-broadcaster.test.ts — existing tests to extend]
- [Source: packages/shared/src/types/protocol.ts — PlayerGameView type]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Expanded state-broadcaster.test.ts from 10 to 23 tests with exhaustive 4-player security assertions (AR31 hard requirement satisfied)
- Each of 4 players' views verified via JSON.stringify — no cross-player rack tile leakage
- Added `buildSpectatorView()` — public-only view with no rack data, no myPlayerId/myRack fields
- Added `SpectatorGameView` type to shared/types/protocol.ts
- Implemented `SHOW_HAND` action with validate-then-mutate pattern: scoreboard-only, idempotent, copies rack to shownHands
- Added `shownHands: Record<string, Tile[]>` to `GameState`, `PlayerGameView`, and `SpectatorGameView`
- Added `HAND_SHOWN` to `ResolvedAction` union
- 7 new show-hand unit tests covering: success, phase rejection, unknown player, idempotency, multi-player independence
- Total tests: 744 (591 shared + 21 client + 132 server) — 34 new tests, 0 regressions
- Pre-existing lint error in call-window.test.ts unchanged; my changes actually reduced pre-existing TS errors from 16 to 1

### Change Log

- 2026-03-29: Implemented per-player view filtering security tests, spectator view, and SHOW_HAND action (4a-6)

### File List

New files:
- packages/shared/src/engine/actions/show-hand.ts
- packages/shared/src/engine/actions/show-hand.test.ts
- _bmad-output/implementation-artifacts/4a-6-per-player-view-filtering-security-test.md

Modified files:
- packages/shared/src/types/game-state.ts (added shownHands to GameState, HAND_SHOWN to ResolvedAction)
- packages/shared/src/types/actions.ts (added ShowHandAction to GameAction union)
- packages/shared/src/types/protocol.ts (added SpectatorGameView, shownHands to PlayerGameView and SpectatorGameView)
- packages/shared/src/index.ts (exported SpectatorGameView, ShowHandAction, handleShowHand)
- packages/shared/src/engine/game-engine.ts (added SHOW_HAND case, shownHands init in createLobbyState)
- packages/shared/src/engine/state/create-game.ts (added shownHands init)
- packages/server/src/websocket/state-broadcaster.ts (added buildSpectatorView, shownHands in both view builders)
- packages/server/src/websocket/state-broadcaster.test.ts (exhaustive 4-player security tests, spectator tests, shownHands tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (4a-6 status updates)
