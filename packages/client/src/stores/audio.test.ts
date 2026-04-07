import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useAudioStore, SOUND_CHANNEL, _resetAudioEngineForTests } from "./audio";

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

/** Most recently created source node — updated by MockAudioContext.createBufferSource */
let lastCreatedSourceNode: MockAudioBufferSourceNode | null = null;
/** All GainNode instances created by MockAudioContext.createGain since last reset */
const gainNodeInstances: MockGainNode[] = [];

class MockAudioContext {
  destination = {};
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  decodeAudioData = vi.fn().mockResolvedValue({} as unknown as AudioBuffer);
  createGain = vi.fn(() => {
    const node = new MockGainNode();
    gainNodeInstances.push(node);
    return node;
  });
  createBufferSource = vi.fn(() => {
    const node = new MockAudioBufferSourceNode();
    lastCreatedSourceNode = node;
    return node;
  });
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
  // Reset module-scope engine state so no cache or nodes bleed between tests
  _resetAudioEngineForTests();

  // Reset source node and gain node trackers
  lastCreatedSourceNode = null;
  gainNodeInstances.length = 0;

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

  it("play() applies masterMuted=true to GainNodes on the very first play (lazy-init sync)", async () => {
    // Simulate returning user who had masterMuted saved — hydrate before store init
    lsData["mahjong-audio-prefs-v1"] = JSON.stringify({
      gameplayVolume: 0.8,
      notificationVolume: 0.7,
      ambientVolume: 0.3,
      masterMuted: true,
      ambientEnabled: false,
    });

    const store = useAudioStore();
    expect(store.masterMuted).toBe(true);

    // AudioContext not yet created — trigger first play to force lazy init
    await store.play("tile-draw", "gameplay");

    // getCtx() created 3 GainNodes (gameplay, notification, ambient).
    // syncGains() must have run, setting all gains to 0 (muted).
    expect(gainNodeInstances).toHaveLength(3);
    for (const node of gainNodeInstances) {
      expect(node.gain.value).toBe(0);
    }
  });

  it("play() applies persisted volume to GainNodes on first play (lazy-init sync)", async () => {
    lsData["mahjong-audio-prefs-v1"] = JSON.stringify({
      gameplayVolume: 0.4,
      notificationVolume: 0.5,
      ambientVolume: 0.2,
      masterMuted: false,
      ambientEnabled: false,
    });

    const store = useAudioStore();
    expect(store.gameplayVolume).toBe(0.4);

    await store.play("tile-draw", "gameplay");

    // 3 GainNodes created: gameplay (index 0), notification (index 1), ambient (index 2).
    // syncGains() must have applied persisted volumes, not the Web Audio default of 1.0.
    expect(gainNodeInstances).toHaveLength(3);
    expect(gainNodeInstances[0].gain.value).toBe(0.4); // gameplay
    expect(gainNodeInstances[1].gain.value).toBe(0.5); // notification
    expect(gainNodeInstances[2].gain.value).toBe(0.2); // ambient
  });
});

// ─── playAmbientLoop / stopAmbientLoop ────────────────────────────────────────

describe("useAudioStore — playAmbientLoop / stopAmbientLoop", () => {
  it("playAmbientLoop() resolves without throwing", async () => {
    const store = useAudioStore();
    await expect(store.playAmbientLoop()).resolves.not.toThrow();
  });

  it("playAmbientLoop() sets loop = true on the created source node", async () => {
    const store = useAudioStore();
    await store.playAmbientLoop();

    expect(lastCreatedSourceNode).not.toBeNull();
    expect(lastCreatedSourceNode!.loop).toBe(true);
  });

  it("stopAmbientLoop() calls stop() and disconnect() on the active node", async () => {
    const store = useAudioStore();
    await store.playAmbientLoop();
    expect(lastCreatedSourceNode).not.toBeNull();

    store.stopAmbientLoop();
    expect(lastCreatedSourceNode!.stop).toHaveBeenCalledOnce();
    expect(lastCreatedSourceNode!.disconnect).toHaveBeenCalledOnce();
  });

  it("stopAmbientLoop() is a no-op when no loop is active (does not throw)", () => {
    const store = useAudioStore();
    // No prior playAmbientLoop — ambientNode is null
    expect(() => store.stopAmbientLoop()).not.toThrow();
  });

  it("playAmbientLoop() silently handles fetch failure (warns, does not throw)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const store = useAudioStore();
    await expect(store.playAmbientLoop()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[audio]"), expect.any(Error));

    warnSpy.mockRestore();
  });
});

// ─── Volume clamping ──────────────────────────────────────────────────────────

describe("useAudioStore — volume clamping", () => {
  it("setGameplayVolume clamps values above 1 to 1", () => {
    const store = useAudioStore();
    store.setGameplayVolume(1.5);
    expect(store.gameplayVolume).toBe(1);
  });

  it("setGameplayVolume clamps values below 0 to 0", () => {
    const store = useAudioStore();
    store.setGameplayVolume(-0.5);
    expect(store.gameplayVolume).toBe(0);
  });

  it("setNotificationVolume clamps values above 1 to 1", () => {
    const store = useAudioStore();
    store.setNotificationVolume(2);
    expect(store.notificationVolume).toBe(1);
  });

  it("setNotificationVolume clamps values below 0 to 0", () => {
    const store = useAudioStore();
    store.setNotificationVolume(-1);
    expect(store.notificationVolume).toBe(0);
  });

  it("setAmbientVolume clamps values above 1 to 1", () => {
    const store = useAudioStore();
    store.setAmbientVolume(99);
    expect(store.ambientVolume).toBe(1);
  });

  it("setAmbientVolume clamps values below 0 to 0", () => {
    const store = useAudioStore();
    store.setAmbientVolume(-0.1);
    expect(store.ambientVolume).toBe(0);
  });

  it("setGameplayVolume accepts valid in-range values unchanged", () => {
    const store = useAudioStore();
    store.setGameplayVolume(0.6);
    expect(store.gameplayVolume).toBe(0.6);
  });
});
