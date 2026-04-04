# Story 3.2: Simplified Joker Rules (Host Option)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created for Story 3C.2 (FR56). -->

## Story

As a **host player**,
I want **to enable simplified Joker rules that disable Joker exchange from exposed groups**,
so that **mixed-experience groups can play without the complexity of Joker exchange strategy (FR56)**.

## Acceptance Criteria

1. **AC1 — Exchange disabled under simplified rules:** Given the game was started with simplified Joker rules, when any player dispatches `JOKER_EXCHANGE` during play on their turn in discard phase, then `{ accepted: false, reason: 'JOKER_EXCHANGE_DISABLED' }` (no state mutation).

2. **AC2 — Standard rules unchanged:** Given the game was started with **standard** Joker rules (default), when a player performs a valid `JOKER_EXCHANGE` per Story 3C.1, then the exchange succeeds as today — this story must not regress 3C.1 behavior.

3. **AC3 — Other Joker rules preserved:** Given simplified rules are active, when validating calls, discards, and group composition, then all existing Joker constraints still apply (substitution in groups of 3+, no Joker in pairs/singles, Joker discard restrictions, dead Joker behavior, etc.) — **only** Joker exchange from exposed groups is disabled.

4. **AC4 — Host setting applies to next game only:** Given the host changes the Joker rules mode in room settings while **no** game is in progress (`room.gameState == null`), when a new game is started, then the new mode applies. Given a game is **in progress**, when the host changes the setting, then the **current** `GameState` is unchanged; the updated mode applies only after the current game ends and the next `START_GAME` runs.

5. **AC5 — Room settings surface two options:** Given a client is in the lobby for a room, when reading lobby state from the server, then the host (and optionally all players) can see which mode is selected: **Standard** (default — exchange enabled) vs **Simplified** (exchange disabled). Non-host players must not be able to change this setting (server-enforced).

6. **AC6 — Immutable per match:** Given a game has started, the Joker rules mode for that match is fixed on `GameState` for the lifetime of that game (derived at `START_GAME` / `createGame`); it is not re-read from room mid-hand.

7. **AC7 — Protocol visibility:** `LobbyState` and `PlayerGameView` (or equivalent client-facing state) expose `jokerRulesMode` so UIs can show the current mode and hide or disable Joker-exchange affordances when simplified.

8. **AC8 — Validation gate:** `pnpm test`, `pnpm run typecheck`, and `vp lint` pass at repo root.

## Tasks / Subtasks

- [x] Task 1: Shared types — `JokerRulesMode` and `GameState` (AC: 2, 3, 6, 7, 8)
  - [x] 1.1 Add `export type JokerRulesMode = "standard" | "simplified"` in `packages/shared/src/types/game-state.ts` (or a small `rules.ts` if preferred; re-export from `index.ts`).
  - [x] 1.2 Add `jokerRulesMode: JokerRulesMode` to `GameState` — required on all non-lobby states; set in `createGame` (default `"standard"`).
  - [x] 1.3 Extend `StartGameAction` in `packages/shared/src/types/actions.ts` with optional `jokerRulesMode?: JokerRulesMode` (server supplies authoritative value).

- [x] Task 2: `createGame` + lobby state (AC: 2, 6, 8)
  - [x] 2.1 Update `packages/shared/src/engine/state/create-game.ts` — `createGame(playerIds, seed?, jokerRulesMode?)` or options object; default `jokerRulesMode` to `"standard"`.
  - [x] 2.2 Update `createLobbyState()` in `packages/shared/src/engine/game-engine.ts` to include `jokerRulesMode: "standard"` on the lobby placeholder object (value is discarded when `START_GAME` replaces state via `Object.assign`); keeps `GameState` structurally complete under `strict` typing.
  - [x] 2.3 Update `handleStartGame` in `packages/shared/src/engine/actions/game-flow.ts` to pass `action.jokerRulesMode ?? "standard"` into `createGame`.

