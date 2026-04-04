import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { MAX_CHAT_LENGTH, PROTOCOL_VERSION } from "@mahjong-game/shared";
import { useRoomConnection } from "./useRoomConnection";

describe("useRoomConnection sendChat", () => {
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
    conn.sendChat("hello");
    expect(sendFn).not.toHaveBeenCalled();
  });

  it("sends trimmed CHAT with protocol version when socket is open", async () => {
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

    conn.sendChat("  hi  ");
    const chatPayload = sent.find((s) => s.includes('"type":"CHAT"'));
    expect(chatPayload).toBeDefined();
    const obj = JSON.parse(chatPayload!);
    expect(obj.version).toBe(PROTOCOL_VERSION);
    expect(obj.type).toBe("CHAT");
    expect(obj.text).toBe("hi");
  });

  it("truncates text longer than MAX_CHAT_LENGTH", async () => {
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

    conn.sendChat("x".repeat(MAX_CHAT_LENGTH + 50));
    const chatPayload = sent.find((s) => s.includes('"type":"CHAT"'));
    expect(chatPayload).toBeDefined();
    const obj = JSON.parse(chatPayload!);
    expect(obj.text.length).toBe(MAX_CHAT_LENGTH);
  });
});
