# Story 3B.5: Charleston Disconnect Handling

Status: done

## Story

As a **player**,
I want **the game to handle disconnections during Charleston gracefully by auto-passing on behalf of a disconnected player after a grace period**,
so that **one player's network issue doesn't freeze the entire Charleston for everyone (FR107)**.

## Acceptance Criteria

1. **AC1 — Auto-pass on grace expiry (passing phase):** Given a player disconnects during a Charleston passing phase (`charleston.status === "passing"`), when the 30-second grace period expires without reconnection, then the server selects 3 random non-Joker tiles from the disconnected player's rack and dispatches `CHARLESTON_PASS` on their behalf. If the player hasn't already submitted (`submittedPlayerIds` does not include them), the auto-pass runs; if they already submitted, no action is taken.

2. **AC2 — Joker exclusion in auto-pass:** Given auto-pass tile selection, when selecting tiles from the rack, then tiles with `category === "joker"` are excluded from selection. If the rack has fewer than 3 non-Joker tiles, fill the remainder from Joker tiles to still produce exactly 3 tiles total (Jokers are legal per FR36; this is a best-effort courtesy).

3. **AC3 — Partial selection discarded:** Given a player had tiles selected in the UI before disconnecting, when the grace period expires, then the server ignores any pre-existing partial state (i.e., `lockedTileIdsByPlayerId` only contains entries for fully-submitted players — partial UI state never reaches the server). The auto-pass selects fresh random non-Joker tiles from the full rack at grace expiry.

4. **AC4 — Reconnection within grace cancels auto-pass:** Given a player disconnects and reconnects within the grace period, when they rejoin via `handleTokenReconnection`, then the grace timer is cancelled and no auto-pass occurs. The player resumes the Charleston normally.

5. **AC5 — Auto-vote on grace expiry (vote-ready phase):** Given a player disconnects during `charleston.status === "vote-ready"` (second Charleston vote prompt), when the grace period expires, then if the player has not yet voted (`votesByPlayerId[playerId]` is undefined), the server dispatches `CHARLESTON_VOTE { accept: false }` on their behalf — declining the optional second Charleston is the safer default.

6. **AC6 — Auto-courtesy on grace expiry (courtesy-ready phase):** Given a player disconnects during `charleston.status === "courtesy-ready"`, when the grace period expires, then if the player has not yet submitted their courtesy (`courtesySubmissionsByPlayerId[playerId]` is undefined), the server dispatches `COURTESY_PASS { count: 0, tileIds: [] }` on their behalf — skipping the courtesy pass is the safe default.

7. **AC7 — No action if game not in Charleston:** Given a player disconnects while the game is in any other phase (`gamePhase !== "charleston"`), when the grace period expires, then no auto-action is taken on their behalf. The existing seat-release logic proceeds unchanged.

8. **AC8 — State broadcast after auto-action:** Given the auto-action is dispatched via `handleAction`, when the result is `accepted`, then `broadcastGameState` is called so remaining players receive the updated state. If the auto-action causes the direction to complete (all 4 players submitted), the existing `CHARLESTON_PHASE_COMPLETE` resolved action is included in the broadcast normally.

9. **AC9 — Auto-action before seat release:** Given the auto-pass logic runs at grace expiry, when the auto-action is dispatched, then it executes **before** the seat-release code removes the player from `room.players` and `room.sessions`. The engine needs the player in `activePlayerIds` to process the action.

## Tasks / Subtasks

