import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { SuitedTile } from "@mahjong-game/shared";
import { useRoomConnection } from "./useRoomConnection";

describe("useRoomConnection reconnection resolvedAction", () => {
  const OriginalWebSocket = globalThis.WebSocket;
  let messageHandler: ((ev: MessageEvent) => void) | null = null;

  beforeEach(() => {
    setActivePinia(createPinia());
    messageHandler = null;
    globalThis.WebSocket = class {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly readyState = WebSocket.OPEN;
      send = vi.fn();
      addEventListener(type: string, listener: EventListener) {
        if (type === "open") {
          queueMicrotask(() => listener.call(this, new Event("open")));
        }
        if (type === "message") {
          messageHandler = listener as (ev: MessageEvent) => void;
        }
      }
      removeEventListener() {}
      close() {}
    } as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.restoreAllMocks();
  });

  function dispatchServerMessage(data: Record<string, unknown>): void {
    messageHandler?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  it("updates resolvedAction from PLAYER_RECONNECTING to PLAYER_RECONNECTED as messages arrive", async () => {
    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    const t1: SuitedTile = { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 };
    const t2: SuitedTile = { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 };

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      resolvedAction: {
        type: "PLAYER_RECONNECTING",
        playerId: "player-0",
        playerName: "Alice",
      },
      state: {
        roomId: "r",
        roomCode: "ABC12",
        gamePhase: "play",
        players: [],
        myPlayerId: "player-1",
        myRack: [t1, t2],
        exposedGroups: {},
        discardPools: {},
        wallRemaining: 10,
        currentTurn: "player-0",
        turnPhase: "draw",
        callWindow: null,
        scores: {},
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
      },
    });

    expect(conn.resolvedAction.value?.type).toBe("PLAYER_RECONNECTING");

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      resolvedAction: {
        type: "PLAYER_RECONNECTED",
        playerId: "player-0",
        playerName: "Alice",
      },
      state: {
        roomId: "r",
        roomCode: "ABC12",
        gamePhase: "play",
        players: [],
        myPlayerId: "player-1",
        myRack: [t1, t2],
        exposedGroups: {},
        discardPools: {},
        wallRemaining: 10,
        currentTurn: "player-0",
        turnPhase: "draw",
        callWindow: null,
        scores: {},
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
      },
    });

    expect(conn.resolvedAction.value?.type).toBe("PLAYER_RECONNECTED");
  });

  it("replaces myRack with server order on each STATE_UPDATE (no local reorder persistence)", async () => {
    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    const t1: SuitedTile = { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 };
    const t2: SuitedTile = { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 };

    const baseState = {
      roomId: "r",
      roomCode: "ABC12",
      gamePhase: "play" as const,
      players: [],
      myPlayerId: "player-0",
      exposedGroups: {},
      discardPools: {},
      wallRemaining: 10,
      currentTurn: "player-0",
      turnPhase: "draw" as const,
      callWindow: null,
      scores: {},
      lastDiscard: null,
      gameResult: null,
      pendingMahjong: null,
      challengeState: null,
      socialOverrideState: null,
      tableTalkReportState: null,
      tableTalkReportCountsByPlayerId: {},
      charleston: null,
      shownHands: {},
      jokerRulesMode: "standard" as const,
      myDeadHand: false,
      paused: false,
    };

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: {
        ...baseState,
        myRack: [t1, t2],
      },
    });

    expect(conn.playerGameView.value?.myRack.map((x) => x.id)).toEqual(["bam-1-1", "bam-3-2"]);

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: {
        ...baseState,
        myRack: [t2, t1],
      },
    });

    expect(conn.playerGameView.value?.myRack.map((x) => x.id)).toEqual(["bam-3-2", "bam-1-1"]);
  });

  it("reflects paused and scoreboard transition from STATE_UPDATE payloads (4B.3)", async () => {
    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    const t1: SuitedTile = { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 };

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      resolvedAction: {
        type: "GAME_PAUSED",
        disconnectedPlayerIds: ["a"],
        reason: "simultaneous-disconnect",
      },
      state: {
        roomId: "r",
        roomCode: "ABC12",
        gamePhase: "play",
        players: [],
        myPlayerId: "player-1",
        myRack: [t1],
        exposedGroups: {},
        discardPools: {},
        wallRemaining: 10,
        currentTurn: "player-0",
        turnPhase: "draw",
        callWindow: null,
        scores: {},
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
        paused: true,
      },
    });

    expect(conn.playerGameView.value?.paused).toBe(true);

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      resolvedAction: { type: "GAME_ABANDONED", reason: "pause-timeout" },
      state: {
        roomId: "r",
        roomCode: "ABC12",
        gamePhase: "scoreboard",
        players: [],
        myPlayerId: "player-1",
        myRack: [t1],
        exposedGroups: {},
        discardPools: {},
        wallRemaining: 0,
        currentTurn: "player-0",
        turnPhase: "discard",
        callWindow: null,
        scores: {},
        lastDiscard: null,
        gameResult: { winnerId: null, points: 0 },
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
      },
    });

    expect(conn.playerGameView.value?.paused).toBe(false);
    expect(conn.playerGameView.value?.gamePhase).toBe("scoreboard");
    expect(conn.resolvedAction.value?.type).toBe("GAME_ABANDONED");
  });
});
