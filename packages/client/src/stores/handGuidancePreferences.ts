import { defineStore } from "pinia";
import { computed, ref } from "vue";

const STORAGE_KEY = "mahjong-hand-guidance-prefs-v1";

interface PersistedShape {
  completedGamesCount: number;
  guidanceExplicitUserOverride: boolean | null;
  /** True after we have shown the auto-disable toast (or user already past threshold on load). */
  hasShownAutoDisableToast: boolean;
}

const defaults: PersistedShape = {
  completedGamesCount: 0,
  guidanceExplicitUserOverride: null,
  hasShownAutoDisableToast: false,
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
 * Local hand-guidance preferences (Story 5B.2) — not game state.
 * `completedGamesCount` and overrides persist in localStorage.
 */
export const useHandGuidancePreferencesStore = defineStore("handGuidancePreferences", () => {
  const completedGamesCount = ref(0);
  const guidanceExplicitUserOverride = ref<boolean | null>(null);
  const hasShownAutoDisableToast = ref(false);

  function persist() {
    const payload: PersistedShape = {
      completedGamesCount: completedGamesCount.value,
      guidanceExplicitUserOverride: guidanceExplicitUserOverride.value,
      hasShownAutoDisableToast: hasShownAutoDisableToast.value,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function hydrate() {
    const p = loadPersisted();
    completedGamesCount.value = p.completedGamesCount;
    guidanceExplicitUserOverride.value = p.guidanceExplicitUserOverride;
    hasShownAutoDisableToast.value = p.hasShownAutoDisableToast;
    if (completedGamesCount.value >= 3) {
      hasShownAutoDisableToast.value = true;
      persist();
    }
  }

  hydrate();

  /** True when the user wants hints, before room-level gating. */
  const userWantsHandGuidance = computed(() => {
    if (guidanceExplicitUserOverride.value === true) return true;
    if (guidanceExplicitUserOverride.value === false) return false;
    return completedGamesCount.value < 3;
  });

  function setGuidanceExplicitOverride(value: boolean | null) {
    guidanceExplicitUserOverride.value = value;
    persist();
  }

  /**
   * Call once per qualifying game end (Mahjong or wall game, seated player).
   * Returns true when the host should show the one-time "hints disabled" toast (3rd game).
   */
  function recordQualifyingGameCompletion(): boolean {
    if (completedGamesCount.value >= 3) return false;
    completedGamesCount.value += 1;
    persist();
    if (completedGamesCount.value === 3) {
      hasShownAutoDisableToast.value = true;
      persist();
      return true;
    }
    return false;
  }

  return {
    completedGamesCount,
    guidanceExplicitUserOverride,
    hasShownAutoDisableToast,
    userWantsHandGuidance,
    setGuidanceExplicitOverride,
    recordQualifyingGameCompletion,
    hydrate,
  };
});
