import { describe, test, expect } from 'vitest'
import { handleDiscardTile } from './discard'
import { handleDrawTile } from './draw'
import { handleAction } from '../game-engine'
import { createPlayState, TEST_PLAYER_IDS } from '../../testing/fixtures'
import { TILE_COUNT } from '../../constants'
import { getPlayerBySeat } from '../../testing/helpers'
import type { GameState } from '../../types/game-state'

/** Drain wall to exactly `remaining` tiles. Keeps wallRemaining in sync. */
function drainWallTo(state: GameState, remaining: number): void {
  if (remaining < 0 || remaining > state.wall.length) {
    throw new Error(`Cannot drain wall to ${remaining} (current: ${state.wall.length})`)
  }
  state.wall.splice(0, state.wall.length - remaining)
  state.wallRemaining = state.wall.length
}

/** Get a discardable (non-Joker) tile ID from a player's rack. */
function getDiscardableTileId(state: GameState, playerId: string): string {
  const player = state.players[playerId]!
  const tile = player.rack.find((t) => t.category !== 'joker')
  if (!tile) throw new Error('No discardable tile in rack')
  return tile.id
}

/**
 * Set up state for a draw-then-discard scenario on a non-East player.
 * Advances to South's turn in draw phase, drains wall to specified remaining.
 */
function setupForLastDraw(state: GameState, wallRemaining: number): { drawerId: string; nextPlayerId: string } {
  const eastId = getPlayerBySeat(state, 'east')
  const southId = getPlayerBySeat(state, 'south')
  const westId = getPlayerBySeat(state, 'west')

  // East discards first (starts in discard phase with 14 tiles)
  const eastTileId = getDiscardableTileId(state, eastId)
  handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: eastId, tileId: eastTileId })

  // Now it's South's turn in draw phase
  expect(state.currentTurn).toBe(southId)
  expect(state.turnPhase).toBe('draw')

  drainWallTo(state, wallRemaining)

  return { drawerId: southId, nextPlayerId: westId }
}

