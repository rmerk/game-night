import { describe, test, expect } from 'vitest'
import { loadCard, validateAndParse } from './card-loader'
import { GROUP_SIZES } from '../constants'
import type { GroupPattern } from '../types/card'

describe('loadCard', () => {
  test('loadCard("2026") returns valid NMJLCard with correct year', () => {
    const card = loadCard('2026')
    expect(card.year).toBe(2026)
  })

  test('loadCard("2026") returns object with non-empty categories', () => {
    const card = loadCard('2026')
    expect(card.categories.length).toBeGreaterThan(0)
  })

  test('loadCard("2025") returns valid NMJLCard for testing yearly updates', () => {
    const card = loadCard('2025')
    expect(card.year).toBe(2025)
    expect(card.categories.length).toBeGreaterThan(0)
  })

  test('loadCard("9999") throws "Card data not found"', () => {
    expect(() => loadCard('9999')).toThrow('Card data not found for year: 9999')
  })

  test('all loaded hands have exactly 14 tiles', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        const total = hand.groups.reduce(
          (sum, g) => sum + GROUP_SIZES[g.type],
          0,
        )
        expect(total, `Hand ${hand.id} has ${total} tiles, expected 14`).toBe(14)
      }
    }
  })

  test('all loaded hands have non-empty group arrays', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        expect(
          hand.groups.length,
          `Hand ${hand.id} has empty groups`,
        ).toBeGreaterThan(0)
      }
    }
  })

  test('no duplicate hand IDs across entire card', () => {
    const card = loadCard('2026')
    const ids: string[] = []
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        ids.push(hand.id)
      }
    }
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  test('all groups have valid type values', () => {
    const validTypes = Object.keys(GROUP_SIZES)
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        for (const group of hand.groups) {
          expect(
            validTypes,
            `Hand ${hand.id} has invalid group type: ${group.type}`,
          ).toContain(group.type)
        }
      }
    }
  })

  test('joker eligibility is correct per group type', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        for (const group of hand.groups) {
          const size = GROUP_SIZES[group.type]
          if (size < 3) {
            expect(
              group.jokerEligible,
              `Hand ${hand.id}: ${group.type} should not be joker eligible`,
            ).toBe(false)
          } else {
            expect(
              group.jokerEligible,
              `Hand ${hand.id}: ${group.type} should be joker eligible`,
            ).toBe(true)
          }
        }
      }
    }
  })

  test('concealed hands have appropriate group-level concealed flags', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        if (hand.exposure === 'C') {
          for (const group of hand.groups) {
            expect(
              group.concealed,
              `Hand ${hand.id}: concealed hand groups must have concealed=true`,
            ).toBe(true)
          }
        }
      }
    }
  })

  test('news and dragon_set groups have no tile field', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        for (const group of hand.groups) {
          if (group.type === 'news' || group.type === 'dragon_set') {
            expect(
              group.tile,
              `Hand ${hand.id}: ${group.type} should not have tile field`,
            ).toBeUndefined()
          }
        }
      }
    }
  })

  test('non-news/dragon_set groups have tile field', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        for (const group of hand.groups) {
          if (group.type !== 'news' && group.type !== 'dragon_set') {
            expect(
              group.tile,
              `Hand ${hand.id}: ${group.type} must have tile field`,
            ).toBeDefined()
          }
        }
      }
    }
  })

  test('all hands have valid exposure values', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        expect(['X', 'C']).toContain(hand.exposure)
      }
    }
  })

  test('all hands have positive point values', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      for (const hand of cat.hands) {
        expect(hand.points).toBeGreaterThan(0)
      }
    }
  })

  test('all categories have names and non-empty hands', () => {
    const card = loadCard('2026')
    for (const cat of card.categories) {
      expect(cat.name.length).toBeGreaterThan(0)
      expect(cat.hands.length).toBeGreaterThan(0)
    }
  })
})

