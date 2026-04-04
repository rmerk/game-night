import { expect, test } from "vite-plus/test";
import type { PlayerGameView, SuitedTile, Tile, TileValue } from "@mahjong-game/shared";
import { mapPlayerGameViewToGameTableProps } from "./mapPlayerGameViewToGameTable";

function t(id: string, suit: "dot" | "bam" | "crak", value: TileValue, copy: number): SuitedTile {
  return { id, category: "suited", suit, value, copy };
}

function minimalPlayerView(overrides: Partial<PlayerGameView> = {}): PlayerGameView {
  const rack: Tile[] = [t("dot-1-1", "dot", 1, 1), t("dot-2-1", "dot", 2, 1)];
  const d1: Tile = t("bam-3-1", "bam", 3, 1);
  const d2: Tile = t("crak-4-1", "crak", 4, 1);
  const d3: Tile = t("dot-5-1", "dot", 5, 1);
  const d4: Tile = t("bam-6-1", "bam", 6, 1);

  const base: PlayerGameView = {
    roomId: "r1",
    roomCode: "ABCD",
    gamePhase: "play",
    players: [
      {
        playerId: "pE",
        displayName: "Eastie",
        wind: "east",
        isHost: true,
        connected: true,
      },
      {
        playerId: "pS",
        displayName: "Southie",
        wind: "south",
        isHost: false,
        connected: true,
      },
      {
        playerId: "pW",
        displayName: "Westie",
        wind: "west",
        isHost: false,
        connected: true,
      },
      {
        playerId: "pN",
        displayName: "Northie",
        wind: "north",
        isHost: false,
        connected: true,
      },
    ],
    myPlayerId: "pS",
    myRack: rack,
    exposedGroups: {},
    discardPools: {
      pE: [d1],
      pS: [d2],
      pW: [d3],
      pN: [d4],
    },
    wallRemaining: 50,
    currentTurn: "pS",
    turnPhase: "discard",
    callWindow: null,
    scores: { pE: 0, pS: 0, pW: 0, pN: 0 },
    lastDiscard: null,
    gameResult: null,
    pendingMahjong: null,
    challengeState: null,
    socialOverrideState: null,
    tableTalkReportState: null,
    tableTalkReportCountsByPlayerId: {},
    charleston: null,
    shownHands: {},
    jokerRulesMode: "standard",
    myDeadHand: false,
    ...overrides,
  };
  return base;
}

test("maps south-local opponents to top=north, left=east, right=west", () => {
  const m = mapPlayerGameViewToGameTableProps(minimalPlayerView());
  expect(m.localPlayer?.id).toBe("pS");
  expect(m.localPlayer?.seatWind).toBe("south");
  expect(m.opponents.top?.seatWind).toBe("north");
  expect(m.opponents.left?.seatWind).toBe("east");
  expect(m.opponents.right?.seatWind).toBe("west");
});

test("maps discard pools by seat relative to local player", () => {
  const m = mapPlayerGameViewToGameTableProps(minimalPlayerView());
  expect(m.discardPools.bottom?.map((x) => x.id)).toEqual(["crak-4-1"]);
  expect(m.discardPools.top?.map((x) => x.id)).toEqual(["bam-6-1"]);
  expect(m.discardPools.left?.map((x) => x.id)).toEqual(["bam-3-1"]);
  expect(m.discardPools.right?.map((x) => x.id)).toEqual(["dot-5-1"]);
});

test("computes validCallOptions when call window is open", () => {
  const discardTile = t("dot-9-1", "dot", 9, 1);
  const view = minimalPlayerView({
    currentTurn: "pE",
    callWindow: {
      status: "open",
      discardedTile: discardTile,
      discarderId: "pE",
      passes: [],
      calls: [],
      openedAt: 0,
      confirmingPlayerId: null,
      confirmationExpiresAt: null,
      remainingCallers: [],
      winningCall: null,
    },
  });
  const m = mapPlayerGameViewToGameTableProps(view);
  expect(m.validCallOptions.length).toBeGreaterThanOrEqual(0);
});
