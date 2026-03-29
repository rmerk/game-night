# Story 4A.3: Room Join via WebSocket & Seat Assignment

Status: done

## Story

As a **player**,
I want **to join a game room by connecting via WebSocket with the room code and my display name, and be assigned a seat**,
So that **I arrive at the table ready to play with my friends (FR2, FR7)**.

## Acceptance Criteria

1. **Given** a room exists with fewer than 4 players **When** a player connects via WebSocket with `{ roomCode, displayName }` **Then** the player is assigned the next available seat (`player-0` through `player-3`), assigned a wind, and receives the initial lobby state via `STATE_UPDATE`

2. **Given** a room already has 4 connected players **When** a 5th player attempts to connect **Then** the connection is rejected with an error message (5th player handling deferred to Epic 4B)

3. **Given** a player joins **When** other players are in the room **Then** all existing players receive a `STATE_UPDATE` with `resolvedAction: { type: 'PLAYER_JOINED', playerId, playerName }`

4. **Given** a player joins **When** checking the `PlayerPublicInfo` in the state **Then** it includes the player's `displayName`, `playerId`, `wind`, `isHost`, and connection status

5. **Given** player IDs **When** assigned by the server **Then** they are stable for the room's lifetime — `player-0` through `player-3` in seat assignment order (AR6)

## Tasks / Subtasks

- [x] Task 1: Define shared protocol types for join flow (AC: 1, 3, 4)
  - [x] 1.1 Add `JoinRoomMessage` type to `packages/shared/src/types/protocol.ts` with fields: `version`, `type: 'JOIN_ROOM'`, `roomCode`, `displayName`, optional `token`
  - [x] 1.2 Add `StateUpdateMessage` type with `version`, `type: 'STATE_UPDATE'`, `state: LobbyState`, optional `resolvedAction`, optional `token` (for first-join token delivery, used in 4A.4)
  - [x] 1.3 Add `LobbyState` type with `roomId`, `roomCode`, `gamePhase: 'lobby'`, `players: PlayerPublicInfo[]`, `myPlayerId`
  - [x] 1.4 Add `PlayerPublicInfo` type: `playerId`, `displayName`, `wind: SeatWind`, `isHost`, `connected: boolean`
  - [x] 1.5 Add `PLAYER_JOINED` to `ResolvedAction` union in `game-state.ts`
  - [x] 1.6 Export all new types from `packages/shared/src/index.ts`

- [x] Task 2: Extend Room model for player tracking (AC: 1, 5)
  - [x] 2.1 Update `PlayerInfo` in `packages/server/src/rooms/room.ts` to add `wind: SeatWind` field
  - [x] 2.2 Add `PlayerSession` interface in `packages/server/src/rooms/room.ts`: maps playerId → { playerId, roomCode, ws, displayName, wind, isHost, connected }
  - [x] 2.3 Add `sessions: Map<string, PlayerSession>` to `Room` interface for token-to-session mapping (preparation for 4A.4, use playerId as key for now)
  - [x] 2.4 Add seat assignment helper in `packages/server/src/rooms/seat-assignment.ts`: returns next available `player-N` ID and wind based on occupied seats

- [x] Task 3: Implement join handler in WebSocket message flow (AC: 1, 2, 3)
  - [x] 3.1 Create `packages/server/src/websocket/join-handler.ts` with `handleJoinRoom(ws, message, roomManager, logger)` function
  - [x] 3.2 Validate `roomCode` present and room exists (reject with `ROOM_NOT_FOUND` error if not)
  - [x] 3.3 Validate `displayName` present, 1-30 chars, strip control characters (same sanitization as `routes.ts`)
  - [x] 3.4 Check room capacity — if 4 players already, reject with `ROOM_FULL` error and close WebSocket
  - [x] 3.5 Assign seat (next available `player-0` through `player-3`) and wind
  - [x] 3.6 Add player to room's `players` map and `sessions` map
  - [x] 3.7 First player to join becomes host (`isHost: true`); subsequent players are not host
  - [x] 3.8 Send `STATE_UPDATE` with `LobbyState` to the joining player
  - [x] 3.9 Broadcast `STATE_UPDATE` with `resolvedAction: { type: 'PLAYER_JOINED' }` to all other connected players in the room

