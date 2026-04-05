import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { useRoomConnection } from "./useRoomConnection";

describe("useRoomConnection departure (4B.5)", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.restoreAllMocks();
  });

  it("sendDepartureVote sends DEPARTURE_VOTE_CAST with protocol version", async () => {
    const sent: string[] = [];
    globalThis.WebSocket = class {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly readyState = WebSocket.OPEN;
      send = (data: string) => {
        sent.push(data);
      };
      addEventListener(type: string, listener: EventListener) {
        if (type === "open") {
          queueMicrotask(() => listener.call(this, new Event("open")));
        }
      }
      removeEventListener() {}
      close() {}
    } as unknown as typeof WebSocket;

    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    conn.sendDepartureVote("player-0", "dead_seat");
    const raw = sent.find((s) => s.includes('"type":"DEPARTURE_VOTE_CAST"'));
    expect(raw).toBeDefined();
    const obj = JSON.parse(raw!) as Record<string, unknown>;
    expect(obj.version).toBe(PROTOCOL_VERSION);
    expect(obj.type).toBe("DEPARTURE_VOTE_CAST");
    expect(obj.targetPlayerId).toBe("player-0");
    expect(obj.choice).toBe("dead_seat");
  });

  it("sendLeaveRoom sends LEAVE_ROOM then closes socket", async () => {
    const sent: string[] = [];
    const closeSpy = vi.fn();
    globalThis.WebSocket = class {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly readyState = WebSocket.OPEN;
      send = (data: string) => {
        sent.push(data);
      };
      addEventListener(type: string, listener: EventListener) {
        if (type === "open") {
          queueMicrotask(() => listener.call(this, new Event("open")));
        }
      }
      removeEventListener() {}
      close = closeSpy;
    } as unknown as typeof WebSocket;

    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    conn.sendLeaveRoom();
    const raw = sent.find((s) => s.includes('"type":"LEAVE_ROOM"'));
    expect(raw).toBeDefined();
    const obj = JSON.parse(raw!) as Record<string, unknown>;
    expect(obj.version).toBe(PROTOCOL_VERSION);
    expect(obj.type).toBe("LEAVE_ROOM");
    expect(closeSpy).toHaveBeenCalled();
  });
});
