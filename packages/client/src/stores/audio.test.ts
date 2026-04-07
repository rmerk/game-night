import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useAudioStore, SOUND_CHANNEL } from "./audio";

// ─── AudioContext mock ────────────────────────────────────────────────────────

class MockGainNode {
  gain = { value: 1 };
  connect = vi.fn();
}

class MockAudioBufferSourceNode {
  loop = false;
  buffer: AudioBuffer | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  destination = {};
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  decodeAudioData = vi.fn().mockResolvedValue({} as unknown as AudioBuffer);
  createGain = vi.fn(() => new MockGainNode());
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
}

// ─── localStorage data store ──────────────────────────────────────────────────
// Shared object (not reassigned) so the mock closures always see current data.

const lsData: Record<string, string> = {};

function resetLsData() {
  for (const key of Object.keys(lsData)) {
    delete lsData[key];
  }
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  // Stub AudioContext before any test that might trigger play()
  vi.stubGlobal("AudioContext", MockAudioContext);

  // Stub fetch with a default success response
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }),
  );

  // Stub localStorage using a plain object with the shared lsData
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => lsData[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      lsData[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete lsData[key];
    }),
    clear: vi.fn(() => resetLsData()),
  });

  // Clear persisted data
  resetLsData();

  // Fresh Pinia — store setup fn re-runs including hydrate()
  setActivePinia(createPinia());
});

// ─── Types and mapping ────────────────────────────────────────────────────────

describe("useAudioStore — types and mapping", () => {
  it("exports SoundId type values via SOUND_CHANNEL keys", () => {
    const keys = Object.keys(SOUND_CHANNEL);
    expect(keys).toContain("tile-draw");
    expect(keys).toContain("tile-discard");
    expect(keys).toContain("rack-arrange");
    expect(keys).toContain("call-snap");
    expect(keys).toContain("mahjong-motif");
    expect(keys).toContain("charleston-whoosh");
    expect(keys).toContain("turn-ping");
    expect(keys).toContain("call-alert");
    expect(keys).toContain("chat-pop");
    expect(keys).toContain("timer-warning");
    expect(keys).toContain("error-nope");
    expect(keys).toContain("ambient-loop");
  });

  it("maps gameplay sounds correctly", () => {
    expect(SOUND_CHANNEL["tile-draw"]).toBe("gameplay");
    expect(SOUND_CHANNEL["tile-discard"]).toBe("gameplay");
    expect(SOUND_CHANNEL["rack-arrange"]).toBe("gameplay");
    expect(SOUND_CHANNEL["call-snap"]).toBe("gameplay");
    expect(SOUND_CHANNEL["mahjong-motif"]).toBe("gameplay");
    expect(SOUND_CHANNEL["charleston-whoosh"]).toBe("gameplay");
  });

  it("maps notification sounds correctly", () => {
    expect(SOUND_CHANNEL["turn-ping"]).toBe("notification");
    expect(SOUND_CHANNEL["call-alert"]).toBe("notification");
    expect(SOUND_CHANNEL["chat-pop"]).toBe("notification");
    expect(SOUND_CHANNEL["timer-warning"]).toBe("notification");
    expect(SOUND_CHANNEL["error-nope"]).toBe("notification");
  });

  it("maps ambient-loop to ambient channel", () => {
    expect(SOUND_CHANNEL["ambient-loop"]).toBe("ambient");
  });
});

// ─── Store initialization defaults ───────────────────────────────────────────

describe("useAudioStore — initialization defaults", () => {
  it("initializes with correct default volumes", () => {
    const store = useAudioStore();
    expect(store.gameplayVolume).toBe(0.8);
    expect(store.notificationVolume).toBe(0.7);
    expect(store.ambientVolume).toBe(0.3);
  });

  it("initializes masterMuted as false", () => {
    const store = useAudioStore();
    expect(store.masterMuted).toBe(false);
  });

  it("initializes ambientEnabled as false (off by default)", () => {
    const store = useAudioStore();
    expect(store.ambientEnabled).toBe(false);
  });
});

// ─── localStorage persistence ─────────────────────────────────────────────────

