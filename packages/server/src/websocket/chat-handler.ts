import type { FastifyBaseLogger } from "fastify";
import { WebSocket } from "ws";
import {
  PROTOCOL_VERSION,
  MAX_CHAT_LENGTH,
  CHAT_RATE_LIMIT_COUNT,
  CHAT_RATE_LIMIT_WINDOW_MS,
  REACTION_RATE_LIMIT_COUNT,
  REACTION_RATE_LIMIT_WINDOW_MS,
  CHAT_HISTORY_CAPACITY,
  isAllowedReactionEmoji,
  type ChatBroadcast,
  type ReactionBroadcast,
} from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import type { ParsedMessage } from "./message-handler";
import { stripControlChars } from "./text-sanitize";

/** Sliding window — timestamps older than the window are dropped before applying the count cap. */
function slidingWindowAccept(
  prior: number[],
  now: number,
  windowMs: number,
  limit: number,
): { allowed: boolean; next: number[] } {
  const cutoff = now - windowMs;
  const windowed = prior.filter((t) => t > cutoff);
  if (windowed.length >= limit) {
    return { allowed: false, next: windowed };
  }
  return { allowed: true, next: [...windowed, now] };
}

export function sanitizeChatText(raw: string): string | null {
  const stripped = stripControlChars(raw).trim();
  if (stripped.length === 0) return null;
  return stripped.slice(0, MAX_CHAT_LENGTH);
}

/** Send the same JSON string to every open session in the room (including sender). */
function broadcastRawToRoom(room: Room, json: string, logger: FastifyBaseLogger): void {
  for (const session of room.sessions.values()) {
    if (session.ws.readyState !== WebSocket.OPEN) continue;
    try {
      session.ws.send(json);
    } catch (error) {
      logger.warn({ error }, "Failed to broadcast to room");
    }
  }
}

function appendChatHistory(room: Room, entry: ChatBroadcast): void {
  room.chatHistory.push(entry);
  while (room.chatHistory.length > CHAT_HISTORY_CAPACITY) {
    room.chatHistory.shift();
  }
}

export function handleChatReactMessage(
  room: Room,
  playerId: string,
  parsed: ParsedMessage,
  logger: FastifyBaseLogger,
  now: number = Date.now(),
): void {
  if (parsed.type === "CHAT") {
    handleChat(room, playerId, parsed, logger, now);
  } else if (parsed.type === "REACTION") {
    handleReaction(room, playerId, parsed, logger, now);
  }
}

function handleChat(
  room: Room,
  playerId: string,
  parsed: ParsedMessage,
  logger: FastifyBaseLogger,
  now: number,
): void {
  if (typeof parsed.text !== "string") {
    return;
  }

  const sanitized = sanitizeChatText(parsed.text);
  if (!sanitized) {
    return;
  }

  const player = room.players.get(playerId);
  if (!player) {
    return;
  }

  const prior = room.rateLimits.chatRateTimestamps.get(playerId) ?? [];
  const chatGate = slidingWindowAccept(
    prior,
    now,
    CHAT_RATE_LIMIT_WINDOW_MS,
    CHAT_RATE_LIMIT_COUNT,
  );
  room.rateLimits.chatRateTimestamps.set(playerId, chatGate.next);
  if (!chatGate.allowed) {
    return;
  }

  const broadcast: ChatBroadcast = {
    version: PROTOCOL_VERSION,
    type: "CHAT_BROADCAST",
    playerId,
    playerName: player.displayName,
    text: sanitized,
    timestamp: now,
  };

  const json = JSON.stringify(broadcast);
  broadcastRawToRoom(room, json, logger);
  appendChatHistory(room, broadcast);
}

function handleReaction(
  room: Room,
  playerId: string,
  parsed: ParsedMessage,
  logger: FastifyBaseLogger,
  now: number,
): void {
  if (typeof parsed.emoji !== "string") {
    return;
  }
  const emoji = parsed.emoji.trim();
  if (emoji.length === 0) {
    return;
  }
  if (!isAllowedReactionEmoji(emoji)) {
    return;
  }

  const player = room.players.get(playerId);
  if (!player) {
    return;
  }

  const prior = room.rateLimits.reactionRateTimestamps.get(playerId) ?? [];
  const reactionGate = slidingWindowAccept(
    prior,
    now,
    REACTION_RATE_LIMIT_WINDOW_MS,
    REACTION_RATE_LIMIT_COUNT,
  );
  room.rateLimits.reactionRateTimestamps.set(playerId, reactionGate.next);
  if (!reactionGate.allowed) {
    return;
  }

  const broadcast: ReactionBroadcast = {
    version: PROTOCOL_VERSION,
    type: "REACTION_BROADCAST",
    playerId,
    playerName: player.displayName,
    emoji,
    timestamp: now,
  };

  const json = JSON.stringify(broadcast);
  broadcastRawToRoom(room, json, logger);
}
