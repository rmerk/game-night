import type { GameState, ActionResult, CallType } from "../../types/game-state";
import type {
  PassCallAction,
  CallPungAction,
  CallKongAction,
  CallQuintAction,
} from "../../types/actions";
import type { Tile } from "../../types/tiles";
import { MAX_PLAYERS, SEATS } from "../../constants";

/**
 * Handle PASS_CALL action: validate call window state, then record the pass.
 * If all players have passed, closes the call window via closeCallWindow.
 * Follows validate-then-mutate pattern.
 */
export function handlePassCall(state: GameState, action: PassCallAction): ActionResult {
  // 1. Validate — no mutations above this line
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }
  if (state.callWindow.status !== "open") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_OPEN" };
  }
  if (state.callWindow.discarderId === action.playerId) {
    return { accepted: false, reason: "DISCARDER_CANNOT_CALL" };
  }
  if (state.callWindow.passes.includes(action.playerId)) {
    return { accepted: false, reason: "ALREADY_PASSED" };
  }

  // 2. Mutate — only reached if all validation passed
  state.callWindow.passes.push(action.playerId);

  // 3. Check for early close — all 4 players (including auto-passed discarder) have passed
  if (state.callWindow.passes.length === MAX_PLAYERS) {
    return closeCallWindow(state, "all_passed");
  }

  // 4. Return result — window still open
  return {
    accepted: true,
    resolved: { type: "PASS_CALL", playerId: action.playerId },
  };
}

/** Required number of tiles from the caller's rack for each call type */
const REQUIRED_FROM_RACK: Record<CallType, number> = {
  pung: 2,
  kong: 3,
  quint: 4,
};

/** Check if a tile matches the discarded tile (same identity, ignoring copy number) */
function tilesMatch(tile: Tile, discardedTile: Tile): boolean {
  if (tile.category === "joker") return true;
  if (tile.category !== discardedTile.category) return false;

  switch (tile.category) {
    case "suited":
      return (
        discardedTile.category === "suited" &&
        tile.suit === discardedTile.suit &&
        tile.value === discardedTile.value
      );
    case "wind":
      return discardedTile.category === "wind" && tile.value === discardedTile.value;
    case "dragon":
      return discardedTile.category === "dragon" && tile.value === discardedTile.value;
    default:
      return false;
  }
}

/**
 * Handle a call action (CALL_PUNG, CALL_KONG, CALL_QUINT).
 * Validates the call window state, tile ownership, tile matching, and group size,
 * then records the call in the call buffer.
 * Follows validate-then-mutate pattern.
 */
export function handleCallAction(
  state: GameState,
  action: CallPungAction | CallKongAction | CallQuintAction,
  callType: CallType,
): ActionResult {
  const requiredFromRack = REQUIRED_FROM_RACK[callType];

  // 1. Validate call window state (same checks as handlePassCall)
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }
  if (state.callWindow.status !== "open") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_OPEN" };
  }
  if (state.callWindow.discarderId === action.playerId) {
    return { accepted: false, reason: "DISCARDER_CANNOT_CALL" };
  }
  if (state.callWindow.passes.includes(action.playerId)) {
    return { accepted: false, reason: "ALREADY_PASSED" };
  }

  // 2. Validate tile count from rack matches expected
  if (action.tileIds.length !== requiredFromRack) {
    return { accepted: false, reason: "INSUFFICIENT_TILES" };
  }

  // 3. Validate pair rejection: total group size (rack tiles + discarded) must be >= 3
  if (action.tileIds.length + 1 === 2) {
    return { accepted: false, reason: "CANNOT_CALL_FOR_PAIR" };
  }

  // 4. Validate all tile IDs exist in the caller's rack
  const player = state.players[action.playerId];
  if (!player) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }
  for (const tileId of action.tileIds) {
    if (!player.rack.find((t) => t.id === tileId)) {
      return { accepted: false, reason: "TILE_NOT_IN_RACK" };
    }
  }

  // 5. Validate each tile matches the discarded tile (or is a Joker)
  const discardedTile = state.callWindow.discardedTile;
  for (const tileId of action.tileIds) {
    const tile = player.rack.find((t) => t.id === tileId)!;
    if (!tilesMatch(tile, discardedTile)) {
      return { accepted: false, reason: "INSUFFICIENT_TILES" };
    }
  }

  // 6. Mutate — record the call in the buffer
  state.callWindow.calls.push({
    callType,
    playerId: action.playerId,
    tileIds: [...action.tileIds],
  });

  return {
    accepted: true,
    resolved: { type: action.type, playerId: action.playerId },
  };
}

/**
 * Close the call window and advance the turn to the next player counterclockwise
 * from the discarder. If the wall is empty and no calls were made, end as wall game.
 */
export function closeCallWindow(
  state: GameState,
  reason: "all_passed" | "timer_expired",
): ActionResult {
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }

  const discarderId = state.callWindow.discarderId;

  // Clear call window
  state.callWindow = null;

  // Check for wall game — wall empty and no calls resolved
  if (state.wall.length === 0) {
    state.gamePhase = "scoreboard";
    state.gameResult = { winnerId: null, points: 0 };
    return {
      accepted: true,
      resolved: { type: "WALL_GAME" },
    };
  }

  // Advance turn to next player counterclockwise from the discarder
  const discarder = state.players[discarderId];
  if (!discarder)
    throw new Error(`closeCallWindow: no player found for discarderId '${discarderId}'`);
  const discarderSeatIndex = SEATS.indexOf(discarder.seatWind);
  const nextSeatWind = SEATS[(discarderSeatIndex + 1) % SEATS.length];

  const nextPlayer = Object.values(state.players).find((p) => p.seatWind === nextSeatWind);
  if (!nextPlayer)
    throw new Error(`closeCallWindow: no player found with seatWind '${nextSeatWind}'`);
  state.currentTurn = nextPlayer.id;
  state.turnPhase = "draw";

  return {
    accepted: true,
    resolved: { type: "CALL_WINDOW_CLOSED", reason },
  };
}
