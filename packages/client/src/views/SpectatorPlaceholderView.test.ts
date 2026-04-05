import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import SpectatorPlaceholderView from "./SpectatorPlaceholderView.vue";

describe("SpectatorPlaceholderView (4B.7 AC9)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders placeholder copy and Back to home button", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: { template: "<div />" } },
        {
          path: "/room/:code/spectate",
          name: "room-spectate",
          component: SpectatorPlaceholderView,
        },
      ],
    });
    await router.push("/room/ABC123/spectate");
    await router.isReady();

    const wrapper = mount(
      { template: "<router-view />" },
      {
        global: { plugins: [pinia, router] },
      },
    );

    expect(wrapper.find('[data-testid="spectator-placeholder"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("coming soon");

    const pushSpy = vi.spyOn(router, "push");
    await wrapper.get('[data-testid="spectator-placeholder-back"]').trigger("click");
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith({ name: "home" });
  });
});
