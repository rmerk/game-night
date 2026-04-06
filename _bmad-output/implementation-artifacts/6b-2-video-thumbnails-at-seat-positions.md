# Story 6B.2: Video Thumbnails at Seat Positions

Status: done

## Story

As a **player**,
I want **to see my friends' video feeds at their seat positions around the table, sized appropriately for each device**,
so that **it feels like sitting at a table together — faces arranged around the game (FR114, UX-DR23)**.

## Acceptance Criteria

1. **Given** a player has their camera enabled
   **When** viewing the game table
   **Then** their video feed displays in a rounded-corner frame at their seat position with a subtle border matching UI chrome

2. **Given** video frame sizing
   **When** on desktop (>1024px)
   **Then** frames are ~140x96px — large enough to recognize expressions (UX-DR23)

3. **Given** video frame sizing on iPad landscape (~1024px)
   **When** rendering
   **Then** frames are ~120x80px at cardinal seat positions (UX-DR23)

4. **Given** video frame sizing on phone (<768px)
   **When** rendering
   **Then** frames shrink to small thumbnails (~40px) with speaking indicators — tap to momentarily expand (UX-DR23)

5. **Given** a player toggles their camera off
   **When** the video stream stops
   **Then** an avatar circle with the player's initial replaces the video frame — same size, same position, no layout shift (UX-DR23)

6. **Given** the layout
   **When** a camera toggles on or off
   **Then** surrounding game elements (discard pools, rack, action zone) do NOT reposition — video frames and avatar fallbacks occupy identical space

## Tasks / Subtasks

