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
    expect(w.text()).toContain("undo accidental discard");
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

  it("shows table talk report form when eligible", () => {
    const w = mount(SocialOverridePanel, {
      props: {
        canRequestTableTalkReport: true,
        tableTalkReportState: null,
        reportTargets: [
          { id: "opp-a", name: "North" },
          { id: "opp-b", name: "West" },
        ],
        myPlayerId: "me",
      },
    });
    expect(w.text()).toContain("Table talk report");
    expect(w.text()).toContain("2 of 3 other players must uphold");
    expect(w.find('[data-testid="social-override-panel"]').exists()).toBe(true);
  });

  it("shows uphold/deny for a table talk voter with majority copy", () => {
    const w = mount(SocialOverridePanel, {
      props: {
        canRequestTableTalkReport: false,
        tableTalkReportState: {
          reporterId: "p0",
          reportedPlayerId: "p1",
          description: "named a tile",
          expiresAt: Date.now() + 5000,
          voterIds: ["p1", "p2", "p3"],
          votes: {},
        },
        myPlayerId: "p2",
      },
    });
    expect(w.text()).toContain("Uphold this table talk report?");
    expect(w.text()).toContain("Uphold");
    expect(w.text()).toContain("Deny");
  });
});
