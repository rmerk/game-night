import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import AvatarFallback from "./AvatarFallback.vue";

describe("AvatarFallback", () => {
  it("renders initial and label", () => {
    const wrapper = mount(AvatarFallback, {
      props: { initial: "A", label: "Avatar for Alice" },
    });
    expect(wrapper.text()).toContain("A");
    expect(wrapper.find('[data-testid="avatar-fallback"]').attributes("aria-label")).toBe(
      "Avatar for Alice",
    );
  });
});
