import type { GameState, JokerRulesMode } from "../types/game-state";
import { createGame } from "../engine/state/create-game";
import { fastForwardToPlayPhase } from "./helpers";
import { createLobbyState } from "../engine/game-engine";

/** Default player IDs used across test fixtures */
export const TEST_PLAYER_IDS = ["p1", "p2", "p3", "p4"] as const;

/** Default seed for deterministic fixtures */
export const TEST_SEED = 42;

/** Create a fresh lobby state ready to receive START_GAME. Always returns a new object. */
export function createLobbyFixture(): GameState {
  return createLobbyState();
}

/** A game in play state with tiles dealt (seed 42) */
export function createPlayState(
  seed: number = TEST_SEED,
  jokerRulesMode: JokerRulesMode = "standard",
): GameState {
  return fastForwardToPlayPhase(createGame([...TEST_PLAYER_IDS], seed, jokerRulesMode));
}
