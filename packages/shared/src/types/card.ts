/** Group type identifiers for NMJL hand patterns */
export type GroupType =
  | 'single'
  | 'pair'
  | 'pung'
  | 'kong'
  | 'quint'
  | 'sextet'
  | 'news'
  | 'dragon_set'

/** Specific tile identifier for honor/category tiles */
export type TileSpecific =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'red'
  | 'green'
  | 'soap'
  | 'any'
  | `any_different:${number}`

/** Tile requirement within a group pattern */
export interface TileRequirement {
  color?: string
  value?: number | string
  category?: 'flower' | 'wind' | 'dragon'
  specific?: TileSpecific
}

/** A single group within a hand pattern */
export interface GroupPattern {
  type: GroupType
  tile?: TileRequirement
  jokerEligible: boolean
  concealed?: boolean
}

/** A complete hand pattern definition */
export interface HandPattern {
  id: string
  name?: string
  points: number
  exposure: 'X' | 'C'
  groups: GroupPattern[]
}

/** A category of hands on the NMJL card */
export interface CardCategory {
  name: string
  hands: HandPattern[]
}

/** Complete NMJL card data for a given year */
export interface NMJLCard {
  year: number
  categories: CardCategory[]
}
