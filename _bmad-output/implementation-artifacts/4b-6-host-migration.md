# Story 4B.6: Host Migration

Status: done

<!-- Epic 4B story 6. Adds automatic host-role transfer when the current host leaves the room (via grace-expiry-after-disconnect or via explicit LEAVE_ROOM / departure-vote outcome). Closes the 4B.5 accepted gap where a host could be dead-seated while still holding the host flag, leaving rematch/settings unreachable. Out of scope: 5th-player "table is full" page (Story 4B.7), host-configurable settings panel (Story 4B.7), persisted host across server restart, explicit manual host-transfer UI. -->

## Story

As a **player**,
I want **host privileges to automatically transfer to the next connected player in counterclockwise seat order when the host permanently leaves the room**,
so that **the room remains functional — someone can always start a rematch, change settings between games, and end the session — without the host's departure freezing the table (FR98)**.

## Acceptance Criteria

1. **AC1 — `migrateHost(room, logger)` server helper.** New function in a new [`packages/server/src/rooms/host-migration.ts`](../../packages/server/src/rooms/host-migration.ts) module. Signature:
   ```ts
   export function migrateHost(
     room: Room,
     logger: FastifyBaseLogger,
     opts?: { excludePlayerIds?: ReadonlySet<string> },
   ): { previousHostId: string | null; newHostId: string | null };
   ```
   Behavior:
   - (a) Find the current host: `currentHost = [...room.players.values()].find((p) => p.isHost) ?? null`.
   - (b) Build the candidate list: iterate `SEATS` (`packages/shared/src/constants.ts` — east → south → west → north, counterclockwise) starting from the seat *after* the current host's wind (or from east if no current host), wrap once, and pick the **first** player who is all of: present in `room.players`, `connected === true`, NOT in `room.deadSeatPlayerIds`, NOT in `room.departedPlayerIds`, NOT in `opts.excludePlayerIds`, and NOT the current host themself.
   - (c) If a candidate is found: set `currentHost.isHost = false` (if `currentHost` exists), set `candidate.isHost = true`, log `"Host migrated"` with `{ roomCode, previousHostId, newHostId }`, return `{ previousHostId: currentHost?.playerId ?? null, newHostId: candidate.playerId }`.
   - (d) If no candidate is found (hostless room — zero eligible players): clear `currentHost.isHost = false` if present, log `"Host migration: no eligible candidate, room is hostless"`, return `{ previousHostId, newHostId: null }`. Do **not** throw. A hostless room is a valid transient state (e.g. all players disconnected mid-game — the next reconnect becomes host via AC5).
   - (e) The helper is **pure state mutation** — it does NOT broadcast. Callers are responsible for broadcasting `HOST_PROMOTED` after `migrateHost` returns a non-null `newHostId`.

2. **AC2 — `HOST_PROMOTED` resolved action.** Add to [`ResolvedAction`](../../packages/shared/src/types/game-state.ts):
   ```ts
   { readonly type: "HOST_PROMOTED"; readonly previousHostId: string | null; readonly newHostId: string; readonly newHostName: string }
   ```
   `previousHostId` is nullable to cover the "hostless room → first reconnect becomes host" path (AC5). This is a breaking addition to the `ResolvedAction` union — every exhaustive switch must be updated (same discipline as 4B.4 / 4B.5). Run `pnpm run typecheck` to find them; at minimum: `mapPlayerGameViewToGameTable.ts`, `useRoomConnection.ts` resolved-action router, test helpers, `PlayerGameViewBridgeShowcase.vue`.

