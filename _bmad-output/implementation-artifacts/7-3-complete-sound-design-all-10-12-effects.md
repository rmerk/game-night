# Story 7.3: Complete Sound Design (All 10-12 Effects)

Status: done

## Story

As a **player**,
I want **tactile sound effects for every game interaction — tile sounds that feel like real acrylic on felt, and a signature Mahjong motif**,
so that **every interaction feels physical and the game has an audio identity (GDD Audio section)**.

## Acceptance Criteria

1. **Complete sound set** — All required effects are implemented and playable: tile draw (soft click), tile discard (crisp clack), rack arrangement (gentle slide), call snap (confident snap on exposure), Mahjong motif (3-4 note signature), Charleston whoosh (soft glide), turn notification (clear ping), call window alert (brief urgent tone), chat/reaction pop (subtle pop), timer warning (gentle escalating tone), error/invalid (soft forgiving "nope"). Tile-discard was wired with a TODO in `DiscardConfirm.vue:15` — this story resolves it.

2. **Timbre** — All tile sounds reference real acrylic or Bakelite tiles on felt — not generic UI clicks.

3. **Audio format** — All effects are web-optimized MP3 (primary) + OGG (fallback) in `packages/client/public/sounds/`. Each effect under 2 seconds (motif 3-4 seconds). Total audio footprint under 500KB.

4. **Three independent volume channels** — `gameplay` (tile sounds, call snaps, motif), `notification` (turn ping, call alert, chat pop, timer warning, error nope), `ambient` (optional lo-fi loop). Each independently adjustable 0–1. Plus a master mute toggle. Preferences persist to localStorage (`mahjong-audio-prefs-v1`).

5. **Audio priority** — `gameplay` feedback > `notification` > `ambient`. Sound effects never compete with voice chat — they coexist at complementary frequency ranges.

6. **Ambient loop** — One lo-fi/jazz loop available in settings, OFF by default.

7. **Trigger wiring** — Game-event sounds triggered by watching `resolvedAction` in `GameTable.vue` (same watch block pattern already used for toasts). UI-interaction sounds triggered by component event handlers. Mahjong motif wired via `@motifPlay` from `Celebration.vue` (placeholder already in place — `emit('motifPlay')` at Phase 6).

8. **Settings controls** — Three channel sliders (0–100%) and master mute accessible from the existing RoomSettingsPanel or a new AudioSettingsPanel section. BaseToggle/BaseNumberStepper patterns apply.

## Tasks / Subtasks

- [x] Task 1: Create `useAudioStore` (Pinia) + Web Audio API engine (AC: 4, 5, 6)
  - [x] 1.1 Create `packages/client/src/stores/audio.ts` — define and export `useAudioStore`
  - [x] 1.2 Store state: `gameplayVolume: ref<number>(0.8)`, `notificationVolume: ref<number>(0.7)`, `ambientVolume: ref<number>(0.3)`, `masterMuted: ref<boolean>(false)`, `ambientEnabled: ref<boolean>(false)` — all refs, no reactive objects
  - [x] 1.3 Persistence: load/save to `localStorage` key `mahjong-audio-prefs-v1` (shape: `{ gameplayVolume, notificationVolume, ambientVolume, masterMuted, ambientEnabled }`). Use the pattern from `handGuidancePreferences.ts` — manual `loadPersisted()` + `persist()` helpers, call `hydrate()` at store init. Do NOT use VueUse `useLocalStorage` (keep pattern consistent with existing stores)
  - [x] 1.4 Web Audio API engine: lazily initialize `AudioContext` on first `play()` call (browsers require gesture before context creation). Keep it in module scope (not store state) to avoid reactivity overhead. Three `GainNode`s: `gameplayGain`, `notificationGain`, `ambientGain` — each connected to `ctx.destination`
  - [x] 1.5 Channel volume computed: `gameplayGain.gain.value = masterMuted ? 0 : gameplayVolume`; same for notification and ambient. Use `watchEffect` to keep GainNode values in sync with store state
  - [x] 1.6 `play(soundId: SoundId, channel: AudioChannel): void` — loads `AudioBuffer` from `/sounds/{soundId}.mp3` via `fetch` + `ctx.decodeAudioData`, caches `AudioBuffer` by soundId, creates `AudioBufferSourceNode`, connects to the correct GainNode, calls `.start(0)`. Cache buffers in a `Map<SoundId, AudioBuffer>` in module scope
  - [x] 1.7 `playAmbientLoop(): void` / `stopAmbientLoop(): void` — for the ambient track, use `AudioBufferSourceNode` with `loop = true`. Store the active node reference to stop it cleanly
  - [x] 1.8 Export: `{ gameplayVolume, notificationVolume, ambientVolume, masterMuted, ambientEnabled, play, playAmbientLoop, stopAmbientLoop, setGameplayVolume, setNotificationVolume, setAmbientVolume, setMasterMuted, setAmbientEnabled }`
  - [x] 1.9 Create `packages/client/src/stores/audio.test.ts` — test store initialization, volume persistence round-trip, `masterMuted` toggle, `hydrate()` reads localStorage correctly on second init

