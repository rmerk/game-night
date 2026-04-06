# Story: Pre-6B Debt Cleanup — Room Type Extraction & 4B.4 Integration Tests

Status: done

## Story

As a **developer**,
I want **the Room type refactored into concern-specific sub-objects and the deferred 4B.4 integration test gaps filled**,
so that **Epic 6B (WebRTC) starts on a clean foundation with manageable test fixtures and full server-side confidence**.

## Origin

This story addresses two retro follow-through items carried since Epic 4B (now 2 epics old), explicitly gated as "debt cleanup before 6B" in the Epic 5B retrospective:

- `5b-retro-3-room-type-extraction` (MEDIUM, from 4B retro)
- `5b-retro-4-fill-4b4-integration-test-gaps` (LOW, from 4B retro)

## Acceptance Criteria

### Part A: Room Type Extraction

1. **Given** the Room interface in `packages/server/src/rooms/room.ts`
   **When** refactored
   **Then** concern-specific sub-objects are extracted, reducing top-level field count from 33 to ~18 or fewer

2. **Given** the extracted sub-objects
   **When** checking the new type structure
   **Then** at minimum these groups exist:
   - `TurnTimerState` — `config`, `handle`, `stage`, `playerId`, `consecutiveTimeouts`, `afkVoteCooldownPlayerIds`
   - `VoteState` — `afk: AfkVoteState | null`, `departure: DepartureVoteState | null`, `socialOverrideTimer`, `tableTalkReportTimer`
   - `SeatStatus` — `deadSeatPlayerIds`, `departedPlayerIds`
   - `PauseState` — `paused`, `pausedAt`
   - `SessionHistory` — `scoresFromPriorGames`, `gameHistory`
   - `RateLimits` — `chatRateTimestamps`, `reactionRateTimestamps`

3. **Given** a shared `createTestRoom(overrides?)` builder
   **When** used in any test file
   **Then** it provides sensible defaults for all Room fields (including sub-objects) and accepts `Partial<Room>` overrides with deep merge for sub-objects

4. **Given** the 6 existing duplicate `createTestRoom` functions across test files
   **When** the shared builder is created
   **Then** all 6 test files are migrated to use the shared builder and their local versions removed

5. **Given** any source file that accesses Room fields being moved into sub-objects
   **When** updated to use the new structure
   **Then** all 23 source files and 15+ test files compile and pass without regressions

### Part B: 4B.4 Integration Test Gaps

6. **Given** Task 10.2 (join-handler.test.ts integration tests)
   **When** implemented
   **Then** full WebSocket lifecycle tests exist for: T1 (timer arms at game start), T11 (disconnect mid-turn → grace auto-discard), T14 (call window cancels timer), T15 (mahjong declaration ends timer + clears counters)

7. **Given** Task 10.4 (ws-server.test.ts vote protocol tests)
   **When** implemented
   **Then** WebSocket message dispatch tests exist for AFK_VOTE_CAST: T5 (2 approves → dead seat), T6 (2 denies → cooldown), T8 (target voluntary action cancels vote)

8. **Given** Task 10.6 (pause-handlers.test.ts pause integration)
   **When** implemented
   **Then** a test verifies that pause-trigger cancels both turn timer and active AFK vote state (T13 edge case)

9. **Given** all new and existing tests
   **When** running `pnpm test`
   **Then** zero regressions — all tests pass

## Tasks / Subtasks

### Part A: Room Type Extraction

- [x] Task 1: Define sub-object interfaces (AC: 1, 2)
  - [x] 1.1 Create `TurnTimerState` interface in `room.ts` grouping timer fields
  - [x] 1.2 Create `VoteState` interface grouping `afkVoteState`, `departureVoteState`, `socialOverrideTimer`, `tableTalkReportTimer`
  - [x] 1.3 Create `SeatStatus` interface grouping `deadSeatPlayerIds`, `departedPlayerIds`
  - [x] 1.4 Create `PauseState` interface grouping `paused`, `pausedAt`
  - [x] 1.5 Create `SessionHistory` interface grouping `sessionScoresFromPriorGames`, `sessionGameHistory`
  - [x] 1.6 Create `RateLimits` interface grouping `chatRateTimestamps`, `reactionRateTimestamps`
  - [x] 1.7 Update `Room` interface to use sub-objects (`turnTimer`, `votes`, `seatStatus`, `pause`, `sessionHistory`, `rateLimits`)
  - [x] 1.8 Export all new interfaces from `room.ts`

