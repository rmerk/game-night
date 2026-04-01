import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import type { RoomManager } from "../rooms/room-manager";
import type { PlayerPublicInfo, LobbyState, StateUpdateMessage } from "@mahjong-game/shared";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { assignNextSeat } from "../rooms/seat-assignment";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";
import { createSessionToken, resolveToken, getGracePeriodMs } from "../rooms/session-manager";
import { startLifecycleTimer, cancelLifecycleTimer } from "../rooms/room-lifecycle";
import { buildPlayerView } from "./state-broadcaster";

// eslint-disable-next-line no-control-regex -- intentional: strip control characters from user input
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;
const MAX_DISPLAY_NAME_LENGTH = 30;

function sendError(ws: WebSocket, code: string, message: string): void {
  ws.send(
    JSON.stringify({
      version: PROTOCOL_VERSION,
      type: "ERROR",
      code,
      message,
    }),
  );
}

function buildLobbyState(room: Room, myPlayerId: string): LobbyState {
  const players: PlayerPublicInfo[] = Array.from(room.players.values()).map((p) => ({
    playerId: p.playerId,
    displayName: p.displayName,
    wind: p.wind,
    isHost: p.isHost,
    connected: p.connected,
  }));

  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    gamePhase: "lobby",
    players,
    myPlayerId,
  };
}

function stateViewForPlayer(room: Room, playerId: string): StateUpdateMessage["state"] {
  return room.gameState
    ? buildPlayerView(room, room.gameState, playerId)
    : buildLobbyState(room, playerId);
}

function broadcastStateToRoom(
  room: Room,
  excludePlayerId?: string,
  resolvedAction?: StateUpdateMessage["resolvedAction"],
): void {
  for (const session of room.sessions.values()) {
    if (session.player.playerId === excludePlayerId) continue;
    if (session.ws.readyState !== WebSocket.OPEN) continue;

    const state = stateViewForPlayer(room, session.player.playerId);
    const message: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state,
      resolvedAction,
    };
    session.ws.send(JSON.stringify(message));
  }
}

function sanitizeDisplayName(displayName: unknown): string | null {
  if (!displayName || typeof displayName !== "string") return null;

  const sanitized = displayName.replace(CONTROL_CHARS, "").trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

  return sanitized.length > 0 ? sanitized : null;
}

function handleTokenReconnection(
  ws: WebSocket,
  room: Room,
  token: string,
  logger: FastifyBaseLogger,
  roomManager?: RoomManager,
): boolean {
  const playerId = resolveToken(room, token);
  if (!playerId) return false;

  const player = room.players.get(playerId);
  if (!player) return false;

  // Supersede existing connection if still open
  const existingSession = room.sessions.get(playerId);
  if (existingSession && existingSession.ws.readyState === WebSocket.OPEN) {
    existingSession.ws.send(
      JSON.stringify({
        version: PROTOCOL_VERSION,
        type: "SYSTEM_EVENT",
        event: "SESSION_SUPERSEDED",
      }),
    );
    existingSession.ws.close(4001, "SESSION_SUPERSEDED");
  }

  // Cancel grace period timer if active
  const graceTimer = room.graceTimers.get(playerId);
  if (graceTimer) {
    clearTimeout(graceTimer);
    room.graceTimers.delete(playerId);
  }

  // Cancel room disconnect-timeout since a player reconnected
  cancelLifecycleTimer(room, "disconnect-timeout");

  // Restore connection
  player.connected = true;
  player.connectedAt = Date.now();

  const session: PlayerSession = { player, roomCode: room.roomCode, ws };
  room.sessions.set(playerId, session);

  logger.info({ roomCode: room.roomCode, playerId }, "Player reconnected via token");

  // Reconnection should immediately restore the active filtered game view when a game is in progress.
  const state = stateViewForPlayer(room, playerId);
  const stateMessage: StateUpdateMessage = {
    version: PROTOCOL_VERSION,
    type: "STATE_UPDATE",
    state,
    token,
  };
  ws.send(JSON.stringify(stateMessage));

  // Broadcast reconnection to others
  broadcastStateToRoom(room, playerId, {
    type: "PLAYER_RECONNECTED",
    playerId,
    playerName: player.displayName,
  });

  registerDisconnectHandler(ws, room, playerId, logger, roomManager);
  return true;
}

function allPlayersDisconnected(room: Room): boolean {
  for (const player of room.players.values()) {
    if (player.connected) return false;
  }
  return room.players.size > 0;
}

