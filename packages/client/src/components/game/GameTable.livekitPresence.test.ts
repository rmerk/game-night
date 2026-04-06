import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import GameTable from "./GameTable.vue";
import type { LocalPlayerSummary, OpponentPlayer } from "./seat-types";

const liveKitTestState = vi.hoisted(() => {
  const { ref, shallowRef } = require("vue") as typeof import("vue");
  return {
    participantVideoByIdentity: ref(
      new Map<string, { videoTrack: unknown; isCameraEnabled: boolean }>(),
    ),
    room: shallowRef(null),
  };
});

vi.mock("../../composables/useLiveKit", () => {
  const { ref, computed } = require("vue") as typeof import("vue");
  return {
    useLiveKit: () => ({
      connectionStatus: ref("idle"),
      room: liveKitTestState.room,
      remoteParticipants: ref(new Map()),
      participantVideoByIdentity: liveKitTestState.participantVideoByIdentity,
      activeSpeakers: ref(new Set<string>()),
      error: ref(null),
      connect: vi.fn(),
      disconnect: vi.fn(),
      cleanup: vi.fn(),
      localMicEnabled: ref(false),
      localCameraEnabled: ref(false),
      avPermissionState: computed(() => "granted" as const),
      toggleMic: vi.fn(),
      toggleCamera: vi.fn(),
      requestPermissions: vi.fn(),
    }),
  };
});

vi.mock("@vue-dnd-kit/core", () => ({
  DnDProvider: { name: "DnDProvider", template: "<div><slot /></div>" },
  makeDraggable: () => ({ isDragging: { value: false }, isDragOver: { value: undefined } }),
  makeDroppable: () => ({ isDragOver: { value: undefined } }),
  useDnDProvider: () => ({
    keyboard: { keys: { forDrag: [], forMove: [], forCancel: [] }, step: 8, moveFaster: 4 },
  }),
}));

const mockPlayers: { top: OpponentPlayer; left: OpponentPlayer; right: OpponentPlayer } = {
  top: {
    id: "player-north",
    name: "Alice",
    initial: "A",
    connected: true,
    seatWind: "north",
    score: 0,
  },
  left: {
    id: "player-west",
    name: "Bob",
    initial: "B",
    connected: true,
    seatWind: "west",
    score: 0,
  },
  right: {
    id: "player-east",
    name: "Carol",
    initial: "C",
    connected: true,
    seatWind: "east",
    score: 0,
  },
};

const localPlayer: LocalPlayerSummary = {
  id: "player-south",
  name: "You",
  seatWind: "south",
  score: 0,
};

describe("GameTable — LiveKit presence (6B.2)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    liveKitTestState.participantVideoByIdentity.value = new Map();
  });

  it("renders video thumbnails when participant camera tracks are present", async () => {
    const fakeTrack = {
      attach: vi.fn(() => document.createElement("video")),
      detach: vi.fn(),
    };
    liveKitTestState.participantVideoByIdentity.value = new Map([
      ["player-north", { videoTrack: fakeTrack, isCameraEnabled: true }],
      ["player-south", { videoTrack: fakeTrack, isCameraEnabled: true }],
    ]);
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        gamePhase: "play",
      },
      global: {
        plugins: [createPinia()],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    await flushPromises();
    expect(wrapper.findAll('[data-testid="video-thumbnail"]').length).toBeGreaterThanOrEqual(2);
  });

  it("renders desktop A/V controls shell when LiveKit mock is active", async () => {
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        gamePhase: "play",
      },
      global: {
        plugins: [createPinia()],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="desktop-av-controls"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="desktop-av-controls"] [data-testid="av-controls"]').exists(),
    ).toBe(true);
  });
});
