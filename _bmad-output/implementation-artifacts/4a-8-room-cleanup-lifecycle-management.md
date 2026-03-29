# Story 4A.8: Room Cleanup & Lifecycle Management

Status: done

## Story

As a **developer**,
I want **rooms to be automatically cleaned up when abandoned, idle, or when all players disconnect**,
so that **server memory is reclaimed and stale rooms don't accumulate (AR32)**.

## Acceptance Criteria

### AC1: Full Player Disconnect Cleanup
```gherkin
Given all players in a room disconnect
When no player reconnects within 2 minutes
Then the room is cleaned up — removed from active rooms map,
     all associated tokens invalidated, memory freed
```

### AC2: Game End / Idle Cleanup
```gherkin
Given a game ends (scoreboard phase)
When no player dispatches REMATCH within 5-10 minutes
Then the room is cleaned up as idle
```

### AC3: Abandoned Room Cleanup
```gherkin
Given a host creates a room but no one joins
When 30 minutes pass with only the host (or zero players)
Then the room is cleaned up as abandoned
```

### AC4: Room Cleanup Effects
```gherkin
Given a room is cleaned up
When checking server state
Then the room code is released for reuse,
     all WebSocket connections for that room are closed,
     and room-level child loggers are disposed
```

### AC5: Token Invalidation on Cleanup
```gherkin
Given room cleanup occurs
When a player tries to reconnect with a token from the cleaned-up room
Then the connection is rejected with { error: 'ROOM_NOT_FOUND' }
     — the token is no longer valid
```

### AC6: Room Isolation
```gherkin
Given multiple rooms are active simultaneously
When one room is cleaned up
Then other rooms are completely unaffected — room isolation is maintained
```

## Tasks / Subtasks

- [x] Task 1: Room lifecycle timer infrastructure (AC: 1,2,3)
  - [x] 1.1 Create `room-lifecycle.ts` in `packages/server/src/rooms/` with timer management
  - [x] 1.2 Define cleanup trigger types: `disconnect-timeout`, `idle-timeout`, `abandoned-timeout`
  - [x] 1.3 Implement timer start/cancel/reset functions per room per trigger type
  - [x] 1.4 Store timers on Room interface (extend existing `graceTimers` pattern)
- [x] Task 2: Room cleanup execution (AC: 4,5)
  - [x] 2.1 Implement `cleanupRoom(roomCode, reason, logger)` in `room-manager.ts`
  - [x] 2.2 Cleanup sequence: log reason → broadcast SYSTEM_EVENT → close all WebSocket connections → revoke all tokens → remove from rooms map → release room code
  - [x] 2.3 Ensure cleanup is idempotent (safe to call multiple times)
- [x] Task 3: Disconnect timeout trigger (AC: 1)
  - [x] 3.1 Hook into existing disconnect handler in `join-handler.ts`
  - [x] 3.2 When a player disconnects, check if ALL players are now disconnected
  - [x] 3.3 If all disconnected, start 2-minute room cleanup timer
  - [x] 3.4 If any player reconnects, cancel the room cleanup timer
- [x] Task 4: Idle timeout trigger (AC: 2)
  - [x] 4.1 Detect transition to scoreboard phase in action handler
  - [x] 4.2 Start 5-minute idle timer when scoreboard phase begins
  - [x] 4.3 Cancel idle timer if REMATCH action dispatched
- [x] Task 5: Abandoned room trigger (AC: 3)
  - [x] 5.1 Start 30-minute abandoned timer on room creation
  - [x] 5.2 Cancel/reset abandoned timer when second player joins
  - [x] 5.3 Re-enable abandoned timer if player count drops to 0-1 (edge case: everyone leaves lobby)
- [x] Task 6: Room isolation & token rejection (AC: 5,6)
  - [x] 6.1 Ensure `findPlayerByToken()` returns null for cleaned-up rooms
  - [x] 6.2 Join handler returns `ROOM_NOT_FOUND` error for cleaned-up room tokens
  - [x] 6.3 Verify cleanup of one room doesn't affect other rooms' maps/timers
- [x] Task 7: Tests (AC: 1-6)
  - [x] 7.1 Unit tests for room-lifecycle timer management
  - [x] 7.2 Integration tests for each cleanup trigger with real timers (use vi.useFakeTimers)
  - [x] 7.3 Token rejection test after cleanup
  - [x] 7.4 Room isolation test (cleanup room A, verify room B unaffected)
  - [x] 7.5 Idempotent cleanup test (double-cleanup no crash)
  - [x] 7.6 Timer cancellation tests (reconnect cancels disconnect timer, REMATCH cancels idle timer)

## Dev Notes

### Cleanup Architecture

Three independent cleanup timers per room, each managed by a central lifecycle module:

