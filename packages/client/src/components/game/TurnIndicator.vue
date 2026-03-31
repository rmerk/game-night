<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { SEATS, type SeatWind } from "@mahjong-game/shared";

const STEP_DURATION_MS = 400;

const props = defineProps<{
  activeSeat: SeatWind | null;
  playerNamesBySeat: Record<SeatWind, string>;
}>();

const displayedSeat = shallowRef<SeatWind | null>(props.activeSeat);

function buildTraversalPath(fromSeat: SeatWind, toSeat: SeatWind): SeatWind[] {
  if (fromSeat === toSeat) {
    return [toSeat];
  }

  const fromIndex = SEATS.indexOf(fromSeat);
  const toIndex = SEATS.indexOf(toSeat);
  const path: SeatWind[] = [];

  for (let step = 1; step <= SEATS.length; step += 1) {
    const seat = SEATS[(fromIndex + step) % SEATS.length];
    path.push(seat);

    if ((fromIndex + step) % SEATS.length === toIndex) {
      break;
    }
  }

  return path;
}

watch(
  () => props.activeSeat,
  (nextSeat, previousSeat, onCleanup) => {
    if (!nextSeat) {
      displayedSeat.value = null;
      return;
    }

    if (!previousSeat || previousSeat === nextSeat) {
      displayedSeat.value = nextSeat;
      return;
    }

    const path = buildTraversalPath(previousSeat, nextSeat);
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    displayedSeat.value = path[0] ?? nextSeat;

    path.slice(1).forEach((seat, index) => {
      timers.push(
        setTimeout(
          () => {
            displayedSeat.value = seat;
          },
          STEP_DURATION_MS * (index + 1),
        ),
      );
    });

    onCleanup(() => {
      timers.forEach((timer) => clearTimeout(timer));
    });
  },
);

const currentPlayerName = computed(() => {
  if (!displayedSeat.value) {
    return "Waiting for turn";
  }

  return props.playerNamesBySeat[displayedSeat.value];
});
</script>

<template>
  <div
    data-testid="turn-indicator"
    role="status"
    aria-live="polite"
    class="inline-flex items-center gap-2 rounded-full bg-chrome-surface-dark/85 px-4 py-2 text-text-on-felt shadow-panel"
  >
    <span class="text-secondary uppercase tracking-[0.2em] text-text-on-felt/75">Turn</span>
    <span class="text-interactive">{{ currentPlayerName }}</span>
  </div>
</template>
