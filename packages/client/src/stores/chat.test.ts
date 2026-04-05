import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { useChatStore } from "./chat";

describe("useChatStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("appendBroadcast appends and clear empties", () => {
    const s = useChatStore();
    s.appendBroadcast({
      version: PROTOCOL_VERSION,
      type: "CHAT_BROADCAST",
      playerId: "p1",
      playerName: "A",
      text: "hi",
      timestamp: 1,
    });
    expect(s.messages.length).toBe(1);
    s.clear();
    expect(s.messages.length).toBe(0);
  });

  it("setMessages replaces then appendBroadcast adds one tail line", () => {
    const s = useChatStore();
    s.setMessages([
      {
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p0",
        playerName: "A",
        text: "from history",
        timestamp: 10,
      },
    ]);
    expect(s.messages.length).toBe(1);
    expect(s.messages[0]?.text).toBe("from history");

    s.appendBroadcast({
      version: PROTOCOL_VERSION,
      type: "CHAT_BROADCAST",
      playerId: "p1",
      playerName: "B",
      text: "live",
      timestamp: 20,
    });
    expect(s.messages.length).toBe(2);
    expect(s.messages[1]?.text).toBe("live");
    expect(s.messages[1]?.playerId).toBe("p1");
  });
});
