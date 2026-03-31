<script setup lang="ts">
import { computed } from "vue";
import type { GameResult, MahjongGameResult } from "@mahjong-game/shared";
import SessionScores from "./SessionScores.vue";

const props = defineProps<{
  gameResult: GameResult | null;
  playerNamesById: Record<string, string>;
  playerOrder: string[];
  sessionScores: Record<string, number>;
}>();

function isMahjong(result: GameResult | null): result is MahjongGameResult {
  return result !== null && result.winnerId !== null;
}

const mahjongResult = computed(() => (isMahjong(props.gameResult) ? props.gameResult : null));

const winnerName = computed(() => {
  if (!mahjongResult.value) {
    return null;
  }

  return props.playerNamesById[mahjongResult.value.winnerId] ?? mahjongResult.value.winnerId;
});

const paymentEntries = computed(() => {
  return props.playerOrder.map((playerId) => ({
    playerId,
    playerName: props.playerNamesById[playerId] ?? playerId,
    amount: mahjongResult.value?.payments[playerId] ?? 0,
  }));
});

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
</script>

<template>
  <section
    data-testid="scoreboard"
    class="flex w-full max-w-3xl flex-col gap-4 rounded-2xl bg-chrome-surface-dark/85 p-4 text-text-on-felt shadow-panel"
  >
    <header class="flex flex-col gap-2">
      <h2 class="text-5 font-semibold">Scoreboard</h2>

      <template v-if="mahjongResult">
        <p class="text-4.5 font-semibold">{{ winnerName }} wins</p>
        <p class="text-4 text-text-on-felt/85">
          {{ mahjongResult?.patternName }} · {{ mahjongResult?.points }} points
        </p>
      </template>

      <template v-else>
        <p class="text-4.5 font-semibold">Wall game</p>
        <p class="text-4 text-text-on-felt/85">No winner this hand.</p>
      </template>
    </header>

    <section class="flex flex-col gap-2">
      <h3 class="text-4 font-semibold">Payments</h3>
      <ul class="grid gap-2 md:grid-cols-2">
        <li
          v-for="entry in paymentEntries"
          :key="entry.playerId"
          class="flex items-center justify-between rounded-lg bg-chrome-surface-dark/50 px-3 py-2"
        >
          <span>{{ entry.playerName }}</span>
          <span class="font-semibold">{{ formatDelta(entry.amount) }}</span>
        </li>
      </ul>
    </section>

    <SessionScores
      :player-names-by-id="props.playerNamesById"
      :player-order="props.playerOrder"
      :session-scores="props.sessionScores"
    />
  </section>
</template>
