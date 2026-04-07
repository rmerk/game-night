import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import TileRackItem from "./TileRackItem.vue";
import type { SuitedTile } from "@mahjong-game/shared";

// Mock audio store so Web Audio API calls don't run in happy-dom
const mockAudioPlay = vi.fn();
vi.mock("../../stores/audio", () => ({
  useAudioStore: () => ({ play: mockAudioPlay }),
}));

// Controllable isDragging ref to simulate drag start
const isDraggingRef = ref(false);

vi.mock("@vue-dnd-kit/core", () => ({
  makeDraggable: () => ({
    isDragging: isDraggingRef,
    isDragOver: { value: undefined },
  }),
  makeDroppable: () => ({ isDragOver: { value: undefined } }),
  useDnDProvider: () => ({
    keyboard: {
      keys: { forDrag: [], forMove: [], forCancel: [] },
      step: 8,
      moveFaster: 4,
    },
  }),
}));

// Mock useRackTileDraggable to use our controllable isDragging
vi.mock("../../composables/useRackDragDrop", () => ({
  useRackTileDraggable: () => ({ isDragging: isDraggingRef }),
}));

const bam1: SuitedTile = { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 };
const sampleTiles = [bam1];

function mountItem() {
  return mount(TileRackItem, {
    props: {
      tile: bam1,
      index: 0,
      tiles: sampleTiles,
      isPlayerTurn: true,
      state: "default",
    },
    global: {
      plugins: [createPinia()],
    },
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  isDraggingRef.value = false;
  mockAudioPlay.mockClear();
});

describe("TileRackItem — rack-arrange sound", () => {
  it("plays rack-arrange sound when drag starts", async () => {
    const wrapper = mountItem();

    // Simulate drag start by flipping isDragging to true
    isDraggingRef.value = true;
    await Promise.resolve();

    expect(mockAudioPlay).toHaveBeenCalledWith("rack-arrange", "gameplay");

    wrapper.unmount();
  });

  it("plays rack-arrange sound only once per drag gesture (not on drag end)", async () => {
    const wrapper = mountItem();

    // Start drag
    isDraggingRef.value = true;
    await Promise.resolve();

    expect(mockAudioPlay).toHaveBeenCalledTimes(1);
    expect(mockAudioPlay).toHaveBeenCalledWith("rack-arrange", "gameplay");

    // End drag — should not trigger another play
    isDraggingRef.value = false;
    await Promise.resolve();

    expect(mockAudioPlay).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
