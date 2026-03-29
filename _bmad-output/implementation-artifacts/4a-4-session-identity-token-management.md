# Story 4A.4: Session Identity & Token Management

Status: done

## Story

As a **player**,
I want **a server-generated session token stored in my browser's sessionStorage that identifies me across reconnections**,
So that **I can refresh my browser or recover from a network hiccup without losing my seat (AR6)**.

## Acceptance Criteria

1. **Given** a player joins a room for the first time (no token) **When** the server sends the first `STATE_UPDATE` **Then** it includes a UUID session token that the client stores in sessionStorage

2. **Given** a player reconnects with a valid token **When** connecting via WebSocket with `{ roomCode, token }` **Then** the server maps the token to the player's existing seat and sends full game state

3. **Given** a player opens a second tab with the same sessionStorage token **When** the second connection arrives **Then** the first connection receives `{ type: 'SESSION_SUPERSEDED' }` and is disconnected — one active connection per token

4. **Given** a player closes their browser tab **When** sessionStorage is cleared **Then** the token is gone — a new tab would join as a new player (if a seat is available)

5. **Given** a player refreshes the page **When** the page reloads **Then** sessionStorage preserves the token, and the player seamlessly reconnects to their seat

6. **Given** a tokenless client connects to a room where a seat is in grace period **When** the `displayName + roomCode` matches exactly one disconnected seat **Then** the server reissues a token and restores the player to their seat (token delivery failure recovery)

## Tasks / Subtasks

- [x] Task 1: Implement server-side token generation and session registry (AC: 1, 2)
  - [x] 1.1 Create `packages/server/src/rooms/session-manager.ts` with functions: `createSessionToken(room, playerId)` → generates UUID via `crypto.randomUUID()`, stores bidirectional mapping on room
  - [x] 1.2 Add `tokenMap: Map<string, string>` to `Room` interface in `room.ts` (maps `token → playerId`) — session tokens scoped per room
  - [x] 1.3 Add `playerTokens: Map<string, string>` to `Room` (maps `playerId → token`) for reverse lookup during supersession
  - [x] 1.4 Update `RoomManager` to expose token lookup: `findPlayerByToken(token): { room: Room, playerId: string } | null`
  - [x] 1.5 Write unit tests for `session-manager.ts`: token uniqueness, lookup correctness, token-player bidirectional mapping

- [x] Task 2: Integrate token delivery into join flow (AC: 1)
  - [x] 2.1 Update `join-handler.ts`: after seat assignment, generate token via `createSessionToken`, store in room's `tokenMap` and `playerTokens`
  - [x] 2.2 Include `token` field in the `StateUpdateMessage` sent to the joining player (field already exists in protocol type)
  - [x] 2.3 Ensure token is ONLY sent to the joining player, NOT in broadcast `STATE_UPDATE` to other players
  - [x] 2.4 Write integration tests: new player receives token in first STATE_UPDATE, other players do NOT receive a token

- [x] Task 3: Implement token-based reconnection (AC: 2, 5)
  - [x] 3.1 Update `join-handler.ts` to check for `token` field in `JoinRoomMessage` (field already exists in type)
  - [x] 3.2 If token present: look up in room's `tokenMap` → resolve to `playerId` → validate player exists and belongs to the room
  - [x] 3.3 On valid token: update `PlayerSession.ws` to new WebSocket, set `connected: true`, send full `STATE_UPDATE` with same token, broadcast `PLAYER_RECONNECTED` to others
  - [x] 3.4 On invalid/expired token: treat as new player join (fall through to normal join flow)
  - [x] 3.5 Write integration tests: reconnect with valid token restores seat, reconnect with invalid token joins as new player

- [x] Task 4: Implement session supersession — one connection per token (AC: 3)
  - [x] 4.1 Add `SystemEventMessage` type with `SESSION_SUPERSEDED` event in `packages/shared/src/types/protocol.ts`
  - [x] 4.2 In reconnection handler: before attaching new WebSocket, check if old WebSocket is still open for that player
  - [x] 4.3 If old connection exists and is OPEN: send `{ type: 'SYSTEM_EVENT', event: 'SESSION_SUPERSEDED', version: 1 }` to old connection, then close it
  - [x] 4.4 Then attach new WebSocket to the session
  - [x] 4.5 Write integration tests: two connections with same token — first gets SESSION_SUPERSEDED and is disconnected, second receives full state