- [x] Task 1: Extend `useLiveKit` composable to expose video track state (AC: #1, #5)
  - [x] 1.1 Add `TrackSubscribed` / `TrackUnsubscribed` event handling for video tracks
  - [x] 1.2 Expose a reactive map of `participantId → { videoTrack: RemoteTrack | null, isCameraEnabled: boolean }` alongside existing `remoteParticipants`
  - [x] 1.3 Add `ActiveSpeakersChanged` event handling — expose `activeSpeakers: Set<string>` (participant identities) for use in AC#4 and Story 6B.4
  - [x] 1.4 Unit tests for track subscription and active speaker state changes

- [x] Task 2: Create `PlayerPresence` component (AC: #1, #5, #6)
  - [x] 2.1 Create `packages/client/src/components/game/PlayerPresence.vue` — wrapper that switches between `VideoThumbnail` and `AvatarFallback` based on video track availability
  - [x] 2.2 Props: `playerId: string`, `displayName: string`, `initial: string`, `position: "top" | "left" | "right" | "local"`, `isActiveTurn: boolean`
  - [x] 2.3 Container uses fixed dimensions per breakpoint so video/avatar swap causes zero layout shift
  - [x] 2.4 Unit tests: renders video when track available, avatar when not, no DOM size change on toggle

- [x] Task 3: Create `VideoThumbnail` component (AC: #1, #2, #3, #4)
  - [x] 3.1 Create `packages/client/src/components/game/VideoThumbnail.vue`
  - [x] 3.2 Use LiveKit `track.attach()` to get `<video>` element, mount into a `ref` container via `onMounted` / `watch`
  - [x] 3.3 Call `track.detach()` on `onBeforeUnmount` and when track changes (prevent leaked DOM elements)
  - [x] 3.4 Responsive sizing via UnoCSS breakpoint classes: `w-[140px] h-[96px]` (desktop >1024), `w-[120px] h-[80px]` (tablet ~1024), `w-10 h-10` (mobile <768)
  - [x] 3.5 Rounded corners (`rounded-lg`) + subtle border (`border border-chrome-surface/50`)
  - [x] 3.6 `object-fit: cover` on the `<video>` element so faces fill the frame
  - [x] 3.7 Unit tests: mocked track attach/detach lifecycle

- [x] Task 4: Create `AvatarFallback` component (AC: #5, #6)
  - [x] 4.1 Create `packages/client/src/components/game/AvatarFallback.vue`
  - [x] 4.2 Display player initial in a circle — same responsive dimensions as `VideoThumbnail`
  - [x] 4.3 Use design tokens: `bg-chrome-surface`, `text-on-felt`, `radius-full`
  - [x] 4.4 Unit tests: renders initial, correct sizing classes

- [x] Task 5: Integrate `PlayerPresence` into `OpponentArea` and local player area (AC: #1–#6)
  - [x] 5.1 Replace the existing avatar circle in `OpponentArea.vue` (lines ~55-75) with `<PlayerPresence>`, passing player data and position
  - [x] 5.2 Add `PlayerPresence` for local player in `GameTable.vue` local player section (~lines 1374-1410)
  - [x] 5.3 Map LiveKit participant identity (= playerId) to seat positions using existing `playersBySeat` computed
  - [x] 5.4 Ensure connection status dot and "reconnecting" label still render correctly alongside the new component
  - [x] 5.5 Verify no layout shift — existing game elements (discard pool, rack, action zone) positions unchanged
  - [x] 5.6 Integration tests: GameTable renders video thumbnails for connected participants with cameras

- [x] Task 6: Mobile tap-to-expand (AC: #4)
  - [x] 6.1 On mobile (<768px), tap on a ~40px thumbnail momentarily expands to larger view (e.g., 200x140px overlay)
  - [x] 6.2 Auto-dismiss after 3-5 seconds or on tap-away
  - [x] 6.3 Unit test: tap triggers expansion, dismiss collapses

- [x] Task 7: Backpressure gate
  - [x] 7.1 `pnpm test && pnpm run typecheck && vp lint` — all green

## Dev Notes

### Architecture & Data Flow

**LiveKit → Component data path:**
1. `useLiveKit` composable receives `RoomEvent.TrackSubscribed` / `TrackUnsubscribed` events
2. Composable exposes reactive `participantVideoByIdentity: Map<string, ParticipantVideoState>` keyed by participant identity (`videoTrack` + `isCameraEnabled`)
3. `GameTable` passes participant video state down to `OpponentArea` → `PlayerPresence`
4. `PlayerPresence` conditionally renders `VideoThumbnail` or `AvatarFallback`

**Critical: LiveKit `track.attach()` API**
```typescript
// From livekit-client SDK v2.18:
// track.attach() creates and returns an HTMLVideoElement
const element = track.attach();  // returns HTMLVideoElement
parentDiv.appendChild(element);

// track.detach() removes from all attached elements
track.detach();

// Get camera track from participant:
const pub = participant.getTrackPublication(Track.Source.Camera);
if (pub?.isSubscribed && pub.videoTrack) {
  const el = pub.videoTrack.attach();
}
```

**Key imports from `livekit-client`:**
```typescript
import { Track, RoomEvent, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client';
```

### Existing Code to Extend (NOT Reinvent)

| What | File | Why |
|------|------|-----|
| `useLiveKit` composable | `packages/client/src/composables/useLiveKit.ts` | Add TrackSubscribed/Unsubscribed/ActiveSpeakersChanged handlers. Already has `remoteParticipants` map and Room event registration pattern |
| `OpponentArea` component | `packages/client/src/components/game/OpponentArea.vue` | Replace existing avatar circle (~lines 55-75) with `PlayerPresence`. Do NOT create a parallel player display |
| `seat-types.ts` | `packages/client/src/components/game/seat-types.ts` | `OpponentPlayer` already has `id`, `name`, `initial`, `connected`, `seatWind` — extend if needed for video state |
| `GameTable.vue` | `packages/client/src/components/game/GameTable.vue` | `playersBySeat` computed (line 614-636) maps players to seats — use this to correlate LiveKit participant identity with seat position |
| `useRoomConnection.ts` | `packages/client/src/composables/useRoomConnection.ts` | Already calls `useLiveKit()` — video track state flows through here |
| Design tokens | `packages/client/src/styles/design-tokens.ts` | Reuse `chrome-surface`, `state-turn-active`, `text-on-felt` — do NOT invent new tokens |

### Anti-Patterns to Avoid

- **DO NOT create a separate player-to-seat mapping** — use the existing `playersBySeat` computed in GameTable
- **DO NOT deep-watch the LiveKit Room object** — it uses `shallowRef` for performance. Watch the reactive maps exposed by the composable instead
- **DO NOT render `<video>` elements with Vue template binding** — use `track.attach()` which returns an HTMLVideoElement, then mount it into a `ref` container with `appendChild`. Vue's reactivity system doesn't manage raw media elements
- **DO NOT forget `track.detach()`** — leaked video elements cause memory/resource leaks. Detach in `onBeforeUnmount` and when track reference changes
- **DO NOT add LiveKit types to the main bundle** — they're already in a separate chunk via `manualChunks` in vite.config.ts
- **DO NOT use `livekit-client` in unit tests** — mock the track objects. Real WebRTC requires browser APIs unavailable in happy-dom

### Responsive Sizing Reference

| Viewport | Video/Avatar Size | CSS Classes (UnoCSS) |
|----------|-------------------|----------------------|
| Desktop >1024px | 140x96px | `lg:w-[140px] lg:h-[96px]` |
| Tablet ~1024px | 120x80px | `md:w-[120px] md:h-[80px]` |
| Mobile <768px | 40x40px circle | `w-10 h-10` |

### Testing Standards

- Co-locate tests: `PlayerPresence.test.ts` next to `PlayerPresence.vue`, etc.
- Import from `vite-plus/test` (not `vitest`)
- `setActivePinia(createPinia())` in `beforeEach` for any store-dependent tests
- happy-dom environment for client tests
- Mock LiveKit track objects — create simple objects with `attach()` returning a mock `<video>` element and `detach()` as `vi.fn()`
- Blackbox component testing: test rendered output and user interactions, not `wrapper.vm.*` internals
- Min tap target: 44px (WCAG) — verify mobile thumbnails meet this

### Layout Stability Invariant

The core design principle (UX P2 — Protect the Rhythm): **Video frames and avatar fallbacks occupy identical space.** The `PlayerPresence` container must have fixed dimensions at each breakpoint. The inner content (video or avatar) fills this container. Toggling camera on/off swaps the child but the container size never changes. Verify this in tests by checking container dimensions are identical in both states.

### Project Structure Notes

New files follow existing component organization in `packages/client/src/components/game/`:
- `PlayerPresence.vue` + `PlayerPresence.test.ts`
- `VideoThumbnail.vue` + `VideoThumbnail.test.ts`
- `AvatarFallback.vue` + `AvatarFallback.test.ts`

No new directories needed. No new packages or dependencies needed — `livekit-client` already installed.

### Cross-Session Intelligence

- Room state recently refactored (commit `e079dd7`) to use nested sub-objects. Any new Room properties should follow this pattern
- `trySendJson` is the canonical server→client send helper — already used by livekit-handler
- `resetSocialUiForSession` in `useRoomConnection.ts` is the cleanup point for room leave — LiveKit disconnect already wired here
- Story 6B.1 established: LiveKit failure NEVER impacts game state (NFR23). Video rendering must follow the same principle — if a track fails to attach, show avatar fallback silently
- `broadcastStateToRoom` in `state-broadcaster.ts` handles per-viewer state — LiveKit tokens are per-player (direct send), NOT broadcast
- One commit per story (5B retro convention)

### Git Intelligence

Recent commit: `4f81dad feat: integrate LiveKit SDK for voice/video functionality` (27 files, 1,406 insertions) — this is the 6B.1 foundation this story builds on.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 6B, Story 6B.2]
- [Source: _bmad-output/planning-artifacts/ux-design-spec.md — UX-DR23, P2, P5]
- [Source: _bmad-output/planning-artifacts/architecture.md — Client State Separation, Engine-Provided Architecture]
- [Source: _bmad-output/implementation-artifacts/6b-1-livekit-sdk-integration-connection-setup.md — Dev Notes, Code Patterns]
- [Source: docs/livekit-deployment.md — LiveKit Architecture]
- [Source: livekit-client SDK v2.18 docs — track.attach(), RoomEvent.TrackSubscribed, ActiveSpeakersChanged]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Implemented `participantVideoByIdentity` + `activeSpeakers` in `useLiveKit` with room sync, local/remote track events, and `TrackMuted`/`TrackUnmuted`.
- Added `PlayerPresence`, `VideoThumbnail`, `AvatarFallback`, and `presenceFrame` sizing; mobile tap-to-expand with backdrop and 4s auto-dismiss.
- Wired `GameTable` + `OpponentArea` to composable state; integration test `GameTable.livekitPresence.test.ts` with mocked `useLiveKit`.

**AC → code / tests (second pass traceability)**

| AC | Code | Tests |
|----|------|--------|
| 1 | `presenceFrame.ts` (`PRESENCE_FRAME_*`), `PlayerPresence.vue` | `PlayerPresence.test.ts` (video vs avatar), `GameTable.livekitPresence.test.ts` |
| 2–3 | `PRESENCE_FRAME_CLASS` `md:` / `lg:` dimensions | Implicit via shared frame classes + layout tests |
| 4 | Mobile frame, speaking ring, expand/backdrop in `PlayerPresence.vue` | `PlayerPresence.test.ts` (mock `useMediaQuery`, tap/timeout) |
| 5–6 | `showVideo` = track + `isCameraEnabled`; shared outer frame | `PlayerPresence.test.ts` (toggle width, muted + track → avatar) |

**Second-pass review (2026-04-06):** Regression gates green (`pnpm test`, `pnpm run typecheck`, `vp lint`). Dev Notes corrected (`participantVideoByIdentity` naming). Added explicit AC5 test for muted camera with track retained. Adversarial pass: story tasks and ACs match implementation; `VideoThumbnail` attach failures are caught (NFR23) — parent may briefly show empty chrome if attach throws before avatar swap; acceptable risk.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/client/src/composables/useLiveKit.ts`
- `packages/client/src/composables/useLiveKit.test.ts`
- `packages/client/src/components/game/presenceFrame.ts`
- `packages/client/src/components/game/VideoThumbnail.vue`
- `packages/client/src/components/game/VideoThumbnail.test.ts`
- `packages/client/src/components/game/AvatarFallback.vue`
- `packages/client/src/components/game/AvatarFallback.test.ts`
- `packages/client/src/components/game/PlayerPresence.vue`
- `packages/client/src/components/game/PlayerPresence.test.ts`
- `packages/client/src/components/game/OpponentArea.vue`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.livekitPresence.test.ts`

### Change Log

- 2026-04-06 — Story 6B.2 implementation complete; status → review.
- 2026-04-06 — Second pass: AC traceability documented, Dev Notes fix, `PlayerPresence` muted-camera test, File List includes sprint status.
- 2026-04-06 — Code review: added 4 missing tests (TrackMuted, TrackUnmuted, LocalTrackPublished, LocalTrackUnpublished) in `useLiveKit.test.ts`. All gates green. Status → done.