3. **AC3 — Grace-expiry trigger (disconnect → permanent).** In [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` inside the `setTimeout` grace-expiry callback, **after** `releaseSeat(room, playerId)` and **before** the final `broadcastStateToRoom(room)`:
   ```ts
   const wasHost = ... // capture BEFORE releaseSeat runs, via room.players.get(playerId)?.isHost
   if (wasHost) {
     const result = migrateHost(room, logger);
     if (result.newHostId) {
       const newHost = room.players.get(result.newHostId);
       broadcastStateToRoom(room, undefined, {
         type: "HOST_PROMOTED",
         previousHostId: playerId,
         newHostId: result.newHostId,
         newHostName: newHost?.displayName ?? "",
       });
     }
   }
   ```
   Capture `wasHost` **before** `releaseSeat` because `releaseSeat` removes the player from `room.players`, so `room.players.get(playerId)?.isHost` would return `undefined` after.
   - **Grace period reconnect:** if the host reconnects within the grace period, no migration runs — `releaseSeat` never fires, the existing grace-reconnect path in `attachToExistingSeat` handles it, and the host keeps `isHost = true` naturally.
   - **30-second grace period is the canonical host-migration trigger** for disconnect-based departures (epic AC: "When the grace period (~30 seconds) expires without reconnection Then host privileges transfer…"). The grace period already defaults to ~30s in [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) — no new timer is added.

4. **AC4 — Intentional-departure trigger (`LEAVE_ROOM` / departure vote).** Host migration also fires on the 4B.5 departure paths. Three sub-cases in [`leave-handler.ts`](../../packages/server/src/websocket/leave-handler.ts):
   - **(a) Lobby-phase `LEAVE_ROOM` by host.** In `markPlayerDeparted` lobby branch (AC5 of 4B.5), after `releaseSeat(room, playerId)` and before the final state broadcast, check `wasHost` and call `migrateHost` + broadcast `HOST_PROMOTED` per AC3 pattern. This closes the 4B.5 T12 gap ("Host role reassignment is explicitly deferred to Story 4B.6 — for 4B.5, `isHost` flag is cleared on E's info pre-release, but no new host is assigned. The room may be hostless until 4B.6 ships.").
   - **(b) Departure-vote `"dead_seat"` outcome for host.** In `convertToDeadSeat(room, playerId, logger)` (4B.5 AC7), **after** adding to `deadSeatPlayerIds` and **before** broadcasting `PLAYER_CONVERTED_TO_DEAD_SEAT`, check if the dead-seated player `wasHost`. If so, run `migrateHost(room, logger, { excludePlayerIds: new Set([playerId]) })` and broadcast `HOST_PROMOTED` after the `PLAYER_CONVERTED_TO_DEAD_SEAT` broadcast (order: dead-seat conversion first, then host promotion — clients render the dead-seat badge before the host badge moves). This closes the 4B.5 T13 gap.
   - **(c) `autoEndGameOnDeparture`.** When the host's departure triggers auto-end (multi-departure or vote outcome `"end_game"`), the host is `releaseSeat`-ed along with the other departed players and the scoreboard phase begins. Migration MUST still run — during scoreboard, the new host can tap "Play Again" or change settings (per epic AC). After the final `releaseSeat` loop in `autoEndGameOnDeparture`, if the released list included the host, call `migrateHost` + broadcast `HOST_PROMOTED`. Capture `wasHost` before the releaseSeat loop.
   - **Scoreboard / post-game `LEAVE_ROOM` by host.** The 4B.5 T20 scoreboard branch runs `releaseSeat` directly (no vote). Add the same `wasHost` + `migrateHost` pattern there.

5. **AC5 — Hostless-room recovery: first reconnect becomes host.** When `migrateHost` returns `{ newHostId: null }` (no eligible candidate — e.g. all players disconnected mid-game and the host's grace expired first), the room is **hostless**. When the next player (re)joins via `handleJoinRoom` / `attachToExistingSeat` in [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts), if no player in `room.players` has `isHost === true`, promote that player to host:
   - In `attachToExistingSeat` (after the successful attach, before the final state broadcast): if `![...room.players.values()].some((p) => p.isHost)`, set `player.isHost = true`, broadcast `HOST_PROMOTED` with `previousHostId: null`, `newHostId: player.playerId`.
   - In `handleJoinRoom` tokenless lobby-join path: same check after the new player is added to `room.players`. The existing `isHost = room.players.size === 0` init in `handleJoinRoom` already covers the "first player in a lobby becomes host" path — the new branch covers "first reconnect into a hostless mid-game room becomes host".
   - **Accepted gap:** the 5-minute all-disconnected `abandoned-timeout` cleanup (already in `room-lifecycle.ts`) is unchanged. If no one reconnects within that window, the room is destroyed and the hostless state never resolves. Epic AC: "Given all four players disconnect When any player reconnects within 5 minutes Then they become host and can wait for others; after 5 minutes with zero connections, the room is cleaned up" — the 5-minute window is the existing `abandoned-timeout`, not a new timer.

6. **AC6 — Original host reconnect after migration: rejoins as regular player.** When a player reconnects via `attachToExistingSeat` and `room.players.get(playerId)?.isHost === false`, they rejoin as a regular player. The AC5 hostless-room promotion does NOT apply if another player is already the host. This prevents role-bouncing on flaky host connections: once migration has run, the original host stays demoted for the life of the room. No special code needed here — it falls out of the AC5 "promote only if no one is host" gate.

7. **AC7 — Host capability parity.** The new host has identical capabilities to the original host: start/rematch games, change settings between games (Story 4B.7 — settings panel is not in 4B.6, but the `isHost` flag gates the future settings handler), end the session. No per-host state exists beyond the `isHost` boolean on `PlayerInfo` — capability gating in handlers uses `player.isHost` (see [`action-handler.ts:436`](../../packages/server/src/websocket/action-handler.ts) and [`join-handler.ts:41`](../../packages/server/src/websocket/join-handler.ts)), so flipping the flag is the entire migration state change.
   - **Regression check:** grep for every `isHost` read site in `packages/server/src`. They must all work correctly with a post-migration `isHost` value. `hostAuditLog` in `state-broadcaster.ts:191` also pipes through `isHost` — the new host receives the host audit log on their next `STATE_UPDATE`.

8. **AC8 — Mid-game migration is silent on the host UI but still broadcasts.** Per epic AC: "during lobby: new host can start the game; during mid-game: migration is silent (host is just a player during gameplay); during scoreboard: new host can tap 'Play Again' or change settings". The server ALWAYS broadcasts `HOST_PROMOTED` regardless of phase — the **client** decides whether to render a toast. In [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) resolved-action router: show the toast "[newHostName] is now the host" when the current `gamePhase` is `"lobby"` or `"scoreboard"`; during `"play"` / `"charleston"`, skip the toast (the `isHost` flag still flows through `PlayerGameView` so any host-only UI affordances update silently). Keep the broadcast unconditional so reconnecters always see consistent host state.

9. **AC9 — `PlayerPublicInfo.isHost` propagation.** No shape change. `PlayerPublicInfo` already carries `isHost` (see [`protocol.ts:134`](../../packages/shared/src/types/protocol.ts)) and `buildPlayerView` already emits it via `state-broadcaster.ts:79`. The migration simply flips the boolean on the new host's `PlayerInfo` in `room.players`, and the next full-state broadcast carries the updated flag to all clients. No new `PlayerGameView` field.

10. **AC10 — Order-of-operations invariants.**
    - Grace-expiry (AC3): `releaseSeat → migrateHost → HOST_PROMOTED broadcast → broadcastStateToRoom`. The final full-state broadcast carries the updated `isHost` flags; the `HOST_PROMOTED` resolved action is a room-level event fired *before* the state snapshot so clients see the event, then the snapshot confirming it.
    - Dead-seat conversion (AC4b): `deadSeatPlayerIds.add → PLAYER_CONVERTED_TO_DEAD_SEAT broadcast → migrateHost → HOST_PROMOTED broadcast → syncTurnTimer`. Dead-seat conversion is rendered before host promotion.
    - Auto-end (AC4c): `releaseSeat loop → migrateHost → HOST_PROMOTED broadcast → GAME_ABANDONED broadcast → idle-timeout arm`. Host must be promoted *before* `GAME_ABANDONED` so the scoreboard UI (which allows rematch) sees the new host in its initial render.
    - Lobby leave (AC4a): `releaseSeat → migrateHost → HOST_PROMOTED broadcast → lobby STATE_UPDATE`.
    - Hostless reconnect (AC5): `attach/join player → isHost = true → HOST_PROMOTED broadcast → STATE_UPDATE`.

11. **AC11 — Game-start / game-end cleanup.** Host flag is **persistent across games** (the host stays host between rematches — same behavior as the original host model). `handleStartGameAction` does NOT clear `isHost`. `resetTurnTimerStateOnGameEnd` does NOT touch `isHost`. The only `isHost` transitions are: (a) initial room creation, (b) `migrateHost`, (c) AC5 hostless promotion. Verify in existing tests that `handleStartGameAction` does not reset `isHost`.

12. **AC12 — Action-handler host-gated actions still validate.** The existing `handleStartGameAction` gate `if (!player?.isHost) { sendActionError(..., "NOT_HOST", ...) }` ([`action-handler.ts:436`](../../packages/server/src/websocket/action-handler.ts)) is unchanged. Post-migration, the new host passes the gate and the old (now-regular) host fails it. Add a regression test: migration → old host sends `START_GAME` → rejected with `NOT_HOST` → new host sends `START_GAME` → accepted.

13. **AC13 — Client: `HOST_PROMOTED` handling.** In [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts):
    - Add `HOST_PROMOTED` to the exhaustive resolved-action `switch`.
    - On `HOST_PROMOTED`: if `playerGameView.value?.gamePhase` is `"lobby"` or `"scoreboard"` (or `playerGameView.value` is `null` because only a lobby state exists — detect via `lobbyState.value`), push a toast: `"${newHostName} is now the host"`. Otherwise suppress the toast.
    - The `isHost` flag updates on the next `STATE_UPDATE`/lobby state push, which the pipeline already handles. No manual state patch needed.
    - `data-testid="host-promoted-toast"` on the toast element for tests.

14. **AC14 — Test strategy.** Multi-socket integration tests in a new [`packages/server/src/rooms/host-migration.test.ts`](../../packages/server/src/rooms/host-migration.test.ts) for unit tests of `migrateHost` (pure function — 4 players, host leaves, next counterclockwise seat wins; dead-seat players skipped; departed players skipped; disconnected players skipped; hostless return). Integration tests extend existing files:
    - [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts): host disconnect → grace expiry → `HOST_PROMOTED` broadcast; host grace-reconnect → no migration; hostless room recovery on first reconnect (AC5).
    - [`leave-handler.test.ts`](../../packages/server/src/websocket/leave-handler.test.ts): host lobby `LEAVE_ROOM` → migration; host mid-game departure vote → `"dead_seat"` outcome → migration after conversion; host departure → `"end_game"` outcome → migration before `GAME_ABANDONED`; T12 / T13 updated to assert migration instead of documenting the gap.
    - [`action-handler.test.ts`](../../packages/server/src/websocket/action-handler.test.ts): post-migration `START_GAME` from old host rejected (`NOT_HOST`), from new host accepted.
    - [`state-broadcaster.test.ts`](../../packages/server/src/websocket/state-broadcaster.test.ts): `PlayerPublicInfo.isHost` reflects post-migration state.

15. **AC15 — Transition scenarios.** Every row below must be covered by at least one test (Epic 6A retro follow-through `6a-retro-1`). See table below.

16. **AC16 — Regression gate.** `pnpm test && pnpm run typecheck && vp lint` pass from repo root. Critical regressions:
    - 4B.5 T12 test (lobby host leave documenting the hostless gap): updated to assert migration succeeds.
    - 4B.5 T13 test (host dead-seated): updated to assert migration runs after `PLAYER_CONVERTED_TO_DEAD_SEAT`.
    - 4B.3 pause/resume: simultaneous disconnect does not trigger migration (nobody is released; host stays host across pause).
    - 4B.2 grace-expiry fallbacks: host-specific auto-discard / auto-pass is unchanged — the grace-expiry fallback path runs before migration, same order as before.
    - `handleStartGameAction` host gate continues to work with post-migration flags.

17. **AC17 — Documentation.** Top-of-file header on `host-migration.ts`: document the three migration triggers (grace-expiry, departure-vote dead-seat, auto-end / lobby leave / scoreboard leave), the hostless-room transient state, and the "first reconnect becomes host" recovery path. Cross-reference from `leave-handler.ts` and `join-handler.ts` comments at each trigger site. Update `leave-handler.ts` header comment to remove the "4B.5 accepted gap: host departure leaves room hostless" note and point to `host-migration.ts`.

### Transition scenarios

| # | Scenario | Expected behavior | AC |
|---|----------|-------------------|----|
| T1 | 4 players mid-game; host (E) disconnects; grace period expires | `releaseSeat(E)` → `migrateHost` → S becomes host → `HOST_PROMOTED { previousHostId: E, newHostId: S }` → final state broadcast shows S.isHost=true | AC3, AC10 |
| T2 | Host (E) disconnects; reconnects within grace period | No migration; E stays host; grace timer cleared | AC3 |
| T3 | Lobby phase; host (E) sends `LEAVE_ROOM` | `releaseSeat(E)` → `migrateHost` → S becomes host → `PLAYER_DEPARTED` + `HOST_PROMOTED` broadcasts → lobby `STATE_UPDATE` with 3 players, S.isHost=true | AC4a, AC10 |
| T4 | Mid-game; host (E) sends `LEAVE_ROOM`; S/W vote `dead_seat` | `DEPARTURE_VOTE_RESOLVED { dead_seat }` → `convertToDeadSeat(E)` → `PLAYER_CONVERTED_TO_DEAD_SEAT` → `migrateHost` (excludes E via opts) → S becomes host → `HOST_PROMOTED` → `syncTurnTimer` advances past E | AC4b, AC10 |
| T5 | Mid-game; host (E) sends `LEAVE_ROOM`; S/W vote `end_game` | `DEPARTURE_VOTE_RESOLVED { end_game }` → `autoEndGameOnDeparture` → `releaseSeat(E)` → `migrateHost` → S becomes host → `HOST_PROMOTED` → `GAME_ABANDONED { reason: "player-departure" }` → scoreboard; S can now tap "Play Again" | AC4c, AC10 |
| T6 | Scoreboard phase; host (E) sends `LEAVE_ROOM` | Scoreboard branch runs `releaseSeat(E)` → `migrateHost` → `HOST_PROMOTED` → `PLAYER_DEPARTED` | AC4 (scoreboard), 4B.5 T20 extension |
| T7 | All 4 players disconnect mid-game; host's grace expires first | `releaseSeat(host)` → `migrateHost` walks candidates; all remaining are `connected: false` → returns `{ newHostId: null }`; room is hostless; log "no eligible candidate" | AC1d, AC5 |
| T8 | Continuing T7: any player reconnects via token within 5 minutes | `attachToExistingSeat` sees no `isHost` player; promotes reconnecter to host; `HOST_PROMOTED { previousHostId: null, newHostId: reconnected }` | AC5 |
| T9 | Continuing T7: no one reconnects within 5 minutes | Existing `abandoned-timeout` in `room-lifecycle.ts` cleans up the room; no migration work | AC5 (accepted gap) |
| T10 | Migration winner order: host (E) leaves; S is dead-seated, W is connected, N is disconnected (in grace) | `migrateHost` iterates SEATS from position-after-E = S (skip — dead-seat) → W (winner: connected, not dead-seat, not departed) → N skipped; W becomes host | AC1b |
| T11 | Migration winner order: host (E) leaves; S is departed, W is dead-seat, N is connected | `migrateHost` → S skipped (departed) → W skipped (dead-seat) → N becomes host | AC1b |
| T12 | Post-migration: old host (E) reconnects after grace expiry (their seat is gone) | Tokenless grace recovery already forbids this (seat released). If they join fresh as a new player, they join as a regular player (the new host is already set). No role-bouncing. | AC6 |
| T13 | Post-migration in lobby: old host tries `START_GAME` | `handleStartGameAction` `isHost` gate rejects with `NOT_HOST` | AC7, AC12 |
| T14 | Post-migration in lobby: new host sends `START_GAME` | Accepted; game starts normally | AC7, AC12 |
| T15 | Mid-game host migration: toast suppressed on client | `HOST_PROMOTED` resolvedAction arrives during `gamePhase: "play"`; client skips toast render; `isHost` still updates via `PlayerGameView` | AC8, AC13 |
| T16 | Lobby host migration: toast shown on client | `HOST_PROMOTED` resolvedAction arrives during lobby; toast renders with `[newHostName] is now the host` | AC8, AC13 |
| T17 | 4B.3 pause while host is disconnected | Simultaneous-disconnect pause triggers (existing behavior). No `releaseSeat` runs during pause → no migration. On resume, host either reconnects (stays host) or pause-timeout fires `handlePauseTimeout` → scoreboard via `GAME_ABANDONED { pause-timeout }`; the pause-timeout path does NOT currently `releaseSeat` disconnected players (verify — if it does, add migration hook there too). | AC16 regression |
| T18 | `handleStartGameAction` across a rematch: new host stays host for the next game | `isHost` not cleared by `handleStartGameAction`; state-start-of-game shows S.isHost=true (unchanged from end-of-previous-game) | AC11 |

### Scope boundaries

| In scope (4B.6) | Out of scope |
| --------------- | ------------ |
| `migrateHost(room, logger, opts?)` helper in new `host-migration.ts` | Host-configurable settings panel UI (Story 4B.7) |
| `HOST_PROMOTED` resolved action + client toast (lobby/scoreboard only) | 5th-player "table is full" page (Story 4B.7) |
| Grace-expiry migration trigger (disconnect → permanent) | Explicit manual host-transfer UI ("pass the crown") — not in MVP |
| `LEAVE_ROOM` lobby migration trigger | Persisting host across server restart |
| Departure-vote `"dead_seat"` outcome migration (closes 4B.5 T13 gap) | Per-game host rotation rules (host stays host across rematches) |
| Departure-vote `"end_game"` / auto-end migration (scoreboard rematch path) | Host election voting — next-counterclockwise is deterministic and final |
| Scoreboard-phase `LEAVE_ROOM` migration | Handling concurrent host departures (covered by FR97 auto-end first) |
| Hostless-room transient state + first-reconnect promotion | Tests for every T1–T18 |
| Full regression coverage of `isHost` read sites after migration | |

## Tasks / Subtasks

- [x] **Task 1: Shared types — `HOST_PROMOTED` ResolvedAction + exhaustive switch fixes** (AC: 2, 16)
  - [x] 1.1 Add `HOST_PROMOTED` discriminant to `ResolvedAction` in [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts).
  - [x] 1.2 Export from `packages/shared/src/index.ts` if not already re-exported via the union.
  - [x] 1.3 Run `pnpm run typecheck`; fix every exhaustive `switch` on `ResolvedAction.type`: `mapPlayerGameViewToGameTable.ts`, `useRoomConnection.ts`, test helpers, `PlayerGameViewBridgeShowcase.vue`, any dev routes.

- [x] **Task 2: Server — `migrateHost` helper** (AC: 1, 14)
  - [x] 2.1 Create [`packages/server/src/rooms/host-migration.ts`](../../packages/server/src/rooms/host-migration.ts) per AC1. Top-of-file header per AC17.
  - [x] 2.2 Export `migrateHost(room, logger, opts?)`. Pure state mutation; no broadcast.
  - [x] 2.3 Use `SEATS` from `packages/shared/src/constants.ts` for counterclockwise iteration. Start from position-after-current-host-wind; wrap once.
  - [x] 2.4 Candidate gate: `connected === true && !deadSeatPlayerIds.has && !departedPlayerIds.has && !excludePlayerIds?.has && playerId !== currentHost.playerId`.
  - [x] 2.5 Unit tests in new [`packages/server/src/rooms/host-migration.test.ts`](../../packages/server/src/rooms/host-migration.test.ts): AC1b happy path, skip dead-seat, skip departed, skip disconnected, hostless return, `excludePlayerIds` honored.

- [x] **Task 3: Server — grace-expiry trigger** (AC: 3, 10, 14)
  - [x] 3.1 In [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `registerDisconnectHandler` grace-expiry callback: capture `wasHost = room.players.get(playerId)?.isHost ?? false` **before** `releaseSeat`. After `releaseSeat`, if `wasHost`, call `migrateHost` and broadcast `HOST_PROMOTED` before the final `broadcastStateToRoom`.
  - [x] 3.2 Import `migrateHost` from `../rooms/host-migration`.
  - [x] 3.3 Integration test in [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts): T1, T2.

- [x] **Task 4: Server — intentional-departure triggers** (AC: 4, 10, 14)
  - [x] 4.1 In [`leave-handler.ts`](../../packages/server/src/websocket/leave-handler.ts) `markPlayerDeparted` lobby branch (around the existing `releaseSeat(room, playerId)` lobby path at ~line 156): capture `wasHost` before release, call `migrateHost` + broadcast `HOST_PROMOTED` after release, before lobby `STATE_UPDATE`.
  - [x] 4.2 In `convertToDeadSeat`: capture `wasHost` before adding to `deadSeatPlayerIds`. After `deadSeatPlayerIds.add` and `PLAYER_CONVERTED_TO_DEAD_SEAT` broadcast, if `wasHost`, call `migrateHost(room, logger, { excludePlayerIds: new Set([playerId]) })` and broadcast `HOST_PROMOTED` before `syncTurnTimer`.
  - [x] 4.3 In `autoEndGameOnDeparture`: capture `wasHost` for each departed player BEFORE the `releaseSeat` loop. After the loop, if any released player was host, call `migrateHost` + broadcast `HOST_PROMOTED` BEFORE the `GAME_ABANDONED` broadcast (per AC10).
  - [x] 4.4 Scoreboard-phase `LEAVE_ROOM` branch (4B.5 T20): mirror the lobby pattern — `releaseSeat` → `migrateHost` → `HOST_PROMOTED` → `PLAYER_DEPARTED`.
  - [x] 4.5 Update 4B.5 tests T12 and T13 in [`leave-handler.test.ts`](../../packages/server/src/websocket/leave-handler.test.ts) to assert migration runs (replace the "known gap" assertions with the new behavior). Add T3, T4, T5, T6.

- [x] **Task 5: Server — hostless-room first-reconnect promotion** (AC: 5, 6, 10, 14)
  - [x] 5.1 In [`join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) `attachToExistingSeat` (after the successful attach, before the final state broadcast): check `if (![...room.players.values()].some((p) => p.isHost))`. If true, set `player.isHost = true` and broadcast `HOST_PROMOTED { previousHostId: null, newHostId: player.playerId, newHostName: player.displayName }`.
  - [x] 5.2 In `handleJoinRoom` tokenless / fresh-join path: same check after the new player is added to `room.players` (but only if the room is mid-game or non-empty; the existing `isHost = room.players.size === 0` already handles the first-player case). Keep the new branch guarded to avoid double-promotion.
  - [x] 5.3 Integration tests: T7, T8. Skip T9 (5-minute cleanup is existing `abandoned-timeout` behavior; regression-only).

