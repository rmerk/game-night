import type { GameState, ActionResult } from '../types/game-state'
import type { GameAction } from '../types/actions'
import { handleStartGame } from './actions/game-flow'
import { handleDrawTile } from './actions/draw'

/**
 * Create a lobby-state GameState suitable for receiving a START_GAME action.
 */
export function createLobbyState(): GameState {
  return {
    gamePhase: 'lobby',
    players: {},
    wall: [],
    wallRemaining: 0,
    currentTurn: '',
    turnPhase: 'draw',
    lastDiscard: null,
    callWindow: null,
    scores: {},
  }
}

/**
 * Process a game action against the current state.
 * Dispatches to the appropriate action handler based on action type.
 * Follows validate-then-mutate pattern: state is only modified if action is accepted.
 */
export function handleAction(state: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'START_GAME':
      return handleStartGame(state, action)
    case 'DRAW_TILE':
      return handleDrawTile(state, action)
    default: {
      const _exhaustive: never = action
      return { accepted: false, reason: `UNKNOWN_ACTION: ${(_exhaustive as GameAction).type}` }
    }
  }
}
