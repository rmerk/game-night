import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import SocialOverridePanel from "./SocialOverridePanel.vue";

describe("SocialOverridePanel", () => {
  it("shows request form when canRequestSocialOverride and no pending vote", () => {
    const w = mount(SocialOverridePanel, {
      props: {
        canRequestSocialOverride: true,
        socialOverrideState: null,
        myPlayerId: "p1",
      },
    });
    expect(w.find('[data-testid="social-override-panel"]').exists()).toBe(true);
    expect(w.text()).toContain("Request undo");
  });

  it("shows approve/deny for a voter", () => {
    const w = mount(SocialOverridePanel, {
      props: {
        canRequestSocialOverride: false,
        socialOverrideState: {
          requesterId: "p0",
          description: "oops",
          expiresAt: Date.now() + 5000,
          discardedTileId: "bam-1-1",
          votes: {},
        },
        myPlayerId: "p1",
      },
    });
    expect(w.text()).toContain("Approve");
    expect(w.text()).toContain("Deny");
  });
});