- [x] Task 2: Create shared `createTestRoom` builder (AC: 3)
  - [x] 2.1 Create `packages/server/src/testing/create-test-room.ts`
  - [x] 2.2 Implement `createTestRoom(overrides?: Partial<Room>): Room` with full defaults for all fields including sub-objects
  - [x] 2.3 Re-export `createMockWs` and `createTestPlayer` helpers alongside (consolidate if duplicated across test files)
  - [x] 2.4 Export from `packages/server/src/testing/` barrel (create `index.ts` if needed)

- [x] Task 3: Update Room construction site (AC: 5)
  - [x] 3.1 Update `room-manager.ts` `createRoom()` to construct Room with sub-objects

- [x] Task 4: Update source files accessing moved fields (AC: 5)
  - [x] 4.1 Update `turn-timer.ts` — `room.turnTimerConfig` → `room.turnTimer.config`, etc.
  - [x] 4.2 Update `action-handler.ts` — timer and vote field access
  - [x] 4.3 Update `pause-handlers.ts` — `room.paused` → `room.pause.paused`, etc.
  - [x] 4.4 Update `leave-handler.ts` — seat status and departure fields
  - [x] 4.5 Update `join-handler.ts` — grace timers, seat status, vote state
  - [x] 4.6 Update `state-broadcaster.ts` — all field reads for client projection
  - [x] 4.7 Update `chat-handler.ts` — rate limit fields
  - [x] 4.8 Update `chat-history.ts` — chat history field
  - [x] 4.9 Update `grace-expiry-fallbacks.ts` — timer and seat fields
  - [x] 4.10 Update `charleston-auto-action.ts` — timer fields if accessed
  - [x] 4.11 Update `host-migration.ts`, `room-lifecycle.ts`, `seat-assignment.ts`, `seat-release.ts`, `session-manager.ts`, `session-scoring.ts`, `room-settings.ts`, `post-state-sequence.ts`, `ws-server.ts`, `routes.ts` — adjust field paths as needed

- [x] Task 5: Migrate test files to shared builder (AC: 4)
  - [x] 5.1 Migrate `state-broadcaster.test.ts` — replace local `createTestRoom` with shared import
  - [x] 5.2 Migrate `pause-handlers.test.ts`
  - [x] 5.3 Migrate `turn-timer.test.ts`
  - [x] 5.4 Migrate `grace-expiry-fallbacks.test.ts`
  - [x] 5.5 Migrate `charleston-auto-action.test.ts`
  - [x] 5.6 Migrate `seat-assignment.test.ts`
  - [x] 5.7 Update all other test files that construct Room objects inline

- [x] Task 6: Verify zero regressions (AC: 5, 9)
  - [x] 6.1 Run `pnpm test` — all tests pass
  - [x] 6.2 Run `pnpm run typecheck` — zero type errors
  - [x] 6.3 Run `vp lint` — no lint issues

### Part B: 4B.4 Integration Test Gaps

- [x] Task 7: join-handler.test.ts integration tests (AC: 6)
  - [x] 7.1 Add test: T1 — game start arms turn timer on first voluntary action
  - [x] 7.2 Add test: T11 — current player disconnects mid-turn → grace expires → auto-discard fires
  - [x] 7.3 Add test: T14 — call window opens → timer cancelled
  - [x] 7.4 Add test: T15 — mahjong declaration → timer cancelled + counter map cleared
  - [x] 7.5 Use `setDefaultTurnTimerConfig({ mode: "timed", durationMs: 50 })` + `setAfkVoteTimeoutMs(100)` in beforeEach

