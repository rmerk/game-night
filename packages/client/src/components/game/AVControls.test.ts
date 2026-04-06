import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import AVControls from "./AVControls.vue";

describe("AVControls", () => {
  function mountControls(props: {
    isMicEnabled: boolean;
    isCameraEnabled: boolean;
    connectionStatus: string;
    permissionState: "granted" | "denied" | "prompt" | "unknown";
    surface?: "chrome" | "felt";
  }) {
    return mount(AVControls, { props });
  }

  it("shows permission banner and Turn on A/V when permissionState is prompt and connected", () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "connected",
      permissionState: "prompt",
    });
    expect(wrapper.find("[data-testid='av-permission-banner']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='av-request-button']").text()).toContain("Turn on A/V");
  });

  it("hides permission banner when permissionState is granted", () => {
    const wrapper = mountControls({
      isMicEnabled: true,
      isCameraEnabled: true,
      connectionStatus: "connected",
      permissionState: "granted",
    });
    expect(wrapper.find("[data-testid='av-permission-banner']").exists()).toBe(false);
  });

  it("emits request-av when Turn on A/V is clicked", async () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "connected",
      permissionState: "prompt",
    });
    await wrapper.find("[data-testid='av-request-button']").trigger("click");
    expect(wrapper.emitted("request-av")).toHaveLength(1);
  });

  it("shows A/V unavailable message when permission is denied", () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "connected",
      permissionState: "denied",
    });
    expect(wrapper.find("[data-testid='av-unavailable-message']").text()).toContain(
      "A/V unavailable",
    );
  });

  it("emits toggle-mic when mic button is clicked and toggles are active", async () => {
    const wrapper = mountControls({
      isMicEnabled: true,
      isCameraEnabled: true,
      connectionStatus: "connected",
      permissionState: "granted",
    });
    await wrapper.find("[data-testid='av-toggle-mic']").trigger("click");
    expect(wrapper.emitted("toggle-mic")).toHaveLength(1);
  });

  it("emits toggle-camera when camera button is clicked and toggles are active", async () => {
    const wrapper = mountControls({
      isMicEnabled: true,
      isCameraEnabled: true,
      connectionStatus: "connected",
      permissionState: "granted",
    });
    await wrapper.find("[data-testid='av-toggle-camera']").trigger("click");
    expect(wrapper.emitted("toggle-camera")).toHaveLength(1);
  });

  it("sets aria-disabled on toggles when disconnected", () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "idle",
      permissionState: "granted",
    });
    expect(wrapper.find("[data-testid='av-toggle-mic']").attributes("aria-disabled")).toBe("true");
    expect(wrapper.find("[data-testid='av-toggle-camera']").attributes("aria-disabled")).toBe(
      "true",
    );
  });

  it("does not emit toggles when disconnected", async () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "connecting",
      permissionState: "granted",
    });
    await wrapper.find("[data-testid='av-toggle-mic']").trigger("click");
    expect(wrapper.emitted("toggle-mic")).toBeUndefined();
  });

  it("does not emit toggles when permission is prompt (use Turn on A/V first)", async () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "connected",
      permissionState: "prompt",
    });
    await wrapper.find("[data-testid='av-toggle-mic']").trigger("click");
    expect(wrapper.emitted("toggle-mic")).toBeUndefined();
  });

  it("shows permission banner when permissionState is unknown and connected", () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "connected",
      permissionState: "unknown",
    });
    expect(wrapper.find("[data-testid='av-permission-banner']").exists()).toBe(true);
  });

  it("does not emit toggles when permission is unknown (use Turn on A/V first)", async () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "connected",
      permissionState: "unknown",
    });
    await wrapper.find("[data-testid='av-toggle-mic']").trigger("click");
    expect(wrapper.emitted("toggle-mic")).toBeUndefined();
  });

  it("emits request-av from banner when permissionState is unknown", async () => {
    const wrapper = mountControls({
      isMicEnabled: false,
      isCameraEnabled: false,
      connectionStatus: "connected",
      permissionState: "unknown",
    });
    await wrapper.find("[data-testid='av-request-button']").trigger("click");
    expect(wrapper.emitted("request-av")).toHaveLength(1);
  });

  it("sets aria-labels on mic and camera toggles when granted", () => {
    const wrapper = mountControls({
      isMicEnabled: true,
      isCameraEnabled: false,
      connectionStatus: "connected",
      permissionState: "granted",
    });
    expect(wrapper.find("[data-testid='av-toggle-mic']").attributes("aria-label")).toBe(
      "Mute microphone",
    );
    expect(wrapper.find("[data-testid='av-toggle-camera']").attributes("aria-label")).toBe(
      "Turn on camera",
    );
  });

  it("applies min tap target classes to toggle buttons", () => {
    const wrapper = mountControls({
      isMicEnabled: true,
      isCameraEnabled: true,
      connectionStatus: "connected",
      permissionState: "granted",
    });
    expect(wrapper.find("[data-testid='av-toggle-mic']").classes()).toContain("min-tap");
  });
});