- [x] Task 2: Define `SoundId` type and sound-to-channel mapping (AC: 1, 5)
  - [x] 2.1 In `audio.ts`, define: `export type SoundId = 'tile-draw' | 'tile-discard' | 'rack-arrange' | 'call-snap' | 'mahjong-motif' | 'charleston-whoosh' | 'turn-ping' | 'call-alert' | 'chat-pop' | 'timer-warning' | 'error-nope' | 'ambient-loop'`
  - [x] 2.2 Define: `export type AudioChannel = 'gameplay' | 'notification' | 'ambient'`
  - [x] 2.3 Define mapping constant: `export const SOUND_CHANNEL: Record<SoundId, AudioChannel>` — gameplay: tile-draw, tile-discard, rack-arrange, call-snap, mahjong-motif, charleston-whoosh; notification: turn-ping, call-alert, chat-pop, timer-warning, error-nope; ambient: ambient-loop

- [x] Task 3: Add placeholder audio files (AC: 3)
  - [x] 3.1 Create directory `packages/client/public/sounds/` (Vite serves `public/` at root, accessible as `/sounds/{file}` in the browser)
  - [x] 3.2 Add 12 placeholder audio files. Use short royalty-free tone recordings OR generate simple WAV blobs via a `scripts/generate-placeholder-sounds.mjs` script using Web Audio API offline rendering. Each file: 1-second sine wave at a distinct pitch (except `mahjong-motif.mp3` at ~3s). File names MUST match SoundId values: `tile-draw.mp3`, `tile-discard.mp3`, `rack-arrange.mp3`, `call-snap.mp3`, `mahjong-motif.mp3`, `charleston-whoosh.mp3`, `turn-ping.mp3`, `call-alert.mp3`, `chat-pop.mp3`, `timer-warning.mp3`, `error-nope.mp3`, `ambient-loop.mp3`
  - [x] 3.3 Add OGG fallback: same 12 files with `.ogg` extension (can be re-encoded versions of the same placeholders). `play()` tries MP3, falls back to OGG if MP3 fetch fails
  - [x] 3.4 Verify total uncompressed size < 500KB at placeholder quality. Production-quality recordings are a separate content task.

- [x] Task 4: Wire game-event sounds in `GameTable.vue` (AC: 1, 7)
  - [x] 4.1 Import `useAudioStore` and call it in `<script setup>` of `GameTable.vue`
  - [x] 4.2 In the **existing** `watch(() => props.resolvedAction, (ra) => { ... })` block (line ~791), add `case` branches AFTER existing toast/UI logic. Do NOT create a new watcher:
    - `DRAW_TILE` → `audioStore.play('tile-draw', 'gameplay')`
    - `DISCARD_TILE` → `audioStore.play('tile-discard', 'gameplay')`
    - `CALL_WINDOW_OPENED` → `audioStore.play('call-alert', 'notification')`
    - `CALL_CONFIRMED` → `audioStore.play('call-snap', 'gameplay')`
    - `CHARLESTON_PHASE_COMPLETE` → `audioStore.play('charleston-whoosh', 'gameplay')`
    - `TURN_TIMER_NUDGE` → `audioStore.play('turn-ping', 'notification')`
    - `TURN_TIMEOUT_AUTO_DISCARD` → `audioStore.play('error-nope', 'notification')`
    - `INVALID_MAHJONG_WARNING` → `audioStore.play('error-nope', 'notification')`
  - [x] 4.3 Wire `@motifPlay` from `<Celebration>` in `GameTable.vue` template (Celebration already emits this at Phase 6): add `@motifPlay="audioStore.play('mahjong-motif', 'gameplay')"` to the `<Celebration>` usage
  - [x] 4.4 Write tests in `GameTable.test.ts`: mock `useAudioStore`, assert `play()` called with correct soundId for DRAW_TILE, DISCARD_TILE, CALL_CONFIRMED, and CALL_WINDOW_OPENED resolved actions

