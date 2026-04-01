import { describe, expect, it, afterEach } from "vitest";
import { WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
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
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on("close", () => resolve());
  });
}

/**
 * Create a buffered message reader for a WebSocket.
 * Messages are buffered as they arrive so none are lost between awaits.
 */
function createMessageReader(ws: WebSocket) {
  const buffer: Record<string, unknown>[] = [];
  let waiting: ((msg: Record<string, unknown>) => void) | null = null;

  ws.on("message", (data: Buffer) => {
    const parsed = JSON.parse(data.toString("utf8")) as Record<string, unknown>;
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(parsed);
    } else {
      buffer.push(parsed);
    }
  });

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper returns dynamic server messages
    next(): Promise<Record<string, any>> {
      if (buffer.length > 0) {
        return Promise.resolve(buffer.shift()!);
      }
      return new Promise((resolve) => {
        waiting = resolve;
      });
    },
  };
}

function rackTileIdsFromStateMessage(message: Record<string, unknown>): string[] {
  const state = message.state as {
    myRack: Array<{ id: string }>;
  };
  return state.myRack.map((tile) => tile.id);
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
      const aliceJoinMsg = await aliceReader.next();
      expect(aliceJoinMsg.type).toBe("STATE_UPDATE");
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;
      const aliceToken = aliceJoinMsg.token;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);

      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.next();
      expect(bobJoinMsg.type).toBe("STATE_UPDATE");
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);

      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.next();
      expect(carolJoinMsg.type).toBe("STATE_UPDATE");
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);

      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.next();
      expect(daveJoinMsg.type).toBe("STATE_UPDATE");
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      // Consume PLAYER_JOINED broadcasts (Alice gets 3, Bob gets 2, Carol gets 1)
      await Promise.all([
        aliceReader.next(),
        aliceReader.next(),
        aliceReader.next(),
        bobReader.next(),
        bobReader.next(),
        carolReader.next(),
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
      expect(rejectMsg.type).toBe("ERROR");
      expect(rejectMsg.code).toBe("NOT_HOST");

      // 6. Host starts game
      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));

      // All 4 players receive STATE_UPDATE with game state
      const aliceState = await aliceReader.next();
      const bobState = await bobReader.next();
      const carolState = await carolReader.next();
      const daveState = await daveReader.next();

      expect(aliceState.type).toBe("STATE_UPDATE");
      expect(aliceState.state.gamePhase).toBe("charleston");
      expect(aliceState.state.charleston).toMatchObject({
        currentDirection: "right",
        status: "passing",
        stage: "first",
      });

      // 7. Verify per-player filtering — each player sees only their own rack
      expect(aliceState.state.myRack.length).toBeGreaterThan(0);
      expect(bobState.state.myRack.length).toBeGreaterThan(0);

      // Verify racks are different (different players have different tiles)
      const aliceRackIds = aliceState.state.myRack.map((t: Record<string, unknown>) => t.id).sort();
      const bobRackIds = bobState.state.myRack.map((t: Record<string, unknown>) => t.id).sort();
      expect(aliceRackIds).not.toEqual(bobRackIds);

      // 8. Verify no opponent racks leaked
      const aliceStr = JSON.stringify(aliceState.state);
      for (const id of bobRackIds) {
        expect(aliceStr).not.toContain(id);
      }

      // 9. East player (player-0) has 14 tiles, others have 13
      const players = [
        { id: alicePlayerId, rack: aliceState.state.myRack, ws: aliceWs, reader: aliceReader },
        { id: bobPlayerId, rack: bobState.state.myRack, ws: bobWs, reader: bobReader },
        { id: carolPlayerId, rack: carolState.state.myRack, ws: carolWs, reader: carolReader },
        { id: davePlayerId, rack: daveState.state.myRack, ws: daveWs, reader: daveReader },
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
      const tileToDiscard = eastPlayer.rack.find(
        (tile: Record<string, unknown>) => tile.category !== "joker",
      )!;
      eastPlayer.ws.send(
        JSON.stringify({
          version: 1,
          type: "ACTION",
          action: { type: "DISCARD_TILE", playerId: eastPlayer.id, tileId: tileToDiscard.id },
        }),
      );

      // East player should get STATE_UPDATE after discard
      const postDiscard = await eastPlayer.reader.next();
      expect(postDiscard.type).toBe("STATE_UPDATE");

      // 11. Verify room status shows game in progress
      const playStatus = await app.inject({
        method: "GET",
        url: `/api/rooms/${roomCode}/status`,
      });
      expect(playStatus.json().phase).toBe("play");

      // 12. Token-based reconnection works
      aliceWs.close();
      await waitForClose(aliceWs);

      const aliceReconnectWs = createWs();
      await waitForOpen(aliceReconnectWs);
      const aliceReconnectReader = createMessageReader(aliceReconnectWs);
      aliceReconnectWs.send(
        JSON.stringify({
          version: 1,
          type: "JOIN_ROOM",
          roomCode,
          displayName: "Alice",
          token: aliceToken,
        }),
      );
      const reconnectMsg = await aliceReconnectReader.next();
      expect(reconnectMsg.type).toBe("STATE_UPDATE");
      expect(reconnectMsg.state.myPlayerId).toBe(alicePlayerId);
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
      const aliceJoinMsg = await aliceReader.next();
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);
      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.next();
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);
      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.next();
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);
      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.next();
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      await Promise.all([
        aliceReader.next(),
        aliceReader.next(),
        aliceReader.next(),
        bobReader.next(),
        bobReader.next(),
        carolReader.next(),
      ]);

      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));

      const aliceState = await aliceReader.next();
      const bobState = await bobReader.next();
      const carolState = await carolReader.next();
      const daveState = await daveReader.next();

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

      const playersById = Object.fromEntries(
        players.map((player) => [player.id, player]),
      ) as Record<string, (typeof players)[number]>;

      function visibleSelection(playerId: string): string[] {
        return rackTileIdsFromStateMessage(playersById[playerId].latestState).slice(0, 3);
      }

      function expectNoLeak(
        updates: Array<Record<string, unknown>>,
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
      ): Promise<Array<Record<string, unknown>>> {
        playersById[playerId].ws.send(
          JSON.stringify({
            version: 1,
            type: "ACTION",
            action: { type: "CHARLESTON_PASS", playerId, tileIds },
          }),
        );

        const updates = await Promise.all(players.map((player) => player.reader.next()));
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
      expect(playersById[eastPlayerId].latestState.state.charleston).toMatchObject({
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
      expect(playersById[eastPlayerId].latestState.state.charleston).toMatchObject({
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
        const finalState = update.state as {
          gamePhase: string;
          charleston: Record<string, unknown> | null;
        };
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
      const aliceJoinMsg = await aliceReader.next();
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);
      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.next();
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);
      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.next();
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);
      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.next();
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      await Promise.all([
        aliceReader.next(),
        aliceReader.next(),
        aliceReader.next(),
        bobReader.next(),
        bobReader.next(),
        carolReader.next(),
      ]);

      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));
      await Promise.all([
        aliceReader.next(),
        bobReader.next(),
        carolReader.next(),
        daveReader.next(),
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
      };

      aliceWs.send(
        JSON.stringify({
          version: 1,
          type: "ACTION",
          action: { type: "CHARLESTON_VOTE", playerId: alicePlayerId, accept: false },
        }),
      );

      const updates = await Promise.all([
        aliceReader.next(),
        bobReader.next(),
        carolReader.next(),
        daveReader.next(),
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

        const state = update.state as {
          gamePhase: string;
          charleston: Record<string, unknown> | null;
        };
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
      const aliceJoinMsg = await aliceReader.next();
      const alicePlayerId = aliceJoinMsg.state.myPlayerId;

      const bobWs = createWs();
      await waitForOpen(bobWs);
      const bobReader = createMessageReader(bobWs);
      bobWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Bob" }));
      const bobJoinMsg = await bobReader.next();
      const bobPlayerId = bobJoinMsg.state.myPlayerId;

      const carolWs = createWs();
      await waitForOpen(carolWs);
      const carolReader = createMessageReader(carolWs);
      carolWs.send(
        JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Carol" }),
      );
      const carolJoinMsg = await carolReader.next();
      const carolPlayerId = carolJoinMsg.state.myPlayerId;

      const daveWs = createWs();
      await waitForOpen(daveWs);
      const daveReader = createMessageReader(daveWs);
      daveWs.send(JSON.stringify({ version: 1, type: "JOIN_ROOM", roomCode, displayName: "Dave" }));
      const daveJoinMsg = await daveReader.next();
      const davePlayerId = daveJoinMsg.state.myPlayerId;

      await Promise.all([
        aliceReader.next(),
        aliceReader.next(),
        aliceReader.next(),
        bobReader.next(),
        bobReader.next(),
        carolReader.next(),
      ]);

      aliceWs.send(JSON.stringify({ version: 1, type: "ACTION", action: { type: "START_GAME" } }));

      const initialStates = await Promise.all([
        aliceReader.next(),
        bobReader.next(),
        carolReader.next(),
        daveReader.next(),
      ]);

      const players = [
        { id: alicePlayerId, ws: aliceWs, reader: aliceReader, latestState: initialStates[0] },
        { id: bobPlayerId, ws: bobWs, reader: bobReader, latestState: initialStates[1] },
        { id: carolPlayerId, ws: carolWs, reader: carolReader, latestState: initialStates[2] },
        { id: davePlayerId, ws: daveWs, reader: daveReader, latestState: initialStates[3] },
      ];

      const playersById = Object.fromEntries(
        players.map((player) => [player.id, player]),
      ) as Record<string, (typeof players)[number]>;

      function visibleSelection(playerId: string): string[] {
        return rackTileIdsFromStateMessage(playersById[playerId].latestState).slice(0, 3);
      }

      function expectNoLeak(
        updates: Array<Record<string, unknown>>,
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
      ): Promise<Array<Record<string, unknown>>> {
        playersById[senderPlayerId].ws.send(
          JSON.stringify({
            version: 1,
            type: "ACTION",
            action,
          }),
        );

        const updates = await Promise.all(players.map((player) => player.reader.next()));
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
        expect(
          (update.state as { charleston: { submittedPlayerIds: string[] } }).charleston
            .submittedPlayerIds,
        ).toEqual([]);
      }
      const aliceFirst = firstVoteUpdates.find(
        (u) => (u.state as { myPlayerId: string }).myPlayerId === alicePlayerId,
      );
      expect(
        (aliceFirst!.state as { charleston: { myVote: boolean | null } }).charleston.myVote,
      ).toBe(true);

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
        expect((update.state as { charleston: Record<string, unknown> }).charleston).toMatchObject({
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
      const eastStateAfterAcross = playersById[alicePlayerId].latestState.state as {
        myRack: Array<{ id: string }>;
        charleston: Record<string, unknown> | null;
      };
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
      const eastStateAfterRightLock = playersById[alicePlayerId].latestState.state as {
        myRack: Array<{ id: string }>;
      };
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
        expect(
          (update.state as { gamePhase: string; charleston: Record<string, unknown> | null })
            .gamePhase,
        ).toBe("charleston");
        expect(
          (update.state as { charleston: Record<string, unknown> | null }).charleston,
        ).toMatchObject({
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
});
