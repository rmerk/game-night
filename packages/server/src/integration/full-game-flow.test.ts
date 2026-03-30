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
      expect(aliceState.state.gamePhase).toBe("play");

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

      // 10. East player discards a tile (they have 14, must discard)
      const tileToDiscard = eastPlayer.rack[0];
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
});
