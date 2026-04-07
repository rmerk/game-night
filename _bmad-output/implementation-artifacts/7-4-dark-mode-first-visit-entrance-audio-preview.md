# Story 7.4: Dark Mode, First-Visit Entrance & Audio Preview

Status: done

## Story

As a **player**,
I want **automatic dark mode that follows my system preference, a graceful first-visit visual entrance, and a brief audio preview on first join**,
so that **evening play is comfortable, first impressions are polished, and players discover the sound design (NFR41, UX-DR47, UX-DR48)**.

## Acceptance Criteria

1. **Dark mode auto-switch** — When the player's system is set to dark mode, the UI chrome automatically switches: cream/warm-white → dark warm gray/charcoal, text inverts to light-on-dark, gold accents unchanged, felt table and tile rendering unchanged (NFR41).

2. **Dark mode settings** — Three choices: Auto (follow system, default), Light, Dark — stored in localStorage via `usePreferencesStore`.

3. **Dark mode WCAG AA** — WCAG AA contrast maintained in dark mode independently. Mode-adaptive error colors apply (UX-DR7: `state-error` dark = `#E8896E`).

4. **First-visit entrance** — Very first page load (no localStorage data): a graceful 2-second entrance plays — felt texture fades in from warm neutral, tiles materialize subtly. Sets aesthetic tone before anything else (UX-DR47).

5. **Subsequent visits skip entrance** — One-time experience tracked in localStorage. All subsequent page loads skip the entrance.

6. **Reduced-motion entrance skip** — Under `prefers-reduced-motion`, the entrance is skipped entirely — table appears instantly. Still marks seen so it never retries (UX-DR47).

7. **First-join audio preview** — Player's first game room entry: a brief 3-second audio showcase plays (tile draw click → discard clack → Mahjong motif) with a subtle toast: "Sound is on. Adjust in settings." (UX-DR48).

8. **Audio preview one-time** — Preview plays only once (tracked in localStorage). Not replayed on subsequent room joins or reconnections.

## Tasks / Subtasks

- [x] Task 1: Create `usePreferencesStore` (AC: 1, 2, 5, 7, 8)
  - [x] 1.1 Create `packages/client/src/stores/preferences.ts` — define and export `usePreferencesStore`
  - [x] 1.2 Store state: `darkMode: ref<'auto' | 'light' | 'dark'>('auto')`, `hasSeenEntrance: ref<boolean>(false)`, `hasSeenAudioPreview: ref<boolean>(false)`
  - [x] 1.3 Persistence: localStorage key `mahjong-prefs-v1` (shape: `{ darkMode, hasSeenEntrance, hasSeenAudioPreview }`). Follow `handGuidancePreferences.ts` — manual `loadPersisted()` + `persist()` + `hydrate()`. Call `hydrate()` at store init. DO NOT use VueUse `useLocalStorage`.
  - [x] 1.4 Setters: `setDarkMode(value: 'auto' | 'light' | 'dark')`, `markEntranceSeen()`, `markAudioPreviewSeen()` — each updates the ref and calls `persist()`
  - [x] 1.5 Create `packages/client/src/stores/preferences.test.ts`: test hydrate reads localStorage, persist writes correctly, `darkMode` default is `'auto'`, flag setters work, second `hydrate()` call reads stored state

- [x] Task 2: Wire dark mode class in `App.vue` (AC: 1, 2, 3)
  - [x] 2.1 In `packages/client/src/App.vue` `<script setup>`, add:
    ```typescript
    import { useMediaQuery } from '@vueuse/core';
    const prefsStore = usePreferencesStore();
    const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
    const isDark = computed(
      () => prefsStore.darkMode === 'dark' || (prefsStore.darkMode === 'auto' && systemDark.value)
    );
    watchEffect(() => {
      document.documentElement.classList.toggle('theme-dark', isDark.value);
    });
    ```
  - [x] 2.2 Apply to `document.documentElement` (`<html>`), NOT `<body>` — ensures `.theme-dark` covers `<Teleport to="body">` children (modals, toasts)
  - [x] 2.3 Add test coverage (in `App.vue` test file or new `App.test.ts`): mock `usePreferencesStore` + `window.matchMedia`, assert `document.documentElement.classList` gets/loses `theme-dark` correctly for all three modes

