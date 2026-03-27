import { describe, it, expect } from "vite-plus/test";
import { handleStartGame } from "./game-flow";
import { createLobbyState } from "../game-engine";
import type { StartGameAction } from "../../types/actions";

const START_ACTION: StartGameAction = {
  type: "START_GAME",
  playerIds: ["p1", "p2", "p3", "p4"],
  seed: 42,
};

describe("handleStartGame", () => {
  it("accepts START_GAME in lobby phase", () => {
    const state = createLobbyState();
    const result = handleStartGame(state, START_ACTION);
    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "GAME_STARTED" });
  });

  it("rejects START_GAME when not in lobby phase", () => {
    const state = createLobbyState();
    // Simulate already in play phase
    state.gamePhase = "play";
    const result = handleStartGame(state, START_ACTION);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
  });

  it("does not mutate state when rejected", () => {
    const state = createLobbyState();
    state.gamePhase = "play";
    const originalPlayers = state.players;
    handleStartGame(state, START_ACTION);
    expect(state.players).toBe(originalPlayers);
  });

  it("transitions state to play phase on acceptance", () => {
    const state = createLobbyState();
    handleStartGame(state, START_ACTION);
    expect(state.gamePhase).toBe("play");
  });

  it("deals tiles correctly after START_GAME", () => {
    const state = createLobbyState();
    handleStartGame(state, START_ACTION);
    expect(state.players["p1"].rack).toHaveLength(14);
    expect(state.players["p2"].rack).toHaveLength(13);
    expect(state.wallRemaining).toBe(99);
  });

  it("sets currentTurn to East player", () => {
    const state = createLobbyState();
    handleStartGame(state, START_ACTION);
    expect(state.currentTurn).toBe("p1");
  });

  it("rejects START_GAME with wrong player count", () => {
    const state = createLobbyState();
    const result = handleStartGame(state, { type: "START_GAME", playerIds: ["p1", "p2", "p3"] });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INVALID_PLAYER_COUNT");
  });

  it("rejects START_GAME with duplicate player IDs", () => {
    const state = createLobbyState();
    const result = handleStartGame(state, {
      type: "START_GAME",
      playerIds: ["p1", "p2", "p1", "p4"],
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DUPLICATE_PLAYER_IDS");
  });

  it("does not mutate state when player count is wrong", () => {
    const state = createLobbyState();
    handleStartGame(state, { type: "START_GAME", playerIds: ["p1", "p2", "p3"] });
    expect(state.gamePhase).toBe("lobby");
  });
});
