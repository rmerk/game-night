/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- message payloads are intentionally inspected as loose JSON fixtures in broadcaster tests */
import { describe, expect, it, vi, type Mock } from "vitest";
import { WebSocket } from "ws";
import { loadCard, type GameState, type SeatWind } from "@mahjong-game/shared";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";
import type { FastifyBaseLogger } from "fastify";
import { buildPlayerView, buildSpectatorView, broadcastGameState } from "./state-broadcaster";

/** Extract the mock send function from a mock WebSocket */
function mockSend(ws: WebSocket): Mock {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- accessing vi.fn() mock, not a real WebSocket method
  return ws.send as unknown as Mock;
}

/** Parse the first message sent via a mock WebSocket's send */
function parseSentMessage(ws: WebSocket): Record<string, unknown> {
  const calls = mockSend(ws).mock.calls;
  return JSON.parse(calls[0][0] as string) as Record<string, unknown>;
}

function createMockLogger(): FastifyBaseLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as FastifyBaseLogger;
}

function createTestPlayer(id: string, wind: SeatWind, isHost = false): PlayerInfo {
  return {
    playerId: id,
    displayName: `Player ${id}`,
    wind,
    isHost,
    connected: true,
    connectedAt: Date.now(),
  };
}

function createMockWs(readyState: number = WebSocket.OPEN): WebSocket {
  return {
    readyState,
    send: vi.fn(),
  } as unknown as WebSocket;
}

function createTestRoom(players: PlayerInfo[], wsList: WebSocket[]): Room {
  const room: Room = {
    roomId: "test-room-id",
    roomCode: "TEST01",
    hostToken: "host-token",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    lifecycleTimers: new Map(),
    socialOverrideTimer: null,
    tableTalkReportTimer: null,
    gameState: null,
    jokerRulesMode: "standard",
    createdAt: Date.now(),
    logger: createMockLogger(),
  };

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    room.players.set(player.playerId, player);
    const session: PlayerSession = {
      player,
      roomCode: room.roomCode,
      ws: wsList[i],
    };
    room.sessions.set(player.playerId, session);
  }

  return room;
}

function createTestGameState(): GameState {
  return {
    gamePhase: "play",
    players: {
      "player-0": {
        id: "player-0",
        seatWind: "east",
        rack: [
          { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 },
          { id: "bam-2-1", category: "suited", suit: "bam", value: 2, copy: 1 },
        ],
        exposedGroups: [],
        discardPool: [{ id: "dot-5-1", category: "suited", suit: "dot", value: 5, copy: 1 }],
        deadHand: false,
      },
      "player-1": {
        id: "player-1",
        seatWind: "south",
        rack: [
          { id: "crak-3-1", category: "suited", suit: "crak", value: 3, copy: 1 },
          { id: "crak-4-1", category: "suited", suit: "crak", value: 4, copy: 1 },
        ],
        exposedGroups: [],
        discardPool: [],
        deadHand: false,
      },
    },
    wall: [],
    wallRemaining: 100,
    currentTurn: "player-0",
    turnPhase: "discard",
    lastDiscard: null,
    callWindow: null,
    scores: { "player-0": 0, "player-1": 0 },
    gameResult: null,
    card: null,
    pendingMahjong: null,
    challengeState: null,
    socialOverrideState: null,
    tableTalkReportState: null,
    tableTalkReportCountsByPlayerId: {},
    hostAuditLog: [],
    charleston: null,
    shownHands: {},
    jokerRulesMode: "standard",
  };
}

