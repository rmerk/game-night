import { describe, expect, it } from "vitest";
import { generateRoomCode, generateUniqueRoomCode } from "./room-code";

const AMBIGUOUS_CHARS = /[0O1IL]/;
const VALID_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

describe("generateRoomCode", () => {
  it("produces a 6-character string", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it("contains only uppercase alphanumeric characters", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRoomCode()).toMatch(VALID_CODE);
    }
  });

  it("excludes ambiguous characters (0, O, 1, I, L)", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateRoomCode()).not.toMatch(AMBIGUOUS_CHARS);
    }
  });

  it("produces different codes across calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateRoomCode());
    }
    // With 26^6 possible codes, 100 calls should produce at least 90 unique codes
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe("generateUniqueRoomCode", () => {
  it("returns a code not in the existing set", () => {
    const existing = new Set(["ABCDEF", "GHJKMN"]);
    const code = generateUniqueRoomCode(existing);
    expect(existing.has(code)).toBe(false);
    expect(code).toMatch(VALID_CODE);
  });

  it("avoids collisions with existing codes", () => {
    // Pre-populate with many codes to increase collision chance
    const existing = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      existing.add(generateRoomCode());
    }

    const code = generateUniqueRoomCode(existing);
    expect(existing.has(code)).toBe(false);
  });

  it("throws after exhausting retries when all codes are taken", () => {
    // Build a real Set and override has() to always return true
    const alwaysFull = new Set<string>();
    alwaysFull.has = () => true;

    expect(() => generateUniqueRoomCode(alwaysFull)).toThrow(/Failed to generate unique room code/);
  });
});