- [x] Task 3: `handleJokerExchange` guard (AC: 1, 2, 3, 8)
  - [x] 3.1 In `packages/shared/src/engine/actions/joker-exchange.ts`, after `gamePhase === "play"`, `currentTurn`, and `turnPhase === "discard"` checks, **before** `resolveExposedGroup`, if `state.jokerRulesMode === "simplified"`, return `{ accepted: false, reason: "JOKER_EXCHANGE_DISABLED" }`.
  - [x] 3.2 Add tests in `joker-exchange.test.ts`: simplified mode rejects with `JOKER_EXCHANGE_DISABLED`; standard mode still allows a valid exchange (reuse existing setup helpers).

- [x] Task 4: Fixtures and engine tests (AC: 2, 8)
  - [x] 4.1 Update `packages/shared/src/testing/fixtures.ts` — `createPlayState` should default to `standard`; allow optional override for `simplified` tests.
  - [x] 4.2 Adjust `game-flow.test.ts` / `game-engine.test.ts` if `GameState` shape or `START_GAME` handling changes.

- [x] Task 5: Server — `Room` and authoritative rules (AC: 4, 5, 6, 8)
  - [x] 5.1 Add `jokerRulesMode: JokerRulesMode` to `packages/server/src/rooms/room.ts` (`Room`), default `"standard"` when the room is created in `RoomManager.createRoom`.
  - [x] 5.2 Implement a **host-only** path to update `room.jokerRulesMode` while `room.gameState === null` (reject if game in progress). Prefer a dedicated WebSocket message (e.g. `SET_JOKER_RULES` in `packages/shared/src/types/protocol.ts`) rather than trusting a client `START_GAME` payload for the mode — **server** passes `room.jokerRulesMode` into `handleAction` when the host starts the game.
  - [x] 5.3 In `handleStartGameAction` (`packages/server/src/websocket/action-handler.ts`), dispatch `{ type: "START_GAME", playerIds, seed?, jokerRulesMode: room.jokerRulesMode }` (ignore any client-sent mode for security).
  - [x] 5.4 Wire the new message in `packages/server/src/websocket/ws-server.ts` (or equivalent): validate host, validate `gameState === null`, update `room.jokerRulesMode`, broadcast updated `LobbyState` to all sessions.

- [x] Task 6: Protocol — `LobbyState` + `PlayerGameView` (AC: 5, 7, 8)
  - [x] 6.1 Extend `LobbyState` in `packages/shared/src/types/protocol.ts` with `jokerRulesMode: JokerRulesMode`.
  - [x] 6.2 Extend `PlayerGameView` with `jokerRulesMode: JokerRulesMode` sourced from `GameState` in `buildPlayerView` (`packages/server/src/websocket/state-broadcaster.ts`).
  - [x] 6.3 Update `buildLobbyState` in `packages/server/src/websocket/join-handler.ts` to include `room.jokerRulesMode`.

- [x] Task 7: Tests — shared + server (AC: 1, 4, 5, 8)
  - [x] 7.1 Server tests: host can set mode in lobby; non-host rejected; in-progress game rejects setting change; `START_GAME` locks mode into `GameState` (follow patterns in `action-handler.test.ts`, `join-handler.test.ts`).
  - [x] 7.2 Optional: `state-broadcaster.test.ts` expects `jokerRulesMode` in views.

- [x] Task 8: Client / UX (AC: 5, 7)
  - [x] 8.1 When a production lobby UI exists, add a host-only control (Standard vs Simplified) that sends the new WebSocket message and reflects `LobbyState.jokerRulesMode`. **If** no host lobby route exists in `packages/client` at implementation time, add a **dev-only** showcase (under existing dev gating) or document the protocol contract and rely on server integration tests — but **must** still export types so the next UI story can consume them without refactors.

- [x] Task 9: Validation gate (AC: 8)
  - [x] 9.1 `pnpm test && pnpm run typecheck && vp lint` from repo root.

## Dev Notes

### Intent (FR56)

Simplified rules remove **only** the Joker **exchange** mechanic. All substitution / discard / dead-Joker rules from the GDD remain. [Source: `_bmad-output/planning-artifacts/gdd.md` — Joker rules & Simplified Joker Rules]