/** All 4 players with completely distinct tile IDs for exhaustive leak detection */
function createFourPlayerGameState(): GameState {
  return {
    gamePhase: "play",
    players: {
      "player-0": {
        id: "player-0",
        seatWind: "east",
        rack: [
          { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 },
          { id: "bam-2-1", category: "suited", suit: "bam", value: 2, copy: 1 },
          { id: "bam-3-1", category: "suited", suit: "bam", value: 3, copy: 1 },
        ],
        exposedGroups: [],
        discardPool: [{ id: "bam-9-1", category: "suited", suit: "bam", value: 9, copy: 1 }],
        deadHand: false,
      },
      "player-1": {
        id: "player-1",
        seatWind: "south",
        rack: [
          { id: "crak-1-1", category: "suited", suit: "crak", value: 1, copy: 1 },
          { id: "crak-2-1", category: "suited", suit: "crak", value: 2, copy: 1 },
          { id: "crak-3-1", category: "suited", suit: "crak", value: 3, copy: 1 },
        ],
        exposedGroups: [],
        discardPool: [{ id: "crak-9-1", category: "suited", suit: "crak", value: 9, copy: 1 }],
        deadHand: false,
      },
      "player-2": {
        id: "player-2",
        seatWind: "west",
        rack: [
          { id: "dot-1-1", category: "suited", suit: "dot", value: 1, copy: 1 },
          { id: "dot-2-1", category: "suited", suit: "dot", value: 2, copy: 1 },
          { id: "dot-3-1", category: "suited", suit: "dot", value: 3, copy: 1 },
        ],
        exposedGroups: [],
        discardPool: [],
        deadHand: false,
      },
      "player-3": {
        id: "player-3",
        seatWind: "north",
        rack: [
          { id: "wind-north-1", category: "wind", value: "north", copy: 1 },
          { id: "wind-south-1", category: "wind", value: "south", copy: 1 },
          { id: "wind-east-1", category: "wind", value: "east", copy: 1 },
        ],
        exposedGroups: [],
        discardPool: [],
        deadHand: false,
      },
    },
    wall: [],
    wallRemaining: 80,
    currentTurn: "player-0",
    turnPhase: "discard",
    lastDiscard: null,
    callWindow: null,
    scores: { "player-0": 0, "player-1": 0, "player-2": 0, "player-3": 0 },
    gameResult: null,
    card: null,
    pendingMahjong: null,
    challengeState: null,
    socialOverrideState: null,
    tableTalkReportState: null,
    tableTalkReportCountsByPlayerId: {},
    hostAuditLog: [],
    charleston: null,
    shownHands: {},
    jokerRulesMode: "standard",
  };
}

/** Tile IDs in each player's rack — used for cross-player leak assertions */
const PLAYER_RACK_TILE_IDS: Record<string, string[]> = {
  "player-0": ["bam-1-1", "bam-2-1", "bam-3-1"],
  "player-1": ["crak-1-1", "crak-2-1", "crak-3-1"],
  "player-2": ["dot-1-1", "dot-2-1", "dot-3-1"],
  "player-3": ["wind-north-1", "wind-south-1", "wind-east-1"],
};

function createFourPlayerRoom(): { room: Room; wsList: WebSocket[] } {
  const players = [
    createTestPlayer("player-0", "east", true),
    createTestPlayer("player-1", "south"),
    createTestPlayer("player-2", "west"),
    createTestPlayer("player-3", "north"),
  ];
  const wsList = [createMockWs(), createMockWs(), createMockWs(), createMockWs()];
  const room = createTestRoom(players, wsList);
  return { room, wsList };
}

