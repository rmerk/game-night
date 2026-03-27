import type { GameState, ActionResult } from '../../types/game-state'
import type { DiscardTileAction } from '../../types/actions'
import { advanceTurn } from './draw'

/**
 * Handle DISCARD_TILE action: validate turn, phase, tile ownership, and Joker restriction,
 * then remove tile from rack, add to discard pool, and advance turn.
 * Follows validate-then-mutate pattern.
 */
export function handleDiscardTile(state: GameState, action: DiscardTileAction): ActionResult {
  // 1. Validate — no mutations above this line
  if (state.gamePhase !== 'play') {
    return { accepted: false, reason: 'WRONG_PHASE' }
  }
  if (state.currentTurn !== action.playerId) {
    return { accepted: false, reason: 'NOT_YOUR_TURN' }
  }
  if (state.turnPhase !== 'discard') {
    return { accepted: false, reason: 'MUST_DRAW_FIRST' }
  }

  const player = state.players[action.playerId]
  if (!player) throw new Error(`handleDiscardTile: no player found for id '${action.playerId}'`)
  const tileIndex = player.rack.findIndex((t) => t.id === action.tileId)
  if (tileIndex === -1) {
    return { accepted: false, reason: 'TILE_NOT_IN_RACK' }
  }

  const tile = player.rack[tileIndex]!
  if (tile.category === 'joker') {
    return { accepted: false, reason: 'CANNOT_DISCARD_JOKER' }
  }

  // 2. Mutate — only reached if all validation passed
  player.rack.splice(tileIndex, 1)
  player.discardPool.push(tile)
  state.lastDiscard = { tile, discarderId: action.playerId }
  advanceTurn(state)

  // 3. Check for wall depletion — game ends as wall game (draw)
  if (state.wall.length === 0) {
    state.gamePhase = 'scoreboard'
    state.gameResult = { winnerId: null, points: 0 }
    return {
      accepted: true,
      resolved: { type: 'WALL_GAME' },
    }
  }

  // 4. Return result for normal discard
  return {
    accepted: true,
    resolved: { type: 'DISCARD_TILE', playerId: action.playerId, tileId: action.tileId },
  }
}
