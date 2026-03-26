import { describe, it, expect } from 'vitest'
import { createAllTiles, createWall } from './wall'
import { TILE_COUNT, JOKER_COUNT, COPIES_PER_TILE } from '../../constants'

describe('createAllTiles', () => {
  const tiles = createAllTiles()

  it('returns exactly 152 tiles', () => {
    expect(tiles).toHaveLength(TILE_COUNT)
  })

  it('has 108 suited tiles', () => {
    const suited = tiles.filter((t) => t.category === 'suited')
    expect(suited).toHaveLength(108)
  })

  it('has 16 wind tiles', () => {
    const winds = tiles.filter((t) => t.category === 'wind')
    expect(winds).toHaveLength(16)
  })

  it('has 12 dragon tiles', () => {
    const dragons = tiles.filter((t) => t.category === 'dragon')
    expect(dragons).toHaveLength(12)
  })

  it('has 8 flower tiles', () => {
    const flowers = tiles.filter((t) => t.category === 'flower')
    expect(flowers).toHaveLength(8)
  })

  it('has 8 joker tiles', () => {
    const jokers = tiles.filter((t) => t.category === 'joker')
    expect(jokers).toHaveLength(JOKER_COUNT)
  })

  it('all tile IDs are unique', () => {
    const ids = tiles.map((t) => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(TILE_COUNT)
  })

  it('suited tile IDs follow {suit}-{value}-{copy} convention', () => {
    const suited = tiles.filter((t) => t.category === 'suited')
    for (const tile of suited) {
      expect(tile.id).toMatch(/^(bam|crak|dot)-[1-9]-[1-4]$/)
    }
  })

  it('wind tile IDs follow wind-{direction}-{copy} convention', () => {
    const winds = tiles.filter((t) => t.category === 'wind')
    for (const tile of winds) {
      expect(tile.id).toMatch(/^wind-(north|east|west|south)-[1-4]$/)
    }
  })

  it('dragon tile IDs follow dragon-{color}-{copy} convention', () => {
    const dragons = tiles.filter((t) => t.category === 'dragon')
    for (const tile of dragons) {
      expect(tile.id).toMatch(/^dragon-(red|green|soap)-[1-4]$/)
    }
  })

  it('flower tile IDs follow flower-{type}-{copy} convention', () => {
    const flowers = tiles.filter((t) => t.category === 'flower')
    for (const tile of flowers) {
      expect(tile.id).toMatch(/^flower-(a|b)-[1-4]$/)
    }
  })

  it('joker tile IDs follow joker-{copy} convention', () => {
    const jokers = tiles.filter((t) => t.category === 'joker')
    for (const tile of jokers) {
      expect(tile.id).toMatch(/^joker-[1-8]$/)
    }
  })

  it('suited tiles have correct suit and value ranges', () => {
    const suited = tiles.filter((t) => t.category === 'suited')
    for (const tile of suited) {
      if (tile.category !== 'suited') continue
      expect(['bam', 'crak', 'dot']).toContain(tile.suit)
      expect(tile.value).toBeGreaterThanOrEqual(1)
      expect(tile.value).toBeLessThanOrEqual(9)
    }
  })

  it('copy numbers are 1-4 for suited tiles', () => {
    const suited = tiles.filter((t) => t.category === 'suited')
    for (const tile of suited) {
      expect(tile.copy).toBeGreaterThanOrEqual(1)
      expect(tile.copy).toBeLessThanOrEqual(COPIES_PER_TILE)
    }
  })

  it('copy numbers are 1-4 for wind tiles', () => {
    const winds = tiles.filter((t) => t.category === 'wind')
    for (const tile of winds) {
      expect(tile.copy).toBeGreaterThanOrEqual(1)
      expect(tile.copy).toBeLessThanOrEqual(COPIES_PER_TILE)
    }
  })

  it('copy numbers are 1-4 for dragon tiles', () => {
    const dragons = tiles.filter((t) => t.category === 'dragon')
    for (const tile of dragons) {
      expect(tile.copy).toBeGreaterThanOrEqual(1)
      expect(tile.copy).toBeLessThanOrEqual(COPIES_PER_TILE)
    }
  })

  it('copy numbers are 1-4 for flower tiles', () => {
    const flowers = tiles.filter((t) => t.category === 'flower')
    for (const tile of flowers) {
      expect(tile.copy).toBeGreaterThanOrEqual(1)
      expect(tile.copy).toBeLessThanOrEqual(COPIES_PER_TILE)
    }
  })

  it('copy numbers are 1-8 for joker tiles', () => {
    const jokers = tiles.filter((t) => t.category === 'joker')
    for (const tile of jokers) {
      expect(tile.copy).toBeGreaterThanOrEqual(1)
      expect(tile.copy).toBeLessThanOrEqual(JOKER_COUNT)
    }
  })

  it('has correct count per suited value (4 copies each)', () => {
    const suited = tiles.filter((t) => t.category === 'suited')
    for (const suit of ['bam', 'crak', 'dot'] as const) {
      for (let value = 1; value <= 9; value++) {
        const matching = suited.filter(
          (t) => t.category === 'suited' && t.suit === suit && t.value === value,
        )
        expect(matching).toHaveLength(4)
      }
    }
  })

  it('has correct count per wind direction (4 copies each)', () => {
    const winds = tiles.filter((t) => t.category === 'wind')
    for (const dir of ['north', 'east', 'west', 'south'] as const) {
      const matching = winds.filter((t) => t.category === 'wind' && t.value === dir)
      expect(matching).toHaveLength(4)
    }
  })

  it('has correct count per dragon type (4 copies each)', () => {
    const dragons = tiles.filter((t) => t.category === 'dragon')
    for (const color of ['red', 'green', 'soap'] as const) {
      const matching = dragons.filter((t) => t.category === 'dragon' && t.value === color)
      expect(matching).toHaveLength(4)
    }
  })
})

describe('createWall', () => {
  it('returns 152 tiles', () => {
    const wall = createWall(42)
    expect(wall).toHaveLength(TILE_COUNT)
  })

  it('contains all 152 tiles (same set, different order)', () => {
    const wall = createWall(42)
    const allTiles = createAllTiles()
    const wallIds = wall.map((t) => t.id).sort()
    const allIds = allTiles.map((t) => t.id).sort()
    expect(wallIds).toEqual(allIds)
  })

  it('same seed produces identical wall order (deterministic)', () => {
    const wall1 = createWall(12345)
    const wall2 = createWall(12345)
    const ids1 = wall1.map((t) => t.id)
    const ids2 = wall2.map((t) => t.id)
    expect(ids1).toEqual(ids2)
  })

  it('different seeds produce different wall orders', () => {
    const wall1 = createWall(111)
    const wall2 = createWall(999)
    const ids1 = wall1.map((t) => t.id)
    const ids2 = wall2.map((t) => t.id)
    expect(ids1).not.toEqual(ids2)
  })

  it('no seed produces different results on repeated calls', () => {
    const wall1 = createWall()
    const wall2 = createWall()
    const ids1 = wall1.map((t) => t.id)
    const ids2 = wall2.map((t) => t.id)
    // Extremely unlikely to be the same with random seeds
    expect(ids1).not.toEqual(ids2)
  })

  it('shuffled wall differs from unshuffled tile order', () => {
    const wall = createWall(42)
    const unshuffled = createAllTiles()
    const wallIds = wall.map((t) => t.id)
    const unshuffledIds = unshuffled.map((t) => t.id)
    expect(wallIds).not.toEqual(unshuffledIds)
  })

  it('preserves tile category counts after shuffle', () => {
    const wall = createWall(42)
    expect(wall.filter((t) => t.category === 'suited')).toHaveLength(108)
    expect(wall.filter((t) => t.category === 'wind')).toHaveLength(16)
    expect(wall.filter((t) => t.category === 'dragon')).toHaveLength(12)
    expect(wall.filter((t) => t.category === 'flower')).toHaveLength(8)
    expect(wall.filter((t) => t.category === 'joker')).toHaveLength(8)
  })
})
