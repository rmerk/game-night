<script setup lang="ts">
import { computed } from "vue";
import type { AVPermissionState } from "../../composables/useLiveKit";

const props = withDefaults(
  defineProps<{
    isMicEnabled: boolean;
    isCameraEnabled: boolean;
    connectionStatus: string;
    permissionState: AVPermissionState;
    /** `chrome` for raised chrome panels; `felt` for table felt background. */
    surface?: "chrome" | "felt";
  }>(),
  {
    surface: "felt",
  },
);

const emit = defineEmits<{
  "toggle-mic": [];
  "toggle-camera": [];
  "request-av": [];
}>();

const isConnected = computed(() => props.connectionStatus === "connected");

/** Toggles are inert until connected and permissions are granted (not denied / prompt / unknown pre-prompt). */
const togglesInert = computed(() => {
  if (!isConnected.value) {
    return true;
  }
  if (props.permissionState === "denied") {
    return true;
  }
  if (props.permissionState === "prompt" || props.permissionState === "unknown") {
    return true;
  }
  return false;
});

const showPermissionBanner = computed(
  () =>
    isConnected.value &&
    (props.permissionState === "prompt" || props.permissionState === "unknown"),
);

const showAvUnavailable = computed(() => props.permissionState === "denied");

const textClass = computed(() =>
  props.surface === "chrome" ? "text-text-primary/90" : "text-text-on-felt/90",
);

const mutedTextClass = computed(() =>
  props.surface === "chrome" ? "text-text-primary/45" : "text-text-on-felt/45",
);

function onToggleMic() {
  if (togglesInert.value) {
    return;
  }
  emit("toggle-mic");
}

function onToggleCamera() {
  if (togglesInert.value) {
    return;
  }
  emit("toggle-camera");
}

function onRequestAv() {
  emit("request-av");
}
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="av-controls">
    <div
      v-if="showPermissionBanner"
      class="rounded-lg border border-chrome-border/50 bg-chrome-surface/30 px-3 py-2 text-3"
      :class="textClass"
      data-testid="av-permission-banner"
    >
      <p class="mb-2 leading-snug">Allow mic so your friends can hear you.</p>
      <button
        type="button"
        class="min-tap w-full rounded-md border border-chrome-border/60 bg-transparent px-3 py-2 font-medium transition-opacity hover:opacity-90"
        :class="textClass"
        data-testid="av-request-button"
        @click="onRequestAv"
      >
        Turn on A/V
      </button>
    </div>

    <p
      v-if="showAvUnavailable"
      class="text-center text-2.5"
      :class="mutedTextClass"
      data-testid="av-unavailable-message"
    >
      A/V unavailable — you can still use text chat.
    </p>

    <div class="flex items-center justify-center gap-2" data-testid="av-toggle-row">
      <button
        type="button"
        class="min-tap flex items-center justify-center rounded-md border transition-opacity"
        :class="[
          togglesInert ? mutedTextClass : textClass,
          togglesInert
            ? 'border-chrome-border/30 cursor-not-allowed opacity-60'
            : 'border-chrome-border/50 hover:opacity-90',
        ]"
        :aria-disabled="togglesInert ? 'true' : undefined"
        :aria-label="isMicEnabled ? 'Mute microphone' : 'Unmute microphone'"
        data-testid="av-toggle-mic"
        @click="onToggleMic"
      >
        <!-- Mic on -->
        <svg
          v-if="isMicEnabled"
          class="h-6 w-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"
          />
        </svg>
        <!-- Mic muted -->
        <svg v-else class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l3.38 3.38c-.44.25-.94.4-1.03.4-1.66 0-3-1.34-3-3H6.7c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"
          />
        </svg>
      </button>

      <button
        type="button"
        class="min-tap flex items-center justify-center rounded-md border transition-opacity"
        :class="[
          togglesInert ? mutedTextClass : textClass,
          togglesInert
            ? 'border-chrome-border/30 cursor-not-allowed opacity-60'
            : 'border-chrome-border/50 hover:opacity-90',
        ]"
        :aria-disabled="togglesInert ? 'true' : undefined"
        :aria-label="isCameraEnabled ? 'Turn off camera' : 'Turn on camera'"
        data-testid="av-toggle-camera"
        @click="onToggleCamera"
      >
        <!-- Camera on -->
        <svg
          v-if="isCameraEnabled"
          class="h-6 w-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
          />
        </svg>
        <!-- Camera off -->
        <svg v-else class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
