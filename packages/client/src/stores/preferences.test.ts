import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { usePreferencesStore } from "./preferences";

// ─── localStorage mock ────────────────────────────────────────────────────────

const lsData: Record<string, string> = {};

function resetLsData() {
  for (const key of Object.keys(lsData)) {
    delete lsData[key];
  }
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  resetLsData();

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

  // Fresh Pinia — store setup fn re-runs including hydrate()
  setActivePinia(createPinia());
});

// ─── Default state ────────────────────────────────────────────────────────────

describe("usePreferencesStore — defaults", () => {
  it("darkMode defaults to 'auto' when localStorage is empty", () => {
    const store = usePreferencesStore();
    expect(store.darkMode).toBe("auto");
  });

  it("hasSeenEntrance defaults to false when localStorage is empty", () => {
    const store = usePreferencesStore();
    expect(store.hasSeenEntrance).toBe(false);
  });

  it("hasSeenAudioPreview defaults to false when localStorage is empty", () => {
    const store = usePreferencesStore();
    expect(store.hasSeenAudioPreview).toBe(false);
  });
});

// ─── hydrate() reads from localStorage ───────────────────────────────────────

describe("usePreferencesStore — hydrate()", () => {
  it("hydrate() with empty localStorage returns defaults", () => {
    const store = usePreferencesStore();
    store.hydrate();
    expect(store.darkMode).toBe("auto");
    expect(store.hasSeenEntrance).toBe(false);
    expect(store.hasSeenAudioPreview).toBe(false);
  });

  it("second hydrate() call reads stored state", () => {
    lsData["mahjong-prefs-v1"] = JSON.stringify({
      darkMode: "dark",
      hasSeenEntrance: true,
      hasSeenAudioPreview: true,
    });

    const store = usePreferencesStore();
    store.hydrate();

    expect(store.darkMode).toBe("dark");
    expect(store.hasSeenEntrance).toBe(true);
    expect(store.hasSeenAudioPreview).toBe(true);
  });

  it("hydrate() merges with defaults for partial stored data", () => {
    lsData["mahjong-prefs-v1"] = JSON.stringify({ darkMode: "light" });

    const store = usePreferencesStore();
    store.hydrate();

    expect(store.darkMode).toBe("light");
    expect(store.hasSeenEntrance).toBe(false);
    expect(store.hasSeenAudioPreview).toBe(false);
  });
});

// ─── persist() + hydrate() round-trip ────────────────────────────────────────

describe("usePreferencesStore — persist() + hydrate() round-trip", () => {
  it("persists all fields and restores them on hydrate()", () => {
    const store = usePreferencesStore();
    store.setDarkMode("light");
    store.markEntranceSeen();
    store.markAudioPreviewSeen();

    // Simulate a new store instance reading from localStorage
    const store2 = usePreferencesStore();
    store2.hydrate();

    expect(store2.darkMode).toBe("light");
    expect(store2.hasSeenEntrance).toBe(true);
    expect(store2.hasSeenAudioPreview).toBe(true);
  });
});

// ─── setDarkMode() ────────────────────────────────────────────────────────────

describe("usePreferencesStore — setDarkMode()", () => {
  it("updates darkMode ref and persists", () => {
    const store = usePreferencesStore();
    store.setDarkMode("dark");

    expect(store.darkMode).toBe("dark");

    const raw = lsData["mahjong-prefs-v1"];
    expect(raw).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(raw);
    expect(parsed.darkMode).toBe("dark");
  });

  it("setDarkMode('light') updates ref and persists", () => {
    const store = usePreferencesStore();
    store.setDarkMode("light");

    expect(store.darkMode).toBe("light");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(lsData["mahjong-prefs-v1"]);
    expect(parsed.darkMode).toBe("light");
  });

  it("setDarkMode('auto') reverts back and persists", () => {
    const store = usePreferencesStore();
    store.setDarkMode("dark");
    store.setDarkMode("auto");

    expect(store.darkMode).toBe("auto");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(lsData["mahjong-prefs-v1"]);
    expect(parsed.darkMode).toBe("auto");
  });
});

// ─── markEntranceSeen() ───────────────────────────────────────────────────────

describe("usePreferencesStore — markEntranceSeen()", () => {
  it("sets hasSeenEntrance to true and persists", () => {
    const store = usePreferencesStore();
    expect(store.hasSeenEntrance).toBe(false);

    store.markEntranceSeen();

    expect(store.hasSeenEntrance).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(lsData["mahjong-prefs-v1"]);
    expect(parsed.hasSeenEntrance).toBe(true);
  });
});

// ─── markAudioPreviewSeen() ───────────────────────────────────────────────────

describe("usePreferencesStore — markAudioPreviewSeen()", () => {
  it("sets hasSeenAudioPreview to true and persists", () => {
    const store = usePreferencesStore();
    expect(store.hasSeenAudioPreview).toBe(false);

    store.markAudioPreviewSeen();

    expect(store.hasSeenAudioPreview).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(lsData["mahjong-prefs-v1"]);
    expect(parsed.hasSeenAudioPreview).toBe(true);
  });
});