- [x] Task 5: Wire UI-interaction sounds (AC: 1, 7)
  - [x] 5.1 `DiscardConfirm.vue:15` has `// TODO: audioStore.play('tile-discard')` — replace with actual call: `import { useAudioStore } from '../../stores/audio'` + `useAudioStore().play('tile-discard', 'gameplay')` in `handleDiscard()`. Note: tile-discard is already triggered by the `DISCARD_TILE` resolvedAction in GameTable, so this would double-play for the local player. To avoid double-play: **remove the DiscardConfirm wiring** and rely solely on the resolvedAction watcher. Just delete the TODO comment.
  - [x] 5.2 Rack arrangement sound: in `TileRack.vue` (or wherever the drag-start event fires), add `useAudioStore().play('rack-arrange', 'gameplay')` on `dragstart` / `onDragStart` handler. Play only once per drag gesture, not per pixel of movement.
  - [x] 5.3 Chat/reaction pop: In `useChatStore` or wherever incoming chat messages are pushed (`pushMessage`), call `useAudioStore().play('chat-pop', 'notification')` for messages not sent by the local player. For reactions, add the same call in `useReactionsStore.pushBroadcast()` — already guarded against duplicates by that store's dedupe logic.
  - [x] 5.4 Error sound for rejected server actions: The existing server ERROR message path (in `useRoomConnection.ts` or wherever `type: "ERROR"` WebSocket messages are handled) — call `useAudioStore().play('error-nope', 'notification')`.
  - [x] 5.5 Write a focused test for rack-arrange sound: mock `useAudioStore`, trigger drag on TileRack, assert `play` called with `'rack-arrange'`.

- [x] Task 6: Audio settings UI (AC: 4, 6, 8)
  - [x] 6.1 Create `packages/client/src/components/game/AudioSettingsPanel.vue` — three `<input type="range" min="0" max="100">` sliders for gameplay/notification/ambient volumes (stored as 0–1, display as 0–100), one `BaseToggle` for master mute, one `BaseToggle` for ambient enable. Follow `RoomSettingsPanel.vue` style (UnoCSS, BaseToggle, BaseNumberStepper patterns — no external UI library).
  - [x] 6.2 Wire sliders to store setters (`setGameplayVolume(v / 100)` etc.) with `@input` handlers. Changes persist automatically via store's persist() call.
  - [x] 6.3 Ambient toggle: when enabled → `playAmbientLoop()`; when disabled → `stopAmbientLoop()`.
  - [x] 6.4 Integrate `<AudioSettingsPanel>` into the existing settings slide-in panel flow. Look at `SlideInReferencePanels.vue` and the `slideInPanelIds.ts` pattern to understand how panels are registered. Add audio settings as a section within an existing panel OR as a new slide-in with id `'audio-settings'`.
  - [x] 6.5 Write `AudioSettingsPanel.test.ts`: slider changes call store setter, mute toggle flips `masterMuted`.

- [x] Task 7: Backpressure gate (AC: all)
  - [x] 7.1 Run `pnpm test && pnpm run typecheck && vp lint` — all must pass before considering the story complete
  - [ ] 7.2 Manual smoke test: play a game locally, verify tile draw, discard, call snap, and Mahjong motif play during the celebration sequence

## Dev Notes

### Audio Architecture — Web Audio API (No External Library)

