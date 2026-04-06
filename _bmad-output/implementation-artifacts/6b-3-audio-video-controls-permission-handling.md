# Story 6B.3: Audio/Video Controls & Permission Handling

Status: done

## Story

As a **player**,
I want **simple mic and camera toggle buttons with friendly guidance for browser permission prompts**,
so that **even non-technical players can enable voice and video without confusion (FR115, UX-DR46)**.

## Acceptance Criteria

1. **Permission guidance before browser dialog** — Given a player joins the room / When browser mic/camera permissions haven't been granted yet / Then a friendly permission prompt appears with guidance: "Allow mic so your friends can hear you" — not the raw browser permission dialog alone (UX-DR46).

2. **Streams start within 5 seconds** — Given the player grants mic/camera permissions / When A/V connects / Then voice and video streams begin within 5 seconds in 95% of sessions (NFR50).

3. **Graceful denial** — Given the player denies or dismisses the permission prompt / When A/V is unavailable / Then the game continues with avatar fallback and text chat — no error modal, no repeated prompting, graceful degradation (UX-DR46).

4. **Persistent toggle buttons** — Given mic and camera toggle buttons / When viewing the A/V controls / Then persistent mic and camera icon buttons are visible in the controls area (desktop) or bottom bar (mobile) — Tertiary tier styling (FR115).

5. **Mic toggle instant feedback** — Given the mic toggle / When tapped / Then the mic mutes/unmutes with instant visual feedback (icon change) and no audible pop or click.

6. **Camera toggle with avatar swap** — Given the camera toggle / When tapped / Then the video stream starts/stops with the avatar fallback appearing/disappearing smoothly — no layout shift.

## Tasks / Subtasks

- [x] Task 1: Extend `useLiveKit` composable with local A/V control (AC: 2, 5, 6)
  - [x] 1.1 Add module-level reactive refs: `localMicEnabled: Ref<boolean>`, `localCameraEnabled: Ref<boolean>`
  - [x] 1.2 Add `toggleMic(): Promise<void>` — calls `room.localParticipant.setMicrophoneEnabled(!current)` with try/catch silent fallback
  - [x] 1.3 Add `toggleCamera(): Promise<void>` — calls `room.localParticipant.setCameraEnabled(!current)` with try/catch silent fallback
  - [x] 1.4 Wire `LocalTrackPublished`/`LocalTrackUnpublished` events for `Track.Source.Microphone` to sync `localMicEnabled`
  - [x] 1.5 Wire existing `LocalTrackPublished`/`LocalTrackUnpublished` for `Track.Source.Camera` to sync `localCameraEnabled` (may already partially exist)
  - [x] 1.6 Add `requestPermissions(): Promise<'granted' | 'denied'>` — calls `room.localParticipant.enableCameraAndMicrophone()` wrapped in try/catch that returns `'denied'` on `MediaDeviceFailure.PermissionDenied`
  - [x] 1.7 Export new refs and methods from composable return object
  - [x] 1.8 Add tests for all new methods and state transitions in `useLiveKit.test.ts`

- [x] Task 2: Permission state tracking (AC: 1, 3)
  - [x] 2.1 Use VueUse `usePermission('microphone')` and `usePermission('camera')` in the composable or a companion `useAVControls` composable
  - [x] 2.2 Derive a combined `avPermissionState: Ref<'granted' | 'denied' | 'prompt' | 'unknown'>` — `'granted'` only when both are granted; `'denied'` if either is denied; `'prompt'` if either is prompt and none denied
  - [x] 2.3 Add tests for permission state derivation

- [x] Task 3: Create `AVControls.vue` component (AC: 4, 5, 6)
  - [x] 3.1 Create `packages/client/src/components/game/AVControls.vue` — two icon toggle buttons (mic, camera)
  - [x] 3.2 Props: `isMicEnabled: boolean`, `isCameraEnabled: boolean`, `connectionStatus: string`, `permissionState: string`
  - [x] 3.3 Emits: `toggle-mic`, `toggle-camera`
  - [x] 3.4 Tertiary tier styling: transparent bg, `text-on-felt` / `text-primary`, subtle border, 44px min tap target
  - [x] 3.5 Instant icon swap on tap (mic: filled mic ↔ crossed-out mic; camera: filled camera ↔ crossed-out camera)
  - [x] 3.6 Disabled state when `connectionStatus !== 'connected'` — buttons visible but `aria-disabled="true"`, muted styling
  - [x] 3.7 Create `AVControls.test.ts` with tests for: icon states, tap triggers emit, disabled when disconnected, accessibility attributes

