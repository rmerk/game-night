import { MAX_PLAYERS, SEATS } from "../../constants";
import type {
  CharlestonPassAction,
  CharlestonVoteAction,
  CourtesyPassAction,
} from "../../types/actions";
import type {
  ActionResult,
  CharlestonDirection,
  CharlestonPairing,
  CharlestonStage,
  CharlestonStatus,
  CourtesySubmission,
  GameState,
  SeatWind,
} from "../../types/game-state";
import type { Tile } from "../../types/tiles";

type PassingCharlestonStage = Exclude<CharlestonStage, "courtesy">;

const PASS_ORDER_BY_STAGE: Record<PassingCharlestonStage, readonly CharlestonDirection[]> = {
  first: ["right", "across", "left"],
  second: ["left", "across", "right"],
};

const BLIND_PASS_DIRECTION_BY_STAGE: Record<PassingCharlestonStage, CharlestonDirection> = {
  first: "left",
  second: "right",
};

const COURTESY_PAIR_SEATS = [
  ["east", "west"],
  ["south", "north"],
] as const satisfies readonly (readonly [SeatWind, SeatWind])[];

function isPassingCharlestonStage(stage: CharlestonStage): stage is PassingCharlestonStage {
  return stage === "first" || stage === "second";
}

function getCharlestonState(state: GameState) {
  if (
    state.gamePhase !== "charleston" ||
    !state.charleston ||
    state.charleston.status !== "passing" ||
    !state.charleston.currentDirection ||
    !isPassingCharlestonStage(state.charleston.stage)
  ) {
    return null;
  }

  return state.charleston;
}

function getVoteReadyCharlestonState(state: GameState) {
  if (
    state.gamePhase !== "charleston" ||
    !state.charleston ||
    state.charleston.stage !== "second" ||
    state.charleston.status !== "vote-ready" ||
    state.charleston.currentDirection !== null
  ) {
    return null;
  }

  return state.charleston;
}

function getCourtesyReadyCharlestonState(state: GameState) {
  if (
    state.gamePhase !== "charleston" ||
    !state.charleston ||
    state.charleston.stage !== "courtesy" ||
    state.charleston.status !== "courtesy-ready" ||
    state.charleston.currentDirection !== null
  ) {
    return null;
  }

  return state.charleston;
}

function hasDuplicateTileIds(tileIds: readonly string[]): boolean {
  return new Set(tileIds).size !== tileIds.length;
}

function getCharlestonPassOrder(stage: PassingCharlestonStage): readonly CharlestonDirection[] {
  return PASS_ORDER_BY_STAGE[stage];
}

function getBlindPassDirection(stage: PassingCharlestonStage): CharlestonDirection {
  return BLIND_PASS_DIRECTION_BY_STAGE[stage];
}