describe("buildPlayerView", () => {
  it("includes the requesting player's own rack", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view = buildPlayerView(room, gameState, "player-0");

    expect(view.myRack).toHaveLength(2);
    expect(view.myRack[0].id).toBe("bam-1-1");
    expect(view.myRack[1].id).toBe("bam-2-1");
    expect(view.myPlayerId).toBe("player-0");
  });

  it("includes jokerRulesMode from GameState", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();
    gameState.jokerRulesMode = "simplified";
    const view = buildPlayerView(room, gameState, "player-0");
    expect(view.jokerRulesMode).toBe("simplified");
  });

  it("does NOT include opponent rack data in the view", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view0 = buildPlayerView(room, gameState, "player-0");
    const view1 = buildPlayerView(room, gameState, "player-1");

    // player-0's view should NOT contain player-1's rack tiles
    const view0Str = JSON.stringify(view0);
    expect(view0Str).not.toContain("crak-3-1");
    expect(view0Str).not.toContain("crak-4-1");

    // player-1's view should NOT contain player-0's rack tiles
    const view1Str = JSON.stringify(view1);
    expect(view1Str).not.toContain("bam-1-1");
    expect(view1Str).not.toContain("bam-2-1");

    // Each sees their own rack
    expect(view0.myRack).toHaveLength(2);
    expect(view1.myRack).toHaveLength(2);
  });

  it("includes only filtered Charleston metadata and never leaks hidden across tiles", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.gamePhase = "charleston";
    gameState.charleston = {
      stage: "first",
      status: "passing",
      currentDirection: "left",
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: ["player-0"],
      lockedTileIdsByPlayerId: {
        "player-0": ["bam-1-1", "bam-2-1", "bam-3-1"],
      },
      hiddenAcrossTilesByPlayerId: {
        "player-0": [
          { id: "flower-a-1", category: "flower", value: "a", copy: 1 },
          { id: "flower-a-2", category: "flower", value: "a", copy: 2 },
          { id: "flower-a-3", category: "flower", value: "a", copy: 3 },
        ],
      },
      votesByPlayerId: {},
      courtesyPairings: [],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const playerView = buildPlayerView(room, gameState, "player-0");
    const spectatorView = buildSpectatorView(room, gameState);
    const playerViewJson = JSON.stringify(playerView);
    const spectatorViewJson = JSON.stringify(spectatorView);

    expect(playerView.charleston).toMatchObject({
      stage: "first",
      status: "passing",
      currentDirection: "left",
      submittedPlayerIds: ["player-0"],
      votesReceivedCount: 0,
      courtesyPairings: [],
      myHiddenTileCount: 3,
      mySubmissionLocked: true,
      myVote: null,
    });
    expect(playerView.charleston).not.toHaveProperty("lockedTileIdsByPlayerId");
    expect(playerView.charleston).not.toHaveProperty("hiddenAcrossTilesByPlayerId");
    expect(spectatorView.charleston).toMatchObject({
      stage: "first",
      status: "passing",
      currentDirection: "left",
      submittedPlayerIds: ["player-0"],
      votesReceivedCount: 0,
      courtesyPairings: [],
    });
    expect(spectatorView.charleston).not.toHaveProperty("myHiddenTileCount");

    for (const hiddenTileId of ["flower-a-1", "flower-a-2", "flower-a-3"]) {
      expect(playerViewJson).not.toContain(hiddenTileId);
      expect(spectatorViewJson).not.toContain(hiddenTileId);
    }
  });

  it("exposes only aggregate vote progress plus the requesting player's own vote", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.gamePhase = "charleston";
    gameState.charleston = {
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: ["player-0", "player-1"],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: {
        "player-0": true,
        "player-1": false,
      },
      courtesyPairings: [],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const playerZeroView = buildPlayerView(room, gameState, "player-0");
    const playerTwoView = buildPlayerView(room, gameState, "player-2");
    const spectatorView = buildSpectatorView(room, gameState);

    expect(playerZeroView.charleston).toMatchObject({
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      submittedPlayerIds: [],
      votesReceivedCount: 2,
      mySubmissionLocked: true,
      myVote: true,
    });
    expect(playerTwoView.charleston).toMatchObject({
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      submittedPlayerIds: [],
      votesReceivedCount: 2,
      mySubmissionLocked: false,
      myVote: null,
    });
    expect(spectatorView.charleston).toMatchObject({
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      submittedPlayerIds: [],
      votesReceivedCount: 2,
    });

    expect(playerZeroView.charleston).not.toHaveProperty("votesByPlayerId");
    expect(playerTwoView.charleston).not.toHaveProperty("votesByPlayerId");
    expect(spectatorView.charleston).not.toHaveProperty("votesByPlayerId");
  });

  it("exposes courtesy pairings without leaking stale vote or hidden-tile internals", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.gamePhase = "charleston";
    gameState.charleston = {
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: [],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: {},
      courtesyPairings: [
        ["player-0", "player-2"],
        ["player-1", "player-3"],
      ],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    const playerView = buildPlayerView(room, gameState, "player-0");
    const spectatorView = buildSpectatorView(room, gameState);

    expect(playerView.charleston).toMatchObject({
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      courtesyPairings: [
        ["player-0", "player-2"],
        ["player-1", "player-3"],
      ],
      courtesyResolvedPairCount: 0,
      myVote: null,
      myCourtesySubmission: null,
    });
    expect(spectatorView.charleston).toMatchObject({
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      courtesyPairings: [
        ["player-0", "player-2"],
        ["player-1", "player-3"],
      ],
      courtesyResolvedPairCount: 0,
    });
    expect(playerView.charleston).not.toHaveProperty("hiddenAcrossTilesByPlayerId");
    expect(playerView.charleston).not.toHaveProperty("lockedTileIdsByPlayerId");
  });

  it("restores only the requesting player's courtesy submission without leaking partner details", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.gamePhase = "charleston";
    gameState.charleston = {
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: [],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: {},
      courtesyPairings: [
        ["player-0", "player-2"],
        ["player-1", "player-3"],
      ],
      courtesySubmissionsByPlayerId: {
        "player-0": {
          count: 3,
          tileIds: ["bam-1-1", "bam-2-1", "bam-3-1"],
        },
        "player-2": {
          count: 2,
          tileIds: ["dot-1-1", "dot-2-1"],
        },
      },
      courtesyResolvedPairings: [["player-1", "player-3"]],
    };

    const playerZeroView = buildPlayerView(room, gameState, "player-0");
    const playerOneView = buildPlayerView(room, gameState, "player-1");
    const spectatorView = buildSpectatorView(room, gameState);
    const playerZeroJson = JSON.stringify(playerZeroView);

    expect(playerZeroView.charleston).toMatchObject({
      stage: "courtesy",
      status: "courtesy-ready",
      courtesyPairings: [
        ["player-0", "player-2"],
        ["player-1", "player-3"],
      ],
      courtesyResolvedPairCount: 1,
      mySubmissionLocked: true,
      myCourtesySubmission: {
        count: 3,
        tileIds: ["bam-1-1", "bam-2-1", "bam-3-1"],
      },
    });
    expect(playerOneView.charleston).toMatchObject({
      stage: "courtesy",
      status: "courtesy-ready",
      courtesyResolvedPairCount: 1,
      mySubmissionLocked: false,
      myCourtesySubmission: null,
    });
    expect(spectatorView.charleston).toMatchObject({
      stage: "courtesy",
      status: "courtesy-ready",
      courtesyResolvedPairCount: 1,
    });

    expect(playerOneView.charleston?.myCourtesySubmission).toBeNull();
    expect(spectatorView.charleston).not.toHaveProperty("myCourtesySubmission");
    expect(spectatorView.charleston).not.toHaveProperty("courtesySubmissionsByPlayerId");
    expect(playerOneView.charleston).not.toHaveProperty("courtesySubmissionsByPlayerId");

    const parseCharleston = (
      view: typeof playerOneView | typeof spectatorView,
    ): Record<string, unknown> | null => {
      const ch = view.charleston;
      return ch && typeof ch === "object" ? (ch as unknown as Record<string, unknown>) : null;
    };
    const forbiddenInPartnerViews = [
      "bam-1-1",
      "bam-2-1",
      "bam-3-1",
      "dot-1-1",
      "dot-2-1",
    ] as const;
    for (const view of [playerOneView, spectatorView]) {
      const ch = parseCharleston(view);
      expect(ch).not.toBeNull();
      for (const secret of forbiddenInPartnerViews) {
        expect(JSON.stringify(ch)).not.toContain(secret);
      }
    }

    expect(playerZeroView.charleston?.myCourtesySubmission).toEqual({
      count: 3,
      tileIds: ["bam-1-1", "bam-2-1", "bam-3-1"],
    });
    expect(playerZeroJson).toContain("bam-1-1");
    expect(playerZeroJson).not.toContain("dot-1-1");
    expect(playerZeroView.charleston).not.toHaveProperty("courtesySubmissionsByPlayerId");
    expect(spectatorView.charleston).not.toHaveProperty("courtesySubmissionsByPlayerId");
  });

  it("includes all public state fields", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view = buildPlayerView(room, gameState, "player-0");

    expect(view.roomId).toBe("test-room-id");
    expect(view.roomCode).toBe("TEST01");
    expect(view.gamePhase).toBe("play");
    expect(view.wallRemaining).toBe(100);
    expect(view.currentTurn).toBe("player-0");
    expect(view.turnPhase).toBe("discard");
    expect(view.callWindow).toBeNull();
    expect(view.scores).toEqual({ "player-0": 0, "player-1": 0 });
    expect(view.lastDiscard).toBeNull();
    expect(view.gameResult).toBeNull();
    expect(view.pendingMahjong).toBeNull();
    expect(view.challengeState).toBeNull();
    expect(view.socialOverrideState).toBeNull();
    expect(view.tableTalkReportState).toBeNull();
    expect(view.tableTalkReportCountsByPlayerId).toEqual({});
    expect(view.hostAuditLog).toEqual([]);
    expect(view.myDeadHand).toBe(false);
  });

  it("omits hostAuditLog for non-host players when log has entries", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();
    gameState.hostAuditLog = ["[Social Override] host-only line"];

    const hostView = buildPlayerView(room, gameState, "player-0");
    const nonHostView = buildPlayerView(room, gameState, "player-1");

    expect(hostView.hostAuditLog).toEqual(["[Social Override] host-only line"]);
    expect(nonHostView).not.toHaveProperty("hostAuditLog");
  });

  it("sets myDeadHand from player deadHand flag", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();
    gameState.players["player-0"].deadHand = true;

    const view0 = buildPlayerView(room, gameState, "player-0");
    const view1 = buildPlayerView(room, gameState, "player-1");

    expect(view0.myDeadHand).toBe(true);
    expect(view1.myDeadHand).toBe(false);
  });

  it("includes all players' exposed groups and discard pools", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view = buildPlayerView(room, gameState, "player-0");

    expect(view.exposedGroups).toHaveProperty("player-0");
    expect(view.exposedGroups).toHaveProperty("player-1");
    expect(view.discardPools).toHaveProperty("player-0");
    expect(view.discardPools).toHaveProperty("player-1");
    expect(view.discardPools["player-0"]).toHaveLength(1);
  });

  it("includes player public info with connection status", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    const view = buildPlayerView(room, gameState, "player-0");

    expect(view.players).toHaveLength(2);
    expect(view.players[0]).toMatchObject({
      playerId: "player-0",
      displayName: "Player player-0",
      wind: "east",
      isHost: true,
      connected: true,
    });
  });

  it("includes call window state when present", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();
    gameState.callWindow = {
      status: "open",
      discardedTile: { id: "dot-5-1", category: "suited", suit: "dot", value: 5, copy: 1 },
      discarderId: "player-0",
      passes: [],
      calls: [],
      openedAt: Date.now(),
      confirmingPlayerId: null,
      confirmationExpiresAt: null,
      remainingCallers: [],
      winningCall: null,
    };

    const view = buildPlayerView(room, gameState, "player-1");

    expect(view.callWindow).not.toBeNull();
    expect(view.callWindow!.status).toBe("open");
    expect(view.callWindow!.discarderId).toBe("player-0");
  });
});

