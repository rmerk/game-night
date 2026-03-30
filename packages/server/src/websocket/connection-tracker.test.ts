import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import { ConnectionTracker } from "./connection-tracker";
import type { WebSocket } from "ws";

function createMockWs(): WebSocket {
  // oxlint-disable-next-line no-unsafe-type-assertion -- test mock
  return new EventEmitter() as unknown as WebSocket;
}

describe("ConnectionTracker", () => {
  describe("addConnection", () => {
    it("tracks a new connection", () => {
      const tracker = new ConnectionTracker();
      const ws = createMockWs();

      tracker.addConnection(ws, "127.0.0.1");

      expect(tracker.getConnectionCount()).toBe(1);
    });

    it("tracks multiple connections", () => {
      const tracker = new ConnectionTracker();
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      tracker.addConnection(ws1, "127.0.0.1");
      tracker.addConnection(ws2, "127.0.0.1");

      expect(tracker.getConnectionCount()).toBe(2);
    });

    it("records connectedAt timestamp", () => {
      const tracker = new ConnectionTracker();
      const ws = createMockWs();
      const before = Date.now();

      tracker.addConnection(ws, "127.0.0.1");

      const connections = tracker.getAllConnections();
      const tracked = connections.get(ws);
      expect(tracked).toBeDefined();
      expect(tracked!.connectedAt).toBeGreaterThanOrEqual(before);
      expect(tracked!.connectedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("removeConnection", () => {
    it("removes a tracked connection", () => {
      const tracker = new ConnectionTracker();
      const ws = createMockWs();

      tracker.addConnection(ws, "127.0.0.1");
      expect(tracker.getConnectionCount()).toBe(1);

      tracker.removeConnection(ws);
      expect(tracker.getConnectionCount()).toBe(0);
    });

    it("does nothing when removing an untracked connection", () => {
      const tracker = new ConnectionTracker();
      const ws = createMockWs();

      tracker.removeConnection(ws);
      expect(tracker.getConnectionCount()).toBe(0);
    });
  });

  describe("auto-remove on close event", () => {
    it("removes connection when close event fires", () => {
      const tracker = new ConnectionTracker();
      const ws = createMockWs();

      tracker.addConnection(ws, "127.0.0.1");
      expect(tracker.getConnectionCount()).toBe(1);

      ws.emit("close");
      expect(tracker.getConnectionCount()).toBe(0);
    });
  });

  describe("per-IP tracking", () => {
    it("tracks connection count per IP", () => {
      const tracker = new ConnectionTracker();
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      tracker.addConnection(ws1, "192.168.1.1");
      tracker.addConnection(ws2, "192.168.1.1");

      expect(tracker.getConnectionCountByIp("192.168.1.1")).toBe(2);
    });

    it("decrements count when connection closes", () => {
      const tracker = new ConnectionTracker();
      const ws = createMockWs();

      tracker.addConnection(ws, "192.168.1.1");
      expect(tracker.getConnectionCountByIp("192.168.1.1")).toBe(1);

      tracker.removeConnection(ws);
      expect(tracker.getConnectionCountByIp("192.168.1.1")).toBe(0);
    });

    it("rejects connections exceeding per-IP limit", () => {
      const tracker = new ConnectionTracker({ maxConnectionsPerIp: 5 });
      const ip = "10.0.0.1";

      for (let i = 0; i < 5; i++) {
        expect(tracker.canConnect(ip)).toBe(true);
        tracker.addConnection(createMockWs(), ip);
      }

      expect(tracker.canConnect(ip)).toBe(false);
    });

    it("allows connections from different IPs independently", () => {
      const tracker = new ConnectionTracker({ maxConnectionsPerIp: 2 });

      tracker.addConnection(createMockWs(), "10.0.0.1");
      tracker.addConnection(createMockWs(), "10.0.0.1");
      tracker.addConnection(createMockWs(), "10.0.0.2");

      expect(tracker.canConnect("10.0.0.1")).toBe(false);
      expect(tracker.canConnect("10.0.0.2")).toBe(true);
    });
  });

  describe("getAllConnections", () => {
    it("returns all tracked connections", () => {
      const tracker = new ConnectionTracker();
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      tracker.addConnection(ws1, "127.0.0.1");
      tracker.addConnection(ws2, "127.0.0.1");

      const all = tracker.getAllConnections();
      expect(all.size).toBe(2);
      expect(all.has(ws1)).toBe(true);
      expect(all.has(ws2)).toBe(true);
    });

    it("returns empty map when no connections", () => {
      const tracker = new ConnectionTracker();
      expect(tracker.getAllConnections().size).toBe(0);
    });
  });
});
