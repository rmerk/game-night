import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ActivityTicker from "./ActivityTicker.vue";
import { useActivityTickerStore } from "../../stores/activityTicker";

describe("ActivityTicker", () => {
  it("renders joined items and log semantics", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useActivityTickerStore();
    store.pushEvent("a");
    store.pushEvent("b");
    const wrapper = mount(ActivityTicker, {
      global: { plugins: [pinia] },
    });
    const el = wrapper.find('[data-testid="activity-ticker"]');
    expect(el.exists()).toBe(true);
    expect(el.text()).toContain("a → b");
    expect(el.attributes("role")).toBe("log");
    expect(el.attributes("aria-live")).toBe("polite");
    expect(el.attributes("aria-label")).toBe("Recent game activity");
  });

  it("does not render when store is empty", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(ActivityTicker, {
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('[data-testid="activity-ticker"]').exists()).toBe(false);
  });

  it("hides below sm and truncates on larger viewports (AC5)", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useActivityTickerStore().pushEvent("x");
    const wrapper = mount(ActivityTicker, {
      global: { plugins: [pinia] },
    });
    const el = wrapper.find('[data-testid="activity-ticker"]');
    expect(el.classes()).toContain("hidden");
    expect(el.classes()).toContain("sm:block");
    expect(el.classes()).toContain("truncate");
  });
});
