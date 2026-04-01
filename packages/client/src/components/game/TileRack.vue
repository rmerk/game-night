<script setup lang="ts">
import {
  computed,
  shallowRef,
  h,
  watch,
  defineComponent,
  useTemplateRef,
  type PropType,
} from "vue";
import { DnDProvider, makeDroppable, useDnDProvider } from "@vue-dnd-kit/core";
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { Tile } from "@mahjong-game/shared";
import type { TileState } from "../tiles/Tile.vue";
import TileRackItem from "./TileRackItem.vue";
import { useRackStore } from "../../stores/rack";

const props = withDefaults(
  defineProps<{
    tiles: Tile[];
    isPlayerTurn?: boolean;
  }>(),
  {
    isPlayerTurn: true,
  },
);

const rackStore = useRackStore();

// Initialize tile order from props when tiles change
watch(
  () => props.tiles,
  (newTiles) => {
    if (newTiles.length > 0 && rackStore.tileOrder.length === 0) {
      rackStore.setTileOrder(newTiles);
    }
  },
  { immediate: true },
);

// Ordered tiles based on rack store order
const orderedTiles = computed(() => {
  const tileMap = new Map(props.tiles.map((t) => [t.id, t]));
  return rackStore.tileOrder.map((id) => tileMap.get(id)).filter((t): t is Tile => t !== undefined);
});

const activeFocusTarget = shallowRef<string | "sort" | null>(null);

watch(
  [orderedTiles, () => props.isPlayerTurn],
  ([tiles, isPlayerTurn]) => {
    if (!isPlayerTurn) {
      activeFocusTarget.value = null;
      return;
    }

    if (activeFocusTarget.value === "sort") {
      return;
    }

    if (
      tiles.length === 0 ||
      activeFocusTarget.value === null ||
      !tiles.some((tile) => tile.id === activeFocusTarget.value)
    ) {
      activeFocusTarget.value = tiles[0]?.id ?? "sort";
    }
  },
  { immediate: true },
);

function getTileState(tile: Tile): TileState {
  if (!props.isPlayerTurn) return "default";
  if (rackStore.selectedTileId === tile.id) return "selected";
  return "default";
}

function getTileTabIndex(tileId: string): number | undefined {
  if (!props.isPlayerTurn) {
    return undefined;
  }

  return tileId === activeFocusTarget.value ? 0 : -1;
}

function focusTileAtIndex(index: number) {
  const tile = orderedTiles.value[index];
  if (!tile) {
    return;
  }

  activeFocusTarget.value = tile.id;
  const tileButton = rackRef.value?.querySelector<HTMLElement>(
    `[data-rack-tile-id="${tile.id}"] [role="button"]`,
  );
  tileButton?.focus();
}

function focusSortButton() {
  activeFocusTarget.value = "sort";
  const sortButton = rackRef.value
    ?.closest(".tile-rack-container")
    ?.querySelector<HTMLElement>('[aria-label="Sort tiles by suit"]');
  sortButton?.focus();
}

function handleTileSelect(tile: Tile) {
  if (!props.isPlayerTurn) return;
  activeFocusTarget.value = tile.id;
  rackStore.selectTile(tile.id);
}

function handleTileFocus(tileId: string) {
  if (!props.isPlayerTurn) {
    return;
  }

  activeFocusTarget.value = tileId;
}

function handleSortFocus() {
  if (!props.isPlayerTurn) {
    return;
  }

  activeFocusTarget.value = "sort";
}

function handleSort() {
  rackStore.sortTiles(props.tiles);
}

function handleSortKeydown(event: KeyboardEvent) {
  if (!props.isPlayerTurn) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    focusTileAtIndex(orderedTiles.value.length - 1);
  }
}