| Trigger | Timeout | Starts When | Cancels When |
|---------|---------|-------------|-------------|
| `disconnect-timeout` | 2 min | All players disconnected | Any player reconnects |
| `idle-timeout` | 5 min | Game reaches scoreboard phase | REMATCH action dispatched |
| `abandoned-timeout` | 30 min | Room created | 2+ players in room |

**Cleanup execution order is critical** — must broadcast before closing connections, must log before disposing loggers:
1. Cancel all room timers (grace timers, lifecycle timers)
2. Broadcast `SYSTEM_EVENT { type: 'ROOM_CLOSING', reason }` to connected clients
3. Close all WebSocket connections (with `1000` normal close code)
4. Revoke all session tokens (call `revokeToken()` from `session-manager.ts` for each player)
5. Remove room from `RoomManager.rooms` map
6. Log cleanup completion (before logger disposal)

### Existing Patterns to Extend (DO NOT Reinvent)

- **Grace period timers** in `join-handler.ts` already use `setTimeout` stored on `room.graceTimers` — follow the same Map-based pattern for lifecycle timers
- **Token revocation** via `session-manager.ts` `revokeToken(room, playerId)` — call for each player during cleanup
- **Room lookup** via `RoomManager.getRoom(code)` is case-insensitive — cleanup must use the canonical code from the Room object
- **State broadcasting** via `state-broadcaster.ts` `broadcastGameState()` — use similar pattern for SYSTEM_EVENT broadcast, but send raw message (not game state)
- **Disconnect detection** in `join-handler.ts` already tracks connected status on `PlayerInfo` — reuse this to check "all disconnected"

### Key Files to Modify

| File | Change |
|------|--------|
| `packages/server/src/rooms/room-lifecycle.ts` | **NEW** — Timer management for all 3 cleanup triggers |
| `packages/server/src/rooms/room-manager.ts` | Add `cleanupRoom()` method, integrate lifecycle on room creation |
| `packages/server/src/rooms/room.ts` | Extend Room interface with `lifecycleTimers` field |
| `packages/server/src/websocket/join-handler.ts` | Hook disconnect/reconnect events into lifecycle timers |
| `packages/server/src/websocket/action-handler.ts` | Hook scoreboard transition and REMATCH into lifecycle timers |
| `packages/shared/src/types/protocol.ts` | Add `ROOM_CLOSING` to SystemEvent types (if not already present) |
| `packages/server/src/rooms/room-lifecycle.test.ts` | **NEW** — Unit tests for timer management |
| `packages/server/src/rooms/room-manager.test.ts` | Add cleanup integration tests |

### Room Interface Extension

Add to the existing `Room` interface in `room.ts`:
```typescript
// Add alongside existing graceTimers
lifecycleTimers: Map<string, ReturnType<typeof setTimeout>>
// Keys: 'disconnect-timeout' | 'idle-timeout' | 'abandoned-timeout'
```

### Timer Configurability (for testing)

Follow the pattern from `session-manager.ts` which uses `setGracePeriodMs()` for test configurability:
```typescript
// room-lifecycle.ts
let DISCONNECT_TIMEOUT_MS = 2 * 60 * 1000   // 2 minutes
let IDLE_TIMEOUT_MS = 5 * 60 * 1000          // 5 minutes
let ABANDONED_TIMEOUT_MS = 30 * 60 * 1000    // 30 minutes

export function setDisconnectTimeoutMs(ms: number) { ... }  // For tests
export function setIdleTimeoutMs(ms: number) { ... }        // For tests
export function setAbandonedTimeoutMs(ms: number) { ... }   // For tests
```

### Edge Cases

1. **Race condition: cleanup during reconnection** — Check room still exists after async operations
2. **Double cleanup** — `cleanupRoom()` must be idempotent; if room already removed from map, no-op
3. **Timer overlap** — Multiple cleanup triggers may fire simultaneously; first one wins, others no-op via idempotency
4. **Abandoned timer reset edge** — If 2 players join then 1 leaves (back to 1 player), restart abandoned timer
5. **Grace period vs room cleanup** — The 30-second per-player grace period (from `session-manager.ts`) is independent of the 2-minute room cleanup timer. Both can run concurrently. Room cleanup supersedes individual grace periods.

### Testing Strategy

Use `vi.useFakeTimers()` for deterministic timer testing (established pattern in the codebase). Key test scenarios:

- **Happy path**: All players disconnect → 2 min passes → room cleaned up
- **Reconnection cancels**: All disconnect → 1 player reconnects within 2 min → timer cancelled, room survives
- **Idle cleanup**: Game ends → 5 min passes without REMATCH → room cleaned up
- **REMATCH cancels**: Game ends → REMATCH within 5 min → timer cancelled
- **Abandoned**: Room created → 30 min with only host → cleaned up
- **Join cancels abandoned**: Room created → second player joins → abandoned timer cancelled
- **Room isolation**: Clean up room A → verify room B's state, timers, tokens all intact
- **Token rejection**: Clean up room → attempt reconnect with old token → ROOM_NOT_FOUND
- **Idempotent cleanup**: Call cleanup twice → no crash, no double-broadcast