- [x] **Task 6: Server — regression: `handleStartGameAction` post-migration** (AC: 7, 12, 14)
  - [x] 6.1 Add test in [`action-handler.test.ts`](../../packages/server/src/websocket/action-handler.test.ts): migrate host → old host sends `START_GAME` → rejected with `NOT_HOST` → new host sends `START_GAME` → accepted. Covers T13, T14.
  - [x] 6.2 Verify `handleStartGameAction` does NOT reset `isHost` across rematches (T18).

- [x] **Task 7: Client — `useRoomConnection` `HOST_PROMOTED` handler + conditional toast** (AC: 8, 13, 16)
  - [x] 7.1 In [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts), add `HOST_PROMOTED` to the resolved-action `switch`. On receive: if current phase is `"lobby"` or `"scoreboard"` (or `lobbyState.value !== null && playerGameView.value === null`), push toast `"${newHostName} is now the host"`. Otherwise suppress.
  - [x] 7.2 Reuse the existing toast pipeline (same as `TURN_SKIPPED_DEAD_SEAT` / `PLAYER_DEPARTED` toasts from 4B.5).
  - [x] 7.3 `data-testid="host-promoted-toast"` on the toast DOM.

- [x] **Task 8: Client — tests** (AC: 13, 16)
  - [x] 8.1 Extend `useRoomConnection.departure.test.ts` (or a new `useRoomConnection.host-migration.test.ts`): feed synthetic `HOST_PROMOTED` resolvedAction with `gamePhase = "lobby"` → assert toast shown. With `gamePhase = "play"` → assert toast NOT shown (T15, T16).
  - [x] 8.2 Feed synthetic `STATE_UPDATE` with updated `isHost` flag → assert derived `isCurrentPlayerHost` ref updates.
  - [x] 8.3 Update any fixtures in `mapPlayerGameViewToGameTable.test.ts` or `PlayerGameViewBridgeShowcase.vue` touched by the new `ResolvedAction` discriminant.

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] AC13 client deviation: `HOST_PROMOTED` toast lives in `GameTable.vue`/`RoomView.vue` rather than the `useRoomConnection.ts` resolved-action switch. Functional parity achieved and documented in Change Log; consider consolidating into `useRoomConnection` for consistency with the 4B.5 toast pipeline pattern. [packages/client/src/components/game/GameTable.vue, packages/client/src/views/RoomView.vue]
- [ ] [AI-Review][LOW] `GameTable.vue` host-promoted toast includes `"rematch"` phase in addition to `"lobby"`/`"scoreboard"` from the spec. Benign extension — confirm with design whether rematch-phase toast is desired or trim to spec. [packages/client/src/components/game/GameTable.vue:634]
- [ ] [AI-Review][LOW] `migrateHost` candidate iteration starts at east whenever `currentHost` is null in `room.players` (which is always true for lobby leave + grace expiry callers, since `releaseSeat` runs first). Result is still deterministic and correct for all T1–T11, but the "start from seat after old host's wind" intent in AC1(b) is only realized via the fallback clause. Consider passing the departing host's wind explicitly via `opts` for clarity. [packages/server/src/rooms/host-migration.ts:29]

