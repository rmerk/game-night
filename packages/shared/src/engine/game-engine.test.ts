import { describe, it, expect } from 'vitest'
import { createLobbyState, handleAction } from './game-engine'

describe('createLobbyState', () => {
  it('creates a state in lobby phase', () => {
    const state = createLobbyState()
    expect(state.gamePhase).toBe('lobby')
  })

  it('has empty players, wall, and scores', () => {
    const state = createLobbyState()
    expect(state.players).toEqual({})
    expect(state.wall).toEqual([])
    expect(state.wallRemaining).toBe(0)
    expect(state.scores).toEqual({})
  })

  it('has null callWindow and lastDiscard', () => {
    const state = createLobbyState()
    expect(state.callWindow).toBeNull()
    expect(state.lastDiscard).toBeNull()
  })
})

describe('handleAction', () => {
  it('dispatches START_GAME to game-flow handler', () => {
    const state = createLobbyState()
    const result = handleAction(state, {
      type: 'START_GAME',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      seed: 42,
    })
    expect(result.accepted).toBe(true)
    expect(result.resolved).toEqual({ type: 'GAME_STARTED' })
    expect(state.gamePhase).toBe('play')
  })

  it('rejects START_GAME when not in lobby', () => {
    const state = createLobbyState()
    ;(state as Record<string, unknown>).gamePhase = 'play'
    const result = handleAction(state, {
      type: 'START_GAME',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      seed: 42,
    })
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('WRONG_PHASE')
  })

  it('produces correct initial state through full action flow', () => {
    const state = createLobbyState()
    handleAction(state, {
      type: 'START_GAME',
      playerIds: ['alice', 'bob', 'charlie', 'diana'],
      seed: 12345,
    })

    // AC #1: wind assignments
    expect(state.players['alice']!.seatWind).toBe('east')
    expect(state.players['bob']!.seatWind).toBe('south')
    expect(state.players['charlie']!.seatWind).toBe('west')
    expect(state.players['diana']!.seatWind).toBe('north')

    // AC #2: tile counts
    expect(state.players['alice']!.rack).toHaveLength(14)
    expect(state.players['bob']!.rack).toHaveLength(13)
    expect(state.players['charlie']!.rack).toHaveLength(13)
    expect(state.players['diana']!.rack).toHaveLength(13)

    // AC #3: wall remainder
    expect(state.wallRemaining).toBe(99)

    // AC #4: initial state
    expect(state.currentTurn).toBe('alice')
    expect(state.turnPhase).toBe('discard')
    for (const player of Object.values(state.players)) {
      expect(player.discardPool).toEqual([])
      expect(player.exposedGroups).toEqual([])
    }
    for (const playerId of ['alice', 'bob', 'charlie', 'diana']) {
      expect(state.scores[playerId]).toBe(0)
    }

    // AC #5: state shape
    expect(state.callWindow).toBeNull()
    expect(state.lastDiscard).toBeNull()
  })
})