- [x] Task 3: Dark mode toggle UI in settings panel (AC: 2)
  - [x] 3.1 Add a "Display" or "Theme" section to `packages/client/src/components/game/AudioSettingsPanel.vue` — three-option selector for Auto / Light / Dark using the existing `BaseToggle` or button group pattern (follow `RoomSettingsPanel.vue` style — UnoCSS, no external UI library)
  - [x] 3.2 Wire to `usePreferencesStore().setDarkMode(value)`. Changes apply immediately (App.vue `watchEffect` reacts).
  - [x] 3.3 Add to `AudioSettingsPanel.test.ts`: assert theme selection calls `setDarkMode` with correct value

- [x] Task 4: First-visit entrance animation (AC: 4, 5, 6)
  - [x] 4.1 Create `packages/client/src/components/shared/FirstVisitEntrance.vue` — full-viewport overlay using `<Teleport to="body">`. Fades out over 2 seconds from opaque (`var(--chrome-surface)`) to transparent, then removes itself.
  - [x] 4.2 Logic in `onMounted`:
    - Check `prefsStore.hasSeenEntrance` and `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
    - If already seen OR reduced-motion: call `markEntranceSeen()` if not yet done, do not show overlay
    - Otherwise: show overlay (`visible = true`), next tick start CSS fade-out, after 2000ms set `visible = false`, call `markEntranceSeen()`
  - [x] 4.3 CSS: `transition: opacity 2000ms ease-out` (plain CSS, NOT motion-v — no orchestration needed for a single fade)
  - [x] 4.4 Mount `<FirstVisitEntrance />` in `App.vue` directly (before `<RouterView />`) so it covers the first screen regardless of route
  - [x] 4.5 Create `packages/client/src/components/shared/FirstVisitEntrance.test.ts`: test shows on first mount (`hasSeenEntrance=false`), skipped when `hasSeenEntrance=true`, skipped under reduced-motion, `markEntranceSeen()` called in all cases

- [x] Task 5: First-join audio preview in `RoomView.vue` (AC: 7, 8)
  - [x] 5.1 In `packages/client/src/views/RoomView.vue` `<script setup>`, import `usePreferencesStore` and `useAudioStore`
  - [x] 5.2 Watch for the first non-null room state (connection established). Use `watch(() => lobbyState.value ?? playerGameView.value, …, { once: true })` — `lobbyState` and `playerGameView` are mutually exclusive refs from `useRoomConnection()`; the nullish coalescing covers lobby-first joins and in-progress joins where the server sends `PlayerGameView` first (`buildCurrentStateMessage` when `room.gameState` is set).
  - [x] 5.3 Guard: if `prefsStore.hasSeenAudioPreview` is already true, skip. Call `prefsStore.markAudioPreviewSeen()` immediately (before playing) to prevent replay on remount.
  - [x] 5.4 If `!audioStore.masterMuted`: play preview sequence:
    ```typescript
    void audioStore.play('tile-draw', 'gameplay');
    await new Promise(r => setTimeout(r, 800));
    void audioStore.play('tile-discard', 'gameplay');
    await new Promise(r => setTimeout(r, 800));
    void audioStore.play('mahjong-motif', 'gameplay');
    ```
  - [x] 5.5 Show toast immediately when preview starts. Use the same `BaseToast` + `audioPreviewToastVisible` pattern as other room toasts. Render the audio-preview toast in a fixed slot visible whenever `lobbyState || playerGameView` (not only inside the lobby branch) so in-progress joins still see the message. Message: `'Sound is on. Adjust in settings.'`. Auto-clear after 4 seconds.
  - [x] 5.6 Add tests in `RoomView.test.ts`: mock `usePreferencesStore` (return `hasSeenAudioPreview: false`) and `useAudioStore` (spy `play`), assert `play` called when `lobbyState` becomes non-null from null; assert `play` called when only `playerGameView` becomes non-null (in-progress join); mock with `hasSeenAudioPreview: true` and assert `play` NOT called; assert muted path marks seen without `play`.

- [x] Task 6: Backpressure gate (AC: all)
  - [x] 6.1 Run `pnpm test && pnpm run typecheck && vp lint` — all must pass before story is complete

## Dev Notes

### Dark Mode — CSS Already Done, JS Wiring Only

**`packages/client/src/styles/theme.css` already has everything:**
- Lines 62–85: `@media (prefers-color-scheme: dark)` remaps chrome-layer tokens at `:root`
- Lines 87–108: `.theme-dark` class applies the same remapping manually
- Dark mood variants: `.theme-dark .mood-arriving/playing/lingering` — also present

**This story only adds:** `usePreferencesStore` (user's three-way choice) + 4-5 lines in `App.vue` to toggle `.theme-dark` on `document.documentElement`.

**Token constraints (never change between modes):**
- `felt-teal: #2A6B6B` — felt table, constant
- `gold-accent: #C4A35A` / `gold-accent-hover: #D4B36A` — gold, constant
- `suit-bam/crak/dot` — tile suit colors, constant
- Only **chrome layer** changes: `--chrome-surface`, `--chrome-elevated`, `--chrome-border`, `--text-primary`, `--text-secondary`, `--state-error`

