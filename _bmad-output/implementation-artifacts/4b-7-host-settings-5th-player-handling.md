# Story 4B.7: Host Settings & 5th Player Handling

Status: done

<!-- Epic 4B story 7 (final). Three concerns under one story per epics.md: (a) a host-editable between-games settings panel (timer mode, Joker rules, dealing style) with all-player visibility + change-broadcast toasts, (b) a 5th-visitor "table is full" page with a stub spectator-mode entry point, (c) server-side REMATCH preconditions validation (host auth, 4 connected seats, phase==scoreboard, auto-fallback to lobby if a seat is empty between games). Out of scope: dealing-style animation itself (Epic 5), scoreboard / rematch button UI (Story 5B.4), full spectator game view (post-MVP per FR3 note), mid-game setting changes (explicitly forbidden by FR4). -->

## Story

As a **host player**,
I want **to configure game settings (timer mode, Joker rules, dealing style) between games with changes broadcast to all players, for a 5th visitor to see a friendly "table is full" page instead of a failed WebSocket connect, and for the server to validate rematch preconditions before a new game starts**,
so that **I can customize the game for my group, extra visitors are not confused by a broken connection, and rematch starts never enter an invalid state when a player has left between games (FR3, FR4, FR5, FR6, FR10, FR11, FR12)**.

## Acceptance Criteria

1. **AC1 — `RoomSettings` shared type.** Add a new type in [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) (or a new dedicated `room-settings.ts` under `packages/shared/src/types/` if the file is getting crowded — keep the barrel export in `packages/shared/src/index.ts` consistent):
   ```ts
   export type TimerMode = "timed" | "none";
   export type DealingStyle = "instant" | "animated";
   export interface RoomSettings {
     readonly timerMode: TimerMode;
     readonly turnDurationMs: number; // 15_000..30_000 inclusive when timerMode === "timed"
     readonly jokerRulesMode: JokerRulesMode; // existing — unified under settings
     readonly dealingStyle: DealingStyle;
   }
   export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
     timerMode: "timed",
     turnDurationMs: 20_000,
     jokerRulesMode: "standard",
     dealingStyle: "instant",
   };
   export const MIN_TURN_DURATION_MS = 15_000;
   export const MAX_TURN_DURATION_MS = 30_000;
   ```
   `jokerRulesMode` is already carried by `Room` (server) and `LobbyState`/`PlayerGameView`/`SpectatorGameView` (shared). The new fields join it rather than replacing it — do **not** remove the top-level `jokerRulesMode` field from existing state shapes (that would break every existing caller). Instead, **add** a `settings: RoomSettings` field to `LobbyState` and `PlayerGameView` next to the existing `jokerRulesMode` and populate both from the same source for one release; follow-up cleanup is deferred.

2. **AC2 — `Room.settings` on the server.** Add `settings: RoomSettings` to [`packages/server/src/rooms/room.ts`](../../packages/server/src/rooms/room.ts). Initialize in `RoomManager.createRoom` to `{ ...DEFAULT_ROOM_SETTINGS }`. The existing `room.jokerRulesMode` and `room.turnTimerConfig` fields remain authoritative for now and are kept **in sync** with `room.settings` — `settings` is the canonical shape for client-visible settings, the split fields are the internal engine/timer couplings that `syncTurnTimer` and `handleStartGameAction` already read. On every `settings` mutation: also update `room.jokerRulesMode = settings.jokerRulesMode` and `room.turnTimerConfig = { mode: settings.timerMode, durationMs: settings.turnDurationMs }` so the existing turn-timer plumbing (4B.4) and START_GAME handler keep working unchanged.

3. **AC3 — `SET_ROOM_SETTINGS` client→server message.** Add to [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts):
   ```ts
   export interface SetRoomSettingsMessage {
     version: typeof PROTOCOL_VERSION;
     type: "SET_ROOM_SETTINGS";
     // Partial — the host can update any subset; server merges over current settings
     timerMode?: TimerMode;
     turnDurationMs?: number;
     jokerRulesMode?: JokerRulesMode;
     dealingStyle?: DealingStyle;
   }
   ```
   Also add a server→client resolved action in the `ResolvedAction` union (`game-state.ts`):
   ```ts
   | {
       readonly type: "ROOM_SETTINGS_CHANGED";
       readonly changedBy: string;            // host playerId
       readonly changedByName: string;
       readonly previous: RoomSettings;
       readonly next: RoomSettings;
       readonly changedKeys: readonly (keyof RoomSettings)[];
     }
   ```
   This is a breaking addition to `ResolvedAction` — every exhaustive switch must be updated (same discipline as 4B.4/4B.5/4B.6). Run `pnpm run typecheck` after adding the discriminant; at minimum fix: `mapPlayerGameViewToGameTable.ts`, the `useRoomConnection.ts` resolved-action router, server test helpers, `PlayerGameViewBridgeShowcase.vue` fixture, any dev-showcase routes. The new `SET_ROOM_SETTINGS` client message must be added to the `message-handler.ts` dispatch alongside the existing `SET_JOKER_RULES` handler (see AC4 below).

4. **AC4 — `handleSetRoomSettings` server handler.** Add to [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) (co-located with the existing `handleSetJokerRules` — same policy surface, same file). Dispatch from [`message-handler.ts`](../../packages/server/src/websocket/message-handler.ts). Behavior:
   - **Host gate:** if `!room.players.get(playerId)?.isHost`, send `ERROR { code: "NOT_HOST", message: "Only the host can change room settings" }` and return.
   - **Between-games gate (FR4):** if `room.gameState !== null && room.gameState.gamePhase !== "scoreboard" && room.gameState.gamePhase !== "rematch"`, send `ERROR { code: "GAME_IN_PROGRESS", message: "Settings can only change between games" }` and return. Mirror the `handleSetJokerRules` check but allow scoreboard/rematch phases (the epic AC "between games (lobby or scoreboard phase)" explicitly permits scoreboard edits; the current `handleSetJokerRules` is stricter — lobby only — and must be loosened to scoreboard/rematch as part of this story so both handlers agree). Update `handleSetJokerRules` to share a single `isBetweenGames(room)` helper.
   - **Validation:** per-field, reject with `ERROR { code: "INVALID_SETTINGS", message: "<field>: <reason>" }` on invalid values. Rules:
     - `timerMode`: must be `"timed"` or `"none"`.
     - `turnDurationMs`: required-if-`timerMode === "timed"`, finite integer, `>= MIN_TURN_DURATION_MS && <= MAX_TURN_DURATION_MS`. When `timerMode === "none"`, any provided value is ignored and normalized to the current `settings.turnDurationMs` (keep last-known for when timer is re-enabled).
     - `jokerRulesMode`: must be `"standard"` or `"simplified"`.
     - `dealingStyle`: must be `"instant"` or `"animated"`.
   - **Merge + broadcast:** build `next = { ...room.settings, ...validated }`. If `next` deep-equals `room.settings`, no-op (do **not** broadcast a no-op). Otherwise:
     1. Compute `changedKeys`: only the keys where `previous[k] !== next[k]`.
     2. `room.settings = next`.
     3. Sync the split fields per AC2 (`room.jokerRulesMode`, `room.turnTimerConfig`).
     4. **Timer-mode flip side-effects (critical — do not skip):**
        - If `timerMode` flipped from `"timed"` → `"none"`: call `cancelTurnTimer(room, logger)`. Clear `room.consecutiveTurnTimeouts`. Clear `room.afkVoteCooldownPlayerIds`. If `room.afkVoteState !== null`, cancel `"afk-vote-timeout"` lifecycle timer and set `afkVoteState = null` (a mid-vote flip to no-timer cancels the AFK vote in progress; the target is not dead-seated as a side-effect).
        - If `timerMode` flipped from `"none"` → `"timed"`: do NOT arm a timer now — between-games means the game has already ended. The next `handleStartGameAction` / `syncTurnTimer` after a rematch will arm naturally.
        - Rationale: the between-games gate (AC4) means `syncTurnTimer` is never running when settings flip. But mid-game re-entry via a stray call path would be a bug; the cancel is defensive.
     5. Log: `logger.info({ roomCode, changedBy: playerId, changedKeys, previous, next }, "Room settings updated")`.
     6. Broadcast via `broadcastStateToRoom(room, undefined, { type: "ROOM_SETTINGS_CHANGED", changedBy: playerId, changedByName: player.displayName, previous, next, changedKeys })`. The next full-state broadcast carries the updated `settings` to all connected clients and any spectators. All clients receive the same resolved action regardless of host / non-host.
   - **Existing `SET_JOKER_RULES` path is kept for backward compatibility** but now funnels into the same validation + merge + broadcast pipeline — treat it as a shortcut for `SET_ROOM_SETTINGS { jokerRulesMode }`. The existing `handleSetJokerRules` body is refactored to delegate to `handleSetRoomSettings` internally (or to a shared `applyRoomSettingsUpdate(room, patch, logger)` helper). Preserve existing error codes (`NOT_HOST`, `GAME_IN_PROGRESS`, `INVALID_JOKER_RULES`) — existing 4A/3C tests depend on them.

5. **AC5 — `LobbyState.settings` + `PlayerGameView.settings` propagation.** Update `buildPlayerView` / `buildLobbyState` in [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) to include `settings: { ...room.settings }` on both shapes. The existing top-level `jokerRulesMode` field on both shapes continues to be emitted (backward compat), sourced from `room.settings.jokerRulesMode`. No change to `SpectatorGameView` yet beyond adding `settings` (same shape). All three state shapes in `protocol.ts` gain a required `readonly settings: RoomSettings` field — this is a breaking addition to the protocol, same as prior Epic 4B story additions — update every fixture in client and server tests.

