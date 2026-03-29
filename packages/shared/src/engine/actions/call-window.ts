import type {
  GameState,
  ActionResult,
  CallType,
  CallRecord,
  SeatWind,
  GroupIdentity,
  ExposedGroup,
} from "../../types/game-state";
import type {
  PassCallAction,
  CallPungAction,
  CallKongAction,
  CallQuintAction,
  CallNewsAction,
  CallDragonSetAction,
  CallMahjongAction,
  ConfirmCallAction,
  RetractCallAction,
} from "../../types/actions";
import type { Tile } from "../../types/tiles";
import { MAX_PLAYERS, SEATS, WINDS, DRAGONS, DEFAULT_CALL_WINDOW_MS } from "../../constants";
import { confirmMahjongCall } from "./mahjong";

/** Confirmation timer duration in milliseconds (5 seconds) */
export const CONFIRMATION_TIMER_MS = 5000;

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
  if (state.callWindow.status === "frozen" || state.callWindow.status === "confirming") {
    return { accepted: false, reason: "CALL_WINDOW_FROZEN" };
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
  mahjong: 0, // Mahjong validation uses its own handler (story 3a-7)
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

/**
 * Handle CALL_MAHJONG action: record a mahjong call during the call window.
 * No tile validation at call time — hand validation happens at confirmation (story 3a-7).
 * Follows validate-then-mutate pattern.
 */
export function handleCallMahjong(state: GameState, action: CallMahjongAction): ActionResult {
  // 1. Validate call window state
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }
  if (state.callWindow.status === "confirming") {
    return { accepted: false, reason: "CALL_WINDOW_CONFIRMING" };
  }
  if (state.callWindow.status !== "open" && state.callWindow.status !== "frozen") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_OPEN" };
  }
  if (state.callWindow.discarderId === action.playerId) {
    return { accepted: false, reason: "DISCARDER_CANNOT_CALL" };
  }
  if (state.callWindow.passes.includes(action.playerId)) {
    return { accepted: false, reason: "ALREADY_PASSED" };
  }
  if (state.callWindow.calls.some((c) => c.playerId === action.playerId)) {
    return { accepted: false, reason: "ALREADY_CALLED" };
  }

  // Dead hand check — dead hand players cannot call mahjong
  const mahjongPlayer = state.players[action.playerId];
  if (mahjongPlayer?.deadHand) {
    return { accepted: false, reason: "DEAD_HAND_CANNOT_CALL" };
  }

  // 2. Mutate — record the mahjong call (tileIds stored for reference but not validated here)
  const shouldFreeze = state.callWindow.status === "open";

  state.callWindow.calls.push({
    callType: "mahjong",
    playerId: action.playerId,
    tileIds: [...action.tileIds],
  });

  if (shouldFreeze) {
    state.callWindow.status = "frozen";
    return {
      accepted: true,
      resolved: { type: "CALL_WINDOW_FROZEN", callerId: action.playerId },
    };
  }

  return {
    accepted: true,
    resolved: { type: "CALL_MAHJONG", playerId: action.playerId },
  };
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

  // 1. Validate call window state
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }
  if (state.callWindow.status === "confirming") {
    return { accepted: false, reason: "CALL_WINDOW_CONFIRMING" };
  }
  if (state.callWindow.status !== "open" && state.callWindow.status !== "frozen") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_OPEN" };
  }
  if (state.callWindow.discarderId === action.playerId) {
    return { accepted: false, reason: "DISCARDER_CANNOT_CALL" };
  }
  if (state.callWindow.passes.includes(action.playerId)) {
    return { accepted: false, reason: "ALREADY_PASSED" };
  }
  if (state.callWindow.calls.some((c) => c.playerId === action.playerId)) {
    return { accepted: false, reason: "ALREADY_CALLED" };
  }

  // 2. Validate player exists and is not dead hand
  const player = state.players[action.playerId];
  if (!player) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }
  if (player.deadHand) {
    return { accepted: false, reason: "DEAD_HAND_CANNOT_CALL" };
  }

  // 3. Validate no duplicate tile IDs
  if (new Set(action.tileIds).size !== action.tileIds.length) {
    return { accepted: false, reason: "DUPLICATE_TILE_IDS" };
  }

  // 4. Validate pair rejection: total group size (rack tiles + discarded) must be >= 3
  if (action.tileIds.length + 1 === 2) {
    return { accepted: false, reason: "CANNOT_CALL_FOR_PAIR" };
  }

  // 5. Validate tile count from rack matches expected
  if (action.tileIds.length !== requiredFromRack) {
    return { accepted: false, reason: "INSUFFICIENT_TILES" };
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
  const shouldFreeze = state.callWindow.status === "open";

  state.callWindow.calls.push({
    callType,
    playerId: action.playerId,
    tileIds: [...action.tileIds],
  });

  // Freeze the window on the first call
  if (shouldFreeze) {
    state.callWindow.status = "frozen";
    return {
      accepted: true,
      resolved: { type: "CALL_WINDOW_FROZEN", callerId: action.playerId },
    };
  }

  // In-flight call accepted while frozen — return the call type resolved action
  return {
    accepted: true,
    resolved: { type: action.type, playerId: action.playerId },
  };
}

