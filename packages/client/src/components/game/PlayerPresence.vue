<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import AvatarFallback from "./AvatarFallback.vue";
import VideoThumbnail from "./VideoThumbnail.vue";
import { PRESENCE_EXPANDED_FRAME_CLASS, PRESENCE_FRAME_CLASS } from "./presenceFrame";
import { themeColors } from "../../styles/design-tokens";

function hexToSpaceSeparatedRgb(hex: string): string {
  const h = hex.replace(/^#/, "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Matches `themeColors.state['turn-active']` for animated halo keyframes */
const presenceSpeakingRgb = hexToSpaceSeparatedRgb(themeColors.state["turn-active"]);

const props = withDefaults(
  defineProps<{
    playerId: string;
    displayName: string;
    initial: string;
    position: "top" | "left" | "right" | "local";
    isActiveTurn?: boolean;
    videoTrack: unknown | null;
    isCameraEnabled: boolean;
    isSpeaking?: boolean;
  }>(),
  {
    isActiveTurn: false,
    isSpeaking: false,
  },
);

const showVideo = computed(() => props.videoTrack != null && props.isCameraEnabled);

const isMobile = useMediaQuery("(max-width: 767px)");
const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
const expanded = ref(false);

let expandTimer: ReturnType<typeof setTimeout> | null = null;

function clearExpandTimer(): void {
  if (expandTimer !== null) {
    clearTimeout(expandTimer);
    expandTimer = null;
  }
}

function collapseExpanded(): void {
  expanded.value = false;
  clearExpandTimer();
}

function scheduleAutoCollapse(): void {
  clearExpandTimer();
  expandTimer = setTimeout(() => {
    collapseExpanded();
  }, 4000);
}

function onFrameClick(): void {
  if (!isMobile.value || !showVideo.value) {
    return;
  }
  if (expanded.value) {
    collapseExpanded();
    return;
  }
  expanded.value = true;
  scheduleAutoCollapse();
}

watch(
  () => [props.videoTrack, props.isCameraEnabled] as const,
  () => {
    collapseExpanded();
  },
);

onBeforeUnmount(() => {
  clearExpandTimer();
});

const speakingFrameClass = computed(() => {
  if (!props.isSpeaking) {
    return "";
  }
  if (prefersReducedMotion.value) {
    return "ring-2 ring-state-turn-active";
  }
  return "player-presence--speaking-animated";
});

const frameClass = computed(() => {
  const base =
    expanded.value && isMobile.value ? PRESENCE_EXPANDED_FRAME_CLASS : PRESENCE_FRAME_CLASS;
  const speaking = speakingFrameClass.value;
  return speaking ? `${base} ${speaking}` : base;
});

const seatAriaLabel = computed(() =>
  props.isSpeaking ? `${props.displayName}'s seat, speaking` : `${props.displayName}'s seat`,
);

const presenceSpeakingStyle = { "--presence-speaking-rgb": presenceSpeakingRgb } as Record<
  string,
  string
>;
</script>

<template>
  <div
    class="relative flex flex-col items-center"
    :data-testid="`player-presence-${playerId}`"
    :data-position="position"
  >
    <div
      v-if="expanded && isMobile"
      class="fixed inset-0 z-40 bg-black/60"
      aria-hidden="true"
      data-testid="presence-expand-backdrop"
      @click="collapseExpanded"
    />
    <button
      type="button"
      class="relative z-50 flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 focus-visible:focus-ring-on-felt"
      :class="frameClass"
      :style="presenceSpeakingStyle"
      :aria-label="seatAriaLabel"
      :aria-pressed="expanded && isMobile ? 'true' : 'false'"
      @click.stop="onFrameClick"
    >
      <div class="flex h-full w-full items-center justify-center">
        <div
          class="relative h-10 w-10 overflow-hidden rounded-lg md:h-full md:w-full md:rounded-lg"
        >
          <Transition name="presence-media" mode="out-in">
            <VideoThumbnail
              v-if="showVideo"
              key="video"
              class="absolute inset-0 h-full w-full"
              :video-track="videoTrack"
            />
            <AvatarFallback
              v-else
              key="avatar"
              class="absolute inset-0 h-full w-full"
              :initial="initial"
              :label="`Avatar for ${displayName}`"
            />
          </Transition>
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
/* Animated halo uses --presence-speaking-rgb from themeColors.state['turn-active'] */
@keyframes player-presence-speaking-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgb(var(--presence-speaking-rgb) / 0.72),
      0 0 0 1px rgb(var(--presence-speaking-rgb) / 0.2) inset;
  }
  50% {
    box-shadow:
      0 0 0 3px rgb(var(--presence-speaking-rgb) / 0.95),
      0 0 14px rgb(var(--presence-speaking-rgb) / 0.28),
      0 0 0 1px rgb(var(--presence-speaking-rgb) / 0.25) inset;
  }
}

.player-presence--speaking-animated {
  animation: player-presence-speaking-pulse 1.45s ease-in-out infinite;
}

.presence-media-enter-active,
.presence-media-leave-active {
  transition: opacity 0.15s ease;
}
.presence-media-enter-from,
.presence-media-leave-to {
  opacity: 0;
}
</style>
