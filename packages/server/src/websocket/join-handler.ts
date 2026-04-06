import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import type { RoomManager } from "../rooms/room-manager";
import type { StateUpdateMessage } from "@mahjong-game/shared";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { assignNextSeat } from "../rooms/seat-assignment";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";
import { createSessionToken, resolveToken, getGracePeriodMs } from "../rooms/session-manager";
import { startLifecycleTimer, cancelLifecycleTimer } from "../rooms/room-lifecycle";
import { cancelAfkVote, cancelTurnTimer, syncTurnTimer } from "./turn-timer";
import { handlePauseTimeout, releaseSeat } from "./pause-handlers";
import { buildCurrentStateMessage, broadcastStateToRoom } from "./state-broadcaster";
import { sendPostStateSequence } from "./post-state-sequence";
import { stripControlChars } from "./text-sanitize";
import { applyGraceExpiryGameActions } from "./grace-expiry-fallbacks";
import { cancelDepartureVote, resumeDepartureVoteIfNeeded } from "./leave-handler";
import { applyCharlestonAutoAction } from "./charleston-auto-action";
import { migrateHost } from "../rooms/host-migration";
import {
  applyRoomSettingsUpdate,
  isBetweenGames,
  type RoomSettingsPatch,
} from "../rooms/room-settings";

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

/** Host-only: legacy shortcut for `SET_ROOM_SETTINGS { jokerRulesMode }` — same pipeline (Story 4B.7). */
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
  if (!isBetweenGames(room)) {
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
  const result = applyRoomSettingsUpdate(room, { jokerRulesMode: rawMode }, logger);
  if (result.ok === false) {
    sendError(ws, "INVALID_JOKER_RULES", result.error);
    return;
  }
  if (result.ok === "noop") {
    return;
  }
  logger.info({ roomCode: room.roomCode, jokerRulesMode: rawMode }, "Joker rules mode updated");
  broadcastStateToRoom(room, undefined, {
    type: "ROOM_SETTINGS_CHANGED",
    changedBy: playerId,
    changedByName: player.displayName,
    previous: result.previous,
    next: result.next,
    changedKeys: result.changedKeys,
  });
}

/** Host-only: merge partial room settings between games (Story 4B.7). */
export function handleSetRoomSettings(
  ws: WebSocket,
  room: Room,
  playerId: string,
  parsed: Record<string, unknown>,
  logger: FastifyBaseLogger,
): void {
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    logger.info({ roomCode: room.roomCode, playerId }, "SET_ROOM_SETTINGS rejected: not host");
    sendError(ws, "NOT_HOST", "Only the host can change room settings");
    return;
  }
  if (!isBetweenGames(room)) {
    logger.info(
      { roomCode: room.roomCode, playerId },
      "SET_ROOM_SETTINGS rejected: game in progress",
    );
    sendError(ws, "GAME_IN_PROGRESS", "Settings can only change between games");
    return;
  }

  const patch: RoomSettingsPatch = {};
  if ("timerMode" in parsed && parsed.timerMode !== undefined) {
    if (parsed.timerMode !== "timed" && parsed.timerMode !== "none") {
      sendError(ws, "INVALID_SETTINGS", "timerMode: invalid value");
      return;
    }
    patch.timerMode = parsed.timerMode;
  }
  if ("turnDurationMs" in parsed && parsed.turnDurationMs !== undefined) {
    if (typeof parsed.turnDurationMs !== "number") {
      sendError(ws, "INVALID_SETTINGS", "turnDurationMs: invalid value");
      return;
    }
    patch.turnDurationMs = parsed.turnDurationMs;
  }
  if ("jokerRulesMode" in parsed && parsed.jokerRulesMode !== undefined) {
    if (parsed.jokerRulesMode !== "standard" && parsed.jokerRulesMode !== "simplified") {
      sendError(ws, "INVALID_SETTINGS", "jokerRulesMode: invalid value");
      return;
    }
    patch.jokerRulesMode = parsed.jokerRulesMode;
  }
  if ("dealingStyle" in parsed && parsed.dealingStyle !== undefined) {
    if (parsed.dealingStyle !== "instant" && parsed.dealingStyle !== "animated") {
      sendError(ws, "INVALID_SETTINGS", "dealingStyle: invalid value");
      return;
    }
    patch.dealingStyle = parsed.dealingStyle;
  }
  if ("handGuidanceEnabled" in parsed && parsed.handGuidanceEnabled !== undefined) {
    if (typeof parsed.handGuidanceEnabled !== "boolean") {
      sendError(ws, "INVALID_SETTINGS", "handGuidanceEnabled: invalid value");
      return;
    }
    patch.handGuidanceEnabled = parsed.handGuidanceEnabled;
  }

  if (Object.keys(patch).length === 0) {
    sendError(ws, "INVALID_SETTINGS", "No valid settings fields");
    return;
  }

  const result = applyRoomSettingsUpdate(room, patch, logger);
  if (result.ok === false) {
    sendError(ws, "INVALID_SETTINGS", result.error);
    return;
  }
  if (result.ok === "noop") {
    return;
  }

  logger.info(
    {
      roomCode: room.roomCode,
      changedBy: playerId,
      changedKeys: result.changedKeys,
      previous: result.previous,
      next: result.next,
    },
    "Room settings updated",
  );
  broadcastStateToRoom(room, undefined, {
    type: "ROOM_SETTINGS_CHANGED",
    changedBy: playerId,
    changedByName: player.displayName,
    previous: result.previous,
    next: result.next,
    changedKeys: result.changedKeys,
  });
}

