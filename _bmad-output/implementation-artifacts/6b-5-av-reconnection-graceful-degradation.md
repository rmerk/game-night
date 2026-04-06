# Story 6B.5: A/V Reconnection & Graceful Degradation

Status: done

_Ultimate context engine analysis completed — comprehensive developer guide created._

## Story

As a **player**,
I want **voice and video to automatically reconnect when I rejoin after a network hiccup, with a manual retry button if auto-reconnect fails**,
so that **a brief drop doesn't mean losing voice for the rest of the game (FR110, FR116)**.

## AC → requirements trace

| AC | FR / NFR |
|----|-----------|
| 1–2 | FR110 |
| 3–4, 6 | FR116 |
| 5 | NFR23 |

## Acceptance Criteria

1. **WS restore → LiveKit rejoin + indicator (FR110)** — Given a player reconnects after a disconnect (session token reconnection from Epic 4B) / When the WebSocket connection restores / Then the LiveKit client automatically attempts to rejoin the voice/video room — a **"Reconnecting audio/video..."** indicator appears.

2. **Auto-reconnect success within 10s** — Given A/V auto-reconnect succeeds / When streams re-establish / Then video feeds and audio resume at all seat positions within **10 seconds** — the reconnecting indicator disappears.

3. **Auto-reconnect failure → degraded + button (FR116)** — Given A/V auto-reconnect fails / When **10 seconds** pass without re-establishing / Then the player falls back to text-only mode, and a persistent **"Reconnect A/V"** button appears in the A/V controls area.

4. **Manual retry UX (FR116)** — Given the **"Reconnect A/V"** button / When tapped / Then **one** retry attempt fires with a **10-second** timeout and a **spinner** on the button. If it fails, the button remains with **"Connection failed — try again?"** message. **No modal, no loop.**

5. **NFR23 — game independent of WebRTC** — Given A/V failure at any point during the session / When checking game impact / Then the game is fully playable without A/V — game state, turns, calls, chat, and reactions all function independently of WebRTC status.

6. **Persistent retry** — Given the **"Reconnect A/V"** button / When checking availability / Then it remains available for the **entire session** — players can retry at their leisure without time pressure.

## Current client behavior (baseline — do not assume unimplemented features)

- **[`RoomView.vue`](packages/client/src/views/RoomView.vue)** opens the game WebSocket only via **`joinRoom()` → `conn.connect(roomCode, name)`**. There is **no** background WebSocket auto-reconnect loop in the client today.
- **WebSocket `close`** (in [`useRoomConnection.ts`](packages/client/src/composables/useRoomConnection.ts)) sets `status` to `closed` and calls **`resetSocialUiForSession()`**, which **`liveKit.disconnect()`** and **`useLiveKitStore().resetForRoomLeave()`** — LiveKit is torn down with the socket.
- **Re-entering the room** after a drop uses the same **`connect()`** path: `liveKitTokenRequested` is reset to **`false`** at the start of `connect()`, so the **first** `STATE_UPDATE` on the new socket should again send **`REQUEST_LIVEKIT_TOKEN`** (verify with a test).
- **Epic 4B “reconnection”** in this codebase therefore lines up with **session token + new `connect()`** (user-driven re-join or any future auto-reconnect that reuses this path) — not a silent same-socket resume unless you add one later.

## Tasks / Subtasks

- [x] Task 1: Map WS ↔ LiveKit lifecycle (AC: 1, 5)
  - [x] 1.1 Trace today’s flow: [`useRoomConnection.ts`](packages/client/src/composables/useRoomConnection.ts) — first `STATE_UPDATE` while socket open sets `liveKitTokenRequested` and sends `REQUEST_LIVEKIT_TOKEN`; `livekit_token` calls [`useLiveKit().connect`](packages/client/src/composables/useLiveKit.ts). On WebSocket `close`, `resetSocialUiForSession()` calls `liveKit.disconnect()` and [`useLiveKitStore().resetForRoomLeave()`](packages/client/src/stores/liveKit.ts).
  - [x] 1.2 **Manual retry trap:** After the first `STATE_UPDATE`, `liveKitTokenRequested` stays **`true`** until the next `connect()`. If LiveKit **`connect()` fails** (or never arrives), the client will **not** auto-send another `REQUEST_LIVEKIT_TOKEN` from `STATE_UPDATE` alone. **“Reconnect A/V”** must call an API that **forces** a token request (e.g. reset the flag and `sendRaw({ type: "REQUEST_LIVEKIT_TOKEN" })` when `ws.readyState === OPEN`), or equivalent — **do not** duplicate token plumbing in `AVControls`.
  - [x] 1.3 After **game** WS is healthy again, ensure LiveKit rejoin is triggered for every intended path (`connect()` reset covers re-join; add tests if you introduce a different reconnect path).
  - [x] 1.4 Do **not** block game actions on LiveKit; never throw from A/V paths into game WS handlers.