describe("broadcastGameState", () => {
  it("sends STATE_UPDATE to all connected players with filtered views", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    broadcastGameState(room, gameState);

    // Both players should receive messages
    expect(mockSend(wsList[0])).toHaveBeenCalledOnce();
    expect(mockSend(wsList[1])).toHaveBeenCalledOnce();

    // Parse the messages
    const msg0 = parseSentMessage(wsList[0]);
    const msg1 = parseSentMessage(wsList[1]);
    const state0 = msg0.state as Record<string, unknown>;
    const state1 = msg1.state as Record<string, unknown>;

    expect(msg0.type).toBe("STATE_UPDATE");
    expect(msg0.version).toBe(1);
    expect(state0.myPlayerId).toBe("player-0");
    expect(state0.myRack).toHaveLength(2);
    expect((state0.myRack as Array<Record<string, unknown>>)[0].id).toBe("bam-1-1");

    expect(msg1.type).toBe("STATE_UPDATE");
    expect(state1.myPlayerId).toBe("player-1");
    expect(state1.myRack).toHaveLength(2);
    expect((state1.myRack as Array<Record<string, unknown>>)[0].id).toBe("crak-3-1");

    // Cross-check: player-0 must not see player-1's rack
    const msg0Str = JSON.stringify(msg0);
    expect(msg0Str).not.toContain("crak-3-1");

    // Cross-check: player-1 must not see player-0's rack
    const msg1Str = JSON.stringify(msg1);
    expect(msg1Str).not.toContain("bam-1-1");
  });

  it("includes resolvedAction in broadcast", () => {
    const players = [createTestPlayer("player-0", "east", true)];
    const wsList = [createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    broadcastGameState(room, gameState, {
      type: "DISCARD_TILE",
      playerId: "player-0",
      tileId: "dot-5-1",
    });

    const msg = parseSentMessage(wsList[0]);
    expect(msg.resolvedAction).toEqual({
      type: "DISCARD_TILE",
      playerId: "player-0",
      tileId: "dot-5-1",
    });
  });

  it("omits DEAD_HAND_ENFORCED resolvedAction for viewers who are not the affected player", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    broadcastGameState(room, gameState, {
      type: "DEAD_HAND_ENFORCED",
      playerId: "player-1",
      reason: "INVALID_EXPOSED_GROUPS",
    });

    const msg0 = parseSentMessage(wsList[0]);
    const msg1 = parseSentMessage(wsList[1]);
    expect(msg0.resolvedAction).toBeUndefined();
    expect(msg1.resolvedAction).toEqual({
      type: "DEAD_HAND_ENFORCED",
      playerId: "player-1",
      reason: "INVALID_EXPOSED_GROUPS",
    });
  });

  it("omits INVALID_MAHJONG_WARNING resolvedAction for non-affected viewers", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    broadcastGameState(room, gameState, {
      type: "INVALID_MAHJONG_WARNING",
      playerId: "player-0",
      reason: "INVALID_HAND",
    });

    const msg0 = parseSentMessage(wsList[0]);
    const msg1 = parseSentMessage(wsList[1]);
    expect(msg0.resolvedAction).toEqual({
      type: "INVALID_MAHJONG_WARNING",
      playerId: "player-0",
      reason: "INVALID_HAND",
    });
    expect(msg1.resolvedAction).toBeUndefined();
  });

  it("broadcasts CHARLESTON_VOTE_CAST without peer vote fields on every socket", () => {
    const { room, wsList } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.gamePhase = "charleston";
    gameState.charleston = {
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      activePlayerIds: ["player-0", "player-1", "player-2", "player-3"],
      submittedPlayerIds: ["player-0"],
      lockedTileIdsByPlayerId: {},
      hiddenAcrossTilesByPlayerId: {},
      votesByPlayerId: { "player-0": true },
      courtesyPairings: [],
      courtesySubmissionsByPlayerId: {},
      courtesyResolvedPairings: [],
    };

    broadcastGameState(room, gameState, {
      type: "CHARLESTON_VOTE_CAST",
      votesReceivedCount: 1,
    });

    for (let i = 0; i < 4; i++) {
      const msg = parseSentMessage(wsList[i]);
      expect(msg.resolvedAction).toEqual({
        type: "CHARLESTON_VOTE_CAST",
        votesReceivedCount: 1,
      });
      const ra = JSON.stringify(msg.resolvedAction);
      expect(ra).not.toContain("accept");
      for (const pid of ["player-0", "player-1", "player-2", "player-3"]) {
        expect(ra).not.toContain(pid);
      }
    }
  });

  it("skips players with closed WebSocket connections", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
    ];
    const wsList = [createMockWs(), createMockWs(WebSocket.CLOSED)];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    broadcastGameState(room, gameState);

    expect(mockSend(wsList[0])).toHaveBeenCalledOnce();
    expect(mockSend(wsList[1])).not.toHaveBeenCalled();
  });
});