- [x] Task 4: Wire join handler into WebSocket server (AC: 1)
  - [x] 4.1 Update `ws-server.ts` `setupWebSocketServer` to accept `roomManager` parameter
  - [x] 4.2 Update `message-handler.ts` to route `type: 'JOIN_ROOM'` messages via ws-server.ts message handler
  - [x] 4.3 Update `index.ts` to pass `roomManager` to `setupWebSocketServer`
  - [x] 4.4 Track room-scoped connections: when a player joins, associate the WebSocket with the room/player so disconnection can be detected per-room

- [x] Task 5: Handle player disconnection during lobby (AC: 4)
  - [x] 5.1 On WebSocket `close` event for a joined player, update `connected: false` in the room's player record
  - [x] 5.2 Broadcast `STATE_UPDATE` to remaining players with updated connection status
  - [x] 5.3 Do NOT remove the player's seat — seat is reserved (reconnection will be handled in 4A.4)
  - [x] 5.4 Log disconnection with room context

- [x] Task 6: Write comprehensive tests (AC: 1, 2, 3, 4, 5)
  - [x] 6.1 Unit tests for seat assignment logic (sequential assignment, gap-filling after disconnect)
  - [x] 6.2 Unit tests for join validation (missing roomCode, invalid displayName, room not found)
  - [x] 6.3 Integration tests: single player joins and receives lobby state
  - [x] 6.4 Integration tests: 4 players join sequentially, each receives correct state
  - [x] 6.5 Integration tests: 5th player rejected with `ROOM_FULL`
  - [x] 6.6 Integration tests: existing players receive `PLAYER_JOINED` broadcast
  - [x] 6.7 Integration tests: player IDs are `player-0` through `player-3` in order
  - [x] 6.8 Integration tests: wind assignment matches seat order
  - [x] 6.9 Integration tests: first joiner is host
  - [x] 6.10 Integration test: disconnected player shows `connected: false` in state

## Dev Notes

### Architecture Compliance

- **Server-authoritative model**: All seat assignment happens server-side. Client sends `JOIN_ROOM`, server validates and assigns.
- **No optimistic updates**: Client renders lobby state ONLY from `STATE_UPDATE` messages.
- **Validate-then-mutate**: Join handler must validate all preconditions (room exists, not full, valid displayName) before any state mutation.
- **Concurrency safety**: Node single-threaded event loop guarantees sequential join processing — no race conditions between concurrent joins.

### Existing Code to Extend (Do NOT Reinvent)

| What | Where | How to Extend |
|------|-------|---------------|
| Room type | `packages/server/src/rooms/room.ts` | Add `wind` to `PlayerInfo`, add `sessions` map to `Room` |
| RoomManager | `packages/server/src/rooms/room-manager.ts` | Add methods: `addPlayer(code, playerInfo)`, `getRoom(code)` already exists |
| WebSocket server | `packages/server/src/websocket/ws-server.ts` | Pass `roomManager` to setup function |
| Message handler | `packages/server/src/websocket/message-handler.ts` | Route `JOIN_ROOM` type to join handler |
| Protocol types | `packages/shared/src/types/protocol.ts` | Add `JoinRoomMessage`, `StateUpdateMessage`, `LobbyState`, `PlayerPublicInfo` |
| SeatWind type | `packages/shared/src/types/game-state.ts:11` | Already exists: `"east" | "south" | "west" | "north"` — import and reuse |
| ResolvedAction | `packages/shared/src/types/game-state.ts:138` | Add `PLAYER_JOINED` variant to the union |
| App factory | `packages/server/src/index.ts` | `roomManager` already created, pass to `setupWebSocketServer` |
| DisplayName sanitization | `packages/server/src/http/routes.ts` | Extract shared sanitizer or replicate: 1-30 chars, strip control chars |

### Wind Assignment Order

Assign winds in seat order: `player-0` = East, `player-1` = South, `player-2` = West, `player-3` = North. This matches `SeatWind` type in `game-state.ts`.

### Host Assignment

The player who created the room via `POST /api/rooms` is the host. The `hostToken` is already stored in `Room`. When the first player joins via WebSocket, match their identity to the host. For this story, the first WebSocket joiner is treated as host. Token-based host identification will be refined in 4A.4 (Session Identity).

### Message Flow