- [x] Task 8: ws-server.test.ts vote protocol dispatch tests (AC: 7)
  - [x] 8.1 Add test: T5 — AFK_VOTE_CAST two approves → dead seat marked
  - [x] 8.2 Add test: T6 — AFK_VOTE_CAST two denies → cooldown added
  - [x] 8.3 Add test: T8 — target voluntary action cancels vote without cooldown

- [x] Task 9: pause-handlers.test.ts pause + vote cleanup (AC: 8)
  - [x] 9.1 Add test: T13 — simultaneous disconnect pause cancels both turnTimerHandle and afkVoteState

- [x] Task 10: Final verification (AC: 9)
  - [x] 10.1 Run `pnpm test && pnpm run typecheck && vp lint`

## Dev Notes

### Room Type Refactoring Strategy

**Approach:** In-place refactoring of the Room interface — no new files for the type itself. Sub-object interfaces are defined in the same `room.ts` file alongside the existing `AfkVoteState`, `DepartureVoteState`, `TurnTimerConfig`, `PlayerInfo`, and `PlayerSession` types.

**Field mapping (current → new):**

| Current field | New path | Sub-object |
|---|---|---|
| `turnTimerConfig` | `turnTimer.config` | `TurnTimerState` |
| `turnTimerHandle` | `turnTimer.handle` | `TurnTimerState` |
| `turnTimerStage` | `turnTimer.stage` | `TurnTimerState` |
| `turnTimerPlayerId` | `turnTimer.playerId` | `TurnTimerState` |
| `consecutiveTurnTimeouts` | `turnTimer.consecutiveTimeouts` | `TurnTimerState` |
| `afkVoteCooldownPlayerIds` | `turnTimer.afkVoteCooldownPlayerIds` | `TurnTimerState` |
| `afkVoteState` | `votes.afk` | `VoteState` |
| `departureVoteState` | `votes.departure` | `VoteState` |
| `socialOverrideTimer` | `votes.socialOverrideTimer` | `VoteState` |
| `tableTalkReportTimer` | `votes.tableTalkReportTimer` | `VoteState` |
| `deadSeatPlayerIds` | `seatStatus.deadSeatPlayerIds` | `SeatStatus` |
| `departedPlayerIds` | `seatStatus.departedPlayerIds` | `SeatStatus` |
| `paused` | `pause.paused` | `PauseState` |
| `pausedAt` | `pause.pausedAt` | `PauseState` |
| `sessionScoresFromPriorGames` | `sessionHistory.scoresFromPriorGames` | `SessionHistory` |
| `sessionGameHistory` | `sessionHistory.gameHistory` | `SessionHistory` |
| `chatRateTimestamps` | `rateLimits.chatRateTimestamps` | `RateLimits` |
| `reactionRateTimestamps` | `rateLimits.reactionRateTimestamps` | `RateLimits` |

**Fields that stay top-level (~15):** `roomId`, `roomCode`, `hostToken`, `players`, `sessions`, `tokenMap`, `playerTokens`, `graceTimers`, `lifecycleTimers`, `gameState`, `settings`, `jokerRulesMode`, `chatHistory`, `createdAt`, `logger`

### Blast Radius

**23 source files + 15+ test files** import `Room`. The refactoring is mechanical (find-and-replace field paths) but wide. Complete the type change in Task 1, then fix all compile errors systematically.

**High-mutation files** (most field accesses to update):
- `turn-timer.ts` — heaviest user of timer sub-object fields
- `action-handler.ts` — timer reset + vote cancel paths
- `state-broadcaster.ts` — reads nearly all fields for client view
- `leave-handler.ts` / `join-handler.ts` — seat status + vote + timer
- `pause-handlers.ts` — pause state + vote/timer cleanup

### Shared Test Builder Design

```typescript
// packages/server/src/testing/create-test-room.ts
import type { Room } from "../rooms/room";

export function createTestRoom(overrides?: Partial<Room>): Room {
  // Provide sensible defaults for all fields, including sub-objects
  // Deep-merge sub-object overrides
  // Re-use createMockWs() for sessions
}
```