- [x] Task 4: Create permission guidance UI (AC: 1, 3)
  - [x] 4.1 Create a friendly pre-prompt overlay/inline banner inside `AVControls` or as a separate `PermissionPrompt` child — "Allow mic so your friends can hear you" with a "Turn on A/V" button
  - [x] 4.2 Show only when `avPermissionState === 'prompt'` (first time, before browser dialog)
  - [x] 4.3 Tapping the button calls `requestPermissions()` which triggers `enableCameraAndMicrophone()` (single browser dialog for both)
  - [x] 4.4 On denial: dismiss prompt, show subtle inline "A/V unavailable" text, no error modal, no re-prompt
  - [x] 4.5 On grant: prompt disappears, toggle buttons become active
  - [x] 4.6 Add tests for prompt visibility, grant flow, denial flow

- [x] Task 5: Integrate into `MobileBottomBar.vue` (AC: 4)
  - [x] 5.1 Replace the stub A/V button (lines ~139-147, `aria-disabled="true"`, mic emoji) with `<AVControls>` component
  - [x] 5.2 Wire props from `useLiveKit()` and permission state
  - [x] 5.3 Wire emits to composable `toggleMic()` / `toggleCamera()`
  - [x] 5.4 Verify 44px min tap targets at mobile size
  - [x] 5.5 Add/update `MobileBottomBar` tests for A/V control rendering and interactions

- [x] Task 6: Integrate into `GameTable.vue` desktop layout (AC: 4)
  - [x] 6.1 Add `<AVControls>` to the desktop layout in the controls area (near `data-testid="controls-zone-shell"`)
  - [x] 6.2 Show/hide based on viewport: desktop shows inline controls, mobile defers to MobileBottomBar
  - [x] 6.3 Wire props and events same as mobile
  - [x] 6.4 Add integration test verifying desktop A/V controls render with correct state

- [x] Task 7: Verify backpressure gate (all ACs)
  - [x] 7.1 `pnpm test` — all tests pass
  - [x] 7.2 `pnpm run typecheck` — no type errors
  - [x] 7.3 `vp lint` — no lint errors
  - [x] 7.4 Verify no layout shift when toggling camera on/off (existing `presenceFrame.ts` sizing guarantees this)

## Dev Notes

### Architecture & Data Flow

6B.3 extends the LiveKit infrastructure established in 6B.1 and 6B.2. The data flow for local controls is:

1. `AVControls.vue` (UI) → emits `toggle-mic` / `toggle-camera`
2. Parent calls `useLiveKit().toggleMic()` / `toggleCamera()`
3. Composable calls `room.localParticipant.setMicrophoneEnabled()` / `setCameraEnabled()`
4. LiveKit SDK fires `LocalTrackPublished` / `LocalTrackUnpublished` events
5. Composable updates `localMicEnabled` / `localCameraEnabled` reactive refs
6. Components react to changed state (icon swap, avatar swap)

The `room` ref in `useLiveKit.ts` is typed as `ShallowRef<unknown>` for declaration-emit portability. To call `localParticipant` methods, use a typed accessor pattern:
```typescript
import type { Room } from 'livekit-client'
function getRoom(): Room | null {
  return room.value as Room | null
}
```
This mirrors the `asTrack()` pattern in `VideoThumbnail.vue`.

### LiveKit SDK API Reference (v2.18)

```typescript
// Mic/camera toggle — handles publish/unpublish + mute automatically
room.localParticipant.setMicrophoneEnabled(enabled: boolean): Promise<LocalTrackPublication | undefined>
room.localParticipant.setCameraEnabled(enabled: boolean): Promise<LocalTrackPublication | undefined>

// Single browser permission dialog for both mic + camera
room.localParticipant.enableCameraAndMicrophone(): Promise<void>

// Current state getters (base Participant class)
room.localParticipant.isMicrophoneEnabled  // boolean
room.localParticipant.isCameraEnabled      // boolean

// Error classification
import { MediaDeviceFailure } from 'livekit-client'
MediaDeviceFailure.getFailure(error) // → 'PermissionDenied' | 'NotFound' | 'DeviceInUse' | 'Other' | undefined

// Device enumeration (for future story if needed)
Room.getLocalDevices(kind?: MediaDeviceKind): Promise<MediaDeviceInfo[]>
room.switchActiveDevice(kind, deviceId): Promise<boolean>
```

