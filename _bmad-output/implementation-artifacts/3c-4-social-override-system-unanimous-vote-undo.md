# Story 3C.4: Social Override System (Unanimous Vote Undo)

Status: review

## Story

As a **player**,
I want **to request an undo for accidental discards before anyone calls, requiring unanimous approval from the other 3 players**,
so that **friends can forgive honest mistakes the way they would in person (FR84–FR88, UX-DR34)**.

## Acceptance Criteria

1. **AC1 — Undo window:** Given a discard just opened the call window with no calls yet (`callWindow.status === "open"` and `calls.length === 0`), when the discarder dispatches `SOCIAL_OVERRIDE_REQUEST` with a non-empty `description`, then a social override vote starts and other actions that would advance the call window are blocked until resolution.

2. **AC2 — Vote prompt:** Given a social override is active, when state is broadcast, then all clients receive `socialOverrideState` with `requesterId`, `description`, `expiresAt`, `discardedTileId`, and vote progress so the three non-requesting players can approve or deny.

3. **AC3 — Unanimous approve:** Given three non-requesting players, when all three vote approve, then the discard is reversed (tile returns to discarder rack, removed from discard pool, `lastDiscard` cleared, `callWindow` cleared, `turnPhase` returns to `"discard"` for the same player).

4. **AC4 — Any deny:** Given any non-requesting player votes deny, then the override is rejected immediately, `socialOverrideState` clears, and the call window continues unchanged.

5. **AC5 — Timeout:** Given 10 seconds elapse without all three approvals, then silence counts as deny — override rejected, state restored as AC4.

6. **AC6 — Dead hand:** Given the requester has `deadHand === true`, when they attempt `SOCIAL_OVERRIDE_REQUEST`, then `{ accepted: false, reason: "DEAD_HAND_CANNOT_REQUEST" }` (FR84 — social override does not apply to dead-hand situations).

7. **AC7 — Wrong actor / phase:** Given the player is not the discarder, or `callWindow` is not open with no pending calls, or game is not in play, then appropriate rejection reasons (`NOT_DISCARDER`, `CALL_WINDOW_NOT_ELIGIBLE`, `WRONG_PHASE`).

8. **AC8 — Host audit log:** Given any social override request or resolution, when the host views game state, then `hostAuditLog` on their `PlayerGameView` includes human-readable entries for transparency (FR88).

9. **AC9 — UX hint:** Given a social override is pending, clients may treat the pending discard tile as “in question” (subtle pulse) — minimal implementation: expose `socialOverrideState` so UI can style `lastDiscard` / discard pool tile (UX-DR34).

10. **AC10 — Validation gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass.

## Tasks / Subtasks

- [x] Task 1: Shared types and GameState fields (AC: 1–2, 6–7, 10)
  - [x] 1.1 Add `SocialOverrideState`, `hostAuditLog` to `GameState`; init in `createGame` / `createLobbyState`
  - [x] 1.2 Add `SocialOverrideRequestAction`, `SocialOverrideVoteAction` to `GameAction`
  - [x] 1.3 Add `ResolvedAction` variants for request, vote, applied, rejected, timeout

- [x] Task 2: Engine handlers (AC: 1–7)
  - [x] 2.1 Implement `handleSocialOverrideRequest`, `handleSocialOverrideVote`, `handleSocialOverrideTimeout` in `packages/shared/src/engine/actions/social-override.ts`
  - [x] 2.2 Block `PASS_CALL` and all `CALL_*` while `socialOverrideState` is active
  - [x] 2.3 Register cases in `game-engine.ts`; export from `packages/shared/src/index.ts`

- [x] Task 3: Protocol and broadcaster (AC: 2, 8)
  - [x] 3.1 Extend `PlayerGameView` with `socialOverrideState`, `hostAuditLog` (host only for log)
  - [x] 3.2 Update `buildPlayerView` in `state-broadcaster.ts`

- [x] Task 4: Server (AC: 5, 10)
  - [x] 4.1 Validate and parse new actions in `action-handler.ts`
  - [x] 4.2 Schedule/clear 10s timeout on `Room` when override starts/ends; call `handleSocialOverrideTimeout`

- [x] Task 5: Client (AC: 2, 9, 10)
  - [x] 5.1 Thread `socialOverrideState` into `GameTable` / voting affordance for approve/deny
  - [x] 5.2 Optional pulse styling on pending discard

- [x] Task 6: Tests (AC: all)
  - [x] 6.1 `social-override.test.ts` — happy path, deny, dead hand, blocked pass/call
  - [x] 6.2 Server/broadcaster tests as needed

- [x] Task 7: Validation gate (AC: 10)
  - [x] 7.1 `pnpm test && pnpm run typecheck && vp lint`

## Dev Notes

### Scope boundaries

- **In scope:** Accidental **discard** undo during **open** call window **before any call** is recorded (`calls.length === 0`). Matches “next irreversible change has not occurred” for discard+call flow.
- **Out of scope (defer):** Mistaken **call** confirmation undo, Charleston pass errors — reject or no-op with clear reason if actions are added later.

### Key files

| Area | File |
|------|------|
| Handlers | `packages/shared/src/engine/actions/social-override.ts` |
| Call blocking | `packages/shared/src/engine/actions/call-window.ts` |
| Server | `packages/server/src/websocket/action-handler.ts`, `room.ts` |
| Broadcast | `packages/server/src/websocket/state-broadcaster.ts` |

### Host log

Append-only `hostAuditLog: string[]` on `GameState`. Only include in `PlayerGameView` when `player.isHost`.

## Dev Agent Record

### Completion Notes

Implemented social override for accidental **discard** undo: `SOCIAL_OVERRIDE_REQUEST` / `SOCIAL_OVERRIDE_VOTE` / `handleSocialOverrideTimeout`, unanimous 3-player approve, 10s server timer (silence = deny), `PASS_CALL` and calls blocked while vote pending, `hostAuditLog` for host-only transparency, `PlayerGameView.socialOverrideState` + optional `hostAuditLog`. Client: `SocialOverridePanel` + `GameTable` props/emits for request and vote; discard pool ring highlight when pending. Production room wiring must set `canRequestSocialOverride` from `callWindow` (open, no calls) and discarder id.

### Debug Log

None.

## File List

- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/actions.ts`
- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/engine/actions/social-override.ts`
- `packages/shared/src/engine/actions/social-override.test.ts`
- `packages/shared/src/engine/actions/call-window.ts`
- `packages/shared/src/engine/game-engine.ts`
- `packages/shared/src/engine/state/create-game.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/rooms/room.ts`
- `packages/server/src/rooms/room-manager.ts`
- `packages/server/src/websocket/action-handler.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/rooms/room-lifecycle.test.ts`
- `packages/server/src/rooms/session-manager.test.ts`
- `packages/server/src/rooms/seat-assignment.test.ts`
- `packages/client/src/components/game/SocialOverridePanel.vue`
- `packages/client/src/components/game/SocialOverridePanel.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3c-4-social-override-system-unanimous-vote-undo.md`

## Change Log

- **2026-04-04:** Story file created; sprint set ready-for-dev → in-progress for implementation.
- **2026-04-04:** Implementation complete — story status **review**, sprint **review**; validation gate passed.
