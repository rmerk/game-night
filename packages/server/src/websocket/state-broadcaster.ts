import { WebSocket } from "ws";
import type {
  GameState,
  ResolvedAction,
  PlayerGameView,
  PublicCharlestonView,
  SpectatorGameView,
  StateUpdateMessage,
  LobbyState,
} from "@mahjong-game/shared";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { PlayerInfo, Room } from "../rooms/room";

/**
 * Per UX-DR35, dead-hand sanctions must not identify the affected player to other clients.
 * Omit resolvedAction for viewers who are not the subject of these payloads.
 */
function resolvedActionForViewer(
  resolvedAction: ResolvedAction | undefined,
  viewerId: string,
): ResolvedAction | undefined {
  if (!resolvedAction) return undefined;
  if (
    resolvedAction.type === "DEAD_HAND_ENFORCED" ||
    resolvedAction.type === "INVALID_MAHJONG_WARNING"
  ) {
    if (resolvedAction.playerId !== viewerId) {
      return undefined;
    }
  }
  return resolvedAction;
}

type RoomPlayerPublic = Pick<
  PlayerInfo,
  "playerId" | "displayName" | "wind" | "isHost" | "connected"
>;

function mapRoomPlayersPublic(room: Room): RoomPlayerPublic[] {
  return Array.from(room.players.values()).map((p) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    wind: p.wind,
    isHost: p.isHost,
    connected: p.connected,
  }));
}

function publicCharlestonFromState(
  charleston: NonNullable<GameState["charleston"]>,
): PublicCharlestonView {
  const submittedPlayerIds =
    charleston.status === "vote-ready" ? [] : [...charleston.submittedPlayerIds];

  return {
    stage: charleston.stage,
    status: charleston.status,
    currentDirection: charleston.currentDirection,
    activePlayerIds: [...charleston.activePlayerIds],
    submittedPlayerIds,
    votesReceivedCount: Object.keys(charleston.votesByPlayerId).length,
    courtesyPairings: charleston.courtesyPairings.map(
      ([firstPlayerId, secondPlayerId]) => [firstPlayerId, secondPlayerId] as const,
    ),
    courtesyResolvedPairCount: charleston.courtesyResolvedPairings.length,
  };
}

function buildPublicCharlestonView(gameState: GameState): PublicCharlestonView | null {
  const charleston = gameState.charleston;
  return charleston ? publicCharlestonFromState(charleston) : null;
}

/**
 * Build a per-player filtered view of the game state.
 * Each player sees only their own rack — opponent racks are never transmitted.
 */
export function buildPlayerView(
  room: Room,
  gameState: GameState,
  playerId: string,
): PlayerGameView {
  const players = mapRoomPlayersPublic(room);

  const playerState = gameState.players[playerId];
  if (!playerState) {
    room.logger.warn(
      { playerId, roomCode: room.roomCode },
      "buildPlayerView: player not found in gameState",
    );
  }

  const exposedGroups: Record<string, (typeof gameState.players)[string]["exposedGroups"]> = {};
  const discardPools: Record<string, (typeof gameState.players)[string]["discardPool"]> = {};
  for (const [pid, ps] of Object.entries(gameState.players)) {
    exposedGroups[pid] = ps.exposedGroups;
    discardPools[pid] = ps.discardPool;
  }

  const publicCharleston = buildPublicCharlestonView(gameState);
  const courtesySubmission = gameState.charleston?.courtesySubmissionsByPlayerId[playerId];
  const charleston =
    publicCharleston === null
      ? null
      : {
          ...publicCharleston,
          myHiddenTileCount:
            gameState.charleston!.hiddenAcrossTilesByPlayerId[playerId]?.length ?? 0,
          mySubmissionLocked:
            gameState.charleston!.submittedPlayerIds.includes(playerId) ||
            courtesySubmission !== undefined,
          myVote: gameState.charleston!.votesByPlayerId[playerId] ?? null,
          myCourtesySubmission: courtesySubmission
            ? {
                count: courtesySubmission.count,
                tileIds: [...courtesySubmission.tileIds],
              }
            : null,
        };

  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    gamePhase: gameState.gamePhase,
    players,
    myPlayerId: playerId,
    myRack: playerState ? playerState.rack : [],
    exposedGroups,
    discardPools,
    wallRemaining: gameState.wallRemaining,
    currentTurn: gameState.currentTurn,
    turnPhase: gameState.turnPhase,
    callWindow: gameState.callWindow,
    scores: gameState.scores,
    lastDiscard: gameState.lastDiscard,
    gameResult: gameState.gameResult,
    pendingMahjong: gameState.pendingMahjong,
    challengeState: gameState.challengeState,
    socialOverrideState: gameState.socialOverrideState,
    charleston,
    shownHands: gameState.shownHands,
    jokerRulesMode: gameState.jokerRulesMode,
    myDeadHand: playerState?.deadHand ?? false,
    ...(room.players.get(playerId)?.isHost ? { hostAuditLog: [...gameState.hostAuditLog] } : {}),
  };
}

/**
 * Build a spectator view with public information only — no player racks.
 */
export function buildSpectatorView(room: Room, gameState: GameState): SpectatorGameView {
  const players = mapRoomPlayersPublic(room);

  const exposedGroups: Record<string, (typeof gameState.players)[string]["exposedGroups"]> = {};
  const discardPools: Record<string, (typeof gameState.players)[string]["discardPool"]> = {};
  for (const [pid, ps] of Object.entries(gameState.players)) {
    exposedGroups[pid] = ps.exposedGroups;
    discardPools[pid] = ps.discardPool;
  }

  const charleston = buildPublicCharlestonView(gameState);

  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    gamePhase: gameState.gamePhase,
    players,
    exposedGroups,
    discardPools,
    wallRemaining: gameState.wallRemaining,
    currentTurn: gameState.currentTurn,
    turnPhase: gameState.turnPhase,
    callWindow: gameState.callWindow,
    scores: gameState.scores,
    lastDiscard: gameState.lastDiscard,
    gameResult: gameState.gameResult,
    socialOverrideState: gameState.socialOverrideState,
    charleston,
    shownHands: gameState.shownHands,
    jokerRulesMode: gameState.jokerRulesMode,
  };
}

/**
 * Broadcast game state to all connected players in the room.
 * Each player receives their own filtered view (only their rack visible).
 */
export function broadcastGameState(
  room: Room,
  gameState: GameState,
  resolvedAction?: ResolvedAction,
): void {
  for (const session of room.sessions.values()) {
    if (session.ws.readyState !== WebSocket.OPEN) continue;

    const viewerId = session.player.playerId;
    const view = buildPlayerView(room, gameState, viewerId);
    const message: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: view,
      resolvedAction: resolvedActionForViewer(resolvedAction, viewerId),
    };
    session.ws.send(JSON.stringify(message));
  }
}

/**
 * Send the current state to a single player (for resync).
 * Sends lobby state if no game is active, or filtered game view if game is in progress.
 */
export function sendCurrentState(room: Room, playerId: string, ws: WebSocket): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  let state: LobbyState | PlayerGameView;
  if (room.gameState) {
    state = buildPlayerView(room, room.gameState, playerId);
  } else {
    const players = mapRoomPlayersPublic(room);
    state = {
      roomId: room.roomId,
      roomCode: room.roomCode,
      gamePhase: "lobby" as const,
      players,
      myPlayerId: playerId,
      jokerRulesMode: room.jokerRulesMode,
    };
  }

  const message: StateUpdateMessage = {
    version: PROTOCOL_VERSION,
    type: "STATE_UPDATE",
    state,
  };
  ws.send(JSON.stringify(message));
}
