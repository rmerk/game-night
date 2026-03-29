import type { SeatWind } from "@mahjong-game/shared";
import type { Room } from "./room";

const SEAT_WINDS: readonly SeatWind[] = ["east", "south", "west", "north"];
const MAX_PLAYERS = 4;

export interface SeatAssignment {
  playerId: string;
  wind: SeatWind;
}

/**
 * Returns the next available seat in a room.
 * Seats are assigned sequentially: player-0 (east), player-1 (south), etc.
 * Returns null if the room is full.
 */
export function assignNextSeat(room: Room): SeatAssignment | null {
  const occupied = new Set(Array.from(room.players.values()).map((p) => p.playerId));

  for (let i = 0; i < MAX_PLAYERS; i++) {
    const playerId = `player-${i}`;
    if (!occupied.has(playerId)) {
      return { playerId, wind: SEAT_WINDS[i] };
    }
  }

  return null;
}