### Server authority

Match project-context: **never** trust the client for the rules mode on `START_GAME`. Store the host’s choice on `Room`, inject when the host calls `START_GAME`. [Source: `_bmad-output/project-context.md` — Server Authority]

### Previous story (3C.1) continuity

Story 3C.1 added `handleJokerExchange` with validate-then-mutate ordering. This story adds a **single early branch** after phase/turn/turnPhase checks using `state.jokerRulesMode`. Do not duplicate eligibility logic — `validateJokerExchange` is unchanged for standard mode. [Source: `_bmad-output/implementation-artifacts/3c-1-joker-exchange-mechanic.md`]

### Rejection reason string

Use exactly **`JOKER_EXCHANGE_DISABLED`** (epics acceptance criteria). Keep consistent with other `ActionResult.reason` string tokens.

### Why both `Room` and `GameState`?

- **`Room.jokerRulesMode`:** Editable in lobby; drives the next match and what clients show before start.
- **`GameState.jokerRulesMode`:** Immutable snapshot for the active game — satisfies AC4/AC6 and keeps the engine testable without server coupling.

### Client codebase note (2026-04)

`packages/client` may not yet expose a production room lobby; HomeView notes multiplayer is still in development. Implement the **full server + shared + protocol** path first; ship minimal dev UX or integration-only verification if no host UI exists, without blocking AC5 at the **protocol** level (`LobbyState` lists the mode).

### Key files reference

| Area | Files |
|------|--------|
| Types | `packages/shared/src/types/game-state.ts`, `packages/shared/src/types/actions.ts`, `packages/shared/src/types/protocol.ts` |
| Engine | `packages/shared/src/engine/state/create-game.ts`, `packages/shared/src/engine/actions/game-flow.ts`, `packages/shared/src/engine/actions/joker-exchange.ts` |
| Server | `packages/server/src/rooms/room.ts`, `packages/server/src/rooms/room-manager.ts`, `packages/server/src/websocket/action-handler.ts`, `packages/server/src/websocket/join-handler.ts`, `packages/server/src/websocket/ws-server.ts`, `packages/server/src/websocket/state-broadcaster.ts` |
| Tests | `packages/shared/src/engine/actions/joker-exchange.test.ts`, `packages/server/src/websocket/action-handler.test.ts` |

### References

- [Epics — Story 3C.2](_bmad-output/planning-artifacts/epics.md) (BDD acceptance criteria)
- [GDD — Simplified Joker Rules](_bmad-output/planning-artifacts/gdd.md)
- [Project context](_bmad-output/project-context.md)
- [Story 3C.1 — Joker Exchange Mechanic](_bmad-output/implementation-artifacts/3c-1-joker-exchange-mechanic.md)

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented `JokerRulesMode` on `GameState` and `Room`; server injects `jokerRulesMode` on `START_GAME` from `Room` only.
- Added WebSocket `SET_JOKER_RULES` (`SetJokerRulesMessage`) handled in `join-handler.ts` (`handleSetJokerRules`): host-only, lobby-only, broadcasts `LobbyState` to all sessions.
- `handleJokerExchange` returns `JOKER_EXCHANGE_DISABLED` when `jokerRulesMode === "simplified"` (no mutation).
- Extended `LobbyState`, `PlayerGameView`, and `SpectatorGameView` with `jokerRulesMode`; `sendCurrentState` lobby branch includes room mode.
- Dev showcase: `/dev/joker-rules` documents protocol for future lobby UI.

### File List