6. **AC6 — Client: settings panel (read-only for non-hosts, editable for host).** New component [`packages/client/src/components/game/RoomSettingsPanel.vue`](../../packages/client/src/components/game/RoomSettingsPanel.vue) — `<script setup lang="ts">`. Props:
   ```ts
   defineProps<{
     settings: RoomSettings;
     canEdit: boolean;        // host && gamePhase ∈ { lobby, scoreboard, rematch }
     phase: GamePhase | "lobby";
   }>();
   const emit = defineEmits<{
     (e: "change", patch: Partial<RoomSettings>): void;
   }>();
   ```
   - **Collapsible** by default (`<details>` or a `BaseButton`-triggered accordion) — the panel must be accessible to all players at any time (FR6), not only in the lobby.
   - **Fields rendered:** Timer mode (select: "timed" / "no timer"), Turn duration (number input, gated disabled when `timerMode === "none"`, min 15 / max 30 seconds, UI uses seconds, converts to ms on emit), Joker rules (select: standard / simplified), Dealing style (select: instant / animated traditional).
   - **Edit gating:** every field is `disabled` unless `canEdit`. Non-hosts and hosts-mid-game see a read-only summary. A small helper line shows "Settings are locked during play" when `canEdit === false && phase !== "lobby"`.
   - **Emit strategy:** debounced on text input (duration), immediate on selects. Each change emits a `Partial<RoomSettings>` with ONLY the changed key, routed to `conn.sendSetRoomSettings(patch)` in `RoomView.vue`.
   - **`data-testid`s:** `room-settings-panel`, `room-settings-timer-mode`, `room-settings-turn-duration`, `room-settings-joker-rules`, `room-settings-dealing-style`, `room-settings-locked-note`.
   - **Placement:** in lobby view (`RoomView.vue` — below the player list, above the Start button). In play/scoreboard view (`GameTable.vue`), render the collapsible panel in the header or action zone — keep the trigger out of critical-action real estate. Choose the same anchor as the existing joker-rules select so desktop/tablet layouts remain stable.

7. **AC7 — Client: `ROOM_SETTINGS_CHANGED` toast.** In [`useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) resolved-action router (or via `GameTable.vue`/`RoomView.vue` watchers, following the 4B.6 pattern — prefer the composable so tests can drive it uniformly via the resolved-action stream, but if the existing 4B.5/4B.6 toasts live in components for consistency, match that): push a toast per changed key with copy following the epic AC "Host changed [setting] to [value]" (FR5):
   - Build a single toast with a short summary: one changed key → `"Host changed ${humanLabel(key)} to ${humanValue(next[key])}"`; multiple changed keys → `"Host updated room settings (${changedKeys.length} changes)"` and the tooltip/long copy lists each. Human labels: `timerMode` → "timer mode", `turnDurationMs` → "turn timer", `jokerRulesMode` → "Joker rules", `dealingStyle` → "dealing style". Human values: `timed` → `${Math.round(turnDurationMs/1000)}s`, `none` → "no timer", `standard`/`simplified` → capitalized, `instant`/`animated` → capitalized.
   - Toast `data-testid="room-settings-changed-toast"`. Auto-dismiss 4000ms (same as host-promoted toast).
   - The toast renders in **all phases** including play/charleston — epic AC says "all players see a brief toast notification" without phase restriction (this is the opposite of 4B.6's mid-game-suppressed host-promoted toast — settings toasts matter mid-game too because players need to know when the timer was disabled). Document the asymmetry in a code comment.
   - Do NOT show the toast to the player who made the change (the host) — the host already sees the panel update. Check against `localPlayerId`.

8. **AC8 — 5th visitor: "table is full" page.** When a new player navigates to `/room/:code` in [`RoomView.vue`](../../packages/client/src/views/RoomView.vue):
   - **Pre-connect status check:** before opening the WebSocket, call `GET ${getApiBaseUrl()}/api/rooms/:code/status`. Use `apiBaseUrl`'s existing helper (see `HomeView.vue:25`). If the response is `{ full: true }`, do **not** open a WebSocket — skip straight to the table-full view and clear the `hasRequestedConnect` flow. If `{ full: false }`, continue to the existing `conn.connect()` path.
   - **404 handling:** if the status call returns 404, show the existing "room not found" error path (falls through to the existing error banner).
   - **Network error:** if the status call errors (network, 5xx), show a generic "Could not reach the server" message and a retry button. Do NOT silently fall through to a failed WebSocket connect.
   - **Table-full view:** new scoped template block in `RoomView.vue` (or extracted to `TableFullView.vue` under `packages/client/src/components/room/TableFullView.vue` if `RoomView.vue` is getting unwieldy — branch on what is cleaner after Task 5). The view shows: branded heading ("This table is full"), a friendly one-liner explaining 4 players are already seated, a "Back to home" primary button, and a secondary "Watch as spectator" button (see AC9). `data-testid="table-full-view"`, `data-testid="table-full-back-home"`, `data-testid="table-full-spectate"`.
   - **URL preservation:** the room code remains in the URL so the visitor can refresh later once a seat opens. A refresh re-runs the status check.
   - **Race guard:** the status check is a hint, not a contract. If status says `full: false` but between the HTTP call and the WebSocket handshake a 4th player claims the last seat, the existing `ROOM_FULL` `ERROR` from `handleJoinRoom` ([`join-handler.ts:426`](../../packages/server/src/websocket/join-handler.ts)) still fires. The client must catch this specific error and pivot to the table-full view instead of showing a generic "Try again" prompt. Add a branch in the `handleMessage` error path for `code === "ROOM_FULL"` that sets an `isTableFull` flag.

9. **AC9 — Spectator mode stub.** MVP-gated scope — the epic AC explicitly calls for "spectator mode option... read-only view of the table with no racks visible" but the full `SpectatorGameView` rendering pipeline is post-MVP (per FR3 spectator flag already in `protocol.ts`). Ship a **minimum viable stub**:
   - Clicking "Watch as spectator" from the table-full view sets a `spectatorMode: true` query param and opens a spectator WebSocket path — **new server message type** `JOIN_SPECTATOR { roomCode }` that does NOT consume a seat. The server maintains `room.spectators: Map<string, WebSocket>` — **if this is too large a surface for one story, the acceptable minimum is:** client routes "Watch as spectator" to a static placeholder page (no WebSocket) that shows "Spectator mode coming soon" with a "Back to home" button. Choose the minimum path and explicitly document the choice.
   - **Decision rule:** if the dev reaches this AC and finds the WebSocket spectator plumbing (new `Room.spectators` map, new `JOIN_SPECTATOR` / `SPECTATOR_STATE` messages, new `buildSpectatorView` caller in `state-broadcaster.ts`, new auth model since no `JOIN_ROOM` token exists, etc.) exceeds ~300 LOC or introduces >5 test files, **ship the placeholder page** instead and file a follow-up story (`4B.8` or a post-MVP backlog item). The epic AC's intent (FR3) is that a 5th visitor is not confused — a clear placeholder satisfies that intent. The placeholder path is the default unless the dev is confident the full path fits cleanly.
   - **If the placeholder is shipped:** `data-testid="spectator-placeholder"`, "Spectator mode is coming soon — check back later." + "Back to home" button. Document the deferral in Task 5 completion notes + `sprint-status.yaml` (add a note: "4B.7 ships spectator stub; full spectator view deferred post-MVP").
   - **If the full path is shipped:** see out-of-story notes at the bottom of this spec for the sketch. Not recommended for this story.

10. **AC10 — REMATCH preconditions validation (server).** Add a new WebSocket message type in [`protocol.ts`](../../packages/shared/src/types/protocol.ts):
    ```ts
    export interface RematchMessage {
      version: typeof PROTOCOL_VERSION;
      type: "REMATCH";
    }
    ```
    Wire a dispatch case in [`message-handler.ts`](../../packages/server/src/websocket/message-handler.ts) → new `handleRematch(ws, room, playerId, logger, roomManager)` in [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) (alongside `handleStartGameAction` — same module, same error-code idiom). Preconditions (all server-side, in order):
    - **Host gate:** `player?.isHost` — else `ERROR { code: "NOT_HOST", message: "Only the host can start a rematch" }`.
    - **Phase gate:** `room.gameState !== null && (room.gameState.gamePhase === "scoreboard" || room.gameState.gamePhase === "rematch")` — else `ERROR { code: "NOT_BETWEEN_GAMES", message: "Rematch only available after a game ends" }`.
    - **Seat count:** `[...room.players.values()].filter((p) => p.connected).length === 4 && room.deadSeatPlayerIds.size === 0 && room.departedPlayerIds.size === 0`.
      - **If seat count < 4 (departure or disconnected-in-grace):** do NOT rematch. Instead, transition the room **back to lobby** per epic AC: `room.gameState = null` (the server-side "I am a lobby" indicator), broadcast `LobbyState` via `broadcastStateToRoom`, and emit a resolved action `{ type: "REMATCH_WAITING_FOR_PLAYERS", missingSeats: 4 - connectedPlayerCount }` so clients show "Waiting for a 4th player". Preserve `room.settings` and `room.jokerRulesMode` across this transition (settings persist; game state does not). Cancel any in-flight timers (turn, AFK vote, departure vote, social override) defensively — same cleanup ritual as `handleStartGameAction` success path at line 471–483.
      - **If seat count === 4:** delegate to `handleStartGameAction(ws, room, playerId, logger, roomManager)` — the existing flow already (a) validates host, (b) initializes lobby state via `createLobbyState()`, (c) runs engine `START_GAME` with `room.jokerRulesMode` (now sourced from `room.settings.jokerRulesMode`), (d) broadcasts the new game state + `GAME_STARTED` resolved action, (e) arms the turn timer. Per epic AC "dealer rotates counterclockwise for the new game (FR12)" — dealer rotation is **not** implemented in the current engine `START_GAME` (it always starts with east as dealer). **Scope decision:** dealer rotation is a Story 5B.4 responsibility (FR12 listed under 5B.4 rematch flow). For 4B.7 REMATCH, the first game after a rematch still starts with the canonical east-dealer order. Document the deferral in task notes and cross-reference 5B.4.
    - **Add `REMATCH_WAITING_FOR_PLAYERS` to the `ResolvedAction` union** (shared types) for the "returned to lobby" path; every exhaustive switch updates accordingly (same ritual as AC3).
    - **Success:** on a valid rematch with 4 seats, the flow is identical to a fresh `START_GAME` from the server's perspective — the existing engine `START_GAME` action handles game reset. The new handler is primarily a gate + phase-transition orchestrator.

11. **AC11 — Settings persist across rematches.** `handleStartGameAction` already does NOT touch `room.settings` / `room.jokerRulesMode` / `room.turnTimerConfig` — verify. Add a regression test: set non-default settings in lobby → start game → finish game → `REMATCH` → assert `room.settings` is unchanged and `room.gameState.jokerRulesMode` after the rematch matches `room.settings.jokerRulesMode`. Settings are sticky for the life of the room; only a new room creation resets them to defaults.

12. **AC12 — Mid-game attempt to change settings is rejected.** Add a server test and a client guard. The server handler (AC4) already rejects with `GAME_IN_PROGRESS`. The client panel (AC6) disables every field. Add a UX-level guard: even if a player crafts a raw message, the server is the source of truth — the test must drive the WebSocket directly (bypassing the UI) and assert the `GAME_IN_PROGRESS` error.

13. **AC13 — Host migration interaction.** When host migration (4B.6) fires, the new host inherits host-gated capabilities including settings edits. Add a regression test: 4 players → host migrates → new host sends `SET_ROOM_SETTINGS` → accepted + broadcast fires. Previously-host (now regular player) sends `SET_ROOM_SETTINGS` → rejected with `NOT_HOST`. Cross-reference AC12 of Story 4B.6 (host-gated `START_GAME` post-migration) — the same discipline applies to settings.

14. **AC14 — `getRoomStatus` phase reflects rematch-waiting state.** `RoomManager.getRoomStatus` currently returns `{ full, playerCount, phase }` where `phase = room.gameState?.gamePhase ?? "lobby"`. When the room has been reset to lobby via AC10 (REMATCH with missing seats → `gameState = null`), `phase` correctly resolves to `"lobby"`. Verify this with a test so a 5th visitor hitting `GET /api/rooms/:code/status` between games sees accurate phase info. No code change needed — this is a regression gate.

15. **AC15 — Test strategy.**
    - **Shared types:** [`packages/shared/src/types/game-state.test.ts`](../../packages/shared/src/types/game-state.test.ts) (or a new `room-settings.test.ts` if the file exists): `DEFAULT_ROOM_SETTINGS` shape assertion, `MIN_TURN_DURATION_MS < MAX_TURN_DURATION_MS`, `RoomSettings` type shape (`expectTypeOf` or a dummy conformance test).
    - **Server unit:** [`packages/server/src/websocket/join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts) — new `describe("SET_ROOM_SETTINGS")` block covering T1–T11 (see Transition Scenarios table). Extend the existing `SET_JOKER_RULES` suite to assert the refactored path still returns the same error codes and now permits scoreboard-phase edits.
    - **Server unit:** new [`packages/server/src/websocket/rematch-handler.test.ts`](../../packages/server/src/websocket/rematch-handler.test.ts) (or extend `action-handler.test.ts`) — REMATCH 4-seats happy path, REMATCH 3-seats → waiting-for-players, REMATCH from non-host, REMATCH mid-game, REMATCH from lobby (no game started yet), REMATCH after departure vote `end_game` outcome (phase should be scoreboard after `GAME_ABANDONED`; rematch with 3 seats → waiting-for-players; dead-seat players excluded from seat count).
    - **Server integration:** [`packages/server/src/http/routes.test.ts`](../../packages/server/src/http/routes.test.ts) — 4-player-full room returns `{ full: true }`; after a LEAVE_ROOM, returns `{ full: false }`.
    - **Server integration:** [`packages/server/src/rooms/room-manager.test.ts`](../../packages/server/src/rooms/room-manager.test.ts) — `createRoom` initializes `settings = DEFAULT_ROOM_SETTINGS`.
    - **Client unit:** new [`packages/client/src/components/game/RoomSettingsPanel.test.ts`](../../packages/client/src/components/game/RoomSettingsPanel.test.ts) — render host-editable, render non-host read-only, disabled-when-locked, turn-duration input disabled when timerMode=none, emit `change` with only the changed key.
    - **Client unit:** extend [`packages/client/src/components/game/GameTable.test.ts`](../../packages/client/src/components/game/GameTable.test.ts) — `ROOM_SETTINGS_CHANGED` toast shows for non-host, suppressed for the host who made the change.
    - **Client unit:** extend [`packages/client/src/composables/useRoomConnection.*.test.ts`](../../packages/client/src/composables/) — `sendSetRoomSettings` method sends a well-formed message; 5th-player status check pre-connect (mock fetch returning `{ full: true }` → never opens WebSocket).
    - **Client view test:** [`packages/client/src/views/RoomView.test.ts`](../../packages/client/src/views/RoomView.test.ts) (create if missing, or use an e2e-ish composition test) — status=full → renders `table-full-view` + does not call `conn.connect`; status=not-full → normal join flow; status=404 → error state; `ROOM_FULL` race-guard error → pivots to table-full view.

