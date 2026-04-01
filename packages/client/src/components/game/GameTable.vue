<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import TileRack from "./TileRack.vue";
import ActionZone from "./ActionZone.vue";
import OpponentArea from "./OpponentArea.vue";
import TurnIndicator from "./TurnIndicator.vue";
import WallCounter from "./WallCounter.vue";
import MobileBottomBar from "./MobileBottomBar.vue";
import DiscardPool from "./DiscardPool.vue";
import DiscardConfirm from "./DiscardConfirm.vue";
import CallButtons from "./CallButtons.vue";
import MahjongButton from "./MahjongButton.vue";
import InvalidMahjongNotification from "./InvalidMahjongNotification.vue";
import Scoreboard from "../scoreboard/Scoreboard.vue";
import type { LocalPlayerSummary, OpponentPlayer } from "./seat-types";
import {
  SEATS,
  type Tile,
  type CallType,
  type CallWindowState,
  type GamePhase,
  type GameResult,
  type SeatWind,
} from "@mahjong-game/shared";
import { useRackStore } from "../../stores/rack";

const rackStore = useRackStore();

const props = withDefaults(
  defineProps<{
    opponents?: {
      top?: OpponentPlayer | null;
      left?: OpponentPlayer | null;
      right?: OpponentPlayer | null;
    };
    tiles?: Tile[];
    isPlayerTurn?: boolean;
    localPlayer?: LocalPlayerSummary | null;
    currentTurnSeat?: SeatWind | null;
    wallRemaining?: number;
    gamePhase?: GamePhase;
    gameResult?: GameResult | null;
    discardPools?: {
      bottom?: Tile[];
      top?: Tile[];
      left?: Tile[];
      right?: Tile[];
    };
    callWindow?: CallWindowState | null;
    validCallOptions?: CallType[];
    invalidMahjongMessage?: string | null;
  }>(),
  {
    opponents: () => ({}),
    tiles: () => [],
    isPlayerTurn: false,
    localPlayer: null,
    currentTurnSeat: null,
    wallRemaining: 70,
    gamePhase: "play",
    gameResult: null,
    discardPools: () => ({}),
    callWindow: null,
    validCallOptions: () => [],
    invalidMahjongMessage: null,
  },
);

const emit = defineEmits<{
  discard: [tileId: string];
  call: [callType: CallType];
  pass: [];
  declareMahjong: [];
  cancelMahjong: [];
}>();

function handleDiscard(tileId: string) {
  rackStore.deselectTile();
  emit("discard", tileId);
}

const topPlayer = computed(() => props.opponents.top ?? null);
const leftPlayer = computed(() => props.opponents.left ?? null);
const rightPlayer = computed(() => props.opponents.right ?? null);

const openCallWindow = computed(() => {
  const cw = props.callWindow;
  return cw !== null && cw.status === "open" ? cw : null;
});

const isCallWindowOpen = computed(() => openCallWindow.value !== null);
const callWindowHasMahjong = computed(
  () => isCallWindowOpen.value && props.validCallOptions.includes("mahjong"),
);
const invalidMahjongVisible = computed(() => props.invalidMahjongMessage !== null);
const isScoreboardPhase = computed(() => props.gamePhase === "scoreboard");
const playerNamesBySeat = computed<Record<SeatWind, string>>(() => {
  const names: Record<SeatWind, string> = {
    east: "East",
    south: "South",
    west: "West",
    north: "North",
  };

  if (props.localPlayer) {
    names[props.localPlayer.seatWind] = props.localPlayer.name;
  }

  for (const player of [topPlayer.value, leftPlayer.value, rightPlayer.value]) {
    if (player) {
      names[player.seatWind] = player.name;
    }
  }

  return names;
});

const playersBySeat = computed(() => {
  const players: Partial<Record<SeatWind, { id: string; name: string; score: number }>> = {};

  if (props.localPlayer) {
    players[props.localPlayer.seatWind] = {
      id: props.localPlayer.id,
      name: props.localPlayer.name,
      score: props.localPlayer.score,
    };
  }

  for (const player of [topPlayer.value, leftPlayer.value, rightPlayer.value]) {
    if (player) {
      players[player.seatWind] = {
        id: player.id,
        name: player.name,
        score: player.score ?? 0,
      };
    }
  }

  return players;
});

