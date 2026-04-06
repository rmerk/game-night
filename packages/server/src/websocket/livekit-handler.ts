import type { FastifyBaseLogger } from "fastify";
import { WebSocket } from "ws";
import { AccessToken } from "livekit-server-sdk";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import { getLiveKitConfig } from "../config/livekit";
import { trySendJson } from "./ws-utils";

function isEligibleForLiveKit(room: Room, playerId: string): boolean {
  if (!room.players.has(playerId)) {
    return false;
  }
  if (room.seatStatus.departedPlayerIds.has(playerId)) {
    return false;
  }
  return true;
}

/**
 * Generates a LiveKit JWT for a seated player and sends {@link PROTOCOL_VERSION} `LIVEKIT_TOKEN`.
 * Fire-and-forget: call with `void` from the WebSocket message handler.
 */
export async function handleLiveKitTokenRequest(
  ws: WebSocket,
  _parsed: Record<string, unknown>,
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
): Promise<void> {
  if (!isEligibleForLiveKit(room, playerId)) {
    trySendJson(
      ws,
      {
        version: PROTOCOL_VERSION,
        type: "ERROR",
        code: "LIVEKIT_NOT_ELIGIBLE",
        message: "LiveKit is only available for seated players in an active room",
      },
      logger,
      "livekit-not-eligible",
    );
    return;
  }

  const config = getLiveKitConfig(logger);
  if (!config.configured) {
    trySendJson(
      ws,
      {
        version: PROTOCOL_VERSION,
        type: "ERROR",
        code: "LIVEKIT_UNAVAILABLE",
        message: "Voice and video are not configured on this server",
      },
      logger,
      "livekit-unconfigured",
    );
    return;
  }

  try {
    const at = new AccessToken(config.apiKey, config.apiSecret, { identity: playerId });
    at.addGrant({
      roomJoin: true,
      room: room.roomCode,
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    trySendJson(
      ws,
      {
        version: PROTOCOL_VERSION,
        type: "LIVEKIT_TOKEN",
        token,
        url: config.url,
      },
      logger,
      "livekit-token",
    );
  } catch (error) {
    logger.warn({ error, roomCode: room.roomCode, playerId }, "Failed to generate LiveKit token");
    trySendJson(
      ws,
      {
        version: PROTOCOL_VERSION,
        type: "ERROR",
        code: "LIVEKIT_TOKEN_FAILED",
        message: "Could not issue voice/video token",
      },
      logger,
      "livekit-token-error",
    );
  }
}
