<script setup lang="ts">
/**
 * Client-only cosmetic dealing ritual (Story 5B.6). Server state is already dealt.
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";

const emit = defineEmits<{
  done: [];
}>();

type Phase = "wall" | "dice" | "deal" | "reveal";

const phase = ref<Phase>("wall");
const diceValues = ref<[number, number]>([3, 4]);
const prefersReducedMotion = usePreferredReducedMotion();

const wallTileCount = 152;
const wallIndices = Array.from({ length: wallTileCount }, (_, i) => i);

let timers: ReturnType<typeof setTimeout>[] = [];

function clearTimers() {
  for (const t of timers) {
    clearTimeout(t);
  }
  timers = [];
}

function schedule(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms));
}

onMounted(() => {
  if (prefersReducedMotion.value) {
    emit("done");
    return;
  }
  diceValues.value = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)] as [
    number,
    number,
  ];

  // Wall build (~1s) → dice (~0.85s) → deal (~2s) → brief reveal (~0.55s) → done (~4.4s total)
  schedule(() => {
    phase.value = "dice";
  }, 1000);
  schedule(() => {
    phase.value = "deal";
  }, 1850);
  schedule(() => {
    phase.value = "reveal";
  }, 3850);
  schedule(() => {
    emit("done");
  }, 4400);
});

onBeforeUnmount(() => {
  clearTimers();
});
</script>

<template>
  <div
    data-testid="dealing-animation-overlay"
    class="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/55 p-4 text-text-on-felt backdrop-blur-[2px]"
    role="presentation"
    aria-hidden="true"
  >
    <div
      class="max-h-[min(90dvh,42rem)] w-full max-w-3xl overflow-hidden rounded-xl border border-chrome-border bg-felt-teal/95 p-4 shadow-lg"
    >
      <p class="mb-3 text-center text-interactive text-3.5 font-semibold text-text-primary">
        Dealing…
      </p>

      <div
        v-if="phase === 'wall'"
        class="dealing-animation__wall grid max-h-[50dvh] gap-0.5 overflow-hidden"
      >
        <div
          v-for="i in wallIndices"
          :key="i"
          class="dealing-animation__wall-tile aspect-square min-h-0 rounded-sm bg-chrome-elevated shadow-sm"
          :style="{ animationDelay: `${(i % 19) * 18 + Math.floor(i / 19) * 22}ms` }"
        />
      </div>

      <div
        v-else-if="phase === 'dice'"
        class="flex flex-col items-center justify-center gap-6 py-12"
      >
        <p class="text-3 text-text-secondary">Break point</p>
        <div class="flex gap-8">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-chrome-border bg-chrome-surface text-4xl font-bold text-gold-accent shadow-tile dealing-animation__dice"
          >
            {{ diceValues[0] }}
          </div>
          <div
            class="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-chrome-border bg-chrome-surface text-4xl font-bold text-gold-accent shadow-tile dealing-animation__dice"
          >
            {{ diceValues[1] }}
          </div>
        </div>
      </div>

      <div
        v-else-if="phase === 'deal'"
        class="flex flex-col items-center justify-center gap-4 py-10 text-center"
      >
        <p class="text-3.5 text-text-primary">Tiles to East, South, West, North…</p>
        <div class="flex flex-wrap justify-center gap-2">
          <span
            v-for="n in 12"
            :key="n"
            class="h-8 w-6 rounded-sm bg-chrome-elevated shadow-sm dealing-animation__deal-chip"
            :style="{ animationDelay: `${n * 80}ms` }"
          />
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-12">
        <p class="text-3.5 text-text-primary">Hands ready</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dealing-animation__wall {
  grid-template-columns: repeat(19, minmax(0, 1fr));
}

.dealing-animation__wall-tile {
  animation: dealing-wall-in var(--timing-expressive, 400ms) var(--ease-expressive, ease-out) both;
}

.dealing-animation__dice {
  animation: dealing-dice-roll 0.85s var(--ease-expressive, ease-out) both;
}

.dealing-animation__deal-chip {
  animation: dealing-chip-out var(--timing-expressive, 400ms) ease-out both;
}

@keyframes dealing-wall-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dealing-dice-roll {
  0% {
    transform: rotate(0deg) scale(0.85);
    opacity: 0.6;
  }
  40% {
    transform: rotate(180deg) scale(1.05);
    opacity: 1;
  }
  100% {
    transform: rotate(360deg) scale(1);
    opacity: 1;
  }
}

@keyframes dealing-chip-out {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dealing-animation__wall-tile,
  .dealing-animation__dice,
  .dealing-animation__deal-chip {
    animation: none;
  }
}
</style>
