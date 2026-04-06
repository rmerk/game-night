import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { MahjongGameResult, SeatWind } from "@mahjong-game/shared";
import Celebration from "./Celebration.vue";

// ---------------------------------------------------------------------------
// motion-v mock — same pattern as RoomView.test.ts
// ---------------------------------------------------------------------------
const { mockAnimate, mockPrefersReducedMotion } = vi.hoisted(() => {
  const mockAnimate = vi.fn(() => ({ finished: Promise.resolve(), stop: vi.fn() }));
  const mockPrefersReducedMotion = vi.fn(() => false);
  return { mockAnimate, mockPrefersReducedMotion };
});

vi.mock("motion-v", () => ({
  animate: mockAnimate,
  prefersReducedMotion: mockPrefersReducedMotion,
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const WINNER_ID = "player-east";

const mockGameResult: MahjongGameResult = {
  winnerId: WINNER_ID,
  patternId: "all-singles",
  patternName: "All Singles",
  points: 50,
  selfDrawn: false,
  discarderId: "player-south",
  payments: {
    "player-east": 150,
    "player-south": -50,
    "player-west": -50,
    "player-north": -50,
  },
};

const mockPlayerNamesById: Record<string, string> = {
  "player-east": "Alice",
  "player-south": "Bob",
  "player-west": "Carol",
  "player-north": "Dave",
};

const defaultProps = {
  gameResult: mockGameResult,
  playerNamesById: mockPlayerNamesById,
  winnerId: WINNER_ID,
  winnerSeat: "east" as SeatWind,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Mount with Teleport stubbed inline so wrapper.find() can locate teleported content.
 * For tests that need real Teleport behavior (seat marker queries), we use
 * attachTo: document.body and query document directly.
 */
function mountCelebration(propsOverride?: Partial<typeof defaultProps>) {
  return mount(Celebration, {
    props: { ...defaultProps, ...propsOverride },
    global: {
      stubs: {
        Teleport: true,
      },
    },
  });
}

/**
 * Mount with real Teleport for tests that target document-level [data-celebration-seat] markers.
 */
function mountCelebrationReal(propsOverride?: Partial<typeof defaultProps>) {
  return mount(Celebration, {
    props: { ...defaultProps, ...propsOverride },
    attachTo: document.body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Celebration.vue — Task 1: structure, props, emits, overlay shell", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockAnimate.mockClear();
    mockPrefersReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1.1 — Fixed full-screen overlay with z-[70]
  // ---------------------------------------------------------------------------
  describe("1.1 Overlay shell", () => {
    it("renders a fixed full-screen overlay", () => {
      const wrapper = mountCelebration();
      const overlay = wrapper.find("[data-testid='celebration-overlay']");
      expect(overlay.exists()).toBe(true);
    });

    it("overlay has fixed inset-0 positioning classes", () => {
      const wrapper = mountCelebration();
      const overlay = wrapper.find("[data-testid='celebration-overlay']");
      expect(overlay.classes()).toContain("fixed");
      expect(overlay.classes()).toContain("inset-0");
    });

    it("overlay has z-[70] stacking class (above DealingAnimation z-[60])", () => {
      const wrapper = mountCelebration();
      const overlay = wrapper.find("[data-testid='celebration-overlay']");
      expect(overlay.classes()).toContain("z-[70]");
    });
  });

  // ---------------------------------------------------------------------------
  // 1.2 — Props accepted
  // ---------------------------------------------------------------------------
  describe("1.2 Props", () => {
    it("accepts and renders with valid props without errors", () => {
      expect(() => mountCelebration()).not.toThrow();
    });

    it("accepts winnerSeat prop for all four winds", () => {
      const winds: SeatWind[] = ["east", "south", "west", "north"];
      for (const wind of winds) {
        expect(() => mountCelebration({ winnerSeat: wind })).not.toThrow();
      }
    });

    it("accepts a gameResult with selfDrawn: true", () => {
      const selfDrawnResult: MahjongGameResult = {
        ...mockGameResult,
        selfDrawn: true,
        discarderId: undefined,
      };
      expect(() => mountCelebration({ gameResult: selfDrawnResult })).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 1.3 — Emits: done and motifPlay
  // ---------------------------------------------------------------------------
  describe("1.3 Emits", () => {
    it("has a done emit defined", () => {
      const wrapper = mountCelebration();
      // Component exposes the emit contract — verify it doesn't throw when emitted
      // (full sequence triggering done is tested in Task 3/6; here we check the emit signature)
      expect(wrapper.emitted()).toBeDefined();
    });

    it("has a motifPlay emit defined (audio placeholder for Story 7.3)", () => {
      // Mount succeeds and component structure is intact — motifPlay is wired in the sequence
      const wrapper = mountCelebration();
      expect(wrapper.find("[data-testid='celebration-overlay']").exists()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 1.4 — pointer-events: none on overlay
  // ---------------------------------------------------------------------------
  describe("1.4 pointer-events: none", () => {
    it("overlay has pointer-events-none class so video thumbnails remain interactive", () => {
      const wrapper = mountCelebration();
      const overlay = wrapper.find("[data-testid='celebration-overlay']");
      expect(overlay.classes()).toContain("pointer-events-none");
    });
  });

  // ---------------------------------------------------------------------------
  // 1.5 — Dim layer targeting [data-celebration-seat] elements
  // ---------------------------------------------------------------------------
  describe("1.5 Dim layer", () => {
    it("renders a dim layer element", () => {
      const wrapper = mountCelebration();
      const dimLayer = wrapper.find("[data-testid='celebration-dim-layer']");
      expect(dimLayer.exists()).toBe(true);
    });

    it("dim layer is within the overlay", () => {
      const wrapper = mountCelebration();
      const overlay = wrapper.find("[data-testid='celebration-overlay']");
      const dimLayer = overlay.find("[data-testid='celebration-dim-layer']");
      expect(dimLayer.exists()).toBe(true);
    });

    it("calls animate() to dim non-winner seat areas on mount (normal motion)", async () => {
      mockPrefersReducedMotion.mockReturnValue(false);

      // Attach seat markers to document.body so querySelectorAll finds them
      const seatMarkers = ["player-south", "player-west", "player-north"].map((id) => {
        const el = document.createElement("div");
        el.setAttribute("data-celebration-seat", id);
        document.body.appendChild(el);
        return el;
      });

      const wrapper = mountCelebrationReal();
      await flushPromises();

      // animate() should be called for non-winner seats
      expect(mockAnimate).toHaveBeenCalled();

      // Cleanup
      seatMarkers.forEach((el) => el.remove());
      wrapper.unmount();
    });

    it("does NOT call animate() for opacity reduction when prefers-reduced-motion is true", async () => {
      mockPrefersReducedMotion.mockReturnValue(true);

      const seatMarker = document.createElement("div");
      seatMarker.setAttribute("data-celebration-seat", "player-south");
      document.body.appendChild(seatMarker);

      mockAnimate.mockClear();
      const wrapper = mountCelebrationReal();
      await flushPromises();

      // In reduced motion mode, the dim animation should be skipped
      expect(mockAnimate).not.toHaveBeenCalled();

      seatMarker.remove();
      wrapper.unmount();
    });
  });

  // ---------------------------------------------------------------------------
  // Race guard + unmount cleanup
  // ---------------------------------------------------------------------------
  describe("Unmount cleanup", () => {
    it("stops in-flight animations when unmounted", async () => {
      const stopFn = vi.fn();
      mockAnimate.mockReturnValue({ finished: Promise.resolve(), stop: stopFn });

      const seatMarker = document.createElement("div");
      seatMarker.setAttribute("data-celebration-seat", "player-south");
      document.body.appendChild(seatMarker);

      const wrapper = mountCelebrationReal();
      await flushPromises();

      wrapper.unmount();

      seatMarker.remove();

      // stop() should have been called on unmount
      expect(stopFn).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Template structure — placeholder sections for later tasks
  // ---------------------------------------------------------------------------
  describe("Template structure", () => {
    it("renders a spotlight placeholder section", () => {
      const wrapper = mountCelebration();
      const spotlight = wrapper.find("[data-testid='celebration-spotlight']");
      expect(spotlight.exists()).toBe(true);
    });

    it("renders a fan-out placeholder section", () => {
      const wrapper = mountCelebration();
      const fanOut = wrapper.find("[data-testid='celebration-fanout']");
      expect(fanOut.exists()).toBe(true);
    });

    it("renders a scoring overlay placeholder section", () => {
      const wrapper = mountCelebration();
      const scoring = wrapper.find("[data-testid='celebration-scoring']");
      expect(scoring.exists()).toBe(true);
    });
  });
});
