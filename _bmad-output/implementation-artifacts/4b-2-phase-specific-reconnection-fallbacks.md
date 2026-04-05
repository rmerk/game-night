# Story 4B.2: Phase-Specific Reconnection Fallbacks

Status: done

<!-- Epic 4B. Builds on 4B.1 grace timers. Charleston auto-pass existed in join-handler; this story completes play-phase auto-discard / auto-pass, scoreboard no-op, consolidates broadcast fan-out (retro 4b1-review-1/2), and fixes attachToExistingSeat build-before-mutate (retro 4b1-review-3). -->

## Story

As a **player**,
I want **the game to handle my disconnection gracefully regardless of what phase the game is in, with appropriate automatic actions after the grace period**,
so that **one player's network issue doesn't freeze the game for everyone (FR107)**.

## Acceptance Criteria

1. **AC1 — Play phase, their turn, discard step — auto-discard:** Given `room.gameState.gamePhase === "play"`, `currentTurn === playerId`, and `turnPhase === "discard"`, when the grace timer fires for `playerId`, then the server applies `DISCARD_TILE` for the **most recently drawn** tile: choose the **last non-joker tile in rack order** (last index downward). On success, broadcast via `broadcastGameState` with the action’s `resolved` payload. If no non-joker exists, log and skip discard (FR107).

2. **AC2 — Play phase, call window — auto-pass:** Given an open call window (`turnPhase === "callWindow"`) and the disconnected player is **not** the discarder and has **not** yet passed, when grace expires, apply `PASS_CALL` for `playerId`, then `broadcastGameState` on success.

3. **AC3 — Charleston (unchanged contract):** Given `gamePhase === "charleston"` and Charleston expects input from the disconnected player, the existing `applyCharlestonAutoAction` runs **before** seat release (same as today). Story adds tests where missing.

4. **AC4 — Scoreboard / rematch:** Given `gamePhase === "scoreboard"` or `"rematch"`, when grace expires, **no** engine auto-action runs; seat release proceeds as in 4B.1.

5. **AC5 — Not their turn (play):** Given `gamePhase === "play"` but `currentTurn !== playerId` and no call-window obligation for `playerId`, when grace expires, **no** discard/pass auto-action; seat release proceeds (game already continues for others).

6. **AC6 — Broadcast fan-out safety (retro `4b1-review-1`):** All room `STATE_UPDATE` fan-outs that iterate `room.sessions` use a shared try/catch (warn on failure, continue) so one bad socket does not skip remaining peers.

7. **AC7 — Consolidated broadcast helper (retro `4b1-review-2`):** `broadcastStateToRoom` (lobby + resolvedAction) and `broadcastGameState` share one internal fan-out implementation in [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts).

8. **AC8 — `attachToExistingSeat` build-before-mutate (retro `4b1-review-3`):** Supersede old socket and clear timers first; temporarily set `connected=true` to build state; if `buildCurrentStateMessage` returns null, revert `connected` and **do not** install the new session or send frames.

9. **AC9 — Regression gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass.

## Tasks / Subtasks