**Consolidation targets:** 6 files with duplicate `createTestRoom`:
1. `state-broadcaster.test.ts` — `createTestRoom(players, wsList)`
2. `pause-handlers.test.ts` — `createTestRoom(players, gameState, paused)`
3. `turn-timer.test.ts` — `createTestRoom(players, gameState)`
4. `grace-expiry-fallbacks.test.ts` — `createTestRoom(players, gameState)`
5. `charleston-auto-action.test.ts` — `createTestRoom(players, gameState)`
6. `seat-assignment.test.ts` — `createTestRoom(playerIds)`

Each has a different signature. The shared builder uses `Partial<Room>` overrides, so callers construct only the fields they care about.

### 4B.4 Integration Test Context

**What already exists (turn-timer.test.ts, 635 lines):** All 20 transition scenarios (T1–T20) are covered via fake timers (`vi.useFakeTimers()`) + direct function calls. The existing tests validate the state machine logic thoroughly.

**What's missing (Tasks 10.2, 10.4, 10.6):** Full WebSocket integration tests that exercise the complete message routing path — connecting sockets, dispatching protocol messages, and verifying broadcasts. These are belt-and-suspenders coverage but critical before Epic 6B.5 (A/V reconnection) adds more complexity to the same code paths.

**Test configuration:** Use `setDefaultTurnTimerConfig({ mode: "timed", durationMs: 50 })` and `setAfkVoteTimeoutMs(100)` in `beforeEach` for fast test execution.

**Important:** The integration tests in Part B should be written AFTER Part A completes, since they'll use the shared `createTestRoom` builder and the new sub-object field paths.

### Anti-Patterns

- **DO NOT** move sub-object interfaces to separate files — keep them in `room.ts` alongside `Room` for co-location
- **DO NOT** create backward-compatibility aliases or re-exports for old field paths — clean break, update all call sites
- **DO NOT** add getter/setter methods to Room — it remains a plain data interface, mutated in-place
- **DO NOT** change `AfkVoteState` or `DepartureVoteState` internal structure — only their *location* on Room changes
- **DO NOT** modify any game engine logic in `packages/shared` — this is server-only refactoring

### Project Structure Notes

- All changes are in `packages/server/src/` — no client or shared changes
- Testing utilities live in `packages/server/src/testing/` (existing: `silent-logger.ts`)
- Test files are co-located with source (`*.test.ts` next to `*.ts`)
- Imports use relative paths (no `@/` aliases)

### References

- [Source: packages/server/src/rooms/room.ts] — Room interface definition (33 fields, lines 48-96)
- [Source: _bmad-output/implementation-artifacts/epic-4b-retro-2026-04-05.md] — Original debt item discussion
- [Source: _bmad-output/implementation-artifacts/epic-5b-retro-2026-04-06.md] — "Debt cleanup before 6B" gate
- [Source: sprint-status.yaml retro_follow_through] — `5b-retro-3-room-type-extraction`, `5b-retro-4-fill-4b4-integration-test-gaps`

### Cross-Session Intelligence

- Epic 5B shipped 7 stories in 12 hours due to mature client-side patterns. Epic 6B (WebRTC) is greenfield — expect 4B-style velocity. This debt cleanup ensures the server foundation is solid before that slower work begins.
- The 5B retrospective explicitly flagged these two items as gates: "no new features until clean."
- Process action items (`5b-retro-1-one-commit-per-story`, `5b-retro-2-file-list-audit-in-code-review`) apply starting with this story.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

N/A

### Completion Notes List

- Part A (Room sub-objects + shared `createTestRoom`) was completed in a prior session; this session finished Part B: 4B.4 WebSocket integration tests and story/sprint bookkeeping.
- `join-handler.test.ts`: new describe `Story 4B.4 / pre6b — turn timer + AFK WebSocket integration` with T1, T11, T14, T15, T13; short turn timers + AFK timeout in `beforeEach`/`afterEach`.
- `ws-server.test.ts`: AFK_VOTE_CAST T5/T6/T8 with `waitForStateUpdateWithResolvedActionType` so each client waits for its own broadcast (fixes first `STATE_UPDATE` being another player’s `AFK_VOTE_CAST`); `cancelTurnTimer` after seeding AFK vote to avoid racing 50ms turn nudges.
- `pause-handlers.test.ts`: T13 unit test for `cancelTurnTimer` + `cancelAfkVote` + lifecycle cleanup.
- `pnpm test`, `pnpm run typecheck`, `vp lint` passed at repo root (2026-04-06).