/**
 * Close the call window and advance the turn to the next player counterclockwise
 * from the discarder. If calls are pending, routes to resolveCallWindow instead.
 * If the wall is empty and no calls were made, end as wall game.
 */
export function closeCallWindow(
  state: GameState,
  reason: "all_passed" | "timer_expired",
): ActionResult {
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }

  // If there are pending calls, resolve them instead of closing
  if (state.callWindow.calls.length > 0) {
    return resolveCallWindow(state);
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
  if (!discarder) {
    state.callWindow = null;
    return { accepted: false, reason: "DISCARDER_NOT_FOUND" };
  }
  const discarderSeatIndex = SEATS.indexOf(discarder.seatWind);
  const nextSeatWind = SEATS[(discarderSeatIndex + 1) % SEATS.length];

  const nextPlayer = Object.values(state.players).find((p) => p.seatWind === nextSeatWind);
  if (!nextPlayer) {
    state.callWindow = null;
    return { accepted: false, reason: "NEXT_PLAYER_NOT_FOUND" };
  }
  state.currentTurn = nextPlayer.id;
  state.turnPhase = "draw";

  return {
    accepted: true,
    resolved: { type: "CALL_WINDOW_CLOSED", reason },
  };
}

/**
 * Calculate counterclockwise seat distance from one seat to another.
 * Uses SEATS constant (counterclockwise order). Returns 1-3 (0 = same seat, invalid).
 */
export function getSeatDistance(fromSeat: SeatWind, toSeat: SeatWind): number {
  const fromIndex = SEATS.indexOf(fromSeat);
  const toIndex = SEATS.indexOf(toSeat);
  return (toIndex - fromIndex + SEATS.length) % SEATS.length;
}

/**
 * Sort buffered calls by priority: Mahjong first, then by counterclockwise seat distance
 * from the discarder (lower distance = higher priority).
 * Returns a new sorted array (does not mutate input).
 */
export function resolveCallPriority(
  calls: readonly CallRecord[],
  discarderSeatWind: SeatWind,
  players: Record<string, { seatWind: SeatWind }>,
): CallRecord[] {
  return [...calls].sort((a, b) => {
    const aMahjong = a.callType === "mahjong" ? 0 : 1;
    const bMahjong = b.callType === "mahjong" ? 0 : 1;
    if (aMahjong !== bMahjong) return aMahjong - bMahjong;

    const aDist = getSeatDistance(discarderSeatWind, players[a.playerId].seatWind);
    const bDist = getSeatDistance(discarderSeatWind, players[b.playerId].seatWind);
    return aDist - bDist;
  });
}