16. **AC16 — Transition scenarios.** Every row below is covered by at least one test. See table.

17. **AC17 — Regression gate.** `pnpm test && pnpm run typecheck && vp lint` pass from repo root. Critical regressions:
    - 4B.4 turn-timer tests still pass (`syncTurnTimer` continues to read `room.turnTimerConfig`, which is kept in sync with `room.settings` by the handler).
    - 4B.6 host migration tests still pass; new host inherits settings-edit capability (AC13).
    - Existing `SET_JOKER_RULES` test suite passes with the delegating refactor — same error codes, same broadcast shape.
    - 4A.3 `ROOM_FULL` 5th-player rejection test still passes and the client now pivots to `table-full-view` on that error.
    - `LobbyState` / `PlayerGameView` fixture files under `_bmad-output` or test helpers gain the new `settings` field — scan for direct object literals that build these shapes.
    - Existing `buildLobbyState` / `buildPlayerView` tests assert the new `settings` field is emitted.

18. **AC18 — Documentation.** Top-of-file header on any new module documenting triggers and invariants. Update [`packages/client/src/views/RoomView.vue`](../../packages/client/src/views/RoomView.vue) header comment (if present) to note the pre-connect status check. Add a `dev-notes.md` link in the story's `Change Log`. Update the epic 4B index in `_bmad-output/implementation-artifacts/sprint-status.yaml` on completion.

### Transition scenarios

