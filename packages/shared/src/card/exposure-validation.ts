import type { Tile } from "../types/tiles";
import type { NMJLCard, HandPattern, GroupPattern } from "../types/card";
import type { ExposedGroup } from "../types/game-state";
import { getExposureSource } from "../types/game-state";
import { validateHand } from "./pattern-matcher";
import type { MatchResult } from "./pattern-matcher";

// ---------------------------------------------------------------------------
// ExposureResult — discriminated union following ExchangeResult pattern
// ---------------------------------------------------------------------------

export type ExposureResult = { valid: true } | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// validateExposure — pure exposure constraint checker
// ---------------------------------------------------------------------------

export function validateExposure(
  exposedGroups: ExposedGroup[],
  pattern: HandPattern,
): ExposureResult {
  // Full concealed (C) hand on the card: any meld on the table breaks the pattern.
  // (Includes discard-call and future wall-sourced exposures — both are "exposed".)
  if (pattern.exposure === "C") {
    if (exposedGroups.length > 0) {
      return { valid: false, reason: "Concealed hand cannot have any exposed groups" };
    }
    return { valid: true };
  }

  // Exposed (X) hand with group-level C flags: only a discard-call exposure that
  // matches the group violates FR62 — wall-sourced melds do not (future NMJL cases).
  for (const group of pattern.groups) {
    if (!group.concealed) continue;
    if (matchesCallSourcedExposedGroup(group, exposedGroups)) {
      return {
        valid: false,
        reason: `Group marked as concealed was exposed via a discard call: ${group.type}`,
      };
    }
  }

  return { valid: true };
}

/** True if a discard-call exposure matches this group (identity + type). */
function matchesCallSourcedExposedGroup(
  group: GroupPattern,
  exposedGroups: ExposedGroup[],
): boolean {
  for (const eg of exposedGroups) {
    if (getExposureSource(eg) !== "call") continue;
    if (eg.type !== group.type) continue;
    if (matchesGroupIdentity(group, eg)) return true;
  }
  return false;
}

/**
 * Check if a GroupPattern from the card matches a specific ExposedGroup.
 *
 * KNOWN LIMITATION: Abstract color references (A/B/C) in GroupPattern.tile.color
 * cannot be resolved to concrete suits (bam/crak/dot) without the full hand
 * assignment context. When a group has an abstract color, this function falls
 * back to conservative matching (returns true = "might match"), which means
 * some legitimate mixed concealed/exposed hands could be incorrectly rejected.
 *
 * Impact: As of 2026 card data, all concealed (C) hands have ALL groups marked
 * concealed, so the hand-level check in validateExposure catches these before
 * group-level matching runs. This limitation becomes relevant if future card
 * years introduce mixed patterns where some groups are concealed and others exposed.
 *
 * Resolution: Requires passing the color assignment map (from pattern-matcher)
 * into this function. Deferred to Epic 5B hand guidance work.
 */
function matchesGroupIdentity(group: GroupPattern, exposed: ExposedGroup): boolean {
  const id = exposed.identity;

  // Suited group: match color→suit and value
  if (group.tile?.color !== undefined) {
    // We can't resolve color names (A/B/C) to concrete suits here,
    // so for group-level concealed checks we match by type only
    // when the group has abstract color references.
    // In practice, 2026 card data has C hands with ALL groups concealed,
    // so hand-level check catches these. This is forward-looking logic
    // for mixed concealed/exposed patterns.
    if (id.suit !== undefined && id.value !== undefined) {
      // Can't compare abstract color to concrete suit — match on type + value only
      if (group.tile.value !== undefined) {
        const groupVal = group.tile.value;
        if (typeof groupVal === "number") {
          return id.value === groupVal;
        }
        // N/N+1/N+2 wildcards can't be resolved without context — conservative match by type
        return true;
      }
      return true;
    }
    return false;
  }

  // Wind group
  if (group.tile?.category === "wind") {
    if (id.wind !== undefined) {
      if (
        group.tile.specific &&
        group.tile.specific !== "any" &&
        !group.tile.specific.startsWith("any_different:")
      ) {
        return id.wind === group.tile.specific;
      }
      return true;
    }
    return false;
  }

  // Dragon group
  if (group.tile?.category === "dragon") {
    if (id.dragon !== undefined) {
      if (
        group.tile.specific &&
        group.tile.specific !== "any" &&
        !group.tile.specific.startsWith("any_different:")
      ) {
        return id.dragon === group.tile.specific;
      }
      return true;
    }
    return false;
  }

  // NEWS group
  if (group.type === "news") {
    return exposed.type === "news";
  }

  // Dragon set
  if (group.type === "dragon_set") {
    return exposed.type === "dragon_set";
  }

  return false;
}

// ---------------------------------------------------------------------------
// validateHandWithExposure — composite validator
// ---------------------------------------------------------------------------

export function validateHandWithExposure(
  tiles: Tile[],
  exposedGroups: ExposedGroup[],
  card: NMJLCard,
): MatchResult | null {
  if (tiles.length !== 14) return null;

  // Exposure pre-filter: if player has exposed groups, create a filtered card
  // that excludes all concealed-only patterns (fast Phase 1 optimization)
  const filteredCard = filterCardByExposure(exposedGroups, card);

  // Run tile matching against filtered card
  const match = validateHand(tiles, filteredCard);
  if (!match) return null;

  // Find the matched pattern and verify group-level exposure constraints
  const pattern = findPattern(filteredCard, match.patternId);
  if (!pattern) return null;

  const exposureCheck = validateExposure(exposedGroups, pattern);
  if (!exposureCheck.valid) return null;

  return match;
}

function filterCardByExposure(exposedGroups: ExposedGroup[], card: NMJLCard): NMJLCard {
  if (exposedGroups.length === 0) return card;

  return {
    year: card.year,
    categories: card.categories.map((cat) => ({
      name: cat.name,
      hands: cat.hands.filter((h) => h.exposure !== "C"),
    })),
  };
}

function findPattern(card: NMJLCard, patternId: string): HandPattern | undefined {
  for (const cat of card.categories) {
    for (const hand of cat.hands) {
      if (hand.id === patternId) return hand;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// filterAchievableByExposure — pre-filter for future hand guidance
// ---------------------------------------------------------------------------

export function filterAchievableByExposure(
  exposedGroups: ExposedGroup[],
  card: NMJLCard,
): HandPattern[] {
  const allHands = card.categories.flatMap((c) => c.hands);

  if (exposedGroups.length === 0) return allHands;

  return allHands.filter((hand) => {
    // Filter out all concealed hands
    if (hand.exposure === "C") return false;

    // Group-level concealed: discard-call exposures that match invalidate
    for (const group of hand.groups) {
      if (!group.concealed) continue;
      if (matchesCallSourcedExposedGroup(group, exposedGroups)) return false;
    }

    return true;
  });
}
