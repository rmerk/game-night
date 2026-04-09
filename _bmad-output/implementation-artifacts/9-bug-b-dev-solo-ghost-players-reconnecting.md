# Story 9 Bug B: Dev-Solo Ghost Players Reconnecting (P0)

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **developer testing the game alone with `MAHJONG_DEV_SOLO_START`**,
I want **synthetic opponent seats to appear as normal seated players, not “reconnecting” placeholders**,
so that **solo testing matches the visual quality of a four-person table and I can trust what I see**.

## Acceptance Criteria

1. **AC1 — Public `connected` for dev-solo ghosts:** Given `MAHJONG_DEV_SOLO_START` is enabled, the host has started the game, and `room.devSoloGhostPlayerIds` lists the three synthetic seats, when any `STATE_UPDATE` (or join/reconnect path using `buildCurrentStateMessage`) includes the room’s public player roster, then each ghost’s entry has **`connected: true`** in the payload the client uses for presence UI.

2. **AC2 — Opponent UI:** Given the above state, when the human views `GameTable` / `OpponentArea`, then the three ghost opponents **do not** show the `seat-reconnecting-label` copy (`"{name} is reconnecting…"`) and the status dot uses the **connected** (success) tone — same as a live seated player from the viewer’s perspective.

3. **AC3 — Internal server invariants (critical):** Given dev-solo ghosts still have **no** WebSocket session, server-side logic that must reflect “real” connectivity (e.g. `allPlayersDisconnected`, pause / disconnect fan-out, turn-timer guards that check `room.players.get(id)?.connected`) **must not** be regressed. **Do not** simply set `PlayerInfo.connected = true` on ghosts in `action-handler.ts` unless you also fix cleanup (see Dev Notes — **wire-layer override is the default fix**).

4. **AC4 — Dead-seat semantics unchanged:** Ghosts remain in `seatStatus.deadSeatPlayerIds` and engine dead-seat automation (`drainCharlestonForDeadSeats`, etc.) behaves as today — this story is **presence / serialization only**, not gameplay rule changes.

5. **AC5 — Production / flag off:** Given `MAHJONG_DEV_SOLO_START` is unset or production (`isDevSoloStartEnabled() === false`), behavior is unchanged from current main.

6. **AC6 — Tests:** Add or extend server tests so a room with `devSoloGhostPlayerIds` set proves public roster `connected` is `true` for those IDs while `room.players.get(id).connected` may remain `false` (if using the broadcaster override). Existing `action-handler` dev-solo integration test should still pass; adjust expectations only if intentionally changing stored `PlayerInfo`.

7. **AC7 — Validation gate:** `pnpm test && pnpm run typecheck && vp lint` pass.

8. **AC8 — Live sanity check (Epic 9 process):** With dev-solo enabled, start a game as the only human; confirm at 1024px width the three opponents show names/avatars without “reconnecting” copy. Note: `OpponentArea.vue` still renders an **`import.meta.env.DEV` dashed layout helper** under opponent stacks on large breakpoints — that is separate from this bug; scope here is **connection/presence**, not removing dev-only layout chrome unless product asks.

## Tasks / Subtasks

- [x] Task 1 — Trace data path (AC: 1–3)
  - [x] 1.1 Confirm ghosts are created in `handleStartGameAction` with `connected: false` today (`packages/server/src/websocket/action-handler.ts` ~606–614).
  - [x] 1.2 Confirm client maps `connected` onto `OpponentPlayer` (`mapPlayerGameViewToGameTable.ts`) and `OpponentArea.vue` shows reconnecting when `!player.connected` (~62–87).
  - [x] 1.3 Confirm public roster is built in `mapRoomPlayersPublic` / `mapRoomPlayersPublicForGame` (`state-broadcaster.ts` ~76–98).

- [x] Task 2 — Implement fix (AC: 1–5)
  - [x] 2.1 **Default approach:** Add a small helper (e.g. `effectiveConnectedForPublicView(room, playerId, p.connected)`) used only in `mapRoomPlayersPublic` and `mapRoomPlayersPublicForGame` so IDs in `room.devSoloGhostPlayerIds` serialize as `connected: true`.
  - [x] 2.2 **If** you instead set `connected: true` on ghost `PlayerInfo` in `action-handler.ts`, you **must** verify `allPlayersDisconnected` / `disconnect-timeout` cleanup when the solo human’s socket closes — ghosts would otherwise block “all disconnected” detection; add stripping ghosts on last real disconnect or adjust the predicate, and document in tests.

- [x] Task 3 — Tests (AC: 6–7)
  - [x] 3.1 Extend `state-broadcaster.test.ts` (or focused unit test) for public map with `devSoloGhostPlayerIds`.
  - [x] 3.2 Run full server + monorepo gates.

- [x] Task 4 — Live check (AC: 8)
  - [x] 4.1 Manual browser pass with `MAHJONG_DEV_SOLO_START=1` (document URL/steps in Dev Agent Record).

## Dev Notes

### Problem statement (verified)