describe("AR31: Exhaustive 4-player view filtering security (hard requirement)", () => {
  const playerIds = ["player-0", "player-1", "player-2", "player-3"];

  it("EACH player's view contains ONLY their own rack — no other player's rack tiles leak (JSON stringification)", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();

    for (const playerId of playerIds) {
      const view = buildPlayerView(room, gameState, playerId);
      const viewStr = JSON.stringify(view);

      // Verify own rack present
      const ownTileIds = PLAYER_RACK_TILE_IDS[playerId];
      for (const tileId of ownTileIds) {
        expect(viewStr).toContain(tileId);
      }

      // Verify NO other player's rack tiles appear anywhere in the view
      for (const otherId of playerIds) {
        if (otherId === playerId) continue;
        const otherTileIds = PLAYER_RACK_TILE_IDS[otherId];
        for (const tileId of otherTileIds) {
          expect(viewStr).not.toContain(tileId);
        }
      }
    }
  });

  it("each view has correct myPlayerId and myRack length", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();

    for (const playerId of playerIds) {
      const view = buildPlayerView(room, gameState, playerId);
      expect(view.myPlayerId).toBe(playerId);
      expect(view.myRack).toHaveLength(3);
    }
  });

  it("all required public fields are present in each 4-player view", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();

    for (const playerId of playerIds) {
      const view = buildPlayerView(room, gameState, playerId);
      expect(view.roomId).toBe("test-room-id");
      expect(view.roomCode).toBe("TEST01");
      expect(view.gamePhase).toBe("play");
      expect(view.players).toHaveLength(4);
      expect(view.wallRemaining).toBe(80);
      expect(view.currentTurn).toBe("player-0");
      expect(view.turnPhase).toBe("discard");
      expect(view.scores).toEqual({ "player-0": 0, "player-1": 0, "player-2": 0, "player-3": 0 });
      expect(view.exposedGroups).toHaveProperty("player-0");
      expect(view.exposedGroups).toHaveProperty("player-1");
      expect(view.exposedGroups).toHaveProperty("player-2");
      expect(view.exposedGroups).toHaveProperty("player-3");
      expect(view.discardPools).toHaveProperty("player-0");
      expect(view.discardPools).toHaveProperty("player-1");
      expect(view.discardPools).toHaveProperty("player-2");
      expect(view.discardPools).toHaveProperty("player-3");
    }
  });

  it("wall tiles are never leaked in any player view", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    // Add identifiable wall tiles
    gameState.wall = [
      { id: "joker-1", category: "joker", copy: 1 },
      { id: "joker-2", category: "joker", copy: 2 },
    ];

    for (const playerId of playerIds) {
      const view = buildPlayerView(room, gameState, playerId);
      const viewStr = JSON.stringify(view);
      expect(viewStr).not.toContain("joker-1");
      expect(viewStr).not.toContain("joker-2");
    }
  });

  it("broadcastGameState sends filtered views to all 4 players with no cross-leaks", () => {
    const { room, wsList } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();

    broadcastGameState(room, gameState);

    for (let i = 0; i < 4; i++) {
      expect(mockSend(wsList[i])).toHaveBeenCalledOnce();
      const msg = parseSentMessage(wsList[i]);
      const state = msg.state as Record<string, unknown>;
      const playerId = playerIds[i];

      expect(msg.type).toBe("STATE_UPDATE");
      expect(msg.version).toBe(1);
      expect(state.myPlayerId).toBe(playerId);

      // Full JSON stringification check for cross-player rack leak
      const msgStr = JSON.stringify(msg);
      for (const otherId of playerIds) {
        if (otherId === playerId) continue;
        for (const tileId of PLAYER_RACK_TILE_IDS[otherId]) {
          expect(msgStr).not.toContain(tileId);
        }
      }
    }
  });

  it("handles player with empty rack (all tiles exposed)", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.players["player-2"].rack.length = 0;

    const view = buildPlayerView(room, gameState, "player-2");
    expect(view.myRack).toHaveLength(0);

    // Other players still don't see each other's racks
    const view0 = buildPlayerView(room, gameState, "player-0");
    const view0Str = JSON.stringify(view0);
    expect(view0Str).not.toContain("crak-1-1");
    expect(view0Str).not.toContain("wind-north-1");
  });

  it("handles playerId not found in gameState gracefully", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();

    const view = buildPlayerView(room, gameState, "player-unknown");

    expect(view.myPlayerId).toBe("player-unknown");
    expect(view.myRack).toEqual([]);
    // Verify warning was logged
    expect(room.logger.warn).toHaveBeenCalled();
  });

  it("discard pool tiles (public) ARE visible but rack tiles are NOT", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();

    // player-0 has bam-9-1 in discard pool (public) and bam-1-1 in rack (private)
    const view1 = buildPlayerView(room, gameState, "player-1");
    const view1Str = JSON.stringify(view1);
    // Discard pool tiles are public — visible to all
    expect(view1Str).toContain("bam-9-1");
    // Rack tiles are private — NOT visible to others
    expect(view1Str).not.toContain("bam-1-1");
    expect(view1Str).not.toContain("bam-2-1");
    expect(view1Str).not.toContain("bam-3-1");
  });
});

