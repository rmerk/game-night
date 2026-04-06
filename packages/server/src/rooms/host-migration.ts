/**
 * Host migration (Story 4B.6 — FR98)
 *
 * Transfers `PlayerInfo.isHost` to the next eligible player in counterclockwise seat order
 * (`SEATS`: east → south → west → north). Triggers:
 * - Grace-expiry after disconnect (`join-handler` `registerDisconnectHandler`)
 * - Intentional leave: lobby `LEAVE_ROOM`, scoreboard `LEAVE_ROOM` (`leave-handler`)
 * - Departure vote `dead_seat` / `end_game` outcomes (`convertToDeadSeat`, `autoEndGameOnDeparture`)
 *
 * **Hostless room:** When no eligible candidate exists (e.g. all remaining players disconnected),
 * `migrateHost` clears the old host flag and returns `newHostId: null`. The next player to
 * (re)join via `attachToExistingSeat` / `handleJoinRoom` is promoted if no one has `isHost`.
 *
 * This module only mutates room state; callers broadcast `HOST_PROMOTED` when `newHostId` is non-null.
 */
import type { FastifyBaseLogger } from "fastify";
import { SEATS } from "@mahjong-game/shared";
import type { PlayerInfo, Room } from "./room";

export function migrateHost(
  room: Room,
  logger: FastifyBaseLogger,
  opts?: { excludePlayerIds?: ReadonlySet<string> },
): { previousHostId: string | null; newHostId: string | null } {
  const exclude = opts?.excludePlayerIds ?? new Set<string>();
  const currentHost = [...room.players.values()].find((p) => p.isHost) ?? null;
  const previousHostId = currentHost?.playerId ?? null;

  const startIndex = currentHost ? (SEATS.indexOf(currentHost.wind) + 1) % SEATS.length : 0;

  let candidate: PlayerInfo | null = null;
  for (let i = 0; i < SEATS.length; i++) {
    const seat = SEATS[(startIndex + i) % SEATS.length];
    const player = [...room.players.values()].find((p) => p.wind === seat);
    if (!player) continue;
    if (currentHost && player.playerId === currentHost.playerId) continue;
    if (!player.connected) continue;
    if (room.seatStatus.deadSeatPlayerIds.has(player.playerId)) continue;
    if (room.seatStatus.departedPlayerIds.has(player.playerId)) continue;
    if (exclude.has(player.playerId)) continue;
    candidate = player;
    break;
  }

  if (candidate) {
    if (currentHost) {
      currentHost.isHost = false;
    }
    candidate.isHost = true;
    const newHostId = candidate.playerId;
    logger.info({ roomCode: room.roomCode, previousHostId, newHostId }, "Host migrated");
    return { previousHostId, newHostId };
  }

  if (currentHost) {
    currentHost.isHost = false;
  }
  logger.info(
    { roomCode: room.roomCode, previousHostId },
    "Host migration: no eligible candidate, room is hostless",
  );
  return { previousHostId, newHostId: null };
}