- [x] Task 5: Implement grace period recovery for tokenless reconnection (AC: 6)
  - [x] 5.1 When a player disconnects, start a 30-second grace period timer for their seat (use `setTimeout`, store timer ref on Room)
  - [x] 5.2 During grace period: seat remains reserved, player marked as `connected: false`
  - [x] 5.3 When a tokenless `JoinRoomMessage` arrives: check if `displayName + roomCode` matches exactly one disconnected seat in grace period
  - [x] 5.4 If exactly one match: reissue new token, restore player to that seat, cancel grace period timer
  - [x] 5.5 If zero matches or multiple matches: fall through to normal new-player join flow
  - [x] 5.6 When grace period expires: release the seat (remove player from room), make it available for new players
  - [x] 5.7 Write unit and integration tests: grace period recovery by displayName, ambiguous name rejection, grace period expiry releases seat

- [x] Task 6: Update disconnect handling (AC: 4)
  - [x] 6.1 Update the existing `close` handler in `join-handler.ts` to start grace period timer on disconnect (Task 5.1)
  - [x] 6.2 Broadcast `STATE_UPDATE` with `connected: false` status to remaining players (already exists from 4a-3)
  - [x] 6.3 On grace period expiry, broadcast another `STATE_UPDATE` showing the seat is now empty
  - [x] 6.4 Write integration test: disconnect → grace period → expiry → seat released

- [x] Task 7: Comprehensive test suite (AC: 1-6)
  - [x] 7.1 Integration test: full lifecycle — join → receive token → disconnect → reconnect with token → same seat
  - [x] 7.2 Integration test: page refresh simulation — connect with token → close → reconnect with same token → same seat (covered by 7.1)
  - [x] 7.3 Integration test: duplicate tab — two connections with same token → first superseded
  - [x] 7.4 Integration test: grace period recovery — join → disconnect before token stored → reconnect tokenless with same displayName → same seat
  - [x] 7.5 Integration test: grace period expiry — join → disconnect → wait grace period → reconnect → new seat (if available)
  - [x] 7.6 Integration test: 4 players join → 1 disconnects → reconnects with token → original seat preserved
  - [x] 7.7 Edge case: invalid token + full room = rejected (not treated as new player since no seats available)

## Dev Notes

### Architecture Compliance

- **Server-authoritative**: All token generation and validation happens server-side. Client sends token, server validates and maps to seat.
- **No optimistic updates**: Client stores token in sessionStorage but does NOT use it to predict seat assignment or state.
- **Validate-then-mutate**: Token lookup and validation must complete before any state mutation (seat restoration, WebSocket swap).
- **Information boundary**: Token is sent ONLY to the owning player. Never include another player's token in any broadcast.

### Existing Code to Extend (Do NOT Reinvent)

| What | Where | How to Extend |
|------|-------|---------------|
| Room type | `packages/server/src/rooms/room.ts` | Add `tokenMap: Map<string, string>` and `playerTokens: Map<string, string>` |
| RoomManager | `packages/server/src/rooms/room-manager.ts` | Add `findPlayerByToken(token)` method |
| Join handler | `packages/server/src/websocket/join-handler.ts` | Add token generation on join, token-based reconnection branch |
| Protocol types | `packages/shared/src/types/protocol.ts` | `token` field ALREADY EXISTS on `JoinRoomMessage` and `StateUpdateMessage` — just use them |
| PlayerSession | `packages/server/src/rooms/room.ts` | Already has `ws: WebSocket` — update it on reconnection |
| PlayerInfo | `packages/server/src/rooms/room.ts` | Already has `connected: boolean` — toggle on reconnect/disconnect |
| Connection close handler | `packages/server/src/websocket/join-handler.ts` | Already marks `connected: false` — add grace period timer start |
| DisplayName sanitization | `packages/server/src/websocket/join-handler.ts` | Already exists — reuse for grace period matching |
| PROTOCOL_VERSION | `packages/shared/src/types/protocol.ts` | = 1, include in all new message types |
| SeatWind type | `packages/shared/src/types/game-state.ts:11` | Already exists — import as needed |
| Seat assignment | `packages/server/src/rooms/seat-assignment.ts` | Already handles gap-filling — grace period expiry makes gaps |
| RoomManager.createRoom | `packages/server/src/rooms/room-manager.ts` | Already generates `hostToken` (UUID) — same pattern for session tokens |

### Token Format and Generation

- Use `crypto.randomUUID()` (Node.js built-in, no dependencies)
- Same approach already used for `roomId` and `hostToken` in `room-manager.ts`
- Token format: UUID v4 string (e.g., `"f47ac10b-58cc-4372-a567-0d02b2c3d479"`)

### Protocol Types — Already Defined

The `JoinRoomMessage` in `protocol.ts` already has an optional `token?: string` field. The `StateUpdateMessage` already has an optional `token?: string` field. These were added in story 4a-3 as preparation — just use them.

New type needed:
```typescript
interface SystemEventMessage {
  version: 1;
  type: 'SYSTEM_EVENT';
  event: 'SESSION_SUPERSEDED';
  message?: string;
}
```

### Session Data Flow

