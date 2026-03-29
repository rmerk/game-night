import { describe, expect, it, vi } from "vitest";
import type { WebSocket, RawData } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { handleMessage } from "./message-handler";

function createMockLogger(): FastifyBaseLogger {
  const mock = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    level: "info",
    child: vi.fn(),
  };
  mock.child.mockReturnValue(mock);
  // oxlint-disable-next-line no-unsafe-type-assertion -- test mock
  return mock as unknown as FastifyBaseLogger;
}

function createMockWs(): WebSocket & { sent: string[] } {
  const sent: string[] = [];
  // oxlint-disable-next-line no-unsafe-type-assertion -- test mock
  return {
    send: vi.fn((data: string) => sent.push(data)),
    sent,
  } as unknown as WebSocket & { sent: string[] };
}

function toRawData(obj: unknown): RawData {
  return Buffer.from(typeof obj === "string" ? obj : JSON.stringify(obj));
}

describe("handleMessage", () => {
  describe("malformed JSON", () => {
    it("drops and logs WARN for invalid JSON", () => {
      const ws = createMockWs();
      const logger = createMockLogger();

      const result = handleMessage(ws, toRawData("not json{{{"), logger);

      expect(result).toBeNull();
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(logger.warn).toHaveBeenCalledWith("Malformed WebSocket message: invalid JSON");
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(ws.send).not.toHaveBeenCalled();
    });

    it("drops and logs WARN for non-object JSON", () => {
      const ws = createMockWs();
      const logger = createMockLogger();

      const result = handleMessage(ws, toRawData('"just a string"'), logger);

      expect(result).toBeNull();
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(logger.warn).toHaveBeenCalledWith("Malformed WebSocket message: not an object");
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(ws.send).not.toHaveBeenCalled();
    });

    it("drops and logs WARN for null JSON", () => {
      const ws = createMockWs();
      const logger = createMockLogger();

      const result = handleMessage(ws, toRawData("null"), logger);

      expect(result).toBeNull();
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(logger.warn).toHaveBeenCalledWith("Malformed WebSocket message: not an object");
    });
  });

  describe("missing version field", () => {
    it("drops and logs WARN when version is absent", () => {
      const ws = createMockWs();
      const logger = createMockLogger();

      const result = handleMessage(ws, toRawData({ type: "ACTION" }), logger);

      expect(result).toBeNull();
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(logger.warn).toHaveBeenCalledWith(
        "Malformed WebSocket message: missing version field",
      );
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe("unsupported version", () => {
    it("responds with ERROR and does not process", () => {
      const ws = createMockWs();
      const logger = createMockLogger();

      const result = handleMessage(ws, toRawData({ version: 999, type: "ACTION" }), logger);

      expect(result).toBeNull();
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(ws.send).toHaveBeenCalledOnce();

      const errorMsg = JSON.parse(ws.sent[0]);
      expect(errorMsg).toEqual({
        version: 1,
        type: "ERROR",
        code: "UNSUPPORTED_VERSION",
        message: "Protocol version not supported",
      });
    });

    it("responds with ERROR for version 0", () => {
      const ws = createMockWs();
      const logger = createMockLogger();

      const result = handleMessage(ws, toRawData({ version: 0, type: "ACTION" }), logger);

      expect(result).toBeNull();
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(ws.send).toHaveBeenCalledOnce();
    });
  });

  describe("valid messages", () => {
    it("returns parsed message for version 1", () => {
      const ws = createMockWs();
      const logger = createMockLogger();

      const result = handleMessage(
        ws,
        toRawData({ version: 1, type: "ACTION", data: "test" }),
        logger,
      );

      expect(result).toEqual({ version: 1, type: "ACTION", data: "test" });
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(ws.send).not.toHaveBeenCalled();
      // oxlint-disable-next-line unbound-method -- vi.fn() mock
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("preserves all fields from original message", () => {
      const ws = createMockWs();
      const logger = createMockLogger();
      const msg = { version: 1, type: "CHAT", text: "hello", extra: true };

      const result = handleMessage(ws, toRawData(msg), logger);

      expect(result).toEqual(msg);
    });
  });
});
