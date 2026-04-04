import type { GameState, ActionResult } from "../../types/game-state";
import type { JokerExchangeAction } from "../../types/actions";
import { validateJokerExchange } from "../../card/joker-eligibility";
import { enforceDeadHandIfInvalidExposedGroups } from "../dead-hand";

const GROUP_ID_PATTERN = /^(.+)-group-(\d+)$/;

/**
 * Resolve target exposed group from architecture jokerGroupId: `{ownerId}-group-{index}`.
 */
function resolveExposedGroup(state: GameState, jokerGroupId: string) {
  const match = jokerGroupId.match(GROUP_ID_PATTERN);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  const ownerPlayerId = match[1];
  const groupIndex = Number.parseInt(match[2], 10);
  if (!Number.isFinite(groupIndex) || groupIndex < 0) return null;

  const ownerPlayer = state.players[ownerPlayerId];
  if (!ownerPlayer) return null;

  const exposedGroup = ownerPlayer.exposedGroups[groupIndex];
  if (!exposedGroup) return null;

  return { ownerPlayerId, exposedGroup };
}

/**
 * Handle JOKER_EXCHANGE: validate phase/turn/rack/group, then swap natural tile for Joker in place.
 * turnPhase stays "discard" so multiple exchanges per turn are allowed.
 */
export function handleJokerExchange(state: GameState, action: JokerExchangeAction): ActionResult {
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (state.currentTurn !== action.playerId) {
    return { accepted: false, reason: "NOT_YOUR_TURN" };
  }
  if (state.turnPhase !== "discard") {
    return { accepted: false, reason: "ALREADY_DISCARDED" };
  }
  if (state.jokerRulesMode === "simplified") {
    return { accepted: false, reason: "JOKER_EXCHANGE_DISABLED" };
  }

  const resolved = resolveExposedGroup(state, action.jokerGroupId);
  if (!resolved) {
    return { accepted: false, reason: "GROUP_NOT_FOUND" };
  }
  const { exposedGroup } = resolved;

  const player = state.players[action.playerId];
  if (!player) throw new Error(`handleJokerExchange: no player found for id '${action.playerId}'`);

  const naturalTileIndex = player.rack.findIndex((t) => t.id === action.naturalTileId);
  if (naturalTileIndex === -1) {
    return { accepted: false, reason: "TILE_NOT_IN_RACK" };
  }
  const naturalTile = player.rack[naturalTileIndex];

  const exchange = validateJokerExchange(exposedGroup, naturalTile);
  if (!exchange.valid) {
    if (exchange.reason === "Group contains no Joker tiles") {
      return { accepted: false, reason: "NO_JOKER_IN_GROUP" };
    }
    if (exchange.reason === "Offered tile does not match group identity") {
      return { accepted: false, reason: "TILE_DOES_NOT_MATCH_GROUP" };
    }
    return { accepted: false, reason: "TILE_DOES_NOT_MATCH_GROUP" };
  }

  const { jokerTile } = exchange;
  const jokerIndex = exposedGroup.tiles.findIndex((t) => t.id === jokerTile.id);
  if (jokerIndex === -1) {
    return { accepted: false, reason: "NO_JOKER_IN_GROUP" };
  }

  exposedGroup.tiles[jokerIndex] = naturalTile;

  player.rack.splice(naturalTileIndex, 1);
  player.rack.push(jokerTile);

  const ownerPlayerId = resolved.ownerPlayerId;
  const deadFromExposure = enforceDeadHandIfInvalidExposedGroups(state, ownerPlayerId);
  if (deadFromExposure) {
    return deadFromExposure;
  }

  return {
    accepted: true,
    resolved: {
      type: "JOKER_EXCHANGE",
      playerId: action.playerId,
      jokerGroupId: action.jokerGroupId,
      jokerTileId: jokerTile.id,
      naturalTileId: action.naturalTileId,
    },
  };
}
