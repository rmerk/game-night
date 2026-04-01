import { describe, it, expect } from "vite-plus/test";
import { createGame } from "./create-game";
import { TILE_COUNT } from "../../constants";

const PLAYER_IDS = ["p1", "p2", "p3", "p4"];
const SEED = 42;

describe("createGame", () => {
  describe("wind assignment (AC #1)", () => {
    it("assigns East to first player", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.players["p1"].seatWind).toBe("east");
    });

    it("assigns South to second player", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.players["p2"].seatWind).toBe("south");
    });

    it("assigns West to third player", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.players["p3"].seatWind).toBe("west");
    });

    it("assigns North to fourth player", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.players["p4"].seatWind).toBe("north");
    });

    it("assigns unique winds to all players", () => {
      const state = createGame(PLAYER_IDS, SEED);
      const winds = Object.values(state.players).map((p) => p.seatWind);
      expect(new Set(winds).size).toBe(4);
    });

    it("sets gamePhase to charleston", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.gamePhase).toBe("charleston");
    });
  });

  describe("tile dealing (AC #2, #3)", () => {
    it("deals 14 tiles to East", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.players["p1"].rack).toHaveLength(14);
    });

    it("deals 13 tiles to South", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.players["p2"].rack).toHaveLength(13);
    });

    it("deals 13 tiles to West", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.players["p3"].rack).toHaveLength(13);
    });

    it("deals 13 tiles to North", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.players["p4"].rack).toHaveLength(13);
    });

    it("leaves 99 tiles in the wall", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.wall).toHaveLength(99);
      expect(state.wallRemaining).toBe(99);
    });

    it("wallRemaining matches wall array length", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.wallRemaining).toBe(state.wall.length);
    });

    it("total tiles = 152 (all hands + wall)", () => {
      const state = createGame(PLAYER_IDS, SEED);
      const rackTotal = Object.values(state.players).reduce((sum, p) => sum + p.rack.length, 0);
      expect(rackTotal + state.wall.length).toBe(TILE_COUNT);
    });
  });

  describe("initial game state (AC #4)", () => {
    it("starts the first Charleston on the right pass", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.charleston).not.toBeNull();
      expect(state.charleston).toMatchObject({
        stage: "first",
        status: "passing",
        currentDirection: "right",
        activePlayerIds: PLAYER_IDS,
        submittedPlayerIds: [],
      });
    });

    it("sets currentTurn to East player", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.currentTurn).toBe("p1");
    });

    it("sets turnPhase to discard (East skips draw)", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.turnPhase).toBe("discard");
    });

    it("all discard pools are empty", () => {
      const state = createGame(PLAYER_IDS, SEED);
      for (const player of Object.values(state.players)) {
        expect(player.discardPool).toEqual([]);
      }
    });

    it("no exposed groups exist", () => {
      const state = createGame(PLAYER_IDS, SEED);
      for (const player of Object.values(state.players)) {
        expect(player.exposedGroups).toEqual([]);
      }
    });

    it("all scores are initialized to 0", () => {
      const state = createGame(PLAYER_IDS, SEED);
      for (const playerId of PLAYER_IDS) {
        expect(state.scores[playerId]).toBe(0);
      }
    });

    it("callWindow is null", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.callWindow).toBeNull();
    });

    it("lastDiscard is null", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state.lastDiscard).toBeNull();
    });
  });

  describe("state shape (AC #5)", () => {
    it("includes all required fields", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(state).toHaveProperty("gamePhase");
      expect(state).toHaveProperty("players");
      expect(state).toHaveProperty("wall");
      expect(state).toHaveProperty("wallRemaining");
      expect(state).toHaveProperty("currentTurn");
      expect(state).toHaveProperty("turnPhase");
      expect(state).toHaveProperty("lastDiscard");
      expect(state).toHaveProperty("callWindow");
      expect(state).toHaveProperty("scores");
    });

    it("players record has entries for all 4 player IDs", () => {
      const state = createGame(PLAYER_IDS, SEED);
      expect(Object.keys(state.players)).toHaveLength(4);
      for (const id of PLAYER_IDS) {
        expect(state.players[id]).toBeDefined();
      }
    });

    it("player state includes all required fields", () => {
      const state = createGame(PLAYER_IDS, SEED);
      const player = state.players["p1"];
      expect(player).toHaveProperty("id");
      expect(player).toHaveProperty("seatWind");
      expect(player).toHaveProperty("rack");
      expect(player).toHaveProperty("exposedGroups");
      expect(player).toHaveProperty("discardPool");
    });
  });

  describe("determinism", () => {
    it("same seed produces identical game state", () => {
      const state1 = createGame(PLAYER_IDS, 42);
      const state2 = createGame(PLAYER_IDS, 42);

      expect(state1.players["p1"].rack.map((t) => t.id)).toEqual(
        state2.players["p1"].rack.map((t) => t.id),
      );
      expect(state1.wall.map((t) => t.id)).toEqual(state2.wall.map((t) => t.id));
    });

    it("different seeds produce different game states", () => {
      const state1 = createGame(PLAYER_IDS, 42);
      const state2 = createGame(PLAYER_IDS, 999);

      expect(state1.players["p1"].rack.map((t) => t.id)).not.toEqual(
        state2.players["p1"].rack.map((t) => t.id),
      );
    });
  });

  describe("validation", () => {
    it("throws if not exactly 4 players", () => {
      expect(() => createGame(["p1", "p2", "p3"], SEED)).toThrow("Expected 4 players, got 3");
      expect(() => createGame(["p1", "p2", "p3", "p4", "p5"], SEED)).toThrow(
        "Expected 4 players, got 5",
      );
    });

    it("throws if player IDs are not unique", () => {
      expect(() => createGame(["p1", "p2", "p1", "p4"], SEED)).toThrow("Player IDs must be unique");
    });
  });
});
