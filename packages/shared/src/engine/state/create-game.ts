import type { GameState, PlayerState, SeatWind } from "../../types/game-state";
import { SEATS, MAX_PLAYERS } from "../../constants";
import { createWall } from "./wall";
import { dealTiles } from "./dealing";
import { loadCard } from "../../card/card-loader";

/**
 * Create a new game with 4 players, assign winds, deal tiles, and return initial state.
 * First player ID maps to East, second to South, etc.
 *
 * @param playerIds - Array of exactly 4 unique player IDs
 * @param seed - Optional seed for deterministic wall shuffle (for testing)
 * @returns Complete initial GameState ready for play
 */
export function createGame(playerIds: string[], seed?: number): GameState {
  if (playerIds.length !== MAX_PLAYERS) {
    throw new Error(`Expected ${MAX_PLAYERS} players, got ${playerIds.length}`);
  }

  const uniqueIds = new Set(playerIds);
  if (uniqueIds.size !== playerIds.length) {
    throw new Error("Player IDs must be unique");
  }

  const wall = createWall(seed);
  const { hands, remainingWall } = dealTiles(wall);

  const players: Record<string, PlayerState> = {};
  const scores: Record<string, number> = {};

  for (let i = 0; i < MAX_PLAYERS; i++) {
    const playerId = playerIds[i];
    const seatWind = SEATS[i] as SeatWind;
    players[playerId] = {
      id: playerId,
      seatWind,
      rack: hands[seatWind],
      exposedGroups: [],
      discardPool: [],
      deadHand: false,
    };
    scores[playerId] = 0;
  }

  const eastPlayerId = playerIds[0];

  return {
    gamePhase: "play",
    players,
    wall: remainingWall,
    wallRemaining: remainingWall.length,
    currentTurn: eastPlayerId,
    turnPhase: "discard",
    lastDiscard: null,
    callWindow: null,
    scores,
    gameResult: null,
    card: loadCard("2026"),
    pendingMahjong: null,
    challengeState: null,
    shownHands: {},
  };
}