// Keyboard navigation within rack
function handleRackKeydown(event: KeyboardEvent) {
  if (!props.isPlayerTurn) return;

  const target = event.target as HTMLElement;
  const currentTileId =
    target.closest<HTMLElement>("[data-rack-tile-id]")?.dataset.rackTileId ?? null;
  if (currentTileId === null) return;

  const currentIndex = orderedTiles.value.findIndex((tile) => tile.id === currentTileId);

  if (currentIndex === -1) return;

  if (event.key === "ArrowRight" && currentIndex < orderedTiles.value.length - 1) {
    event.preventDefault();
    focusTileAtIndex(currentIndex + 1);
  } else if (event.key === "ArrowRight" && currentIndex === orderedTiles.value.length - 1) {
    event.preventDefault();
    focusSortButton();
  } else if (event.key === "ArrowLeft" && currentIndex > 0) {
    event.preventDefault();
    focusTileAtIndex(currentIndex - 1);
  }
}

/**
 * Renderless child component inside DnDProvider that configures keyboard
 * and wires makeDroppable on the rack container. Must be a child of
 * DnDProvider because Vue DnD Kit uses inject() internally.
 */
const RackDnDSetup = defineComponent({
  name: "RackDnDSetup",
  props: {
    // Untyped: vue-tsc unwraps template refs, but Vue passes the Ref object at runtime
    rackRef: { required: true },
    tiles: { type: Array as PropType<Tile[]>, required: true },
  },
  setup(setupProps) {
    const store = useRackStore();

    const provider = useDnDProvider();
    provider.keyboard.keys.forDrag = ["Space"];
    provider.keyboard.keys.forMove = ["ArrowLeft", "ArrowRight"];
    provider.keyboard.keys.forCancel = ["Escape"];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vue-dnd-kit expects Ref but vue template passes unwrapped ref object
    makeDroppable(
      setupProps.rackRef as any,
      {
        events: {
          onDrop: (e: IDragEvent) => {
            const result = e.helpers.suggestSort("horizontal");
            if (result) {
              store.tileOrder = (result.sourceItems as Tile[]).map((t: Tile) => t.id);
            }
          },
        },
      },
      () => setupProps.tiles!,
    );

    return () => null;
  },
});

const rackRef = useTemplateRef<HTMLElement>("rackRef");
</script>

<template>
  <DnDProvider>
    <RackDnDSetup :rack-ref="rackRef" :tiles="orderedTiles" />
    <div class="tile-rack-container">
      <div
        ref="rackRef"
        role="list"
        aria-label="Your tile rack"
        class="tile-rack"
        @keydown="handleRackKeydown"
      >
        <TransitionGroup name="rack">
          <TileRackItem
            v-for="(tile, index) in orderedTiles"
            :key="tile.id"
            :tile="tile"
            :index="index"
            :tiles="orderedTiles"
            :is-player-turn="isPlayerTurn"
            :state="getTileState(tile)"
            :tab-index="getTileTabIndex(tile.id)"
            :data-rack-tile-id="tile.id"
            @select="handleTileSelect"
            @focus="handleTileFocus(tile.id)"
          />
        </TransitionGroup>
      </div>
      <button
        type="button"
        class="tile-rack__sort-btn"
        :disabled="!isPlayerTurn"
        :tabindex="isPlayerTurn ? (activeFocusTarget === 'sort' ? 0 : -1) : undefined"
        aria-label="Sort tiles by suit"
        @focus="handleSortFocus"
        @keydown="handleSortKeydown"
        @click="handleSort"
      >
        Sort
      </button>
    </div>
  </DnDProvider>
</template>

<style scoped>
.tile-rack-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.tile-rack {
  display: flex;
  flex-direction: row;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 4px 0;
}

.tile-rack::-webkit-scrollbar {
  display: none;
}

.tile-rack__sort-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 8px 12px;
  border: 1px solid var(--chrome-border);
  border-radius: 8px;
  background: var(--chrome-surface);
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background var(--timing-tactile) var(--ease-tactile),
    border-color var(--timing-tactile) var(--ease-tactile);
}

.tile-rack__sort-btn:hover:not(:disabled) {
  background: var(--chrome-elevated);
}

.tile-rack__sort-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.tile-rack__sort-btn:focus-visible {
  outline: 2px solid var(--focus-ring-on-felt);
  outline-offset: 2px;
}

/* TransitionGroup for smooth reordering */
.rack-move {
  transition: transform var(--timing-tactile) var(--ease-tactile);
}
</style>
