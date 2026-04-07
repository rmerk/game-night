import { defineStore } from "pinia";
import { ref } from "vue";

const STORAGE_KEY = "mahjong-prefs-v1";

interface PersistedShape {
  darkMode: "auto" | "light" | "dark";
  hasSeenEntrance: boolean;
  hasSeenAudioPreview: boolean;
}

const defaults: PersistedShape = {
  darkMode: "auto",
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

/**
 * Player UI preferences (dark mode, one-time flags) — not game state.
 * Persists to localStorage under `mahjong-prefs-v1`.
 */
export const usePreferencesStore = defineStore("preferences", () => {
  const darkMode = ref<"auto" | "light" | "dark">("auto");
  const hasSeenEntrance = ref(false);
  const hasSeenAudioPreview = ref(false);

  function persist() {
    const payload: PersistedShape = {
      darkMode: darkMode.value,
      hasSeenEntrance: hasSeenEntrance.value,
      hasSeenAudioPreview: hasSeenAudioPreview.value,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function hydrate() {
    const p = loadPersisted();
    darkMode.value = p.darkMode;
    hasSeenEntrance.value = p.hasSeenEntrance;
    hasSeenAudioPreview.value = p.hasSeenAudioPreview;
  }

  hydrate();

  function setDarkMode(value: "auto" | "light" | "dark") {
    darkMode.value = value;
    persist();
  }

  function markEntranceSeen() {
    hasSeenEntrance.value = true;
    persist();
  }

  function markAudioPreviewSeen() {
    hasSeenAudioPreview.value = true;
    persist();
  }

  return {
    darkMode,
    hasSeenEntrance,
    hasSeenAudioPreview,
    setDarkMode,
    markEntranceSeen,
    markAudioPreviewSeen,
    hydrate,
  };
});
