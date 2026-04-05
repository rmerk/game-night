import type { Room } from "./room";

/**
 * Drop a player from the room maps (tokens, sessions, rate limits). Does not run engine actions.
 * Shared by pause-handlers, grace-expiry, and departure auto-end (Stories 4B.3 / 4B.5).
 */
export function releaseSeat(room: Room, playerId: string): void {
  const token = room.playerTokens.get(playerId);
  if (token) {
    room.tokenMap.delete(token);
    room.playerTokens.delete(playerId);
  }
  room.players.delete(playerId);
  room.sessions.delete(playerId);
  room.chatRateTimestamps.delete(playerId);
  room.reactionRateTimestamps.delete(playerId);
}