describe("buildSpectatorView", () => {
  it("includes NO player rack data", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();

    const view = buildSpectatorView(room, gameState);
    const viewStr = JSON.stringify(view);

    // No rack tiles from ANY player
    for (const tileIds of Object.values(PLAYER_RACK_TILE_IDS)) {
      for (const tileId of tileIds) {
        expect(viewStr).not.toContain(tileId);
      }
    }

    // No myRack or myPlayerId fields
    expect(viewStr).not.toContain("myRack");
    expect(viewStr).not.toContain("myPlayerId");
  });

  it("includes all public state fields", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();

    const view = buildSpectatorView(room, gameState);

    expect(view.roomId).toBe("test-room-id");
    expect(view.roomCode).toBe("TEST01");
    expect(view.gamePhase).toBe("play");
    expect(view.players).toHaveLength(4);
    expect(view.wallRemaining).toBe(80);
    expect(view.currentTurn).toBe("player-0");
    expect(view.turnPhase).toBe("discard");
    expect(view.scores).toEqual({ "player-0": 0, "player-1": 0, "player-2": 0, "player-3": 0 });
    expect(view.exposedGroups).toHaveProperty("player-0");
    expect(view.discardPools).toHaveProperty("player-0");
    expect(view.callWindow).toBeNull();
    expect(view.lastDiscard).toBeNull();
    expect(view.gameResult).toBeNull();
  });

  it("includes discard pool tiles (public) but not wall tiles", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.wall = [{ id: "joker-1", category: "joker", copy: 1 }];

    const view = buildSpectatorView(room, gameState);
    const viewStr = JSON.stringify(view);

    expect(viewStr).toContain("bam-9-1"); // player-0 discard pool
    expect(viewStr).not.toContain("joker-1"); // wall tiles hidden
  });

  it("includes shownHands when players have shown their hands", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.shownHands = {
      "player-0": gameState.players["player-0"].rack,
    };

    const view = buildSpectatorView(room, gameState);

    expect(view.shownHands["player-0"]).toEqual(gameState.players["player-0"].rack);
    expect(view.shownHands["player-1"]).toBeUndefined();
  });
});