| # | Scenario | Expected behavior | AC |
|---|----------|-------------------|----|
| T1 | Lobby, host toggles `timerMode: "timed" → "none"` | Server accepts; `room.settings.timerMode === "none"`; `room.turnTimerConfig.mode === "none"`; `ROOM_SETTINGS_CHANGED` broadcast with `changedKeys: ["timerMode"]`; every client STATE_UPDATE reflects new settings. | AC4, AC5, AC7, AC16 |
| T2 | Lobby, host sets `turnDurationMs: 25_000` | Server accepts; `room.turnTimerConfig.durationMs === 25_000`; broadcast fires. | AC4, AC7 |
| T3 | Lobby, host sets `turnDurationMs: 10_000` (below min) | Server rejects with `INVALID_SETTINGS`, `turnDurationMs` unchanged. | AC4 |
| T4 | Lobby, host sets `turnDurationMs: 40_000` (above max) | Server rejects with `INVALID_SETTINGS`. | AC4 |
| T5 | Lobby, host flips `jokerRulesMode: "standard" → "simplified"` via new `SET_ROOM_SETTINGS` | Server accepts; `room.jokerRulesMode === "simplified"`; next `START_GAME` passes simplified to the engine; 4B.4 existing `SET_JOKER_RULES` test still passes. | AC4, AC11 |
| T6 | Play phase, host attempts `SET_ROOM_SETTINGS { timerMode: "none" }` | Server rejects with `GAME_IN_PROGRESS`; turn timer continues running. | AC4, AC12 |
| T7 | Scoreboard phase, host sets `dealingStyle: "animated"` | Server accepts (scoreboard is between-games); broadcast fires; next rematch uses animated style (client reads setting). | AC4 |
| T8 | Non-host sends `SET_ROOM_SETTINGS` | Server rejects with `NOT_HOST`. | AC4 |
| T9 | Host migration fires (4B.6) → new host sends `SET_ROOM_SETTINGS` | New host accepted; old (demoted) host rejected with `NOT_HOST`. | AC13 |
| T10 | Mid-vote AFK (4B.4) while timer is active → host flips `timerMode: "timed" → "none"` (only possible in scoreboard/lobby since play-phase is blocked) | Guarded by AC4 between-games gate. Add a defensive unit test anyway: call the `applyRoomSettingsUpdate` helper directly in a forced mid-game state → expect the AFK vote to be cancelled + turn timer cleared (the defensive cleanup in AC4 step 4). | AC4 |
| T11 | Host flips `timerMode: "none" → "timed"` in scoreboard | Accepted; `room.turnTimerConfig.mode === "timed"`; no timer armed now (no active turn); broadcast fires. | AC4 |
| T12 | 5th visitor navigates to `/room/:code` of full room | Client fetches `/api/rooms/:code/status` → `{ full: true }`; does NOT open WebSocket; renders `table-full-view`. | AC8 |
| T13 | Visitor navigates; status=`{full: false}`, then between HTTP call and WS handshake a 4th player joins | Server sends `ERROR { code: "ROOM_FULL" }`; client catches, pivots to `table-full-view`. | AC8 race guard |
| T14 | Visitor on `table-full-view` clicks "Watch as spectator" (placeholder path) | Client routes to placeholder page with "Spectator mode coming soon". | AC9 |
| T15 | Visitor navigates to unknown room code | `GET /api/rooms/:code/status` returns 404 → client shows "room not found". | AC8 |
| T16 | Visitor navigates; API call errors (network) | Client shows "Could not reach the server" + Retry button. | AC8 |
| T17 | Scoreboard, host sends `REMATCH` with 4 connected seats | Delegates to `handleStartGameAction`; new game starts; `room.settings` unchanged; `jokerRulesMode` honored. | AC10, AC11 |
| T18 | Scoreboard, host sends `REMATCH` with 3 seats (one player left via LEAVE_ROOM) | Server transitions to lobby (`room.gameState = null`); broadcasts `LobbyState` + `REMATCH_WAITING_FOR_PLAYERS { missingSeats: 1 }`; room can accept a new join. | AC10 |
| T19 | Scoreboard, host sends `REMATCH` with 4 connected but 1 dead-seat | Treated as missing seat per AC10 (dead-seat excluded from rematch-seat count); transitions to lobby. | AC10 |
| T20 | Non-host sends `REMATCH` | Server rejects with `NOT_HOST`. | AC10 |
| T21 | Play phase, host sends `REMATCH` | Server rejects with `NOT_BETWEEN_GAMES`. | AC10 |
| T22 | REMATCH after departure-vote `end_game` outcome (4B.5 path) | `GAME_ABANDONED` fires → scoreboard → host sends `REMATCH` → seat count 3 → waiting-for-players. | AC10 |
| T23 | After 5th visitor sees "table is full", a seat opens (player leaves) → visitor refreshes | Fresh status call returns `full: false`; normal join flow proceeds. | AC8 |
| T24 | `ROOM_SETTINGS_CHANGED` toast shown to non-host during play phase | Toast renders (asymmetry with 4B.6 `HOST_PROMOTED` toast, which is suppressed mid-game). | AC7 |
| T25 | `ROOM_SETTINGS_CHANGED` toast suppressed for the host who made the change | Toast does not render for `changedBy === myPlayerId`. | AC7 |
| T26 | Host migration → new host edits settings → mid-game (blocked) → scoreboard (allowed) | T13 of this story (AC13); settings edit permission tracks `isHost` in real time. | AC13 |

### Scope boundaries

| In scope (4B.7) | Out of scope |
| --------------- | ------------ |
| `RoomSettings` shared type, `DEFAULT_ROOM_SETTINGS`, min/max constants | Dealing-style animation implementation (Epic 5A/5B) — client just stores the setting |
| `Room.settings` + sync with existing `jokerRulesMode` / `turnTimerConfig` | Removing the legacy top-level `jokerRulesMode` from state shapes |
| `SET_ROOM_SETTINGS` client→server message + validation + broadcast | New protocol for mid-game settings changes (explicitly forbidden by FR4) |
| `handleSetRoomSettings` with host + between-games gates + timer cleanup side-effects | Per-player preferences (localStorage — Epic 5B preferences store) |
| `ROOM_SETTINGS_CHANGED` resolved action + client toast | Scoreboard UI + Play Again button (Story 5B.4) |
| `RoomSettingsPanel.vue` collapsible component with read-only / editable modes | Dealer rotation for rematch (FR12 — Story 5B.4) |
| 5th-visitor pre-connect status check + `TableFullView` | Full `SpectatorGameView` render pipeline (post-MVP) |
| `ROOM_FULL` race-guard pivot to table-full view | New `JOIN_SPECTATOR` WebSocket message + spectator session plumbing (deferred to post-MVP unless dev judges < 300 LOC) |
| Spectator placeholder page (MVP stub) | Multiple concurrent spectators broadcasting |
| `REMATCH` server message + host + phase gates + 4-seat validation | Rematch UI, animation, or client handling of `REMATCH_WAITING_FOR_PLAYERS` beyond a basic toast |
| `REMATCH_WAITING_FOR_PLAYERS` resolved action for missing-seat fallback | Persistent settings across server restart |
| Settings persist across rematches test | AI fill-in for departed players at rematch time (FR99 — no MVP) |
| Host migration × settings edit regression (4B.6 interop) | |
| Full `ResolvedAction` exhaustive-switch fixes for `ROOM_SETTINGS_CHANGED` + `REMATCH_WAITING_FOR_PLAYERS` | |

## Tasks / Subtasks

- [x] **Task 1: Shared types — `RoomSettings` + new `ResolvedAction` discriminants** (AC: 1, 3, 10, 16, 17)
  - [x] 1.1 Add `TimerMode`, `DealingStyle`, `RoomSettings`, `DEFAULT_ROOM_SETTINGS`, `MIN_TURN_DURATION_MS`, `MAX_TURN_DURATION_MS` to `packages/shared/src/types/game-state.ts` (or a new `room-settings.ts` re-exported from the barrel).
  - [x] 1.2 Add `SetRoomSettingsMessage` and `RematchMessage` to `packages/shared/src/types/protocol.ts`.
  - [x] 1.3 Add `readonly settings: RoomSettings` to `LobbyState`, `PlayerGameView`, `SpectatorGameView` in `protocol.ts`. Keep existing top-level `jokerRulesMode` field for backward compatibility.
  - [x] 1.4 Add `ROOM_SETTINGS_CHANGED` and `REMATCH_WAITING_FOR_PLAYERS` discriminants to the `ResolvedAction` union in `game-state.ts`.
  - [x] 1.5 Export any new types from `packages/shared/src/index.ts`.
  - [x] 1.6 Run `pnpm run typecheck`; fix every exhaustive `switch` on `ResolvedAction.type`: `mapPlayerGameViewToGameTable.ts`, `useRoomConnection.ts`, `state-broadcaster.ts` (if applicable), any test helpers, `PlayerGameViewBridgeShowcase.vue`, dev-showcase routes, any server test fixtures.
  - [x] 1.7 Add a shared-types unit test for `DEFAULT_ROOM_SETTINGS` shape and min/max constants.