### SYSTEM_EVENT Message Format

Follow existing SYSTEM_EVENT pattern from `join-handler.ts`:
```typescript
{
  version: 1,
  type: 'SYSTEM_EVENT',
  event: {
    type: 'ROOM_CLOSING',
    reason: 'all_disconnected' | 'idle_timeout' | 'abandoned'
  }
}
```

### Project Structure Notes

- All new code goes in `packages/server/src/rooms/` (room-lifecycle.ts) — aligns with existing room management module
- No shared/ package changes needed for cleanup logic (server-only concern)
- Protocol type addition (`ROOM_CLOSING` event) goes in `packages/shared/src/types/protocol.ts` since both client and server import protocol types
- Tests co-located: `room-lifecycle.test.ts` next to `room-lifecycle.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4A, Story 4A.8]
- [Source: _bmad-output/planning-artifacts/architecture.md — AR32, Room Lifecycle, Cleanup Triggers]
- [Source: packages/server/src/rooms/room-manager.ts — existing room management]
- [Source: packages/server/src/rooms/session-manager.ts — token lifecycle, grace period pattern]
- [Source: packages/server/src/websocket/join-handler.ts — disconnect handler, grace timers]
- [Source: packages/server/src/websocket/action-handler.ts — action routing, START_GAME pattern]

### Previous Story Intelligence (4A.7)

- **Host authorization pattern**: Check `room.players.get(playerId)?.isHost === true` on server side — same pattern applies if any cleanup trigger needs host-only actions
- **Game phase derivation**: Phase comes from `room.gameState?.gamePhase ?? 'lobby'` — use this to detect scoreboard phase for idle timer
- **Validate-then-mutate**: All state changes follow validate → execute → broadcast; cleanup should follow same pattern (validate room exists → execute cleanup → broadcast/log)
- **No redundant state**: Don't add separate "room lifecycle phase" field — derive cleanup triggers from existing state (connected count, game phase, creation time)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Created room-lifecycle.ts with three configurable timer types (disconnect: 2min, idle: 5min, abandoned: 30min) following the existing graceTimers Map pattern
- Extended Room interface with `lifecycleTimers` field; updated all mock Room objects in existing tests
- Implemented idempotent `cleanupRoom()` on RoomManager with proper execution order: cancel timers → broadcast ROOM_CLOSING → close WebSocket connections → revoke tokens → remove from map → log
- Extended SystemEventMessage protocol type to support `ROOM_CLOSING` event with `RoomClosingReason` discriminator
- Hooked disconnect trigger into join-handler: checks allPlayersDisconnected → starts 2-min timer; reconnection (token or grace period) cancels it
- Hooked idle trigger into action-handler: detects scoreboard phase → starts 5-min timer; REMATCH cancels it
- Abandoned timer starts automatically on room creation; cancelled when 2+ players join; re-enabled when grace period expiry drops player count to ≤1
- All tests pass: 167 server tests (28 new), 0 regressions across all 3 packages (36 test files)

### Change Log

- 2026-03-29: Implemented room cleanup & lifecycle management (all 7 tasks complete)
- 2026-03-29: Code review fixes — prevented orphaned timers from stale WebSocket close handlers (clear sessions before closing); hardened close handler guard to bail on missing session; refactored SystemEventMessage to discriminated union for type safety

### File List

- packages/server/src/rooms/room-lifecycle.ts (NEW)
- packages/server/src/rooms/room-lifecycle.test.ts (NEW)
- packages/server/src/rooms/room.ts (MODIFIED — added lifecycleTimers to Room interface)
- packages/server/src/rooms/room-manager.ts (MODIFIED — added cleanupRoom method, abandoned timer on creation)
- packages/server/src/rooms/room-manager.test.ts (MODIFIED — added 15 cleanup and integration tests)
- packages/server/src/websocket/join-handler.ts (MODIFIED — disconnect/reconnect lifecycle timer hooks, abandoned timer management)
- packages/server/src/websocket/action-handler.ts (MODIFIED — idle timer on scoreboard, REMATCH cancellation)
- packages/server/src/websocket/ws-server.ts (MODIFIED — pass roomManager to handleActionMessage)
- packages/shared/src/types/protocol.ts (MODIFIED — added RoomClosingReason type, extended SystemEventMessage)
- packages/shared/src/index.ts (MODIFIED — exported RoomClosingReason)
- packages/server/src/websocket/state-broadcaster.test.ts (MODIFIED — added lifecycleTimers to mock Room)
- packages/server/src/rooms/session-manager.test.ts (MODIFIED — added lifecycleTimers to mock Room)
- packages/server/src/rooms/seat-assignment.test.ts (MODIFIED — added lifecycleTimers to mock Room)
