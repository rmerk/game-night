/**
 * Hand guidance (Story 5B.2) — ranks NMJL card rows by closeness to completion.
 *
 * **Normative `distance` (AC1):** Over all valid suit/value/joker assignments for that card
 * row, `distance` is the minimum number of additional tiles the player must still obtain
 * (e.g. from wall draws) so that exactly 14 tiles in the combined pool (rack tiles ∪ tiles
 * in exposed melds) can form a winning hand for that pattern under the same matching rules
 * as `validateHandWithExposure`. Assignments minimize that count. `0` iff those 14 tiles
 * already complete the pattern. If the pool already has 14 tiles and no assignment
 * completes the pattern, the row is **not achievable** (do not emit a misleading finite
 * distance). If the pool has fewer than 14 tiles and some completion exists, `distance` is
 * that minimum extra-tile count (≥ 1 when achievable and &lt; 14 tiles in pool).
 *
 * **Performance (NFR8, AC2):** Full guidance for the 2026 card should complete in &lt; 100ms
 * on typical dev hardware. This is verified manually (e.g. `console.time` in dev); CI does
 * not assert the 100ms bound.
 */

import type { NMJLCard, HandPattern } from "../types/card";
import type { Tile } from "../types/tiles";
import type { ExposedGroup } from "../types/game-state";
import { validateExposure, filterAchievableByExposure } from "./exposure-validation";
import { minAdditionalTilesForPattern } from "./pattern-matcher";

export interface GuidanceResult {
  readonly patternId: string;
  /** Minimum extra tiles to obtain; meaningful when `achievable` is true. */
  readonly distance: number;
  readonly achievable: boolean;
}

/**
 * Rank every hand pattern on the card for the local player's combined tile pool.
 * Stateless full recompute — do not cache between draws/discards.
 */
export function rankHandsForGuidance(
  rackTiles: Tile[],
  exposedGroups: ExposedGroup[],
  card: NMJLCard,
): GuidanceResult[] {
  const allTiles = [...rackTiles, ...exposedGroups.flatMap((g) => g.tiles)];
  const exposureFiltered = filterAchievableByExposure(exposedGroups, card);
  const exposureIds = new Set(exposureFiltered.map((h) => h.id));

  const allHands: HandPattern[] = card.categories.flatMap((c) => c.hands);
  const out: GuidanceResult[] = [];

  for (const pattern of allHands) {
    if (!exposureIds.has(pattern.id)) {
      out.push({ patternId: pattern.id, distance: 0, achievable: false });
      continue;
    }
    const exposureCheck = validateExposure(exposedGroups, pattern);
    if (!exposureCheck.valid) {
      out.push({ patternId: pattern.id, distance: 0, achievable: false });
      continue;
    }

    const d = minAdditionalTilesForPattern(allTiles, pattern);
    if (d === null) {
      out.push({ patternId: pattern.id, distance: 0, achievable: false });
    } else {
      out.push({ patternId: pattern.id, distance: d, achievable: true });
    }
  }

  return out;
}