WCAG contrast is pre-handled by `theme.css`. No new token work needed.

### `usePreferencesStore` — Expected File Path

Architecture doc (`game-architecture.md:1063`) lists `preferences.ts` in `stores/` directory. The file does NOT exist — create it. The architecture lists four responsibilities (dark mode override, font size, audio volumes, hint toggle). Audio volumes are in `useAudioStore`. Hand guidance is in `useHandGuidanceStore`. For this story, implement only what's needed: `darkMode`, `hasSeenEntrance`, `hasSeenAudioPreview`.

```typescript
// packages/client/src/stores/preferences.ts
const STORAGE_KEY = 'mahjong-prefs-v1';

interface PersistedShape {
  darkMode: 'auto' | 'light' | 'dark';
  hasSeenEntrance: boolean;
  hasSeenAudioPreview: boolean;
}

const defaults: PersistedShape = {
  darkMode: 'auto',
  hasSeenEntrance: false,
  hasSeenAudioPreview: false,
};

function loadPersisted(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}
```

Pattern reference: `packages/client/src/stores/handGuidancePreferences.ts` (exact structure to follow).

### Dark Mode Class — `document.documentElement`, Not `document.body`

All `<Teleport to="body">` components (Celebration overlay, modals, toast) render as children of `<body>`. Class on `document.documentElement` (`<html>`) cascades into them via CSS inheritance + `.theme-dark .mood-*` selectors. If applied to `<body>`, teleported children miss the dark variants.

```typescript
// App.vue
watchEffect(() => {
  document.documentElement.classList.toggle('theme-dark', isDark.value);
});
```

`useMediaQuery` is from `@vueuse/core` — already in client deps. No new dependencies needed.

### First-Visit Entrance — Plain CSS, Not motion-v

This is a single fade-out overlay: `opacity: 1 → 0` over 2 seconds. Motion for Vue is for component animation sequences (Celebration). For a one-time viewport overlay, plain CSS `transition` is simpler and has no external dep cost.

```vue
<!-- FirstVisitEntrance.vue skeleton -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[200] pointer-events-none"
      :style="{
        background: 'var(--chrome-surface)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 2000ms ease-out',
      }"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { usePreferencesStore } from '../../stores/preferences';

const prefsStore = usePreferencesStore();
const visible = ref(false);
const fading = ref(false);

onMounted(async () => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefsStore.hasSeenEntrance || reduced) {
    if (!prefsStore.hasSeenEntrance) prefsStore.markEntranceSeen();
    return;
  }
  visible.value = true;
  await nextTick();
  fading.value = true; // triggers CSS transition
  setTimeout(() => {
    visible.value = false;
    prefsStore.markEntranceSeen();
  }, 2100); // slightly over 2000ms to let transition complete
});
</script>
```