The architecture doc deferred audio channel management to Epic 7 ("Shaped by actual sound asset integration"). Use the **Web Audio API** directly — no Howler, Tone.js, or other external audio library. The architecture lists no audio library in the tech stack.

```typescript
// Module-scope singletons (not store state — avoid reactivity overhead)
let ctx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
let ambientNode: AudioBufferSourceNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}
```

**AudioContext lazy init** — Browsers block `new AudioContext()` until user gesture. Initialize inside `play()` on first call.

**GainNode wiring per channel:**
```
AudioBufferSourceNode → gameplayGain → ctx.destination
AudioBufferSourceNode → notificationGain → ctx.destination
AudioBufferSourceNode → ambientGain → ctx.destination
```

**Master mute** — Set `gameplayGain.gain.value = masterMuted ? 0 : gameplayVolume` (same for all gains) using `watchEffect`.

### Static Audio Assets — Vite `public/` Directory

Vite serves `packages/client/public/` at the URL root. Audio files at `packages/client/public/sounds/tile-draw.mp3` are accessible as `/sounds/tile-draw.mp3`. No import needed — fetch directly:

```typescript
const response = await fetch(`/sounds/${soundId}.mp3`);
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
```

**OGG fallback:**
```typescript
async function loadBuffer(soundId: SoundId): Promise<AudioBuffer> {
  if (bufferCache.has(soundId)) return bufferCache.get(soundId)!;
  const ctx = getCtx();
  for (const ext of ['mp3', 'ogg']) {
    try {
      const res = await fetch(`/sounds/${soundId}.${ext}`);
      if (!res.ok) continue;
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      bufferCache.set(soundId, buf);
      return buf;
    } catch { /* try next format */ }
  }
  throw new Error(`Audio not found: ${soundId}`);
}
```

**Silent failure on audio errors** — If a sound fails to load or play, log a warning and continue. Never throw or show UI errors for audio failures.

### Placeholder Sound Generation

If royalty-free recordings aren't available, generate placeholder sine wave WAV blobs using a Node.js script at `scripts/generate-placeholder-sounds.mjs`. The script uses `AudioContext` offline rendering or raw PCM buffer construction to emit 1-second tones at distinct pitches. Commit generated MP3 files to `public/sounds/`. Production sound design is a separate content task.

Alternatively: download 12 short public-domain sound files from freesound.org (tile clicks, pings, whooshes) — document sources in `public/sounds/CREDITS.md`.

### `useAudioStore` Pattern — Follow `handGuidancePreferences.ts`

The store pattern to follow:
```typescript
// packages/client/src/stores/audio.ts
const STORAGE_KEY = 'mahjong-audio-prefs-v1';

interface PersistedShape {
  gameplayVolume: number;
  notificationVolume: number;
  ambientVolume: number;
  masterMuted: boolean;
  ambientEnabled: boolean;
}
const defaults: PersistedShape = {
  gameplayVolume: 0.8,
  notificationVolume: 0.7,
  ambientVolume: 0.3,
  masterMuted: false,
  ambientEnabled: false,
};
```

No VueUse `useLocalStorage` — use direct `localStorage.getItem/setItem` with JSON parse/stringify to stay consistent with `handGuidancePreferences.ts` and `liveKit.ts` store patterns.

### resolvedAction Watcher — Add to Existing Block

`GameTable.vue` already has a `watch(() => props.resolvedAction, ...)` block at ~line 791 for toast/UI effects. **Add audio cases to the SAME switch statement** — do NOT create a new `watch`. The block:

```typescript
watch(() => props.resolvedAction, (ra) => {
  if (!ra) return;
  switch (ra.type) {
    // ... existing toast cases ...
    // ADD AFTER existing cases:
    case 'DRAW_TILE': audioStore.play('tile-draw', 'gameplay'); break;
    case 'DISCARD_TILE': audioStore.play('tile-discard', 'gameplay'); break;
    case 'CALL_WINDOW_OPENED': audioStore.play('call-alert', 'notification'); break;
    case 'CALL_CONFIRMED': audioStore.play('call-snap', 'gameplay'); break;
    case 'CHARLESTON_PHASE_COMPLETE': audioStore.play('charleston-whoosh', 'gameplay'); break;
    case 'TURN_TIMER_NUDGE': audioStore.play('turn-ping', 'notification'); break;
    case 'TURN_TIMEOUT_AUTO_DISCARD':
    case 'INVALID_MAHJONG_WARNING': audioStore.play('error-nope', 'notification'); break;
  }
});
```