/**
 * Resolve the call window: determine the winning call from buffered calls using priority rules.
 * Returns the winning CallRecord in CALL_RESOLVED. Losing calls are silently discarded.
 *
 * Intentionally leaves callWindow non-null after resolution (status remains "frozen", calls
 * array emptied). Story 3a-5 needs the window alive to enter the confirmation phase for the
 * winning caller. The window is cleared later when confirmation completes or is retracted.
 */
export function resolveCallWindow(state: GameState): ActionResult {
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }
  if (state.callWindow.status !== "frozen") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_FROZEN" };
  }
  if (state.callWindow.calls.length === 0) {
    return { accepted: false, reason: "NO_CALLS_TO_RESOLVE" };
  }

  const discarder = state.players[state.callWindow.discarderId];
  if (!discarder)
    throw new Error(
      `resolveCallWindow: no player found for discarderId '${state.callWindow.discarderId}'`,
    );

  const sorted = resolveCallPriority(state.callWindow.calls, discarder.seatWind, state.players);
  const winningCall = sorted[0];
  const remainingCallers = sorted.slice(1);

  // Clear the call buffer — losing calls stored in remainingCallers for retraction fallback
  state.callWindow.calls.length = 0;

  // Enter confirmation phase for the winning caller
  return enterConfirmationPhase(state, winningCall, remainingCallers);
}

/**
 * Determine all valid call types a player can make given their rack and the discarded tile.
 * Pure function — no game state dependency beyond rack and discard.
 *
 * NOTE: Options are individually valid but mutually exclusive — the player will choose
 * exactly one call. Jokers in the rack are counted for each call-type path independently
 * because the same Jokers could serve different roles depending on which call is chosen.
 * For example, with 3 Jokers and a wind discard, both "kong" and "news" may appear;
 * the player picks one, and the Jokers are committed to that single call.
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

/**
 * Enter the confirmation phase for the winning caller.
 * Sets callWindow status to "confirming", stores the winning call and remaining callers.
 */
export function enterConfirmationPhase(
  state: GameState,
  winningCall: CallRecord,
  remainingCallers: CallRecord[],
): ActionResult {
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }

  state.callWindow.status = "confirming";
  state.callWindow.confirmingPlayerId = winningCall.playerId;
  state.callWindow.confirmationExpiresAt = Date.now() + CONFIRMATION_TIMER_MS;
  state.callWindow.remainingCallers = remainingCallers;
  state.callWindow.winningCall = winningCall;

  return {
    accepted: true,
    resolved: {
      type: "CALL_CONFIRMATION_STARTED",
      callerId: winningCall.playerId,
      callType: winningCall.callType,
      timerDuration: CONFIRMATION_TIMER_MS,
    },
  };
}

/**
 * Build a GroupIdentity from the discarded tile and call type.
 * Identity is fixed at exposure time and never changes (FR55).
 */
function buildGroupIdentity(discardedTile: Tile, callType: CallType): GroupIdentity {
  if (callType === "news") {
    return { type: "news" };
  }
  if (callType === "dragon_set") {
    return { type: "dragon_set" };
  }

  // Same-tile groups: identity from the discarded tile
  const base: GroupIdentity = { type: callType as unknown as GroupIdentity["type"] };
  switch (discardedTile.category) {
    case "suited":
      return { ...base, suit: discardedTile.suit, value: discardedTile.value };
    case "wind":
      return { ...base, wind: discardedTile.value };
    case "dragon":
      return { ...base, dragon: discardedTile.value };
    default:
      return base;
  }
}

/**
 * Validate that the provided tile IDs form a valid group with the discarded tile
 * for the given call type. Returns true if valid.
 */
function validateConfirmationGroup(
  rackTiles: Tile[],
  discardedTile: Tile,
  callType: CallType,
): boolean {
  if (callType === "news") {
    return validateNewsGroup(rackTiles, discardedTile);
  }
  if (callType === "dragon_set") {
    return validateDragonSetGroup(rackTiles, discardedTile);
  }
  // Same-tile group: all rack tiles must match the discarded tile
  return rackTiles.every((tile) => tilesMatch(tile, discardedTile));
}

