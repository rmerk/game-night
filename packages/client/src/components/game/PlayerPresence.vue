<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import AvatarFallback from "./AvatarFallback.vue";
import VideoThumbnail from "./VideoThumbnail.vue";
import { PRESENCE_EXPANDED_FRAME_CLASS, PRESENCE_FRAME_CLASS } from "./presenceFrame";

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

const frameClass = computed(() => {
  const base =
    expanded.value && isMobile.value ? PRESENCE_EXPANDED_FRAME_CLASS : PRESENCE_FRAME_CLASS;
  const ring = props.isSpeaking ? " ring-2 ring-state-turn-active" : "";
  return `${base}${ring}`;
});
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
      :aria-label="`${displayName}'s seat`"
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
.presence-media-enter-active,
.presence-media-leave-active {
  transition: opacity 0.15s ease;
}
.presence-media-enter-from,
.presence-media-leave-to {
  opacity: 0;
}
</style>
