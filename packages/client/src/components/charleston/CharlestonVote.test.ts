import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import CharlestonVote from "./CharlestonVote.vue";

describe("CharlestonVote", () => {
  it("emits vote true for Yes", async () => {
    const w = mount(CharlestonVote, {
      props: { myVote: null, votesReceivedCount: 1 },
    });
    await w.find("[data-testid='charleston-vote-yes']").trigger("click");
    expect(w.emitted("vote")?.[0]).toEqual([true]);
  });

  it("emits vote false for No", async () => {
    const w = mount(CharlestonVote, {
      props: { myVote: null, votesReceivedCount: 0 },
    });
    await w.find("[data-testid='charleston-vote-no']").trigger("click");
    expect(w.emitted("vote")?.[0]).toEqual([false]);
  });

  it("disables buttons after vote and shows choice", () => {
    const w = mount(CharlestonVote, {
      props: { myVote: true, votesReceivedCount: 3 },
    });
    expect(w.find("[data-testid='charleston-vote-yes']").attributes("disabled")).toBeDefined();
    expect(w.find("[data-testid='charleston-vote-choice']").text()).toContain("Yes");
    expect(w.find("[data-testid='charleston-vote-count']").text()).toContain("3 of 4 voted");
  });
});
