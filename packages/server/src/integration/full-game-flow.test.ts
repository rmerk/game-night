import { describe, expect, it, afterEach } from "vite-plus/test";
import { WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import {
  PROTOCOL_VERSION,
  type StateUpdateMessage,
  type ServerErrorMessage,
  type LobbyState,
  type PlayerGameView,
  type Tile,
} from "@mahjong-game/shared";
import { createApp } from "../index";

/**
 * End-to-end integration test: room creation → 4 players join → game start → action → cleanup.
 * Addresses adversarial review finding #9: no test validates the full integrated flow.
 */

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.on("open", resolve);
    ws.on("error", reject);
  });
}

function waitForClose(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on("close", () => resolve());
    ws.on("error", reject);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isServerErrorMessage(msg: unknown): msg is ServerErrorMessage {
  return isPlainObject(msg) && msg.type === "ERROR" && typeof msg.code === "string";
}

function isStateUpdateMessage(msg: unknown): msg is StateUpdateMessage {
  if (!isPlainObject(msg)) {
    return false;
  }
  if (msg.version !== PROTOCOL_VERSION) {
    return false;
  }
  if (msg.type !== "STATE_UPDATE") {
    return false;
  }
  if (!isPlainObject(msg.state)) {
    return false;
  }
  return typeof msg.state.myPlayerId === "string";
}

function isLobbyState(state: LobbyState | PlayerGameView): state is LobbyState {
  return state.gamePhase === "lobby";
}

function isPlayerGameViewState(state: LobbyState | PlayerGameView): state is PlayerGameView {
  return !isLobbyState(state);
}

function requirePlayerGameView(state: LobbyState | PlayerGameView): PlayerGameView {
  if (!isPlayerGameViewState(state)) {
    throw new Error("Expected PlayerGameView");
  }
  return state;
}

/**
 * Create a buffered message reader for a WebSocket.
 * Messages are buffered as they arrive so none are lost between awaits.
 */
function createMessageReader(ws: WebSocket) {
  const buffer: unknown[] = [];
  let parseFailure: Error | null = null;
  let waiting: { resolve: (msg: unknown) => void; reject: (reason: unknown) => void } | null = null;

  ws.on("message", (data: Buffer) => {
    const raw = data.toString("utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      const snippet = raw.length > 120 ? `${raw.slice(0, 120)}…` : raw;
      const err = new Error(`Invalid WebSocket JSON: ${snippet}`);
      if (waiting) {
        const w = waiting;
        waiting = null;
        w.reject(err);
      } else {
        parseFailure = err;
      }
      return;
    }
    if (waiting) {
      const w = waiting;
      waiting = null;
      w.resolve(parsed);
    } else {
      buffer.push(parsed);
    }
  });

  function next(): Promise<unknown> {
    if (parseFailure) {
      const err = parseFailure;
      parseFailure = null;
      return Promise.reject(err);
    }
    if (buffer.length > 0) {
      return Promise.resolve(buffer.shift()!);
    }
    return new Promise((resolve, reject) => {
      waiting = { resolve, reject };
    });
  }

  return {
    next,
    async nextStateUpdate(): Promise<StateUpdateMessage> {
      for (;;) {
        const msg = await next();
        if (isStateUpdateMessage(msg)) {
          return msg;
        }
        if (isPlainObject(msg) && msg.type === "CHAT_HISTORY") {
          continue;
        }
        throw new Error(`Expected STATE_UPDATE, got: ${JSON.stringify(msg)}`);
      }
    },
  };
}

function rackTileIdsFromStateMessage(message: StateUpdateMessage): string[] {
  if (isLobbyState(message.state)) {
    throw new Error("Expected in-game state with myRack");
  }
  return message.state.myRack.map((tile) => tile.id);
}

function charlestonViewFromMessage(message: StateUpdateMessage): PlayerGameView["charleston"] {
  if (isLobbyState(message.state)) {
    return null;
  }
  return message.state.charleston;
}

describe("Full Game Flow Integration", () => {
  let app: FastifyInstance;
  let wsUrl: string;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    sockets.length = 0;
    if (app) await app.close();
  });

  function createWs(): WebSocket {
    const ws = new WebSocket(wsUrl);
    sockets.push(ws);
    return ws;
  }

  it(
    "room creation → 4 players join → game start → discard → reconnection",
    { timeout: 15_000 },
    async () => {
      app = createApp();
      await app.ready();
      const address = await app.listen({ port: 0 });
      wsUrl = address.replace("http", "ws");

      // 1. Create room via HTTP
      const roomRes = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { hostName: "Alice" },
      });
      expect(roomRes.statusCode).toBe(201);
      const { roomCode } = roomRes.json();

      // 2. Verify room status
      const statusRes = await app.inject({
        method: "GET",
        url: `/api/rooms/${roomCode}/status`,
      });
      expect(statusRes.json().playerCount).toBe(0);
      expect(statusRes.json().phase).toBe("lobby");

      // 3. Four players join via WebSocket — set up buffered readers before joining
      //    to avoid losing broadcast messages between sequential joins
      const aliceWs = createWs();
      await waitForOpen(aliceWs);
      const aliceReader = createMessageReader(aliceWs);

      aliceWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }),
      );
      const aliceJoinMsg = await aliceReader.nextStateUpdate();
      expect(aliceJoinMsg.type).toBe("STATE_UPDATE");
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;
      const aliceToken = aliceJoinMsg.token;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);

      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.nextStateUpdate();
      expect(bobJoinMsg.type).toBe("STATE_UPDATE");
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);

      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.nextStateUpdate();
      expect(carolJoinMsg.type).toBe("STATE_UPDATE");
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);

      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.nextStateUpdate();
      expect(daveJoinMsg.type).toBe("STATE_UPDATE");
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      // Consume PLAYER_JOINED broadcasts (Alice gets 3, Bob gets 2, Carol gets 1)
      await Promise.all([
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
      ]);

      // 4. Verify room is full
      const fullStatus = await app.inject({
        method: "GET",
        url: `/api/rooms/${roomCode}/status`,
      });
      expect(fullStatus.json().playerCount).toBe(4);
      expect(fullStatus.json().full).toBe(true);

      // 5. Non-host tries to start → rejected
      bobWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
      const rejectMsg = await bobReader.next();
      if (!isServerErrorMessage(rejectMsg)) {
        throw new Error(`expected ERROR message, got ${JSON.stringify(rejectMsg)}`);
      }
      expect(rejectMsg.code).toBe("NOT_HOST");

      // 6. Host starts game
      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));

      // All 4 players receive STATE_UPDATE with game state
      const aliceState = await aliceReader.nextStateUpdate();
      const bobState = await bobReader.nextStateUpdate();
      const carolState = await carolReader.nextStateUpdate();
      const daveState = await daveReader.nextStateUpdate();

      expect(aliceState.type).toBe("STATE_UPDATE");
      const alicePv = requirePlayerGameView(aliceState.state);
      const bobPv = requirePlayerGameView(bobState.state);
      const carolPv = requirePlayerGameView(carolState.state);
      const davePv = requirePlayerGameView(daveState.state);

      expect(alicePv.gamePhase).toBe("charleston");
      expect(alicePv.charleston).toMatchObject({
        currentDirection: "right",
        status: "passing",
        stage: "first",
      });

      // 7. Verify per-player filtering — each player sees only their own rack
      expect(alicePv.myRack.length).toBeGreaterThan(0);
      expect(bobPv.myRack.length).toBeGreaterThan(0);

      // Verify racks are different (different players have different tiles)
      const aliceRackIds = alicePv.myRack.map((t) => t.id).sort();
      const bobRackIds = bobPv.myRack.map((t) => t.id).sort();
      expect(aliceRackIds).not.toEqual(bobRackIds);

      // 8. Verify no opponent racks leaked
      const aliceStr = JSON.stringify(alicePv);
      for (const id of bobRackIds) {
        expect(aliceStr).not.toContain(id);
      }

      // 9. East player (player-0) has 14 tiles, others have 13
      const players = [
        { id: alicePlayerId, rack: alicePv.myRack, ws: aliceWs, reader: aliceReader },
        { id: bobPlayerId, rack: bobPv.myRack, ws: bobWs, reader: bobReader },
        { id: carolPlayerId, rack: carolPv.myRack, ws: carolWs, reader: carolReader },
        { id: davePlayerId, rack: davePv.myRack, ws: daveWs, reader: daveReader },
      ];
      const eastPlayer = players.find((p) => p.id === "player-0")!;
      expect(eastPlayer.rack.length).toBe(14);

      const nonEastPlayers = players.filter((p) => p.id !== "player-0");
      for (const p of nonEastPlayers) {
        expect(p.rack.length).toBe(13);
      }

      // 10. Fast-forward to play for the discard/reconnect integration portion of the test.
      const room = app.roomManager.getRoom(roomCode)!;
      room.gameState!.gamePhase = "play";
      room.gameState!.charleston = null;

      // East player discards a tile (they have 14, must discard)
      const tileToDiscard = eastPlayer.rack.find((tile: Tile) => tile.category !== "joker")!;
      eastPlayer.ws.send(
        JSON.stringify({
          version: 1,
          type: "ACTION",
          action: { type: "DISCARD_TILE", playerId: eastPlayer.id, tileId: tileToDiscard.id },
        }),
      );

      // East player should get STATE_UPDATE after discard
      const postDiscard = await eastPlayer.reader.nextStateUpdate();
      expect(postDiscard.type).toBe("STATE_UPDATE");

      await Promise.all([
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
        daveReader.nextStateUpdate(),
      ]);

      // 11. Verify room status shows game in progress
      const playStatus = await app.inject({
        method: "GET",
        url: `/api/rooms/${roomCode}/status`,
      });
      expect(playStatus.json().phase).toBe("play");

      // 12. Token-based reconnection works (disconnect → PLAYER_RECONNECTING → reconnect → full view)
      const disconnectBroadcastsPromise = Promise.all([
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
        daveReader.nextStateUpdate(),
      ]);
      aliceWs.close();
      await waitForClose(aliceWs);

      const disconnectOthers = await disconnectBroadcastsPromise;
      for (const b of disconnectOthers) {
        expect(b.resolvedAction).toMatchObject({
          type: "PLAYER_RECONNECTING",
          playerId: alicePlayerId,
        });
      }

      const aliceReconnectWs = createWs();
      await waitForOpen(aliceReconnectWs);
      const aliceReconnectReader = createMessageReader(aliceReconnectWs);

      const aliceReconnectStateP = aliceReconnectReader.nextStateUpdate();
      const othersReconnectP = Promise.all([
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
        daveReader.nextStateUpdate(),
      ]);

      aliceReconnectWs.send(
        JSON.stringify({
          version: 1,
          type: "JOIN_ROOM",
          roomCode,
          displayName: "Alice",
          token: aliceToken,
        }),
      );

      const reconnectMsg = await aliceReconnectStateP;
      expect(reconnectMsg.type).toBe("STATE_UPDATE");
      expect(reconnectMsg.state.myPlayerId).toBe(alicePlayerId);
      const reconnectPv = requirePlayerGameView(reconnectMsg.state);
      const postDiscardPv = requirePlayerGameView(postDiscard.state);
      expect(reconnectPv.gamePhase).toBe("play");
      expect(reconnectPv.currentTurn).toBe(postDiscardPv.currentTurn);
      expect(reconnectPv.turnPhase).toBe(postDiscardPv.turnPhase);
      expect(rackTileIdsFromStateMessage(reconnectMsg).sort()).toEqual(
        rackTileIdsFromStateMessage(postDiscard).sort(),
      );

      const othersAfterReconnect = await othersReconnectP;
      for (const b of othersAfterReconnect) {
        expect(b.resolvedAction).toMatchObject({
          type: "PLAYER_RECONNECTED",
          playerId: alicePlayerId,
        });
      }
    },
  );

  it(
    "room creation → game start → Charleston pass flow hides locked selections and hidden across tiles",
    { timeout: 15_000 },
    async () => {
      app = createApp();
      await app.ready();
      const address = await app.listen({ port: 0 });
      wsUrl = address.replace("http", "ws");

      const roomRes = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { hostName: "Alice" },
      });
      expect(roomRes.statusCode).toBe(201);
      const { roomCode } = roomRes.json();

      const aliceWs = createWs();
      await waitForOpen(aliceWs);
      const aliceReader = createMessageReader(aliceWs);
      aliceWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }),
      );
      const aliceJoinMsg = await aliceReader.nextStateUpdate();
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);
      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.nextStateUpdate();
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);
      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.nextStateUpdate();
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);
      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.nextStateUpdate();
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      await Promise.all([
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
      ]);

      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));

      const aliceState = await aliceReader.nextStateUpdate();
      const bobState = await bobReader.nextStateUpdate();
      const carolState = await carolReader.nextStateUpdate();
      const daveState = await daveReader.nextStateUpdate();

      expect(aliceState.type).toBe("STATE_UPDATE");
      expect(bobState.type).toBe("STATE_UPDATE");
      expect(carolState.type).toBe("STATE_UPDATE");
      expect(daveState.type).toBe("STATE_UPDATE");

      const players = [
        { id: alicePlayerId, ws: aliceWs, reader: aliceReader, latestState: aliceState },
        { id: bobPlayerId, ws: bobWs, reader: bobReader, latestState: bobState },
        { id: carolPlayerId, ws: carolWs, reader: carolReader, latestState: carolState },
        { id: davePlayerId, ws: daveWs, reader: daveReader, latestState: daveState },
      ];

      const playersById = players.reduce<Record<string, (typeof players)[number]>>((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      function visibleSelection(playerId: string): string[] {
        return rackTileIdsFromStateMessage(playersById[playerId].latestState).slice(0, 3);
      }

      function expectNoLeak(
        updates: StateUpdateMessage[],
        forbiddenTileIds: readonly string[],
      ): void {
        for (const update of updates) {
          const serializedUpdate = JSON.stringify(update);
          for (const tileId of forbiddenTileIds) {
            expect(serializedUpdate).not.toContain(tileId);
          }
        }
      }

      async function submitCharlestonPassAndCollect(
        playerId: string,
        tileIds: readonly string[],
      ): Promise<StateUpdateMessage[]> {
        playersById[playerId].ws.send(
          JSON.stringify({
            version: 1,
            type: "ACTION",
            action: { type: "CHARLESTON_PASS", playerId, tileIds },
          }),
        );

        const updates = await Promise.all(players.map((player) => player.reader.nextStateUpdate()));
        for (const update of updates) {
          expect(update.type).toBe("STATE_UPDATE");
        }
        players.forEach((player, index) => {
          player.latestState = updates[index];
        });
        return updates;
      }

      const eastPlayerId = "player-0";
      const westPlayerId = "player-2";

      const eastRightSelection = visibleSelection(eastPlayerId);
      const rightLockUpdates = await submitCharlestonPassAndCollect(
        eastPlayerId,
        eastRightSelection,
      );
      expectNoLeak(
        rightLockUpdates.filter((_, index) => players[index].id !== eastPlayerId),
        eastRightSelection,
      );
      expect(
        requirePlayerGameView(playersById[eastPlayerId].latestState.state).charleston,
      ).toMatchObject({
        currentDirection: "right",
        submittedPlayerIds: [eastPlayerId],
        mySubmissionLocked: true,
      });

      await submitCharlestonPassAndCollect("player-1", visibleSelection("player-1"));
      await submitCharlestonPassAndCollect(westPlayerId, visibleSelection(westPlayerId));
      const rightResolvedUpdates = await submitCharlestonPassAndCollect(
        "player-3",
        visibleSelection("player-3"),
      );

      for (const update of rightResolvedUpdates) {
        expect(update.resolvedAction).toMatchObject({
          type: "CHARLESTON_PHASE_COMPLETE",
          direction: "right",
          nextDirection: "across",
        });
      }

      const westAcrossSelection = visibleSelection(westPlayerId);
      const acrossLockUpdates = await submitCharlestonPassAndCollect(
        westPlayerId,
        westAcrossSelection,
      );
      expectNoLeak(
        acrossLockUpdates.filter((_, index) => players[index].id !== westPlayerId),
        westAcrossSelection,
      );

      await submitCharlestonPassAndCollect(eastPlayerId, visibleSelection(eastPlayerId));
      await submitCharlestonPassAndCollect("player-1", visibleSelection("player-1"));
      const acrossResolvedUpdates = await submitCharlestonPassAndCollect(
        "player-3",
        visibleSelection("player-3"),
      );

      for (const update of acrossResolvedUpdates) {
        expect(update.resolvedAction).toMatchObject({
          type: "CHARLESTON_PHASE_COMPLETE",
          direction: "across",
          nextDirection: "left",
        });
      }
      expect(
        requirePlayerGameView(playersById[eastPlayerId].latestState.state).charleston,
      ).toMatchObject({
        currentDirection: "left",
        myHiddenTileCount: 3,
        mySubmissionLocked: false,
      });
      expectNoLeak(acrossResolvedUpdates, westAcrossSelection);
      const eastRackBeforeLeftLock = rackTileIdsFromStateMessage(
        playersById[eastPlayerId].latestState,
      );
      for (const hiddenTileId of westAcrossSelection) {
        expect(eastRackBeforeLeftLock).not.toContain(hiddenTileId);
      }

      const eastLeftSelection = visibleSelection(eastPlayerId);
      const leftLockUpdates = await submitCharlestonPassAndCollect(eastPlayerId, eastLeftSelection);
      const eastRackAfterLeftLock = rackTileIdsFromStateMessage(
        playersById[eastPlayerId].latestState,
      );
      for (const hiddenTileId of westAcrossSelection) {
        expect(eastRackAfterLeftLock).toContain(hiddenTileId);
      }
      expectNoLeak(
        leftLockUpdates.filter((_, index) => players[index].id !== eastPlayerId),
        westAcrossSelection,
      );
      expectNoLeak(
        leftLockUpdates.filter((_, index) => players[index].id !== eastPlayerId),
        eastLeftSelection,
      );

      await submitCharlestonPassAndCollect("player-1", visibleSelection("player-1"));
      await submitCharlestonPassAndCollect(westPlayerId, visibleSelection(westPlayerId));
      const leftResolvedUpdates = await submitCharlestonPassAndCollect(
        "player-3",
        visibleSelection("player-3"),
      );

      for (const update of leftResolvedUpdates) {
        const finalState = requirePlayerGameView(update.state);
        expect(update.resolvedAction).toMatchObject({
          type: "CHARLESTON_PHASE_COMPLETE",
          direction: "left",
          nextDirection: null,
          stage: "second",
          status: "vote-ready",
        });
        expect(finalState.gamePhase).toBe("charleston");
        expect(finalState.charleston).toMatchObject({
          currentDirection: null,
          stage: "second",
          status: "vote-ready",
        });
      }
    },
  );

  it(
    'room creation → vote-ready second Charleston → first "no" skips to courtesy-ready',
    { timeout: 15_000 },
    async () => {
      app = createApp();
      await app.ready();
      const address = await app.listen({ port: 0 });
      wsUrl = address.replace("http", "ws");

      const roomRes = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { hostName: "Alice" },
      });
      expect(roomRes.statusCode).toBe(201);
      const { roomCode } = roomRes.json();

      const aliceWs = createWs();
      await waitForOpen(aliceWs);
      const aliceReader = createMessageReader(aliceWs);
      aliceWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }),
      );
      const aliceJoinMsg = await aliceReader.nextStateUpdate();
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);
      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.nextStateUpdate();
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);
      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.nextStateUpdate();
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);
      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.nextStateUpdate();
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      await Promise.all([
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
      ]);

      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
      await Promise.all([
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
        daveReader.nextStateUpdate(),
      ]);

      const room = app.roomManager.getRoom(roomCode)!;
      room.gameState!.charleston = {
        stage: "second",
        status: "vote-ready",
        currentDirection: null,
        activePlayerIds: [alicePlayerId, bobPlayerId, carolPlayerId, davePlayerId],
        submittedPlayerIds: [],
        lockedTileIdsByPlayerId: {},
        hiddenAcrossTilesByPlayerId: {},
        votesByPlayerId: {},
        courtesyPairings: [],
        courtesySubmissionsByPlayerId: {},
        courtesyResolvedPairings: [],
      };

      aliceWs.send(
        JSON.stringify({
          version: 1,
          type: "ACTION",
          action: { type: "CHARLESTON_VOTE", playerId: alicePlayerId, accept: false },
        }),
      );

      const updates = await Promise.all([
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
        daveReader.nextStateUpdate(),
      ]);

      for (const update of updates) {
        expect(update.type).toBe("STATE_UPDATE");
        expect(update.resolvedAction).toMatchObject({
          type: "CHARLESTON_VOTE_RESOLVED",
          outcome: "rejected",
          nextDirection: null,
          stage: "courtesy",
          status: "courtesy-ready",
        });

        const state = requirePlayerGameView(update.state);
        expect(state.gamePhase).toBe("charleston");
        expect(state.charleston).toMatchObject({
          stage: "courtesy",
          status: "courtesy-ready",
          currentDirection: null,
          submittedPlayerIds: [],
          votesReceivedCount: 0,
          courtesyPairings: [
            [alicePlayerId, carolPlayerId],
            [bobPlayerId, davePlayerId],
          ],
        });

        const serialized = JSON.stringify(update);
        expect(serialized).not.toContain("votesByPlayerId");
      }
    },
  );

  it(
    'room creation → vote-ready second Charleston → unanimous "yes" → reversed passes → courtesy-ready',
    { timeout: 15_000 },
    async () => {
      app = createApp();
      await app.ready();
      const address = await app.listen({ port: 0 });
      wsUrl = address.replace("http", "ws");

      const roomRes = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { hostName: "Alice" },
      });
      expect(roomRes.statusCode).toBe(201);
      const { roomCode } = roomRes.json();

      const aliceWs = createWs();
      await waitForOpen(aliceWs);
      const aliceReader = createMessageReader(aliceWs);
      aliceWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }),
      );
      const aliceJoinMsg = await aliceReader.nextStateUpdate();
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);
      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.nextStateUpdate();
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);
      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.nextStateUpdate();
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);
      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.nextStateUpdate();
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      await Promise.all([
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
      ]);

      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));

      const initialStates = await Promise.all([
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
        daveReader.nextStateUpdate(),
      ]);

      const players = [
        { id: alicePlayerId, ws: aliceWs, reader: aliceReader, latestState: initialStates[0] },
        { id: bobPlayerId, ws: bobWs, reader: bobReader, latestState: initialStates[1] },
        { id: carolPlayerId, ws: carolWs, reader: carolReader, latestState: initialStates[2] },
        { id: davePlayerId, ws: daveWs, reader: daveReader, latestState: initialStates[3] },
      ];

      const playersById = players.reduce<Record<string, (typeof players)[number]>>((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      function visibleSelection(playerId: string): string[] {
        return rackTileIdsFromStateMessage(playersById[playerId].latestState).slice(0, 3);
      }

      function expectNoLeak(
        updates: StateUpdateMessage[],
        forbiddenTileIds: readonly string[],
      ): void {
        for (const update of updates) {
          const serializedUpdate = JSON.stringify(update);
          for (const tileId of forbiddenTileIds) {
            expect(serializedUpdate).not.toContain(tileId);
          }
        }
      }

      async function submitActionAndCollect(
        senderPlayerId: string,
        action: Record<string, unknown>,
      ): Promise<StateUpdateMessage[]> {
        playersById[senderPlayerId].ws.send(
          JSON.stringify({
            version: 1,
            type: "ACTION",
            action,
          }),
        );

        const updates = await Promise.all(players.map((player) => player.reader.nextStateUpdate()));
        players.forEach((player, index) => {
          player.latestState = updates[index];
        });
        return updates;
      }

      const room = app.roomManager.getRoom(roomCode)!;
      room.gameState!.charleston = {
        stage: "second",
        status: "vote-ready",
        currentDirection: null,
        activePlayerIds: [alicePlayerId, bobPlayerId, carolPlayerId, davePlayerId],
        submittedPlayerIds: [],
        lockedTileIdsByPlayerId: {},
        hiddenAcrossTilesByPlayerId: {},
        votesByPlayerId: {},
        courtesyPairings: [],
        courtesySubmissionsByPlayerId: {},
        courtesyResolvedPairings: [],
      };

      const firstVoteUpdates = await submitActionAndCollect(alicePlayerId, {
        type: "CHARLESTON_VOTE",
        playerId: alicePlayerId,
        accept: true,
      });
      for (const update of firstVoteUpdates) {
        expect(update.resolvedAction).toEqual({
          type: "CHARLESTON_VOTE_CAST",
          votesReceivedCount: 1,
        });
        const resolvedJson = JSON.stringify(update.resolvedAction);
        expect(resolvedJson).not.toContain("accept");
        expect(resolvedJson).not.toContain(alicePlayerId);
        expect(requirePlayerGameView(update.state).charleston?.submittedPlayerIds).toEqual([]);
      }
      const aliceFirst = firstVoteUpdates.find((u) => u.state.myPlayerId === alicePlayerId);
      expect(requirePlayerGameView(aliceFirst!.state).charleston?.myVote).toBe(true);

      await submitActionAndCollect(bobPlayerId, {
        type: "CHARLESTON_VOTE",
        playerId: bobPlayerId,
        accept: true,
      });
      await submitActionAndCollect(carolPlayerId, {
        type: "CHARLESTON_VOTE",
        playerId: carolPlayerId,
        accept: true,
      });
      const finalVoteUpdates = await submitActionAndCollect(davePlayerId, {
        type: "CHARLESTON_VOTE",
        playerId: davePlayerId,
        accept: true,
      });

      for (const update of finalVoteUpdates) {
        expect(update.resolvedAction).toMatchObject({
          type: "CHARLESTON_VOTE_RESOLVED",
          outcome: "accepted",
          nextDirection: "left",
          stage: "second",
          status: "passing",
        });
        expect(requirePlayerGameView(update.state).charleston).toMatchObject({
          stage: "second",
          status: "passing",
          currentDirection: "left",
          submittedPlayerIds: [],
        });
      }

      await submitActionAndCollect(alicePlayerId, {
        type: "CHARLESTON_PASS",
        playerId: alicePlayerId,
        tileIds: visibleSelection(alicePlayerId),
      });
      await submitActionAndCollect(bobPlayerId, {
        type: "CHARLESTON_PASS",
        playerId: bobPlayerId,
        tileIds: visibleSelection(bobPlayerId),
      });
      await submitActionAndCollect(carolPlayerId, {
        type: "CHARLESTON_PASS",
        playerId: carolPlayerId,
        tileIds: visibleSelection(carolPlayerId),
      });
      const leftResolvedUpdates = await submitActionAndCollect(davePlayerId, {
        type: "CHARLESTON_PASS",
        playerId: davePlayerId,
        tileIds: visibleSelection(davePlayerId),
      });

      for (const update of leftResolvedUpdates) {
        expect(update.resolvedAction).toMatchObject({
          type: "CHARLESTON_PHASE_COMPLETE",
          direction: "left",
          nextDirection: "across",
          stage: "second",
          status: "passing",
        });
      }

      const acrossSelections = {
        [alicePlayerId]: visibleSelection(alicePlayerId),
        [bobPlayerId]: visibleSelection(bobPlayerId),
        [carolPlayerId]: visibleSelection(carolPlayerId),
        [davePlayerId]: visibleSelection(davePlayerId),
      };

      await submitActionAndCollect(alicePlayerId, {
        type: "CHARLESTON_PASS",
        playerId: alicePlayerId,
        tileIds: acrossSelections[alicePlayerId],
      });
      await submitActionAndCollect(bobPlayerId, {
        type: "CHARLESTON_PASS",
        playerId: bobPlayerId,
        tileIds: acrossSelections[bobPlayerId],
      });
      await submitActionAndCollect(carolPlayerId, {
        type: "CHARLESTON_PASS",
        playerId: carolPlayerId,
        tileIds: acrossSelections[carolPlayerId],
      });
      const acrossResolvedUpdates = await submitActionAndCollect(davePlayerId, {
        type: "CHARLESTON_PASS",
        playerId: davePlayerId,
        tileIds: acrossSelections[davePlayerId],
      });

      const hiddenAcrossTileIds = acrossSelections[carolPlayerId];
      const eastStateAfterAcross = requirePlayerGameView(
        playersById[alicePlayerId].latestState.state,
      );
      expect(eastStateAfterAcross.charleston).toMatchObject({
        currentDirection: "right",
        myHiddenTileCount: 3,
        mySubmissionLocked: false,
      });
      for (const hiddenTileId of hiddenAcrossTileIds) {
        expect(eastStateAfterAcross.myRack.map((tile) => tile.id)).not.toContain(hiddenTileId);
      }
      expectNoLeak(acrossResolvedUpdates, hiddenAcrossTileIds);

      const eastRightSelection = visibleSelection(alicePlayerId);
      const eastRightLockUpdates = await submitActionAndCollect(alicePlayerId, {
        type: "CHARLESTON_PASS",
        playerId: alicePlayerId,
        tileIds: eastRightSelection,
      });
      const eastStateAfterRightLock = requirePlayerGameView(
        playersById[alicePlayerId].latestState.state,
      );
      for (const hiddenTileId of hiddenAcrossTileIds) {
        expect(eastStateAfterRightLock.myRack.map((tile) => tile.id)).toContain(hiddenTileId);
      }
      expectNoLeak(
        eastRightLockUpdates.filter((_, index) => players[index].id !== alicePlayerId),
        hiddenAcrossTileIds,
      );
      expectNoLeak(
        eastRightLockUpdates.filter((_, index) => players[index].id !== alicePlayerId),
        eastRightSelection,
      );

      await submitActionAndCollect(bobPlayerId, {
        type: "CHARLESTON_PASS",
        playerId: bobPlayerId,
        tileIds: visibleSelection(bobPlayerId),
      });
      await submitActionAndCollect(carolPlayerId, {
        type: "CHARLESTON_PASS",
        playerId: carolPlayerId,
        tileIds: visibleSelection(carolPlayerId),
      });
      const rightResolvedUpdates = await submitActionAndCollect(davePlayerId, {
        type: "CHARLESTON_PASS",
        playerId: davePlayerId,
        tileIds: visibleSelection(davePlayerId),
      });

      for (const update of rightResolvedUpdates) {
        expect(update.resolvedAction).toMatchObject({
          type: "CHARLESTON_PHASE_COMPLETE",
          direction: "right",
          nextDirection: null,
          stage: "courtesy",
          status: "courtesy-ready",
        });
        expect(requirePlayerGameView(update.state).gamePhase).toBe("charleston");
        expect(requirePlayerGameView(update.state).charleston).toMatchObject({
          stage: "courtesy",
          status: "courtesy-ready",
          currentDirection: null,
          courtesyPairings: [
            [alicePlayerId, carolPlayerId],
            [bobPlayerId, davePlayerId],
          ],
        });
      }
    },
  );

  it(
    "room creation → courtesy negotiation resolves pair-locally, preserves privacy, and enters play",
    { timeout: 15_000 },
    async () => {
      app = createApp();
      await app.ready();
      const address = await app.listen({ port: 0 });
      wsUrl = address.replace("http", "ws");

      const roomRes = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { hostName: "Alice" },
      });
      expect(roomRes.statusCode).toBe(201);
      const { roomCode } = roomRes.json();

      const aliceWs = createWs();
      await waitForOpen(aliceWs);
      const aliceReader = createMessageReader(aliceWs);
      aliceWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Alice" }),
      );
      const aliceJoinMsg = await aliceReader.nextStateUpdate();
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);
      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.nextStateUpdate();
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);
      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.nextStateUpdate();
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);
      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.nextStateUpdate();
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      await Promise.all([
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
      ]);

      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));

      const initialStates = await Promise.all([
        aliceReader.nextStateUpdate(),
        bobReader.nextStateUpdate(),
        carolReader.nextStateUpdate(),
        daveReader.nextStateUpdate(),
      ]);

      const players = [
        { id: alicePlayerId, ws: aliceWs, reader: aliceReader, latestState: initialStates[0] },
        { id: bobPlayerId, ws: bobWs, reader: bobReader, latestState: initialStates[1] },
        { id: carolPlayerId, ws: carolWs, reader: carolReader, latestState: initialStates[2] },
        { id: davePlayerId, ws: daveWs, reader: daveReader, latestState: initialStates[3] },
      ];

      const playersById = players.reduce<Record<string, (typeof players)[number]>>((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      function visibleSelection(playerId: string, count = 3): string[] {
        return rackTileIdsFromStateMessage(playersById[playerId].latestState).slice(0, count);
      }

      async function submitActionAndCollect(
        senderPlayerId: string,
        action: Record<string, unknown>,
      ): Promise<StateUpdateMessage[]> {
        playersById[senderPlayerId].ws.send(
          JSON.stringify({
            version: 1,
            type: "ACTION",
            action,
          }),
        );

        const updates = await Promise.all(players.map((player) => player.reader.nextStateUpdate()));
        players.forEach((player, index) => {
          player.latestState = updates[index];
        });
        return updates;
      }

      const room = app.roomManager.getRoom(roomCode)!;
      room.gameState!.charleston = {
        stage: "courtesy",
        status: "courtesy-ready",
        currentDirection: null,
        activePlayerIds: [alicePlayerId, bobPlayerId, carolPlayerId, davePlayerId],
        submittedPlayerIds: [],
        lockedTileIdsByPlayerId: {},
        hiddenAcrossTilesByPlayerId: {},
        votesByPlayerId: {},
        courtesyPairings: [
          [alicePlayerId, carolPlayerId],
          [bobPlayerId, davePlayerId],
        ],
        courtesySubmissionsByPlayerId: {},
        courtesyResolvedPairings: [],
      };

      const aliceCourtesySelection = visibleSelection(alicePlayerId, 3);
      const aliceLockUpdates = await submitActionAndCollect(alicePlayerId, {
        type: "COURTESY_PASS",
        playerId: alicePlayerId,
        count: 3,
        tileIds: aliceCourtesySelection,
      });

      for (const update of aliceLockUpdates) {
        expect(update.type).toBe("STATE_UPDATE");
        expect(update.resolvedAction).toMatchObject({
          type: "COURTESY_PASS_LOCKED",
          playerId: alicePlayerId,
          pairing: [alicePlayerId, carolPlayerId],
        });
      }

      const aliceLockState = aliceLockUpdates.find(
        (update) => update.state.myPlayerId === alicePlayerId,
      )!;
      expect(charlestonViewFromMessage(aliceLockState)).toMatchObject({
        courtesyResolvedPairCount: 0,
        myCourtesySubmission: {
          count: 3,
          tileIds: aliceCourtesySelection,
        },
      });

      const bobLockState = aliceLockUpdates.find(
        (update) => update.state.myPlayerId === bobPlayerId,
      )!;
      const bobCourtesyView = charlestonViewFromMessage(bobLockState);
      expect(bobCourtesyView).not.toBeNull();
      expect(bobCourtesyView!.myCourtesySubmission).toBeNull();
      expect(JSON.stringify(bobLockState)).not.toContain(aliceCourtesySelection[0]);
      expect(JSON.stringify(bobLockState)).not.toContain('"count":3');

      const carolCourtesySelection = visibleSelection(carolPlayerId, 2);
      const firstPairResolvedUpdates = await submitActionAndCollect(carolPlayerId, {
        type: "COURTESY_PASS",
        playerId: carolPlayerId,
        count: 2,
        tileIds: carolCourtesySelection,
      });

      for (const update of firstPairResolvedUpdates) {
        expect(update.resolvedAction).toEqual({
          type: "COURTESY_PAIR_RESOLVED",
          pairing: [alicePlayerId, carolPlayerId],
          playerRequests: {
            [alicePlayerId]: 3,
            [carolPlayerId]: 2,
          },
          appliedCount: 2,
          entersPlay: false,
        });
        const charleston = charlestonViewFromMessage(update);
        expect(charleston).toMatchObject({
          stage: "courtesy",
          status: "courtesy-ready",
          courtesyResolvedPairCount: 1,
        });
      }

      const aliceStateAfterResolution = firstPairResolvedUpdates.find(
        (update) => update.state.myPlayerId === alicePlayerId,
      )!;
      expect(rackTileIdsFromStateMessage(aliceStateAfterResolution)).toEqual(
        expect.arrayContaining(carolCourtesySelection),
      );
      const carolStateAfterResolution = firstPairResolvedUpdates.find(
        (update) => update.state.myPlayerId === carolPlayerId,
      )!;
      expect(rackTileIdsFromStateMessage(carolStateAfterResolution)).toEqual(
        expect.arrayContaining(aliceCourtesySelection.slice(0, 2)),
      );
      expect(rackTileIdsFromStateMessage(carolStateAfterResolution)).not.toContain(
        aliceCourtesySelection[2],
      );

      await submitActionAndCollect(bobPlayerId, {
        type: "COURTESY_PASS",
        playerId: bobPlayerId,
        count: 0,
        tileIds: [],
      });

      const daveSelection = visibleSelection(davePlayerId, 2);
      const finalCourtesyUpdates = await submitActionAndCollect(davePlayerId, {
        type: "COURTESY_PASS",
        playerId: davePlayerId,
        count: 2,
        tileIds: daveSelection,
      });

      for (const update of finalCourtesyUpdates) {
        expect(update.resolvedAction).toEqual({
          type: "COURTESY_PAIR_RESOLVED",
          pairing: [bobPlayerId, davePlayerId],
          playerRequests: {
            [bobPlayerId]: 0,
            [davePlayerId]: 2,
          },
          appliedCount: 0,
          entersPlay: true,
        });
        const state = requirePlayerGameView(update.state);
        expect(state.gamePhase).toBe("play");
        expect(state.currentTurn).toBe(alicePlayerId);
        expect(state.turnPhase).toBe("discard");
        expect(state.charleston).toBeNull();
      }
    },
  );
});
