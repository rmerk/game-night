import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import type { RoomManager } from "../rooms/room-manager";
import type { PlayerPublicInfo, LobbyState, StateUpdateMessage } from "@mahjong-game/shared";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { assignNextSeat } from "../rooms/seat-assignment";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";

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

function broadcastStateToRoom(
  room: Room,
  excludePlayerId?: string,
  resolvedAction?: StateUpdateMessage["resolvedAction"],
): void {
  for (const session of room.sessions.values()) {
    if (session.player.playerId === excludePlayerId) continue;
    if (session.ws.readyState !== WebSocket.OPEN) continue;

    const state = buildLobbyState(room, session.player.playerId);
    const message: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state,
      resolvedAction,
    };
    session.ws.send(JSON.stringify(message));
  }
}

export function handleJoinRoom(
  ws: WebSocket,
  message: Record<string, unknown>,
  roomManager: RoomManager,
  logger: FastifyBaseLogger,
): void {
  // Validate roomCode
  const roomCode = message.roomCode;
  const displayName = message.displayName;

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

  // Validate displayName
  if (!displayName || typeof displayName !== "string") {
    sendError(ws, "INVALID_DISPLAY_NAME", "Display name is required");
    ws.close(4000, "INVALID_DISPLAY_NAME");
    return;
  }

  const sanitizedName = displayName
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);

  if (sanitizedName.length === 0) {
    sendError(ws, "INVALID_DISPLAY_NAME", "Display name is required");
    ws.close(4000, "INVALID_DISPLAY_NAME");
    return;
  }

  // Check capacity
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

  const session: PlayerSession = {
    player: playerInfo,
    roomCode: room.roomCode,
    ws,
  };
  room.sessions.set(playerId, session);

  logger.info(
    { roomCode: room.roomCode, playerId, displayName: sanitizedName },
    "Player joined room",
  );

  // Send STATE_UPDATE to the joining player
  const lobbyState = buildLobbyState(room, playerId);
  const stateMessage: StateUpdateMessage = {
    version: PROTOCOL_VERSION,
    type: "STATE_UPDATE",
    state: lobbyState,
  };
  ws.send(JSON.stringify(stateMessage));

  // Broadcast PLAYER_JOINED to all other players
  broadcastStateToRoom(room, playerId, {
    type: "PLAYER_JOINED",
    playerId,
    playerName: sanitizedName,
  });

  // Handle disconnection
  ws.on("close", () => {
    const player = room.players.get(playerId);
    if (player) {
      player.connected = false;
      logger.info({ roomCode: room.roomCode, playerId }, "Player disconnected");

      // Broadcast updated state to remaining players
      broadcastStateToRoom(room);
    }
  });
}
