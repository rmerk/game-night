<script setup lang="ts">
/**
 * Story 4B.9 stub — full SpectatorGameView pipeline is post-MVP.
 */
import { useRouter } from "vue-router";

const router = useRouter();

function goHome() {
  void router.push({ name: "home" });
}
</script>

<template>
  <div
    data-testid="spectator-placeholder"
    class="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-felt-teal px-4 text-center text-text-on-felt"
  >
    <h1 class="text-5 font-semibold">Spectator mode</h1>
    <p class="max-w-md text-3.5 text-text-on-felt/85">
      Spectator mode is coming soon — check back later.
    </p>
    <button
      type="button"
      data-testid="spectator-placeholder-back"
      class="rounded-md bg-chrome-surface px-4 py-2 text-3.5 font-medium text-text-primary"
      @click="goHome"
    >
      Back to home
    </button>
  </div>
</template>