describe('Wall Depletion & Game End', () => {
  test('discard with 1 wall tile remaining transitions gamePhase to scoreboard', () => {
    const state = createPlayState()
    const { drawerId } = setupForLastDraw(state, 1)

    handleDrawTile(state, { type: 'DRAW_TILE', playerId: drawerId })
    const tileId = getDiscardableTileId(state, drawerId)
    const result = handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: drawerId, tileId })

    expect(result.accepted).toBe(true)
    expect(state.gamePhase).toBe('scoreboard')
  })

  test('wall game sets gameResult to { winnerId: null, points: 0 }', () => {
    const state = createPlayState()
    const { drawerId } = setupForLastDraw(state, 1)

    handleDrawTile(state, { type: 'DRAW_TILE', playerId: drawerId })
    const tileId = getDiscardableTileId(state, drawerId)
    handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: drawerId, tileId })

    expect(state.gameResult).toEqual({ winnerId: null, points: 0 })
  })

  test('wall game returns resolved action { type: WALL_GAME }', () => {
    const state = createPlayState()
    const { drawerId } = setupForLastDraw(state, 1)

    handleDrawTile(state, { type: 'DRAW_TILE', playerId: drawerId })
    const tileId = getDiscardableTileId(state, drawerId)
    const result = handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: drawerId, tileId })

    expect(result.resolved).toEqual({ type: 'WALL_GAME' })
  })

  test('scores unchanged after wall game — all players remain at 0', () => {
    const state = createPlayState()
    const scoresBefore = { ...state.scores }

    const { drawerId } = setupForLastDraw(state, 1)
    handleDrawTile(state, { type: 'DRAW_TILE', playerId: drawerId })
    const tileId = getDiscardableTileId(state, drawerId)
    handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: drawerId, tileId })

    expect(state.scores).toEqual(scoresBefore)
    for (const playerId of TEST_PLAYER_IDS) {
      expect(state.scores[playerId]).toBe(0)
    }
  })

  test('draw rejected with WALL_EMPTY after wall depleted', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')

    // Drain wall completely and set up for draw attempt
    drainWallTo(state, 0)
    state.currentTurn = eastId
    state.turnPhase = 'draw'

    const result = handleDrawTile(state, { type: 'DRAW_TILE', playerId: eastId })
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('WALL_EMPTY')
  })

  test('draw rejected with WRONG_PHASE when gamePhase is scoreboard', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')

    state.gamePhase = 'scoreboard'
    state.turnPhase = 'draw'

    const result = handleDrawTile(state, { type: 'DRAW_TILE', playerId: eastId })
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('WRONG_PHASE')
  })

  test('discard rejected with WRONG_PHASE when gamePhase is scoreboard', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')
    const tileId = state.players[eastId]!.rack[0]!.id

    state.gamePhase = 'scoreboard'

    const result = handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: eastId, tileId })
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('WRONG_PHASE')
  })

  test('wallRemaining accurately tracks wall depletion through draw-discard cycles', () => {
    const state = createPlayState()
    expect(state.wallRemaining).toBe(TILE_COUNT - (14 + 13 * 3)) // east gets 14, others get 13

    const eastId = getPlayerBySeat(state, 'east')
    const southId = getPlayerBySeat(state, 'south')

    // East discards (no draw needed — first turn)
    const eastTileId = getDiscardableTileId(state, eastId)
    handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: eastId, tileId: eastTileId })
    expect(state.wallRemaining).toBe(99) // Discard doesn't change wall

    // South draws
    handleDrawTile(state, { type: 'DRAW_TILE', playerId: southId })
    expect(state.wallRemaining).toBe(98) // Draw decrements

    // South discards
    const southTileId = getDiscardableTileId(state, southId)
    handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: southId, tileId: southTileId })
    expect(state.wallRemaining).toBe(98) // Discard doesn't change wall
  })

  test('advanceTurn still runs before game end — currentTurn points to next player', () => {
    const state = createPlayState()
    const { drawerId, nextPlayerId } = setupForLastDraw(state, 1)

    handleDrawTile(state, { type: 'DRAW_TILE', playerId: drawerId })
    const tileId = getDiscardableTileId(state, drawerId)
    handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: drawerId, tileId })

    // Turn should have advanced to West before game ended (South discarded)
    expect(state.currentTurn).toBe(nextPlayerId)
    expect(state.gamePhase).toBe('scoreboard')
  })

  test('discard with 2+ wall tiles remaining does NOT trigger wall game', () => {
    const state = createPlayState()
    const { drawerId } = setupForLastDraw(state, 3)

    handleDrawTile(state, { type: 'DRAW_TILE', playerId: drawerId })

    // Wall has 2 tiles left — should NOT end game
    const tileId = getDiscardableTileId(state, drawerId)
    const result = handleDiscardTile(state, { type: 'DISCARD_TILE', playerId: drawerId, tileId })

    expect(result.accepted).toBe(true)
    expect(result.resolved).toEqual({ type: 'DISCARD_TILE', playerId: drawerId, tileId })
    expect(state.gamePhase).toBe('play')
    expect(state.gameResult).toBeNull()
  })

  test('full game simulation — play through until wall depletion', () => {
    const state = createPlayState()

    expect(state.gamePhase).toBe('play')
    expect(state.wallRemaining).toBe(99)
    expect(state.gameResult).toBeNull()

    let turnCount = 0
    const maxTurns = 200

    // East's first turn: discard only (no draw)
    const eastId = getPlayerBySeat(state, 'east')
    const firstTileId = getDiscardableTileId(state, eastId)
    const firstResult = handleAction(state, { type: 'DISCARD_TILE', playerId: eastId, tileId: firstTileId })
    expect(firstResult.accepted).toBe(true)
    turnCount++

    // Play through draw-discard cycles
    while (state.gamePhase === 'play' && turnCount < maxTurns) {
      const currentPlayer = state.currentTurn

      // Draw
      const drawResult = handleAction(state, { type: 'DRAW_TILE', playerId: currentPlayer })
      if (!drawResult.accepted) break

      // Discard
      const discardTileId = getDiscardableTileId(state, currentPlayer)
      const discardResult = handleAction(state, { type: 'DISCARD_TILE', playerId: currentPlayer, tileId: discardTileId })
      expect(discardResult.accepted).toBe(true)

      turnCount++
    }

    // Game should have ended as wall game
    expect(state.gamePhase).toBe('scoreboard')
    expect(state.gameResult).toEqual({ winnerId: null, points: 0 })
    expect(state.wallRemaining).toBe(0)
    expect(state.wall.length).toBe(0)

    // All scores still 0
    for (const playerId of TEST_PLAYER_IDS) {
      expect(state.scores[playerId]).toBe(0)
    }

    expect(turnCount).toBeGreaterThan(50)
  })

  test('gameResult is null during active play', () => {
    const state = createPlayState()
    expect(state.gameResult).toBeNull()
  })
})