function registerDisconnectHandler(
  ws: WebSocket,
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
  roomManager?: RoomManager,
): void {
  ws.on("close", () => {
    const player = room.players.get(playerId);
    if (!player) return;

    // Only act if this is the current session's WebSocket
    // Also bail if session was cleared (e.g., room cleanup)
    const session = room.sessions.get(playerId);
    if (!session || session.ws !== ws) return;

    player.connected = false;
    logger.info({ roomCode: room.roomCode, playerId }, "Player disconnected");

    // Start grace period
    const timer = setTimeout(() => {
      room.graceTimers.delete(playerId);

      // Release the seat
      const token = room.playerTokens.get(playerId);
      if (token) {
        room.tokenMap.delete(token);
        room.playerTokens.delete(playerId);
      }
      room.players.delete(playerId);
      room.sessions.delete(playerId);

      logger.info({ roomCode: room.roomCode, playerId }, "Grace period expired, seat released");

      // Restart abandoned timer if player count drops to 0-1
      if (roomManager && room.players.size <= 1) {
        startLifecycleTimer(room, "abandoned-timeout", () => {
          roomManager.cleanupRoom(room.roomCode, "abandoned");
        });
      }

      // Broadcast seat release to remaining players
      broadcastStateToRoom(room);
    }, getGracePeriodMs());

    room.graceTimers.set(playerId, timer);

    // Check if ALL players are now disconnected → start room cleanup timer
    if (roomManager && allPlayersDisconnected(room)) {
      startLifecycleTimer(room, "disconnect-timeout", () => {
        roomManager.cleanupRoom(room.roomCode, "all_disconnected");
      });
    }

    // Broadcast disconnected state to remaining players
    broadcastStateToRoom(room);
  });
}

export function handleJoinRoom(
  ws: WebSocket,
  message: Record<string, unknown>,
  roomManager: RoomManager,
  logger: FastifyBaseLogger,
): void {
  // Validate roomCode
  const roomCode = message.roomCode;
  if (!roomCode || typeof roomCode !== "string") {
    sendError(ws, "MISSING_ROOM_CODE", "Room code is required");
    ws.close(4000, "MISSING_ROOM_CODE");
    return;
  }

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    sendError(ws, "ROOM_NOT_FOUND", "Room not found");
    ws.close(4004, "ROOM_NOT_FOUND");
    return;
  }

  // Token-based reconnection
  const token = message.token;
  if (token && typeof token === "string") {
    if (handleTokenReconnection(ws, room, token, logger, roomManager)) {
      return;
    }
    // Invalid token — fall through to new player join
    logger.warn({ roomCode: room.roomCode }, "Invalid token, treating as new player");
  }

  // Validate displayName (required for new joins)
  const sanitizedName = sanitizeDisplayName(message.displayName);
  if (!sanitizedName) {
    sendError(ws, "INVALID_DISPLAY_NAME", "Display name is required");
    ws.close(4000, "INVALID_DISPLAY_NAME");
    return;
  }

  // Check capacity for new player
  const seat = assignNextSeat(room);
  if (!seat) {
    sendError(ws, "ROOM_FULL", "Room is full");
    ws.close(4003, "ROOM_FULL");
    return;
  }

  // All validation passed — mutate state
  const isHost = room.players.size === 0;
  const { playerId, wind } = seat;

  const playerInfo: PlayerInfo = {
    playerId,
    displayName: sanitizedName,
    wind,
    isHost,
    connected: true,
    connectedAt: Date.now(),
  };
  room.players.set(playerId, playerInfo);

  // Cancel abandoned timer when 2+ players are in the room
  if (room.players.size >= 2) {
    cancelLifecycleTimer(room, "abandoned-timeout");
  }

  const session: PlayerSession = {
    player: playerInfo,
    roomCode: room.roomCode,
    ws,
  };
  room.sessions.set(playerId, session);

  // Generate session token
  const sessionToken = createSessionToken(room, playerId);

  logger.info(
    { roomCode: room.roomCode, playerId, displayName: sanitizedName },
    "Player joined room",
  );

  // Send STATE_UPDATE to the joining player (with token)
  const lobbyState = buildLobbyState(room, playerId);
  const stateMessage: StateUpdateMessage = {
    version: PROTOCOL_VERSION,
    type: "STATE_UPDATE",
    state: lobbyState,
    token: sessionToken,
  };
  ws.send(JSON.stringify(stateMessage));

  // Broadcast PLAYER_JOINED to all other players (no token)
  broadcastStateToRoom(room, playerId, {
    type: "PLAYER_JOINED",
    playerId,
    playerName: sanitizedName,
  });

  registerDisconnectHandler(ws, room, playerId, logger, roomManager);
}
