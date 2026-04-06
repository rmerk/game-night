import { describe, it, expect } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";
import RoomSettingsPanel from "./RoomSettingsPanel.vue";

describe("RoomSettingsPanel (4B.7, 5B.6)", () => {
  it("emits joker rules patch when simplified toggle is turned on", async () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: true,
        phase: "lobby",
      },
    });
    const switches = wrapper.findAll('[role="switch"]');
    const jokerSwitch = switches[1];
    expect(jokerSwitch?.exists()).toBe(true);
    await jokerSwitch.trigger("click");
    await flushPromises();
    const ev = wrapper.emitted("change");
    expect(ev?.length).toBeGreaterThanOrEqual(1);
    expect(ev?.[ev.length - 1]?.[0]).toEqual({ jokerRulesMode: "simplified" });
  });

  it("disables controls when canEdit is false", () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: false,
        phase: "scoreboard",
      },
    });
    const switches = wrapper.findAll('[role="switch"]');
    for (const sw of switches) {
      expect(sw.attributes("disabled")).toBeDefined();
    }
    expect(wrapper.find('[data-testid="room-settings-locked-note"]').exists()).toBe(true);
  });

  it("disables duration stepper when timerMode is none", () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: { ...DEFAULT_ROOM_SETTINGS, timerMode: "none" },
        canEdit: true,
        phase: "lobby",
      },
    });
    const spin = wrapper.find('[role="spinbutton"]');
    expect(spin.attributes("aria-disabled")).toBe("true");
  });

  it("does not show locked note in lobby when non-host", () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: false,
        phase: "lobby",
      },
    });
    expect(wrapper.find('[data-testid="room-settings-locked-note"]').exists()).toBe(false);
  });

  it("emits timerMode patch when timed turns toggle is clicked", async () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: true,
        phase: "lobby",
      },
    });
    const timerSwitch = wrapper.findAll('[role="switch"]')[0];
    expect(timerSwitch?.exists()).toBe(true);
    await timerSwitch.trigger("click");
    await flushPromises();
    const ev = wrapper.emitted("change");
    expect(ev?.length).toBeGreaterThanOrEqual(1);
    // DEFAULT_ROOM_SETTINGS has timerMode "timed", so toggling turns it off
    expect(ev?.[ev.length - 1]?.[0]).toEqual({ timerMode: "none" });
  });

  it("emits dealingStyle patch when animated dealing toggle is clicked", async () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: true,
        phase: "lobby",
      },
    });
    const switches = wrapper.findAll('[role="switch"]');
    const dealingSwitch = switches[2];
    expect(dealingSwitch?.exists()).toBe(true);
    await dealingSwitch.trigger("click");
    await flushPromises();
    const ev = wrapper.emitted("change");
    expect(ev?.length).toBeGreaterThanOrEqual(1);
    // DEFAULT_ROOM_SETTINGS has dealingStyle "instant", so toggling turns it on
    expect(ev?.[ev.length - 1]?.[0]).toEqual({ dealingStyle: "animated" });
  });

  it("emits handGuidanceEnabled patch from hand guidance toggle", async () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: true,
        phase: "lobby",
      },
    });
    const guidanceSwitch = wrapper
      .findAll('[role="switch"]')
      .find((w) => w.attributes("aria-label")?.includes("hand guidance"));
    expect(guidanceSwitch?.exists()).toBe(true);
    await guidanceSwitch!.trigger("click");
    await flushPromises();
    const ev = wrapper.emitted("change");
    expect(ev?.length).toBeGreaterThanOrEqual(1);
    expect(ev?.[ev.length - 1]?.[0]).toEqual({ handGuidanceEnabled: false });
  });
});
