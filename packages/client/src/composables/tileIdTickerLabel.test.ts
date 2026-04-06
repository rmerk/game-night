import { describe, expect, it } from "vite-plus/test";
import { tileIdToTickerLabel } from "./tileIdTickerLabel";

describe("tileIdToTickerLabel", () => {
  it("formats suited tiles", () => {
    expect(tileIdToTickerLabel("dot-8-2")).toBe("8-Dot");
    expect(tileIdToTickerLabel("bam-3-1")).toBe("3-Bam");
    expect(tileIdToTickerLabel("crak-1-4")).toBe("1-Crack");
  });

  it("formats wind and dragon", () => {
    expect(tileIdToTickerLabel("wind-north-1")).toBe("North");
    expect(tileIdToTickerLabel("dragon-red-1")).toBe("Red Dragon");
    expect(tileIdToTickerLabel("dragon-soap-1")).toBe("Soap");
  });

  it("formats joker and flower", () => {
    expect(tileIdToTickerLabel("joker-1")).toBe("Joker");
    expect(tileIdToTickerLabel("flower-a-1")).toBe("Flower A");
  });
});
