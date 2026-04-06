import { describe, expect, it } from "vite-plus/test";
import type { ResolvedAction } from "@mahjong-game/shared";
import { tickerCopyForAction } from "./activityTickerCopy";

const names: Record<string, string> = {
  p1: "Linda",
  p2: "Sarah",
  local: "LocalName",
};

describe("tickerCopyForAction", () => {
  it("uses You for local player", () => {
    const ra: ResolvedAction = { type: "DISCARD_TILE", playerId: "local", tileId: "dot-8-2" };
    expect(tickerCopyForAction(ra, names, "local")).toBe("You discarded 8-Dot");
  });

  it("formats discard for other players", () => {
    const ra: ResolvedAction = { type: "DISCARD_TILE", playerId: "p1", tileId: "bam-2-1" };
    expect(tickerCopyForAction(ra, names, "local")).toBe("Linda discarded 2-Bam");
  });

  it("returns null for skipped types", () => {
    const ra: ResolvedAction = {
      type: "CALL_WINDOW_OPENED",
      discarderId: "p1",
      discardedTileId: "x",
    };
    expect(tickerCopyForAction(ra, names, "local")).toBeNull();
  });

  it("covers draw and calls", () => {
    expect(tickerCopyForAction({ type: "DRAW_TILE", playerId: "p2" }, names, "local")).toBe(
      "Sarah drew",
    );
    expect(tickerCopyForAction({ type: "CALL_PUNG", playerId: "p2" }, names, "local")).toBe(
      "Sarah called Pung",
    );
    expect(
      tickerCopyForAction(
        {
          type: "CALL_CONFIRMED",
          callerId: "p1",
          callType: "pung",
          exposedTileIds: [],
          calledTileId: "x",
          fromPlayerId: "p2",
          groupIdentity: { type: "pung" },
        },
        names,
        "local",
      ),
    ).toBe("Linda exposed Pung");
  });

  it("covers wall game and mahjong", () => {
    expect(tickerCopyForAction({ type: "WALL_GAME" }, names, "local")).toBe(
      "Wall game — no winner",
    );
    expect(
      tickerCopyForAction(
        {
          type: "MAHJONG_DECLARED",
          winnerId: "p2",
          patternId: "x",
          patternName: "y",
          points: 1,
          selfDrawn: false,
        },
        names,
        "local",
      ),
    ).toBe("Sarah declared Mahjong!");
  });

  it("covers joker exchange", () => {
    const ra: ResolvedAction = {
      type: "JOKER_EXCHANGE",
      playerId: "p1",
      jokerGroupId: "g",
      jokerTileId: "j1",
      naturalTileId: "n1",
    };
    expect(tickerCopyForAction(ra, names, "local")).toBe("Linda exchanged a joker");
  });
});
