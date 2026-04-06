<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  videoTrack: unknown | null;
}>();

const videoMountEl = ref<HTMLDivElement | null>(null);

function asTrack(t: unknown): { attach: () => HTMLVideoElement; detach: () => void } | null {
  if (
    t !== null &&
    typeof t === "object" &&
    "attach" in t &&
    typeof (t as { attach: unknown }).attach === "function" &&
    "detach" in t &&
    typeof (t as { detach: unknown }).detach === "function"
  ) {
    return t as { attach: () => HTMLVideoElement; detach: () => void };
  }
  return null;
}

function clearMount(): void {
  const el = videoMountEl.value;
  if (el) {
    el.replaceChildren();
  }
}

function mountTrack(): void {
  clearMount();
  const track = asTrack(props.videoTrack);
  const mount = videoMountEl.value;
  if (!track || !mount) {
    return;
  }
  try {
    const videoEl = track.attach();
    videoEl.className = "h-full w-full object-cover";
    mount.appendChild(videoEl);
  } catch {
    /* NFR23: A/V failure is non-fatal — parent shows avatar fallback */
  }
}

watch(
  () => props.videoTrack,
  (_next, prev) => {
    if (prev) {
      const pt = asTrack(prev);
      if (pt) {
        pt.detach();
      }
    }
    clearMount();
    mountTrack();
  },
);

onMounted(() => {
  mountTrack();
});

onBeforeUnmount(() => {
  const t = asTrack(props.videoTrack);
  if (t) {
    t.detach();
  }
  clearMount();
});
</script>

<template>
  <div
    data-testid="video-thumbnail"
    class="h-full w-full bg-chrome-surface-dark/40"
    aria-hidden="true"
  >
    <div ref="videoMountEl" class="h-full w-full" />
  </div>
</template>