const playerNamesById = computed<Record<string, string>>(() => {
  const entries = Object.values(playersBySeat.value).map((player) => [player.id, player.name]);
  return Object.fromEntries(entries);
});

const playerOrder = computed(() =>
  SEATS.map((seat) => playersBySeat.value[seat]?.id).filter((playerId): playerId is string =>
    Boolean(playerId),
  ),
);

const sessionScores = computed<Record<string, number>>(() => {
  const entries = Object.values(playersBySeat.value).map((player) => [player.id, player.score]);
  return Object.fromEntries(entries);
});

const actionZoneEntryRef = useTemplateRef<HTMLDivElement>("actionZoneEntry");

function isSeatActive(seatWind: SeatWind | undefined): boolean {
  return seatWind !== undefined && props.currentTurnSeat === seatWind;
}

const isLocalPlayerTurn = computed(() => isSeatActive(props.localPlayer?.seatWind));

function focusActionZone() {
  actionZoneEntryRef.value?.focus();
}

function handleChatPlaceholderKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  focusActionZone();
}
</script>

<template>
  <a
    data-testid="skip-to-game-table"
    href="#gameplay-region"
    class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-chrome-surface focus:px-4 focus:py-2 focus:text-text-primary focus:focus-ring-on-chrome"
  >
    Skip to game table
  </a>
  <div
    id="gameplay-region"
    data-testid="game-table"
    class="game-table bg-felt-teal min-h-[100dvh] max-w-screen-2xl mx-auto grid gap-2 p-2 lg:p-4"
  >
    <!-- Opponent Top -->
    <div data-testid="opponent-top" class="game-table__opponent-top flex justify-center">
      <OpponentArea
        position="top"
        :player="topPlayer"
        :is-active-turn="isSeatActive(topPlayer?.seatWind)"
        :score="topPlayer?.score ?? null"
      />
    </div>

    <!-- Left / Center / Right row -->
    <div class="game-table__middle grid md:grid-cols-[auto_1fr_auto] gap-2">
      <!-- Opponent Left (hidden on phone, shown via grid on tablet/desktop) -->
      <div
        data-testid="opponent-left"
        class="game-table__opponent-left hidden md:flex items-center justify-center"
      >
        <OpponentArea
          position="left"
          :player="leftPlayer"
          :is-active-turn="isSeatActive(leftPlayer?.seatWind)"
          :score="leftPlayer?.score ?? null"
        />
      </div>

      <!-- Table Center -->
      <div
        data-testid="table-center"
        class="game-table__center min-h-[40dvh] flex flex-col items-center justify-center gap-4"
      >
        <Scoreboard
          v-if="isScoreboardPhase"
          :game-result="gameResult"
          :player-names-by-id="playerNamesById"
          :player-order="playerOrder"
          :session-scores="sessionScores"
        />

        <template v-else>
          <div class="flex w-full justify-center">
            <WallCounter :wall-remaining="wallRemaining" />
          </div>

          <TurnIndicator
            v-if="currentTurnSeat"
            :active-seat="currentTurnSeat"
            :player-names-by-seat="playerNamesBySeat"
          />

          <!-- Phone: inline opponent row for left/right -->
          <div class="flex md:hidden gap-4 justify-center w-full">
            <OpponentArea
              position="left"
              :player="leftPlayer"
              :is-active-turn="isSeatActive(leftPlayer?.seatWind)"
              :score="leftPlayer?.score ?? null"
            />
            <OpponentArea
              position="right"
              :player="rightPlayer"
              :is-active-turn="isSeatActive(rightPlayer?.seatWind)"
              :score="rightPlayer?.score ?? null"
            />
          </div>

          <!-- Discard Pools -->
          <div
            data-testid="discard-pools"
            class="discard-pools grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-1 w-full max-w-lg"
          >
            <div class="col-start-2 flex justify-center">
              <DiscardPool :tiles="discardPools?.top ?? []" position="top" />
            </div>
            <div class="row-start-2 flex items-center">
              <DiscardPool :tiles="discardPools?.left ?? []" position="left" />
            </div>
            <div class="row-start-2 col-start-2" />
            <div class="row-start-2 col-start-3 flex items-center">
              <DiscardPool :tiles="discardPools?.right ?? []" position="right" />
            </div>
            <div class="col-start-2 row-start-3 flex justify-center">
              <DiscardPool :tiles="discardPools?.bottom ?? []" position="bottom" />
            </div>
          </div>
        </template>
      </div>

      <!-- Opponent Right (hidden on phone, shown via grid on tablet/desktop) -->
      <div
        data-testid="opponent-right"
        class="game-table__opponent-right hidden md:flex items-center justify-center"
      >
        <OpponentArea
          position="right"
          :player="rightPlayer"
          :is-active-turn="isSeatActive(rightPlayer?.seatWind)"
          :score="rightPlayer?.score ?? null"
        />
      </div>
    </div>

    <!-- Rack Area -->
    <div
      v-if="!isScoreboardPhase"
      data-testid="rack-area"
      class="game-table__rack order-4 md:pb-[env(safe-area-inset-bottom)]"
    >
      <div data-testid="rack-zone-entry">
        <div v-if="localPlayer" class="mb-2 flex justify-center">
          <div
            data-testid="local-player-status-shell"
            class="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-chrome-surface-dark/85 px-4 py-2 text-text-on-felt shadow-panel"
            :class="isLocalPlayerTurn ? 'ring-2 ring-state-turn-active' : ''"
          >
            <span class="text-interactive">{{ localPlayer.name }}</span>
            <span
              v-if="isLocalPlayerTurn"
              data-testid="local-player-status"
              class="rounded-full bg-state-turn-active/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
              Current turn
            </span>
            <span data-testid="local-player-score" class="text-3 text-text-on-felt/85">
              Score: {{ localPlayer.score }}
            </span>
          </div>
        </div>
        <TileRack :tiles="tiles" :is-player-turn="isPlayerTurn" />
      </div>
    </div>

    <!-- Action Zone -->
    <div v-if="!isScoreboardPhase" data-testid="action-zone" class="order-3">
      <div ref="actionZoneEntry" data-testid="action-zone-entry" tabindex="-1">
        <ActionZone>
          <div class="flex flex-col items-center justify-center gap-2">
            <div data-toolbar-controls class="flex flex-wrap items-center justify-center gap-2">
              <MahjongButton
                :is-call-window-open="isCallWindowOpen"
                :hide-for-call-duplication="callWindowHasMahjong"
                @declare-mahjong="emit('declareMahjong')"
                @call-mahjong="emit('call', 'mahjong')"
              />
              <Transition name="call-buttons">
                <CallButtons
                  v-if="openCallWindow"
                  :valid-calls="validCallOptions"
                  :call-window-status="openCallWindow.status"
                  @call="(callType: CallType) => emit('call', callType)"
                  @pass="emit('pass')"
                />
              </Transition>
              <DiscardConfirm
                v-if="!isCallWindowOpen"
                :selected-tile-id="rackStore.selectedTileId"
                :is-player-turn="isPlayerTurn"
                @discard="handleDiscard"
              />
            </div>
            <InvalidMahjongNotification
              :visible="invalidMahjongVisible"
              :message="invalidMahjongMessage ?? ''"
              @cancel="emit('cancelMahjong')"
            />
          </div>
        </ActionZone>
      </div>
    </div>

    <div
      v-if="!isScoreboardPhase"
      data-testid="chat-placeholder-shell"
      class="order-5 flex justify-center"
    >
      <div
        data-testid="chat-placeholder-zone"
        tabindex="0"
        class="min-h-11 w-full max-w-sm rounded-md border border-dashed border-chrome-border bg-chrome-surface/85 px-4 py-3 text-center text-3.5 text-text-primary/80 focus-visible:focus-ring-on-felt"
        aria-label="Chat placeholder"
        @keydown="handleChatPlaceholderKeydown"
      >
        Chat placeholder. Press Escape to return to game actions.
      </div>
    </div>

    <div
      v-if="!isScoreboardPhase"
      data-testid="controls-zone-shell"
      class="order-6 flex justify-center"
    >
      <div data-testid="controls-zone-entry" class="w-full max-w-sm">
        <MobileBottomBar />
      </div>
    </div>
  </div>
</template>

<style scoped>
.call-buttons-leave-active {
  position: absolute;
  transition:
    opacity var(--timing-exit, 150ms) ease-in,
    transform var(--timing-exit, 150ms) ease-in;
}

.call-buttons-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