describe('validateAndParse error handling', () => {
  test('throws for non-object data', () => {
    expect(() => validateAndParse('not an object')).toThrow('Card data must be an object')
    expect(() => validateAndParse(null)).toThrow('Card data must be an object')
  })

  test('throws for missing or invalid year', () => {
    expect(() => validateAndParse({ categories: [] })).toThrow('missing or invalid "year"')
    expect(() => validateAndParse({ year: '2026', categories: [] })).toThrow('missing or invalid "year"')
  })

  test('throws for missing or empty categories', () => {
    expect(() => validateAndParse({ year: 2026 })).toThrow('non-empty "categories" array')
    expect(() => validateAndParse({ year: 2026, categories: [] })).toThrow('non-empty "categories" array')
  })

  test('throws for invalid category', () => {
    expect(() => validateAndParse({ year: 2026, categories: ['bad'] })).toThrow('Category at index 0 must be an object')
    expect(() => validateAndParse({ year: 2026, categories: [{ hands: [] }] })).toThrow('non-empty "name" string')
    expect(() => validateAndParse({ year: 2026, categories: [{ name: 'T', hands: [] }] })).toThrow('non-empty "hands" array')
  })

  test('throws for invalid hand structure', () => {
    const wrap = (hands: unknown[]) => ({ year: 2026, categories: [{ name: 'T', hands }] })
    expect(() => validateAndParse(wrap([42]))).toThrow('must be an object')
    expect(() => validateAndParse(wrap([{ points: 25, exposure: 'X', groups: [] }]))).toThrow('non-empty "id" string')
    expect(() => validateAndParse(wrap([{ id: 'x', points: 0, exposure: 'X', groups: [] }]))).toThrow('"points" must be a positive number')
    expect(() => validateAndParse(wrap([{ id: 'x', points: 25, exposure: 'Z', groups: [] }]))).toThrow('"exposure" must be "X" or "C"')
    expect(() => validateAndParse(wrap([{ id: 'x', points: 25, exposure: 'X', groups: [] }]))).toThrow('non-empty "groups" array')
  })

  test('throws for duplicate hand IDs', () => {
    const hand = {
      id: 'dup', points: 25, exposure: 'X',
      groups: [
        { type: 'kong', tile: { color: 'A', value: 1 }, jokerEligible: true },
        { type: 'kong', tile: { color: 'B', value: 2 }, jokerEligible: true },
        { type: 'kong', tile: { color: 'C', value: 3 }, jokerEligible: true },
        { type: 'pair', tile: { color: 'A', value: 4 }, jokerEligible: false },
      ],
    }
    expect(() => validateAndParse({
      year: 2026,
      categories: [
        { name: 'A', hands: [hand] },
        { name: 'B', hands: [{ ...hand }] },
      ],
    })).toThrow('Duplicate hand ID: "dup"')
  })

  test('throws for invalid group type', () => {
    const wrap = (groups: unknown[]) => ({
      year: 2026,
      categories: [{ name: 'T', hands: [{ id: 'x', points: 25, exposure: 'X', groups }] }],
    })
    expect(() => validateAndParse(wrap([{ type: 'bad', jokerEligible: false }]))).toThrow('"type" must be one of')
  })

  test('throws for incorrect joker eligibility', () => {
    const wrap = (groups: unknown[]) => ({
      year: 2026,
      categories: [{ name: 'T', hands: [{ id: 'x', points: 25, exposure: 'X', groups }] }],
    })
    expect(() => validateAndParse(wrap([
      { type: 'pair', tile: { color: 'A', value: 1 }, jokerEligible: true },
    ]))).toThrow('pair (size 2) cannot be joker eligible')
    expect(() => validateAndParse(wrap([
      { type: 'pung', tile: { color: 'A', value: 1 }, jokerEligible: false },
    ]))).toThrow('pung (size 3) must be joker eligible')
  })

  test('throws for news/dragon_set with tile field', () => {
    const wrap = (groups: unknown[]) => ({
      year: 2026,
      categories: [{ name: 'T', hands: [{ id: 'x', points: 25, exposure: 'X', groups }] }],
    })
    expect(() => validateAndParse(wrap([
      { type: 'news', tile: { category: 'wind' }, jokerEligible: true },
    ]))).toThrow('news must not have a "tile" field')
    expect(() => validateAndParse(wrap([
      { type: 'dragon_set', tile: { category: 'dragon' }, jokerEligible: true },
    ]))).toThrow('dragon_set must not have a "tile" field')
  })

  test('throws for non-implicit group without tile field', () => {
    const wrap = (groups: unknown[]) => ({
      year: 2026,
      categories: [{ name: 'T', hands: [{ id: 'x', points: 25, exposure: 'X', groups }] }],
    })
    expect(() => validateAndParse(wrap([
      { type: 'kong', jokerEligible: true },
    ]))).toThrow('kong must have a "tile" field')
  })

  test('throws for groups not summing to 14 tiles', () => {
    expect(() => validateAndParse({
      year: 2026,
      categories: [{ name: 'T', hands: [{ id: 'x', points: 25, exposure: 'X', groups: [
        { type: 'kong', tile: { color: 'A', value: 1 }, jokerEligible: true },
        { type: 'pair', tile: { color: 'B', value: 2 }, jokerEligible: false },
      ] }] }],
    })).toThrow('groups sum to 6 tiles, expected 14')
  })

  test('throws for invalid tile requirement category', () => {
    const wrap = (groups: unknown[]) => ({
      year: 2026,
      categories: [{ name: 'T', hands: [{ id: 'x', points: 25, exposure: 'X', groups }] }],
    })
    expect(() => validateAndParse(wrap([
      { type: 'pung', tile: { category: 'invalid' }, jokerEligible: true },
    ]))).toThrow('"category" must be "flower", "wind", or "dragon"')
  })
})
