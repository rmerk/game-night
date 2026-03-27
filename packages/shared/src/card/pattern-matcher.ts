import type { Tile } from "../types/tiles";
import type { NMJLCard } from "../types/card";

export interface MatchResult {
  patternId: string;
  patternName: string;
  points: number;
}

export function validateHand(_tiles: Tile[], _card: NMJLCard): MatchResult | null {
  return null;
}
