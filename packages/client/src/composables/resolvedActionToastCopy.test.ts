import { expect, test } from "vite-plus/test";
import {
  toastCopyHandShown,
  toastCopyHostPromoted,
  toastCopyRematchWaiting,
  toastCopyRoomSettingsChanged,
} from "./resolvedActionToastCopy";
import { DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";

test("toastCopyHandShown", () => {
  expect(toastCopyHandShown("Alex")).toBe("Alex showed their hand");
});

test("toastCopyHostPromoted", () => {
  expect(toastCopyHostPromoted("Alex")).toBe("Alex is now the host");
});

test("toastCopyRematchWaiting pluralization", () => {
  expect(toastCopyRematchWaiting(1)).toBe("Waiting for 1 more player");
  expect(toastCopyRematchWaiting(2)).toBe("Waiting for 2 more players");
});

test("toastCopyRoomSettingsChanged single key", () => {
  const ra = {
    type: "ROOM_SETTINGS_CHANGED" as const,
    changedBy: "p1",
    changedByName: "Host",
    previous: DEFAULT_ROOM_SETTINGS,
    next: { ...DEFAULT_ROOM_SETTINGS, handGuidanceEnabled: false },
    changedKeys: ["handGuidanceEnabled"] as const,
  };
  expect(toastCopyRoomSettingsChanged(ra)).toBe("Host changed hand guidance to Off");
});

test("toastCopyRoomSettingsChanged multiple keys", () => {
  const ra = {
    type: "ROOM_SETTINGS_CHANGED" as const,
    changedBy: "p1",
    changedByName: "Host",
    previous: DEFAULT_ROOM_SETTINGS,
    next: DEFAULT_ROOM_SETTINGS,
    changedKeys: ["handGuidanceEnabled", "jokerRulesMode"] as const,
  };
  expect(toastCopyRoomSettingsChanged(ra)).toBe("Host updated room settings (2 changes)");
});
