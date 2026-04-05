import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import type { RoomManager } from "../rooms/room-manager";
import type {
  StateUpdateMessage,
  Tile,
  CharlestonPassAction,
  CharlestonVoteAction,
  CourtesyPassAction,
} from "@mahjong-game/shared";
import { PROTOCOL_VERSION, handleAction } from "@mahjong-game/shared";
import { assignNextSeat } from "../rooms/seat-assignment";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";
import { createSessionToken, resolveToken, getGracePeriodMs } from "../rooms/session-manager";
import { startLifecycleTimer, cancelLifecycleTimer } from "../rooms/room-lifecycle";
import {
  broadcastGameState,
  buildCurrentStateMessage,
  broadcastStateToRoom,
} from "./state-broadcaster";
import { sendPostStateSequence } from "./post-state-sequence";
import { stripControlChars } from "./text-sanitize";
import { applyGraceExpiryGameActions } from "./grace-expiry-fallbacks";

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

/** Host-only: set Joker rules for the next game while the room is in lobby (no active match). */
export function handleSetJokerRules(
  ws: WebSocket,
  room: Room,
  playerId: string,
  rawMode: unknown,
  logger: FastifyBaseLogger,
): void {
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    logger.info({ roomCode: room.roomCode, playerId }, "SET_JOKER_RULES rejected: not host");
    sendError(ws, "NOT_HOST", "Only the host can change Joker rules");
    return;
  }
  if (room.gameState !== null) {
    logger.info(
      { roomCode: room.roomCode, playerId },
      "SET_JOKER_RULES rejected: game in progress",
    );
    sendError(ws, "GAME_IN_PROGRESS", "Cannot change Joker rules while a game is in progress");
    return;
  }
  if (rawMode !== "standard" && rawMode !== "simplified") {
    sendError(ws, "INVALID_JOKER_RULES", "jokerRulesMode must be 'standard' or 'simplified'");
    return;
  }
  room.jokerRulesMode = rawMode;
  logger.info({ roomCode: room.roomCode, jokerRulesMode: rawMode }, "Joker rules mode updated");
  broadcastStateToRoom(room);
}

function sanitizeDisplayName(displayName: unknown): string | null {
  if (!displayName || typeof displayName !== "string") return null;

  const sanitized = stripControlChars(displayName).trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

  return sanitized.length > 0 ? sanitized : null;
}

function attachToExistingSeat(
  ws: WebSocket,
  room: Room,
  playerId: string,
  token: string,
  logger: FastifyBaseLogger,
  roomManager?: RoomManager,
): void {
  const player = room.players.get(playerId);
  if (!player) {
    logger.warn({ roomCode: room.roomCode, playerId }, "attachToExistingSeat: player missing");
    return;
  }

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

  const graceTimer = room.graceTimers.get(playerId);
  if (graceTimer) {
    clearTimeout(graceTimer);
    room.graceTimers.delete(playerId);
  }

  cancelLifecycleTimer(room, "disconnect-timeout");

  const savedConnected = player.connected;
  const savedConnectedAt = player.connectedAt;

  player.connected = true;
  player.connectedAt = Date.now();

  const base = buildCurrentStateMessage(room, playerId);
  if (!base) {
    // AC8: build failed — revert connected flag and do NOT install the new session
    // or send frames. The old (superseded) session entry, if any, is left alone;
    // its own close handler will clean up via the normal disconnect path.
    player.connected = savedConnected;
    player.connectedAt = savedConnectedAt;
    logger.warn(
      { roomCode: room.roomCode, playerId },
      "attachToExistingSeat: could not build state",
    );
    return;
  }

  const session: PlayerSession = { player, roomCode: room.roomCode, ws };
  room.sessions.set(playerId, session);

  logger.info({ roomCode: room.roomCode, playerId }, "Session reattached to existing seat");

  const stateMessage: StateUpdateMessage = {
    ...base,
    token,
  };
  sendPostStateSequence(ws, stateMessage, room, logger, "token-reconnect");

  broadcastStateToRoom(room, playerId, {
    type: "PLAYER_RECONNECTED",
    playerId,
    playerName: player.displayName,
  });

  registerDisconnectHandler(ws, room, playerId, logger, roomManager);
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

  attachToExistingSeat(ws, room, playerId, token, logger, roomManager);
  return true;
}

function allPlayersDisconnected(room: Room): boolean {
  for (const player of room.players.values()) {
    if (player.connected) return false;
  }
  return room.players.size > 0;
}

function selectRandomNonJokerTiles(rack: Tile[], count: number): Tile[] {
  const nonJokers = rack.filter((t) => t.category !== "joker");
  const jokers = rack.filter((t) => t.category === "joker");
  const shuffled = [...nonJokers].sort(() => Math.random() - 0.5);
  const selected: Tile[] = shuffled.slice(0, count);
  // Backfill with Jokers if not enough non-Jokers (rare edge case)
  if (selected.length < count) {
    selected.push(...jokers.slice(0, count - selected.length));
  }
  return selected;
}

