# Story 6B.4: Speaking Indicator & Avatar Fallback

Status: done

_Ultimate context engine analysis completed — comprehensive developer guide created._

## Story

As a **player**,
I want **to see who is speaking via a visual indicator at their seat position, whether they have video on or off**,
so that **I can follow the conversation and know who's talking (UX-DR23)**.

## Acceptance Criteria

1. **Speaking + camera on** — Given a player is speaking (mic active, audio detected) / When viewing their seat position with camera ON / Then a subtle animated ring or glow pulses around their video frame — the "talking" indicator.

2. **Speaking + camera off** — Given a player is speaking with camera OFF / When viewing their avatar circle / Then the same animated ring pulses around the avatar — speaking is visible regardless of camera state.

3. **Reduced motion** — Given `prefers-reduced-motion` is active / When a player is speaking / Then the talking indicator switches from a pulsing ring to a static solid colored border that appears when speaking and disappears when silent — no animation, same information.

4. **Text-only minimum presence** — Given a player with no A/V (text-only) / When viewing their seat / Then name label + online/away status dot — minimum presence indicator.

5. **VAD, not raw level** — Given the speaking detection / When checking sensitivity / Then the indicator responds to actual speech, not background noise — LiveKit SDK's voice activity detection is used rather than raw audio level.

## Tasks / Subtasks

- [x] Task 1: Animated speaking indicator (AC: 1, 2)
  - [x] 1.1 In `PlayerPresence.vue`, replace the current static `ring-2` when `isSpeaking` with a **subtle** pulse or glow (CSS keyframes or UnoCSS arbitrary animation) using existing tokens (e.g. `ring-state-turn-active` / felt-appropriate accent). Keep contrast acceptable on dark felt.
  - [x] 1.2 Apply the same visual treatment to both branches: `VideoThumbnail` (camera on) and `AvatarFallback` (camera off) — the outer frame/button already wraps both; ensure the animated ring reads clearly on video and on avatar.
  - [x] 1.3 Do not change `presenceFrame.ts` fixed dimensions or cause layout shift.