- [x] Task 2: Reconnecting indicator (AC: 1, 2)
  - [x] 2.1 Surface **"Reconnecting audio/video..."** when LiveKit is attempting rejoin: combine `useLiveKitStore().connectionStatus === 'connecting'` with intent (initial connect vs reconnect). [`useLiveKit.ts`](packages/client/src/composables/useLiveKit.ts) already maps `RoomEvent.Reconnecting` → `connecting` and `RoomEvent.Reconnected` → `connected` — align UI copy with epic (FR110).
  - [x] 2.2 Place indicator near existing A/V UI: [`AVControls.vue`](packages/client/src/components/game/AVControls.vue) and/or parents that already pass `connectionStatus` ([`GameTable.vue`](packages/client/src/components/game/GameTable.vue), [`MobileBottomBar`](packages/client/src/components/game/MobileBottomBar.vue) — follow 6B.3 wiring).
  - [x] 2.3 When `connected` and tracks sync, hide indicator; ensure [`PlayerPresence`](packages/client/src/components/game/PlayerPresence.vue) / seat video does not show false “speaking” during disconnected states (6B.4 already gated some UI on `connected`).

- [x] Task 3: 10s watchdog — success vs degraded (AC: 2, 3)
  - [x] 3.1 **Recommended rule (document in code comment):** Start the **10s** watchdog when LiveKit enters **`connecting`** while the **game WebSocket is `open`** and the user is “expecting A/V” (e.g. was previously `connected` this session, or is in the initial join attempt after `STATE_UPDATE` — pick one product rule and apply consistently). **Do not** start two watchdogs for the same attempt: **SDK** `RoomEvent.Reconnecting` and **`connect()`** after `disconnect()` should share one timer or mutually exclusive phases.
  - [x] 3.2 If `connected` within 10s, clear timer and hide reconnecting indicator (AC 2). Remote thumbnails may lag briefly behind `connected`; epic allows up to **10s** for feeds to resume.
  - [x] 3.3 If still not `connected` after 10s, transition to **degraded**: show persistent **"Reconnect A/V"**; **no** toast spam; **no** modal (NFR23). Use a named constant e.g. `AV_RECONNECT_WATCHDOG_MS = 10_000` next to manual retry timeout if both are 10s.

- [x] Task 4: Reconnect A/V button + timeout + copy (AC: 3, 4, 6)
  - [x] 4.1 Extend [`AVControls.vue`](packages/client/src/components/game/AVControls.vue): new emit e.g. `reconnect-av`, props for `showReconnectButton`, `manualReconnectPhase` (`idle` | `pending` | `failed`), **`data-testid`** hooks (e.g. `av-reconnecting-message`, `av-reconnect-button`). **UI stacking:** If permission banner (`prompt`/`unknown`) is visible, define whether **Reconnect A/V** appears **above** it, **replaces** it for this state, or both show — document the chosen rule (avoid two competing primary actions without copy hierarchy).
  - [x] 4.2 On click: parent/composable runs **one** attempt: force `REQUEST_LIVEKIT_TOKEN` (Task 1.2) + await `liveKit.connect` via existing `livekit_token` path, wrapped in a **10s** `Promise.race` (or `AbortSignal`) timeout; **spinner** on button while pending.
  - [x] 4.3 On timeout or connect failure: show **"Connection failed — try again?"** on the same button; no automatic retry loop; button stays tappable for rest of session (AC 6).
  - [x] 4.4 Wire handler from [`GameTable.vue`](packages/client/src/components/game/GameTable.vue) / [`MobileBottomBar`](packages/client/src/components/game/MobileBottomBar.vue) into **`useRoomConnection`**-exposed API — [`useLiveKit`](packages/client/src/composables/useLiveKit.ts) remains the only LiveKit **Room** owner; **`sendRaw` stays internal** unless you deliberately expose a narrow method.

- [x] Task 5: Tests (AC: 1–6)
  - [x] 5.1 [`useLiveKit.test.ts`](packages/client/src/composables/useLiveKit.test.ts): extend coverage for reconnect indicator signals if new state is added; keep mocking `Room` / events pattern already in file.
  - [x] 5.2 [`AVControls.test.ts`](packages/client/src/components/game/AVControls.test.ts): reconnecting copy, button spinner, failed copy, `aria` labels.
  - [x] 5.3 If `useRoomConnection` gains token re-request logic, add or extend [`useRoomConnection.reconnection.test.ts`](packages/client/src/composables/useRoomConnection.reconnection.test.ts) for `REQUEST_LIVEKIT_TOKEN` after simulated reconnect.
  - [x] 5.4 Backpressure: `pnpm test`, `pnpm run typecheck`, `vp lint` from repo root norms.

