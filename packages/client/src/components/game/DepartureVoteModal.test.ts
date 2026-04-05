import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import DepartureVoteModal from "./DepartureVoteModal.vue";

const teleportStub = { template: "<div><slot /></div>" };

describe("DepartureVoteModal", () => {
  it("emits dead_seat when Continue button is clicked", async () => {
    const wrapper = mount(DepartureVoteModal, {
      props: { open: true, targetPlayerName: "Alice", expiresAt: Date.now() + 60_000 },
      global: { stubs: { Teleport: teleportStub } },
    });
    await wrapper.get('[data-testid="departure-vote-dead-seat-btn"]').trigger("click");
    expect(wrapper.emitted("vote")?.[0]).toEqual(["dead_seat"]);
  });

  it("emits end_game when End game button is clicked", async () => {
    const wrapper = mount(DepartureVoteModal, {
      props: { open: true, targetPlayerName: "Alice", expiresAt: Date.now() + 60_000 },
      global: { stubs: { Teleport: teleportStub } },
    });
    await wrapper.get('[data-testid="departure-vote-end-game-btn"]').trigger("click");
    expect(wrapper.emitted("vote")?.[0]).toEqual(["end_game"]);
  });

  it("renders modal root when open", () => {
    const wrapper = mount(DepartureVoteModal, {
      props: { open: true, targetPlayerName: "Bob", expiresAt: Date.now() + 30_000 },
      global: { stubs: { Teleport: teleportStub } },
    });
    expect(wrapper.find('[data-testid="departure-vote-modal"]').exists()).toBe(true);
  });
});
