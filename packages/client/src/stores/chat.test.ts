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
});
