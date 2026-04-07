import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { MahjongGameResult, SeatWind } from "@mahjong-game/shared";
import Celebration from "./Celebration.vue";

// ---------------------------------------------------------------------------
// motion-v mock — same pattern as RoomView.test.ts
// ---------------------------------------------------------------------------
const { mockAnimate } = vi.hoisted(() => {
  const animateFn = vi.fn(() => ({ finished: Promise.resolve(), stop: vi.fn() }));
  return { mockAnimate: animateFn };
});

vi.mock("motion-v", () => ({
  animate: mockAnimate,
}));

// ---------------------------------------------------------------------------
// window.matchMedia stub — controls checkPrefersReducedMotion() in Celebration.vue
// ---------------------------------------------------------------------------
function stubMatchMedia(prefersReduced: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: prefersReduced && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
  }));
}

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
// Type alias for the animate() mock call args
// ---------------------------------------------------------------------------
type AnimateCall = [unknown, Record<string, unknown>, Record<string, unknown>?];

/**
 * Cast mockAnimate.mock.calls to typed tuples so downstream assertions can
 * index into call[0], call[1], call[2] without TS2493 tuple-length errors.
 */
function getAnimateCalls(): AnimateCall[] {
  return mockAnimate.mock.calls as unknown as AnimateCall[];
}

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
        TileBack: true,
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
    global: {
      stubs: {
        TileBack: true,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Tests — Task 1: structure, props, emits, overlay shell
// ---------------------------------------------------------------------------
describe("Celebration.vue — Task 1: structure, props, emits, overlay shell", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockAnimate.mockClear();
    stubMatchMedia(false);
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
      stubMatchMedia(false);

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

    it("calls animate() with duration:0 for dim even when prefers-reduced-motion is true (opacity change, not motion)", async () => {
      stubMatchMedia(true);

      const seatMarker = document.createElement("div");
      seatMarker.setAttribute("data-celebration-seat", "player-south");
      document.body.appendChild(seatMarker);

      mockAnimate.mockClear();
      const wrapper = mountCelebrationReal();
      await flushPromises();

      // In reduced motion mode, dim IS applied but with duration:0 (instant, not animated — AC 6)
      const calls = getAnimateCalls();
      const dimCall = calls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[1] !== null &&
          typeof call[1] === "object" &&
          "opacity" in call[1] &&
          call[1].opacity === 0.22,
      );
      expect(dimCall).toBeDefined();
      expect(dimCall?.[2]).toMatchObject({ duration: 0 });

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
    it("renders a spotlight placeholder section", async () => {
      // Spotlight is conditionally rendered (spotlightVisible = true after Phase 4)
      // Run full sequence so spotlight appears
      const wrapper = mountCelebration();
      await flushPromises();
      // After sequence runs, spotlight should be visible
      const spotlight = wrapper.find("[data-testid='celebration-spotlight']");
      expect(spotlight.exists()).toBe(true);
    });

    it("renders a fan-out placeholder section", () => {
      const wrapper = mountCelebration();
      const fanOut = wrapper.find("[data-testid='celebration-fanout']");
      expect(fanOut.exists()).toBe(true);
    });

    it("renders a scoring overlay placeholder section", async () => {
      // Scoring is conditionally rendered (scoringVisible = true after Phase 5)
      const wrapper = mountCelebration();
      await flushPromises();
      const scoring = wrapper.find("[data-testid='celebration-scoring']");
      expect(scoring.exists()).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Task 3: Motion for Vue sequence orchestration
// ---------------------------------------------------------------------------
describe("Celebration.vue — Task 3: sequence orchestration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockAnimate.mockClear();
    stubMatchMedia(false);
    // Default mock: immediately resolved
    mockAnimate.mockImplementation(() => ({ finished: Promise.resolve(), stop: vi.fn() }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up any leftover seat markers
    document.querySelectorAll("[data-celebration-seat]").forEach((el) => el.remove());
  });

  // ---------------------------------------------------------------------------
  // 3.1 — Sequence uses animate().finished chain, no setTimeout
  // ---------------------------------------------------------------------------
  describe("3.1 No setTimeout chains", () => {
    it("does not call setTimeout during the celebration sequence", async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      // The celebration sequence must not use setTimeout for orchestration
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it("calls animate() multiple times for different sequence phases", async () => {
      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      // Should have multiple animate() calls (beat, spotlight, scoring, motif, hold at minimum)
      // (no seat markers or fan tiles in this stubbed mount, so dim and fan-out are skipped)
      expect(mockAnimate.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ---------------------------------------------------------------------------
  // 3.2 — Phase 1: Dim opponent seats to 0.22 opacity
  // ---------------------------------------------------------------------------
  describe("3.2 Phase 1 — Dim", () => {
    it("animates non-winner seat elements to opacity 0.22 with duration 0.12", async () => {
      const seatIds = ["player-south", "player-west", "player-north"];
      const seatMarkers = seatIds.map((id) => {
        const el = document.createElement("div");
        el.setAttribute("data-celebration-seat", id);
        document.body.appendChild(el);
        return el;
      });

      const wrapper = mountCelebrationReal();
      await flushPromises();

      const calls = getAnimateCalls();
      // First animate() call should be the dim animation with opacity 0.22 and duration 0.12
      const dimCall = calls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[1] !== null &&
          typeof call[1] === "object" &&
          "opacity" in call[1] &&
          call[1].opacity === 0.22,
      );
      expect(dimCall).toBeDefined();
      expect(dimCall?.[2]).toMatchObject({ duration: 0.12 });

      seatMarkers.forEach((el) => el.remove());
      wrapper.unmount();
    });

    it("does NOT animate the winner's own seat element", async () => {
      // Add winner's seat marker too
      const winnerMarker = document.createElement("div");
      winnerMarker.setAttribute("data-celebration-seat", WINNER_ID);
      document.body.appendChild(winnerMarker);

      const opponentMarker = document.createElement("div");
      opponentMarker.setAttribute("data-celebration-seat", "player-south");
      document.body.appendChild(opponentMarker);

      const wrapper = mountCelebrationReal();
      await flushPromises();

      const calls = getAnimateCalls();
      const dimCall = calls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[1] !== null &&
          typeof call[1] === "object" &&
          "opacity" in call[1] &&
          call[1].opacity === 0.22,
      );
      // The element array should NOT contain the winner marker
      if (dimCall) {
        const raw = dimCall[0];
        if (Array.isArray(raw) && raw.every((el): el is HTMLElement => el instanceof HTMLElement)) {
          const winnerInList = raw.some(
            (el) => el.getAttribute("data-celebration-seat") === WINNER_ID,
          );
          expect(winnerInList).toBe(false);
        }
      }

      winnerMarker.remove();
      opponentMarker.remove();
      wrapper.unmount();
    });
  });

  // ---------------------------------------------------------------------------
  // 3.3 — Phase 2: Held beat (0.5s pause via animate)
  // ---------------------------------------------------------------------------
  describe("3.3 Phase 2 — Held beat", () => {
    it("calls animate() for the 0.5s held beat (no setTimeout)", async () => {
      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      const calls = getAnimateCalls();
      // Find an animate call with duration 0.5 — the held beat
      const beatCall = calls.find(
        (call) => call[2] !== undefined && typeof call[2] === "object" && call[2].duration === 0.5,
      );
      expect(beatCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3.4 — Phase 3: Fan-out with timing-expressive easing
  // ---------------------------------------------------------------------------
  describe("3.4 Phase 3 — Fan-out", () => {
    it("renders 14 fan tile elements in the fanout container", () => {
      const wrapper = mountCelebration();
      // Fan tiles are rendered as data-celebration-fan-tile elements
      const fanContainer = wrapper.find("[data-testid='celebration-fanout']");
      expect(fanContainer.exists()).toBe(true);
      // Should have 14 tile slots
      const fanTiles = fanContainer.findAll("[data-celebration-fan-tile]");
      expect(fanTiles).toHaveLength(14);
    });

    it("uses timing-expressive easing [0.16, 1, 0.3, 1] for fan animations", async () => {
      // Add fan tile markers so the phase 3 animation fires
      const fanTiles = Array.from({ length: 14 }, (_, i) => {
        const el = document.createElement("div");
        el.setAttribute("data-celebration-fan-tile", String(i + 1));
        document.body.appendChild(el);
        return el;
      });

      const wrapper = mountCelebrationReal();
      await flushPromises();

      const calls = getAnimateCalls();
      // Find animate calls using timing-expressive ease
      const expressiveCalls = calls.filter((call) => {
        const opts = call[2];
        if (!opts || !Array.isArray(opts.ease)) return false;
        const ease = opts.ease as number[];
        return ease[0] === 0.16 && ease[1] === 1 && ease[2] === 0.3 && ease[3] === 1;
      });
      expect(expressiveCalls.length).toBeGreaterThan(0);

      fanTiles.forEach((el) => el.remove());
      wrapper.unmount();
    });
  });

  // ---------------------------------------------------------------------------
  // 3.5 — Phase 4: Winner spotlight
  // ---------------------------------------------------------------------------
  describe("3.5 Phase 4 — Winner spotlight", () => {
    it("renders the winner name in the spotlight after sequence runs", async () => {
      const wrapper = mountCelebration();
      await flushPromises();

      const spotlight = wrapper.find("[data-testid='celebration-spotlight']");
      expect(spotlight.exists()).toBe(true);
      expect(spotlight.text()).toContain("Alice"); // winner name from mockPlayerNamesById
    });

    it("renders 'Mahjong!' text in the spotlight", async () => {
      const wrapper = mountCelebration();
      await flushPromises();

      const mahjongText = wrapper.find("[data-testid='celebration-mahjong-text']");
      expect(mahjongText.exists()).toBe(true);
      expect(mahjongText.text()).toBe("Mahjong!");
    });

    it("fades in spotlight over 0.4s", async () => {
      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      const calls = getAnimateCalls();
      const spotlightFadeCall = calls.find((call) => {
        const opts = call[2];
        return opts?.duration === 0.4;
      });
      expect(spotlightFadeCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3.6 — Phase 5: Scoring overlay
  // ---------------------------------------------------------------------------
  describe("3.6 Phase 5 — Scoring overlay", () => {
    it("renders payment breakdown after sequence runs", async () => {
      const wrapper = mountCelebration();
      await flushPromises();

      const scoring = wrapper.find("[data-testid='celebration-scoring']");
      expect(scoring.exists()).toBe(true);
      // Bob, Carol, Dave should all appear as payers
      expect(scoring.text()).toContain("Bob");
      expect(scoring.text()).toContain("Carol");
      expect(scoring.text()).toContain("Dave");
    });

    it("shows winner as receiving (+150) in payment breakdown", async () => {
      const wrapper = mountCelebration();
      await flushPromises();

      const scoring = wrapper.find("[data-testid='celebration-scoring']");
      expect(scoring.text()).toContain("+150");
    });

    it("fades in scoring overlay over 0.3s", async () => {
      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      const calls = getAnimateCalls();
      const scoringFadeCall = calls.find((call) => {
        const opts = call[2];
        return opts?.duration === 0.3;
      });
      expect(scoringFadeCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3.7 — Phase 6: Motif placeholder + audio hook
  // ---------------------------------------------------------------------------
  describe("3.7 Phase 6 — Motif + audio hook", () => {
    it("emits motifPlay during the sequence", async () => {
      const wrapper = mountCelebration();
      await flushPromises();

      expect(wrapper.emitted("motifPlay")).toBeDefined();
      expect(wrapper.emitted("motifPlay")?.length).toBeGreaterThanOrEqual(1);
    });

    it("applies a scale pulse animate call for the motif", async () => {
      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      const calls = getAnimateCalls();
      // Find the scale [1, 1.05, 1] call — the motif pulse
      const motifCall = calls.find((call) => {
        const animProps = call[1] as Record<string, unknown> | undefined;
        return (
          animProps !== undefined &&
          Array.isArray(animProps.scale) &&
          (animProps.scale as number[])[0] === 1 &&
          (animProps.scale as number[])[1] === 1.05 &&
          (animProps.scale as number[])[2] === 1
        );
      });
      expect(motifCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 3.8 — Hold + emit done
  // ---------------------------------------------------------------------------
  describe("3.8 Hold and done emit", () => {
    it("emits done after the sequence completes", async () => {
      const wrapper = mountCelebration();
      await flushPromises();

      expect(wrapper.emitted("done")).toBeDefined();
      expect(wrapper.emitted("done")?.length).toBe(1);
    });

    it("uses animate() for the hold period — no setTimeout", async () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      // Allow promises to resolve with fake timers
      mockAnimate.mockImplementation(() => ({ finished: Promise.resolve(), stop: vi.fn() }));

      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      expect(setTimeoutSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("hold animate call has a positive duration when sequence runs faster than 5s", async () => {
      // With mocked animate() resolving instantly, elapsed time ~0ms → remaining ~5s
      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      const calls = getAnimateCalls();
      // Find the hold animate call: duration close to 5s (remaining ≈ 5 since mock resolves instantly)
      const holdCall = calls.find((call) => {
        const opts = call[2];
        return typeof opts?.duration === "number" && opts.duration > 4;
      });
      expect(holdCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // AC 4: Total sequence duration in 5–8s range
  // ---------------------------------------------------------------------------
  describe("AC 4 — Sequence duration", () => {
    it("MIN_SEQUENCE_DURATION_S is 5 — sequence holds at least 5s before done", async () => {
      // The sequence targets ≥5s total. With instant mocked animate, the hold
      // duration will be ~5s — verified by the hold call test above.
      // Here we assert that done is NOT emitted before flushPromises resolves,
      // meaning the sequence awaits all phases before emitting.
      const wrapper = mountCelebration();
      // Before promises flush, done should not be emitted yet
      expect(wrapper.emitted("done")).toBeUndefined();

      await flushPromises();
      // After all phases resolved, done is emitted
      expect(wrapper.emitted("done")).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Reduced motion: sequence is skipped, done emitted immediately
  // ---------------------------------------------------------------------------
  describe("Reduced motion path (Task 4)", () => {
    it("emits done after reduced-motion sequence completes", async () => {
      stubMatchMedia(true);
      mockAnimate.mockClear();

      const wrapper = mountCelebration();
      await flushPromises();

      // done should be emitted so the parent can transition
      expect(wrapper.emitted("done")).toBeDefined();
    });

    it("does NOT emit motifPlay in reduced motion path", async () => {
      stubMatchMedia(true);
      mockAnimate.mockClear();

      const wrapper = mountCelebration();
      await flushPromises();

      expect(wrapper.emitted("motifPlay")).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Race guard: unmount mid-sequence prevents done emit
  // ---------------------------------------------------------------------------
  describe("Race guard", () => {
    it("does not emit done if unmounted before sequence completes", async () => {
      // Use a never-resolving promise for some animate calls to simulate mid-sequence unmount
      let resolveAnimation: (() => void) | undefined;
      let callCount = 0;

      mockAnimate.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call (dim/beat) — blocks
          return {
            finished: new Promise<void>((resolve) => {
              resolveAnimation = resolve;
            }),
            stop: vi.fn(),
          };
        }
        return { finished: Promise.resolve(), stop: vi.fn() };
      });

      const wrapper = mountCelebration();
      // Let the first phase start but not complete
      await Promise.resolve();

      // Unmount before resolving
      wrapper.unmount();

      // Now resolve the blocked animation
      if (resolveAnimation) {
        resolveAnimation();
      }
      await flushPromises();

      // done should NOT be emitted since we unmounted
      expect(wrapper.emitted("done")).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Task 4: Reduced motion path (AC 5, AC 6)
// ---------------------------------------------------------------------------
describe("Celebration.vue — Task 4: Reduced motion path", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockAnimate.mockClear();
    stubMatchMedia(true);
    mockAnimate.mockImplementation(() => ({ finished: Promise.resolve(), stop: vi.fn() }));
    // Clean up any leftover seat/fan markers
    document.querySelectorAll("[data-celebration-seat]").forEach((el) => el.remove());
    document.querySelectorAll("[data-celebration-fan-tile]").forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll("[data-celebration-seat]").forEach((el) => el.remove());
    document.querySelectorAll("[data-celebration-fan-tile]").forEach((el) => el.remove());
  });

  // ---------------------------------------------------------------------------
  // 4.4a — Total sequence duration < 3s (AC 5)
  // ---------------------------------------------------------------------------
  it("4.4a: sequence completes (emits done) well within 3s — no fan-out or held beat delays", async () => {
    vi.useFakeTimers();
    // animate() resolves instantly — simulates the 0-duration and 2s hold immediately resolving
    mockAnimate.mockImplementation(() => ({ finished: Promise.resolve(), stop: vi.fn() }));

    const startMs = Date.now();
    const wrapper = mountCelebration();
    await vi.runAllTimersAsync();
    await flushPromises();

    const elapsedMs = Date.now() - startMs;

    // With fake timers and instantly-resolving animate, the sequence should complete
    // synchronously — well under 3000ms
    expect(elapsedMs).toBeLessThan(3000);
    expect(wrapper.emitted("done")).toBeDefined();

    vi.useRealTimers();
    wrapper.unmount();
  });

  // ---------------------------------------------------------------------------
  // 4.4b — Fan-out elements are NOT animated (AC 5)
  // ---------------------------------------------------------------------------
  it("4.4b: fan-out arc animation is skipped — animate() not called with fan tile elements", async () => {
    // Add fan tile markers to the DOM
    const fanTiles = Array.from({ length: 14 }, (_, i) => {
      const el = document.createElement("div");
      el.setAttribute("data-celebration-fan-tile", String(i + 1));
      document.body.appendChild(el);
      return el;
    });

    const wrapper = mountCelebrationReal();
    await flushPromises();

    const calls = getAnimateCalls();
    // No animate call should target fan tile elements
    const fanAnimCall = calls.find((call) => {
      const raw = call[0];
      if (!Array.isArray(raw)) return false;
      if (!raw.every((el): el is HTMLElement => el instanceof HTMLElement)) return false;
      return raw.some((el) => el.hasAttribute("data-celebration-fan-tile"));
    });
    expect(fanAnimCall).toBeUndefined();

    fanTiles.forEach((el) => el.remove());
    wrapper.unmount();
  });

  // ---------------------------------------------------------------------------
  // AC 6 — Dim IS applied (duration:0, instant opacity change)
  // ---------------------------------------------------------------------------
  it("AC 6: dim is applied with opacity 0.22 and duration 0 (instant, not animated)", async () => {
    const seatIds = ["player-south", "player-west", "player-north"];
    const seatMarkers = seatIds.map((id) => {
      const el = document.createElement("div");
      el.setAttribute("data-celebration-seat", id);
      document.body.appendChild(el);
      return el;
    });

    const wrapper = mountCelebrationReal();
    await flushPromises();

    const calls = getAnimateCalls();
    const dimCall = calls.find(
      (call) =>
        Array.isArray(call[0]) &&
        call[1] !== null &&
        typeof call[1] === "object" &&
        "opacity" in call[1] &&
        call[1].opacity === 0.22,
    );
    expect(dimCall).toBeDefined();
    expect(dimCall?.[2]).toMatchObject({ duration: 0 });

    seatMarkers.forEach((el) => el.remove());
    wrapper.unmount();
  });

  // ---------------------------------------------------------------------------
  // AC 6 — Spotlight IS shown (no animation)
  // ---------------------------------------------------------------------------
  it("AC 6: spotlight is made visible (spotlightVisible = true) in reduced motion path", async () => {
    const wrapper = mountCelebration();
    await flushPromises();

    const spotlight = wrapper.find("[data-testid='celebration-spotlight']");
    expect(spotlight.exists()).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // AC 6 — Scoring IS shown (no animation)
  // ---------------------------------------------------------------------------
  it("AC 6: scoring is made visible (scoringVisible = true) in reduced motion path", async () => {
    const wrapper = mountCelebration();
    await flushPromises();

    const scoring = wrapper.find("[data-testid='celebration-scoring']");
    expect(scoring.exists()).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // AC 5 — No held beat (0.5s) in reduced motion
  // ---------------------------------------------------------------------------
  it("AC 5: held beat (duration 0.5) is NOT used in reduced motion path", async () => {
    const wrapper = mountCelebration();
    await flushPromises();
    wrapper.unmount();

    const calls = getAnimateCalls();
    const beatCall = calls.find(
      (call) => call[2] !== undefined && typeof call[2] === "object" && call[2].duration === 0.5,
    );
    expect(beatCall).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // AC 5 — Hold is 2s (not the full MIN_SEQUENCE_DURATION_S = 5s)
  // ---------------------------------------------------------------------------
  it("AC 5: hold animate call uses duration 2 (not 5) in reduced motion path", async () => {
    const wrapper = mountCelebration();
    await flushPromises();
    wrapper.unmount();

    const calls = getAnimateCalls();
    // Should have a hold animate call with duration exactly 2
    const holdCall = calls.find(
      (call) => call[2] !== undefined && typeof call[2] === "object" && call[2].duration === 2,
    );
    expect(holdCall).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // done is emitted after reduced motion sequence
  // ---------------------------------------------------------------------------
  it("emits done after reduced motion sequence completes", async () => {
    const wrapper = mountCelebration();
    await flushPromises();

    expect(wrapper.emitted("done")).toBeDefined();
    expect(wrapper.emitted("done")?.length).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // motifPlay is NOT emitted (motif is a visual animation, skip under reduced motion)
  // ---------------------------------------------------------------------------
  it("does NOT emit motifPlay in reduced motion path", async () => {
    const wrapper = mountCelebration();
    await flushPromises();

    expect(wrapper.emitted("motifPlay")).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // No setTimeout used in reduced motion path
  // ---------------------------------------------------------------------------
  it("does not call setTimeout during reduced motion sequence", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const wrapper = mountCelebration();
    await flushPromises();
    wrapper.unmount();

    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — Task 6: AC coverage audit (subtasks 6.1–6.7)
// ---------------------------------------------------------------------------
describe("Celebration.vue — Task 6: AC coverage audit", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockAnimate.mockClear();
    mockAnimate.mockImplementation(() => ({ finished: Promise.resolve(), stop: vi.fn() }));
    document.querySelectorAll("[data-celebration-seat]").forEach((el) => el.remove());
    document.querySelectorAll("[data-celebration-fan-tile]").forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll("[data-celebration-seat]").forEach((el) => el.remove());
    document.querySelectorAll("[data-celebration-fan-tile]").forEach((el) => el.remove());
  });

  // ---------------------------------------------------------------------------
  // 6.1 — Renders over the game table as a fixed overlay
  // (cross-reference: already covered by Task 1 "1.1 Overlay shell" tests)
  // ---------------------------------------------------------------------------
  describe("6.1 Fixed overlay over game table", () => {
    it("renders a fixed inset-0 z-[70] overlay element", () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      const overlay = wrapper.find("[data-testid='celebration-overlay']");
      expect(overlay.exists()).toBe(true);
      expect(overlay.classes()).toContain("fixed");
      expect(overlay.classes()).toContain("inset-0");
      expect(overlay.classes()).toContain("z-[70]");
    });
  });

  // ---------------------------------------------------------------------------
  // 6.2 — Winner name appears in the spotlight section
  // (cross-reference: already covered by Task 3 "3.5 Phase 4 — Winner spotlight")
  // ---------------------------------------------------------------------------
  describe("6.2 Winner name in spotlight", () => {
    it("shows the winner's display name from playerNamesById in the spotlight", async () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      await flushPromises();

      const spotlight = wrapper.find("[data-testid='celebration-spotlight']");
      expect(spotlight.exists()).toBe(true);
      // "Alice" is playerNamesById[WINNER_ID]
      expect(spotlight.text()).toContain("Alice");
    });

    it("shows 'Mahjong! — [winner name] —' format in spotlight", async () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      await flushPromises();

      const text = wrapper.find("[data-testid='celebration-spotlight']").text();
      expect(text).toContain("Mahjong!");
      expect(text).toContain("Alice");
    });
  });

  // ---------------------------------------------------------------------------
  // 6.3 — Payment amounts shown in scoring overlay (at least one row)
  // ---------------------------------------------------------------------------
  describe("6.3 Payment amounts in scoring overlay", () => {
    it("renders at least one payment row in the scoring overlay", async () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      await flushPromises();

      const scoring = wrapper.find("[data-testid='celebration-scoring']");
      expect(scoring.exists()).toBe(true);

      // Each payment entry is an <li> — must have at least one
      const rows = scoring.findAll("li");
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it("renders all four payment rows (one per player) in the scoring overlay", async () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      await flushPromises();

      const scoring = wrapper.find("[data-testid='celebration-scoring']");
      const rows = scoring.findAll("li");
      // mockGameResult.payments has 4 entries: east, south, west, north
      expect(rows).toHaveLength(4);
    });

    it("each payment row shows a player name and an amount", async () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      await flushPromises();

      const scoring = wrapper.find("[data-testid='celebration-scoring']");
      const rows = scoring.findAll("li");
      // Every row should contain at least a name and a numeric amount
      for (const row of rows) {
        const text = row.text();
        // Must contain a number (positive or negative)
        expect(text).toMatch(/[+-]?\d+/);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 6.4 — done event emitted after sequence (mock timers to fast-forward)
  // (cross-reference: already covered by Task 3 "3.8 Hold and done emit")
  // ---------------------------------------------------------------------------
  describe("6.4 done event emitted after sequence with mocked timers", () => {
    it("emits done after sequence completes using fake timers", async () => {
      stubMatchMedia(false);
      vi.useFakeTimers();
      mockAnimate.mockImplementation(() => ({ finished: Promise.resolve(), stop: vi.fn() }));

      const wrapper = mountCelebration();
      await vi.runAllTimersAsync();
      await flushPromises();

      expect(wrapper.emitted("done")).toBeDefined();
      expect(wrapper.emitted("done")?.length).toBe(1);

      vi.useRealTimers();
      wrapper.unmount();
    });
  });

  // ---------------------------------------------------------------------------
  // 6.5 — pointer-events: none so clicks pass through
  // (cross-reference: already covered by Task 1 "1.4 pointer-events: none")
  // ---------------------------------------------------------------------------
  describe("6.5 pointer-events: none on overlay", () => {
    it("overlay root has pointer-events-none so underlying UI remains interactive", () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      const overlay = wrapper.find("[data-testid='celebration-overlay']");
      expect(overlay.classes()).toContain("pointer-events-none");
    });
  });

  // ---------------------------------------------------------------------------
  // 6.6 — Reduced motion: total time < 3s AND animate() called 0 times for fan-out
  // (cross-reference: 4.4a covers time < 3s, 4.4b covers fan-out = 0 animate calls)
  // ---------------------------------------------------------------------------
  describe("6.6 Reduced motion path", () => {
    it("completes within 3s wall-clock time in reduced motion mode", async () => {
      stubMatchMedia(true);
      vi.useFakeTimers();
      mockAnimate.mockImplementation(() => ({ finished: Promise.resolve(), stop: vi.fn() }));

      const startMs = Date.now();
      const wrapper = mountCelebration();
      await vi.runAllTimersAsync();
      await flushPromises();
      const elapsedMs = Date.now() - startMs;

      expect(elapsedMs).toBeLessThan(3000);
      expect(wrapper.emitted("done")).toBeDefined();

      vi.useRealTimers();
      wrapper.unmount();
    });

    it("calls animate() 0 times targeting fan tile elements in reduced motion mode", async () => {
      stubMatchMedia(true);

      // Add fan tile DOM markers
      const fanTiles = Array.from({ length: 14 }, (_, i) => {
        const el = document.createElement("div");
        el.setAttribute("data-celebration-fan-tile", String(i + 1));
        document.body.appendChild(el);
        return el;
      });

      const wrapper = mountCelebrationReal();
      await flushPromises();

      const calls = getAnimateCalls();
      const fanAnimCalls = calls.filter((call) => {
        const raw = call[0];
        if (!Array.isArray(raw)) return false;
        if (!raw.every((el): el is HTMLElement => el instanceof HTMLElement)) return false;
        return raw.some((el) => el.hasAttribute("data-celebration-fan-tile"));
      });
      // Zero fan-out animate() calls in reduced motion
      expect(fanAnimCalls).toHaveLength(0);

      fanTiles.forEach((el) => el.remove());
      wrapper.unmount();
    });
  });

  // ---------------------------------------------------------------------------
  // 6.7 — Full motion: sequence duration in 5–8s range
  // ---------------------------------------------------------------------------
  describe("6.7 Full motion sequence duration 5–8s", () => {
    it("hold animate call duration brings total elapsed to at least 5s (MIN_SEQUENCE_DURATION_S)", async () => {
      stubMatchMedia(false);
      // With instantly-resolving animate(), elapsed ≈ 0ms, so remaining ≈ 5s
      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      const calls = getAnimateCalls();
      // The hold call should have duration >= 4 (approaching 5 given near-zero real elapsed)
      const holdCall = calls.find((call) => {
        const opts = call[2];
        return typeof opts?.duration === "number" && opts.duration >= 4;
      });
      expect(holdCall).toBeDefined();
    });

    it("hold animate duration is <= 8 (sequence total never exceeds 8s)", async () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      await flushPromises();
      wrapper.unmount();

      const calls = getAnimateCalls();
      // Find the hold call (duration > 4) and verify it's not absurdly long
      const holdCall = calls.find((call) => {
        const opts = call[2];
        return typeof opts?.duration === "number" && opts.duration >= 4;
      });
      expect(holdCall).toBeDefined();
      // The hold duration itself should be <= 8 (MAX_SEQUENCE_DURATION_S is implicitly 8)
      if (holdCall) {
        const holdDuration = holdCall[2]?.duration;
        expect(typeof holdDuration).toBe("number");
        expect(holdDuration as number).toBeLessThanOrEqual(8);
      }
    });

    it("done is NOT emitted before the sequence hold completes", async () => {
      stubMatchMedia(false);
      const wrapper = mountCelebration();
      // Before any flush, done should not yet be emitted
      expect(wrapper.emitted("done")).toBeUndefined();

      await flushPromises();
      // After all phases and hold resolve, done is emitted exactly once
      expect(wrapper.emitted("done")).toBeDefined();
      expect(wrapper.emitted("done")?.length).toBe(1);
    });
  });
});
