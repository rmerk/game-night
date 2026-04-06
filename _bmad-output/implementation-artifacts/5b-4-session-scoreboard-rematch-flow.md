# Story 5B.4: Session Scoreboard & Rematch Flow

Status: done

## Story

As a **player**,
I want **a cumulative session scoreboard that tracks scores across multiple games and a one-tap rematch to keep playing**,
So that **game night flows naturally from one game to the next with a running score (FR75, FR131, FR132)**.

## Acceptance Criteria

1. **AC1 — Per-game + session totals:** Given a game ends (Mahjong or wall game), when the scoreboard displays, it shows per-game scoring (hand value, payments), cumulative session totals for all players, and the current game’s result prominently.

2. **AC2 — Multi-game arc:** Given multiple games in one room session, when viewing the scoreboard, each completed game’s result is listed with running totals so players see the arc of the session.

3. **AC3 — Rematch button styling:** Given the rematch control, when shown on the scoreboard, it uses primary (gold) tier styling but stays “present, not pushy” — clear placement without dominating the social wind-down space (FR132).

4. **AC4 — Play again flow:** Given the host taps Play Again, when all four seats have eligible connected players, the dealer rotates counterclockwise, a new game begins (Charleston follows), with no room recreation or new links.

5. **AC5 — Lingering mood hook:** Given the scoreboard phase, when the table is shown, the root layout applies `mood-lingering` for Epic 7 / UX-DR49 styling (minimal placeholder: class + softer background token usage where feasible).

6. **AC6 — End session:** Given the host taps End Session, when the action succeeds, final session scores are shown in a summary view and the room returns to lobby state for the session snapshot.

## Tasks / Subtasks

