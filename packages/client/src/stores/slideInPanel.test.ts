import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useSlideInPanelStore } from "./slideInPanel";

describe("useSlideInPanelStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("mutual exclusivity: openChat closes nmjl", () => {
    const s = useSlideInPanelStore();
    s.openNmjl();
    expect(s.activePanel).toBe("nmjl");
    s.openChat();
    expect(s.activePanel).toBe("chat");
  });

  it("isAnySlideInPanelOpen reflects activePanel", () => {
    const s = useSlideInPanelStore();
    expect(s.isAnySlideInPanelOpen).toBe(false);
    s.openChat();
    expect(s.isAnySlideInPanelOpen).toBe(true);
    s.close();
    expect(s.isAnySlideInPanelOpen).toBe(false);
  });

  it("resetForRoomLeave clears panel", () => {
    const s = useSlideInPanelStore();
    s.openChat();
    s.resetForRoomLeave();
    expect(s.activePanel).toBeNull();
  });

  it("toggleNmjl opens when closed and closes when open", () => {
    const s = useSlideInPanelStore();
    s.toggleNmjl();
    expect(s.activePanel).toBe("nmjl");
    s.toggleNmjl();
    expect(s.activePanel).toBeNull();
  });
});