- [x] **Task 1:** Add [`grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts) with `applyGraceExpiryGameActions(room, playerId, logger)` calling play-phase logic before existing `applyCharlestonAutoAction` in the grace timer (AC: 1, 2, 4, 5).
- [x] **Task 2:** Wire grace timer in [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts): order = `applyGraceExpiryGameActions` → `applyCharlestonAutoAction` → seat release (AC: 3).
- [x] **Task 3:** Move `broadcastStateToRoom` to [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts), add safe send + shared fan-out with `broadcastGameState` (AC: 6, 7).
- [x] **Task 4:** Refactor `attachToExistingSeat` in `join-handler.ts` per AC8 (AC: 8).
- [x] **Task 5:** Tests — unit/integration for auto-discard, auto-pass, scoreboard skip, broadcast resilience; extend [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts) or new `grace-expiry-fallbacks.test.ts` (AC: 1–5, 9).
- [x] **Task 6:** Regression gate + story File List / Change Log (AC: 9).

### Review Follow-ups (AI)

- [ ] [AI-Review][Low] `grace-expiry-fallbacks.test.ts` hand-constructs a `Room` with ~16 fields in `createTestRoom`. This will silently drift if `Room` gains new fields. Prefer `roomManager.createRoom()` (as in `join-handler.test.ts`) to reduce maintenance surface. [`packages/server/src/websocket/grace-expiry-fallbacks.test.ts:37`]
- [ ] [AI-Review][Low] AC4 "rematch" + AC5 "not-their-turn" now have unit coverage, but the hot-path cases (auto-discard on discard step, auto-pass in call window) don't assert that `broadcastGameState` actually reaches the mock `ws.send`. Consider asserting `send` was called on each session's mock to lock in the fan-out contract. [`packages/server/src/websocket/grace-expiry-fallbacks.test.ts:92`]
- [ ] [AI-Review][Low] `grace-expiry-fallbacks.test.ts:6` imports test helpers via deep relative path `"../../../shared/src/testing/helpers"`. First server-side consumer of shared test helpers. Either add a `@mahjong-game/shared/testing` subpath export, or re-export helpers through `packages/shared/src/index.ts`, before this pattern proliferates.

## Dev Notes

- Source: [`epics.md`](../planning-artifacts/epics.md#L2664) Story 4B.2.
- `handleAction` is authoritative; server only injects valid `GameAction`s.
- Imports: `vite-plus/test` in tests; `@mahjong-game/shared` for engine.

## Dev Agent Record

### File List

- [`packages/server/src/websocket/grace-expiry-fallbacks.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.ts)
- [`packages/server/src/websocket/grace-expiry-fallbacks.test.ts`](../../packages/server/src/websocket/grace-expiry-fallbacks.test.ts)
- [`packages/server/src/websocket/state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts)
- [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts)
- [`packages/server/src/websocket/join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts)
- [`_bmad-output/implementation-artifacts/sprint-status.yaml`](../../_bmad-output/implementation-artifacts/sprint-status.yaml)

### Change Log

- 2026-04-05: Implemented play-phase grace fallbacks (auto DISCARD_TILE on discard step, PASS_CALL in call window), consolidated fan-out with try/catch, `attachToExistingSeat` build-before-mutate, test 3.8 adjusted for not-their-turn; marked retro `4b1-review-*` done in sprint-status.
- 2026-04-05: Second pass (gds-dev-story): `pnpm test`, `pnpm run typecheck`, `vp lint` all passed; Definition-of-Done checklist reviewed against AC1–AC9 with no gaps; optional code review — no material follow-ups (STATE_UPDATE fan-out centralized in `state-broadcaster.ts` with `trySendStatePayload`; chat `broadcastRawToRoom` already uses try/catch).
- 2026-04-05: gds-code-review applied fixes — (1) AC8 spec deviation in `attachToExistingSeat`: removed spurious `room.sessions.delete(playerId)` on build failure path (was stranding the superseded session); (2) added unit tests for AC4 rematch no-op and AC5 not-their-turn no-op in `grace-expiry-fallbacks.test.ts`. Regression gate: 258/258 server tests pass, typecheck clean, lint 0 errors.
- 2026-04-05: gds-code-review second pass — verified supersession close-handler self-healing under both grace-reconnect and live-supersession modes; verified broadcast consolidation preserves semantics for all 7 callers; verified phase-branch mutual exclusion between grace-expiry-fallbacks and charleston auto-action. No new blocking issues; 3 LOW follow-ups captured in `Review Follow-ups (AI)` (test Room construction, broadcast assertion coverage, shared test-helper import path).

### Completion Notes

- Playwright E2E per epics.md not added (optional follow-up); coverage via `grace-expiry-fallbacks.test.ts` + updated `join-handler.test.ts` 3.8.
- `pnpm test`, `pnpm run typecheck`, and `vp lint` passed at completion.
- Second pass re-ran the same gates and confirmed story remains ready for human merge/review (Status: review).
- gds-code-review (two passes) applied fixes for AC8 spec deviation and AC4/AC5 unit coverage; second pass found no blockers. Status: done with 3 LOW follow-ups tracked for later.
