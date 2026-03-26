import { describe, it, expect } from 'vitest'
import { dealTiles } from './dealing'
import { createWall } from './wall'
import { TILE_COUNT } from '../../constants'

describe('dealTiles', () => {
  const wall = createWall(42)

  it('deals 14 tiles to East', () => {
    const { hands } = dealTiles(wall)
    expect(hands.east).toHaveLength(14)
  })

  it('deals 13 tiles to South, West, North', () => {
    const { hands } = dealTiles(wall)
    expect(hands.south).toHaveLength(13)
    expect(hands.west).toHaveLength(13)
    expect(hands.north).toHaveLength(13)
  })

  it('leaves 99 tiles in the wall', () => {
    const { remainingWall } = dealTiles(wall)
    expect(remainingWall).toHaveLength(TILE_COUNT - 14 - 13 - 13 - 13)
    expect(remainingWall).toHaveLength(99)
  })

  it('deals all unique tiles (no duplicates across hands and wall)', () => {
    const { hands, remainingWall } = dealTiles(wall)
    const allIds = [
      ...hands.east.map((t) => t.id),
      ...hands.south.map((t) => t.id),
      ...hands.west.map((t) => t.id),
      ...hands.north.map((t) => t.id),
      ...remainingWall.map((t) => t.id),
    ]
    expect(allIds).toHaveLength(TILE_COUNT)
    expect(new Set(allIds).size).toBe(TILE_COUNT)
  })

  it('preserves total tile count (hands + wall = 152)', () => {
    const { hands, remainingWall } = dealTiles(wall)
    const total =
      hands.east.length + hands.south.length + hands.west.length + hands.north.length + remainingWall.length
    expect(total).toBe(TILE_COUNT)
  })

  it('is deterministic with same wall input', () => {
    const wall1 = createWall(123)
    const wall2 = createWall(123)
    const deal1 = dealTiles(wall1)
    const deal2 = dealTiles(wall2)
    expect(deal1.hands.east.map((t) => t.id)).toEqual(deal2.hands.east.map((t) => t.id))
    expect(deal1.hands.south.map((t) => t.id)).toEqual(deal2.hands.south.map((t) => t.id))
    expect(deal1.remainingWall.map((t) => t.id)).toEqual(deal2.remainingWall.map((t) => t.id))
  })

  it('produces different deals with different seeds', () => {
    const deal1 = dealTiles(createWall(42))
    const deal2 = dealTiles(createWall(999))
    const east1Ids = deal1.hands.east.map((t) => t.id)
    const east2Ids = deal2.hands.east.map((t) => t.id)
    expect(east1Ids).not.toEqual(east2Ids)
  })
})
