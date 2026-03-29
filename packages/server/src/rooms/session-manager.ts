import { randomUUID } from "node:crypto";
import type { Room } from "./room";

export const DEFAULT_GRACE_PERIOD_MS = 30_000;

let gracePeriodMs = DEFAULT_GRACE_PERIOD_MS;

export function getGracePeriodMs(): number {
  return gracePeriodMs;
}

export function setGracePeriodMs(ms: number): void {
  gracePeriodMs = ms;
}

export function createSessionToken(room: Room, playerId: string): string {
  // Revoke any existing token for this player to prevent stale token lookups
  const existingToken = room.playerTokens.get(playerId);
  if (existingToken) {
    room.tokenMap.delete(existingToken);
  }

  const token = randomUUID();
  room.tokenMap.set(token, playerId);
  room.playerTokens.set(playerId, token);
  return token;
}

export function resolveToken(room: Room, token: string): string | undefined {
  return room.tokenMap.get(token);
}

export function revokeToken(room: Room, playerId: string): void {
  const token = room.playerTokens.get(playerId);
  if (token) {
    room.tokenMap.delete(token);
    room.playerTokens.delete(playerId);
  }
}