describe("sensitive field filtering", () => {
  it("callWindow state is identical for all players (no hidden data leaked)", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
      createTestPlayer("player-2", "west"),
      createTestPlayer("player-3", "north"),
    ];
    const wsList = players.map(() => createMockWs());
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    gameState.callWindow = {
      status: "frozen",
      discardedTile: { id: "dot-5-1", category: "suited", suit: "dot", value: 5, copy: 1 },
      discarderId: "player-0",
      passes: ["player-2"],
      calls: [
        { callType: "pung", playerId: "player-1", tileIds: ["crak-5-1", "crak-5-2"] },
        { callType: "kong", playerId: "player-3", tileIds: ["bam-7-1", "bam-7-2", "bam-7-3"] },
      ],
      openedAt: Date.now(),
      confirmingPlayerId: null,
      confirmationExpiresAt: null,
      remainingCallers: [],
      winningCall: null,
    };

    const view0 = buildPlayerView(room, gameState, "player-0");
    const view1 = buildPlayerView(room, gameState, "player-1");
    const view2 = buildPlayerView(room, gameState, "player-2");
    const view3 = buildPlayerView(room, gameState, "player-3");

    expect(view0.callWindow).toEqual(view1.callWindow);
    expect(view1.callWindow).toEqual(view2.callWindow);
    expect(view2.callWindow).toEqual(view3.callWindow);

    expect(view0.callWindow?.calls).toHaveLength(2);
    expect(view0.callWindow?.passes).toEqual(["player-2"]);
  });

  it("pendingMahjong state is identical for all players", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
      createTestPlayer("player-2", "west"),
      createTestPlayer("player-3", "north"),
    ];
    const wsList = players.map(() => createMockWs());
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    gameState.pendingMahjong = {
      playerId: "player-1",
      path: "self-drawn",
      previousTurnPhase: "draw",
      previousCallWindow: null,
    };

    const views = players.map((p) => buildPlayerView(room, gameState, p.playerId));

    for (let i = 1; i < views.length; i++) {
      expect(views[i].pendingMahjong).toEqual(views[0].pendingMahjong);
    }
  });

  it("challengeState is identical for all players", () => {
    const players = [
      createTestPlayer("player-0", "east", true),
      createTestPlayer("player-1", "south"),
      createTestPlayer("player-2", "west"),
      createTestPlayer("player-3", "north"),
    ];
    const wsList = players.map(() => createMockWs());
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    gameState.challengeState = {
      challengerId: "player-2",
      winnerId: "player-1",
      votes: { "player-0": "valid", "player-3": "invalid" },
      challengeExpiresAt: Date.now() + 30000,
      originalGameResult: {
        winnerId: "player-1",
        patternId: "test-pattern",
        patternName: "Test Pattern",
        points: 25,
        selfDrawn: false,
        discarderId: "player-0",
        payments: { "player-0": -50, "player-1": 75, "player-2": -25, "player-3": 0 },
      },
      calledTile: null,
    };

    const views = players.map((p) => buildPlayerView(room, gameState, p.playerId));

    for (let i = 1; i < views.length; i++) {
      expect(views[i].challengeState).toEqual(views[0].challengeState);
    }
  });

  it("gameState.card (NMJL card data) is NOT included in PlayerGameView", () => {
    const players = [createTestPlayer("player-0", "east", true)];
    const wsList = [createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    gameState.card = loadCard("2026");

    const view = buildPlayerView(room, gameState, "player-0");

    expect("card" in view).toBe(false);
  });

  it("gameState.wall (tile draw pile) is NOT included in PlayerGameView", () => {
    const players = [createTestPlayer("player-0", "east", true)];
    const wsList = [createMockWs()];
    const room = createTestRoom(players, wsList);
    const gameState = createTestGameState();

    gameState.wall = [{ id: "bam-9-1", category: "suited", suit: "bam", value: 9, copy: 1 }];

    const view = buildPlayerView(room, gameState, "player-0");

    expect("wall" in view).toBe(false);
    expect(view.wallRemaining).toBeDefined();
  });
});

