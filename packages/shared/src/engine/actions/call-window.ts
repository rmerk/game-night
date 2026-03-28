import type { GameState, ActionResult, CallType } from "../../types/game-state";
import type {
  PassCallAction,
  CallPungAction,
  CallKongAction,
  CallQuintAction,
  CallNewsAction,
  CallDragonSetAction,
} from "../../types/actions";
import type { Tile } from "../../types/tiles";
import { MAX_PLAYERS, SEATS, WINDS, DRAGONS } from "../../constants";

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
  news: 3,
  dragon_set: 2,
};

/** Returns true for pattern-defined call types (NEWS, Dragon set) */
export function isPatternDefinedCall(callType: CallType): boolean {
  return callType === "news" || callType === "dragon_set";
}

/** Validate a NEWS group: discard + rack tiles must cover all 4 winds (Jokers substitute) */
export function validateNewsGroup(rackTiles: Tile[], discardedTile: Tile): boolean {
  if (discardedTile.category !== "wind") return false;

  const required = new Set<string>(WINDS);
  required.delete(discardedTile.value);

  for (const tile of rackTiles) {
    if (tile.category === "joker") {
      // Joker fills one remaining slot
      continue;
    }
    if (tile.category !== "wind") return false;
    if (!required.has(tile.value)) return false;
    required.delete(tile.value);
  }

  // Count how many winds still needed — must be covered by Jokers
  const jokerCount = rackTiles.filter((t) => t.category === "joker").length;
  return required.size <= jokerCount;
}

/** Validate a Dragon set group: discard + rack tiles must cover all 3 dragons (Jokers substitute) */
export function validateDragonSetGroup(rackTiles: Tile[], discardedTile: Tile): boolean {
  if (discardedTile.category !== "dragon") return false;

  const required = new Set<string>(DRAGONS);
  required.delete(discardedTile.value);

  for (const tile of rackTiles) {
    if (tile.category === "joker") {
      continue;
    }
    if (tile.category !== "dragon") return false;
    if (!required.has(tile.value)) return false;
    required.delete(tile.value);
  }

  const jokerCount = rackTiles.filter((t) => t.category === "joker").length;
  return required.size <= jokerCount;
}

/** Check if a tile matches the discarded tile (same identity, ignoring copy number) */
export function tilesMatch(tile: Tile, discardedTile: Tile): boolean {
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

/** Call action union type — all call action interfaces */
type CallAction =
  | CallPungAction
  | CallKongAction
  | CallQuintAction
  | CallNewsAction
  | CallDragonSetAction;

/**
 * Handle a call action (CALL_PUNG, CALL_KONG, CALL_QUINT, CALL_NEWS, CALL_DRAGON_SET).
 * Validates the call window state, tile ownership, tile matching/pattern, and group size,
 * then records the call in the call buffer.
 * Follows validate-then-mutate pattern.
 */
export function handleCallAction(
  state: GameState,
  action: CallAction,
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

  // 2. Validate no duplicate tile IDs
  if (new Set(action.tileIds).size !== action.tileIds.length) {
    return { accepted: false, reason: "DUPLICATE_TILE_IDS" };
  }

  // 3. Validate pair rejection: total group size (rack tiles + discarded) must be >= 3
  if (action.tileIds.length + 1 === 2) {
    return { accepted: false, reason: "CANNOT_CALL_FOR_PAIR" };
  }

  // 4. Validate tile count from rack matches expected
  if (action.tileIds.length !== requiredFromRack) {
    return { accepted: false, reason: "INSUFFICIENT_TILES" };
  }

  // 5. Validate all tile IDs exist in the caller's rack
  const player = state.players[action.playerId];
  if (!player) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }
  for (const tileId of action.tileIds) {
    if (!player.rack.find((t) => t.id === tileId)) {
      return { accepted: false, reason: "TILE_NOT_IN_RACK" };
    }
  }

  // 6. Validate tile matching — diverges for pattern-defined vs same-tile calls
  const discardedTile = state.callWindow.discardedTile;

  if (isPatternDefinedCall(callType)) {
    // Pattern-defined validation: NEWS or Dragon set
    const rackTiles = action.tileIds.map((id) => player.rack.find((t) => t.id === id)!);
    const valid =
      callType === "news"
        ? validateNewsGroup(rackTiles, discardedTile)
        : validateDragonSetGroup(rackTiles, discardedTile);
    if (!valid) {
      return { accepted: false, reason: "INVALID_GROUP" };
    }
  } else {
    // Same-tile validation: each rack tile must match the discarded tile (or be a Joker)
    for (const tileId of action.tileIds) {
      const tile = player.rack.find((t) => t.id === tileId)!;
      if (!tilesMatch(tile, discardedTile)) {
        return { accepted: false, reason: "TILE_MISMATCH" };
      }
    }
  }

  // 7. Mutate — record the call in the buffer
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

/**
 * Determine all valid call types a player can make given their rack and the discarded tile.
 * Pure function — no game state dependency beyond rack and discard.
 */
export function getValidCallOptions(rack: Tile[], discardedTile: Tile): CallType[] {
  const options: CallType[] = [];

  // Count same-tile matches (natural + Jokers)
  let naturalMatches = 0;
  let jokerCount = 0;
  for (const tile of rack) {
    if (tile.category === "joker") {
      jokerCount++;
    } else if (tilesMatch(tile, discardedTile)) {
      naturalMatches++;
    }
  }

  const totalMatches = naturalMatches + jokerCount;
  if (totalMatches >= 2) options.push("pung");
  if (totalMatches >= 3) options.push("kong");
  if (totalMatches >= 4) options.push("quint");

  // Pattern-defined: NEWS
  if (discardedTile.category === "wind") {
    const required = new Set<string>(WINDS);
    required.delete(discardedTile.value);
    for (const tile of rack) {
      if (tile.category === "wind" && required.has(tile.value)) {
        required.delete(tile.value);
      }
    }
    if (required.size <= jokerCount) {
      options.push("news");
    }
  }

  // Pattern-defined: Dragon set
  if (discardedTile.category === "dragon") {
    const required = new Set<string>(DRAGONS);
    required.delete(discardedTile.value);
    for (const tile of rack) {
      if (tile.category === "dragon" && required.has(tile.value)) {
        required.delete(tile.value);
      }
    }
    if (required.size <= jokerCount) {
      options.push("dragon_set");
    }
  }

  return options;
}
