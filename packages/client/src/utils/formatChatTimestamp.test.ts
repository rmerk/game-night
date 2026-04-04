import { expect, test } from "vite-plus/test";
import { formatChatTimestamp } from "./formatChatTimestamp";

test("formatChatTimestamp returns a non-empty string for valid ms", () => {
  const s = formatChatTimestamp(1_704_000_000_000);
  expect(typeof s).toBe("string");
  expect(s.length).toBeGreaterThan(0);
});
