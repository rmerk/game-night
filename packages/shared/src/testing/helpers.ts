import type { Tile } from '../types/tiles'
import type { GameState } from '../types/game-state'
import { createWall, createAllTiles } from '../engine/state/wall'
import { createGame } from '../engine/state/create-game'

/** Generate a shuffled wall for testing. Seeded for deterministic results. */
export function generateShuffledWall(seed?: number): Tile[] {
  return createWall(seed)
}

/**
 * Build a hand (array of Tiles) from tile ID strings.
 * Looks up tiles from the full tile set by ID.
 * Throws if any tile ID is not found.
 */
export function buildHand(tileIds: string[]): Tile[] {
  const allTiles = createAllTiles()
  const tileMap = new Map(allTiles.map((t) => [t.id, t]))

  return tileIds.map((id) => {
    const tile = tileMap.get(id)
    if (!tile) {
      throw new Error(`Unknown tile ID: "${id}". Valid format examples: bam-3-2, wind-north-1, joker-5`)
    }
    return tile
  })
}

/**
 * Create a test game state with default player IDs and seed.
 * Useful for tests that need a fully initialized game state.
 *
 * @param overrides - Optional partial overrides applied after game creation
 * @param seed - Optional seed for deterministic state (defaults to 42)
 */
export function createTestState(
  overrides?: Partial<GameState>,
  seed: number = 42,
): GameState {
  const state = createGame(['p1', 'p2', 'p3', 'p4'], seed)
  if (overrides) {
    return { ...state, ...overrides }
  }
  return state
}
