<script setup lang="ts">
/**
 * Audio settings — three channel volume sliders + master mute + ambient enable.
 * AC 4, 6, 8 (Story 7.3). Theme selector — AC 2 (Story 7.4).
 * Reads/writes directly from useAudioStore and usePreferencesStore; no props.
 */
import { computed } from "vue";
import BaseToggle from "../ui/BaseToggle.vue";
import { useAudioStore } from "../../stores/audio";
import { usePreferencesStore } from "../../stores/preferences";

const audioStore = useAudioStore();
const prefsStore = usePreferencesStore();

// ─── Theme ────────────────────────────────────────────────────────────────────

type ThemeOption = "auto" | "light" | "dark";

const themeOptions: { value: ThemeOption; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const currentTheme = computed(() => prefsStore.darkMode);

function selectTheme(value: ThemeOption) {
  prefsStore.setDarkMode(value);
}

// ─── Master mute ──────────────────────────────────────────────────────────────

const masterMuted = computed({
  get: () => audioStore.masterMuted,
  set: (v: boolean) => {
    audioStore.setMasterMuted(v);
  },
});

// ─── Ambient enable ───────────────────────────────────────────────────────────

const ambientEnabled = computed({
  get: () => audioStore.ambientEnabled,
  set: (v: boolean) => {
    audioStore.setAmbientEnabled(v);
    if (v) {
      void audioStore.playAmbientLoop();
    } else {
      audioStore.stopAmbientLoop();
    }
  },
});
</script>

<template>
  <div
    data-testid="audio-settings-panel"
    class="rounded-md border border-chrome-border bg-chrome-surface/90 text-text-primary"
  >
    <h2 class="border-b border-chrome-border px-3 py-2 text-interactive text-3.5 font-semibold">
      Audio settings
    </h2>
    <div class="space-y-4 px-3 py-3 text-3.5">
      <!-- Master mute -->
      <BaseToggle v-model="masterMuted" label="Master mute" aria-label="Master mute" />

      <!-- Gameplay volume -->
      <div>
        <label class="mb-1 block text-interactive font-semibold">
          Gameplay volume ({{ Math.round(audioStore.gameplayVolume * 100) }}%)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(audioStore.gameplayVolume * 100)"
          class="w-full accent-gold-accent"
          aria-label="Gameplay volume"
          @input="
            (e) => audioStore.setGameplayVolume(Number((e.target as HTMLInputElement).value) / 100)
          "
        />
      </div>

      <!-- Notification volume -->
      <div>
        <label class="mb-1 block text-interactive font-semibold">
          Notification volume ({{ Math.round(audioStore.notificationVolume * 100) }}%)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(audioStore.notificationVolume * 100)"
          class="w-full accent-gold-accent"
          aria-label="Notification volume"
          @input="
            (e) =>
              audioStore.setNotificationVolume(Number((e.target as HTMLInputElement).value) / 100)
          "
        />
      </div>

      <!-- Ambient volume -->
      <div>
        <label class="mb-1 block text-interactive font-semibold">
          Ambient volume ({{ Math.round(audioStore.ambientVolume * 100) }}%)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(audioStore.ambientVolume * 100)"
          class="w-full accent-gold-accent"
          aria-label="Ambient volume"
          @input="
            (e) => audioStore.setAmbientVolume(Number((e.target as HTMLInputElement).value) / 100)
          "
        />
      </div>

      <!-- Ambient loop enable -->
      <div>
        <BaseToggle v-model="ambientEnabled" label="Ambient music" />
        <p class="mt-1 text-3 text-text-secondary">
          Lo-fi jazz loop plays during your game session. Off by default.
        </p>
      </div>
    </div>

    <!-- Theme section -->
    <div class="border-t border-chrome-border px-3 py-3 text-3.5">
      <p class="mb-2 text-interactive font-semibold">Theme</p>
      <div role="group" aria-label="Theme" class="flex gap-2">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          type="button"
          :data-testid="`theme-${opt.value}`"
          :aria-pressed="currentTheme === opt.value ? 'true' : 'false'"
          class="flex-1 min-h-11 rounded-md border px-3 py-2 text-center font-medium transition-colors focus-visible:focus-ring-on-chrome"
          :class="
            currentTheme === opt.value
              ? 'border-gold-accent bg-gold-accent text-chrome-surface'
              : 'border-chrome-border bg-chrome-surface text-text-primary hover:border-gold-accent/60'
          "
          @click="selectTheme(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>