function sanitizeDisplayName(displayName: unknown): string | null {
  if (!displayName || typeof displayName !== "string") return null;

  const sanitized = stripControlChars(displayName).trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Reattach a WebSocket to an existing seat (token or tokenless grace recovery via `handleJoinRoom`).
 * Resume-after-pause (4B.3) runs here after `PLAYER_RECONNECTED` broadcast.
 */
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

  if (room.departedPlayerIds.has(playerId)) {
    sendError(ws, "PLAYER_DEPARTED", "Departed players cannot rejoin this game");
    ws.close(4000, "PLAYER_DEPARTED");
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

  let promotedToHostForHostlessRoom = false;
  if (![...room.players.values()].some((p) => p.isHost)) {
    player.isHost = true;
    promotedToHostForHostlessRoom = true;
  }

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

  if (promotedToHostForHostlessRoom) {
    broadcastStateToRoom(room, undefined, {
      type: "HOST_PROMOTED",
      previousHostId: null,
      newHostId: player.playerId,
      newHostName: player.displayName,
    });
  }

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

  const resumedFromPause = room.paused && countDisconnectedPlayers(room) === 0;
  if (resumedFromPause) {
    cancelLifecycleTimer(room, "pause-timeout");
    room.paused = false;
    room.pausedAt = null;
    logger.info({ roomCode: room.roomCode }, "Room resumed — all players reconnected");
    broadcastStateToRoom(room, undefined, { type: "GAME_RESUMED" });
    if (roomManager) {
      resumeDepartureVoteIfNeeded(room, logger, roomManager);
    }
  }

  registerDisconnectHandler(ws, room, playerId, logger, roomManager);

  // Story 4B.4 AC2: only (re-)arm the turn timer if this reconnect changes
  // who should be on the clock — either a pause just resumed, or the
  // reconnecter IS the current turn player whose timer was cancelled on their
  // own disconnect. A reconnect by a non-current player must not give the
  // current player a fresh full-duration turn (exploitable to dodge AFK
  // escalation). `syncTurnTimer` is a no-op while paused anyway.
  if (resumedFromPause || room.gameState?.currentTurn === playerId) {
    syncTurnTimer(room, logger, 0, roomManager);
  }
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

/** Count players who are offline but not intentionally departed (4B.5 — departed stay in room, connected=false). */
function countDisconnectedPlayers(room: Room): number {
  let n = 0;
  for (const p of room.players.values()) {
    if (room.departedPlayerIds.has(p.playerId)) continue;
    if (!p.connected) n++;
  }
  return n;
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

    if (room.departedPlayerIds.has(playerId)) {
      return;
    }

    player.connected = false;
    logger.info({ roomCode: room.roomCode, playerId }, "Player disconnected");

    // Story 4B.4 AC9: turn timer must not tick on a disconnected current player.
    // Grace-expiry owns auto-discard for offline players and does NOT increment
    // `consecutiveTurnTimeouts`. Cancel the turn timer here so a race where the
    // timer fires before grace-expiry cannot increment the counter or broadcast
    // a misleading nudge for an offline player. Grace-expiry's own
    // `syncTurnTimer` call will re-arm for whoever becomes current after
    // auto-discard.
    if (room.turnTimerPlayerId === playerId) {
      cancelTurnTimer(room, logger);
    }

    if (room.paused) {
      // AC11: dead session entry is intentionally left in room.sessions here —
      // readyState filter in broadcastStateToRoom skips it, and the eventual
      // release happens via handlePauseTimeout (AC7) or the post-resume grace path.
      broadcastStateToRoom(room);
      logger.info(
        { roomCode: room.roomCode, playerId },
        "Additional player disconnected while paused",
      );
      return;
    }

    const gs = room.gameState;
    const inGamePausePhase =
      gs !== null && (gs.gamePhase === "play" || gs.gamePhase === "charleston");
    const disconnectedCount = countDisconnectedPlayers(room);

    if (disconnectedCount >= 2 && inGamePausePhase) {
      for (const t of room.graceTimers.values()) {
        clearTimeout(t);
      }
      room.graceTimers.clear();
      cancelTurnTimer(room, logger);
      if (room.afkVoteState) {
        cancelAfkVote(room, logger, "pause");
      }
      cancelDepartureVote(room, logger, "pause");
      cancelLifecycleTimer(room, "disconnect-timeout");
      room.paused = true;
      room.pausedAt = Date.now();
      startLifecycleTimer(room, "pause-timeout", () => {
        handlePauseTimeout(room, roomManager, logger);
      });
      const disconnectedPlayerIds = [...room.players.values()]
        .filter((p) => !p.connected)
        .map((p) => p.playerId);
      broadcastStateToRoom(room, undefined, {
        type: "GAME_PAUSED",
        disconnectedPlayerIds,
        reason: "simultaneous-disconnect",
      });
      logger.info(
        { roomCode: room.roomCode, disconnectedPlayerIds, count: disconnectedCount },
        "Room paused due to simultaneous disconnect",
      );
      return;
    }

    // Story 4B.6: capture host before releaseSeat — migration runs after seat is dropped.
    const timer = setTimeout(() => {
      room.graceTimers.delete(playerId);

      const wasHost = room.players.get(playerId)?.isHost ?? false;

      applyGraceExpiryGameActions(room, playerId, logger, roomManager);

      applyCharlestonAutoAction(room, playerId, logger, roomManager, "grace_expiry");

      releaseSeat(room, playerId);

      logger.info({ roomCode: room.roomCode, playerId }, "Grace period expired, seat released");

      if (wasHost) {
        const migration = migrateHost(room, logger);
        if (migration.newHostId) {
          const newHost = room.players.get(migration.newHostId);
          broadcastStateToRoom(room, undefined, {
            type: "HOST_PROMOTED",
            previousHostId: playerId,
            newHostId: migration.newHostId,
            newHostName: newHost?.displayName ?? "",
          });
        }
      }

      if (roomManager && room.players.size <= 1) {
        startLifecycleTimer(room, "abandoned-timeout", () => {
          roomManager.cleanupRoom(room.roomCode, "abandoned");
        });
      }

      broadcastStateToRoom(room);
    }, getGracePeriodMs());

    room.graceTimers.set(playerId, timer);

    if (roomManager && allPlayersDisconnected(room)) {
      startLifecycleTimer(room, "disconnect-timeout", () => {
        roomManager.cleanupRoom(room.roomCode, "all_disconnected");
      });
    }

    logger.info(
      { roomCode: room.roomCode, playerId },
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

  let hostlessJoinPromotion = false;
  if (![...room.players.values()].some((p) => p.isHost)) {
    playerInfo.isHost = true;
    hostlessJoinPromotion = true;
  }

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

  if (hostlessJoinPromotion) {
    broadcastStateToRoom(room, undefined, {
      type: "HOST_PROMOTED",
      previousHostId: null,
      newHostId: playerInfo.playerId,
      newHostName: playerInfo.displayName,
    });
  }

  sendPostStateSequence(ws, stateMessage, room, logger, "join-room");

  // Broadcast PLAYER_JOINED to all other players (no token)
  broadcastStateToRoom(room, playerId, {
    type: "PLAYER_JOINED",
    playerId,
    playerName: sanitizedName,
  });

  registerDisconnectHandler(ws, room, playerId, logger, roomManager);
}
