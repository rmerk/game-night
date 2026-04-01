import { describe, expect, it } from "vite-plus/test";
import {
  TILE_MIN_WIDTH_CSS,
  TILE_MIN_WIDTH_PX,
  TILE_SIZE_DIMENSIONS,
  getTileSizeStyle,
} from "./tile-sizing";

describe("tile-sizing", () => {
  it("defines the shared small-tile width in one place", () => {
    expect(TILE_MIN_WIDTH_PX).toBe(32);
    expect(TILE_MIN_WIDTH_CSS).toBe("32px");
    expect(TILE_SIZE_DIMENSIONS.small.width).toBe(TILE_MIN_WIDTH_PX);
  });

  it("derives the small tile render size from the shared minimum width", () => {
    expect(getTileSizeStyle("small")).toEqual({
      width: "32px",
      height: "43px",
    });
  });
});
