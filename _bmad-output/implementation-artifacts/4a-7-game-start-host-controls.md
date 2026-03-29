# Story 4A.7: Game Start & Host Controls

Status: done

## Story

As a **host player**,
I want **to start the game when all 4 seats are filled, with the server validating preconditions**,
So that **only the host can initiate the game and only when the room is ready (FR2)**.

## Acceptance Criteria

### AC1: Successful Game Start by Host
```gherkin
Given exactly 4 players are connected and the game phase is lobby
When the host dispatches START_GAME
Then the server initializes the game (dealing, seat/wind assignment)
And gamePhase transitions from lobby to play
And all players receive STATE_UPDATE with their dealt tiles (via view filtering)
And the resolvedAction is { type: 'GAME_STARTED' }
```

### AC2: Reject — Not Enough Players
```gherkin
Given fewer than 4 players are connected
When the host dispatches START_GAME
Then { accepted: false, reason: 'NOT_ENOUGH_PLAYERS' } is returned
And the error is sent only to the host — no broadcast
```

### AC3: Reject — Non-Host Player
```gherkin
Given a non-host player
When they dispatch START_GAME
Then { accepted: false, reason: 'NOT_HOST' } is returned
And the error is sent only to that player
```

### AC4: Reject — Wrong Phase
```gherkin
Given the game is already in progress (phase is not lobby)
When START_GAME is dispatched
Then { accepted: false, reason: 'WRONG_PHASE' } is returned
```

### AC5: Initial Game State Correctness
```gherkin
Given the host starts the game
When the initial state is broadcast
Then East (player-0) receives 14 tiles, others receive 13
And wallRemaining is 99
And currentTurn is the East player
And turnPhase is discard (East discards first, no draw)
And each player's STATE_UPDATE includes only their own rack
```

## Tasks / Subtasks

