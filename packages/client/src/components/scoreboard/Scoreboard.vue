<script setup lang="ts">
import { computed } from "vue";
import type { GameResult, MahjongGameResult, SessionGameHistoryEntry } from "@mahjong-game/shared";
import BasePanel from "../ui/BasePanel.vue";
import BaseButton from "../ui/BaseButton.vue";
import SessionScores from "./SessionScores.vue";
import { formatSignedNumber } from "./format-signed-number";

const props = withDefaults(
  defineProps<{
    gameResult: GameResult | null;
    playerNamesById: Record<string, string>;
    playerOrder: string[];
    sessionScores: Record<string, number>;
    sessionGameHistory?: readonly SessionGameHistoryEntry[];
    viewerIsHost?: boolean;
    /** Server confirmed this viewer revealed their hand (Story 5B.5). */
    hasShownHand?: boolean;
  }>(),
  {
    viewerIsHost: false,
    hasShownHand: false,
  },
);

const emit = defineEmits<{
  playAgain: [];
  endSession: [];
  showHand: [];
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

const history = computed(() => props.sessionGameHistory ?? []);

function gameSummary(entry: SessionGameHistoryEntry): string {
  const gr = entry.gameResult;
  if (gr && gr.winnerId !== null) {
    const w = props.playerNamesById[gr.winnerId] ?? gr.winnerId;
    return `${w} — ${gr.patternName} (${gr.points} pts)`;
  }
  return "Wall game — no winner";
}
</script>

<template>
  <BasePanel
    data-testid="scoreboard"
    tag="section"
    variant="dark-raised"
    class="flex w-full max-w-3xl flex-col gap-4 rounded-2xl p-4"
  >
    <header class="flex flex-col gap-2">
      <h2 class="text-5 font-semibold">Scoreboard</h2>

      <template v-if="mahjongResult">
        <p class="text-4.5 font-semibold">{{ winnerName }} wins</p>
        <p class="text-4 text-text-on-felt/85">
          {{ mahjongResult.patternName }} · {{ mahjongResult.points }} points
        </p>
      </template>

      <template v-else>
        <p class="text-4.5 font-semibold">Wall game</p>
        <p class="text-4 text-text-on-felt/85">No winner this hand.</p>
      </template>
    </header>

    <section class="flex flex-col gap-2">
      <h3 class="text-4 font-semibold">This game — payments</h3>
      <ul class="grid gap-2 md:grid-cols-2">
        <BasePanel
          v-for="entry in paymentEntries"
          :key="entry.playerId"
          tag="li"
          variant="dark-muted"
          class="flex items-center justify-between rounded-lg px-3 py-2"
        >
          <span>{{ entry.playerName }}</span>
          <span class="font-semibold">{{ formatSignedNumber(entry.amount) }}</span>
        </BasePanel>
      </ul>
    </section>

    <section v-if="history.length > 0" class="flex flex-col gap-2">
      <h3 class="text-4 font-semibold">Earlier games</h3>
      <ul class="flex flex-col gap-2">
        <BasePanel
          v-for="entry in history"
          :key="entry.gameNumber"
          tag="li"
          variant="dark-muted"
          class="rounded-lg px-3 py-2 text-3.5 text-text-on-felt/90"
        >
          <span class="font-medium text-text-on-felt">Game {{ entry.gameNumber }}</span>
          <span class="ml-2">{{ gameSummary(entry) }}</span>
        </BasePanel>
      </ul>
    </section>

    <SessionScores
      :player-names-by-id="props.playerNamesById"
      :player-order="props.playerOrder"
      :session-scores="props.sessionScores"
    />

    <section
      class="flex flex-col items-center gap-2 border-t border-chrome-border/40 pt-4"
      data-testid="scoreboard-show-hand-section"
    >
      <BaseButton
        data-testid="scoreboard-show-hand"
        type="button"
        variant="secondary"
        class="!min-h-11 max-w-md"
        :disabled="hasShownHand"
        @click="emit('showHand')"
      >
        {{ hasShownHand ? "Hand Shown" : "Show My Hand" }}
      </BaseButton>
    </section>

    <footer
      v-if="viewerIsHost"
      class="flex flex-col gap-3 border-t border-chrome-border/40 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4"
    >
      <BaseButton
        data-testid="scoreboard-play-again"
        type="button"
        variant="primary"
        class="!min-h-11 max-w-md self-center shadow-sm"
        @click="emit('playAgain')"
      >
        Play again
      </BaseButton>
      <BaseButton
        data-testid="scoreboard-end-session"
        type="button"
        variant="secondary"
        class="!min-h-11 max-w-md self-center"
        @click="emit('endSession')"
      >
        End session
      </BaseButton>
      <p class="text-center text-3 text-text-on-felt/70 sm:w-full">
        Next game rotates the dealer counterclockwise. End session shows a final summary for
        everyone.
      </p>
    </footer>
    <p
      v-else
      class="border-t border-chrome-border/40 pt-4 text-center text-3.5 text-text-on-felt/75"
    >
      Waiting for the host to start the next game or end the session.
    </p>
  </BasePanel>
</template>