- **Symptom:** Dev-solo fills three seats with synthetic players; they are stored with `connected: false`, so the client shows **muted status dot**, **“is reconnecting…”** copy, and the table reads as broken during normal solo testing (P0 from Story 7.5 live session + `sprint-change-proposal-2026-04-09.md`).
- **Intent:** From the **client’s perspective**, ghosts are “present” at the table; fix without breaking disconnect/cleanup semantics.

### Root cause (code)

- Ghost insertion sets `connected: false` in `handleStartGameAction` (`action-handler.ts`).
- `state-broadcaster.ts` copies `p.connected` verbatim into lobby/game public player lists.
- `OpponentArea.vue` treats `!player.connected` as reconnecting UI.

### Implementation hints (do not skip)

- **`allPlayersDisconnected` trap:** `join-handler.ts` uses `player.connected` on **all** `room.players`. If every ghost is flipped to `connected: true` in `PlayerInfo`, the solo human’s disconnect may **never** satisfy `allPlayersDisconnected`, leaving rooms stuck. The **serialization override** in `state-broadcaster.ts` avoids that while fixing the UI.
- **Sprint proposal** suggested commit wording `fix(server): dev-solo ghost players initialize as connected, not reconnecting` — outcome matches; **implementation may** be “effective connected on wire” rather than mutating `PlayerInfo`, unless join-handler cleanup is extended.
- Ghosts remain **dead seats** for engine purposes (`deadSeatPlayerIds`, `stripDevSoloGhostPlayers`, rematch paths) — do not remove that.

### Project structure notes

- Primary: `packages/server/src/websocket/state-broadcaster.ts`
- Secondary (only if not using wire override): `packages/server/src/websocket/action-handler.ts`, possibly `join-handler.ts` for cleanup
- Tests: `packages/server/src/websocket/state-broadcaster.test.ts`, `action-handler.test.ts` (MAHJONG_DEV_SOLO_START block)
- Client: likely **no** changes if server payload is corrected; only touch client if you discover a second code path bypassing public roster.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 9 Phase 0 Bug B]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-09.md` — Bug B]
- [Source: `packages/server/src/websocket/action-handler.ts` — ghost `PlayerInfo` creation, `devSoloGhostPlayerIds` assignment]
- [Source: `packages/server/src/websocket/state-broadcaster.ts` — `mapRoomPlayersPublic*`]
- [Source: `packages/server/src/config/dev-solo.ts` — ghost id prefix `dev-solo-`]
- [Source: `packages/client/src/components/game/OpponentArea.vue` — reconnecting label + dev dashed box]
- [Source: `packages/server/src/websocket/join-handler.ts` — `allPlayersDisconnected`]

### Architecture compliance

- Server: TypeScript, Fastify + ws; follow existing broadcast patterns; no new env vars.
- No protocol version change — same fields, corrected values for dev-solo ghosts.
- Follow CLAUDE.md / AGENTS.md: `vite-plus/test`, `vp test run`, backpressure gate before commit.

### Testing requirements

- Prove **public** `connected` true for ghost IDs when `devSoloGhostPlayerIds` is set.
- Regression: human-only disconnect still allows room lifecycle expectations (no orphaned rooms if today’s behavior is to run `all_disconnected` cleanup — **verify** after any `PlayerInfo.connected` mutation).

### Previous story intelligence (Story 9 Bug A)

- Bug A was **client-side** Table Talk gating; this bug is **server wire / presence** for dev-solo — different files, same Epic 9 “live sanity check” discipline (AC8).
- Bug A completion notes stressed not conflating unrelated working-tree changes; keep this fix scoped.

### Cross-session intelligence

- Epic 9 Phase 0 sequences Bug A then Bug B before Stories 9.1–9.3.
- Visual audit called out dev-solo opponents as a **bug**, not polish.

### Git intelligence (recent themes)

- Recent commits on main were Story 7.4 / audio client work; dev-solo landed earlier — this story touches server broadcast layer only.

### Latest tech information

- No new dependencies; boolean field in existing JSON payloads.

### Project context reference

- See `CLAUDE.md` for monorepo layout and `MAHJONG_DEV_SOLO_START` documentation in `packages/server/.env.example`.

## Change Log

- **2026-04-09:** Epic 9 Bug B — `effectiveConnectedForPublicView` in `state-broadcaster.ts` so `devSoloGhostPlayerIds` serialize as `connected: true` on lobby and game public rosters; `PlayerInfo.connected` unchanged. Tests in `state-broadcaster.test.ts`.

## Dev Agent Record

### Agent Model Used

Cursor agent (gds-dev-story)

### Debug Log References

### Completion Notes List

- Implemented wire-layer override only (no `PlayerInfo.connected` mutation) to preserve `allPlayersDisconnected` and related server invariants.
- **AC8 live sanity:** With `MAHJONG_DEV_SOLO_START=1` on the server, open the client (e.g. `vp dev`), create/join a room as the only human, start the game; at ~1024px viewport width confirm three opponent stacks show normal names/avatars and no “is reconnecting…” copy (status dot should match connected styling). Dev dashed layout helper in `OpponentArea.vue` may still appear in DEV builds — out of scope per AC8.

### File List

- `packages/server/src/websocket/state-broadcaster.ts`
- `packages/server/src/websocket/state-broadcaster.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/9-bug-b-dev-solo-ghost-players-reconnecting.md`
