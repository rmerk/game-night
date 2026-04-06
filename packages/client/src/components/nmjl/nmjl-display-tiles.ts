import type {
  DragonValue,
  FlowerValue,
  Tile,
  TileSuit,
  TileValue,
  WindValue,
} from "@mahjong-game/shared";
import type { GroupPattern, TileRequirement } from "@mahjong-game/shared";
import { GROUP_SIZES } from "@mahjong-game/shared";

/** Default NMJL card A/B/C → concrete suits for reference display */
export const DEFAULT_SUIT_MAPPING: Record<"A" | "B" | "C", TileSuit> = {
  A: "bam",
  B: "crak",
  C: "dot",
};

export type DisplayTileItem = { kind: "tile"; tile: Tile } | { kind: "text"; text: string };

function asTileValue(n: number): TileValue {
  if (n >= 1 && n <= 9) {
    return n as TileValue;
  }
  return 1;
}

function resolveSuitedValue(
  value: number | string | undefined,
  nValue: number,
): { numeric: TileValue } | { raw: string } {
  if (value === undefined) {
    return { raw: "?" };
  }
  if (typeof value === "number") {
    return { numeric: asTileValue(value) };
  }
  if (value === "N") {
    return { numeric: asTileValue(nValue) };
  }
  if (value === "N+1") {
    return { numeric: asTileValue(nValue + 1) };
  }
  if (value === "N+2") {
    return { numeric: asTileValue(nValue + 2) };
  }
  return { raw: value };
}

function resolveSuit(color: string, suitMapping: Record<"A" | "B" | "C", TileSuit>): TileSuit {
  if (color === "A" || color === "B" || color === "C") {
    return suitMapping[color];
  }
  return "bam";
}

function requirementToDisplayItems(
  req: TileRequirement,
  count: number,
  suitMapping: Record<"A" | "B" | "C", TileSuit>,
  nValue: number,
  idPrefix: string,
): DisplayTileItem[] {
  const out: DisplayTileItem[] = [];

  if (req.category === "wind" && req.specific) {
    const w = req.specific as WindValue;
    for (let c = 1; c <= count; c++) {
      out.push({
        kind: "tile",
        tile: {
          id: `${idPrefix}-wind-${w}-${c}`,
          category: "wind",
          value: w,
          copy: c,
        },
      });
    }
    return out;
  }

  if (req.category === "dragon" && req.specific) {
    const d = req.specific as DragonValue;
    for (let c = 1; c <= count; c++) {
      out.push({
        kind: "tile",
        tile: {
          id: `${idPrefix}-dragon-${d}-${c}`,
          category: "dragon",
          value: d,
          copy: c,
        },
      });
    }
    return out;
  }

  if (req.category === "flower" && req.specific) {
    const f = req.specific as FlowerValue;
    for (let c = 1; c <= count; c++) {
      out.push({
        kind: "tile",
        tile: {
          id: `${idPrefix}-flower-${f}-${c}`,
          category: "flower",
          value: f,
          copy: c,
        },
      });
    }
    return out;
  }

  if (req.color) {
    const suit = resolveSuit(req.color, suitMapping);
    const resolved = resolveSuitedValue(req.value, nValue);
    if ("raw" in resolved) {
      for (let i = 0; i < count; i++) {
        out.push({ kind: "text", text: resolved.raw });
      }
      return out;
    }
    const tv = resolved.numeric;
    for (let c = 1; c <= count; c++) {
      out.push({
        kind: "tile",
        tile: {
          id: `${idPrefix}-${suit}-${tv}-${c}`,
          category: "suited",
          suit,
          value: tv,
          copy: c,
        },
      });
    }
    return out;
  }

  out.push({ kind: "text", text: "?" });
  return out;
}

/**
 * Visual tiles / text fragments for one group row on the NMJL reference panel.
 */
export function displayItemsForGroup(
  group: GroupPattern,
  handId: string,
  groupIndex: number,
  suitMapping: Record<"A" | "B" | "C", TileSuit> = DEFAULT_SUIT_MAPPING,
  nValue = 1,
): DisplayTileItem[] {
  const size = GROUP_SIZES[group.type];
  const idPrefix = `nmjl-${handId}-g${groupIndex}`;

  if (group.type === "news") {
    const winds = ["north", "east", "west", "south"] as const;
    return winds.map((w, i) => ({
      kind: "tile" as const,
      tile: {
        id: `${idPrefix}-news-${w}`,
        category: "wind" as const,
        value: w,
        copy: i + 1,
      },
    }));
  }

  if (group.type === "dragon_set") {
    const dragons = ["red", "green", "soap"] as const;
    return dragons.map((d, i) => ({
      kind: "tile" as const,
      tile: {
        id: `${idPrefix}-ds-${d}`,
        category: "dragon" as const,
        value: d,
        copy: i + 1,
      },
    }));
  }

  if (!group.tile) {
    return [{ kind: "text", text: "—" }];
  }

  return requirementToDisplayItems(group.tile, size, suitMapping, nValue, idPrefix);
}

export function groupTypeLabel(type: GroupPattern["type"]): string {
  switch (type) {
    case "single":
      return "1";
    case "pair":
      return "Pr";
    case "pung":
      return "P";
    case "kong":
      return "K";
    case "quint":
      return "Q";
    case "sextet":
      return "Sx";
    case "news":
      return "NEWS";
    case "dragon_set":
      return "3 Dr";
  }
}
