import { WebSocket } from "ws";
import type {
  GameState,
  ResolvedAction,
  PlayerGameView,
  SpectatorGameView,
  StateUpdateMessage,
  LobbyState,
} from "@mahjong-game/shared";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";

/**
 * Build a per-player filtered view of the game state.
 * Each player sees only their own rack — opponent racks are never transmitted.
 */
export function buildPlayerView(
  room: Room,
  gameState: GameState,
  playerId: string,
): PlayerGameView {
  const players = Array.from(room.players.values()).map((p) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    wind: p.wind,
    isHost: p.isHost,
    connected: p.connected,
  }));

  const playerState = gameState.players[playerId];
  if (!playerState) {
    room.logger.warn(
      { playerId, roomCode: room.roomCode },
      "buildPlayerView: player not found in gameState",
    );
  }

  // Per-player exposed groups — all players' groups are public
  const exposedGroups: Record<string, typeof playerState.exposedGroups> = {};
  for (const [pid, ps] of Object.entries(gameState.players)) {
    exposedGroups[pid] = ps.exposedGroups;
  }

  // Per-player discard pools — all are public
  const discardPools: Record<string, typeof playerState.discardPool> = {};
  for (const [pid, ps] of Object.entries(gameState.players)) {
    discardPools[pid] = ps.discardPool;
  }

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
    shownHands: gameState.shownHands,
  };
}

/**
 * Build a spectator view with public information only — no player racks.
 */
export function buildSpectatorView(room: Room, gameState: GameState): SpectatorGameView {
  const players = Array.from(room.players.values()).map((p) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    wind: p.wind,
    isHost: p.isHost,
    connected: p.connected,
  }));

  const exposedGroups: Record<string, (typeof gameState.players)[string]["exposedGroups"]> = {};
  for (const [pid, ps] of Object.entries(gameState.players)) {
    exposedGroups[pid] = ps.exposedGroups;
  }

  const discardPools: Record<string, (typeof gameState.players)[string]["discardPool"]> = {};
  for (const [pid, ps] of Object.entries(gameState.players)) {
    discardPools[pid] = ps.discardPool;
  }

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
    shownHands: gameState.shownHands,
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

    const view = buildPlayerView(room, gameState, session.player.playerId);
    const message: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: view,
      resolvedAction,
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
    const players = Array.from(room.players.values()).map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      wind: p.wind,
      isHost: p.isHost,
      connected: p.connected,
    }));
    state = {
      roomId: room.roomId,
      roomCode: room.roomCode,
      gamePhase: "lobby" as const,
      players,
      myPlayerId: playerId,
    };
  }

  const message: StateUpdateMessage = {
    version: PROTOCOL_VERSION,
    type: "STATE_UPDATE",
    state,
  };
  ws.send(JSON.stringify(message));
}