```
NEW PLAYER JOIN:
  Client                              Server
    |-- { type: 'JOIN_ROOM',     --->|
    |    roomCode, displayName }      |
    |                                 | assign seat
    |                                 | generate token (crypto.randomUUID())
    |                                 | store: tokenMap[token] = playerId
    |                                 | store: playerTokens[playerId] = token
    |<-- STATE_UPDATE + token --------|
    | (store token in sessionStorage) |

RECONNECTION (page refresh):
  Client                              Server
    |-- { type: 'JOIN_ROOM',     --->|
    |    roomCode, token }            |
    |                                 | lookup tokenMap[token] → playerId
    |                                 | validate player in room
    |                                 | swap WebSocket on PlayerSession
    |                                 | set connected: true
    |<-- STATE_UPDATE + token --------|
    |                                 |--- PLAYER_RECONNECTED broadcast -->|

SESSION SUPERSEDED (duplicate tab):
  Client (Tab1)    Server           Client (Tab2)
    |               |<--- JOIN_ROOM + token ----|
    |               | lookup token → same player
    |<-- SESSION_SUPERSEDED --|                  |
    | (close)       | swap WebSocket to Tab2     |
    |               |--- STATE_UPDATE + token -->|

GRACE PERIOD RECOVERY (token delivery failure):
  Client                              Server
    |-- { type: 'JOIN_ROOM',     --->|
    |    roomCode, displayName }      | (no token)
    |                                 | check: any disconnected seat in grace period
    |                                 |   with matching displayName?
    |                                 | exactly one match → restore to that seat
    |                                 | generate NEW token
    |<-- STATE_UPDATE + new token ----|
```

### Grace Period Configuration

- Duration: 30 seconds (per architecture `shared/defaults.ts` convention)
- Define as constant: `GRACE_PERIOD_MS = 30_000` in session-manager or a constants file
- Use `setTimeout` for grace period timers — these run in server/ (not shared/), so timers are allowed
- Store timer references on the Room so they can be cancelled on reconnection or room cleanup
- Use `vi.useFakeTimers()` in tests for grace period expiry scenarios

### Error Handling

- Invalid token on reconnect: log at WARN level, fall through to new-player join flow — do NOT reject
- Token lookup miss: could mean room was cleaned up or token expired with room — treat as new player
- Grace period with ambiguous displayName match: log at DEBUG, proceed as new player (do not reject)
- Use `ServerErrorMessage` from `protocol.ts` for true errors (ROOM_NOT_FOUND, ROOM_FULL)

### What This Story Does NOT Include

- **Client-side sessionStorage logic** — client implementation deferred (Epic 5A handles UI/client)
- **Full reconnection with game state restore** — deferred to Epic 4B (this story handles identity/seat mapping only)
- **Host migration** — deferred to Epic 4B
- **Room cleanup on disconnect** — deferred to 4A.8
- **Action message authentication** — deferred to 4A.5 (this story establishes the token → playerId mapping that 4A.5 will use)
- **Account-based auth** — deferred to Epic 8

### Testing Patterns (from 4A.2 and 4A.3)

- Use real Fastify instance + real WebSocket connections (not mocked)
- `vi.useFakeTimers()` for grace period expiry tests
- WebSocket client via `ws` library in tests
- Pattern: create app → start listening → connect ws client → send JOIN_ROOM → assert STATE_UPDATE response
- Clean up: close all ws clients and app after each test
- Helper functions already exist in `join-handler.test.ts` — extend them for reconnection scenarios
- For supersession tests: open two WebSocket clients with same token, assert first receives SESSION_SUPERSEDED

### Previous Story Intelligence (4A.3)

Key patterns established:
- **Protocol types already have `token` fields** — `JoinRoomMessage.token` and `StateUpdateMessage.token` are defined but unused
- **`PlayerSession` tracks `ws`** — update `ws` reference on reconnection
- **`connected: boolean` on PlayerInfo** — toggle on disconnect/reconnect
- **Disconnect handler exists** — extend it with grace period timer
- **Seat assignment fills gaps** — if grace period expires and seat is released, `assignNextSeat` already handles gap-filling
- **Host is first joiner** — host identity should be preserved across reconnection (same playerId)
- **Sessions map keyed by playerId** — when reconnecting, look up session by playerId (resolved from token)
- **17 tests exist** for join handler — new tests should follow same patterns

### Git Intelligence

Recent commits (4a-1 through 4a-3) show:
- Consistent file placement: handler in `websocket/`, types in `shared/types/`, room logic in `rooms/`
- Test co-location: `foo.ts` → `foo.test.ts` in same directory
- All 669 tests pass as of 4a-3 completion — run full suite after implementation

### Project Structure Notes

New files:
- `packages/server/src/rooms/session-manager.ts` — token generation, lookup, grace period management
- `packages/server/src/rooms/session-manager.test.ts` — unit tests