- [x] Task 1: Wire START_GAME through the server action handler (AC: #1, #2, #3, #4)
  - [x] 1.1: Modify `action-handler.ts` to allow START_GAME when `room.gameState` is null — initialize lobby state and dispatch
  - [x] 1.2: Add host authorization check — compare `playerId` against `room.players` to find the host, reject non-hosts with `NOT_HOST`
  - [x] 1.3: Add connected player count check — count players where `connected === true`, reject if < 4 with `NOT_ENOUGH_PLAYERS`
  - [x] 1.4: Build the `StartGameAction` with `playerIds` from the room's connected players (in seat order: player-0 through player-3)
  - [x] 1.5: On success, store the resulting `GameState` in `room.gameState` and update `room.gamePhase` (or remove the redundant field)
  - [x] 1.6: Broadcast the new game state using `broadcastGameState(room, room.gameState, resolvedAction)`
- [x] Task 2: Update Room type to support game phase transitions (AC: #1, #4)
  - [x] 2.1: Change `Room.gamePhase` type from literal `"lobby"` to `GamePhase` (or remove it if `room.gameState.gamePhase` is the source of truth)
  - [x] 2.2: Update `getRoomStatus()` in room-manager.ts to derive phase from `room.gameState?.gamePhase ?? "lobby"`
- [x] Task 3: Write server-level tests for START_GAME flow (AC: #1-#5)
  - [x] 3.1: Test host can start game with 4 connected players — verify `room.gameState` is set, broadcast sent to all 4 players
  - [x] 3.2: Test non-host rejected with `NOT_HOST` error sent only to them
  - [x] 3.3: Test start rejected when < 4 players connected (e.g., 3 connected + 1 disconnected)
  - [x] 3.4: Test start rejected when game already in progress (room.gameState exists with phase != lobby)
  - [x] 3.5: Test each player receives correctly filtered view — own rack only, no opponent racks
  - [x] 3.6: Test resolvedAction is `{ type: 'GAME_STARTED' }` in all broadcast messages
- [x] Task 4: Verify no regressions (all existing tests pass)
  - [x] 4.1: Run `pnpm -r test` and confirm zero regressions

## Dev Notes

### Critical Implementation Context

This story bridges the lobby (managed by `join-handler.ts`) and the game (managed by `action-handler.ts`). The key gap: `action-handler.ts` currently rejects ALL actions when `room.gameState` is null (line 33), which blocks START_GAME from ever executing during the lobby phase. This is the primary code change needed.

### What Already Exists — Extend, Don't Recreate

**Shared engine (complete — no changes needed):**
- `packages/shared/src/engine/actions/game-flow.ts` — `handleStartGame(state, action)` validates lobby phase, player count, duplicates, then calls `createGame()` and returns `{ type: 'GAME_STARTED' }`
- `packages/shared/src/engine/actions/game-flow.test.ts` — 9 tests covering all validation paths
- `packages/shared/src/engine/state/create-game.ts` — `createGame(playerIds, seed)` creates wall, deals tiles (14 to East, 13 to others), assigns winds, sets phase to "play"
- `packages/shared/src/engine/game-engine.ts` — `handleAction()` already dispatches `START_GAME` to `handleStartGame`. `createLobbyState()` creates an empty lobby-phase GameState.

**Server infrastructure (complete — extend only):**
- `packages/server/src/websocket/action-handler.ts` — needs modification to handle START_GAME before `room.gameState` exists
- `packages/server/src/websocket/state-broadcaster.ts` — `broadcastGameState(room, gameState, resolvedAction)` and `buildPlayerView()` are fully implemented
- `packages/server/src/rooms/room.ts` — `Room` type has `gameState: GameState | null` and `gamePhase: "lobby"` (needs type widening)
- `packages/server/src/rooms/room-manager.ts` — `getRoomStatus()` returns phase from `room.gamePhase`

**Types (complete — no changes needed):**
- `StartGameAction` — `{ type: 'START_GAME', playerIds: string[], seed?: number }`
- `GamePhase` — `"lobby" | "charleston" | "play" | "scoreboard" | "rematch"`
- `PlayerGameView` — full per-player filtered view type
- `LobbyState` — lobby-specific view type

### Implementation Strategy

The cleanest approach for the action-handler gap:

```typescript
// In action-handler.ts — replace the early return with START_GAME handling
if (!room.gameState) {
  if (actionObj.type === 'START_GAME') {
    // Initialize lobby state so the engine can process START_GAME
    // (Host and player count checks happen here, before engine dispatch)
  } else {
    sendActionError(ws, 'GAME_NOT_STARTED', 'No active game in this room');
    return;
  }
}
```

**Host authorization:** Check `room.players.get(playerId)?.isHost === true`. The host is set during join — first player to join becomes host (`join-handler.ts:301`).

**Player count:** Count connected players: `Array.from(room.players.values()).filter(p => p.connected).length`. Must be exactly 4.

**Building the action:** The engine's `handleStartGame` expects `playerIds: string[]`. Build from room players in seat order:
```typescript
const playerIds = Array.from(room.players.entries())
  .sort(([a], [b]) => a.localeCompare(b))  // player-0, player-1, player-2, player-3
  .map(([id]) => id);
```

**After engine accepts:** Store `room.gameState` (it was mutated in-place by `handleStartGame` via `Object.assign`), then call `broadcastGameState(room, room.gameState, result.resolved)`.

### Room.gamePhase Type Issue

Currently `Room.gamePhase` is typed as literal `"lobby"`. Two options:
1. **Widen to `GamePhase`** and keep it in sync with `room.gameState.gamePhase`
2. **Remove `room.gamePhase`** and derive from `room.gameState?.gamePhase ?? "lobby"`

Option 2 is cleaner (single source of truth), but check that `getRoomStatus()` in room-manager.ts and any other consumers are updated. Currently only `getRoomStatus()` reads `room.gamePhase`.

### Action Handler Flow After Changes

```
Client sends ACTION { type: 'START_GAME' }
  → ws-server.ts finds session via findSessionByWs()
  → action-handler.ts receives (ws, message, room, playerId, logger)
    → Validates action payload structure
    → If room.gameState is null AND action is START_GAME:
      → Check isHost (reject with NOT_HOST if false)
      → Check connected player count (reject with NOT_ENOUGH_PLAYERS if < 4)
      → Initialize room.gameState = createLobbyState()
      → Build StartGameAction with playerIds from room
      → Call handleAction(room.gameState, action)
      → If accepted: broadcastGameState(room, room.gameState, result.resolved)
      → If rejected: send error to client
    → If room.gameState is null AND action is not START_GAME:
      → Reject with GAME_NOT_STARTED
    → If room.gameState exists:
      → Normal flow (existing code)
```

### Test Helpers Available

From previous stories, these server test helpers exist:
- `createMockWs()` — mock WebSocket
- `createMockLogger()` — mock Pino logger
- `createTestPlayer()` — creates PlayerInfo
- `createTestRoom()` — creates Room with defaults
- `mockSend()` / `parseSentMessage()` — capture and parse sent messages

Check `packages/server/src/websocket/state-broadcaster.test.ts` and `packages/server/src/websocket/action-handler.test.ts` for test patterns.

### Anti-Patterns to Avoid

- **DO NOT** add host authorization to the shared engine (`handleStartGame`). Host identity is a server-side concern — the engine validates game state only. Server checks host/player count, then delegates game logic to the engine.
- **DO NOT** send `LobbyState` after START_GAME — send `PlayerGameView` via `broadcastGameState`. The transition from LobbyState to PlayerGameView happens naturally because the state broadcaster reads `gamePhase` from the GameState.
- **DO NOT** create a new action type for host-gated actions. Use the existing `START_GAME` action and add authorization as a server-side guard.
- **DO NOT** modify `game-flow.ts` or `game-flow.test.ts` — the shared engine is complete. All changes are in the server package.
- **DO NOT** introduce `async` operations between validation and state mutation — Node's single-threaded event loop guarantees sequential processing per room.
- **DO NOT** mock the game engine in tests — use real `handleAction` with test state fixtures.

### Previous Story Learnings (4a-6)

- Token-to-playerId resolution pattern: `room.tokenMap.get(token)` → playerId
- `findSessionByWs()` on RoomManager handles reverse WebSocket-to-player lookup
- Stale WebSocket guard: check `session.ws !== ws` before processing
- State broadcaster already handles per-player filtering correctly (exhaustively tested in 4a-6)
- Total tests at end of 4a-6: 744 (591 shared + 21 client + 132 server)
- Pre-existing lint error in call-window.test.ts — unchanged, do not attempt to fix

### Project Structure Notes

- All server changes go in `packages/server/src/` — this is a server-only story
- No changes needed in `packages/shared/` — the engine already handles START_GAME
- No changes needed in `packages/client/` — client-side game start UI is Epic 5A
- Test files co-located: `action-handler.test.ts` next to `action-handler.ts`
- Follow validate-then-mutate pattern in the server handler (host check → player count check → engine dispatch)
- Use `vi.useFakeTimers()` if any timer behavior needs testing (unlikely for this story)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4A, Story 4A.7]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#START_GAME-Preconditions]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#Action-Handler-Convention]
- [Source: _bmad-output/planning-artifacts/game-architecture.md#WebSocket-Message-Handler-Pattern]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Game-Start-Flow]
- [Source: _bmad-output/project-context.md#Server-Authority, #Validate-Then-Mutate]
- [Source: packages/server/src/websocket/action-handler.ts — line 33: the null gameState guard to modify]
- [Source: packages/shared/src/engine/actions/game-flow.ts — handleStartGame (complete, don't modify)]
- [Source: packages/shared/src/engine/game-engine.ts — createLobbyState() for initialization]
- [Source: packages/server/src/rooms/room.ts — Room type definition]
- [Source: packages/server/src/websocket/state-broadcaster.ts — broadcastGameState, buildPlayerView]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Added `handleStartGameAction()` to `action-handler.ts` — server-side host authorization and player count validation before delegating to the shared engine
- Modified the `!room.gameState` guard to allow START_GAME actions through to the new handler while blocking all other actions
- Removed redundant `Room.gamePhase` field — derived from `room.gameState?.gamePhase ?? "lobby"` (single source of truth)
- Updated `getRoomStatus()` in `room-manager.ts` to derive phase from game state
- Removed `gamePhase` from all test mock Room objects (3 test files updated)
- 7 new integration tests covering: successful start, per-player view filtering, tile dealing correctness, non-host rejection, insufficient players rejection, already-in-progress rejection, error isolation (no broadcast on rejection)
- Total tests: 751 (591 shared + 21 client + 139 server) — 7 new tests, 0 regressions
- Lint: 0 errors (17 pre-existing Vue template warnings unchanged)

### Change Log

- 2026-03-29: Implemented START_GAME host controls with server-side authorization, player count validation, and Room.gamePhase cleanup (4a-7)

### File List

Modified files:
- packages/server/src/websocket/action-handler.ts (added handleStartGameAction, modified gameState null guard)
- packages/server/src/websocket/action-handler.test.ts (7 new START_GAME tests)
- packages/server/src/rooms/room.ts (removed gamePhase field from Room interface)
- packages/server/src/rooms/room-manager.ts (derive phase from gameState, removed gamePhase from createRoom)
- packages/server/src/rooms/seat-assignment.test.ts (removed gamePhase from mock Room)
- packages/server/src/rooms/session-manager.test.ts (removed gamePhase from mock Room)
- packages/server/src/websocket/state-broadcaster.test.ts (removed gamePhase from mock Room)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status updates)
- _bmad-output/implementation-artifacts/4a-7-game-start-host-controls.md (this file)
