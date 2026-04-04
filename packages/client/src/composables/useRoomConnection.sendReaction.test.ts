import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { useRoomConnection } from "./useRoomConnection";

describe("useRoomConnection sendReaction", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.restoreAllMocks();
  });

  it("does not send when socket is not open", () => {
    const sendFn = vi.fn();
    globalThis.WebSocket = class {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly readyState = WebSocket.CONNECTING;
      send = sendFn;
      addEventListener() {}
      removeEventListener() {}
      close() {}
    } as unknown as typeof WebSocket;

    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    conn.sendReaction("👍");
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("does not send when emoji is not allowlisted", async () => {
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

    conn.sendReaction("💀");
    expect(sent.filter((s) => s.includes('"type":"REACTION"'))).toHaveLength(0);
  });

  it("sends REACTION with protocol version when socket is open", async () => {
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

    conn.sendReaction("👍");
    const payload = sent.find((s) => s.includes('"type":"REACTION"'));
    expect(payload).toBeDefined();
    const obj = JSON.parse(payload!);
    expect(obj.version).toBe(PROTOCOL_VERSION);
    expect(obj.type).toBe("REACTION");
    expect(obj.emoji).toBe("👍");
  });
});
