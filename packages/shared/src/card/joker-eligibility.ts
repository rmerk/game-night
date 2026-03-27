import type { GroupType, GroupPattern } from "../types/card";
import type { Tile } from "../types/tiles";
import type { ExposedGroup } from "../types/game-state";
import { GROUP_SIZES } from "../constants";

// ---------------------------------------------------------------------------
// Joker eligibility — groups of 3+ accept Jokers, pairs/singles do not
// ---------------------------------------------------------------------------

const ELIGIBLE_GROUPS: ReadonlySet<GroupType> = new Set([
  "pung",
  "kong",
  "quint",
  "sextet",
  "news",
  "dragon_set",
]);

export function isJokerEligibleGroup(groupType: GroupType): boolean {
  return ELIGIBLE_GROUPS.has(groupType);
}

export function canSubstituteJoker(group: GroupPattern, position: number): boolean {
  if (!group.jokerEligible) return false;
  const size = GROUP_SIZES[group.type];
  return position >= 0 && position < size;
}

// ---------------------------------------------------------------------------
// Joker exchange validation
// ---------------------------------------------------------------------------

export type ExchangeResult = { valid: true; jokerTile: Tile } | { valid: false; reason: string };

export function validateJokerExchange(
  exposedGroup: ExposedGroup,
  offeredTile: Tile,
): ExchangeResult {
  // Group must contain at least one Joker
  const jokerTile = exposedGroup.tiles.find((t) => t.category === "joker");
  if (!jokerTile) {
    return { valid: false, reason: "Group contains no Joker tiles" };
  }

  // Offered tile must match the group's identity
  const identity = exposedGroup.identity;
  if (!matchesIdentity(identity, offeredTile)) {
    return { valid: false, reason: "Offered tile does not match group identity" };
  }

  return { valid: true, jokerTile };
}

function matchesIdentity(identity: ExposedGroup["identity"], tile: Tile): boolean {
  // Suited group: match suit + value
  if (identity.suit !== undefined && identity.value !== undefined) {
    return (
      tile.category === "suited" && tile.suit === identity.suit && tile.value === identity.value
    );
  }

  // Wind group: match wind value
  if (identity.wind !== undefined) {
    return tile.category === "wind" && tile.value === identity.wind;
  }

  // Dragon group: match dragon value
  if (identity.dragon !== undefined) {
    return tile.category === "dragon" && tile.value === identity.dragon;
  }

  return false;
}
