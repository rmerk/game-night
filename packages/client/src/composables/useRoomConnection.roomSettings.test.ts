import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { useRoomConnection } from "./useRoomConnection";

describe("useRoomConnection room settings + rematch (4B.7)", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.restoreAllMocks();
  });

  it("sendSetRoomSettings sends SET_ROOM_SETTINGS with protocol version", async () => {
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

    conn.sendSetRoomSettings({ jokerRulesMode: "simplified" });
    const raw = sent.find((s) => s.includes('"type":"SET_ROOM_SETTINGS"'));
    expect(raw).toBeDefined();
    const obj = JSON.parse(raw!) as Record<string, unknown>;
    expect(obj.version).toBe(PROTOCOL_VERSION);
    expect(obj.type).toBe("SET_ROOM_SETTINGS");
    expect(obj.jokerRulesMode).toBe("simplified");
  });

  it("sendRematch sends REMATCH", async () => {
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
    conn.sendRematch();
    const raw = sent.find((s) => s.includes('"type":"REMATCH"'));
    expect(raw).toBeDefined();
    const obj = JSON.parse(raw!) as Record<string, unknown>;
    expect(obj.type).toBe("REMATCH");
  });
});
