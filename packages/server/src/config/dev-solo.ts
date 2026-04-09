import type { SeatWind } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";

/** Opt-in local dev: allow START_GAME with one human by filling seats with dead-seat ghosts. */
export function isDevSoloStartEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const v = process.env.MAHJONG_DEV_SOLO_START;
  return v === "1" || v === "true";
}

export type DevSoloGhostSpec = {
  playerId: string;
  displayName: string;
  wind: SeatWind;
};

/** Three synthetic seats (South, West, North); host remains East when listed first in START_GAME. */
export function makeDevSoloGhostSpecs(roomId: string): DevSoloGhostSpec[] {
  return [
    { playerId: `dev-solo-${roomId}-s`, displayName: "Solo (South)", wind: "south" },
    { playerId: `dev-solo-${roomId}-w`, displayName: "Solo (West)", wind: "west" },
    { playerId: `dev-solo-${roomId}-n`, displayName: "Solo (North)", wind: "north" },
  ];
}

export function removeAddedDevSoloGhostPlayers(room: Room, ghostIds: string[]): void {
  for (const id of ghostIds) {
    room.players.delete(id);
    room.seatStatus.deadSeatPlayerIds.delete(id);
  }
}

export function stripDevSoloGhostPlayers(room: Room): void {
  const ids = room.devSoloGhostPlayerIds;
  if (!ids?.length) return;
  removeAddedDevSoloGhostPlayers(room, ids);
  room.devSoloGhostPlayerIds = undefined;
}