Modified files:
- `packages/server/src/rooms/room.ts` — add `tokenMap` and `playerTokens` to Room
- `packages/server/src/rooms/room-manager.ts` — add `findPlayerByToken` method, initialize new maps
- `packages/server/src/websocket/join-handler.ts` — token generation on join, reconnection branch, supersession logic, grace period on disconnect
- `packages/server/src/websocket/join-handler.test.ts` — reconnection and supersession integration tests
- `packages/shared/src/types/protocol.ts` — add `SystemEventMessage` type for SESSION_SUPERSEDED
- `packages/shared/src/index.ts` — export new type

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4A, Story 4A.4]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Decision 3: Session Identity, Decision 7: Reconnection Strategy]
- [Source: _bmad-output/project-context.md — Session Identity section, WebSocket Protocol section]
- [Source: packages/shared/src/types/protocol.ts — JoinRoomMessage.token, StateUpdateMessage.token, PROTOCOL_VERSION]
- [Source: packages/server/src/rooms/room.ts — Room, PlayerInfo, PlayerSession interfaces]
- [Source: packages/server/src/rooms/room-manager.ts — createRoom with hostToken pattern]
- [Source: packages/server/src/websocket/join-handler.ts — join flow, disconnect handler]
- [Source: packages/server/src/rooms/seat-assignment.ts — assignNextSeat with gap-filling]
- [Source: _bmad-output/implementation-artifacts/4a-3-room-join-via-websocket-seat-assignment.md — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 7 tasks and 35+ subtasks completed
- Session token generation via `crypto.randomUUID()` — same pattern as existing `roomId`/`hostToken`
- Token delivery: UUID token included in STATE_UPDATE only to the joining player, never in broadcasts
- Token-based reconnection: token → playerId lookup restores exact seat with full state
- Session supersession: old connection receives `SYSTEM_EVENT` with `SESSION_SUPERSEDED` and is closed (code 4001)
- Grace period: 30s (configurable via `setGracePeriodMs` for testing), disconnected seats reserved, released on expiry
- Grace period recovery: tokenless client matched by `displayName + roomCode` to exactly one disconnected seat
- Ambiguous displayName: multiple matches = no recovery, join as new player
- `PLAYER_RECONNECTED` added to ResolvedAction union for reconnection broadcasts
- `SystemEventMessage` type added to protocol for SESSION_SUPERSEDED
- Disconnect handler guards against stale WebSocket references (checks `session.ws !== ws`)
- 14 new integration tests + 7 unit tests, 692 total tests pass (571 shared + 21 client + 100 server), 0 regressions
- Lint: 1 pre-existing warning-level issue in test file (down from 17 errors pre-changes)
- All 6 acceptance criteria satisfied

### Code Review (AI) — 2026-03-29

**Reviewer:** Claude Opus 4.6 (adversarial code review)

**Findings:** 0 HIGH, 2 MEDIUM (1 fixed, 1 downgraded), 1 LOW

1. **[FIXED] Stale token leak in `createSessionToken`** — `createSessionToken` did not revoke old tokens when called twice for the same player, leaving dangling entries in `tokenMap`. Fixed by adding self-cleanup: the function now deletes the old token from `tokenMap` before generating a new one. Test updated to verify cleanup.

2. **[DOWNGRADED → LOW] Module-level mutable state for grace period** — `gracePeriodMs` as module-level `let` with getter/setter. Vitest isolates test files in separate workers, and tests within a file run sequentially with proper `afterEach` reset. Not a real issue.

3. **[LOW — DEFERRED] Grace period timer cleanup on room destruction** — Active grace timers not cancelled on room destruction. Correctly deferred to story 4A.8 (room cleanup lifecycle).

**Verdict:** All ACs implemented. All tasks genuinely complete. Code is clean, secure, and well-tested. 692 tests pass with 0 regressions.

### File List

- packages/server/src/rooms/session-manager.ts (new — token generation, resolution, revocation, grace period config)
- packages/server/src/rooms/session-manager.test.ts (new — 7 unit tests)
- packages/server/src/rooms/room.ts (modified — added tokenMap, playerTokens, graceTimers to Room interface)
- packages/server/src/rooms/room-manager.ts (modified — added findPlayerByToken method, initialize new maps in createRoom)
- packages/server/src/websocket/join-handler.ts (modified — token generation on join, reconnection branch, supersession, grace period disconnect handler)
- packages/server/src/websocket/join-handler.test.ts (modified — 14 new integration tests for token delivery, reconnection, supersession, grace period)
- packages/shared/src/types/protocol.ts (modified — added SystemEventMessage type)
- packages/shared/src/types/game-state.ts (modified — added PLAYER_RECONNECTED to ResolvedAction union)
- packages/shared/src/index.ts (modified — exported SystemEventMessage type)