### Double-Play Prevention

`DISCARD_TILE` resolvedAction fires for ALL players (server-authoritative broadcast). `DiscardConfirm.vue` only runs for the local player. Since `DISCARD_TILE` already covers all discard sounds globally, **delete** the `// TODO: audioStore.play('tile-discard')` comment in `DiscardConfirm.vue:15` rather than wiring it. This avoids double-play for the local player.

### Celebration `@motifPlay` Hook

Story 7.2 already left the audio hook in `Celebration.vue`:
```typescript
// Celebration.vue — Phase 6 emits this:
emit('motifPlay');
```

In `GameTable.vue` template, the `<Celebration>` component usage already has `@done="..."`. Add:
```html
<Celebration
  ...
  @done="celebrationDone = true"
  @motifPlay="audioStore.play('mahjong-motif', 'gameplay')"
/>
```

`mahjong-motif` is in the gameplay channel. Even under reduced motion the motif doesn't fire (Celebration.vue explicitly skips `emit('motifPlay')` in the reduced-motion path — already tested in `Celebration.test.ts`).

### TileRack Drag Sound — Once Per Gesture

Rack arrangement is a continuous drag event. Fire the sound **once** on drag start only. In whatever `onDragStart`/`handleDragStart` handler exists in `TileRack.vue`, add `audioStore.play('rack-arrange', 'gameplay')` once. Do not wire to `onDragMove`.

### `useReactionsStore.pushBroadcast` — Chat Pop

Add `useAudioStore().play('chat-pop', 'notification')` inside `pushBroadcast` (after the dedupe guard, before `items.value = ...`). The store already handles deduplication — so the sound fires once per unique reaction received.

For chat messages, find the `pushMessage` or equivalent function in `packages/client/src/stores/chat.ts` and add the same call for messages not authored by the local player.

### ERROR WebSocket Message — Server-Rejected Actions

Find the WebSocket message handler in `packages/client/src/composables/useRoomConnection.ts` or similar. The `type: "ERROR"` branch — add `useAudioStore().play('error-nope', 'notification')` there.

### Ambient Loop — OFF by Default

The ambient lo-fi loop is disabled by default (`ambientEnabled: false`). When the AudioSettingsPanel toggle is flipped on, call `audioStore.playAmbientLoop()`. When flipped off, call `audioStore.stopAmbientLoop()`. The ambient loop must restart cleanly on toggle-on after being stopped.

### Anti-Patterns to Avoid

- **DO NOT** import any audio library (no Howler, Tone.js, Pizzicato, etc.) — Web Audio API only
- **DO NOT** create a second `watch` on `resolvedAction` in GameTable — add cases to the existing block
- **DO NOT** use VueUse `useLocalStorage` — follow the `handGuidancePreferences.ts` manual localStorage pattern
- **DO NOT** create `AudioContext` at module load time — lazy init on first `play()` call
- **DO NOT** store `AudioBuffer` or `GainNode` in Vue reactive state — keep in module scope
- **DO NOT** throw or show errors when sounds fail to load — silent failure with `console.warn`
- **DO NOT** wire `tile-discard` in `DiscardConfirm.vue` — the `DISCARD_TILE` resolvedAction watcher covers all players

### Testing Standards

- `audio.test.ts`: mock `AudioContext` and `fetch` — both are global browser APIs that happy-dom may not fully implement. Use `vi.stubGlobal('AudioContext', ...)` and `vi.stubGlobal('fetch', ...)`.
- `GameTable.test.ts`: use `vi.mock('../../stores/audio', () => ({ useAudioStore: () => ({ play: vi.fn() }) }))` — same mock pattern as `motion-v` in `Celebration.test.ts`
- `AudioSettingsPanel.test.ts`: mock `useAudioStore` to return spied setters; test slider `@input` triggers correct setter