```
Client                          Server
  |                               |
  |-- ws.connect() -------------->|
  |                               | (connection tracked by ConnectionTracker)
  |-- { type: 'JOIN_ROOM',   --->|
  |    roomCode, displayName }    |
  |                               | validate room exists
  |                               | validate not full
  |                               | assign seat + wind
  |                               | add to room.players
  |                               |
  |<-- STATE_UPDATE (lobby) ------|
  |    { state: LobbyState,      |
  |      myPlayerId: 'player-0'} |
  |                               |
  |                               |--- STATE_UPDATE (broadcast) -->| other players
  |                               |    { resolvedAction:           |
  |                               |      PLAYER_JOINED }           |
```

### Error Responses

Use existing `ServerErrorMessage` from `protocol.ts` for all error cases:
- `ROOM_NOT_FOUND` — room code doesn't match any active room
- `ROOM_FULL` — room already has 4 players
- `INVALID_DISPLAY_NAME` — missing or invalid displayName
- `MISSING_ROOM_CODE` — roomCode not provided

After sending error, close the WebSocket with appropriate close code.

### Testing Patterns (from 4A.2)

- Use real Fastify instance + real WebSocket connections (not mocked)
- `vi.useFakeTimers()` only when testing time-dependent behavior
- WebSocket client via `ws` library in tests
- Pattern: create app → start listening → connect ws client → send message → assert response
- Clean up: close all ws clients and app after each test

### What This Story Does NOT Include

- **Session tokens** — deferred to 4A.4
- **Reconnection** — deferred to 4A.4 and Epic 4B
- **5th player spectator mode** — deferred to Epic 4B
- **Host migration** — deferred to Epic 4B
- **Game start** — deferred to 4A.7
- **Action dispatching** — deferred to 4A.5

### Project Structure Notes

New files follow established server directory patterns:
- Join handler: `packages/server/src/websocket/join-handler.ts` + `join-handler.test.ts`
- Player session type: `packages/server/src/rooms/player-session.ts`
- Shared types extend existing files — no new type files needed

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4A, Story 4A.3]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Session Identity, Room Management, WebSocket Patterns]
- [Source: packages/shared/src/types/game-state.ts — SeatWind, ResolvedAction types]
- [Source: packages/shared/src/types/protocol.ts — PROTOCOL_VERSION, ServerErrorMessage]
- [Source: packages/server/src/rooms/room.ts — Room, PlayerInfo interfaces]
- [Source: packages/server/src/websocket/ws-server.ts — setupWebSocketServer, WsServerContext]
- [Source: packages/server/src/websocket/message-handler.ts — handleMessage, ParsedMessage]
- [Source: _bmad-output/implementation-artifacts/4a-2-websocket-server-connection-management.md — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 6 tasks and 30+ subtasks completed
- Shared protocol types defined: JoinRoomMessage, StateUpdateMessage, LobbyState, PlayerPublicInfo
- PLAYER_JOINED added to ResolvedAction union
- Room model extended with wind, connected fields, PlayerSession, sessions map
- Seat assignment helper created with sequential player-0..3 and gap-filling
- Join handler: validates inputs, assigns seats/winds, sends lobby state, broadcasts PLAYER_JOINED
- Disconnection handler: marks player as disconnected, preserves seat, broadcasts updated state
- 17 new tests (6 unit + 11 integration), 669 total tests pass, 0 lint errors
- All 5 acceptance criteria satisfied

### File List

- packages/shared/src/types/protocol.ts (modified — added JoinRoomMessage, StateUpdateMessage, LobbyState, PlayerPublicInfo)
- packages/shared/src/types/game-state.ts (modified — added PLAYER_JOINED to ResolvedAction)
- packages/shared/src/index.ts (modified — exported new protocol types)
- packages/server/src/rooms/room.ts (modified — added wind, connected to PlayerInfo; added PlayerSession, sessions to Room)
- packages/server/src/rooms/room-manager.ts (modified — added sessions map to room creation)
- packages/server/src/rooms/seat-assignment.ts (new — seat assignment helper)
- packages/server/src/rooms/seat-assignment.test.ts (new — 6 unit tests)
- packages/server/src/websocket/join-handler.ts (new — join room handler with validation, seat assignment, broadcasting)
- packages/server/src/websocket/join-handler.test.ts (new — 11 integration tests)
- packages/server/src/websocket/ws-server.ts (modified — accepts roomManager, routes JOIN_ROOM messages)
- packages/server/src/index.ts (modified — passes roomManager to setupWebSocketServer)
