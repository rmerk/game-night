import { describe, it, expectTypeOf } from 'vitest'
import type {
  Tile,
  TileId,
  TileSuit,
  TileCategory,
  TileValue,
  WindValue,
  DragonValue,
  FlowerValue,
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
} from './tiles'

describe('tile type definitions', () => {
  it('TileSuit has exactly bam, crak, dot', () => {
    expectTypeOf<TileSuit>().toEqualTypeOf<'bam' | 'crak' | 'dot'>()
  })

  it('TileCategory has exactly suited, wind, dragon, flower, joker', () => {
    expectTypeOf<TileCategory>().toEqualTypeOf<'suited' | 'wind' | 'dragon' | 'flower' | 'joker'>()
  })

  it('WindValue has exactly north, east, west, south', () => {
    expectTypeOf<WindValue>().toEqualTypeOf<'north' | 'east' | 'west' | 'south'>()
  })

  it('DragonValue uses soap (not white) for White Dragon', () => {
    expectTypeOf<DragonValue>().toEqualTypeOf<'red' | 'green' | 'soap'>()
  })

  it('FlowerValue has exactly a, b', () => {
    expectTypeOf<FlowerValue>().toEqualTypeOf<'a' | 'b'>()
  })

  it('TileValue covers 1-9', () => {
    expectTypeOf<TileValue>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9>()
  })

  it('TileId is a string', () => {
    expectTypeOf<TileId>().toEqualTypeOf<string>()
  })

  it('Tile is a discriminated union of all tile types', () => {
    expectTypeOf<SuitedTile>().toMatchTypeOf<Tile>()
    expectTypeOf<WindTile>().toMatchTypeOf<Tile>()
    expectTypeOf<DragonTile>().toMatchTypeOf<Tile>()
    expectTypeOf<FlowerTile>().toMatchTypeOf<Tile>()
    expectTypeOf<JokerTile>().toMatchTypeOf<Tile>()
  })

  it('SuitedTile has suit property', () => {
    expectTypeOf<SuitedTile['suit']>().toEqualTypeOf<TileSuit>()
    expectTypeOf<SuitedTile['category']>().toEqualTypeOf<'suited'>()
    expectTypeOf<SuitedTile['value']>().toEqualTypeOf<TileValue>()
  })

  it('WindTile has wind value', () => {
    expectTypeOf<WindTile['category']>().toEqualTypeOf<'wind'>()
    expectTypeOf<WindTile['value']>().toEqualTypeOf<WindValue>()
  })

  it('DragonTile has dragon value', () => {
    expectTypeOf<DragonTile['category']>().toEqualTypeOf<'dragon'>()
    expectTypeOf<DragonTile['value']>().toEqualTypeOf<DragonValue>()
  })

  it('FlowerTile has flower value', () => {
    expectTypeOf<FlowerTile['category']>().toEqualTypeOf<'flower'>()
    expectTypeOf<FlowerTile['value']>().toEqualTypeOf<FlowerValue>()
  })

  it('JokerTile has no suit or value', () => {
    expectTypeOf<JokerTile['category']>().toEqualTypeOf<'joker'>()
    // JokerTile should not have suit or value
    expectTypeOf<JokerTile>().not.toHaveProperty('suit')
    expectTypeOf<JokerTile>().not.toHaveProperty('value')
  })

  it('all tiles have readonly id and copy', () => {
    expectTypeOf<SuitedTile['id']>().toEqualTypeOf<TileId>()
    expectTypeOf<SuitedTile['copy']>().toEqualTypeOf<number>()
  })
})
