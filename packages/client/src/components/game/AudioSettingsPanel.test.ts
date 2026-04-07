import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import AudioSettingsPanel from "./AudioSettingsPanel.vue";

// ─── Mock the audio store ──────────────────────────────────────────────────────

const mockSetGameplayVolume = vi.fn();
const mockSetNotificationVolume = vi.fn();
const mockSetAmbientVolume = vi.fn();
const mockSetMasterMuted = vi.fn();
const mockSetAmbientEnabled = vi.fn();
const mockPlayAmbientLoop = vi.fn().mockResolvedValue(undefined);
const mockStopAmbientLoop = vi.fn();

const mockStore = {
  gameplayVolume: 0.8,
  notificationVolume: 0.7,
  ambientVolume: 0.3,
  masterMuted: false,
  ambientEnabled: false,
  setGameplayVolume: mockSetGameplayVolume,
  setNotificationVolume: mockSetNotificationVolume,
  setAmbientVolume: mockSetAmbientVolume,
  setMasterMuted: mockSetMasterMuted,
  setAmbientEnabled: mockSetAmbientEnabled,
  playAmbientLoop: mockPlayAmbientLoop,
  stopAmbientLoop: mockStopAmbientLoop,
};

vi.mock("../../stores/audio", () => ({
  useAudioStore: () => mockStore,
}));

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("AudioSettingsPanel (Story 7.3 Task 6 — AC 4, 6, 8)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // Reset store values to defaults
    mockStore.gameplayVolume = 0.8;
    mockStore.notificationVolume = 0.7;
    mockStore.ambientVolume = 0.3;
    mockStore.masterMuted = false;
    mockStore.ambientEnabled = false;
  });

  it("renders all three volume sliders", () => {
    const wrapper = mount(AudioSettingsPanel);
    const sliders = wrapper.findAll('input[type="range"]');
    expect(sliders).toHaveLength(3);
  });

  it("renders master mute toggle", () => {
    const wrapper = mount(AudioSettingsPanel);
    const switches = wrapper.findAll('[role="switch"]');
    // There should be at least one switch (mute + ambient enable)
    expect(switches.length).toBeGreaterThanOrEqual(1);
    expect(wrapper.text().toLowerCase()).toContain("mute");
  });

  it("renders ambient enable toggle", () => {
    const wrapper = mount(AudioSettingsPanel);
    const switches = wrapper.findAll('[role="switch"]');
    // Two toggles: master mute + ambient enable
    expect(switches.length).toBeGreaterThanOrEqual(2);
  });

  it("displays gameplay volume as 0–100 (default 80)", () => {
    const wrapper = mount(AudioSettingsPanel);
    const sliders = wrapper.element.querySelectorAll('input[type="range"]');
    expect((sliders[0] as HTMLInputElement).value).toBe("80");
  });

  it("displays notification volume as 0–100 (default 70)", () => {
    const wrapper = mount(AudioSettingsPanel);
    const sliders = wrapper.element.querySelectorAll('input[type="range"]');
    expect((sliders[1] as HTMLInputElement).value).toBe("70");
  });

  it("displays ambient volume as 0–100 (default 30)", () => {
    const wrapper = mount(AudioSettingsPanel);
    const sliders = wrapper.element.querySelectorAll('input[type="range"]');
    expect((sliders[2] as HTMLInputElement).value).toBe("30");
  });

  it("calls setGameplayVolume(value/100) when gameplay slider changes", async () => {
    const wrapper = mount(AudioSettingsPanel);
    const slider = wrapper.findAll('input[type="range"]')[0];
    await slider.setValue("60");
    await slider.trigger("input");
    await flushPromises();
    expect(mockSetGameplayVolume).toHaveBeenCalledWith(0.6);
  });

  it("calls setNotificationVolume(value/100) when notification slider changes", async () => {
    const wrapper = mount(AudioSettingsPanel);
    const slider = wrapper.findAll('input[type="range"]')[1];
    await slider.setValue("50");
    await slider.trigger("input");
    await flushPromises();
    expect(mockSetNotificationVolume).toHaveBeenCalledWith(0.5);
  });

  it("calls setAmbientVolume(value/100) when ambient slider changes", async () => {
    const wrapper = mount(AudioSettingsPanel);
    const slider = wrapper.findAll('input[type="range"]')[2];
    await slider.setValue("20");
    await slider.trigger("input");
    await flushPromises();
    expect(mockSetAmbientVolume).toHaveBeenCalledWith(0.2);
  });

  it("calls setMasterMuted(true) when master mute toggle is clicked (currently false)", async () => {
    const wrapper = mount(AudioSettingsPanel);
    const switches = wrapper.findAll('[role="switch"]');
    const muteSwitch = switches[0];
    expect(muteSwitch?.exists()).toBe(true);
    await muteSwitch.trigger("click");
    await flushPromises();
    expect(mockSetMasterMuted).toHaveBeenCalledWith(true);
  });

  it("calls setAmbientEnabled(true) and playAmbientLoop when ambient toggle is clicked (currently false)", async () => {
    const wrapper = mount(AudioSettingsPanel);
    const switches = wrapper.findAll('[role="switch"]');
    const ambientSwitch = switches[1];
    expect(ambientSwitch?.exists()).toBe(true);
    await ambientSwitch.trigger("click");
    await flushPromises();
    expect(mockSetAmbientEnabled).toHaveBeenCalledWith(true);
    expect(mockPlayAmbientLoop).toHaveBeenCalled();
  });

  it("calls setAmbientEnabled(false) and stopAmbientLoop when ambient toggle is clicked (currently true)", async () => {
    mockStore.ambientEnabled = true;
    const wrapper = mount(AudioSettingsPanel);
    const switches = wrapper.findAll('[role="switch"]');
    const ambientSwitch = switches[1];
    expect(ambientSwitch?.exists()).toBe(true);
    await ambientSwitch.trigger("click");
    await flushPromises();
    expect(mockSetAmbientEnabled).toHaveBeenCalledWith(false);
    expect(mockStopAmbientLoop).toHaveBeenCalled();
  });

  it("all sliders have min=0 and max=100 attributes", () => {
    const wrapper = mount(AudioSettingsPanel);
    const sliders = wrapper.findAll('input[type="range"]');
    for (const slider of sliders) {
      expect(slider.attributes("min")).toBe("0");
      expect(slider.attributes("max")).toBe("100");
    }
  });
});
