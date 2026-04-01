export type TileDisplaySize = "standard" | "small" | "celebration";

export const TILE_MIN_WIDTH_PX = 32;
export const TILE_MIN_WIDTH_CSS = `${TILE_MIN_WIDTH_PX}px`;

export const TILE_SIZE_DIMENSIONS = {
  standard: { width: 50, height: 67 },
  small: { width: TILE_MIN_WIDTH_PX, height: 43 },
  celebration: { width: 70, height: 93 },
} as const satisfies Record<TileDisplaySize, { width: number; height: number }>;

export function getTileSizeStyle(size: TileDisplaySize): { width: string; height: string } {
  const dimensions = TILE_SIZE_DIMENSIONS[size];

  return {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
  };
}
