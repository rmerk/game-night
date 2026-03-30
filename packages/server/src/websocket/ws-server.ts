import { WebSocketServer, type WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import type { FastifyBaseLogger } from "fastify";
import type { RoomManager } from "../rooms/room-manager";
import { ConnectionTracker } from "./connection-tracker";
import { handleMessage } from "./message-handler";
import { handleJoinRoom } from "./join-handler";
import { handleActionMessage } from "./action-handler";

const HEARTBEAT_INTERVAL_MS = 15_000;

// Extend WebSocket with isAlive for heartbeat tracking
declare module "ws" {
  interface WebSocket {
    isAlive: boolean;
  }
}

export interface WsServerContext {
  wss: WebSocketServer;
  connectionTracker: ConnectionTracker;
}

export function setupWebSocketServer(
  fastify: FastifyInstance,
  roomManager: RoomManager,
): WsServerContext {
  const logger: FastifyBaseLogger = fastify.log.child({ module: "websocket" });
  const connectionTracker = new ConnectionTracker();

  const wss = new WebSocketServer({
    server: fastify.server,
    maxPayload: 65_536, // 64KB
  });

  const heartbeatInterval = setInterval(() => {
    logger.debug("Heartbeat ping cycle");
    wss.clients.forEach((ws: WebSocket) => {
      if (!ws.isAlive) {
        logger.info("Terminating dead connection (missed heartbeat)");
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("connection", (ws: WebSocket, req) => {
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ??
      req.socket.remoteAddress ??
      "unknown";

    if (!connectionTracker.canConnect(ip)) {
      logger.warn({ ip }, "Connection rejected: per-IP limit exceeded");
      ws.close(4029, "TOO_MANY_CONNECTIONS");
      return;
    }

    ws.isAlive = true;
    connectionTracker.addConnection(ws, ip);
    logger.info({ ip }, "WebSocket connection opened");

    ws.on("pong", () => {
      ws.isAlive = true;
      logger.debug("Pong received");
    });

    ws.on("message", (data) => {
      const parsed = handleMessage(ws, data, logger);
      if (!parsed) return;

      if (parsed.type === "JOIN_ROOM") {
        handleJoinRoom(ws, parsed, roomManager, logger);
      } else if (parsed.type === "ACTION") {
        const session = roomManager.findSessionByWs(ws);
        if (!session) {
          ws.send(
            JSON.stringify({
              version: 1,
              type: "ERROR",
              code: "NOT_IN_ROOM",
              message: "You must join a room before sending actions",
            }),
          );
          return;
        }
        handleActionMessage(ws, parsed, session.room, session.playerId, logger, roomManager);
      }
    });

    ws.on("error", (err) => {
      logger.warn({ err: err.message }, "WebSocket connection error");
    });

    ws.on("close", () => {
      logger.info("WebSocket connection closed");
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  // Graceful shutdown: close WebSocket server when Fastify closes
  fastify.addHook("onClose", async () => {
    clearInterval(heartbeatInterval);
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close();
    logger.info("WebSocket server shut down");
  });

  logger.info("WebSocket server started");

  return { wss, connectionTracker };
}