/**
 * Internal retraction logic shared by explicit retract, invalid confirmation, and timeout.
 * Promotes next caller or reopens/closes the window.
 */
export function handleRetraction(state: GameState, reason: string): ActionResult {
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }

  const retractedCallerId = state.callWindow.confirmingPlayerId!;

  // Check for remaining callers to promote
  if (state.callWindow.remainingCallers.length > 0) {
    const nextCaller = state.callWindow.remainingCallers[0];
    const updatedRemaining = state.callWindow.remainingCallers.slice(1);

    // Enter confirmation phase for the next caller
    state.callWindow.confirmingPlayerId = nextCaller.playerId;
    state.callWindow.confirmationExpiresAt = Date.now() + CONFIRMATION_TIMER_MS;
    state.callWindow.remainingCallers = updatedRemaining;
    state.callWindow.winningCall = nextCaller;

    return {
      accepted: true,
      resolved: {
        type: "CALL_RETRACTED",
        callerId: retractedCallerId,
        reason,
        nextCallerId: nextCaller.playerId,
      },
    };
  }

  // No remaining callers — check if time remains to reopen the window
  const elapsed = Date.now() - state.callWindow.openedAt;
  const remaining = DEFAULT_CALL_WINDOW_MS - elapsed;

  if (remaining > 0) {
    // Reopen the window
    state.callWindow.status = "open";
    state.callWindow.confirmingPlayerId = null;
    state.callWindow.confirmationExpiresAt = null;
    state.callWindow.remainingCallers = [];
    state.callWindow.winningCall = null;

    return {
      accepted: true,
      resolved: {
        type: "CALL_WINDOW_RESUMED",
        remainingTime: remaining,
      },
    };
  }

  // No time remaining — close the window and advance turn
  return closeCallWindow(state, "timer_expired");
}

/**
 * Handle CONFIRM_CALL action: validate the confirming player and their tile selection,
 * then create the exposed group and advance the turn to the caller.
 * If tiles don't form a valid group, auto-retracts the call (no penalty).
 * For mahjong calls, delegates to confirmMahjongCall for hand validation and scoring.
 * Follows validate-then-mutate pattern.
 */
