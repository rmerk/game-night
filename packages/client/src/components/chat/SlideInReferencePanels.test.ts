import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";
import type { GuidanceResult } from "@mahjong-game/shared";
import SlideInReferencePanels from "./SlideInReferencePanels.vue";
import SlideInPanel from "../ui/SlideInPanel.vue";
import NMJLCardPanel from "../nmjl/NMJLCardPanel.vue";
import { useSlideInPanelStore } from "../../stores/slideInPanel";

/** Stable ref so `smaller('md')` matches VueUse’s Ref return type across calls. */
const isMobileViewport = ref(true);
vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useBreakpoints: () => ({
      smaller: () => isMobileViewport,
    }),
  };
});

describe("SlideInReferencePanels", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders NMJLCardPanel content when NMJL panel is open", async () => {
    const wrapper = mount(SlideInReferencePanels, {
      props: {
        sendChat: () => {},
        nmjlCharlestonMobileSplit: false,
      },
    });
    const store = useSlideInPanelStore();
    store.openNmjl();
    await flushPromises();
    expect(wrapper.text()).toContain("NMJL Card");
    expect(wrapper.text()).not.toContain("Placeholder panel");
  });

  it("opening NMJL when chat is active closes chat (mutual exclusivity)", async () => {
    mount(SlideInReferencePanels, {
      props: { sendChat: () => {} },
    });
    const store = useSlideInPanelStore();
    store.openChat();
    expect(store.activePanel).toBe("chat");
    store.openNmjl();
    expect(store.activePanel).toBe("nmjl");
  });

  it("opening settings when chat is active replaces chat (mutual exclusivity)", () => {
    mount(SlideInReferencePanels, {
      props: { sendChat: () => {}, roomSettings: DEFAULT_ROOM_SETTINGS },
    });
    const store = useSlideInPanelStore();
    store.openChat();
    store.openSettings();
    expect(store.activePanel).toBe("settings");
  });

  it("passes top mobile placement for NMJL when Charleston split is on and viewport is mobile", async () => {
    Object.defineProperty(window, "innerWidth", { value: 600, configurable: true });
    const wrapper = mount(SlideInReferencePanels, {
      props: {
        sendChat: () => {},
        nmjlCharlestonMobileSplit: true,
      },
    });
    await flushPromises();
    const panels = wrapper.findAllComponents(SlideInPanel);
    expect(panels.length).toBe(2);
    const nmjlPanel = panels[1];
    expect(nmjlPanel?.props("mobilePlacement")).toBe("top");
  });

  it("keeps bottom mobile placement during Charleston when viewport is desktop (md+)", async () => {
    isMobileViewport.value = false;
    const wrapper = mount(SlideInReferencePanels, {
      props: {
        sendChat: () => {},
        nmjlCharlestonMobileSplit: true,
      },
    });
    await flushPromises();
    const panels = wrapper.findAllComponents(SlideInPanel);
    const nmjlPanel = panels[1];
    expect(nmjlPanel?.props("mobilePlacement")).toBe("bottom");
    isMobileViewport.value = true;
  });

  it("passes NMJL guidance props through to NMJLCardPanel (5B.2)", async () => {
    const guidanceMap = new Map<string, GuidanceResult>([
      ["ev-1", { patternId: "ev-1", distance: 1, achievable: true }],
    ]);
    const wrapper = mount(SlideInReferencePanels, {
      props: {
        sendChat: () => {},
        nmjlGuidanceActive: true,
        nmjlGuidanceByHandId: guidanceMap,
        nmjlShowPersonalReenableHint: true,
      },
    });
    const store = useSlideInPanelStore();
    store.openNmjl();
    await flushPromises();
    const nmjl = wrapper.findComponent(NMJLCardPanel);
    expect(nmjl.exists()).toBe(true);
    expect(nmjl.props("guidanceActive")).toBe(true);
    const passedMap = nmjl.props("guidanceByHandId") as ReadonlyMap<string, GuidanceResult>;
    expect(passedMap.size).toBe(guidanceMap.size);
    expect(passedMap.get("ev-1")).toEqual(guidanceMap.get("ev-1"));
    expect(nmjl.props("showPersonalReenableHint")).toBe(true);
  });
});
