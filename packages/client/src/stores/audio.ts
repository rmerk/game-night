import { defineStore } from "pinia";
import { ref, watchEffect } from "vue";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SoundId =
  | "tile-draw"
  | "tile-discard"
  | "rack-arrange"
  | "call-snap"
  | "mahjong-motif"
  | "charleston-whoosh"
  | "turn-ping"
  | "call-alert"
  | "chat-pop"
  | "timer-warning"
  | "error-nope"
  | "ambient-loop";

export type AudioChannel = "gameplay" | "notification" | "ambient";

export const SOUND_CHANNEL: Record<SoundId, AudioChannel> = {
  "tile-draw": "gameplay",
  "tile-discard": "gameplay",
  "rack-arrange": "gameplay",
  "call-snap": "gameplay",
  "mahjong-motif": "gameplay",
  "charleston-whoosh": "gameplay",
  "turn-ping": "notification",
  "call-alert": "notification",
  "chat-pop": "notification",
  "timer-warning": "notification",
  "error-nope": "notification",
  "ambient-loop": "ambient",
};

// ─── Module-scope Audio Engine (not store state — no reactivity overhead) ─────

let ctx: AudioContext | null = null;
const bufferCache = new Map<SoundId, AudioBuffer>();
let ambientNode: AudioBufferSourceNode | null = null;
let gameplayGain: GainNode | null = null;
let notificationGain: GainNode | null = null;
let ambientGain: GainNode | null = null;

/** @internal Test-only: resets all module-scope engine state between test cases. */
export function _resetAudioEngineForTests(): void {
  ctx = null;
  bufferCache.clear();
  ambientNode = null;
  gameplayGain = null;
  notificationGain = null;
  ambientGain = null;
}

function getCtx(): AudioContext {
  if (!ctx) {
    // Lookup AudioContext via globalThis so that test environments can stub it
    // before the first play() call (browsers require a user gesture first).
    const Ctor = (globalThis as typeof globalThis & { AudioContext: typeof AudioContext })
      .AudioContext;
    ctx = new Ctor();
    gameplayGain = ctx.createGain();
    notificationGain = ctx.createGain();
    ambientGain = ctx.createGain();
    gameplayGain.connect(ctx.destination);
    notificationGain.connect(ctx.destination);
    ambientGain.connect(ctx.destination);
  }
  return ctx;
}

function getGainNode(channel: AudioChannel): GainNode {
  // Ensure context (and gain nodes) are initialized
  getCtx();
  if (channel === "gameplay") return gameplayGain!;
  if (channel === "notification") return notificationGain!;
  return ambientGain!;
}

async function loadBuffer(soundId: SoundId): Promise<AudioBuffer> {
  if (bufferCache.has(soundId)) return bufferCache.get(soundId)!;
  const context = getCtx();
  // eslint-disable-next-line no-await-in-loop -- intentional sequential fallback: try mp3 then ogg
  for (const ext of ["mp3", "ogg"]) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`/sounds/${soundId}.${ext}`);
      if (!res.ok) continue;
      // eslint-disable-next-line no-await-in-loop
      const buf = await context.decodeAudioData(await res.arrayBuffer());
      bufferCache.set(soundId, buf);
      return buf;
    } catch {
      /* try next format */
    }
  }
  throw new Error(`Audio not found: ${soundId}`);
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "mahjong-audio-prefs-v1";

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

function loadPersisted(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAudioStore = defineStore("audio", () => {
  const gameplayVolume = ref<number>(defaults.gameplayVolume);
  const notificationVolume = ref<number>(defaults.notificationVolume);
  const ambientVolume = ref<number>(defaults.ambientVolume);
  const masterMuted = ref<boolean>(defaults.masterMuted);
  const ambientEnabled = ref<boolean>(defaults.ambientEnabled);

  function persist() {
    const payload: PersistedShape = {
      gameplayVolume: gameplayVolume.value,
      notificationVolume: notificationVolume.value,
      ambientVolume: ambientVolume.value,
      masterMuted: masterMuted.value,
      ambientEnabled: ambientEnabled.value,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function hydrate() {
    const p = loadPersisted();
    gameplayVolume.value = p.gameplayVolume;
    notificationVolume.value = p.notificationVolume;
    ambientVolume.value = p.ambientVolume;
    masterMuted.value = p.masterMuted;
    ambientEnabled.value = p.ambientEnabled;
  }

  hydrate();

  // Sync GainNode gain values to current store state.
  // Called by watchEffect (for reactive settings changes) and explicitly in play()
  // after lazy AudioContext init, because watchEffect runs once at store setup when
  // GainNodes are still null and won't re-run until a reactive dep changes.
  function syncGains() {
    const muted = masterMuted.value;
    if (gameplayGain) gameplayGain.gain.value = muted ? 0 : gameplayVolume.value;
    if (notificationGain) notificationGain.gain.value = muted ? 0 : notificationVolume.value;
    if (ambientGain) ambientGain.gain.value = muted ? 0 : ambientVolume.value;
  }

  // Keep GainNode values in sync when settings change reactively.
  watchEffect(syncGains);

  // ─── Volume setters ──────────────────────────────────────────────────────────

  function setGameplayVolume(value: number) {
    gameplayVolume.value = Math.max(0, Math.min(1, value));
    persist();
  }

  function setNotificationVolume(value: number) {
    notificationVolume.value = Math.max(0, Math.min(1, value));
    persist();
  }

  function setAmbientVolume(value: number) {
    ambientVolume.value = Math.max(0, Math.min(1, value));
    persist();
  }

  function setMasterMuted(value: boolean) {
    masterMuted.value = value;
    persist();
  }

  function setAmbientEnabled(value: boolean) {
    ambientEnabled.value = value;
    persist();
  }

  // ─── Playback ────────────────────────────────────────────────────────────────

  async function play(soundId: SoundId, channel: AudioChannel): Promise<void> {
    try {
      const buffer = await loadBuffer(soundId);
      const context = getCtx();
      syncGains(); // ensure gains match store state after lazy AudioContext init
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(getGainNode(channel));
      source.start(0);
    } catch (err) {
      console.warn(`[audio] Failed to play sound "${soundId}":`, err);
    }
  }

  async function playAmbientLoop(): Promise<void> {
    try {
      stopAmbientLoop();
      const buffer = await loadBuffer("ambient-loop");
      const context = getCtx();
      syncGains(); // ensure gains match store state after lazy AudioContext init
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(getGainNode("ambient"));
      source.start(0);
      ambientNode = source;
    } catch (err) {
      console.warn("[audio] Failed to start ambient loop:", err);
    }
  }

  function stopAmbientLoop(): void {
    if (ambientNode) {
      try {
        ambientNode.stop();
      } catch {
        /* already stopped */
      }
      ambientNode.disconnect();
      ambientNode = null;
    }
  }

  return {
    gameplayVolume,
    notificationVolume,
    ambientVolume,
    masterMuted,
    ambientEnabled,
    play,
    playAmbientLoop,
    stopAmbientLoop,
    setGameplayVolume,
    setNotificationVolume,
    setAmbientVolume,
    setMasterMuted,
    setAmbientEnabled,
  };
});
