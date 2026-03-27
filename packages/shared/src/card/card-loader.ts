import type { NMJLCard, CardCategory, HandPattern, GroupPattern, GroupType } from '../types/card'
import { GROUP_SIZES, GROUP_TYPES } from '../constants'
import card2026 from '../../data/cards/2026.json'
import card2025 from '../../data/cards/2025.json'

const cards: Record<string, unknown> = {
  '2026': card2026,
  '2025': card2025,
}

export function loadCard(year: string): NMJLCard {
  const raw = cards[year]
  if (!raw) throw new Error(`Card data not found for year: ${year}`)
  return validateAndParse(raw)
}

export function validateAndParse(raw: unknown): NMJLCard {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Card data must be an object')
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj.year !== 'number') {
    throw new Error('Card data missing or invalid "year" field (must be a number)')
  }

  if (!Array.isArray(obj.categories) || obj.categories.length === 0) {
    throw new Error('Card data must have a non-empty "categories" array')
  }

  const seenIds = new Set<string>()
  const categories = obj.categories.map((cat: unknown, ci: number) =>
    validateCategory(cat, ci, seenIds),
  )

  return { year: obj.year, categories }
}

function validateCategory(
  raw: unknown,
  index: number,
  seenIds: Set<string>,
): CardCategory {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Category at index ${index} must be an object`)
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new Error(`Category at index ${index} must have a non-empty "name" string`)
  }

  if (!Array.isArray(obj.hands) || obj.hands.length === 0) {
    throw new Error(`Category "${obj.name}" must have a non-empty "hands" array`)
  }

  const hands = obj.hands.map((hand: unknown, hi: number) =>
    validateHand(hand, obj.name as string, hi, seenIds),
  )

  return { name: obj.name, hands }
}

function validateHand(
  raw: unknown,
  categoryName: string,
  index: number,
  seenIds: Set<string>,
): HandPattern {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Hand at index ${index} in "${categoryName}" must be an object`)
  }

  const obj = raw as Record<string, unknown>
  const context = `Hand at index ${index} in "${categoryName}"`

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error(`${context} must have a non-empty "id" string`)
  }

  if (seenIds.has(obj.id)) {
    throw new Error(`Duplicate hand ID: "${obj.id}"`)
  }
  seenIds.add(obj.id)

  const ctx = `Hand "${obj.id}"`

  if (obj.name !== undefined && typeof obj.name !== 'string') {
    throw new Error(`${ctx}: "name" must be a string if provided`)
  }

  if (typeof obj.points !== 'number' || obj.points <= 0) {
    throw new Error(`${ctx}: "points" must be a positive number`)
  }

  if (obj.exposure !== 'X' && obj.exposure !== 'C') {
    throw new Error(`${ctx}: "exposure" must be "X" or "C"`)
  }

  if (!Array.isArray(obj.groups) || obj.groups.length === 0) {
    throw new Error(`${ctx}: must have a non-empty "groups" array`)
  }

  const groups = obj.groups.map((g: unknown, gi: number) =>
    validateGroup(g, obj.id as string, gi),
  )

  const tileCount = groups.reduce((sum, g) => sum + GROUP_SIZES[g.type], 0)
  if (tileCount !== 14) {
    throw new Error(`${ctx}: groups sum to ${tileCount} tiles, expected 14`)
  }

  return {
    id: obj.id,
    ...(obj.name !== undefined ? { name: obj.name as string } : {}),
    points: obj.points,
    exposure: obj.exposure,
    groups,
  }
}

const validGroupTypes = new Set<string>(GROUP_TYPES)
const implicitTileTypes = new Set<string>(['news', 'dragon_set'])

function validateGroup(
  raw: unknown,
  handId: string,
  index: number,
): GroupPattern {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Group at index ${index} in hand "${handId}" must be an object`)
  }

  const obj = raw as Record<string, unknown>
  const ctx = `Group ${index} in hand "${handId}"`

  if (typeof obj.type !== 'string' || !validGroupTypes.has(obj.type)) {
    throw new Error(
      `${ctx}: "type" must be one of: ${GROUP_TYPES.join(', ')}`,
    )
  }

  const groupType = obj.type as GroupType

  if (typeof obj.jokerEligible !== 'boolean') {
    throw new Error(`${ctx}: "jokerEligible" must be a boolean`)
  }

  const size = GROUP_SIZES[groupType]
  if (size < 3 && obj.jokerEligible) {
    throw new Error(
      `${ctx}: ${groupType} (size ${size}) cannot be joker eligible`,
    )
  }
  if (size >= 3 && !obj.jokerEligible) {
    throw new Error(
      `${ctx}: ${groupType} (size ${size}) must be joker eligible`,
    )
  }

  if (implicitTileTypes.has(groupType)) {
    if (obj.tile !== undefined) {
      throw new Error(`${ctx}: ${groupType} must not have a "tile" field`)
    }
  } else {
    if (obj.tile === undefined || obj.tile === null) {
      throw new Error(`${ctx}: ${groupType} must have a "tile" field`)
    }
    validateTileRequirement(obj.tile, handId, index)
  }

  if (obj.concealed !== undefined && typeof obj.concealed !== 'boolean') {
    throw new Error(`${ctx}: "concealed" must be a boolean if provided`)
  }

  const result: GroupPattern = {
    type: groupType,
    jokerEligible: obj.jokerEligible,
  }

  if (obj.tile !== undefined) {
    result.tile = obj.tile as GroupPattern['tile']
  }

  if (obj.concealed !== undefined) {
    result.concealed = obj.concealed as boolean
  }

  return result
}

function validateTileRequirement(
  raw: unknown,
  handId: string,
  groupIndex: number,
): void {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(
      `Tile requirement in group ${groupIndex} of hand "${handId}" must be an object`,
    )
  }

  const obj = raw as Record<string, unknown>

  if (obj.color !== undefined && typeof obj.color !== 'string') {
    throw new Error(
      `Tile requirement in group ${groupIndex} of hand "${handId}": "color" must be a string`,
    )
  }

  if (
    obj.value !== undefined &&
    typeof obj.value !== 'number' &&
    typeof obj.value !== 'string'
  ) {
    throw new Error(
      `Tile requirement in group ${groupIndex} of hand "${handId}": "value" must be a number or string`,
    )
  }

  if (obj.category !== undefined) {
    if (
      obj.category !== 'flower' &&
      obj.category !== 'wind' &&
      obj.category !== 'dragon'
    ) {
      throw new Error(
        `Tile requirement in group ${groupIndex} of hand "${handId}": "category" must be "flower", "wind", or "dragon"`,
      )
    }
  }

  if (obj.specific !== undefined && typeof obj.specific !== 'string') {
    throw new Error(
      `Tile requirement in group ${groupIndex} of hand "${handId}": "specific" must be a string`,
    )
  }
}