`z-[200]` ensures it sits above all other UI (modals use `z-50`). `pointer-events-none` so it doesn't block interaction once fade begins.

### Audio Preview — Gesture-Safe Timing

Audio preview fires on room join (user clicked "Create Room" or "Join Room") — a user gesture already occurred, satisfying browser AudioContext autoplay requirements. The lazy-init in `useAudioStore.getCtx()` (fixed in b8e93f8) creates AudioContext on first `play()` call and immediately runs `syncGains()` to apply persisted preferences.

**First room state:** The server may send either a lobby-shaped state or a `PlayerGameView` as the first `STATE_UPDATE` (see `buildCurrentStateMessage` in `state-broadcaster.ts`). The client keeps only one of `lobbyState` / `playerGameView` at a time. The preview watcher must use `lobbyState ?? playerGameView` (both refs from `useRoomConnection()`), not `lobbyState` alone.

**Mark seen BEFORE playing** to prevent re-triggering if the component unmounts/remounts mid-sequence (e.g., brief disconnect):
```typescript
prefsStore.markAudioPreviewSeen(); // mark first
if (!audioStore.masterMuted) {
  // play sequence
}
```

**Toast mechanism:** Look at `RoomView.vue` for the existing local notification pattern. There's likely a `ref<string>` or short-lived toast composable already used for lobby notifications. Use the same mechanism rather than creating a new one.

**No preview if muted:** If `audioStore.masterMuted === true`, skip playing but still mark as seen. The user already silenced the game — don't override that with surprise sounds.

### Testing Notes

**`preferences.test.ts`**: mock `localStorage` with `vi.stubGlobal` or `beforeEach` clear. Test:
- `hydrate()` with empty localStorage returns defaults
- `persist()` + `hydrate()` round-trip preserves all fields
- `setDarkMode('dark')` updates ref and persists
- `markEntranceSeen()` sets `hasSeenEntrance: true` and persists

**`App.vue` dark mode tests**: Use `vi.stubGlobal('matchMedia', ...)` returning `{ matches: true/false }`. Test that `document.documentElement.classList` has/lacks `theme-dark` for each combination.

**`FirstVisitEntrance.test.ts`**: 
```typescript
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query.includes('reduced-motion') ? false : false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
```
Test: `visible` starts true when `hasSeenEntrance=false`, `markEntranceSeen` called after timeout.

**`RoomView.test.ts` audio preview**: Use `vi.useFakeTimers()` to advance past the `setTimeout` delays. Assert `play` called with `'tile-draw'`, `'tile-discard'`, `'mahjong-motif'` in sequence.

### Anti-Patterns to Avoid

- **DO NOT** use VueUse `useLocalStorage` — follow `handGuidancePreferences.ts` manual pattern (project rule)
- **DO NOT** apply `.theme-dark` to `document.body` — use `document.documentElement` for teleport coverage
- **DO NOT** use `motion-v` for the entrance fade — plain CSS `transition` is sufficient and simpler
- **DO NOT** delay `markAudioPreviewSeen()` until after audio finishes — mark immediately before playing to prevent remount replay
- **DO NOT** play audio preview if `masterMuted === true` — respect explicit mute preference
- **DO NOT** add a new `watch(() => resolvedAction)` watcher in `GameTable.vue` — audio preview is a one-time room-join concern in `RoomView.vue`
- **DO NOT** store `visible` state for the entrance in a Pinia store — it's component-local, use `ref`

### Project Structure Notes

- `usePreferencesStore` → `packages/client/src/stores/preferences.ts` (architecture-mandated path)
- `preferences.test.ts` → `packages/client/src/stores/preferences.test.ts` (co-located)
- `FirstVisitEntrance.vue` → `packages/client/src/components/shared/FirstVisitEntrance.vue` (shared, not game-specific)
- `App.vue` → `packages/client/src/App.vue` — dark mode wiring + FirstVisitEntrance mount
- `AudioSettingsPanel.vue` → add theme section (existing file)
- `RoomView.vue` → audio preview logic (existing file)
- No changes to `packages/shared` or `packages/server`