- [x] Task 1: Add Charleston auto-pass helper to join-handler.ts (AC: 1, 2, 5, 6, 7, 9)
  - [x] 1.1 Add private helper `selectRandomNonJokerTiles(rack: Tile[], count: number): Tile[]` — filter `tile.category !== "joker"`, shuffle, slice. If fewer than `count` non-Jokers remain after slice, append Jokers to reach the requested count.
  - [x] 1.2 Add private helper `applyCharlestonAutoAction(room: Room, playerId: string, logger: FastifyBaseLogger): void` that:
    - Guards: `if (!room.gameState || room.gameState.gamePhase !== "charleston" || !room.gameState.charleston) return`
    - Gets `charleston = room.gameState.charleston` and `playerState = room.gameState.players[playerId]`
    - Guards: `if (!playerState || !charleston.activePlayerIds.includes(playerId)) return`
    - Routes by `charleston.status`:
      - `"passing"`: if `!charleston.submittedPlayerIds.includes(playerId)`, build `CHARLESTON_PASS` action with 3 random tiles via helper; call `handleAction`; if `result.accepted`, call `broadcastGameState(room, room.gameState, result.resolved)`; log at INFO
      - `"vote-ready"`: if `charleston.votesByPlayerId[playerId] === undefined`, dispatch `CHARLESTON_VOTE { accept: false }`; same broadcast pattern
      - `"courtesy-ready"`: if `charleston.courtesySubmissionsByPlayerId[playerId] === undefined`, dispatch `COURTESY_PASS { count: 0, tileIds: [] }`; same broadcast pattern
    - Log at WARN if `result.accepted === false` (should never happen — log + skip broadcast)

- [x] Task 2: Wire auto-action into grace period expiry callback (AC: 9)
  - [x] 2.1 In `registerDisconnectHandler`, inside the `setTimeout` callback (before the existing seat-release code at line ~176), call `applyCharlestonAutoAction(room, playerId, logger)`.
  - [x] 2.2 Ensure auto-action fires **before** `room.players.delete(playerId)` and `room.sessions.delete(playerId)` so the engine finds the player still in `gameState.players`.

- [x] Task 3: Write tests in join-handler.test.ts (AC: 1–9)
  - [x] 3.1 Use `vi.useFakeTimers()` (from `vite-plus/test`) and advance by `getGracePeriodMs()` to trigger the grace expiry callback.
  - [x] 3.2 Test: grace expiry during `status === "passing"` dispatches `CHARLESTON_PASS` with 3 non-Joker tiles and broadcasts state.
  - [x] 3.3 Test: grace expiry during `status === "passing"` when rack contains only Jokers — still produces 3 tiles (all Jokers).
  - [x] 3.4 Test: grace expiry during `status === "vote-ready"` dispatches `CHARLESTON_VOTE { accept: false }`.
  - [x] 3.5 Test: grace expiry during `status === "courtesy-ready"` dispatches `COURTESY_PASS { count: 0, tileIds: [] }`.
  - [x] 3.6 Test: player already submitted before disconnecting — no duplicate action dispatched.
  - [x] 3.7 Test: player reconnects within grace period — no auto-pass (verify grace timer is cancelled, `handleAction` not called for auto-pass).
  - [x] 3.8 Test: grace expiry during `gamePhase !== "charleston"` (e.g., play phase) — no auto-action, seat released normally.

- [x] Task 4: Validation gate (AC: all)
  - [x] 4.1 `pnpm test`
  - [x] 4.2 `pnpm run typecheck`
  - [x] 4.3 `vp lint`

## Dev Notes

### Implementation Location

**All changes are server-side only.** This story requires no client changes, no shared type additions, and no new resolved action types. The existing `CHARLESTON_PHASE_COMPLETE`, `CHARLESTON_VOTE_RESOLVED`, and `COURTESY_PAIR_RESOLVED` resolved actions handle narration through the normal state update pipeline.

**Primary file:** `packages/server/src/websocket/join-handler.ts`
- Grace period callback: lines ~172–195 (`setTimeout` inside `registerDisconnectHandler`)
- Auto-action must be inserted **before** `room.players.delete(playerId)` (line ~180)

**Test file:** `packages/server/src/websocket/join-handler.test.ts`

### Current Grace Period Architecture

