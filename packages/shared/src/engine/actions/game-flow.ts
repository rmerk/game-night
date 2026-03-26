import type { GameState, ActionResult } from '../../types/game-state'
import type { StartGameAction } from '../../types/actions'
import { MAX_PLAYERS } from '../../constants'
import { createGame } from '../state/create-game'

/**
 * Handle START_GAME action: validate phase and player list, then create initial game state.
 * Follows validate-then-mutate pattern.
 */
export function handleStartGame(state: GameState, action: StartGameAction): ActionResult {
  // 1. Validate — no mutations above this line
  if (state.gamePhase !== 'lobby') {
    return { accepted: false, reason: 'WRONG_PHASE' }
  }
  if (action.playerIds.length !== MAX_PLAYERS) {
    return { accepted: false, reason: 'INVALID_PLAYER_COUNT' }
  }
  const uniqueIds = new Set(action.playerIds)
  if (uniqueIds.size !== action.playerIds.length) {
    return { accepted: false, reason: 'DUPLICATE_PLAYER_IDS' }
  }

  // 2. Mutate — only reached if all validation passed
  const newState = createGame(action.playerIds, action.seed)
  Object.assign(state, newState)

  // 3. Return result
  return { accepted: true, resolved: { type: 'GAME_STARTED' } }
}
