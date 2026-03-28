import { describe, test, expect, beforeAll } from "vitest";
import { calculatePayments, calculateWallGamePayments, lookupHandPoints } from "./scoring";
import { loadCard } from "../card/card-loader";
import type { NMJLCard } from "../types/card";

const PLAYERS = ["p1", "p2", "p3", "p4"];

describe("calculatePayments", () => {
  describe("discard Mahjong", () => {
    test("25-point hand: discarder pays 2×, others pay 1×", () => {
      const result = calculatePayments({
        winnerId: "p1",
        allPlayerIds: PLAYERS,
        points: 25,
        selfDrawn: false,
        discarderId: "p2",
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payments["p1"]).toBe(100); // winner: +4× (2×+1×+1×)
      expect(result.payments["p2"]).toBe(-50); // discarder: -2×
      expect(result.payments["p3"]).toBe(-25); // other loser: -1×
      expect(result.payments["p4"]).toBe(-25); // other loser: -1×
    });

    test("30-point hand: correct payment distribution", () => {
      const result = calculatePayments({
        winnerId: "p3",
        allPlayerIds: PLAYERS,
        points: 30,
        selfDrawn: false,
        discarderId: "p1",
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payments["p3"]).toBe(120); // winner: +4×
      expect(result.payments["p1"]).toBe(-60); // discarder: -2×
      expect(result.payments["p2"]).toBe(-30); // other: -1×
      expect(result.payments["p4"]).toBe(-30); // other: -1×
    });

    test("50-point hand: correct payment distribution", () => {
      const result = calculatePayments({
        winnerId: "p4",
        allPlayerIds: PLAYERS,
        points: 50,
        selfDrawn: false,
        discarderId: "p2",
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payments["p4"]).toBe(200); // winner: +4×
      expect(result.payments["p2"]).toBe(-100); // discarder: -2×
      expect(result.payments["p1"]).toBe(-50); // other: -1×
      expect(result.payments["p3"]).toBe(-50); // other: -1×
    });

    test("zero-sum property holds", () => {
      const result = calculatePayments({
        winnerId: "p1",
        allPlayerIds: PLAYERS,
        points: 35,
        selfDrawn: false,
        discarderId: "p3",
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      const sum = Object.values(result.payments).reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    });
  });

  describe("self-drawn Mahjong", () => {
    test("25-point hand: all losers pay 2×", () => {
      const result = calculatePayments({
        winnerId: "p1",
        allPlayerIds: PLAYERS,
        points: 25,
        selfDrawn: true,
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payments["p1"]).toBe(150); // winner: +6× (2×+2×+2×)
      expect(result.payments["p2"]).toBe(-50); // loser: -2×
      expect(result.payments["p3"]).toBe(-50); // loser: -2×
      expect(result.payments["p4"]).toBe(-50); // loser: -2×
    });

    test("30-point hand: all losers pay 2×", () => {
      const result = calculatePayments({
        winnerId: "p2",
        allPlayerIds: PLAYERS,
        points: 30,
        selfDrawn: true,
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payments["p2"]).toBe(180); // winner: +6×
      expect(result.payments["p1"]).toBe(-60); // loser: -2×
      expect(result.payments["p3"]).toBe(-60); // loser: -2×
      expect(result.payments["p4"]).toBe(-60); // loser: -2×
    });

    test("50-point hand: all losers pay 2×", () => {
      const result = calculatePayments({
        winnerId: "p4",
        allPlayerIds: PLAYERS,
        points: 50,
        selfDrawn: true,
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.payments["p4"]).toBe(300); // winner: +6×
      expect(result.payments["p1"]).toBe(-100); // loser: -2×
      expect(result.payments["p2"]).toBe(-100); // loser: -2×
      expect(result.payments["p3"]).toBe(-100); // loser: -2×
    });

    test("zero-sum property holds", () => {
      const result = calculatePayments({
        winnerId: "p3",
        allPlayerIds: PLAYERS,
        points: 40,
        selfDrawn: true,
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      const sum = Object.values(result.payments).reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    });
  });

  describe("edge cases", () => {
    test("winnerId not in allPlayerIds returns rejection", () => {
      const result = calculatePayments({
        winnerId: "unknown",
        allPlayerIds: PLAYERS,
        points: 25,
        selfDrawn: true,
      });

      expect(result).toEqual({ valid: false, reason: "winnerId not in allPlayerIds" });
    });

    test("discarderId missing for discard Mahjong returns rejection", () => {
      const result = calculatePayments({
        winnerId: "p1",
        allPlayerIds: PLAYERS,
        points: 25,
        selfDrawn: false,
      });

      expect(result).toEqual({ valid: false, reason: "discarderId required for discard Mahjong" });
    });

    test("discarderId equals winnerId returns rejection", () => {
      const result = calculatePayments({
        winnerId: "p1",
        allPlayerIds: PLAYERS,
        points: 25,
        selfDrawn: false,
        discarderId: "p1",
      });

      expect(result).toEqual({ valid: false, reason: "discarderId cannot equal winnerId" });
    });

    test("discarderId not in allPlayerIds returns rejection", () => {
      const result = calculatePayments({
        winnerId: "p1",
        allPlayerIds: PLAYERS,
        points: 25,
        selfDrawn: false,
        discarderId: "unknown",
      });

      expect(result).toEqual({ valid: false, reason: "discarderId not in allPlayerIds" });
    });

    test("points <= 0 returns rejection", () => {
      expect(
        calculatePayments({
          winnerId: "p1",
          allPlayerIds: PLAYERS,
          points: 0,
          selfDrawn: true,
        }),
      ).toEqual({ valid: false, reason: "points must be positive" });

      expect(
        calculatePayments({
          winnerId: "p1",
          allPlayerIds: PLAYERS,
          points: -10,
          selfDrawn: true,
        }),
      ).toEqual({ valid: false, reason: "points must be positive" });
    });
  });
});

describe("calculateWallGamePayments", () => {
  test("all payments are zero", () => {
    const payments = calculateWallGamePayments(PLAYERS);
    for (const id of PLAYERS) {
      expect(payments[id]).toBe(0);
    }
  });

  test("zero-sum property holds (trivially)", () => {
    const payments = calculateWallGamePayments(PLAYERS);
    const sum = Object.values(payments).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });
});

describe("lookupHandPoints", () => {
  let card: NMJLCard;

  beforeAll(() => {
    card = loadCard("2026");
  });

  test("known pattern IDs return correct point values", () => {
    // Get all hands from the card to find known patterns
    const allHands = card.categories.flatMap((c) => c.hands);
    expect(allHands.length).toBeGreaterThan(0);

    // Test first hand
    const firstHand = allHands[0];
    expect(lookupHandPoints(firstHand.id, card)).toBe(firstHand.points);

    // Test last hand
    const lastHand = allHands[allHands.length - 1];
    expect(lookupHandPoints(lastHand.id, card)).toBe(lastHand.points);
  });

  test("unknown pattern ID returns null", () => {
    expect(lookupHandPoints("nonexistent-pattern", card)).toBeNull();
  });

  test("multiple patterns with different points resolve correctly", () => {
    const allHands = card.categories.flatMap((c) => c.hands);

    // Find two hands with different point values
    const pointSet = new Set<number>();
    const differentHands = allHands.filter((h) => {
      if (pointSet.has(h.points)) return false;
      pointSet.add(h.points);
      return true;
    });

    expect(differentHands.length).toBeGreaterThanOrEqual(2);

    for (const hand of differentHands) {
      expect(lookupHandPoints(hand.id, card)).toBe(hand.points);
    }
  });

  test("all hands in 2026 card have valid point values", () => {
    const allHands = card.categories.flatMap((c) => c.hands);
    for (const hand of allHands) {
      const points = lookupHandPoints(hand.id, card);
      expect(points).not.toBeNull();
      expect(points).toBeGreaterThan(0);
    }
  });
});

describe("session accumulation", () => {
  test("sum payments from 3 games gives correct cumulative totals", () => {
    // Game 1: p1 wins discard from p2, 30 points
    const r1 = calculatePayments({
      winnerId: "p1",
      allPlayerIds: PLAYERS,
      points: 30,
      selfDrawn: false,
      discarderId: "p2",
    });
    expect(r1.valid).toBe(true);
    if (!r1.valid) return;

    // Game 2: p3 wins self-drawn, 25 points
    const r2 = calculatePayments({
      winnerId: "p3",
      allPlayerIds: PLAYERS,
      points: 25,
      selfDrawn: true,
    });
    expect(r2.valid).toBe(true);
    if (!r2.valid) return;

    // Game 3: wall game
    const game3 = calculateWallGamePayments(PLAYERS);

    // Accumulate
    const session: Record<string, number> = {};
    for (const id of PLAYERS) {
      session[id] = r1.payments[id] + r2.payments[id] + game3[id];
    }

    // Game 1: p1 +120, p2 -60, p3 -30, p4 -30
    // Game 2: p1 -50, p2 -50, p3 +150, p4 -50
    // Game 3: all 0
    expect(session["p1"]).toBe(120 + -50 + 0); // 70
    expect(session["p2"]).toBe(-60 + -50 + 0); // -110
    expect(session["p3"]).toBe(-30 + 150 + 0); // 120
    expect(session["p4"]).toBe(-30 + -50 + 0); // -80

    // Session is still zero-sum
    const sum = Object.values(session).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  test("mix of discard, self-drawn, and wall game", () => {
    // Game 1: discard win
    const r1 = calculatePayments({
      winnerId: "p2",
      allPlayerIds: PLAYERS,
      points: 50,
      selfDrawn: false,
      discarderId: "p4",
    });
    expect(r1.valid).toBe(true);
    if (!r1.valid) return;

    // Game 2: self-drawn win
    const r2 = calculatePayments({
      winnerId: "p4",
      allPlayerIds: PLAYERS,
      points: 25,
      selfDrawn: true,
    });
    expect(r2.valid).toBe(true);
    if (!r2.valid) return;

    // Game 3: wall game
    const g3 = calculateWallGamePayments(PLAYERS);

    const session: Record<string, number> = {};
    for (const id of PLAYERS) {
      session[id] = r1.payments[id] + r2.payments[id] + g3[id];
    }

    // Game 1: p2 +200, p4 -100, p1 -50, p3 -50
    // Game 2: p4 +150, p1 -50, p2 -50, p3 -50
    // Game 3: all 0
    expect(session["p1"]).toBe(-50 + -50); // -100
    expect(session["p2"]).toBe(200 + -50); // 150
    expect(session["p3"]).toBe(-50 + -50); // -100
    expect(session["p4"]).toBe(-100 + 150); // 50

    const sum = Object.values(session).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });
});