### References

- [Source: `packages/client/src/styles/theme.css:62-108`] — `.theme-dark` class + media query — already implemented, no CSS changes needed
- [Source: `_bmad-output/planning-artifacts/game-architecture.md:331`] — `usePreferencesStore` expected at `stores/preferences.ts`
- [Source: `_bmad-output/planning-artifacts/game-architecture.md:209`] — "user preferences (font size, audio settings, dark mode override)"
- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 7, Story 7.4] — Acceptance criteria and UX requirements
- [Source: `packages/client/src/stores/handGuidancePreferences.ts`] — localStorage persistence pattern to follow exactly
- [Source: `packages/client/src/stores/audio.ts`] — `play(soundId, channel)` API; `masterMuted` ref to check before preview
- [Source: `packages/client/src/components/game/AudioSettingsPanel.vue`] — Settings panel to add theme toggle section
- [Source: `packages/client/src/views/RoomView.vue`] — Room entry point for audio preview + existing toast pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (story creation + implementation)

### Debug Log References

- Task 2 review: App.test.ts initially had memory leak (no unmount) and non-reactive mock; fixed with `reactive()` + `afterEach` cleanup
- Task 4 review: FirstVisitEntrance.vue missing `onBeforeUnmount` clearTimeout and `aria-hidden`; both fixed
- Task 5 review (critical): `{ once: true, immediate: true }` self-destructs the watcher on mount before lobbyState is non-null; fixed to `{ once: true }` only. AC7 test also rewrote to start with null lobbyState and assign reactively
- Code review follow-up: Watcher updated to `lobbyState ?? playerGameView` for in-progress first join; audio-preview `BaseToast` moved to a fixed overlay whenever either ref is non-null; `RoomView.test.ts` adds game-first join case

### Code review closure (2026-04-07)

- Adversarial review + fixes recorded in [7-4-code-review-findings.md](./7-4-code-review-findings.md) (MEDIUM items resolved; AC7 full coverage for lobby-first and game-first join).
- Quality gates after fix: `pnpm test`, `pnpm run typecheck`, `vp lint` — all passing.
- Story status set to **done**; sprint `development_status` synced for `7-4-dark-mode-first-visit-entrance-audio-preview`.

### Completion Notes List

- Created `usePreferencesStore` (`preferences.ts`) following exact `handGuidancePreferences.ts` pattern — manual loadPersisted/persist/hydrate, no VueUse useLocalStorage. 12 tests.
- Wired dark mode in `App.vue`: useMediaQuery + computed isDark + watchEffect on `document.documentElement`. 5 tests with reactive mock + proper unmount cleanup.
- Added Theme section to `AudioSettingsPanel.vue`: three-button group (Auto/Light/Dark), role="group", aria-pressed, min-h-11 touch target. 5 new tests.
- Created `FirstVisitEntrance.vue`: Teleport overlay, CSS fade-out, reduced-motion guard, onBeforeUnmount clearTimeout, aria-hidden. Mounted in App.vue before RouterView. 8 tests.
- Added audio preview watcher in `RoomView.vue`: once-only on first non-null `lobbyState ?? playerGameView`, marks seen before playing, skips if muted, shows `BaseToast` in fixed overlay when in room (lobby or table). Tests: lobby-first, game-first in-progress join, already-seen, muted.

### File List

- packages/client/src/stores/preferences.ts
- packages/client/src/stores/preferences.test.ts
- packages/client/src/App.vue
- packages/client/src/App.test.ts
- packages/client/src/components/game/AudioSettingsPanel.vue
- packages/client/src/components/game/AudioSettingsPanel.test.ts
- packages/client/src/components/shared/FirstVisitEntrance.vue
- packages/client/src/components/shared/FirstVisitEntrance.test.ts
- packages/client/src/views/RoomView.vue
- packages/client/src/views/RoomView.test.ts
