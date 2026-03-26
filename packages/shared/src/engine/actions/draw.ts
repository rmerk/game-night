import type { GameState, ActionResult } from '../../types/game-state'
import type { DrawTileAction } from '../../types/actions'
import { SEATS } from '../../constants'

/**
 * Handle DRAW_TILE action: validate turn and phase, then draw top tile from wall.
 * Follows validate-then-mutate pattern.
 */
export function handleDrawTile(state: GameState, action: DrawTileAction): ActionResult {
  // 1. Validate — no mutations above this line
  if (state.gamePhase !== 'play') {
    return { accepted: false, reason: 'WRONG_PHASE' }
  }
  if (state.currentTurn !== action.playerId) {
    return { accepted: false, reason: 'NOT_YOUR_TURN' }
  }
  if (state.turnPhase !== 'draw') {
    return { accepted: false, reason: 'ALREADY_DRAWN' }
  }

  // 2. Mutate — only reached if all validation passed
  const tile = state.wall.shift()!
  state.players[action.playerId].rack.push(tile)
  state.wallRemaining -= 1
  state.turnPhase = 'discard'

  // 3. Return result
  return { accepted: true, resolved: { type: 'DRAW_TILE', playerId: action.playerId } }
}

/**
 * Advance the turn to the next player in counterclockwise order (east→south→west→north→east).
 * Resets turnPhase to 'draw' for the next player.
 * Called by DISCARD_TILE handler (Story 1.5), not by DRAW_TILE.
 */
export function advanceTurn(state: GameState): void {
  const currentPlayer = state.players[state.currentTurn]
  const currentSeatIndex = SEATS.indexOf(currentPlayer.seatWind)
  const nextSeatWind = SEATS[(currentSeatIndex + 1) % SEATS.length]

  const nextPlayer = Object.values(state.players).find((p) => p.seatWind === nextSeatWind)!
  state.currentTurn = nextPlayer.id
  state.turnPhase = 'draw'
}
