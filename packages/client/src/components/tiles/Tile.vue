<script setup lang="ts">
import { computed } from "vue";
import type { Tile } from "@mahjong-game/shared";
import { getTileSizeStyle, type TileDisplaySize } from "./tile-sizing";

export type TileSize = TileDisplaySize;
export type TileState =
  | "default"
  | "hover"
  | "selected"
  | "charleston-selected"
  | "disabled"
  | "face-down";

const props = withDefaults(
  defineProps<{
    tile: Tile;
    size?: TileSize;
    state?: TileState;
    interactive?: boolean;
    tabIndex?: number;
  }>(),
  {
    size: "standard",
    state: "default",
    interactive: true,
  },
);

defineEmits<{
  select: [tile: Tile];
}>();

/** Map tile data to SVG sprite symbol ID (strips copy suffix) */
const symbolId = computed(() => {
  const t = props.tile;
  switch (t.category) {
    case "suited":
      return `${t.suit}-${t.value}`;
    case "wind":
      return `wind-${t.value}`;
    case "dragon":
      return `dragon-${t.value}`;
    case "flower":
      return `flower-${t.value}`;
    case "joker":
      return "joker";
  }
});

const spriteHref = computed(() =>
  props.state === "face-down" ? "#tile-back" : `#${symbolId.value}`,
);

/** Human-readable label for screen readers */
const ariaLabel = computed(() => {
  if (props.state === "face-down") return "Face-down tile";
  const t = props.tile;
  switch (t.category) {
    case "suited": {
      let suitName: string;
      if (t.suit === "bam") {
        suitName = "Bamboo";
      } else if (t.suit === "crak") {
        suitName = "Crack";
      } else {
        suitName = "Dot";
      }
      return `${t.value} of ${suitName}`;
    }
    case "wind": {
      const w = t.value.charAt(0).toUpperCase() + t.value.slice(1);
      return `${w} Wind`;
    }
    case "dragon": {
      let dragonLabel: string;
      if (t.value === "soap") {
        dragonLabel = "Soap";
      } else if (t.value === "red") {
        dragonLabel = "Red";
      } else {
        dragonLabel = "Green";
      }
      return `${dragonLabel} Dragon`;
    }
    case "flower":
      return `Flower ${t.value.toUpperCase()}`;
    case "joker":
      return "Joker";
  }
});

const role = computed(() => (props.interactive ? "button" : "img"));
const resolvedTabIndex = computed(() => (props.interactive ? (props.tabIndex ?? 0) : undefined));
const tileSizeStyle = computed(() => getTileSizeStyle(props.size));
</script>

<template>
  <div
    class="tile"
    :class="[`tile--size-${size}`, `tile--${state}`, { 'tile--interactive': interactive }]"
    :style="tileSizeStyle"
    :role="role"
    :aria-label="ariaLabel"
    :tabindex="resolvedTabIndex"
    :aria-disabled="state === 'disabled' || undefined"
    @click="interactive && state !== 'disabled' && $emit('select', tile)"
    @keydown.enter="interactive && state !== 'disabled' && $emit('select', tile)"
    @keydown.space.prevent="interactive && state !== 'disabled' && $emit('select', tile)"
  >
    <svg
      class="tile__face"
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <use :href="spriteHref" />
    </svg>
  </div>
</template>

<style scoped>
.tile {
  position: relative;
  background: var(--tile-base-bg, #ffffff);
  border: 1px solid var(--tile-base-border, #e8e0d4);
  border-radius: 12px;
  box-shadow:
    0 2px 4px rgba(107, 97, 88, 0.15),
    0 1px 2px rgba(107, 97, 88, 0.1);
  transition:
    transform var(--timing-tactile) var(--ease-tactile),
    border-color var(--timing-tactile) var(--ease-tactile),
    box-shadow var(--timing-tactile) var(--ease-tactile),
    opacity var(--timing-tactile) var(--ease-tactile);
  flex-shrink: 0;
  user-select: none;
  cursor: default;
  overflow: hidden;
}

.tile__face {
  display: block;
  width: 100%;
  height: 100%;
}

/* --- Interactive cursor --- */
.tile--interactive {
  cursor: pointer;
}

/* --- Hover state (desktop only) --- */
@media (hover: hover) {
  .tile--interactive.tile--default:hover {
    transform: translateY(-4px);
    box-shadow:
      0 4px 8px rgba(107, 97, 88, 0.2),
      0 2px 4px rgba(107, 97, 88, 0.12);
  }
}

/* --- Selected state --- */
.tile--selected {
  transform: translateY(-8px);
  border-color: var(--tile-accent-gold);
  box-shadow:
    0 6px 12px rgba(107, 97, 88, 0.2),
    0 3px 6px rgba(107, 97, 88, 0.12),
    0 0 0 2px var(--tile-accent-gold);
}

/* --- Charleston multi-select (distinct from discard selection) --- */
.tile--charleston-selected {
  transform: translateY(-6px);
  border-color: var(--focus-ring-on-felt);
  box-shadow:
    0 5px 10px rgba(107, 97, 88, 0.18),
    0 0 0 2px var(--focus-ring-on-felt);
}

/* --- Disabled state --- */
.tile--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* --- Face-down: hide white base, show tile-back which has its own background --- */
.tile--face-down {
  background: transparent;
  border-color: transparent;
}

/* --- Focus ring (keyboard navigation) --- */
.tile:focus-visible {
  outline: 2px solid var(--focus-ring-on-felt);
  outline-offset: 2px;
}
</style>