The existing grace period in `registerDisconnectHandler` (lines 172–195 of `join-handler.ts`):
```typescript
const timer = setTimeout(() => {
  room.graceTimers.delete(playerId);
  // ← INSERT AUTO-ACTION CALL HERE (before seat release)
  const token = room.playerTokens.get(playerId);
  if (token) { room.tokenMap.delete(token); room.playerTokens.delete(playerId); }
  room.players.delete(playerId);
  room.sessions.delete(playerId);
  // ... abandoned timer, broadcast
}, getGracePeriodMs());
```

`getGracePeriodMs()` returns `DEFAULT_GRACE_PERIOD_MS = 30_000` (from `session-manager.ts`).

Reconnection cancels the timer at line ~106–109 of the same file:
```typescript
const graceTimer = room.graceTimers.get(playerId);
if (graceTimer) { clearTimeout(graceTimer); room.graceTimers.delete(playerId); }
```

AC4 (reconnect cancels auto-pass) is already implemented — no changes needed there.

### Engine Call Pattern

Follow the existing pattern from `action-handler.ts`:
```typescript
import { handleAction } from "@mahjong-game/shared";
import { broadcastGameState } from "./state-broadcaster";

const result = handleAction(room.gameState, autoAction);
if (result.accepted) {
  broadcastGameState(room, room.gameState, result.resolved);
} else {
  logger.warn({ roomCode: room.roomCode, playerId, reason: result.reason }, "Charleston auto-action rejected unexpectedly");
}
```

### Key Types

```typescript
// GameState fields needed:
room.gameState.gamePhase        // "charleston" | "play" | etc.
room.gameState.charleston       // CharlestonState | null
room.gameState.players          // Record<string, PlayerState>
room.gameState.players[playerId].rack  // Tile[] — the player's current rack

// CharlestonState fields needed:
charleston.status               // "passing" | "vote-ready" | "courtesy-ready"
charleston.activePlayerIds      // string[] — players in Charleston (all 4)
charleston.submittedPlayerIds   // string[] — who has already submitted for this direction
charleston.votesByPlayerId      // Partial<Record<string, boolean>> — vote per player
charleston.courtesySubmissionsByPlayerId  // Partial<Record<string, CourtesySubmission>>

// Tile type — from "@mahjong-game/shared":
tile.category  // "suited" | "wind" | "dragon" | "flower" | "joker"
tile.id        // string — the tileId to pass
```

### Action Shapes to Dispatch

```typescript
// Passing phase auto-action:
{ type: "CHARLESTON_PASS", playerId, tileIds: string[] }  // exactly 3 tileIds

// Vote-ready auto-action:
{ type: "CHARLESTON_VOTE", playerId, accept: false }

// Courtesy-ready auto-action:
{ type: "COURTESY_PASS", playerId, count: 0, tileIds: [] }
```

Note: `playerId` must be injected by the server (same pattern as `parseGameAction` in `action-handler.ts` line 132–136: `{ type: "CHARLESTON_PASS", playerId, tileIds: tileIdsArr }`).

### Random Tile Selection

Simple shuffle — crypto randomness is not required for this purpose:
```typescript
function selectRandomNonJokerTiles(rack: Tile[], count: number): Tile[] {
  const nonJokers = rack.filter(t => t.category !== "joker");
  const jokers = rack.filter(t => t.category === "joker");
  const shuffled = [...nonJokers].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  // Backfill with Jokers if not enough non-Jokers (rare edge case)
  if (selected.length < count) {
    selected.push(...jokers.slice(0, count - selected.length));
  }
  return selected;
}
```

### Test Pattern for Fake Timers

Reference the existing reconnection tests in `join-handler.test.ts` for setup patterns. Use `vi.useFakeTimers()` / `vi.advanceTimersByTime(getGracePeriodMs())` to trigger the grace expiry. For Charleston state, create a minimal `GameState` with `gamePhase: "charleston"` and a `CharlestonState` with the relevant `status`.

Verify:
- `broadcastGameState` was called (spy on it or check sessions received a message)
- The dispatched action was correct (spy on `handleAction` or verify state mutation)
- Seat was released after auto-action (player removed from `room.players`)