## Dev Notes

### Codebase delta (do not reinvent)

| Area | Status |
|------|--------|
| `useLiveKit` — `connect` / `disconnect`, `Reconnecting` / `Reconnected`, `Disconnected` | **Done** — extend with UI-facing degraded + manual retry orchestration as needed; keep `getRoom(): Room \| null` discipline. |
| `useRoomConnection` — `REQUEST_LIVEKIT_TOKEN`, `livekit_token`, `liveKitTokenRequested` | **Done** — likely **extension point** for post-WS-restore LiveKit rejoin; do not fork a second token pipeline. |
| `useLiveKitStore` — `connectionStatus`, `token`, `liveKitUrl` | **Done** — may need extra refs or derived flags for “degraded” / “manual retry in flight” if not expressible purely from existing statuses. |
| `AVControls` — permission banner, toggles, `A/V unavailable` | **Done** — add reconnect row; preserve `min-tap`, surface variants (`chrome` / `felt`). |

### Architecture compliance

- Client: Vue 3 Composition API, `<script setup>`, UnoCSS, VueUse — [Source: `_bmad-output/project-context.md`]
- LiveKit: `livekit-client` ^2.18 — composable wrapper only, single room instance — [Source: `_bmad-output/planning-artifacts/game-architecture.md`]
- A/V failures remain non-fatal (NFR23); reconnect UI is informative, not blocking — [Source: `_bmad-output/planning-artifacts/epics.md` Story 6B.5]

### Files likely touched

- `packages/client/src/composables/useLiveKit.ts`
- `packages/client/src/composables/useRoomConnection.ts` — **likely** export `requestLiveKitToken()` / `retryLiveKitConnect()` (names TBD) for manual retry + tests
- `packages/client/src/stores/liveKit.ts`
- `packages/client/src/components/game/AVControls.vue` + [`AVControls.test.ts`](packages/client/src/components/game/AVControls.test.ts)
- `packages/client/src/components/game/GameTable.vue` + [`MobileBottomBar.vue`](packages/client/src/components/game/MobileBottomBar.vue) — props/emits for reconnect UI
- `packages/client/src/composables/useLiveKit.test.ts`
- `packages/client/src/composables/useRoomConnection.reconnection.test.ts` — **extend** for `REQUEST_LIVEKIT_TOKEN` + `livekit_token` sequence on re-`connect()` and forced retry

### Testing standards

- Vitest via `vite-plus/test`; co-located `*.test.ts`
- Client: `happy-dom`, Pinia + Vue Test Utils
- Mock `livekit-client` `Room` as existing `useLiveKit` tests do

### Project structure notes

- No `@/` path aliases — relative imports or `@mahjong-game/shared` only [Source: `CLAUDE.md`]
- At code review, **File List** in this story must match git reality (5B retro gate)
- Resolved-action toasts: new status messaging should **not** use the `resolvedAction` toast pattern unless product asks — prefer inline A/V controls copy per epic (no modal).

### Anti-patterns (avoid)

- Second `Room` instance or LiveKit connect path outside [`useLiveKit.ts`](packages/client/src/composables/useLiveKit.ts).
- Calling `liveKit.connect()` from `AVControls` directly — always go through connection composable / parent wiring.
- Showing **Reconnecting audio/video...** during **first** join **before** any user expectation of A/V (optional polish: suppress until after first successful `connected` or after a drop — if suppressed, document in completion notes).
- Blocking **`JOIN_ROOM`**, game actions, or chat on LiveKit state.

### References