### Critical Invariants

- **NFR23: LiveKit failure NEVER impacts game state.** All A/V operations must be wrapped in try/catch with silent fallback. No error modals. Permission denial → avatar fallback + text chat, game continues.
- **UX-DR46: No repeated prompting.** If the browser permission state is `'denied'`, do NOT call `enableCameraAndMicrophone()` again — it will fail silently. Show a subtle "A/V unavailable" message with optional link to browser settings instructions.
- **No audible pop on mic toggle.** The LiveKit SDK's `setMicrophoneEnabled(false)` mutes the track in-place (does not disconnect). This should be clean, but test on real devices.
- **Layout stability.** Camera toggle on/off must not cause layout shift. The `presenceFrame.ts` sizing constants and `PlayerPresence.vue` fixed-dimension container from 6B.2 already guarantee this.

### Key Files to Modify/Create

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `packages/client/src/composables/useLiveKit.ts` | Add `localMicEnabled`, `localCameraEnabled`, `toggleMic()`, `toggleCamera()`, `requestPermissions()` |
| MODIFY | `packages/client/src/composables/useLiveKit.test.ts` | Tests for new methods and state |
| CREATE | `packages/client/src/components/game/AVControls.vue` | Mic + camera toggle buttons with permission prompt |
| CREATE | `packages/client/src/components/game/AVControls.test.ts` | Component tests |
| MODIFY | `packages/client/src/components/game/MobileBottomBar.vue` | Replace stub A/V button with `<AVControls>` |
| MODIFY | `packages/client/src/components/game/GameTable.vue` | Add `<AVControls>` to desktop controls area |
| MODIFY (maybe) | `packages/client/src/stores/liveKit.ts` | Only if permission state needs cross-component persistence beyond module-level composable |

### Anti-Patterns (DO NOT)

- **DO NOT import `livekit-client` directly in components** — all SDK interaction goes through `useLiveKit` composable. The SDK is in a separate bundle chunk.
- **DO NOT deep-watch the `room` shallowRef** — watch the reactive refs (`localMicEnabled`, `localCameraEnabled`) exposed by the composable.
- **DO NOT show error modals for A/V failures** — silent degradation only. Dev-mode `console.warn` is acceptable.
- **DO NOT re-prompt after permission denial** — check `usePermission()` state first; if `'denied'`, skip the SDK call entirely.
- **DO NOT add `onUnmounted` cleanup inside `useLiveKit`** — teardown is managed by `useRoomConnection` via `resetSocialUiForSession`. This was an intentional design decision from 6B.1.
- **DO NOT use real `livekit-client` in tests** — mock the composable or track objects. WebRTC APIs are unavailable in happy-dom.
- **DO NOT add new Vite chunks or dependencies** — `livekit-client` is already chunked. VueUse `usePermission` is already available.

### UX Styling Reference

**Button tier:** Tertiary — transparent background, `text-on-felt` or `text-primary`, subtle border.

**Icon states:**
- Mic ON: filled microphone icon
- Mic OFF (muted): crossed-out microphone icon
- Camera ON: filled video camera icon
- Camera OFF: crossed-out video camera icon

**Tap targets:** 44px minimum (WCAG). Use `min-h-11 min-w-11` or equivalent UnoCSS.

**Placement:**
- Desktop (>=768px): controls area in GameTable layout, persistent
- Mobile (<768px): inside MobileBottomBar, replacing the current stub button

**Toast feedback (optional):** A/V state changes can use the toast channel (3s auto-dismiss). Do not stack more than 1 toast on phone, 2 on tablet/desktop.

### VueUse Permission API

```typescript
import { usePermission } from '@vueuse/core'
const micPermission = usePermission('microphone')   // Ref<PermissionState | ''>
const camPermission = usePermission('camera')        // Ref<PermissionState | ''>
// PermissionState = 'granted' | 'denied' | 'prompt'
```

Use these to determine whether to show the friendly pre-prompt (state === `'prompt'`), disable controls (state === `'denied'`), or allow direct toggles (state === `'granted'`).

### Testing Patterns (from 6B.1 / 6B.2)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'