Use `createPlayState()` from `packages/shared/src/testing/fixtures.ts` (seed 42) as the base game state, then set `gameState.gamePhase = "charleston"` and populate `gameState.charleston` for test scenarios.

### Existing Tests to Preserve

`join-handler.test.ts` already covers:
- ✅ Token-based reconnection restores to same seat (cancels grace timer)
- ✅ Filtered Charleston game view restored on reconnection
- ✅ `PLAYER_RECONNECTED` broadcast to other players
- ✅ Disconnection broadcasts during Charleston with filtered state

Do not break these tests. The new tests extend coverage for grace expiry behavior.

### Scope Boundaries

**This story implements:**
- Server-side Charleston auto-pass at grace period expiry (passing, vote, courtesy)
- Helper for selecting random non-Joker tiles from a rack
- Integration into existing grace period timer callback
- Tests for all auto-pass scenarios

**This story does NOT implement:**
- Client UI changes — existing "reconnecting" seat indicator (general multiplayer) is sufficient
- New resolved action types in `packages/shared` — not required for this story's ACs
- Host migration after disconnect (architecture backlog)
- Auto-discard on turn disconnect (different story — play phase)
- Call window disconnect fallbacks (different story)

### Previous Story Context (3B.4)

- **3B.4 was client-only** (Charleston UI components). No server changes were made.
- The `PlayerCharlestonView` type (server → client projection of `CharlestonState`) and `buildPlayerView` in `state-broadcaster.ts` are already complete and correct.
- After auto-pass + seat release, `buildPlayerView` will produce a state without the disconnected player in `room.players` — this is fine. The Charleston engine in `@mahjong-game/shared` maintains its own `activePlayerIds` independently of the server room's player map.

### References

- Grace period timer: `packages/server/src/websocket/join-handler.ts` lines 152–209
- Action dispatch pattern: `packages/server/src/websocket/action-handler.ts` lines 197–272
- State broadcast: `packages/server/src/websocket/state-broadcaster.ts` — `broadcastGameState`
- CharlestonState type: `packages/shared/src/types/game-state.ts` lines 131–143
- PlayerState.rack: `packages/shared/src/types/game-state.ts` lines 30–37
- Tile.category: `packages/shared/src/types/tiles.ts` line 5, 57
- Architecture Decision 7 (Reconnection): `_bmad-output/planning-artifacts/game-architecture.md`
- GDD FR107: `_bmad-output/planning-artifacts/gdd.md`
- Session manager: `packages/server/src/rooms/session-manager.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Tasks 1 & 2: Added `selectRandomNonJokerTiles` and `applyCharlestonAutoAction` helpers to join-handler.ts. Wired auto-action call into grace period setTimeout before seat release. Used canonical action types (CharlestonPassAction | CharlestonVoteAction | CourtesyPassAction) from @mahjong-game/shared. 208 server tests passing.
- Task 3: Added `describe("charleston disconnect auto-action", ...)` with 7 integration tests covering all AC scenarios. Used real-timer pattern (setGracePeriodMs(200) + delay) consistent with existing test file. Direct gameState mutation used to reach vote-ready/courtesy-ready states. 215/215 tests passing.
- Code review: Reverted spurious auto-format change in state-broadcaster.test.ts (cosmetic, not story-related). Added explicit seat-release assertion to test 3.2 to verify AC9 ordering (player removed from room.players after auto-action broadcast). 215/215 tests still passing.

### File List

- packages/server/src/websocket/join-handler.ts
- packages/server/src/websocket/join-handler.test.ts

## Change Log

- 2026-04-03: Implemented Charleston disconnect auto-pass (Story 3B.5). Added `selectRandomNonJokerTiles` and `applyCharlestonAutoAction` helpers to `join-handler.ts`. Wired auto-action into grace period timer callback before seat release. Added 7 integration tests covering all AC scenarios (passing/vote-ready/courtesy-ready auto-actions, already-submitted guard, reconnect cancellation, non-Charleston phase no-op). All 1165 tests passing, typecheck clean, lint clean.
