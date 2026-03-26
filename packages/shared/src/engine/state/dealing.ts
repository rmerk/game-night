import type { Tile } from '../../types/tiles'
import type { SeatWind } from '../../types/game-state'
import { SEATS } from '../../constants'

/** Number of tiles dealt to East (dealer) */
const EAST_HAND_SIZE = 14

/** Number of tiles dealt to non-dealer seats */
const STANDARD_HAND_SIZE = 13

export interface DealResult {
  readonly hands: Record<SeatWind, Tile[]>
  readonly remainingWall: Tile[]
}

/**
 * Deal tiles from the wall to each seat.
 * East receives 14 tiles, South/West/North each receive 13.
 * Tiles are dealt from the front of the wall array.
 */
export function dealTiles(wall: Tile[]): DealResult {
  let position = 0
  const hands = {} as Record<SeatWind, Tile[]>

  for (const seat of SEATS) {
    const count = seat === 'east' ? EAST_HAND_SIZE : STANDARD_HAND_SIZE
    hands[seat] = wall.slice(position, position + count)
    position += count
  }

  return {
    hands,
    remainingWall: wall.slice(position),
  }
}
