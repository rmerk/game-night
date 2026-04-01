import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import BaseToast from "./BaseToast.vue";

function mountBaseToast(
  props: Partial<InstanceType<typeof BaseToast>["$props"]> = {},
  attrs: Record<string, string> = {},
) {
  return mount(BaseToast, {
    props: {
      visible: true,
      ...props,
    },
    attrs,
    global: {
      stubs: {
        Transition: false,
      },
    },
    slots: {
      default: "Invalid Mahjong declaration.",
    },
  });
}

function toastSurface(wrapper: ReturnType<typeof mountBaseToast>) {
  return wrapper.get("[data-testid='inline-toast']");
}

describe("BaseToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an inline status region when visible", () => {
    const wrapper = mountBaseToast({}, { "data-testid": "inline-toast" });
    const surface = toastSurface(wrapper);

    expect(surface.attributes("role")).toBe("status");
    expect(surface.attributes("aria-live")).toBe("polite");
    expect(surface.text()).toContain("Invalid Mahjong declaration.");
  });

  it("does not render when hidden", () => {
    const wrapper = mountBaseToast({ visible: false }, { "data-testid": "inline-toast" });

    expect(wrapper.find("[data-testid='inline-toast']").exists()).toBe(false);
  });

  it("forwards aria and class attributes to the rendered toast surface", () => {
    const wrapper = mountBaseToast(
      {},
      {
        "aria-label": "Invalid hand warning",
        class: "mt-2",
        "data-testid": "inline-toast",
      },
    );

    const surface = toastSurface(wrapper);

    expect(surface.attributes("aria-label")).toBe("Invalid hand warning");
    expect(surface.classes()).toContain("mt-2");
  });

  it("applies the existing error toast surface styling", () => {
    const wrapper = mountBaseToast({}, { "data-testid": "inline-toast" });

    expect(toastSurface(wrapper).classes()).toEqual(
      expect.arrayContaining([
        "rounded-md",
        "border",
        "border-state-error",
        "bg-state-error/10",
        "text-state-error",
        "shadow-tile",
      ]),
    );
  });

  it("emits dismiss after the configured auto-dismiss interval", () => {
    const wrapper = mountBaseToast({ autoDismissMs: 1200 });

    vi.advanceTimersByTime(1200);

    expect(wrapper.emitted("dismiss")).toEqual([[]]);
  });
});
