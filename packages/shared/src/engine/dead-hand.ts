import type { GameState, ActionResult, PlayerState } from "../types/game-state";
import { filterAchievableByExposure, validateExposure } from "../card/exposure-validation";

/** Total tiles = concealed rack + tiles committed in exposed groups */
export function totalHandTiles(player: PlayerState): number {
  return player.rack.length + player.exposedGroups.reduce((sum, g) => sum + g.tiles.length, 0);
}

/**
 * Whether automatic tile-count enforcement should run for this snapshot.
 * Wrong invariants are worse than missed detection — skip ambiguous phases.
 */
export function shouldRunTileCountInvariant(state: GameState, playerId: string): boolean {
  if (state.gamePhase !== "play") return false;
  if (state.charleston) return false;
  if (state.pendingMahjong) return false;
  if (state.turnPhase === "callWindow" || state.callWindow !== null) return false;
  if (state.currentTurn !== playerId) return false;
  return true;
}

/**
 * Expected total (rack + exposed) for the current player during play.
 * Before drawing: 13; after draw until discard completes: 14.
 */
export function expectedHandTileCount(state: GameState, playerId: string): number | null {
  if (!shouldRunTileCountInvariant(state, playerId)) return null;
  if (state.turnPhase === "draw") return 13;
  if (state.turnPhase === "discard") return 14;
  return null;
}

/**
 * If the invariant fails, sets deadHand and returns a resolved action.
 * Otherwise returns null (caller continues normally).
 */
export function enforceDeadHandIfTileCountMismatch(
  state: GameState,
  playerId: string,
): ActionResult | null {
  const expected = expectedHandTileCount(state, playerId);
  if (expected === null) return null;

  const player = state.players[playerId];
  if (!player) return null;

  const actual = totalHandTiles(player);
  if (actual === expected) return null;

  player.deadHand = true;
  return {
    accepted: true,
    resolved: {
      type: "DEAD_HAND_ENFORCED",
      playerId,
      reason: "TILE_COUNT_MISMATCH",
    },
  };
}

/**
 * After a mutation that can invalidate committed exposures (e.g. Joker exchange),
 * if no NMJL hand on the loaded card can still accommodate these exposed groups, dead hand.
 * Uses filterAchievableByExposure + validateExposure — not validateHandWithExposure (winning hand only).
 */
export function enforceDeadHandIfInvalidExposedGroups(
  state: GameState,
  playerId: string,
): ActionResult | null {
  const card = state.card;
  if (!card) return null;

  const player = state.players[playerId];
  if (!player || player.exposedGroups.length === 0) return null;

  const candidates = filterAchievableByExposure(player.exposedGroups, card);
  const stillValid = candidates.some((hand) => validateExposure(player.exposedGroups, hand).valid);
  if (stillValid) return null;

  player.deadHand = true;
  return {
    accepted: true,
    resolved: {
      type: "DEAD_HAND_ENFORCED",
      playerId,
      reason: "INVALID_EXPOSED_GROUPS",
    },
  };
}
