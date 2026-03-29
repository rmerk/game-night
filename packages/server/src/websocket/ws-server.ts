import { WebSocketServer, type WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import type { FastifyBaseLogger } from "fastify";
import { ConnectionTracker } from "./connection-tracker";
import { handleMessage } from "./message-handler";

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

export function setupWebSocketServer(fastify: FastifyInstance): WsServerContext {
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

  wss.on("connection", (ws: WebSocket) => {
    ws.isAlive = true;
    connectionTracker.addConnection(ws);
    logger.info("WebSocket connection opened");

    ws.on("pong", () => {
      ws.isAlive = true;
      logger.debug("Pong received");
    });

    ws.on("message", (data) => {
      handleMessage(ws, data, logger);
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
