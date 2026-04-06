import { describe, it, expect } from "vite-plus/test";
import {
  DEFAULT_ROOM_SETTINGS,
  type PlayerGameView,
  type SuitedTile,
  type Tile,
  type TileSuit,
  type TileValue,
} from "@mahjong-game/shared";
import {
  buildGameActionFromTableEvent,
  getRequiredRackCountForCallType,
  tileIdsForCall,
} from "./gameActionFromPlayerView";

const suited = (id: string, suit: TileSuit, value: TileValue): SuitedTile => ({
  id,
  category: "suited",
  suit,
  value,
  copy: 1,
});

function minimalView(overrides: Partial<PlayerGameView> = {}): PlayerGameView {
  const rack: Tile[] = [
    suited("bam-1-1", "bam", 1),
    suited("bam-1-2", "bam", 1),
    suited("bam-3-1", "bam", 3),
  ];
  const base: PlayerGameView = {
    roomId: "r1",
    roomCode: "ABC",
    gamePhase: "play",
    players: [],
    myPlayerId: "p-south",
    myRack: rack,
    exposedGroups: {},
    discardPools: {},
    wallRemaining: 50,
    currentTurn: "p-east",
    turnPhase: "callWindow",
    callWindow: null,
    scores: {},
    sessionScoresFromPriorGames: {},
    sessionGameHistory: [],
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
    settings: DEFAULT_ROOM_SETTINGS,
    myDeadHand: false,
    paused: false,
    deadSeatPlayerIds: [],
    departureVoteState: null,
  };
  return { ...base, ...overrides };
}

describe("getRequiredRackCountForCallType", () => {
  it("matches tileIdsForCall / engine counts", () => {
    expect(getRequiredRackCountForCallType("pung")).toBe(2);
    expect(getRequiredRackCountForCallType("kong")).toBe(3);
    expect(getRequiredRackCountForCallType("quint")).toBe(4);
    expect(getRequiredRackCountForCallType("news")).toBe(3);
    expect(getRequiredRackCountForCallType("dragon_set")).toBe(2);
    expect(getRequiredRackCountForCallType("mahjong")).toBe(0);
  });
});

describe("buildGameActionFromTableEvent — confirm / retract call", () => {
  const discardedTile = suited("dot-9-1", "dot", 9);

  it("returns CONFIRM_CALL for confirming pung with valid tile ids", () => {
    const view = minimalView({
      callWindow: {
        status: "confirming",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: "p-south",
        confirmationExpiresAt: 999999,
        remainingCallers: [],
        winningCall: {
          callType: "pung",
          playerId: "p-south",
          tileIds: ["bam-1-1", "bam-1-2"],
        },
      },
    });
    const action = buildGameActionFromTableEvent(view, {
      type: "confirmCall",
      tileIds: ["bam-1-1", "bam-1-2"],
    });
    expect(action).toEqual({
      type: "CONFIRM_CALL",
      playerId: "p-south",
      tileIds: ["bam-1-1", "bam-1-2"],
    });
  });

  it("returns null when not confirming player", () => {
    const view = minimalView({
      callWindow: {
        status: "confirming",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: "p-north",
        confirmationExpiresAt: 999999,
        remainingCallers: [],
        winningCall: {
          callType: "pung",
          playerId: "p-north",
          tileIds: ["bam-1-1", "bam-1-2"],
        },
      },
    });
    expect(
      buildGameActionFromTableEvent(view, {
        type: "confirmCall",
        tileIds: ["bam-1-1", "bam-1-2"],
      }),
    ).toBeNull();
  });

  it("returns null when tile count wrong for call type", () => {
    const view = minimalView({
      callWindow: {
        status: "confirming",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: "p-south",
        confirmationExpiresAt: 999999,
        remainingCallers: [],
        winningCall: {
          callType: "pung",
          playerId: "p-south",
          tileIds: ["bam-1-1", "bam-1-2"],
        },
      },
    });
    expect(
      buildGameActionFromTableEvent(view, {
        type: "confirmCall",
        tileIds: ["bam-1-1"],
      }),
    ).toBeNull();
  });

  it("returns null when confirmCall tileIds contains duplicates", () => {
    const view = minimalView({
      callWindow: {
        status: "confirming",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: "p-south",
        confirmationExpiresAt: 999999,
        remainingCallers: [],
        winningCall: {
          callType: "pung",
          playerId: "p-south",
          tileIds: ["bam-1-1", "bam-1-2"],
        },
      },
    });
    expect(
      buildGameActionFromTableEvent(view, {
        type: "confirmCall",
        tileIds: ["bam-1-1", "bam-1-1"],
      }),
    ).toBeNull();
  });

  it("returns null when confirmCall tile id is not on rack", () => {
    const view = minimalView({
      callWindow: {
        status: "confirming",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: "p-south",
        confirmationExpiresAt: 999999,
        remainingCallers: [],
        winningCall: {
          callType: "pung",
          playerId: "p-south",
          tileIds: ["bam-1-1", "bam-1-2"],
        },
      },
    });
    expect(
      buildGameActionFromTableEvent(view, {
        type: "confirmCall",
        tileIds: ["bam-1-1", "not-on-my-rack"],
      }),
    ).toBeNull();
  });

  it("returns CONFIRM_CALL for mahjong with single placeholder tile id", () => {
    const view = minimalView({
      callWindow: {
        status: "confirming",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: "p-south",
        confirmationExpiresAt: 999999,
        remainingCallers: [],
        winningCall: {
          callType: "mahjong",
          playerId: "p-south",
          tileIds: ["bam-1-1"],
        },
      },
    });
    const action = buildGameActionFromTableEvent(view, {
      type: "confirmCall",
      tileIds: ["bam-3-1"],
    });
    expect(action).toEqual({
      type: "CONFIRM_CALL",
      playerId: "p-south",
      tileIds: ["bam-3-1"],
    });
  });

  it("returns RETRACT_CALL when confirming", () => {
    const view = minimalView({
      callWindow: {
        status: "confirming",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: "p-south",
        confirmationExpiresAt: 999999,
        remainingCallers: [],
        winningCall: {
          callType: "pung",
          playerId: "p-south",
          tileIds: ["bam-1-1", "bam-1-2"],
        },
      },
    });
    expect(buildGameActionFromTableEvent(view, { type: "retractCall" })).toEqual({
      type: "RETRACT_CALL",
      playerId: "p-south",
    });
  });

  it("returns null for retract when not confirming", () => {
    const view = minimalView({
      callWindow: {
        status: "open",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: null,
        confirmationExpiresAt: null,
        remainingCallers: [],
        winningCall: null,
      },
    });
    expect(buildGameActionFromTableEvent(view, { type: "retractCall" })).toBeNull();
  });
});

describe("tileIdsForCall (open window)", () => {
  it("still uses same counts as getRequiredRackCountForCallType for pung", () => {
    const discardedTile = suited("dot-9-1", "dot", 9);
    const myRack: Tile[] = [
      suited("dot-9-2", "dot", 9),
      suited("dot-9-3", "dot", 9),
      suited("dot-7-1", "dot", 7),
    ];
    const view = minimalView({
      myRack,
      callWindow: {
        status: "open",
        discardedTile,
        discarderId: "p-east",
        passes: [],
        calls: [],
        openedAt: 0,
        confirmingPlayerId: null,
        confirmationExpiresAt: null,
        remainingCallers: [],
        winningCall: null,
      },
    });
    const ids = tileIdsForCall(view, "pung");
    expect(ids.length).toBe(getRequiredRackCountForCallType("pung"));
  });
});
