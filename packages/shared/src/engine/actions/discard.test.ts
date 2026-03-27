import { describe, test, expect } from 'vitest'
import { handleDiscardTile } from './discard'
import { createPlayState, TEST_PLAYER_IDS } from '../../testing/fixtures'
import { getPlayerBySeat } from '../../testing/helpers'
import { jokerTile, suitedTile } from '../../testing/tile-builders'
import type { DiscardTileAction } from '../../types/actions'
import { SEATS } from '../../constants'

function makeDiscardAction(playerId: string, tileId: string): DiscardTileAction {
  return { type: 'DISCARD_TILE', playerId, tileId }
}

describe('handleDiscardTile', () => {
  test('successful discard removes tile from rack, adds to discardPool, advances turn', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')

    // East starts in 'discard' phase with 14 tiles
    expect(state.currentTurn).toBe(eastId)
    expect(state.turnPhase).toBe('discard')

    const tileToDiscard = state.players[eastId].rack[0]
    const rackBefore = state.players[eastId].rack.length
    const discardPoolBefore = state.players[eastId].discardPool.length

    const result = handleDiscardTile(state, makeDiscardAction(eastId, tileToDiscard.id))

    expect(result.accepted).toBe(true)
    expect(state.players[eastId].rack.length).toBe(rackBefore - 1)
    expect(state.players[eastId].rack.find((t) => t.id === tileToDiscard.id)).toBeUndefined()
    expect(state.players[eastId].discardPool.length).toBe(discardPoolBefore + 1)
    expect(state.players[eastId].discardPool).toContain(tileToDiscard)
    // Turn advances to south
    expect(state.currentTurn).not.toBe(eastId)
  })

  test('successful discard returns accepted with DISCARD_TILE resolved action', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')
    const tileToDiscard = state.players[eastId].rack[0]

    const result = handleDiscardTile(state, makeDiscardAction(eastId, tileToDiscard.id))

    expect(result).toEqual({
      accepted: true,
      resolved: { type: 'DISCARD_TILE', playerId: eastId, tileId: tileToDiscard.id },
    })
  })

  test('rejects NOT_YOUR_TURN when wrong player discards', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')
    const southId = getPlayerBySeat(state, 'south')
    const tile = state.players[southId].rack[0]

    const result = handleDiscardTile(state, makeDiscardAction(southId, tile.id))

    expect(result).toEqual({ accepted: false, reason: 'NOT_YOUR_TURN' })
  })

  test('rejects TILE_NOT_IN_RACK when tile not found', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')

    const result = handleDiscardTile(state, makeDiscardAction(eastId, 'nonexistent-tile-99'))

    expect(result).toEqual({ accepted: false, reason: 'TILE_NOT_IN_RACK' })
  })

  test('rejects CANNOT_DISCARD_JOKER when discarding a Joker tile (FR51)', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')

    // Insert a Joker into East's rack
    const joker = jokerTile(1)
    state.players[eastId].rack.push(joker)

    const result = handleDiscardTile(state, makeDiscardAction(eastId, joker.id))

    expect(result).toEqual({ accepted: false, reason: 'CANNOT_DISCARD_JOKER' })
  })

  test("East's first turn — turnPhase starts as discard, discard succeeds without prior draw (FR14)", () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')

    // Verify initial state: East has 14 tiles, turnPhase is 'discard'
    expect(state.currentTurn).toBe(eastId)
    expect(state.turnPhase).toBe('discard')
    expect(state.players[eastId].rack.length).toBe(14)

    const tile = state.players[eastId].rack[0]
    const result = handleDiscardTile(state, makeDiscardAction(eastId, tile.id))

    expect(result.accepted).toBe(true)
    expect(state.players[eastId].rack.length).toBe(13)
  })

  test("rejects MUST_DRAW_FIRST when turnPhase is 'draw' (non-East, mid-game)", () => {
    const state = createPlayState()
    const southId = getPlayerBySeat(state, 'south')
    state.currentTurn = southId
    state.turnPhase = 'draw'

    const tile = state.players[southId].rack[0]
    const result = handleDiscardTile(state, makeDiscardAction(southId, tile.id))

    expect(result).toEqual({ accepted: false, reason: 'MUST_DRAW_FIRST' })
  })

  test('rejects WRONG_PHASE when gamePhase is not play', () => {
    const state = createPlayState()
    state.gamePhase = 'lobby'
    const eastId = getPlayerBySeat(state, 'east')
    const tile = state.players[eastId].rack[0]

    const result = handleDiscardTile(state, makeDiscardAction(eastId, tile.id))

    expect(result).toEqual({ accepted: false, reason: 'WRONG_PHASE' })
  })

  test('state completely unchanged on any rejected action', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')
    const southId = getPlayerBySeat(state, 'south')

    // Snapshot state before rejected action
    const eastRackBefore = [...state.players[eastId].rack]
    const southRackBefore = [...state.players[southId].rack]
    const eastDiscardBefore = [...state.players[eastId].discardPool]
    const currentTurnBefore = state.currentTurn
    const turnPhaseBefore = state.turnPhase
    const lastDiscardBefore = state.lastDiscard
    const wallRemainingBefore = state.wallRemaining

    // Wrong player tries to discard
    const tile = state.players[southId].rack[0]
    handleDiscardTile(state, makeDiscardAction(southId, tile.id))

    expect(state.players[eastId].rack).toEqual(eastRackBefore)
    expect(state.players[southId].rack).toEqual(southRackBefore)
    expect(state.players[eastId].discardPool).toEqual(eastDiscardBefore)
    expect(state.currentTurn).toBe(currentTurnBefore)
    expect(state.turnPhase).toBe(turnPhaseBefore)
    expect(state.lastDiscard).toBe(lastDiscardBefore)
    expect(state.wallRemaining).toBe(wallRemainingBefore)
  })

  test('lastDiscard is set correctly after successful discard', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')
    const tile = state.players[eastId].rack[0]

    expect(state.lastDiscard).toBeNull()

    handleDiscardTile(state, makeDiscardAction(eastId, tile.id))

    expect(state.lastDiscard).toEqual({ tile, discarderId: eastId })
  })

  test('turn advances counterclockwise after discard (east->south->west->north cycle)', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')
    const southId = getPlayerBySeat(state, 'south')

    // East discards — turn should go to South
    const tile = state.players[eastId].rack[0]
    handleDiscardTile(state, makeDiscardAction(eastId, tile.id))

    expect(state.currentTurn).toBe(southId)
    expect(state.turnPhase).toBe('draw')
  })

  test('discarding a regular tile while holding Jokers succeeds', () => {
    const state = createPlayState()
    const eastId = getPlayerBySeat(state, 'east')

    // Insert a Joker into East's rack
    const joker = jokerTile(1)
    state.players[eastId].rack.push(joker)

    // Discard a non-Joker tile — should succeed even though rack contains a Joker
    const regularTile = state.players[eastId].rack[0]
    expect(regularTile.category).not.toBe('joker')

    const result = handleDiscardTile(state, makeDiscardAction(eastId, regularTile.id))

    expect(result.accepted).toBe(true)
    // Joker should still be in rack
    expect(state.players[eastId].rack.find((t) => t.id === joker.id)).toBeDefined()
  })
})