- [x] **Task 9: Regression gate + finalize** (AC: 16, 17)
  - [x] 9.1 `pnpm test` (all packages) — green. Explicit focus: 4B.5 T12 and T13 tests updated; 4B.3 pause tests unchanged; 4B.2 grace-expiry fallbacks still run before migration.
  - [x] 9.2 `pnpm run typecheck` — green. Watch for `ResolvedAction` exhaustiveness breakage.
  - [x] 9.3 `vp lint` — green.
  - [x] 9.4 Update 4B.5 dev notes / `leave-handler.ts` header to remove the "host migration deferred to 4B.6" gap notes and point to `host-migration.ts`.
  - [x] 9.5 Update File List with every touched file.
  - [x] 9.6 Update `sprint-status.yaml`: `4b-6-host-migration` → **review** → **done** after code review.

## Dev Notes

### Epic & requirements traceability

- [`epics.md`](../planning-artifacts/epics.md#L2796) — Story **4B.6** (FR98). Acceptance criteria explicitly spell out: 30-second grace period trigger, counterclockwise seat order, `HOST_PROMOTED` resolved action + brief toast, capability parity, no role-bouncing on original-host reconnect, phase-specific UI (silent mid-game, visible lobby/scoreboard), 5-minute all-disconnected cleanup.
- [`gdd.md`](../planning-artifacts/gdd.md) — "Host migration" pattern: deterministic next-seat promotion, no voting, no manual transfer.
- Builds on 4B.1 reconnection backbone (grace timers), 4B.2 grace-expiry helpers (capture `wasHost` before `releaseSeat`), 4B.3 pause flow (unaffected — no `releaseSeat` during pause), 4B.5 departure-vote outcomes (closes T12 and T13 gaps).

### Infrastructure already in place (do not re-build)

| Capability | Location | Notes |
|---|---|---|
| `PlayerInfo.isHost: boolean` | [`room.ts:30`](../../packages/server/src/rooms/room.ts) | Already on `PlayerInfo`. Migration flips this flag. |
| `PlayerPublicInfo.isHost` propagation via `buildPlayerView` | [`state-broadcaster.ts:79`](../../packages/server/src/websocket/state-broadcaster.ts) | Flows through existing full-state pipeline. No new field. |
| `handleStartGameAction` host gate | [`action-handler.ts:436`](../../packages/server/src/websocket/action-handler.ts) | Uses `player.isHost`. Unchanged. |
| Grace-expiry → `releaseSeat` flow | [`join-handler.ts:300`](../../packages/server/src/websocket/join-handler.ts) | Add `wasHost` capture + `migrateHost` call after `releaseSeat`. |
| `releaseSeat(room, playerId)` | [`seat-release.ts`](../../packages/server/src/rooms/seat-release.ts) | Drops player from all room maps. Call BEFORE migration so the departed player is not a candidate. |
| `SEATS` counterclockwise order | [`constants.ts`](../../packages/shared/src/constants.ts) | East → South → West → North. Use for candidate iteration. |
| `broadcastStateToRoom(room, undefined, resolvedAction)` | [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) | Room-level broadcast for non-engine resolved actions. All new `HOST_PROMOTED` broadcasts go through this. |
| `abandoned-timeout` / `disconnect-timeout` lifecycle timers (5-min all-disconnected cleanup) | [`room-lifecycle.ts`](../../packages/server/src/rooms/room-lifecycle.ts) | Unchanged. The 5-min window in the epic AC maps to this. |
| 4B.5 `convertToDeadSeat` / `autoEndGameOnDeparture` / lobby+scoreboard leave branches | [`leave-handler.ts`](../../packages/server/src/websocket/leave-handler.ts) | Hook migration into each. Capture `wasHost` before state mutation. |
| Exhaustive `ResolvedAction` switch sites from 4B.4/4B.5 | Client composables, test helpers, dev showcase | Pattern established — grep, fix each. |

**Bottom line:** 4B.6 adds: 1 new server helper module (`host-migration.ts`), 1 new `ResolvedAction` discriminant (`HOST_PROMOTED`), and **no** new protocol messages, no new `Room` fields, no new `PlayerGameView` fields, no new lifecycle timers. The `isHost` flag is the entire migration state. All triggers hook into existing flows at the exact moment the old host's seat is being released or their role is becoming invalid.

### Architecture compliance

| Topic | Rule |
|---|---|
| **Engine purity** | `GameState` untouched. Migration is room-level metadata. |
| **Server authority** | Client never self-promotes. Every migration decision is server-side. Client observes `isHost` via the full-state broadcast. |
| **Validate-then-mutate** | `migrateHost` picks a candidate via read-only iteration, *then* mutates both `isHost` flags atomically. No partial state. |
| **Consolidated broadcast fan-out** | `HOST_PROMOTED` uses `broadcastStateToRoom`, not raw `ws.send`. |
| **Single source of post-state sequencing** | `HOST_PROMOTED` is a room-level resolvedAction; does not route through `sendPostStateSequence`. |
| **Composition API + `<script setup lang="ts">`** | No new client components; toast reuses existing pipeline. |
| **Imports** | Tests: `vite-plus/test`; app: `vite-plus`. |

### Anti-patterns (do not ship)

- **Auto-promoting the old host back on reconnect.** Epic AC explicitly forbids this: "the original host reconnects after migration Then they rejoin as a regular player — host role does NOT automatically return (prevents role-bouncing on flaky connections)". Once migrated, stay migrated. AC5 hostless-promotion only fires when NO player has `isHost`, which is not the case after a successful migration.
- **Migrating during a 4B.3 pause.** Pause does not release seats — everyone's seat is still in `room.players`. Migration only runs when a seat is being released (grace-expiry, lobby leave, departure vote outcome, auto-end). Do not add a pause-based migration trigger.
- **Picking a dead-seat or departed player as the new host.** `migrateHost` must skip them. Dead-seat players cannot take actions (4B.5 `DEAD_SEAT` gate) and would immediately make the room unable to start a rematch.
- **Broadcasting `HOST_PROMOTED` when no migration happened** (e.g. old host was the only host candidate and also the one who just left — hostless). Only broadcast when `newHostId !== null`. Hostless state is logged, not broadcast.
- **Mutating `isHost` from the client.** Client never writes `isHost`; it only reads it from `PlayerPublicInfo`. The toast and any host-only UI affordances derive from the server-authoritative flag.
- **Clearing `isHost` in `handleStartGameAction` or `resetTurnTimerStateOnGameEnd`.** Host persists across rematches.
- **Running `migrateHost` BEFORE `releaseSeat` in grace-expiry.** The helper would still include the departing player as a candidate (they're still in `room.players`) and could "migrate" host to themselves. Always release first, then migrate.
- **Running `migrateHost` AFTER `GAME_ABANDONED` in auto-end.** Scoreboard UI needs the new host in its first render so "Play Again" is immediately tappable. Order: `releaseSeat → migrateHost → HOST_PROMOTED → GAME_ABANDONED`.
- **Adding a new timer for the "30-second grace period" in the epic AC.** That's the existing grace period; no new timer.
- **Voting on host migration.** Deterministic — next-counterclockwise-connected-non-dead-non-departed wins. No vote, no prompt, no confirmation.
- **Relying on `gs.currentTurn` for migration order.** Host migration is room-level, not turn-level. Use `SEATS` directly from the old host's wind.
- **Forgetting to update the 4B.5 T12/T13 tests.** They currently document the gap; now they must assert the fix.

### Implementation edge cases

- **Host's grace timer fires while the room is paused (4B.3).** Pause does not cancel grace timers in the 4B.3 design — verify in `pause-handlers.ts` / `join-handler.ts`. If grace fires during pause, `releaseSeat` + `migrateHost` runs as normal. On resume, the new host state is already in place. Write a regression test if this path exists.
- **Simultaneous host migration and departure vote.** If the host disconnects and a departure vote starts for a different player concurrently, the vote resolves independently. Migration runs when the host's grace expires. Two independent flows.
- **Host leaves mid-vote targeting themselves.** Impossible — the departure vote is for the *leaving* player, not the host specifically. The leaving player IS the vote target. Handled by AC4b (dead_seat outcome: migrate after conversion) or AC4c (end_game outcome: migrate in auto-end).
- **Host leaves in lobby with only 1 other player.** Migration still runs; the 1 remaining player becomes host. Lobby continues; other player can invite more players or leave.
- **Host leaves in lobby with 0 other players.** Room is now empty. `migrateHost` returns `{ newHostId: null }`. `releaseSeat` already handled player removal. Room cleanup is handled by existing `abandoned-timeout` / empty-room logic. Verify this path doesn't leave orphaned state.
- **All 4 players disconnected; hostless.** AC5: first reconnect promotes themselves. The promotion broadcast has `previousHostId: null` to signal "recovered from hostless state" to the client (which can show a different toast copy if desired, e.g. "You are now the host").
- **`migrateHost` candidate iteration when current host's wind is unknown** (e.g. the helper is called after `releaseSeat` removed the player). Cache the wind BEFORE releaseSeat in the caller, OR have the helper start iteration from East and just pick the first eligible player (deterministic but not strictly "next after the departing host"). **Recommended:** caller passes the departing host's wind explicitly via opts, or the helper falls back to starting at East when no current host exists in `room.players`. Implementer's call — document in `host-migration.ts`.
- **State broadcaster includes `hostAuditLog` only for the host** ([`state-broadcaster.ts:191`](../../packages/server/src/websocket/state-broadcaster.ts)). After migration, the new host receives the audit log on their next `STATE_UPDATE`. Verify in a state-broadcaster test.

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Shared types | [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) (`HOST_PROMOTED` discriminant) |
| Server — core | new [`packages/server/src/rooms/host-migration.ts`](../../packages/server/src/rooms/host-migration.ts), [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) (grace-expiry trigger + hostless-recovery in `attachToExistingSeat` / `handleJoinRoom`), [`packages/server/src/websocket/leave-handler.ts`](../../packages/server/src/websocket/leave-handler.ts) (lobby + convertToDeadSeat + autoEndGameOnDeparture + scoreboard triggers) |
| Server — tests | new [`packages/server/src/rooms/host-migration.test.ts`](../../packages/server/src/rooms/host-migration.test.ts), extended [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts), [`leave-handler.test.ts`](../../packages/server/src/websocket/leave-handler.test.ts) (T12/T13 update + new rows), [`action-handler.test.ts`](../../packages/server/src/websocket/action-handler.test.ts) (post-migration `START_GAME` gate), [`state-broadcaster.test.ts`](../../packages/server/src/websocket/state-broadcaster.test.ts) (optional: host audit log after migration) |
| Client — state | [`packages/client/src/composables/useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) (`HOST_PROMOTED` arm + conditional toast), [`packages/client/src/composables/mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) (exhaustive switch fix if needed) |
| Client — tests | extended `useRoomConnection.*.test.ts` (new `HOST_PROMOTED` block), `mapPlayerGameViewToGameTable.test.ts` (if switch changes), `PlayerGameViewBridgeShowcase.vue` (fixture update for new discriminant) |

### Cross-session intelligence (claude-mem)

Recent observations (2026-04-05) confirm:

- **Story 4B.5 (obs 837–848, S309)** just shipped the departure-vote dead-seat and auto-end flows and explicitly deferred host migration with documented T12 and T13 "known gap" assertions in `leave-handler.test.ts`. 4B.6 closes both gaps. Update those two tests FIRST to lock in the new behavior, then implement `migrateHost` and the triggers.
- **Story 4B.4 (obs 811–836)** established the AFK vote + dead-seat precedent and the `ResolvedAction` exhaustive-switch breakage playbook. 4B.6's single new discriminant will follow the same ritual: add to `game-state.ts`, run `pnpm run typecheck`, fix every site.
- **Story 4B.3 (obs 799–806, S300–S304)** established pause semantics. Migration does NOT happen during pause — `releaseSeat` does not run. Verify in the pause-handlers test suite that host stays host across pause/resume (regression, not new coverage).
- **Story 4B.2 (retro 4b1-review-1/2)** consolidated broadcast fan-out. Every `HOST_PROMOTED` broadcast routes through `broadcastStateToRoom`, not raw `ws.send`.
- **Epic 6A retro follow-through `6a-retro-1`** (transition scenarios in story specs) is why T1–T18 are enumerated above. Every row must have at least one test before code review signs off.
- **4B.5 retro candidate:** 4B.5 dev notes explicitly named "host-role reassignment is explicitly deferred to Story 4B.6" and "if vote passes to dead_seat, E is dead-seated but still holds the host flag. Rematch / settings are host-gated and will fail until 4B.6 host migration ships." This story is the direct follow-through. The leave-handler top-of-file header added in 4B.5 Task 3.1 should be updated in Task 9.4 to reflect the closure.

### Git intelligence (recent commits)

```
fdad24f feat: player departure, dead seat, and departure vote (Story 4B.5)
556c143 feat: add Story 4B.5 shared types for player departure and dead seat
c5a5ade feat: add turn timeout and AFK escalation for multiplayer Mahjong   (4B.4)
df5f720 feat: add simultaneous-disconnect game pause for multiplayer Mahjong (4B.3)
93f9244 feat: implement phase-specific reconnection fallbacks for multiplayer (4B.2)
```

4B.5's commit is load-bearing: its `leave-handler.ts` is the primary host site for AC4 triggers. Its `T12` and `T13` tests are the primary regressions to update.

## Project context reference

See [`_bmad-output/project-context.md`](../project-context.md) and [`_bmad-output/planning-artifacts/game-architecture.md`](../planning-artifacts/game-architecture.md) (Decision 7 — Reconnection Strategy, host-authoritative actions).

## File List

- `packages/shared/src/types/game-state.ts` — `HOST_PROMOTED` on `ResolvedAction`
- `packages/server/src/rooms/host-migration.ts` — `migrateHost` helper
- `packages/server/src/rooms/host-migration.test.ts` — unit tests
- `packages/server/src/websocket/join-handler.ts` — grace expiry + hostless promotion (attach + join)
- `packages/server/src/websocket/join-handler.test.ts` — grace host migration + `waitForResolvedActionType`
- `packages/server/src/websocket/leave-handler.ts` — lobby/scoreboard leave, `convertToDeadSeat`, header
- `packages/server/src/websocket/leave-handler.test.ts` — T4/T7/T12/T20/T23 + race-safe listener ordering
- `packages/server/src/websocket/turn-timer.ts` — `autoEndGameOnDeparture` host migration before `GAME_ABANDONED`
- `packages/server/src/websocket/action-handler.test.ts` — post-`migrateHost` `START_GAME` gate
- `packages/client/src/components/game/GameTable.vue` — `HOST_PROMOTED` toast (lobby/scoreboard/rematch)
- `packages/client/src/components/game/GameTable.test.ts` — toast show/suppress tests
- `packages/client/src/views/RoomView.vue` — lobby `HOST_PROMOTED` toast
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4b-6-host-migration` → review

## Change Log

- 2026-04-05: Story created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-04-05: Implementation complete — server `migrateHost`, all triggers, `HOST_PROMOTED` plumbing, client toasts (`GameTable` + `RoomView` lobby; mid-game suppressed). Client handling follows existing resolved-action toast pattern (not `useRoomConnection` switch). Regression: `pnpm test`, `pnpm run typecheck`, `vp lint`. Sprint status → review.