- Epic story + AC: [`_bmad-output/planning-artifacts/epics.md`](_bmad-output/planning-artifacts/epics.md) — Story 6B.5
- Epic 4B reconnection / session token: same `epics.md` Epic 4B; architecture Decision 7 / session token — [`_bmad-output/planning-artifacts/game-architecture.md`](_bmad-output/planning-artifacts/game-architecture.md)
- FR110 / FR116 / NFR23 traceability: [`_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-26.md`](_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-26.md) (Epic 6B A/V reconnection)
- UX resilience: [`_bmad-output/planning-artifacts/ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md) (graceful degradation, long-session reliability)
- Prior LiveKit stories: [`6b-3-audio-video-controls-permission-handling.md`](_bmad-output/implementation-artifacts/6b-3-audio-video-controls-permission-handling.md), [`6b-4-speaking-indicator-avatar-fallback.md`](_bmad-output/implementation-artifacts/6b-4-speaking-indicator-avatar-fallback.md)

## Previous story intelligence (6B.4)

- Speaking UI and local voice dot are gated on `connectionStatus === 'connected'` where applicable — reconnect flows must not flash misleading “speaking” or “voice connected” states while LiveKit is `connecting` / `failed` / `disconnected`.
- File List completeness at review is a **documentation gate**; list every touched artifact including this story and `sprint-status.yaml` when edited.
- `useLiveKit` internals: prefer `getRoom()` pattern for typing when touching the composable.

## Latest technical specifics (LiveKit JS)

- `RoomEvent.Reconnecting` / `RoomEvent.Reconnected` are already wired to Pinia `connectionStatus`. Distinguish **SDK-driven** reconnect (same room) from **full** `connect()` after `disconnect()` when specifying the 10s watchdog and indicator copy so the dev agent does not double-count timers.
- Store statuses today: `idle` | `connecting` | `connected` | `failed` | `disconnected` — map **degraded / show Reconnect A/V** to explicit combinations (e.g. `failed` after watchdog, or `disconnected` while game WS `open`) and document the matrix in a short comment or test name.

## Cross-session intelligence

- Stories 6B.1–6B.4 established LiveKit connection, thumbnails, A/V controls, permissions, and speaking indicator. This story completes **resilience**: user-visible reconnect path and manual retry without breaking game WS or NFR23.

## Project context reference

- Stack and LiveKit cut line: [`_bmad-output/project-context.md`](_bmad-output/project-context.md)
- Full architecture: [`_bmad-output/planning-artifacts/game-architecture.md`](_bmad-output/planning-artifacts/game-architecture.md)

## Story completion status

**review** — Implementation complete; backpressure gate green (`pnpm test`, `pnpm run typecheck`, `vp lint`). Run GDS code-review workflow before marking **done**.

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation session 2026-04-06)

### Debug Log References

### Completion Notes List

- `retryLiveKitConnection()` resets `liveKitTokenRequested`, sends `REQUEST_LIVEKIT_TOKEN`, and pairs the next `LIVEKIT_TOKEN` with `await liveKit.connect` via a one-shot waiter + `AV_MANUAL_RETRY_TIMEOUT_MS` (invalidated on `resetSocialUiForSession` / generation bump).
- `useAvReconnectUi`: single 10s watchdog when game WS `open`, LiveKit `connecting`, and `wasEverConnected`; cold join suppresses “Reconnecting…” and watchdog (no prior `connected`).
- Degraded UI: `useLiveKitStore.avSessionDegraded`; reconnect row **above** permission banner in `AVControls` (comment in SFC).
- Task 5.1: no `useLiveKit` changes — tests unchanged. Task 5.3 covered by new `useRoomConnection.livekitRetry.test.ts` (mocked `useLiveKit`).
- **Third pass (gds-dev-story):** Re-ran `pnpm test`, `pnpm run typecheck`, `vp lint` — all green. Tightened `retryLiveKitConnection` manual-retry timeout path: increment `liveKitRetryGeneration` when the 10s token/connect wait elapses so late completions from that attempt cannot invoke the stale waiter’s `finish`. Added regression test **after timeout, a new retryLiveKitConnection attempt can still succeed**.

### File List

- `packages/client/src/constants/avReconnect.ts`
- `packages/client/src/stores/liveKit.ts`
- `packages/client/src/stores/liveKit.test.ts`
- `packages/client/src/composables/useRoomConnection.ts`
- `packages/client/src/composables/useRoomConnection.livekitRetry.test.ts`
- `packages/client/src/composables/useAvReconnectUi.ts`
- `packages/client/src/composables/useAvReconnectUi.test.ts`
- `packages/client/src/components/game/AVControls.vue`
- `packages/client/src/components/game/AVControls.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/MobileBottomBar.vue`
- `packages/client/src/views/RoomView.vue`
- `_bmad-output/implementation-artifacts/6b-5-av-reconnection-graceful-degradation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-06 — Story file created via gds-create-story; sprint status → `ready-for-dev`.
- 2026-04-06 — Second pass: AC→FR table; baseline RoomView/WS/LiveKit lifecycle; **`liveKitTokenRequested` manual-retry trap**; watchdog + UI stacking guidance; anti-patterns; `sendRaw` encapsulation; expanded file/test list.
- 2026-04-06 — Story 6B.5 implemented: reconnect UI, watchdog, `retryLiveKitConnection`, tests; sprint + story status → `review`.
- 2026-04-06 — Third pass: DoD re-verify + manual-retry timeout invalidates attempt generation; extra `useRoomConnection.livekitRetry` regression test.
- 2026-04-06 — Code review (GDS): 1 MEDIUM + 1 LOW fixed. Added 3 `onReconnectAv` tests to `useAvReconnectUi.test.ts` (success/failure phase transitions, double-click protection). Added `onBeforeUnmount` timer cleanup to `useAvReconnectUi.ts`. All 376 tests passing, typecheck clean, 0 lint errors. Story → done.
