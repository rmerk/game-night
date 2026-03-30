<script setup lang="ts">
import { computed } from "vue";
import TileRack from "./TileRack.vue";
import ActionZone from "./ActionZone.vue";
import OpponentArea from "./OpponentArea.vue";
import MobileBottomBar from "./MobileBottomBar.vue";
import DiscardPool from "./DiscardPool.vue";
import DiscardConfirm from "./DiscardConfirm.vue";
import type { OpponentPlayer } from "./OpponentArea.vue";
import type { Tile } from "@mahjong-game/shared";
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
    discardPools?: {
      bottom?: Tile[];
      top?: Tile[];
      left?: Tile[];
      right?: Tile[];
    };
  }>(),
  {
    opponents: () => ({}),
    tiles: () => [],
    isPlayerTurn: false,
    discardPools: () => ({}),
  },
);

const emit = defineEmits<{
  discard: [tileId: string];
}>();

function handleDiscard(tileId: string) {
  rackStore.deselectTile();
  emit("discard", tileId);
}

const topPlayer = computed(() => props.opponents.top ?? null);
const leftPlayer = computed(() => props.opponents.left ?? null);
const rightPlayer = computed(() => props.opponents.right ?? null);

const isDev = import.meta.env.DEV;
</script>

<template>
  <div
    data-testid="game-table"
    class="game-table bg-felt-teal min-h-[100dvh] max-w-screen-2xl mx-auto grid gap-2 p-2 lg:p-4"
  >
    <!-- Opponent Top -->
    <div data-testid="opponent-top" class="game-table__opponent-top flex justify-center">
      <OpponentArea position="top" :player="topPlayer" />
    </div>

    <!-- Left / Center / Right row -->
    <div class="game-table__middle grid md:grid-cols-[auto_1fr_auto] gap-2">
      <!-- Opponent Left (hidden on phone, shown via grid on tablet/desktop) -->
      <div
        data-testid="opponent-left"
        class="game-table__opponent-left hidden md:flex items-center justify-center"
      >
        <OpponentArea position="left" :player="leftPlayer" />
      </div>

      <!-- Table Center -->
      <div
        data-testid="table-center"
        class="game-table__center min-h-[40dvh] flex flex-col items-center justify-center gap-4"
      >
        <!-- Phone: inline opponent row for left/right -->
        <div class="flex md:hidden gap-4 justify-center w-full">
          <OpponentArea position="left" :player="leftPlayer" />
          <OpponentArea position="right" :player="rightPlayer" />
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

        <!-- Placeholder: Wall Counter -->
        <div
          v-if="isDev"
          class="border-2 border-dashed border-white/30 rounded-md p-2 text-text-on-felt/50 text-center"
        >
          Wall Counter
        </div>
      </div>

      <!-- Opponent Right (hidden on phone, shown via grid on tablet/desktop) -->
      <div
        data-testid="opponent-right"
        class="game-table__opponent-right hidden md:flex items-center justify-center"
      >
        <OpponentArea position="right" :player="rightPlayer" />
      </div>
    </div>

    <!-- Action Zone -->
    <div data-testid="action-zone">
      <ActionZone>
        <DiscardConfirm
          :selected-tile-id="rackStore.selectedTileId"
          :is-player-turn="isPlayerTurn"
          @discard="handleDiscard"
        />
      </ActionZone>
    </div>

    <!-- Rack Area -->
    <div data-testid="rack-area" class="game-table__rack md:pb-[env(safe-area-inset-bottom)]">
      <TileRack :tiles="tiles" :is-player-turn="isPlayerTurn" />
    </div>

    <!-- Mobile Bottom Bar (phone only) -->
    <div class="md:hidden">
      <MobileBottomBar />
    </div>
  </div>
</template>