// Mock useLiveKit for component tests
vi.mock('../composables/useLiveKit', () => ({
  useLiveKit: vi.fn(() => ({
    connectionStatus: ref('connected'),
    localMicEnabled: ref(true),
    localCameraEnabled: ref(true),
    toggleMic: vi.fn(),
    toggleCamera: vi.fn(),
    requestPermissions: vi.fn(),
  }))
}))

// Mock usePermission for permission state tests
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal()),
  usePermission: vi.fn(() => ref('prompt')),
}))

beforeEach(() => { setActivePinia(createPinia()) })
```

**Test scenarios required:**
1. Permission prompt visible when state is `'prompt'`, hidden when `'granted'`
2. Tapping "Turn on A/V" calls `requestPermissions()`
3. After denial: no error modal, subtle "A/V unavailable" text shown, game continues
4. Mic toggle: icon changes instantly, `toggleMic()` called
5. Camera toggle: icon changes instantly, `toggleCamera()` called
6. Buttons disabled when `connectionStatus !== 'connected'`
7. 44px min tap targets
8. `aria-label` attributes for accessibility

### Project Structure Notes

All new files follow existing patterns in `packages/client/src/components/game/`. No new directories needed. No new dependencies — `livekit-client` (6B.1) and `@vueuse/core` (existing) provide everything.

### Previous Story Intelligence (6B.2)

- `participantVideoByIdentity` map is keyed by player identity, contains `{ videoTrack, isCameraEnabled }` — 6B.3's camera toggle updates the local player's entry here automatically when `setCameraEnabled()` fires `LocalTrackPublished`/`LocalTrackUnpublished`.
- `showVideo` logic in `PlayerPresence.vue` is `videoTrack !== null && isCameraEnabled` — camera off via toggle correctly shows avatar fallback.
- Test mocking pattern: consolidated LiveKit test state into single hoisted object. Follow this pattern for new tests.
- `presenceFrame.ts` constants ensure fixed dimensions at each breakpoint — no layout shift risk when toggling camera.

### Cross-Session Intelligence

- Room type recently refactored to use nested sub-objects (commit `e079dd7`) — any new Room-level state should follow this pattern (though 6B.3 is client-only, no Room model changes needed).
- One commit per story convention (5B retro) — squash all work into a single conventional commit.
- `resetSocialUiForSession` in `useRoomConnection.ts` is the cleanup hook — LiveKit disconnect already wired here from 6B.1.
- `trySendJson` is the canonical WS send helper — not needed for 6B.3 (no new protocol messages).

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 6B, Story 6B.3 lines 3150-3180]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR46 A/V permission flow]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — LiveKit integration, component patterns]
- [Source: docs/livekit-deployment.md — production deployment reference]
- [Source: _bmad-output/implementation-artifacts/6b-1-livekit-sdk-integration-connection-setup.md — composable patterns]
- [Source: _bmad-output/implementation-artifacts/6b-2-video-thumbnails-at-seat-positions.md — video state, testing patterns]

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation session 2026-04-06).

### Debug Log References

### Completion Notes List

- Extended `useLiveKit` with `localMicEnabled` / `localCameraEnabled`, `syncLocalAvFromRoom`, mic/camera toggles, `requestPermissions`, `avPermissionState` (VueUse `usePermission` singleton), and expanded room event handlers for microphone tracks.
- Added `AVControls.vue` with tertiary styling, `surface` prop (`felt` | `chrome`), permission banner (`prompt`), unavailable message (`denied`), and `request-av` emit wired to `requestPermissions` from parents.
- Desktop: `GameTable` shows `AVControls` in `desktop-av-controls` (`md:flex`); mobile: `MobileBottomBar` only (`md:hidden` on bottom bar wrapper). `GameTable.livekitPresence.test.ts` asserts desktop shell.
- NFR50 (5s streams): not automated; relies on existing LiveKit connect path and manual verification.

### Change Log

- 2026-04-06: Story 6B.3 implemented — A/V controls, permission UX, tests, backpressure gate green.

### File List

- `packages/client/src/composables/useLiveKit.ts`
- `packages/client/src/composables/useLiveKit.test.ts`
- `packages/client/src/components/game/AVControls.vue`
- `packages/client/src/components/game/AVControls.test.ts`
- `packages/client/src/components/game/PlayerPresence.vue`
- `packages/client/src/components/game/MobileBottomBar.vue`
- `packages/client/src/components/game/MobileBottomBar.test.ts`
- `packages/client/src/components/game/GameTable.vue`
- `packages/client/src/components/game/GameTable.livekitPresence.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
