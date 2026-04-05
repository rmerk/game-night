import { expect, test } from "vite-plus/test";
import {
  PROTOCOL_VERSION,
  type PlayerGameView,
  type SuitedTile,
  type Tile,
  type TileValue,
} from "@mahjong-game/shared";
import {
  mapPlayerGameViewToGameTableProps,
  reactionBubbleAnchorForLobby,
  reactionBubbleAnchorForPlayer,
} from "./mapPlayerGameViewToGameTable";
import { parseServerMessage } from "./parseServerMessage";

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
    paused: false,
    deadSeatPlayerIds: [],
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

test("reactionBubbleAnchorForPlayer matches opponent slots for south-local view", () => {
  const v = minimalPlayerView();
  expect(reactionBubbleAnchorForPlayer(v, "pS")).toBe("local");
  expect(reactionBubbleAnchorForPlayer(v, "pN")).toBe("top");
  expect(reactionBubbleAnchorForPlayer(v, "pE")).toBe("left");
  expect(reactionBubbleAnchorForPlayer(v, "pW")).toBe("right");
});

test("reactionBubbleAnchorForPlayer returns null for unknown playerId", () => {
  const v = minimalPlayerView();
  expect(reactionBubbleAnchorForPlayer(v, "ghost")).toBeNull();
});

test("reactionBubbleAnchorForLobby matches in-play geometry for same winds", () => {
  const lobby = {
    myPlayerId: "pS",
    players: minimalPlayerView().players,
  };
  expect(reactionBubbleAnchorForLobby(lobby, "pS")).toBe("local");
  expect(reactionBubbleAnchorForLobby(lobby, "pN")).toBe("top");
  expect(reactionBubbleAnchorForLobby(lobby, "pE")).toBe("left");
  expect(reactionBubbleAnchorForLobby(lobby, "pW")).toBe("right");
});

test("maps discard pools by seat relative to local player", () => {
  const m = mapPlayerGameViewToGameTableProps(minimalPlayerView());
  expect(m.discardPools.bottom?.map((x) => x.id)).toEqual(["crak-4-1"]);
  expect(m.discardPools.top?.map((x) => x.id)).toEqual(["bam-6-1"]);
  expect(m.discardPools.left?.map((x) => x.id)).toEqual(["bam-3-1"]);
  expect(m.discardPools.right?.map((x) => x.id)).toEqual(["dot-5-1"]);
});

test("sets invalidMahjongMessage from INVALID_MAHJONG_WARNING resolvedAction for viewer", () => {
  const view = minimalPlayerView();
  const m = mapPlayerGameViewToGameTableProps(view, {
    resolvedAction: {
      type: "INVALID_MAHJONG_WARNING",
      playerId: "pS",
      reason: "No matching pattern",
    },
  });
  expect(m.invalidMahjongMessage).toBe("No matching pattern");
});

test("sets canRequestTableTalkReport when server rules would allow a new report", () => {
  const view = minimalPlayerView({
    gamePhase: "play",
    tableTalkReportCountsByPlayerId: { pS: 1 },
  });
  const m = mapPlayerGameViewToGameTableProps(view);
  expect(m.canRequestTableTalkReport).toBe(true);
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

test("play-phase STATE_UPDATE JSON parses and maps to GameTable-bound props", () => {
  const view = minimalPlayerView();
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "STATE_UPDATE",
    state: view,
  });
  const p = parseServerMessage(raw);
  expect(p?.kind).toBe("state_update");
  if (p?.kind !== "state_update") {
    return;
  }
  const m = mapPlayerGameViewToGameTableProps(p.message.state as PlayerGameView);
  expect(m.gamePhase).toBe("play");
  expect(m.tiles.length).toBeGreaterThan(0);
  expect(m.localPlayer?.id).toBe("pS");
  expect(m.opponents.top?.seatWind).toBe("north");
});