export function handleConfirmCall(state: GameState, action: ConfirmCallAction): ActionResult {
  // 1. Validate confirmation phase
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (!state.callWindow || state.callWindow.status !== "confirming") {
    return { accepted: false, reason: "NO_CONFIRMATION_PHASE" };
  }
  if (action.playerId !== state.callWindow.confirmingPlayerId) {
    return { accepted: false, reason: "NOT_CONFIRMING_PLAYER" };
  }

  const winningCall = state.callWindow.winningCall!;

  // --- Mahjong confirmation path (no exposed group creation) ---
  if (winningCall.callType === "mahjong") {
    // For mahjong, tileIds from CONFIRM_CALL are ignored — the full hand is validated
    const mahjongResult = confirmMahjongCall(
      state,
      action.playerId,
      state.callWindow.discarderId,
      state.callWindow.discardedTile.id,
    );
    if (!mahjongResult.accepted) {
      // Hard rejection (not warning) — auto-retract, promote next caller or reopen window
      return handleRetraction(state, mahjongResult.reason ?? "INVALID_HAND");
    }
    // If result is INVALID_MAHJONG_WARNING, return directly (no retraction — cancel/confirm flow)
    // If result is MAHJONG_DECLARED, return directly (valid mahjong)
    return mahjongResult;
  }

  // --- Non-mahjong confirmation path (pung/kong/quint/news/dragon_set) ---

  // 2. Validate no duplicate tile IDs
  if (new Set(action.tileIds).size !== action.tileIds.length) {
    return { accepted: false, reason: "DUPLICATE_TILE_IDS" };
  }

  // 3. Validate tile IDs exist in caller's rack
  const player = state.players[action.playerId];
  if (!player) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }
  for (const tileId of action.tileIds) {
    if (!player.rack.find((t) => t.id === tileId)) {
      return { accepted: false, reason: "TILE_NOT_IN_RACK" };
    }
  }

  // 4. Validate tile count matches expected for the call type
  const expectedFromRack = REQUIRED_FROM_RACK[winningCall.callType];
  if (action.tileIds.length !== expectedFromRack) {
    // Wrong tile count — auto-retract
    return handleRetraction(state, "INVALID_GROUP");
  }

  // 5. Validate the group is valid
  const rackTiles = action.tileIds.map((id) => player.rack.find((t) => t.id === id)!);
  const discardedTile = state.callWindow.discardedTile;

  if (!validateConfirmationGroup(rackTiles, discardedTile, winningCall.callType)) {
    // Invalid group — auto-retract
    return handleRetraction(state, "INVALID_GROUP");
  }

  // 6. Mutate — create exposed group
  const discarder = state.players[state.callWindow.discarderId];
  const discardIdx = discarder.discardPool.findIndex((t) => t.id === discardedTile.id);
  if (discardIdx !== -1) {
    discarder.discardPool.splice(discardIdx, 1);
  }

  // Remove tiles from caller's rack
  for (const tileId of action.tileIds) {
    const idx = player.rack.findIndex((t) => t.id === tileId);
    if (idx !== -1) {
      player.rack.splice(idx, 1);
    }
  }

  // Build exposed group
  const groupIdentity = buildGroupIdentity(discardedTile, winningCall.callType);
  const exposedGroup: ExposedGroup = {
    type: winningCall.callType as ExposedGroup["type"],
    tiles: [discardedTile, ...rackTiles],
    identity: groupIdentity,
  };
  player.exposedGroups.push(exposedGroup);

  // 7. Update turn state
  const callerId = action.playerId;
  const fromPlayerId = state.callWindow.discarderId;

  // Clear call window
  state.callWindow = null;

  // Non-Mahjong: caller must discard next
  state.currentTurn = callerId;
  state.turnPhase = "discard";

  // 8. Return result
  return {
    accepted: true,
    resolved: {
      type: "CALL_CONFIRMED",
      callerId,
      callType: winningCall.callType,
      exposedTileIds: [discardedTile.id, ...action.tileIds],
      calledTileId: discardedTile.id,
      fromPlayerId,
      groupIdentity,
    },
  };
}

/**
 * Handle RETRACT_CALL action: validate the confirming player, then retract their call.
 * If other callers remain, the next highest-priority caller enters confirmation.
 * If no callers remain, the call window reopens or closes.
 * Follows validate-then-mutate pattern.
 */
export function handleRetractCall(state: GameState, action: RetractCallAction): ActionResult {
  // 1. Validate
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (!state.callWindow || state.callWindow.status !== "confirming") {
    return { accepted: false, reason: "NO_CONFIRMATION_PHASE" };
  }
  if (action.playerId !== state.callWindow.confirmingPlayerId) {
    return { accepted: false, reason: "NOT_CONFIRMING_PLAYER" };
  }

  // 2. Delegate to shared retraction logic
  return handleRetraction(state, "PLAYER_RETRACTED");
}

/**
 * Handle confirmation timeout: auto-retracts the call on the player's behalf.
 * Called by the server when the 5-second confirmation timer expires.
 * No setTimeout in shared/ — the server is responsible for scheduling.
 */
export function handleConfirmationTimeout(state: GameState): ActionResult {
  if (!state.callWindow || state.callWindow.status !== "confirming") {
    return { accepted: false, reason: "NO_CONFIRMATION_PHASE" };
  }

  return handleRetraction(state, "CONFIRMATION_TIMEOUT");
}
