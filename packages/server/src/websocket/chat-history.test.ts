import { describe, expect, it } from "vite-plus/test";
import { Buffer } from "node:buffer";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { ChatBroadcast } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import { buildChatHistoryPayloadJson, WS_MAX_PAYLOAD_BYTES } from "./chat-history";

function minimalRoomWithHistory(entries: ChatBroadcast[]): Pick<Room, "chatHistory"> {
  return { chatHistory: [...entries] };
}

describe("buildChatHistoryPayloadJson", () => {
  it("returns empty messages array when room has no history", () => {
    const room = minimalRoomWithHistory([]);
    const json = buildChatHistoryPayloadJson(room as Room);
    const parsed = JSON.parse(json) as {
      version: number;
      type: string;
      messages: unknown[];
    };
    expect(parsed.version).toBe(PROTOCOL_VERSION);
    expect(parsed.type).toBe("CHAT_HISTORY");
    expect(parsed.messages).toEqual([]);
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(WS_MAX_PAYLOAD_BYTES);
  });

  it("preserves chronological order (oldest first)", () => {
    const room = minimalRoomWithHistory([
      {
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p0",
        playerName: "A",
        text: "first",
        timestamp: 1,
      },
      {
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p1",
        playerName: "B",
        text: "second",
        timestamp: 2,
      },
    ]);
    const parsed = JSON.parse(buildChatHistoryPayloadJson(room as Room)) as {
      messages: ChatBroadcast[];
    };
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0]?.text).toBe("first");
    expect(parsed.messages[1]?.text).toBe("second");
  });

  it("drops oldest entries until UTF-8 byte length fits cap (emoji-heavy text)", () => {
    const heavy = "😀".repeat(4000);
    const entries: ChatBroadcast[] = [];
    for (let i = 0; i < 5; i += 1) {
      entries.push({
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p0",
        playerName: "A",
        text: `${heavy}-${i}`,
        timestamp: i,
      });
    }
    const room = minimalRoomWithHistory(entries);
    const json = buildChatHistoryPayloadJson(room as Room);
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(WS_MAX_PAYLOAD_BYTES);
    const parsed = JSON.parse(json) as { messages: ChatBroadcast[] };
    expect(parsed.messages.length).toBeGreaterThan(0);
    expect(parsed.messages.length).toBeLessThan(entries.length);
    expect(parsed.messages[0]?.text).toContain(`${heavy}-`);
    expect(json.length).toBeLessThan(Buffer.byteLength(json, "utf8"));
  });

  it("falls back to empty messages when even one entry exceeds cap", () => {
    const huge = "x".repeat(WS_MAX_PAYLOAD_BYTES + 10);
    const room = minimalRoomWithHistory([
      {
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p0",
        playerName: "A",
        text: huge,
        timestamp: 1,
      },
    ]);
    const json = buildChatHistoryPayloadJson(room as Room);
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(WS_MAX_PAYLOAD_BYTES);
    const parsed = JSON.parse(json) as { messages: unknown[] };
    expect(parsed.messages).toEqual([]);
  });
});