- [x] Task 2: `prefers-reduced-motion` branch (AC: 3)
  - [x] 2.1 Use VueUse `useMediaQuery("(prefers-reduced-motion: reduce)")` or equivalent (pattern already used in `PlayerPresence.vue` for mobile breakpoint).
  - [x] 2.2 When reduced motion: **no** pulse animation — static solid border while `isSpeaking`, absent when silent (per [Source: _bmad-output/planning-artifacts/gdd.md#Player Presence]).
  - [x] 2.3 When reduced motion is off: use animated indicator from Task 1.

- [x] Task 3: Confirm VAD data source (AC: 5)
  - [x] 3.1 **Do not** add RMS/meter-based speaking detection. Keep driving UI from `useLiveKit().activeSpeakers` populated by `RoomEvent.ActiveSpeakersChanged` in `useLiveKit.ts` (LiveKit active speaker pipeline).
  - [x] 3.2 Add or extend a short code comment above `ActiveSpeakersChanged` handler documenting that this is SDK speaker detection, not raw audio level.
  - [x] 3.3 Extend `useLiveKit.test.ts` only if a regression gap exists; existing test `"ActiveSpeakersChanged updates activeSpeakers set"` already covers the event wire.

- [x] Task 4: Text-only / no A/V presence audit (AC: 4)
  - [x] 4.1 **Opponents:** `OpponentArea.vue` already shows name + `BaseBadge` status dot (`variant="status-dot"`, connected vs disconnected). Verify all three opponent slots still show these when LiveKit is disconnected or user has no published tracks.
  - [x] 4.2 **Local:** `GameTable.vue` local block shows `PlayerPresence` + `BasePanel` with name/score. Decide and implement minimal parity if required by AC (e.g. optional status dot for "connected" self vs dead seat / reconnecting states) — document the chosen interpretation in completion notes if product treats "local" as implicitly online.
  - [x] 4.3 When `connectionStatus !== 'connected'`, speaking indicator should not imply false positives; `activeSpeakers` is cleared on `disconnect` — verify briefly in UI or test.

- [x] Task 5: Tests (AC: 1–3)
  - [x] 5.1 Extend `PlayerPresence.test.ts`: with `isSpeaking` true/false, assert presence of animation class vs static border class; reduced-motion is exercised by mocking `useMediaQuery` and routing on the query string (equivalent intent to `window.matchMedia` / `prefers-reduced-motion` tests elsewhere).
  - [x] 5.2 Optional: snapshot or class assertion on the frame element that carries the ring/border.
  - [x] 5.3 Run package backpressure: `pnpm test`, `pnpm run typecheck`, `vp lint` from repo norms.

## Dev Notes

### Codebase delta (do not reinvent)

| Area | Status |
|------|--------|
| `useLiveKit.ts` — `activeSpeakers` + `RoomEvent.ActiveSpeakersChanged` | **Done** (Story 6B.2). Exposes `Set` of participant **identities** (player ids). |
| `GameTable.vue` — `isSpeakingPlayer(id)` → `:is-speaking` on `PlayerPresence` / `OpponentArea` | **Done** |
| `PlayerPresence.vue` — `isSpeaking` prop | **Partial**: applies static `ring-2 ring-state-turn-active` while speaking; **missing** pulse vs reduced-motion static border split per AC/GDD. |

### Architecture compliance

- Client: Vue 3 Composition API, `<script setup>`, UnoCSS, VueUse — [Source: _bmad-output/project-context.md]
- LiveKit: `livekit-client` ^2.18 — composable wrapper only, no duplicate room singleton — [Source: _bmad-output/planning-artifacts/game-architecture.md]
- A/V failures remain non-fatal (NFR23); speaking UI is decorative, not blocking gameplay.

### Files likely touched

- `packages/client/src/components/game/PlayerPresence.vue` — primary visual behavior
- `packages/client/src/components/game/PlayerPresence.test.ts` — reduced motion + speaking styles
- Possibly `packages/client/src/components/game/GameTable.vue` / `OpponentArea.vue` — only if AC 4 requires local status-dot parity or copy tweaks

### Testing standards

- Vitest via `vite-plus/test`; co-located `*.test.ts`
- Client: `happy-dom`, Pinia + Vue Test Utils as existing files use
- Mock `@vue-dnd-kit/core` only if a test file already does for parent chain; `PlayerPresence` tests typically mount in isolation

### Project structure notes

- No `@/` path aliases — relative imports or `@mahjong-game/shared` only ([Source: CLAUDE.md])
- Preserve `presenceFrame.ts` exported frame classes for consistent sizing across video/avatar

### References

- Epic story + AC: [_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md) — Story 6B.4
- GDD Player Presence (pulse + reduced motion): [_bmad-output/planning-artifacts/gdd.md](_bmad-output/planning-artifacts/gdd.md) — Player Presence
- UX-DR23 presence states: [_bmad-output/planning-artifacts/ux-design-specification.md](_bmad-output/planning-artifacts/ux-design-specification.md) (video vs avatar, speaking indicator, sizes)
- Prior LiveKit stories: [_bmad-output/implementation-artifacts/6b-2-video-thumbnails-at-seat-positions.md](_bmad-output/implementation-artifacts/6b-2-video-thumbnails-at-seat-positions.md), [_bmad-output/implementation-artifacts/6b-3-audio-video-controls-permission-handling.md](_bmad-output/implementation-artifacts/6b-3-audio-video-controls-permission-handling.md)

## Previous story intelligence (6B.3)

- `AVControls` + permission flows; `PlayerPresence` already uses `Transition` for video/avatar cross-fade — avoid fighting those transitions with heavy outer animations.
- File List in story footer must match git reality at review time (5B retro gate).
- `useLiveKit` room typing: use `getRoom(): Room | null` pattern when touching composable internals.

## Latest technical specifics (LiveKit JS)

- `RoomEvent.ActiveSpeakersChanged` delivers the room’s current active speakers; LiveKit ranks participants by audio activity (not a raw volume meter API in the app). Treat this as satisfying AC 5 **as long as** the UI does not add parallel heuristics from `AudioContext` or track volume APIs.

## Cross-session intelligence

- Epic 6B stories 6B.1–6B.3 established LiveKit connection, `participantVideoByIdentity`, seat wiring in `GameTable`, and A/V controls. This story is **presentation-layer** completion for speaking feedback plus reduced-motion accessibility.

## Project context reference

- Stack and cut-line LiveKit version: [_bmad-output/project-context.md](_bmad-output/project-context.md)
- Full architecture: [_bmad-output/planning-artifacts/game-architecture.md](_bmad-output/planning-artifacts/game-architecture.md)

## Story completion status

**done** — Code review complete; File List includes code + sprint + story artifact; backpressure gate re-verified on second pass (2026-04-06).

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation session)

### Debug Log References

_(none)_

### Completion Notes List

- **Speaking UI:** Outer frame uses scoped keyframe `player-presence-speaking-pulse` when `isSpeaking` and motion is allowed; `prefers-reduced-motion: reduce` uses static `ring-2 ring-state-turn-active` only. Same wrapper covers video and avatar (no `presenceFrame.ts` dimension changes).
- **Second pass (polish):** Animated halo reads RGB from `themeColors.state['turn-active']` via inline `--presence-speaking-rgb` on the frame button (keyframes use `rgb(var(--presence-speaking-rgb) / …)`). `isSpeakingPlayer` also requires LiveKit `connectionStatus === 'connected'`. Seat button `aria-label` appends `, speaking` when `isSpeaking`. Comment in `GameTable` clarifies opponent dots = game WS vs local dot = LiveKit voice.
- **AC 4 local parity:** Added `BaseBadge` status dot on local `PlayerPresence` (`data-testid="local-voice-status-dot"`) — **success** when LiveKit `connectionStatus === 'connected'`, **muted** otherwise (voice layer), alongside existing name/score in `BasePanel`. Opponents unchanged (name + connection dot already present).
- **AC 5 / disconnect:** No RMS path added; comment on `ActiveSpeakersChanged`. `activeSpeakers` already cleared in `disconnect` (covered by existing `useLiveKit` test).
- **Tests:** `PlayerPresence.test.ts` mocks both `useMediaQuery` queries; asserts animated vs static classes, video/avatar parity, `aria-label`, runtime reduced-motion toggle, and `GameTable.test.ts` covers local voice dot when LiveKit idle and when connected.
- **Second review pass:** Story artifact and sprint tracking listed in File List for git parity; backpressure gate re-run.

### File List

- `_bmad-output/implementation-artifacts/6b-4-speaking-indicator-avatar-fallback.md`
- `packages/client/src/components/game/PlayerPresence.vue`
- `packages/client/src/components/game/PlayerPresence.test.ts`
- `packages/client/src/composables/useLiveKit.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-06 — Story 6B.4 implemented: speaking pulse + reduced-motion static ring, VAD comment, local voice status dot, tests; status → review.
- 2026-04-06 — Second pass: token-driven halo CSS var, LiveKit-connected gate for speaking UI, aria-label, GameTable test for local voice dot, runtime reduced-motion test, story notes.
- 2026-04-06 — GDS code review: File List includes `sprint-status.yaml`; test rename + connected voice-dot test; status → done; sprint synced.
- 2026-04-06 — Second review pass: story markdown added to File List (untracked artifact until commit); completion notes updated; backpressure gate re-verified.
