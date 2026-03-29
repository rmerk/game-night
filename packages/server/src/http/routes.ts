import type { FastifyInstance } from "fastify";
import type { RoomManager } from "../rooms/room-manager";

// eslint-disable-next-line no-control-regex -- intentional: strip control characters from user input
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;
const MAX_HOST_NAME_LENGTH = 30;

interface RoomRoutesOptions {
  roomManager: RoomManager;
}

export async function roomRoutes(app: FastifyInstance, { roomManager }: RoomRoutesOptions) {
  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: { hostName?: unknown } }>("/api/rooms", async (req, reply) => {
    const { hostName } = req.body ?? {};

    if (typeof hostName !== "string") {
      return reply.status(400).send({ error: "INVALID_HOST_NAME" });
    }

    const sanitized = hostName.replace(CONTROL_CHARS, "").trim().slice(0, MAX_HOST_NAME_LENGTH);

    if (sanitized.length === 0) {
      return reply.status(400).send({ error: "INVALID_HOST_NAME" });
    }

    const result = roomManager.createRoom(sanitized, req.log);
    return reply.status(201).send(result);
  });

  app.get<{ Params: { code: string } }>("/api/rooms/:code/status", async (req, reply) => {
    const status = roomManager.getRoomStatus(req.params.code);

    if (!status) {
      req.log.warn({ code: req.params.code }, "Room not found");
      return reply.status(404).send({ error: "ROOM_NOT_FOUND" });
    }

    req.log.debug({ code: req.params.code }, "Room status lookup");
    return status;
  });
}