- [x] **Task 2: Server — `Room.settings` + `applyRoomSettingsUpdate` helper + refactor `handleSetJokerRules`** (AC: 2, 4, 5, 11, 17)
  - [x] 2.1 Add `settings: RoomSettings` to `Room` interface in `packages/server/src/rooms/room.ts`.
  - [x] 2.2 Initialize `settings: { ...DEFAULT_ROOM_SETTINGS }` in `RoomManager.createRoom`. Remove the inline `jokerRulesMode: "standard"` literal and source it from `settings` instead (or keep both in sync as per AC2). Same for `turnTimerConfig` — initialize from `settings` via a helper.
  - [x] 2.3 Create `applyRoomSettingsUpdate(room, patch, logger)` shared helper in `packages/server/src/websocket/join-handler.ts` (or a new `packages/server/src/rooms/room-settings.ts` module — prefer the latter for testability, co-locate with a unit test file `room-settings.test.ts`). Helper does: validate → merge → sync `room.jokerRulesMode` and `room.turnTimerConfig` → timer-mode flip side-effects (AC4 step 4) → return `{ previous, next, changedKeys } | null` where `null` means no-op.
  - [x] 2.4 Refactor `handleSetJokerRules` to delegate to `applyRoomSettingsUpdate({ jokerRulesMode })`. Preserve existing `INVALID_JOKER_RULES` / `NOT_HOST` / `GAME_IN_PROGRESS` error codes for backward compatibility (map from the helper's errors).
  - [x] 2.5 Relax `handleSetJokerRules` between-games check to permit `scoreboard` and `rematch` phases (currently lobby-only). Introduce a shared `isBetweenGames(room): boolean` helper. Update existing `SET_JOKER_RULES` tests that asserted strict lobby-only to assert the new broader rule.
  - [x] 2.6 Add new `handleSetRoomSettings(ws, room, playerId, message, logger)` entry point. Dispatch from `message-handler.ts` on `type === "SET_ROOM_SETTINGS"`.
  - [x] 2.7 Unit tests in a new `packages/server/src/rooms/room-settings.test.ts` (pure-helper tests — no WebSocket): happy path per field, min/max duration, invalid values, no-op detection, timer-mode flip clears turn timer + AFK vote.

- [x] **Task 3: Server — state broadcaster `settings` propagation** (AC: 5, 7, 17)
  - [x] 3.1 In `packages/server/src/websocket/state-broadcaster.ts`, update `buildLobbyState` to emit `settings: { ...room.settings }`.
  - [x] 3.2 Update `buildPlayerView` to emit `settings: { ...room.settings }`.
  - [x] 3.3 (If `buildSpectatorView` exists) update it similarly.
  - [x] 3.4 Extend `state-broadcaster.test.ts` to assert `settings` is present on both shapes and matches `room.settings`.

- [x] **Task 4: Server — `SET_ROOM_SETTINGS` dispatch + broadcast + integration tests** (AC: 3, 4, 7, 12, 16, 17)
  - [x] 4.1 Wire `message-handler.ts` dispatch case for `"SET_ROOM_SETTINGS"` → `handleSetRoomSettings`.
  - [x] 4.2 In `handleSetRoomSettings`, on a non-null helper result, call `broadcastStateToRoom(room, undefined, { type: "ROOM_SETTINGS_CHANGED", ... })` with the full resolved-action payload.
  - [x] 4.3 Integration test in `join-handler.test.ts` (new `describe("SET_ROOM_SETTINGS")` block): T1, T2, T3, T4, T5, T6, T7, T8, T11 from transition table. Use existing multi-socket test harness and assert `STATE_UPDATE` + `resolvedAction` payload shape.
  - [x] 4.4 Mid-game regression test (T6): drive WebSocket directly; assert `GAME_IN_PROGRESS` error and no state change.

- [x] **Task 5: Server — `REMATCH` handler** (AC: 10, 14, 16, 17)
  - [x] 5.1 Add `RematchMessage` dispatch case in `message-handler.ts`.
  - [x] 5.2 Add `handleRematch` in `action-handler.ts` per AC10. 4-seat happy path delegates to `handleStartGameAction`. Missing-seat fallback transitions `room.gameState = null`, cleans up timers (mirror start-game cleanup ritual), broadcasts lobby state + `REMATCH_WAITING_FOR_PLAYERS` resolved action.
  - [x] 5.3 Seat-count rule: `connectedCount === 4 && deadSeatPlayerIds.size === 0 && departedPlayerIds.size === 0`.
  - [x] 5.4 Settings persistence — verify `room.settings`, `room.jokerRulesMode`, `room.turnTimerConfig` are untouched by both paths.
  - [x] 5.5 New test file `packages/server/src/websocket/rematch-handler.test.ts` (or new `describe` block in `action-handler.test.ts`): T17, T18, T19, T20, T21, T22 from transition table.
  - [x] 5.6 Regression test T14: `getRoomStatus` returns `phase: "lobby"` after a missing-seat REMATCH resets `room.gameState`.

- [x] **Task 6: Client — `RoomSettingsPanel.vue` component + tests** (AC: 6, 7, 15, 16, 17)
  - [x] 6.1 Create `packages/client/src/components/game/RoomSettingsPanel.vue` per AC6. Use Composition API + `<script setup lang="ts">`, TypeScript strict. UnoCSS for styling, consistent with existing `BasePanel`/`BaseButton` design tokens.
  - [x] 6.2 Collapsible via `<details>` or a controlled accordion. Default collapsed state sourced from a prop (`defaultExpanded?: boolean`, default `false`).
  - [x] 6.3 Fields: `timerMode` (select), `turnDurationMs` (number input in seconds, gated by `timerMode === "timed"`, step 1, min 15, max 30), `jokerRulesMode` (select), `dealingStyle` (select). All disabled when `!canEdit` with the locked-note helper text.
  - [x] 6.4 Emit `change` with `Partial<RoomSettings>` containing only the changed key. Convert seconds → ms on emit for `turnDurationMs`.
  - [x] 6.5 Debounce `turnDurationMs` input with `useDebounceFn` from VueUse (300ms) to avoid broadcast storms while the user types.
  - [x] 6.6 Unit tests in `RoomSettingsPanel.test.ts`: renders host-editable, renders non-host read-only, emits single-key patches, disabled when `canEdit=false`, locked-note helper text visible, turn-duration disabled when timerMode=none. `happy-dom` + Vue Test Utils.
  - [x] 6.7 Integrate into `RoomView.vue` lobby view below the player list (replace the existing inline `jokerRulesMode` select). Integrate into `GameTable.vue` header/action-zone anchor — choose an anchor that does not occupy critical-action real estate.

- [x] **Task 7: Client — `useRoomConnection.sendSetRoomSettings` + toast + resolved-action router** (AC: 7, 15, 17)
  - [x] 7.1 Add `sendSetRoomSettings(patch: Partial<RoomSettings>)` to `useRoomConnection.ts` returning `void`; wraps `sendRaw({ type: "SET_ROOM_SETTINGS", ...patch })`. Also add `sendRematch()`.
  - [x] 7.2 Add toast watcher for `ROOM_SETTINGS_CHANGED` — same pattern as 4B.6 host-promoted toast (in `GameTable.vue` / `RoomView.vue` if following 4B.6 convention, OR in the composable if the code-review follow-up from 4B.6 (consolidating toasts into the composable) has landed. Verify against current repo state at implementation time.)
  - [x] 7.3 Suppress toast for `changedBy === localPlayerId` per AC7.
  - [x] 7.4 Render toast in all phases including play/charleston (document the asymmetry with `HOST_PROMOTED` via a code comment).
  - [x] 7.5 Human label / value formatter utility — co-locate with toast renderer or in `packages/client/src/composables/roomSettingsFormatters.ts`.
  - [x] 7.6 Client tests: toast visibility matrix (host vs non-host, each phase, single vs multiple changed keys).

- [x] **Task 8: Client — 5th player "table is full" flow** (AC: 8, 15, 16, 17)
  - [x] 8.1 Add a pre-connect status check in `RoomView.vue` `joinRoom()`: call `getApiBaseUrl() + '/api/rooms/:code/status'`, handle `{ full: true }` → set `isTableFull.value = true`; handle 404 / network error distinctly.
  - [x] 8.2 New `<template v-if="isTableFull">` block (or extracted `TableFullView.vue` — decide by `RoomView.vue` line count at implementation time). Renders the branded heading, one-liner, "Back to home" button, "Watch as spectator" button. `data-testid`s per AC8.
  - [x] 8.3 Race-guard: in `handleMessage` / error path of `useRoomConnection.ts`, detect `code === "ROOM_FULL"`, surface via a new ref (e.g. `roomFullError` or via extending `systemNotice`). `RoomView.vue` watches and pivots to the table-full view.
  - [x] 8.4 Client test (view test or composable test with fetch mocked): T12, T13, T15, T16, T23 from transition table.

- [x] **Task 9: Client — spectator stub** (AC: 9, 16)
  - [x] 9.1 **Default path (recommended):** the "Watch as spectator" button navigates to a placeholder route (`/room/:code/spectate`) that shows "Spectator mode is coming soon" + "Back to home". Add the route to `packages/client/src/router/index.ts`. No WebSocket, no server changes.
  - [x] 9.2 Unit test: click "Watch as spectator" from table-full view → navigates to `/room/:code/spectate` → placeholder renders.
  - [x] 9.3 **Alternative path (only if cleanly bounded — see AC9 decision rule):** full spectator plumbing. If chosen, follow the sketch in Dev Notes. Otherwise, skip.
  - [x] 9.4 Document the choice in the Change Log + a follow-up item in sprint-status.yaml if the stub is shipped.

- [x] **Task 10: Client — `REMATCH_WAITING_FOR_PLAYERS` basic handling** (AC: 10, 16)
  - [x] 10.1 In the resolved-action switch, on `REMATCH_WAITING_FOR_PLAYERS`, show a toast: `"Waiting for ${missingSeats} more player${missingSeats === 1 ? '' : 's'}"`. No other UI work — the scoreboard UI (Story 5B.4) owns the full Play Again flow. The toast is enough to unblock the REMATCH test path.
  - [x] 10.2 Client test: feed synthetic `REMATCH_WAITING_FOR_PLAYERS` → toast shown.

- [x] **Task 11: Regression + integration gate** (AC: 13, 17)
  - [x] 11.1 Host migration × settings-edit: regression test in `join-handler.test.ts` or `host-migration.test.ts` — migrate host → new host edits settings → accepted → broadcast fires → old host (demoted) edit rejected with `NOT_HOST`.
  - [x] 11.2 4B.4 turn-timer regression: assert `syncTurnTimer` continues to read `room.turnTimerConfig` after a `SET_ROOM_SETTINGS { timerMode, turnDurationMs }` update.
  - [x] 11.3 Existing `SET_JOKER_RULES` tests pass after refactor (delegated path).
  - [x] 11.4 4A.3 `ROOM_FULL` 5th-player reject test still passes.
  - [x] 11.5 Fixture sweep: every hand-written `LobbyState` / `PlayerGameView` / `SpectatorGameView` object literal in test files now carries `settings: DEFAULT_ROOM_SETTINGS`. Grep for `roomId:` / `myPlayerId:` patterns in test files.

- [x] **Task 12: Documentation + finalize** (AC: 18, 17)
  - [x] 12.1 Top-of-file header on any new module (`room-settings.ts`, `RoomSettingsPanel.vue`, `rematch-handler.test.ts`).
  - [x] 12.2 Update `leave-handler.ts` / `join-handler.ts` comments if the refactored `isBetweenGames` helper lives there.
  - [x] 12.3 Run regression gate: `pnpm test && pnpm run typecheck && vp lint`.
  - [x] 12.4 Update `_bmad-output/implementation-artifacts/sprint-status.yaml`: `4b-7-host-settings-5th-player-handling` → **review** → **done** after code review.
  - [x] 12.5 Update File List with every touched file.
  - [x] 12.6 Add Change Log entry. Note deferrals: dealing-style animation (Epic 5), rematch Play Again UI (5B.4), dealer rotation (5B.4), full spectator view (post-MVP if stub shipped).

## Dev Notes

### Epic & requirements traceability

- [`epics.md`](../planning-artifacts/epics.md#L2828) — Story **4B.7** (FR3, FR4, FR5, FR6, with implicit touch on FR10/FR11 for dealing style and FR12 for rematch dealer rotation — dealer rotation itself is explicitly deferred here to 5B.4). The epic's 7 acceptance criteria map to AC4 (host settings gate), AC7 (toast), AC4 mid-game gate, AC6 (collapsible panel), AC8 (table-full page via `GET /api/rooms/:code/status`), AC9 (spectator option), and AC10 (REMATCH preconditions).
- [`gdd.md`](../planning-artifacts/gdd.md) line 252 — "Room settings changes: Host can modify game settings (timer, card year, Joker rules, dealing style) between games but not mid-game." "Card year" is a future concern not in this story's scope (NMJL card data is currently static).
- Three-tier configuration architecture per AR14: constants in `shared/constants.ts`, host settings in room state (THIS STORY), per-player preferences in Pinia+localStorage (Epic 5B).
- Builds on 4B.4 turn-timer infrastructure (keep `turnTimerConfig` in sync with `settings`), 4B.5 departure flows (scoreboard phase entry → REMATCH is the exit path), 4B.6 host migration (new host inherits settings-edit capability), 4A.3 `ROOM_FULL` rejection path (race-guard pivot to table-full view).

### Infrastructure already in place (do not re-build)

| Capability | Location | Notes |
|---|---|---|
| `GET /api/rooms/:code/status` → `{ full, playerCount, phase }` | [`http/routes.ts:32`](../../packages/server/src/http/routes.ts) | Already returns `full: playerCount >= 4`. Client just needs to call it pre-connect. |
| `handleSetJokerRules` host-gated settings handler | [`join-handler.ts:34`](../../packages/server/src/websocket/join-handler.ts) | Template for `handleSetRoomSettings`. Refactor this to delegate to the new unified helper. |
| `room.jokerRulesMode` (existing host setting on `Room`) | [`room.ts:57`](../../packages/server/src/rooms/room.ts) | Keep in sync with `room.settings.jokerRulesMode`. |
| `room.turnTimerConfig` (4B.4) | [`room.ts:68`](../../packages/server/src/rooms/room.ts) | Keep in sync with `room.settings` `timerMode` + `turnDurationMs`. |
| `DEFAULT_TURN_TIMER_CONFIG` | [`turn-timer.ts:28`](../../packages/server/src/websocket/turn-timer.ts) | Used to initialize `room.turnTimerConfig`. Now derive it from `DEFAULT_ROOM_SETTINGS`. |
| `cancelTurnTimer(room, logger)` | [`turn-timer.ts`](../../packages/server/src/websocket/turn-timer.ts) | Used in the timer-mode flip side-effects. |
| `broadcastStateToRoom(room, undefined, resolvedAction)` | [`state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) | Room-level broadcast for `ROOM_SETTINGS_CHANGED` and `REMATCH_WAITING_FOR_PLAYERS`. |
| `handleStartGameAction` (reusable for rematch success path) | [`action-handler.ts:427`](../../packages/server/src/websocket/action-handler.ts) | REMATCH 4-seat happy path delegates to this. |
| `createLobbyState` / `room.gameState = null` reset pattern | [`action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) | REMATCH missing-seat fallback mirrors the start-game cleanup at lines 471–483. |
| `ROOM_FULL` error + 4A.3 rejection path | [`join-handler.ts:426`](../../packages/server/src/websocket/join-handler.ts) | Client-side race guard hooks into the error stream. |
| `HomeView.vue` `fetch(getApiBaseUrl() + '/api/rooms')` pattern | [`HomeView.vue:25`](../../packages/client/src/views/HomeView.vue) | Template for client HTTP call in `RoomView.vue` pre-connect status check. |
| `BaseToast.vue` with `data-testid` convention (4B.5/4B.6 toasts) | [`BaseToast.vue`](../../packages/client/src/components/ui/BaseToast.vue) | Reuse for `ROOM_SETTINGS_CHANGED` toast. Lobby `host-promoted-toast` in `RoomView.vue:354` is the template. |
| `BasePanel.vue` / collapsible accordion pattern | [`BasePanel.vue`](../../packages/client/src/components/ui/BasePanel.vue) | Reuse or compose for `RoomSettingsPanel.vue`. |
| `RoomView.vue` joker-rules inline select | [`RoomView.vue:444`](../../packages/client/src/views/RoomView.vue) | Replace with the new unified `RoomSettingsPanel`. |
| Exhaustive `ResolvedAction` switch sites from 4B.4/4B.5/4B.6 | Client composables, test helpers, dev showcase | Pattern well-established. Two new discriminants this story. |
| `useDebounceFn` from VueUse | `@vueuse/core` | Already a workspace dep (see `vueuse-functions` skill). Use for turn-duration input debounce. |

**Bottom line:** 4B.7 adds: the `RoomSettings` shape + helper module, two new `ResolvedAction` discriminants, two new client→server message types (`SET_ROOM_SETTINGS`, `REMATCH`), one new Vue component (`RoomSettingsPanel.vue`), one new view branch (`table-full-view`), and an optional spectator placeholder route. No new engine state. No new lifecycle timers. No new protocol message to/from the engine. The existing settings plumbing (`jokerRulesMode`, `turnTimerConfig`) is unified under `settings` without breaking callers.

### Architecture compliance

| Topic | Rule |
|---|---|
| **Engine purity** | `GameState` untouched. `RoomSettings` is room-level metadata. |
| **Server authority** | Client never mutates `settings` locally — every change goes through `SET_ROOM_SETTINGS` and round-trips via `broadcastStateToRoom`. |
| **Validate-then-mutate** | `applyRoomSettingsUpdate` validates the entire patch before touching `room.settings`, then mutates atomically and syncs derived fields (`turnTimerConfig`, `jokerRulesMode`) in one pass. No partial state. |
| **Consolidated broadcast fan-out** | `ROOM_SETTINGS_CHANGED` and `REMATCH_WAITING_FOR_PLAYERS` use `broadcastStateToRoom`, not raw `ws.send`. |
| **Single source of post-state sequencing** | Both new resolved actions are room-level, do not route through `sendPostStateSequence`. |
| **Composition API + `<script setup lang="ts">`** | `RoomSettingsPanel.vue` must follow this — strongly typed props/emits via `defineProps<T>()` / `defineEmits<T>()`. |
| **Imports** | Tests: `vite-plus/test`; app: `vite-plus`. No `vitest` / `vite` direct imports. |
| **UnoCSS** | `RoomSettingsPanel.vue` uses utility classes matching existing design tokens (`bg-chrome-surface`, `border-chrome-border`, `text-text-primary`, `text-text-secondary`, `focus-visible:focus-ring-on-chrome`). |
| **No import aliases** | Use relative imports or `@mahjong-game/shared`. No `@/`. |
| **Tile builders / fixtures** | Any new test that constructs a `PlayerGameView` uses `createPlayState()` from `packages/shared/src/testing/fixtures.ts` and augments with the new `settings` field. |

### Anti-patterns (do not ship)

- **Mutating `room.jokerRulesMode` or `room.turnTimerConfig` directly without going through `applyRoomSettingsUpdate`.** The unified helper is the single source of truth. Direct mutations would drift the two representations.
- **Removing the top-level `jokerRulesMode` field from `LobbyState` / `PlayerGameView`.** Backward-compat — clients still read it. The new `settings.jokerRulesMode` is additive. A follow-up story can remove the legacy field once all callers are migrated.
- **Allowing mid-game settings changes even "just for dealing style because it's cosmetic".** Epic AC explicitly says "not mid-game" (FR4) with no exceptions. The gate is at the handler level, non-negotiable.
- **Broadcasting `ROOM_SETTINGS_CHANGED` for a no-op patch.** Wastes bandwidth and fires spurious toasts. The helper returns `null` on no-op; the handler must not broadcast in that case.
- **Opening the WebSocket in `RoomView.vue` before the `/api/rooms/:code/status` call completes.** Defeats the purpose of the status check. If the status call is in-flight, show "Checking room..." and wait; only call `conn.connect()` after `{ full: false }`.
- **Skipping the `ROOM_FULL` race guard on the client.** The HTTP status check is advisory; the 4th player can claim the last seat between the check and the WebSocket handshake. The client must handle this specific error code.
- **Rematching mid-game.** The phase gate is `scoreboard` or `rematch` only. Lobby rematch is also invalid (no previous game to rematch from).
- **Running `handleStartGameAction` inside `handleRematch` when there are fewer than 4 connected seats.** The engine would reject or accept a malformed game. The fallback is to go back to lobby; waiting for a 4th player takes priority over starting a broken game.
- **Mid-vote AFK survival across a settings flip.** If `timerMode` flips to `"none"` during scoreboard, any lingering `afkVoteState` must be cancelled. (It's unlikely to exist — AFK votes resolve within play-phase — but the defensive cleanup catches edge cases where the vote's lifecycle timer raced with phase exit.)
- **Including dealer rotation in REMATCH.** That's Story 5B.4. For 4B.7, a rematch starts with the canonical east-dealer order (same as a fresh START_GAME). Document the deferral.
- **Building a full `SpectatorGameView` client render pipeline when the stub page satisfies the epic AC.** The epic says "a friendly branded 'table is full' page" and a spectator option — the option can be "coming soon" as long as it is present and not misleading. Scope control matters for a late-epic story.
- **Shipping the panel without accessibility wiring.** Every `<select>` / `<input>` in `RoomSettingsPanel.vue` has an associated `<label>` and ARIA attributes. The collapsible container uses `<details>` or manual `aria-expanded` / `aria-controls` per 5A.9 accessibility foundation. Screen reader announcements for `ROOM_SETTINGS_CHANGED` are nice-to-have but not required (the toast itself is polite-live via `BaseToast`).
- **Hard-coding turn-duration in seconds in multiple places.** Convert once at the handler boundary: UI renders seconds, wire format is ms, constants live in shared.
- **Adding a new timer.** No new timers in this story. Reuse the existing lifecycle framework if the dev thinks one is needed (they aren't — settings changes are synchronous).

### Implementation edge cases

- **Settings change during an active departure vote (4B.5).** Departure vote runs only in play phase; settings changes are blocked in play phase. Safe.
- **Settings change during scoreboard while a `social-override` or `table-talk-report` vote is still open.** These votes are play-phase only, so they are not active in scoreboard. Safe.
- **Host migrates mid-game → game ends (wall game or mahjong) → scoreboard → new host immediately edits settings.** Works per AC13. The new host's `isHost` flag is already set by the 4B.6 migration path before scoreboard is entered.
- **5th visitor navigates to a room that is currently paused (4B.3 simultaneous disconnect).** `getRoomStatus` returns `{ full: true, phase: "play" }` (paused is orthogonal to phase). The table-full view shows — the 5th player doesn't care whether the room is paused or active. Safe.
- **5th visitor navigates to a room mid-grace-period for one player.** `playerCount` counts `room.players.size` (which still includes the grace-period player — they're not released yet). Returns `full: true`. After grace expiry releases the seat, a refresh will show `full: false`. Consistent with existing seat semantics.
- **Settings change from the host while a 5th visitor is viewing the table-full page.** The 5th visitor is not in `room.players` and has no WebSocket → no broadcast. They see stale info until they refresh. Acceptable.
- **Turn-duration debounce + rapid clicks.** The VueUse `useDebounceFn` flushes on unmount; if the host changes the value and leaves the panel, the last debounced emit fires. Verify in a unit test.
- **`turnDurationMs` value when `timerMode === "none"`.** Keep last-known value in `room.settings.turnDurationMs` so toggling back to `"timed"` preserves the previous duration. The handler validation for `"none"` ignores the incoming `turnDurationMs` patch value and holds the current.
- **Host migration mid-REMATCH.** If the host sends `REMATCH` and disconnects in the same tick, the server processes `REMATCH` first (TCP ordering within a single socket). If it processed `disconnect` first, the REMATCH arrives on a dead socket and is dropped — the new host can send their own. Safe.
- **`ROOM_FULL` race guard test flakiness.** The race is between the HTTP `/status` call and the WebSocket handshake; tests should simulate this directly via mocked fetch + direct `ERROR` injection, not via real timing. The race is a correctness concern, not a latency concern.
- **Spectator placeholder route + direct URL access.** A user who bookmarks `/room/:code/spectate` and revisits should see the placeholder even if the room no longer exists. The placeholder does NOT call `/api/rooms/:code/status` — it's a pure static page. "Back to home" is the only affordance.
- **REMATCH with all 4 seats present but 1 dead-seat.** Dead-seat players are "present but locked out" — excluded from the 4-seat count per AC10. Falls through to the missing-seat (waiting-for-players) path. This is consistent with FR96 / 4B.5 dead-seat semantics. Note: dead-seat players should probably be auto-released on rematch (they wouldn't want to play anyway), but that's a 5B.4 concern — for 4B.7, just exclude them from the count.
- **`settings.dealingStyle === "animated"` with no animation code in the repo yet.** The setting is stored and broadcast; the client just logs `console.debug("dealing style: animated (not yet implemented)")` or renders the same instant deal. This is a forward-compat stub for Epic 5.

### Spectator-full-path sketch (reference only — default to placeholder)

Only consult this if the dev has ruled the placeholder path as insufficient after AC9's decision rule. Summary:

1. New WebSocket message `JOIN_SPECTATOR { roomCode }` (no displayName, no token — spectators are anonymous and ephemeral).
2. `Room.spectators: Map<string, { ws: WebSocket; spectatorId: string }>`.
3. `handleJoinSpectator`: check room exists, generate `spectatorId`, add to map, send initial `SPECTATOR_STATE_UPDATE` built from `buildSpectatorView(room.gameState)`.
4. `broadcastStateToRoom` walks both `room.sessions` (players) AND `room.spectators` (spectators get `SpectatorGameView`, not `PlayerGameView`). Guard against spectator receiving `hostAuditLog` / `myRack` / `departureVoteState` private fields — `buildSpectatorView` is already intended for this but may not be wired into the broadcast loop today.
5. Client opens a separate WebSocket on `/room/:code/spectate` (or reuses the same endpoint with a different JOIN message).
6. `SpectatorGameView` renders via a new `TableSpectator.vue` (read-only `GameTable` derivative with no rack, no action zone).
7. Spectator disconnect cleans up via `room.spectators.delete`.
8. Limits: max concurrent spectators (e.g. 10), rate limit on `JOIN_SPECTATOR` per IP.

Estimated size: ~500–800 LOC across shared + server + client + tests. **Over budget for 4B.7 — use placeholder.**

### File structure (expected touches)

| Area | Files |
| ---- | ----- |
| Shared types | [`packages/shared/src/types/game-state.ts`](../../packages/shared/src/types/game-state.ts) (or new `room-settings.ts`), [`packages/shared/src/types/protocol.ts`](../../packages/shared/src/types/protocol.ts), [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts) |
| Server — core | [`packages/server/src/rooms/room.ts`](../../packages/server/src/rooms/room.ts), [`packages/server/src/rooms/room-manager.ts`](../../packages/server/src/rooms/room-manager.ts), new [`packages/server/src/rooms/room-settings.ts`](../../packages/server/src/rooms/room-settings.ts), [`packages/server/src/websocket/join-handler.ts`](../../packages/server/src/websocket/join-handler.ts) (refactor `handleSetJokerRules`, add `handleSetRoomSettings`), [`packages/server/src/websocket/message-handler.ts`](../../packages/server/src/websocket/message-handler.ts) (dispatch), [`packages/server/src/websocket/action-handler.ts`](../../packages/server/src/websocket/action-handler.ts) (add `handleRematch`), [`packages/server/src/websocket/state-broadcaster.ts`](../../packages/server/src/websocket/state-broadcaster.ts) (emit `settings` on views) |
| Server — tests | new [`packages/server/src/rooms/room-settings.test.ts`](../../packages/server/src/rooms/room-settings.test.ts), extended [`join-handler.test.ts`](../../packages/server/src/websocket/join-handler.test.ts) (`SET_ROOM_SETTINGS` describe block + update `SET_JOKER_RULES` for the relaxed phase gate), new [`rematch-handler.test.ts`](../../packages/server/src/websocket/rematch-handler.test.ts) (or extend `action-handler.test.ts`), extended [`state-broadcaster.test.ts`](../../packages/server/src/websocket/state-broadcaster.test.ts) (`settings` field assertion), extended [`routes.test.ts`](../../packages/server/src/http/routes.test.ts) (full/not-full status after seat changes), extended [`room-manager.test.ts`](../../packages/server/src/rooms/room-manager.test.ts) (default settings init) |
| Client — state | [`packages/client/src/composables/useRoomConnection.ts`](../../packages/client/src/composables/useRoomConnection.ts) (`sendSetRoomSettings`, `sendRematch`, `ROOM_SETTINGS_CHANGED` / `REMATCH_WAITING_FOR_PLAYERS` handling, `ROOM_FULL` race-guard), [`packages/client/src/composables/mapPlayerGameViewToGameTable.ts`](../../packages/client/src/composables/mapPlayerGameViewToGameTable.ts) (exhaustive switch + thread `settings` through if needed) |
| Client — components | new [`packages/client/src/components/game/RoomSettingsPanel.vue`](../../packages/client/src/components/game/RoomSettingsPanel.vue), possibly new [`packages/client/src/components/room/TableFullView.vue`](../../packages/client/src/components/room/TableFullView.vue), optional new placeholder view at `packages/client/src/views/SpectatorPlaceholderView.vue`, [`packages/client/src/views/RoomView.vue`](../../packages/client/src/views/RoomView.vue) (integrate settings panel, table-full branch, status pre-check), [`packages/client/src/components/game/GameTable.vue`](../../packages/client/src/components/game/GameTable.vue) (integrate settings panel anchor, `ROOM_SETTINGS_CHANGED` toast) |
| Client — router | [`packages/client/src/router/index.ts`](../../packages/client/src/router/index.ts) (optional `/room/:code/spectate` placeholder route) |
| Client — tests | new [`packages/client/src/components/game/RoomSettingsPanel.test.ts`](../../packages/client/src/components/game/RoomSettingsPanel.test.ts), extended [`GameTable.test.ts`](../../packages/client/src/components/game/GameTable.test.ts), extended `useRoomConnection.*.test.ts` (new `SET_ROOM_SETTINGS` / `REMATCH_WAITING_FOR_PLAYERS` block), new or extended `RoomView` view test (table-full flow), fixture files with `LobbyState` / `PlayerGameView` object literals updated for the new `settings` field |

### Cross-session intelligence (claude-mem)

Recent observations (2026-04-05) confirm the Epic 4B trajectory and the patterns this story inherits:

- **Story 4B.6 (obs 855–871, S311–S313)** just shipped host migration with `HOST_PROMOTED` resolved action + phase-conditional client toast. The toast lives in `GameTable.vue` and `RoomView.vue` (not `useRoomConnection.ts`) due to a pragmatic choice the reviewer flagged as a LOW follow-up. **4B.7 should match the existing pattern unless the review follow-up has been addressed** — check repo state at implementation time. The `ROOM_SETTINGS_CHANGED` toast renders in ALL phases (asymmetric from `HOST_PROMOTED` which is suppressed mid-game), so document that explicitly in a code comment next to the toast.
- **Story 4B.5 (obs 837–848, S309–S310)** established the `ResolvedAction` exhaustive-switch ritual for Epic 4B: add discriminant → `pnpm run typecheck` → fix each site. 4B.7 adds TWO new discriminants (`ROOM_SETTINGS_CHANGED`, `REMATCH_WAITING_FOR_PLAYERS`) — expect more switch fixes than 4B.6.
- **Story 4B.4 (obs 811–836, S306–S308)** built the turn-timer infrastructure (`room.turnTimerConfig`, `syncTurnTimer`, `cancelTurnTimer`, `applyGraceExpiryGameActions`). 4B.7 must keep `room.turnTimerConfig` in sync with `room.settings` — do not short-circuit this.
- **Story 4B.3 (obs 799–806)** established pause semantics. Pause is orthogonal to settings changes — the between-games gate (phase === scoreboard/lobby/rematch) already excludes paused play-phase state. Safe.
- **Story 4A.3 (retros)** shipped the `ROOM_FULL` rejection path for 5th players. 4B.7 surfaces this error gracefully on the client — the server path is unchanged.
- **Epic 6A retro follow-through `6a-retro-1`** — every transition scenario row above (T1–T26) must have at least one test before code review signs off.

**Memory ID references for deeper dives (via `get_observations`):** 855 (host migration scope), 837 (turn timeout + AFK escalation), 838 (player departure scope).

### Git intelligence (recent commits)

```
fdad24f feat: player departure, dead seat, and departure vote (Story 4B.5)
556c143 feat: add Story 4B.5 shared types for player departure and dead seat
c5a5ade feat: add turn timeout and AFK escalation for multiplayer Mahjong (4B.4)
df5f720 feat: add simultaneous-disconnect game pause for multiplayer Mahjong (4B.3)
93f9244 feat: implement phase-specific reconnection fallbacks for multiplayer (4B.2)
```

Plus the in-flight host migration work (Story 4B.6) visible in `git status` (new `host-migration.ts`, updates across `join-handler.ts`, `leave-handler.ts`, `turn-timer.ts`, `GameTable.vue`, `RoomView.vue`). 4B.6 is marked done per `sprint-status.yaml` and is load-bearing for AC13 (host migration × settings-edit regression). Verify its commit lands before 4B.7 implementation begins — if the 4B.6 changes are still uncommitted when 4B.7 starts, implement on top of the working tree and let the two stories ship in order.

### Latest technical specifics (library / framework notes)

- **VueUse `useDebounceFn`:** current stable API — `useDebounceFn(fn, ms, options?)`. Use for the turn-duration input. Flushes on component unmount by default. See `vueuse-functions` skill.
- **Vue 3 `<script setup lang="ts">` + `defineProps<T>()` / `defineEmits<T>()`:** the idiomatic way to type props + emits in Vue 3 — match the existing `GameTable.vue` / `RoomView.vue` patterns. Do not use the runtime `defineProps({ ... })` object form.
- **Fastify 5 route typing:** `app.get<{ Params: { code: string } }>(...)` — see existing `routes.ts` at line 32 for the pattern.
- **`vite-plus/test` for test imports:** `import { describe, expect, it, vi } from "vite-plus/test"`. No `vitest` direct imports — see CLAUDE.md gotcha and `AGENTS.md`.
- **`happy-dom` for client tests:** not `jsdom`. Configured in `vite.config.ts`.

## Project context reference

See [`_bmad-output/project-context.md`](../project-context.md) and [`_bmad-output/planning-artifacts/game-architecture.md`](../planning-artifacts/game-architecture.md) — Decision 7 (Reconnection Strategy, host-authoritative actions) and AR14 (three-tier configuration: constants / room settings / per-player preferences). 4B.7 is the middle tier.

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation + test completion pass)

### Debug Log References

### Completion Notes List

- Shipped **spectator placeholder** route (`/room/:code/spectate`) per AC9 scope rule; full `JOIN_SPECTATOR` / `SpectatorGameView` pipeline deferred post-MVP.
- Epic **4B** marked **done** in `sprint-status.yaml` with story **4B.7** complete.
- Regression gate: `pnpm test`, `pnpm run typecheck`, `vp lint` — all passing.
- **Follow-up pass (gds-dev-story):** Re-ran full regression gate — `pnpm test`, `pnpm run typecheck`, `vp lint` all exit 0; lint reported warnings only (no errors).

### File List

**Shared:** `packages/shared/src/types/room-settings.ts`, `game-state.ts`, `protocol.ts`, `index.ts`, `types/room-settings.test.ts`

**Server:** `rooms/room.ts`, `room-manager.ts`, `rooms/room-settings.ts`, `rooms/room-settings.test.ts`, `websocket/join-handler.ts`, `websocket/action-handler.ts`, `websocket/ws-server.ts`, `websocket/state-broadcaster.ts`, `websocket/join-handler.test.ts`, `websocket/rematch-handler.test.ts`, `websocket/state-broadcaster.test.ts`, `http/routes.test.ts`, `rooms/room-manager.test.ts` (+ test fixture updates across server tests as needed)

**Client:** `composables/useRoomConnection.ts`, `composables/roomSettingsFormatters.ts`, `composables/useRoomConnection.roomSettings.test.ts`, `composables/mapPlayerGameViewToGameTable.ts` (+ tests), `components/game/RoomSettingsPanel.vue`, `components/game/RoomSettingsPanel.test.ts`, `components/game/GameTable.vue`, `components/game/GameTable.test.ts`, `views/RoomView.vue`, `views/RoomView.test.ts`, `views/SpectatorPlaceholderView.vue`, `views/SpectatorPlaceholderView.test.ts`, `router/index.ts`, `components/dev/PlayerGameViewBridgeShowcase.vue` (+ client test fixture updates)

**Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml`, this story file

## Change Log

- 2026-04-05: Story created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created covering host settings panel, 5th-player table-full flow, spectator stub, and REMATCH preconditions validation. Scope-control decisions documented for dealing-style animation (Epic 5), rematch Play Again UI (5B.4), dealer rotation (5B.4), and full spectator view (post-MVP) — this story ships the plumbing and stubs only.
- 2026-04-05: **Implementation complete (done).** Delivered `RoomSettings` + `SET_ROOM_SETTINGS` / `REMATCH` protocol, server `applyRoomSettingsUpdate` + `handleRematch`, state broadcast `settings`, client `RoomSettingsPanel` + table-full pre-connect status + `ROOM_FULL` race guard, spectator **stub** route (no `dev-notes.md` in repo — deferrals captured here and in sprint status). Tests: `join-handler` SET_ROOM_SETTINGS + AC13, `rematch-handler.test.ts`, `routes.test.ts` full room, `room-manager` default settings, `RoomSettingsPanel` / `GameTable` / `useRoomConnection` / `RoomView` client tests. **Deferred:** dealing-style animation (Epic 5), rematch scoreboard UI (5B.4), dealer rotation on rematch (5B.4), full spectator WebSocket view (post-MVP).
- 2026-04-05: **gds-dev-story follow-up pass.** Re-executed Step 6 regression (`pnpm test`, `pnpm run typecheck`, `vp lint`); all passed. DoD checklist spot-check: tasks/subtasks complete, ACs satisfied by prior implementation, no code changes required this pass.
- 2026-04-05: **Code review fixes applied (gds-code-review).** H1: AC6 — moved `RoomSettingsPanel` outside `v-if="isHost"` in `RoomView.vue` so non-hosts see read-only settings in lobby. M1: Added T13 (ROOM_FULL race guard), T15 (404), T16 (network error) tests to `RoomView.test.ts`. M2: Added AC11 settings-persistence assertions to `rematch-handler.test.ts` T18 fallback path. L1: Fixed `handleRematch` `missingSeats` formula in `action-handler.ts` — avoids double-counting departed/dead-seat players. L2: Added `SpectatorPlaceholderView.test.ts` unit test. Regression gate: 1449 tests pass, typecheck clean, lint 0 errors.
