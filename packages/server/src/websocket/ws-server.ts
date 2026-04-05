import { WebSocketServer, WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import type { FastifyBaseLogger } from "fastify";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { RoomManager } from "../rooms/room-manager";
import { ConnectionTracker } from "./connection-tracker";
import { handleMessage } from "./message-handler";
import { handleJoinRoom, handleSetJokerRules } from "./join-handler";
import { handleActionMessage } from "./action-handler";
import { handleAfkVoteCastMessage } from "./turn-timer";
import { buildCurrentStateMessage } from "./state-broadcaster";
import { handleChatReactMessage } from "./chat-handler";
import { sendPostStateSequence } from "./post-state-sequence";
import { WS_MAX_PAYLOAD_BYTES } from "./chat-history";

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

function trySendJson(
  ws: WebSocket,
  payload: Record<string, unknown>,
  logger: FastifyBaseLogger,
  context: string,
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    logger.debug({ context, readyState: ws.readyState }, "Skipping send on non-open WebSocket");
    return;
  }

  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    logger.warn({ error, context }, "Failed to send WebSocket message");
  }
}

export function setupWebSocketServer(
  fastify: FastifyInstance,
  roomManager: RoomManager,
): WsServerContext {
  const logger: FastifyBaseLogger = fastify.log.child({ module: "websocket" });
  const connectionTracker = new ConnectionTracker();

  const wss = new WebSocketServer({
    server: fastify.server,
    maxPayload: WS_MAX_PAYLOAD_BYTES,
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
      try {
        const parsed = handleMessage(ws, data, logger);
        if (!parsed) return;

        if (parsed.type === "JOIN_ROOM") {
          handleJoinRoom(ws, parsed, roomManager, logger);
        } else if (parsed.type === "SET_JOKER_RULES") {
          const session = roomManager.findSessionByWs(ws);
          if (!session) {
            trySendJson(
              ws,
              {
                version: PROTOCOL_VERSION,
                type: "ERROR",
                code: "NOT_IN_ROOM",
                message: "You must join a room before changing settings",
              },
              logger,
              "set-joker-rules-not-in-room",
            );
            return;
          }
          handleSetJokerRules(ws, session.room, session.playerId, parsed.jokerRulesMode, logger);
        } else if (parsed.type === "ACTION") {
          const session = roomManager.findSessionByWs(ws);
          if (!session) {
            trySendJson(
              ws,
              {
                version: PROTOCOL_VERSION,
                type: "ERROR",
                code: "NOT_IN_ROOM",
                message: "You must join a room before sending actions",
              },
              logger,
              "action-not-in-room",
            );
            return;
          }
          handleActionMessage(ws, parsed, session.room, session.playerId, logger, roomManager);
        } else if (parsed.type === "AFK_VOTE_CAST") {
          const session = roomManager.findSessionByWs(ws);
          if (!session) {
            trySendJson(
              ws,
              {
                version: PROTOCOL_VERSION,
                type: "ERROR",
                code: "NOT_IN_ROOM",
                message: "You must join a room before voting",
              },
              logger,
              "afk-vote-not-in-room",
            );
            return;
          }
          const playerSession = session.room.sessions.get(session.playerId);
          if (!playerSession) {
            trySendJson(
              ws,
              {
                version: PROTOCOL_VERSION,
                type: "ERROR",
                code: "NOT_IN_ROOM",
                message: "Session not found",
              },
              logger,
              "afk-vote-no-session",
            );
            return;
          }
          handleAfkVoteCastMessage(ws, playerSession, session.room, parsed, logger);
        } else if (parsed.type === "REQUEST_STATE") {
          const session = roomManager.findSessionByWs(ws);
          if (!session) {
            trySendJson(
              ws,
              {
                version: PROTOCOL_VERSION,
                type: "ERROR",
                code: "NOT_IN_ROOM",
                message: "You must join a room before requesting state",
              },
              logger,
              "request-state-not-in-room",
            );
            return;
          }
          const stateMessage = buildCurrentStateMessage(session.room, session.playerId);
          if (stateMessage) {
            sendPostStateSequence(ws, stateMessage, session.room, logger, "request-state");
          }
        } else if (parsed.type === "CHAT" || parsed.type === "REACTION") {
          const session = roomManager.findSessionByWs(ws);
          if (!session) {
            trySendJson(
              ws,
              {
                version: PROTOCOL_VERSION,
                type: "ERROR",
                code: "NOT_IN_ROOM",
                message: "You must join a room before sending chat or reactions",
              },
              logger,
              "chat-react-not-in-room",
            );
            return;
          }
          handleChatReactMessage(session.room, session.playerId, parsed, logger);
        } else {
          logger.debug({ type: parsed.type }, "Unknown WebSocket message type");
        }
      } catch (error) {
        logger.error({ error }, "Unhandled WebSocket message processing error");
        trySendJson(
          ws,
          {
            version: PROTOCOL_VERSION,
            type: "ERROR",
            code: "INTERNAL_ERROR",
            message: "Failed to process message",
          },
          logger,
          "message-processing-failure",
        );
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
