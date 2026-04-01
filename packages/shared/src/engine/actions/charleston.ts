import { MAX_PLAYERS, SEATS } from "../../constants";
import type { CharlestonPassAction } from "../../types/actions";
import type {
  ActionResult,
  CharlestonDirection,
  GameState,
  SeatWind,
} from "../../types/game-state";
import type { Tile } from "../../types/tiles";

function getCharlestonState(state: GameState) {
  if (
    state.gamePhase !== "charleston" ||
    !state.charleston ||
    state.charleston.status !== "passing"
  ) {
    return null;
  }

  return state.charleston;
}

function hasDuplicateTileIds(tileIds: readonly string[]): boolean {
  return new Set(tileIds).size !== tileIds.length;
}

export function getCharlestonTargetSeat(
  seatWind: SeatWind,
  direction: CharlestonDirection,
): SeatWind {
  const seatIndex = SEATS.indexOf(seatWind);

  switch (direction) {
    case "right":
      return SEATS[(seatIndex + 1) % SEATS.length];
    case "across":
      return SEATS[(seatIndex + 2) % SEATS.length];
    case "left":
      return SEATS[(seatIndex - 1 + SEATS.length) % SEATS.length];
  }
}

export function getCharlestonTargetPlayerId(
  state: GameState,
  playerId: string,
  direction: CharlestonDirection,
): string {
  const player = state.players[playerId];
  if (!player) {
    throw new Error(`getCharlestonTargetPlayerId: no player found for id '${playerId}'`);
  }

  const targetSeat = getCharlestonTargetSeat(player.seatWind, direction);
  const targetPlayer = Object.values(state.players).find(
    (candidate) => candidate.seatWind === targetSeat,
  );
  if (!targetPlayer) {
    throw new Error(`getCharlestonTargetPlayerId: no player found for seat '${targetSeat}'`);
  }

  return targetPlayer.id;
}

function validateCharlestonPass(
  state: GameState,
  action: CharlestonPassAction,
): ActionResult | null {
  const charleston = getCharlestonState(state);
  if (
    !charleston ||
    !charleston.currentDirection ||
    !charleston.activePlayerIds.includes(action.playerId)
  ) {
    return { accepted: false, reason: "WRONG_PHASE" };
  }

  if (action.tileIds.length !== 3) {
    return { accepted: false, reason: "MUST_PASS_THREE_TILES" };
  }

  if (hasDuplicateTileIds(action.tileIds)) {
    return { accepted: false, reason: "DUPLICATE_TILE_IDS" };
  }

  if (charleston.submittedPlayerIds.includes(action.playerId)) {
    return { accepted: false, reason: "CHARLESTON_PASS_ALREADY_LOCKED" };
  }

  const player = state.players[action.playerId];
  if (!player) {
    throw new Error(`handleCharlestonPass: no player found for id '${action.playerId}'`);
  }

  const visibleTileIds = new Set(player.rack.map((tile) => tile.id));
  if (action.tileIds.some((tileId) => !visibleTileIds.has(tileId))) {
    return { accepted: false, reason: "TILE_NOT_IN_RACK" };
  }

  return null;
}

function revealHiddenAcrossTiles(state: GameState, playerId: string): void {
  const charleston = state.charleston;
  if (!charleston) {
    return;
  }

  const hiddenTiles = charleston.hiddenAcrossTilesByPlayerId[playerId];
  if (!hiddenTiles || hiddenTiles.length === 0) {
    return;
  }

  state.players[playerId].rack.push(...hiddenTiles);
  delete charleston.hiddenAcrossTilesByPlayerId[playerId];
}

function captureLockedTiles(
  state: GameState,
  playerId: string,
  tileIds: readonly string[],
): Tile[] {
  return tileIds.map((tileId) => {
    const tile = state.players[playerId].rack.find((candidate) => candidate.id === tileId);
    if (!tile) {
      throw new Error(
        `captureLockedTiles: tile '${tileId}' missing from player '${playerId}' rack`,
      );
    }

    return tile;
  });
}

function removeLockedTiles(state: GameState, playerId: string, tileIds: readonly string[]): void {
  const lockedTileIds = new Set(tileIds);
  const rack = state.players[playerId].rack;
  for (let index = rack.length - 1; index >= 0; index--) {
    if (lockedTileIds.has(rack[index].id)) {
      rack.splice(index, 1);
    }
  }
}

function resetPassingState(state: GameState): void {
  const charleston = state.charleston;
  if (!charleston) {
    return;
  }

  charleston.submittedPlayerIds = [];
  charleston.lockedTileIdsByPlayerId = {};
}

function resolveCurrentDirection(state: GameState): ActionResult {
  const charleston = state.charleston;
  if (!charleston || !charleston.currentDirection) {
    throw new Error("resolveCurrentDirection: no active Charleston direction");
  }

  const direction = charleston.currentDirection;
  const transfersByRecipientId: Record<string, Tile[]> = {};

  for (const senderPlayerId of charleston.activePlayerIds) {
    const lockedTileIds = charleston.lockedTileIdsByPlayerId[senderPlayerId];
    if (!lockedTileIds) {
      throw new Error(`resolveCurrentDirection: missing locked tiles for '${senderPlayerId}'`);
    }

    const targetPlayerId = getCharlestonTargetPlayerId(state, senderPlayerId, direction);
    transfersByRecipientId[targetPlayerId] = captureLockedTiles(
      state,
      senderPlayerId,
      lockedTileIds,
    );
  }

  for (const senderPlayerId of charleston.activePlayerIds) {
    removeLockedTiles(state, senderPlayerId, charleston.lockedTileIdsByPlayerId[senderPlayerId]!);
  }

  if (direction === "across") {
    charleston.hiddenAcrossTilesByPlayerId = transfersByRecipientId;
  } else {
    for (const recipientPlayerId of charleston.activePlayerIds) {
      state.players[recipientPlayerId].rack.push(
        ...(transfersByRecipientId[recipientPlayerId] ?? []),
      );
    }
  }

  resetPassingState(state);

  switch (direction) {
    case "right":
      charleston.currentDirection = "across";
      break;
    case "across":
      charleston.currentDirection = "left";
      break;
    case "left":
      charleston.stage = "second";
      charleston.status = "vote-ready";
      charleston.currentDirection = null;
      charleston.hiddenAcrossTilesByPlayerId = {};
      break;
  }

  return {
    accepted: true,
    resolved: {
      type: "CHARLESTON_PHASE_COMPLETE",
      direction,
      nextDirection: charleston.currentDirection,
      stage: charleston.stage,
      status: charleston.status,
    },
  };
}

export function handleCharlestonPass(state: GameState, action: CharlestonPassAction): ActionResult {
  const validationError = validateCharlestonPass(state, action);
  if (validationError) {
    return validationError;
  }

  const charleston = state.charleston!;
  charleston.lockedTileIdsByPlayerId[action.playerId] = [...action.tileIds];
  charleston.submittedPlayerIds.push(action.playerId);

  if (charleston.currentDirection === "left") {
    revealHiddenAcrossTiles(state, action.playerId);
  }

  if (charleston.submittedPlayerIds.length < MAX_PLAYERS) {
    return { accepted: true };
  }

  return resolveCurrentDirection(state);
}