function getNextDirection(
  stage: PassingCharlestonStage,
  direction: CharlestonDirection,
): CharlestonDirection | null {
  const order = getCharlestonPassOrder(stage);
  const directionIndex = order.indexOf(direction);
  if (directionIndex === -1) {
    throw new Error(
      `getNextDirection: direction '${direction}' is not valid for Charleston stage '${stage}'`,
    );
  }

  return order[directionIndex + 1] ?? null;
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
  if (!charleston) {
    return { accepted: false, reason: "WRONG_PHASE" };
  }

  const player = state.players[action.playerId];
  if (!player) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }

  if (!charleston.activePlayerIds.includes(action.playerId)) {
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

function resetVoteState(state: GameState): void {
  const charleston = state.charleston;
  if (!charleston) {
    return;
  }

  charleston.submittedPlayerIds = [];
  charleston.votesByPlayerId = {};
}

function getPlayerIdBySeat(state: GameState, seatWind: SeatWind): string {
  const player = Object.values(state.players).find((candidate) => candidate.seatWind === seatWind);
  if (!player) {
    throw new Error(`getPlayerIdBySeat: no player found for seat '${seatWind}'`);
  }

  return player.id;
}

function buildCourtesyPairings(state: GameState): CharlestonPairing[] {
  return COURTESY_PAIR_SEATS.map(([firstSeat, secondSeat]) => [
    getPlayerIdBySeat(state, firstSeat),
    getPlayerIdBySeat(state, secondSeat),
  ]);
}

function findCourtesyPairing(
  charleston: NonNullable<GameState["charleston"]>,
  playerId: string,
): CharlestonPairing | null {
  return charleston.courtesyPairings.find((pairing) => pairing.includes(playerId)) ?? null;
}

function pairingKey([firstPlayerId, secondPlayerId]: CharlestonPairing): string {
  return [firstPlayerId, secondPlayerId].sort().join(":");
}

function trimSelection(
  submission: CourtesySubmission,
  appliedCount: number,
): readonly string[] {
  if (appliedCount === 0) {
    return [];
  }

  return submission.tileIds.slice(0, appliedCount);
}

function isCourtesyPairResolved(
  charleston: NonNullable<GameState["charleston"]>,
  pairing: CharlestonPairing,
): boolean {
  const targetKey = pairingKey(pairing);
  return charleston.courtesyResolvedPairings.some(
    (resolvedPairing) => pairingKey(resolvedPairing) === targetKey,
  );
}

function clearCourtesySubmission(
  charleston: NonNullable<GameState["charleston"]>,
  playerId: string,
): void {
  delete charleston.courtesySubmissionsByPlayerId[playerId];
}

/** Shared setup when leaving a passing or vote round (clears hidden tiles, resets submissions). */
function transitionCharlestonPhase(
  state: GameState,
  params: {
    stage: CharlestonStage;
    status: CharlestonStatus;
    currentDirection: CharlestonDirection | null;
    courtesyPairings?: readonly CharlestonPairing[];
  },
): void {
  const charleston = state.charleston;
  if (!charleston) {
    throw new Error("transitionCharlestonPhase: no Charleston state");
  }

  charleston.stage = params.stage;
  charleston.status = params.status;
  charleston.currentDirection = params.currentDirection;
  charleston.hiddenAcrossTilesByPlayerId = {};
  charleston.courtesyPairings = params.courtesyPairings ?? [];
  resetPassingState(state);
  resetVoteState(state);
}

function transitionToSecondVoteReady(state: GameState): void {
  transitionCharlestonPhase(state, {
    stage: "second",
    status: "vote-ready",
    currentDirection: null,
  });
}

function transitionToSecondPassing(state: GameState): void {
  transitionCharlestonPhase(state, {
    stage: "second",
    status: "passing",
    currentDirection: "left",
  });
}

function transitionToCourtesyReady(state: GameState): void {
  transitionCharlestonPhase(state, {
    stage: "courtesy",
    status: "courtesy-ready",
    currentDirection: null,
    courtesyPairings: buildCourtesyPairings(state),
  });
}

function transitionCourtesyToPlay(state: GameState): void {
  state.gamePhase = "play";
  state.turnPhase = "discard";
  state.charleston = null;
}

function resolveCurrentDirection(state: GameState): ActionResult {
  const charleston = state.charleston;
  if (!charleston || !charleston.currentDirection || !isPassingCharlestonStage(charleston.stage)) {
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
  const nextDirection = getNextDirection(charleston.stage, direction);

  if (nextDirection) {
    charleston.currentDirection = nextDirection;
  } else if (charleston.stage === "first") {
    transitionToSecondVoteReady(state);
  } else {
    transitionToCourtesyReady(state);
  }

  return {
    accepted: true,
    resolved: {
      type: "CHARLESTON_PHASE_COMPLETE",
      direction,
      nextDirection: state.charleston?.currentDirection ?? null,
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

  const charleston = getCharlestonState(state)!;
  charleston.lockedTileIdsByPlayerId[action.playerId] = [...action.tileIds];
  charleston.submittedPlayerIds.push(action.playerId);

  if (
    isPassingCharlestonStage(charleston.stage) &&
    charleston.currentDirection === getBlindPassDirection(charleston.stage)
  ) {
    revealHiddenAcrossTiles(state, action.playerId);
  }

  if (charleston.submittedPlayerIds.length < MAX_PLAYERS) {
    return { accepted: true };
  }

  return resolveCurrentDirection(state);
}

function validateCourtesyPass(state: GameState, action: CourtesyPassAction): ActionResult | null {
  const charleston = getCourtesyReadyCharlestonState(state);
  if (!charleston) {
    return { accepted: false, reason: "WRONG_PHASE" };
  }

  const player = state.players[action.playerId];
  if (!player) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }

  const pairing = findCourtesyPairing(charleston, action.playerId);
  if (!pairing) {
    return { accepted: false, reason: "WRONG_PHASE" };
  }

  if (isCourtesyPairResolved(charleston, pairing)) {
    return { accepted: false, reason: "COURTESY_PAIR_ALREADY_RESOLVED" };
  }

  if (action.count < 0 || action.count > 3) {
    return { accepted: false, reason: "INVALID_COURTESY_COUNT" };
  }

  if (action.tileIds.length !== action.count) {
    return { accepted: false, reason: "COURTESY_TILE_COUNT_MISMATCH" };
  }

  if (hasDuplicateTileIds(action.tileIds)) {
    return { accepted: false, reason: "DUPLICATE_TILE_IDS" };
  }

  if (charleston.courtesySubmissionsByPlayerId[action.playerId]) {
    return { accepted: false, reason: "COURTESY_PASS_ALREADY_LOCKED" };
  }

  const visibleTileIds = new Set(player.rack.map((tile) => tile.id));
  if (action.tileIds.some((tileId) => !visibleTileIds.has(tileId))) {
    return { accepted: false, reason: "TILE_NOT_IN_RACK" };
  }

  return null;
}

function resolveCourtesyPair(
  state: GameState,
  pairing: CharlestonPairing,
  firstSubmission: CourtesySubmission,
  secondSubmission: CourtesySubmission,
): ActionResult {
  const [firstPlayerId, secondPlayerId] = pairing;
  const appliedCount = Math.min(firstSubmission.count, secondSubmission.count);
  const firstTrimmedTileIds = trimSelection(firstSubmission, appliedCount);
  const secondTrimmedTileIds = trimSelection(secondSubmission, appliedCount);
  const incomingTilesByPlayerId: Partial<Record<string, Tile[]>> = {};

  if (appliedCount > 0) {
    incomingTilesByPlayerId[firstPlayerId] = captureLockedTiles(state, secondPlayerId, secondTrimmedTileIds);
    incomingTilesByPlayerId[secondPlayerId] = captureLockedTiles(state, firstPlayerId, firstTrimmedTileIds);

    removeLockedTiles(state, firstPlayerId, firstTrimmedTileIds);
    removeLockedTiles(state, secondPlayerId, secondTrimmedTileIds);

    state.players[firstPlayerId].rack.push(...(incomingTilesByPlayerId[firstPlayerId] ?? []));
    state.players[secondPlayerId].rack.push(...(incomingTilesByPlayerId[secondPlayerId] ?? []));
  }

  const charleston = getCourtesyReadyCharlestonState(state);
  if (!charleston) {
    throw new Error("resolveCourtesyPair: courtesy state disappeared");
  }

  clearCourtesySubmission(charleston, firstPlayerId);
  clearCourtesySubmission(charleston, secondPlayerId);
  charleston.courtesyResolvedPairings = [...charleston.courtesyResolvedPairings, pairing];

  const entersPlay = charleston.courtesyResolvedPairings.length === charleston.courtesyPairings.length;
  if (entersPlay) {
    transitionCourtesyToPlay(state);
  }

  return {
    accepted: true,
    resolved: {
      type: "COURTESY_PAIR_RESOLVED",
      pairing,
      playerRequests: {
        [firstPlayerId]: firstSubmission.count,
        [secondPlayerId]: secondSubmission.count,
      },
      appliedCount,
      entersPlay,
    },
  };
}

export function handleCourtesyPass(state: GameState, action: CourtesyPassAction): ActionResult {
  const validationError = validateCourtesyPass(state, action);
  if (validationError) {
    return validationError;
  }

  const charleston = getCourtesyReadyCharlestonState(state)!;
  const pairing = findCourtesyPairing(charleston, action.playerId);
  if (!pairing) {
    throw new Error(`handleCourtesyPass: no courtesy pair found for player '${action.playerId}'`);
  }

  charleston.courtesySubmissionsByPlayerId[action.playerId] = {
    count: action.count,
    tileIds: [...action.tileIds],
  };

  const [firstPlayerId, secondPlayerId] = pairing;
  const firstSubmission = charleston.courtesySubmissionsByPlayerId[firstPlayerId];
  const secondSubmission = charleston.courtesySubmissionsByPlayerId[secondPlayerId];

  if (!firstSubmission || !secondSubmission) {
    return {
      accepted: true,
      resolved: {
        type: "COURTESY_PASS_LOCKED",
        playerId: action.playerId,
        pairing,
      },
    };
  }

  return resolveCourtesyPair(state, pairing, firstSubmission, secondSubmission);
}

function validateCharlestonVote(
  state: GameState,
  action: CharlestonVoteAction,
): ActionResult | null {
  const charleston = getVoteReadyCharlestonState(state);
  if (!charleston) {
    return { accepted: false, reason: "WRONG_PHASE" };
  }

  if (!state.players[action.playerId]) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }

  if (!charleston.activePlayerIds.includes(action.playerId)) {
    return { accepted: false, reason: "WRONG_PHASE" };
  }

  if (charleston.votesByPlayerId[action.playerId] !== undefined) {
    return { accepted: false, reason: "CHARLESTON_VOTE_ALREADY_CAST" };
  }

  return null;
}

export function handleCharlestonVote(state: GameState, action: CharlestonVoteAction): ActionResult {
  const validationError = validateCharlestonVote(state, action);
  if (validationError) {
    return validationError;
  }

  const charleston = getVoteReadyCharlestonState(state)!;
  charleston.votesByPlayerId[action.playerId] = action.accept;
  charleston.submittedPlayerIds.push(action.playerId);

  if (!action.accept) {
    transitionToCourtesyReady(state);
    const after = state.charleston!;
    return {
      accepted: true,
      resolved: {
        type: "CHARLESTON_VOTE_RESOLVED",
        outcome: "rejected",
        nextDirection: null,
        stage: after.stage,
        status: after.status,
      },
    };
  }

  const votesReceivedCount = charleston.submittedPlayerIds.length;
  if (votesReceivedCount < MAX_PLAYERS) {
    return {
      accepted: true,
      resolved: {
        type: "CHARLESTON_VOTE_CAST",
        votesReceivedCount,
      },
    };
  }

  transitionToSecondPassing(state);
  const after = state.charleston!;
  return {
    accepted: true,
    resolved: {
      type: "CHARLESTON_VOTE_RESOLVED",
      outcome: "accepted",
      nextDirection: after.currentDirection,
      stage: after.stage,
      status: after.status,
    },
  };
}