describe("useAudioStore — localStorage persistence", () => {
  it("persists prefs to localStorage on setGameplayVolume", () => {
    const store = useAudioStore();
    store.setGameplayVolume(0.5);
    const raw = lsData["mahjong-audio-prefs-v1"];
    expect(raw).toBeDefined();
    expect(raw).toContain('"gameplayVolume":0.5');
  });

  it("persists prefs to localStorage on setNotificationVolume", () => {
    const store = useAudioStore();
    store.setNotificationVolume(0.4);
    const raw = lsData["mahjong-audio-prefs-v1"];
    expect(raw).toBeDefined();
    expect(raw).toContain('"notificationVolume":0.4');
  });

  it("persists prefs to localStorage on setAmbientVolume", () => {
    const store = useAudioStore();
    store.setAmbientVolume(0.2);
    const raw = lsData["mahjong-audio-prefs-v1"];
    expect(raw).toBeDefined();
    expect(raw).toContain('"ambientVolume":0.2');
  });

  it("persists masterMuted toggle to localStorage", () => {
    const store = useAudioStore();
    store.setMasterMuted(true);
    expect(lsData["mahjong-audio-prefs-v1"]).toContain('"masterMuted":true');
    store.setMasterMuted(false);
    expect(lsData["mahjong-audio-prefs-v1"]).toContain('"masterMuted":false');
  });

  it("persists ambientEnabled to localStorage on setAmbientEnabled", () => {
    const store = useAudioStore();
    store.setAmbientEnabled(true);
    expect(lsData["mahjong-audio-prefs-v1"]).toContain('"ambientEnabled":true');
  });

  it("hydrate() reads stored values from localStorage on store init", () => {
    // Pre-populate localStorage BEFORE store init (store runs hydrate() in setup)
    const stored = {
      gameplayVolume: 0.6,
      notificationVolume: 0.5,
      ambientVolume: 0.1,
      masterMuted: true,
      ambientEnabled: true,
    };
    lsData["mahjong-audio-prefs-v1"] = JSON.stringify(stored);

    const store = useAudioStore();
    expect(store.gameplayVolume).toBe(0.6);
    expect(store.notificationVolume).toBe(0.5);
    expect(store.ambientVolume).toBe(0.1);
    expect(store.masterMuted).toBe(true);
    expect(store.ambientEnabled).toBe(true);
  });

  it("hydrate() falls back to defaults on malformed localStorage data", () => {
    lsData["mahjong-audio-prefs-v1"] = "not-valid-json{{{";

    const store = useAudioStore();
    expect(store.gameplayVolume).toBe(0.8);
    expect(store.masterMuted).toBe(false);
  });

  it("volume persistence round-trip: persist then reload", () => {
    const store = useAudioStore();
    store.setGameplayVolume(0.3);
    store.setMasterMuted(true);

    const raw = lsData["mahjong-audio-prefs-v1"];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed.gameplayVolume).toBe(0.3);
    expect(parsed.masterMuted).toBe(true);
    expect(parsed.notificationVolume).toBe(0.7); // default preserved
  });
});

// ─── masterMuted toggle ───────────────────────────────────────────────────────

describe("useAudioStore — masterMuted toggle", () => {
  it("setMasterMuted(true) sets masterMuted to true", () => {
    const store = useAudioStore();
    expect(store.masterMuted).toBe(false);
    store.setMasterMuted(true);
    expect(store.masterMuted).toBe(true);
  });

  it("setMasterMuted(false) sets masterMuted back to false", () => {
    const store = useAudioStore();
    store.setMasterMuted(true);
    store.setMasterMuted(false);
    expect(store.masterMuted).toBe(false);
  });
});

// ─── Volume setters ───────────────────────────────────────────────────────────

describe("useAudioStore — volume setters", () => {
  it("setGameplayVolume updates gameplayVolume", () => {
    const store = useAudioStore();
    store.setGameplayVolume(0.5);
    expect(store.gameplayVolume).toBe(0.5);
  });

  it("setNotificationVolume updates notificationVolume", () => {
    const store = useAudioStore();
    store.setNotificationVolume(0.3);
    expect(store.notificationVolume).toBe(0.3);
  });

  it("setAmbientVolume updates ambientVolume", () => {
    const store = useAudioStore();
    store.setAmbientVolume(0.9);
    expect(store.ambientVolume).toBe(0.9);
  });

  it("setAmbientEnabled updates ambientEnabled", () => {
    const store = useAudioStore();
    store.setAmbientEnabled(true);
    expect(store.ambientEnabled).toBe(true);
  });
});

// ─── play() ───────────────────────────────────────────────────────────────────

describe("useAudioStore — play()", () => {
  it("play() does not throw on valid soundId", async () => {
    const store = useAudioStore();
    await expect(store.play("tile-draw", "gameplay")).resolves.not.toThrow();
  });

  it("play() silently handles fetch failure without throwing", async () => {
    // Override fetch to reject for this test
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const store = useAudioStore();
    await expect(store.play("tile-draw", "gameplay")).resolves.toBeUndefined();
  });

  it("play() silently handles 404 response without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, arrayBuffer: vi.fn() }));
    const store = useAudioStore();
    await expect(store.play("chat-pop", "notification")).resolves.toBeUndefined();
  });
});