describe("shownHands in views", () => {
  it("shownHands are visible to all players in PlayerGameView", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.gamePhase = "scoreboard";
    // player-0 shows their hand
    gameState.shownHands = {
      "player-0": [...gameState.players["player-0"].rack],
    };

    // player-1 can see player-0's shown hand
    const view1 = buildPlayerView(room, gameState, "player-1");
    expect(view1.shownHands["player-0"]).toHaveLength(3);
    // But player-1 still cannot see player-2's rack (not shown)
    const view1Str = JSON.stringify(view1);
    for (const tileId of PLAYER_RACK_TILE_IDS["player-2"]) {
      expect(view1Str).not.toContain(tileId);
    }
  });

  it("only SHOW_HAND makes rack visible — unshown racks remain hidden even during scoreboard", () => {
    const { room } = createFourPlayerRoom();
    const gameState = createFourPlayerGameState();
    gameState.gamePhase = "scoreboard";
    gameState.shownHands = {}; // nobody has shown

    const view1 = buildPlayerView(room, gameState, "player-1");
    const view1Str = JSON.stringify(view1);

    // player-0's rack tiles should NOT appear (not shown)
    for (const tileId of PLAYER_RACK_TILE_IDS["player-0"]) {
      expect(view1Str).not.toContain(tileId);
    }
  });
});
