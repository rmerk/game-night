import { describe, it, expectTypeOf } from 'vitest'
import type {
  GameState,
  GamePhase,
  TurnPhase,
  SeatWind,
  PlayerState,
  ActionResult,
  ResolvedAction,
  ExposedGroup,
} from './game-state'
import type { GameAction, StartGameAction, DrawTileAction, DiscardTileAction } from './actions'
import type { Tile } from './tiles'

describe('GameState types', () => {
  it('GamePhase includes all required phases', () => {
    expectTypeOf<'lobby'>().toMatchTypeOf<GamePhase>()
    expectTypeOf<'charleston'>().toMatchTypeOf<GamePhase>()
    expectTypeOf<'play'>().toMatchTypeOf<GamePhase>()
    expectTypeOf<'scoreboard'>().toMatchTypeOf<GamePhase>()
    expectTypeOf<'rematch'>().toMatchTypeOf<GamePhase>()
  })

  it('TurnPhase includes all required phases', () => {
    expectTypeOf<'draw'>().toMatchTypeOf<TurnPhase>()
    expectTypeOf<'discard'>().toMatchTypeOf<TurnPhase>()
    expectTypeOf<'callWindow'>().toMatchTypeOf<TurnPhase>()
  })

  it('SeatWind includes all four winds', () => {
    expectTypeOf<'east'>().toMatchTypeOf<SeatWind>()
    expectTypeOf<'south'>().toMatchTypeOf<SeatWind>()
    expectTypeOf<'west'>().toMatchTypeOf<SeatWind>()
    expectTypeOf<'north'>().toMatchTypeOf<SeatWind>()
  })

  it('PlayerState has required fields', () => {
    expectTypeOf<PlayerState>().toHaveProperty('id')
    expectTypeOf<PlayerState>().toHaveProperty('seatWind')
    expectTypeOf<PlayerState>().toHaveProperty('rack')
    expectTypeOf<PlayerState>().toHaveProperty('exposedGroups')
    expectTypeOf<PlayerState>().toHaveProperty('discardPool')
    expectTypeOf<PlayerState['rack']>().toMatchTypeOf<Tile[]>()
    expectTypeOf<PlayerState['exposedGroups']>().toMatchTypeOf<ExposedGroup[]>()
  })

  it('GameState has all required fields', () => {
    expectTypeOf<GameState>().toHaveProperty('gamePhase')
    expectTypeOf<GameState>().toHaveProperty('players')
    expectTypeOf<GameState>().toHaveProperty('wall')
    expectTypeOf<GameState>().toHaveProperty('wallRemaining')
    expectTypeOf<GameState>().toHaveProperty('currentTurn')
    expectTypeOf<GameState>().toHaveProperty('turnPhase')
    expectTypeOf<GameState>().toHaveProperty('lastDiscard')
    expectTypeOf<GameState>().toHaveProperty('callWindow')
    expectTypeOf<GameState>().toHaveProperty('scores')
    expectTypeOf<GameState>().toHaveProperty('gameResult')
  })

  it('GameState.callWindow is null', () => {
    expectTypeOf<GameState['callWindow']>().toEqualTypeOf<null>()
  })

  it('GameState.lastDiscard is tile-discarder pair or null', () => {
    expectTypeOf<GameState['lastDiscard']>().toEqualTypeOf<{ tile: Tile; discarderId: string } | null>()
  })

  it('ActionResult has accepted and optional reason/resolved', () => {
    expectTypeOf<ActionResult>().toHaveProperty('accepted')
    expectTypeOf<ActionResult['accepted']>().toEqualTypeOf<boolean>()
    expectTypeOf<ActionResult['reason']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<ActionResult['resolved']>().toEqualTypeOf<ResolvedAction | undefined>()
  })
})

describe('GameAction types', () => {
  it('StartGameAction has correct shape', () => {
    expectTypeOf<StartGameAction>().toHaveProperty('type')
    expectTypeOf<StartGameAction>().toHaveProperty('playerIds')
    expectTypeOf<StartGameAction['type']>().toEqualTypeOf<'START_GAME'>()
    expectTypeOf<StartGameAction['playerIds']>().toEqualTypeOf<string[]>()
    expectTypeOf<StartGameAction['seed']>().toEqualTypeOf<number | undefined>()
  })

  it('GameAction includes StartGameAction', () => {
    expectTypeOf<StartGameAction>().toMatchTypeOf<GameAction>()
  })

  it('GameAction includes DrawTileAction', () => {
    expectTypeOf<DrawTileAction>().toMatchTypeOf<GameAction>()
  })

  it('GameAction includes DiscardTileAction', () => {
    expectTypeOf<DiscardTileAction>().toMatchTypeOf<GameAction>()
  })
})