- `packages/shared/src/types/game-state.ts`
- `packages/shared/src/types/actions.ts`
- `packages/shared/src/types/protocol.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/engine/state/create-game.ts`
- `packages/shared/src/engine/game-engine.ts`
- `packages/shared/src/engine/actions/game-flow.ts`
- `packages/shared/src/engine/actions/joker-exchange.ts`
- `packages/shared/src/testing/fixtures.ts`
- `packages/shared/src/engine/state/create-game.test.ts`
- `packages/shared/src/engine/actions/game-flow.test.ts`
- `packages/shared/src/engine/actions/joker-exchange.test.ts`
- `packages/shared/src/engine/game-engine.test.ts`
- `packages/server/src/rooms/room.ts`
- `packages/server/src/rooms/room-manager.ts`
- `packages/server/src/websocket/action-handler.ts`
- `packages/server/src/websocket/join-handler.ts`
- `packages/server/src/websocket/ws-server.ts`
- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/action-handler.test.ts`
- `packages/server/src/websocket/join-handler.test.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `packages/server/src/rooms/session-manager.test.ts`
- `packages/server/src/rooms/seat-assignment.test.ts`
- `packages/server/src/rooms/room-lifecycle.test.ts`
- `packages/client/src/components/dev/JokerRulesShowcase.vue`
- `packages/client/src/dev-showcase-routes.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-03: Story 3C.2 implemented — simplified Joker rules host option, protocol, tests, dev showcase.
- 2026-04-03: GDS adversarial code review completed — status `done`, sprint synced; File List updated to include sprint tracking artifact.
- Follow-up: `/gds-code-review` re-run — git diff reconciled to File List; AC8 `pnpm test`, `pnpm run typecheck`, `vp lint` passed at repo root; no new findings.

## Senior Developer Review (AI)

_Reviewer: Rchoi (AI-assisted GDS code-review workflow) on 2026-04-03_

**Git vs story:** Compared `git diff --name-only` to Dev Agent Record → File List. All listed source paths had matching changes; `sprint-status.yaml` was modified for Epic 3C tracking but was missing from the File List — **corrected** in this record.

**Severity summary:** 0 High, 1 Medium (documentation only, resolved), 0 Low.

**Acceptance criteria:** AC1 (`joker-exchange.ts` early return before `resolveExposedGroup` / mutation), AC2 (`parseGameAction` does not forward client `jokerRulesMode`; `handleStartGameAction` injects `room.jokerRulesMode`), AC3 (`jokerRulesMode` only gates exchange in shared engine), AC4/AC6 (`handleSetJokerRules` lobby-only; room mode snapshotted in `createGame` via `START_GAME`), AC5/AC7 (protocol + `buildLobbyState` / `buildPlayerView` / `SpectatorGameView`), AC8 (`pnpm test`, `pnpm run typecheck`, `vp lint` all passed at repo root).

**Tasks:** All `[x]` tasks verified against code and tests; no false completions found.

**Outcome:** Approve — implementation matches story; no code changes required from review.

**Follow-up (re-run):** Story was already `done`; adversarial checklist re-executed. Severity: 0 High, 0 Medium, 0 Low. **Note:** `git status` may still show untracked story file / showcase until committed — not a spec gap.

---

### Cross-session intelligence

- Epic 3C.1 established `JOKER_EXCHANGE` handler location and test patterns in `joker-exchange.test.ts` using `createPlayState`.
- Charleston / disconnect stories established host-only and phase-gated server patterns — reuse for “lobby only” setting updates.

### Git intelligence summary

- Recent work touched `joker-exchange.ts`, `action-handler.ts`, and protocol types; extend those files rather than introducing parallel pipelines.

### Architecture compliance

- **Validate-then-mutate:** New checks return `ActionResult` without mutation.
- **Shared package:** Rule flag belongs on `GameState` for engine tests; no browser APIs in `shared/`.
- **WebSocket:** New host message should send errors only to the requesting client on failure; broadcast `STATE_UPDATE` on success (existing broadcaster patterns).

### Testing requirements

- Co-located `*.test.ts` next to sources or existing server test files.
- Use `vite-plus/test` imports per project conventions.
- Cover: simplified rejection, standard regression, host vs non-host, lobby vs in-game setting change.

### Latest tech information

- No new runtime dependencies expected; stack remains TypeScript 5.9, Fastify 5, Vue 3 per `project-context.md`.

### Project context reference

See `_bmad-output/project-context.md` (85 rules): server authority, validate-then-mutate, tile IDs, WebSocket protocol.