### Project Structure Notes

- `useAudioStore` in `packages/client/src/stores/audio.ts` — consistent with existing store locations
- Audio assets in `packages/client/public/sounds/` — Vite convention for static assets that need URL access
- `AudioSettingsPanel.vue` in `packages/client/src/components/game/` — consistent with `RoomSettingsPanel.vue` location
- No changes to `packages/shared` or `packages/server` — this is entirely client-side

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §Epic 7, Story 7.3] — Acceptance criteria and user story
- [Source: `_bmad-output/planning-artifacts/gdd.md` §Audio and Music] — GDD audio section: timbre spec, priority rules, ambient music default-off, first-launch preview (deferred to Story 7.4)
- [Source: `_bmad-output/planning-artifacts/game-architecture.md` §State Management] — `useAudioStore` (Pinia), `usePreferencesStore` defined; audio channel management deferred to Epic 7
- [Source: `packages/shared/src/types/game-state.ts:278–471`] — Full `ResolvedAction` discriminated union — `DRAW_TILE`, `DISCARD_TILE`, `CALL_WINDOW_OPENED`, `CALL_CONFIRMED`, `CHARLESTON_PHASE_COMPLETE`, `TURN_TIMER_NUDGE`, `TURN_TIMEOUT_AUTO_DISCARD`, `INVALID_MAHJONG_WARNING`
- [Source: `packages/client/src/components/scoreboard/Celebration.vue:18–21`] — `motifPlay` emit definition (audio hook for Story 7.3)
- [Source: `packages/client/src/components/scoreboard/Celebration.vue:86–89`] — Reduced-motion path does NOT emit `motifPlay`
- [Source: `packages/client/src/components/game/DiscardConfirm.vue:15`] — TODO comment to resolve (delete, not wire — resolvedAction watcher covers it)
- [Source: `packages/client/src/components/game/GameTable.vue:791`] — Existing resolvedAction watcher — add audio cases here
- [Source: `packages/client/src/stores/handGuidancePreferences.ts`] — localStorage persistence pattern to follow
- [Source: `packages/client/src/stores/reactions.ts`] — `pushBroadcast` function — add chat-pop call here
- [Source: `packages/client/src/components/game/RoomSettingsPanel.vue`] — BaseToggle/BaseNumberStepper usage pattern for settings panel

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (story creation)

### Debug Log References

### Completion Notes List

Story 7.3 implemented in 7 tasks. Web Audio API engine (no external library) with lazy AudioContext, three GainNode channels, mp3→ogg fallback, and silent failure. localStorage persistence follows handGuidancePreferences.ts pattern. 24 placeholder WAV-as-MP3/OGG files generated via Node.js script. 11 of 12 sound effects wired (timer-warning reserved for future countdown UI — no current game event trigger). All quality gates passed: 730 tests, 0 type errors, 0 lint errors.

Code review (2026-04-07): Fixed lazy-init GainNode sync bug — watchEffect skipped gain assignment at store setup when GainNodes were null; first play() now calls syncGains() explicitly after AudioContext creation, ensuring persisted masterMuted and volume preferences apply from the very first sound. Added 2 regression tests covering masterMuted=true and custom volume on first play. Discarded uncommitted whitespace drift in reaction components (unrelated to story scope).

### File List

- packages/client/src/stores/audio.ts
- packages/client/src/stores/audio.test.ts
- packages/client/public/sounds/ (24 placeholder files: 12 .mp3 + 12 .ogg)
- scripts/generate-placeholder-sounds.mjs
- packages/client/src/components/game/GameTable.vue
- packages/client/src/components/game/GameTable.test.ts
- packages/client/src/components/game/DiscardConfirm.vue
- packages/client/src/components/game/TileRackItem.vue
- packages/client/src/components/game/TileRackItem.test.ts
- packages/client/src/composables/useRoomConnection.ts
- packages/client/src/stores/reactions.ts
- packages/client/src/stores/reactions.test.ts
- packages/client/src/components/game/AudioSettingsPanel.vue
- packages/client/src/components/game/AudioSettingsPanel.test.ts
- packages/client/src/components/chat/SlideInReferencePanels.vue
