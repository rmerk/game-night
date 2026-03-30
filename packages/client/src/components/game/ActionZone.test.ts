import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ActionZone from "./ActionZone.vue";

describe("ActionZone", () => {
  it("renders with role='toolbar'", () => {
    const wrapper = mount(ActionZone);
    expect(wrapper.find("[role='toolbar']").exists()).toBe(true);
  });

  it("has aria-label 'Game actions'", () => {
    const wrapper = mount(ActionZone);
    expect(wrapper.find("[role='toolbar']").attributes("aria-label")).toBe("Game actions");
  });

  it("renders slot content centered", () => {
    const wrapper = mount(ActionZone, {
      slots: {
        default: "<button>Pung</button>",
      },
    });
    expect(wrapper.find("button").text()).toBe("Pung");
  });

  it("has fixed height class (h-20)", () => {
    const wrapper = mount(ActionZone);
    const zone = wrapper.find(".action-zone");
    expect(zone.classes()).toContain("h-20");
  });

  it("has min-h-20 for minimum height", () => {
    const wrapper = mount(ActionZone);
    const zone = wrapper.find(".action-zone");
    expect(zone.classes()).toContain("min-h-20");
  });

  it("uses flexbox centering", () => {
    const wrapper = mount(ActionZone);
    const zone = wrapper.find(".action-zone");
    expect(zone.classes()).toContain("flex");
    expect(zone.classes()).toContain("items-center");
    expect(zone.classes()).toContain("justify-center");
  });
});