- [x] Task 1: Server — session economics & dealer rotation (AC: #1, #2, #4)
  - [x] 1.1 Add `sessionScoresFromPriorGames`, `sessionGameHistory` on `Room`; merge current game scores into session when leaving scoreboard for a new game (REMATCH path) and on END_SESSION; push `SessionGameHistoryEntry` on merge
  - [x] 1.2 `handleStartGameAction`: when starting from scoreboard/rematch, compute rotated `playerIds` (East←previous South, …) before `createLobbyState`; keep sorted order for cold start from `gameState === null`
  - [x] 1.3 Extend `PlayerGameView` with `sessionScoresFromPriorGames` and `sessionGameHistory`; populate in `buildPlayerView`
  - [x] 1.4 Cancel idle-timeout lifecycle timer when REMATCH succeeds (debt from 4B.7 comment)
  - [x] 1.5 Server tests for dealer order on rematch and session merge (`session-scoring.test.ts`)

- [x] Task 2: Protocol — END_SESSION (AC: #6)
  - [x] 2.1 Add `ResolvedAction` variant `SESSION_ENDED` with `sessionTotals`, `sessionGameHistory` snapshot
  - [x] 2.2 `handleEndSession` (host-only, scoreboard/rematch), broadcast lobby + resolved action; reset session fields appropriately
  - [x] 2.3 `ws-server` + `useRoomConnection.sendEndSession`

- [x] Task 3: Client — Scoreboard & GameTable (AC: #1–#6)
  - [x] 3.1 `mapPlayerGameViewToGameTable` + `GameTable` props: session prior totals, history, host flag for actions
  - [x] 3.2 `Scoreboard.vue`: game history list, cumulative session line (prior + current `scores` while on scoreboard), Play Again (host) → `sendRematch`, End Session (host) → `sendEndSession`; primary button variant for Play Again
  - [x] 3.3 Apply `mood-lingering` to game table root in scoreboard/rematch; subtle warm background if token-aligned
  - [x] 3.4 `RoomView`: wire `@end-session` / `@rematch` + `SESSION_ENDED` summary overlay

- [x] Task 4: Tests & gates
  - [x] 4.1 Client tests updated; server tests for session + room mocks
  - [x] 4.2 `pnpm test`, `pnpm run typecheck`, `vp lint`

## Dev Notes

### References

- Epic: [epics.md](../planning-artifacts/epics.md) Story 5B.4
- 4B.7 deferred UI: rematch preconditions server-side already; client toast only for `REMATCH_WAITING_FOR_PLAYERS`
- `handleRematch` → `handleStartGameAction`; `createGame` maps `playerIds[0]` → East

### Key decisions

- **Session merge timing:** Merge current game `scores` into `sessionScoresFromPriorGames` when transitioning **off** scoreboard into a new deal (REMATCH success path), so the scoreboard always shows `sessionScoresFromPriorGames + scores` as cumulative without double-counting after merge.
- **Dealer rotation:** Next game `playerIds` = `[prevSouth, prevWest, prevNorth, prevEast]` from `GameState.players` seat winds.
- **Player public winds:** `buildPlayerView` / `buildSpectatorView` use engine `seatWind` per player so UI layout matches rotated dealer (Story 5B.4).

## Dev Agent Record

### Completion Notes

Session economics live on `Room` and merge into `PlayerGameView`. Host scoreboard actions: **Play again** (`REMATCH`) and **End session** (`END_SESSION`). `SESSION_ENDED` resolved action drives lobby summary overlay. Idle-timeout cancelled when rematch starts new game.

**Pass 2 (2026-04-06):** Full regression (`pnpm test`, `pnpm run typecheck`, `vp lint`) passed. DoD checklist walked against implementation; added WebSocket integration coverage for `END_SESSION` → `SESSION_ENDED` (session totals + history, lobby), `NOT_HOST`, successful rematch clearing a pre-armed `idle-timeout`, and removed obsolete “future” comment in `action-handler.ts` (idle cancel is implemented in `handleStartGameAction` / `handleEndSession`).

**Pass 3 (2026-04-06):** Vue / Vue testing follow-up: extended `Scoreboard.test.ts` (session history, host emits, primary/secondary button variants), `mapPlayerGameViewToGameTable.test.ts` (session field passthrough), `GameTable.test.ts` (`mood-lingering` on scoreboard/rematch, cumulative session totals). Full regression passed.

### File List

- `packages/shared/src/types/game-state.ts` — `SessionGameHistoryEntry`, `ResolvedAction` `SESSION_ENDED`
- `packages/shared/src/types/protocol.ts` — `PlayerGameView` session fields
- `packages/shared/src/index.ts` — export `SessionGameHistoryEntry`
- `packages/server/src/rooms/room.ts` — room session fields
- `packages/server/src/rooms/room-manager.ts` — init session fields
- `packages/server/src/rooms/session-scoring.ts` — merge + dealer rotation helpers
- `packages/server/src/rooms/session-scoring.test.ts` — unit tests
- `packages/server/src/websocket/action-handler.ts` — merge/rotate in `handleStartGameAction`, `handleEndSession`
- `packages/server/src/websocket/ws-server.ts` — `END_SESSION` route
- `packages/server/src/websocket/state-broadcaster.ts` — game winds + session fields in `buildPlayerView`
- `packages/client/src/composables/mapPlayerGameViewToGameTable.ts` — session + host props
- `packages/client/src/composables/useRoomConnection.ts` — `sendEndSession`
- `packages/client/src/components/game/GameTable.vue` — scoreboard mood, session props, rematch/end emits
- `packages/client/src/components/scoreboard/Scoreboard.vue` — history, buttons, copy
- `packages/client/src/components/scoreboard/SessionScores.vue` — cumulative session totals display
- `packages/client/src/components/scoreboard/format-signed-number.ts` — signed number formatting helper
- `packages/client/src/views/RoomView.vue` — overlay, event wiring
- `packages/client/src/components/dev/PlayerGameViewBridgeShowcase.vue` — fixture fields
- `packages/server/src/websocket/rematch-handler.test.ts` — 5B.4: `END_SESSION` / `SESSION_ENDED`, idle-timeout cleared on rematch
- `packages/server/src/websocket/action-handler.ts` — removed stale idle-timeout “future” comment (no behavior change)
- `packages/client/src/composables/gameActionFromPlayerView.test.ts` — updated `PlayerGameView` fixture with session fields
- Multiple `*.test.ts` — `Room` mocks + client `PlayerGameView` fixtures
- `packages/client/src/components/scoreboard/Scoreboard.test.ts` — Pass 3: history, emits, button variants
- `packages/client/src/composables/mapPlayerGameViewToGameTable.test.ts` — Pass 3: session fields mapping test
- `packages/client/src/components/game/GameTable.test.ts` — Pass 3: mood-lingering, cumulative scores

### Change Log

| Date | Change |
|------|--------|
| 2026-04-06 | Implemented 5B.4 session scoreboard, rematch UI, dealer rotation, END_SESSION, SESSION_ENDED overlay |
| 2026-04-06 | Pass 2: regression + DoD review; WS tests for END_SESSION/SESSION_ENDED, rematch clears idle-timeout; comment cleanup in action-handler |
| 2026-04-06 | Pass 3: client tests for scoreboard session history, GameTable mood + cumulative totals, mapper session passthrough |

## Senior Developer Review (AI)

**Reviewed:** 2026-04-06 | **Verdict:** APPROVED

All 6 ACs verified implemented. All 15 subtasks confirmed complete against code.

**Findings (0 High, 1 Medium fixed, 2 Low noted):**
- M1 (FIXED): `SessionScores.vue`, `format-signed-number.ts`, and `gameActionFromPlayerView.test.ts` added to File List — were missing from documentation.
- L1: Generic "Multiple *.test.ts" covers ~10 test files — imprecise but adequate.
- L2: `gameActionFromPlayerView.test.ts` not covered by generic bucket description.

**Quality notes:** Host-only gates on REMATCH/END_SESSION with proper error codes. Session merge timing avoids double-counting. Dealer rotation verified (South→East CCW). Tests use real assertions throughout — Scoreboard rendering, button variants, integration WS flow, idle-timeout cancellation.