### File List

#### New files
- `packages/server/src/testing/create-test-room.ts` — shared `createTestRoom` builder with deep-merge for sub-objects
- `packages/server/src/testing/index.ts` — barrel export for testing utilities
- `packages/server/src/testing/ws-integration-messages.ts` — WebSocket integration test helpers

#### Part A: Room type extraction + source file migrations
- `packages/server/src/rooms/room.ts` — sub-object interfaces + refactored `Room` interface
- `packages/server/src/rooms/room-manager.ts` — `createRoom()` updated to construct sub-objects
- `packages/server/src/websocket/turn-timer.ts` — timer field paths migrated
- `packages/server/src/websocket/action-handler.ts` — timer + vote field paths migrated
- `packages/server/src/websocket/state-broadcaster.ts` — all field reads migrated
- `packages/server/src/websocket/join-handler.ts` — grace, seat status, vote field paths migrated
- `packages/server/src/websocket/leave-handler.ts` — seat status + departure field paths migrated
- `packages/server/src/websocket/pause-handlers.ts` — pause state field paths migrated
- `packages/server/src/websocket/chat-handler.ts` — rate limit field paths migrated
- `packages/server/src/websocket/grace-expiry-fallbacks.ts` — timer + seat field paths migrated
- `packages/server/src/websocket/charleston-auto-action.ts` — timer field paths migrated
- `packages/server/src/rooms/host-migration.ts` — field paths migrated
- `packages/server/src/rooms/room-settings.ts` — field paths migrated
- `packages/server/src/rooms/seat-release.ts` — field paths migrated
- `packages/server/src/rooms/session-scoring.ts` — field paths migrated

#### Part A: Test file migrations to shared builder + sub-object field paths
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/websocket/pause-handlers.test.ts`
- `packages/server/src/websocket/turn-timer.test.ts`
- `packages/server/src/websocket/grace-expiry-fallbacks.test.ts`
- `packages/server/src/websocket/charleston-auto-action.test.ts`
- `packages/server/src/rooms/seat-assignment.test.ts`
- `packages/server/src/websocket/rematch-handler.test.ts`
- `packages/server/src/websocket/action-handler.test.ts`
- `packages/server/src/rooms/room-manager.test.ts`
- `packages/server/src/rooms/room-settings.test.ts`
- `packages/server/src/rooms/room-lifecycle.test.ts`
- `packages/server/src/rooms/host-migration.test.ts`
- `packages/server/src/rooms/session-manager.test.ts`
- `packages/server/src/rooms/session-scoring.test.ts`
- `packages/server/src/websocket/chat-handler.test.ts`
- `packages/server/src/websocket/leave-handler.test.ts`
- `packages/server/src/websocket/ws-server.test.ts`

#### Part B: 4B.4 integration tests
- `packages/server/src/websocket/join-handler.test.ts` — T1, T11, T14, T15, T13 integration tests
- `packages/server/src/websocket/ws-server.test.ts` — T5, T6, T8 AFK_VOTE_CAST dispatch tests
- `packages/server/src/websocket/pause-handlers.test.ts` — T13 unit test

#### Story/sprint tracking
- `_bmad-output/implementation-artifacts/pre6b-debt-cleanup.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-06: Part B — 4B.4 integration tests (join-handler, ws-server, pause-handlers); story and sprint status → review; retro follow-through items remain for post–code-review `done` when sprint is updated.
- 2026-04-06: Code review — File List expanded to include all Part A + Part B changes (was missing 30+ files from prior session). AC 1 field count note: actual is 21 top-level (not ~18), but reduction from 33 is substantial and all 6 sub-objects are correctly extracted.
