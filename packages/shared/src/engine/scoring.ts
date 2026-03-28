import type { NMJLCard } from "../types/card";
import type { PaymentBreakdown } from "../types/game-state";

export interface CalculatePaymentsParams {
  winnerId: string;
  allPlayerIds: string[];
  points: number;
  selfDrawn: boolean;
  discarderId?: string;
}

export type ScoringResult =
  | { valid: true; payments: PaymentBreakdown }
  | { valid: false; reason: string };

/**
 * Calculate per-player payment amounts for a Mahjong win.
 *
 * Discard Mahjong: discarder pays 2× hand value, other 2 losers pay 1× each.
 * Self-drawn Mahjong: all 3 losers pay 2× hand value each.
 */
export function calculatePayments(params: CalculatePaymentsParams): ScoringResult {
  const { winnerId, allPlayerIds, points, selfDrawn, discarderId } = params;

  if (points <= 0) return { valid: false, reason: "points must be positive" };
  if (!allPlayerIds.includes(winnerId))
    return { valid: false, reason: "winnerId not in allPlayerIds" };

  if (!selfDrawn) {
    if (!discarderId) return { valid: false, reason: "discarderId required for discard Mahjong" };
    if (discarderId === winnerId)
      return { valid: false, reason: "discarderId cannot equal winnerId" };
    if (!allPlayerIds.includes(discarderId))
      return { valid: false, reason: "discarderId not in allPlayerIds" };
  }

  const payments: PaymentBreakdown = {};

  if (selfDrawn) {
    // All 3 losers pay 2× hand value
    const loserPayment = -(points * 2);
    let winnerTotal = 0;
    for (const id of allPlayerIds) {
      if (id === winnerId) continue;
      payments[id] = loserPayment;
      winnerTotal -= loserPayment;
    }
    payments[winnerId] = winnerTotal;
  } else {
    // Discarder pays 2×, other 2 losers pay 1×
    let winnerTotal = 0;
    for (const id of allPlayerIds) {
      if (id === winnerId) continue;
      if (id === discarderId) {
        payments[id] = -(points * 2);
      } else {
        payments[id] = -points;
      }
      winnerTotal -= payments[id];
    }
    payments[winnerId] = winnerTotal;
  }

  return { valid: true, payments };
}

/** Calculate payments for a wall game (draw) — all zeros. */
export function calculateWallGamePayments(allPlayerIds: string[]): PaymentBreakdown {
  const payments: PaymentBreakdown = {};
  for (const id of allPlayerIds) {
    payments[id] = 0;
  }
  return payments;
}

/** Look up the point value for a hand pattern by ID. Returns null if not found. */
export function lookupHandPoints(patternId: string, card: NMJLCard): number | null {
  for (const category of card.categories) {
    for (const hand of category.hands) {
      if (hand.id === patternId) {
        return hand.points;
      }
    }
  }
  return null;
}