function applyCharlestonAutoAction(room: Room, playerId: string, logger: FastifyBaseLogger): void {
  if (!room.gameState || room.gameState.gamePhase !== "charleston" || !room.gameState.charleston) {
    return;
  }

  const charleston = room.gameState.charleston;
  const playerState = room.gameState.players[playerId];

  if (!playerState || !charleston.activePlayerIds.includes(playerId)) {
    return;
  }

  let autoAction: CharlestonPassAction | CharlestonVoteAction | CourtesyPassAction | null = null;

  if (charleston.status === "passing") {
    if (!charleston.submittedPlayerIds.includes(playerId)) {
      const tiles = selectRandomNonJokerTiles(playerState.rack, 3);
      autoAction = { type: "CHARLESTON_PASS", playerId, tileIds: tiles.map((t) => t.id) };
    }
  } else if (charleston.status === "vote-ready") {
    if (charleston.votesByPlayerId[playerId] === undefined) {
      autoAction = { type: "CHARLESTON_VOTE", playerId, accept: false };
    }
  } else if (charleston.status === "courtesy-ready") {
    if (charleston.courtesySubmissionsByPlayerId[playerId] === undefined) {
      autoAction = { type: "COURTESY_PASS", playerId, count: 0, tileIds: [] };
    }
  }

  if (!autoAction) return;

  const result = handleAction(room.gameState, autoAction);
  if (result.accepted) {
    broadcastGameState(room, room.gameState, result.resolved);
    logger.info(
      { roomCode: room.roomCode, playerId, actionType: autoAction.type },
      "Charleston auto-action applied for disconnected player",
    );
  } else {
    logger.warn(
      { roomCode: room.roomCode, playerId, actionType: autoAction.type, reason: result.reason },
      "Charleston auto-action rejected unexpectedly",
    );
  }
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

    const disconnectedAt = Date.now();
    player.connected = false;
    logger.info({ roomCode: room.roomCode, playerId }, "Player disconnected");

    // Start grace period
    const timer = setTimeout(() => {
      room.graceTimers.delete(playerId);

      applyGraceExpiryGameActions(room, playerId, logger);

      // Auto-submit Charleston action before releasing the seat so the engine
      // still finds the player in gameState.players (AC9)
      applyCharlestonAutoAction(room, playerId, logger);

      // Release the seat
      const token = room.playerTokens.get(playerId);
      if (token) {
        room.tokenMap.delete(token);
        room.playerTokens.delete(playerId);
      }
      room.players.delete(playerId);
      room.sessions.delete(playerId);
      // Recycled seat ids (player-0..3) must not inherit prior occupant's chat/reaction rate limits
      room.chatRateTimestamps.delete(playerId);
      room.reactionRateTimestamps.delete(playerId);

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

    logger.info(
      { roomCode: room.roomCode, playerId, disconnectedAt },
      "PLAYER_RECONNECTING broadcast, grace period started",
    );
    broadcastStateToRoom(room, playerId, {
      type: "PLAYER_RECONNECTING",
      playerId,
      playerName: player.displayName,
    });
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
    logger.warn({ roomCode: room.roomCode }, "Invalid token, treating as new player");
  }

  const sanitizedName = sanitizeDisplayName(message.displayName);
  if (!sanitizedName) {
    sendError(ws, "INVALID_DISPLAY_NAME", "Display name is required");
    ws.close(4000, "INVALID_DISPLAY_NAME");
    return;
  }

  const graceRecoveryMatches: PlayerInfo[] = [];
  for (const p of room.players.values()) {
    if (
      !p.connected &&
      room.graceTimers.has(p.playerId) &&
      p.displayName.toLowerCase() === sanitizedName.toLowerCase()
    ) {
      graceRecoveryMatches.push(p);
    }
  }
  if (graceRecoveryMatches.length === 1) {
    const [recovered] = graceRecoveryMatches;
    const newToken = createSessionToken(room, recovered.playerId);
    logger.info(
      { roomCode: room.roomCode, playerId: recovered.playerId, displayName: sanitizedName },
      "Player reconnected via displayName grace recovery (tokenless)",
    );
    attachToExistingSeat(ws, room, recovered.playerId, newToken, logger, roomManager);
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

  const baseMessage = buildCurrentStateMessage(room, playerId);
  if (!baseMessage) {
    sendError(ws, "INTERNAL_ERROR", "Could not build room state");
    ws.close(4000, "INTERNAL_ERROR");
    return;
  }
  const stateMessage: StateUpdateMessage = {
    ...baseMessage,
    token: sessionToken,
  };
  sendPostStateSequence(ws, stateMessage, room, logger, "join-room");

  // Broadcast PLAYER_JOINED to all other players (no token)
  broadcastStateToRoom(room, playerId, {
    type: "PLAYER_JOINED",
    playerId,
    playerName: sanitizedName,
  });

  registerDisconnectHandler(ws, room, playerId, logger, roomManager);
}
