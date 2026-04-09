import { describe, it, expect } from "vite-plus/test";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import SocialOverridePanel from "./SocialOverridePanel.vue";

const teleportStub = { template: "<div><slot /></div>" };

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

  it("shows open control when table talk eligible; full form appears in modal after click", async () => {
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
      global: { stubs: { Teleport: teleportStub } },
    });
    expect(w.find('[data-testid="social-override-panel"]').exists()).toBe(true);
    expect(w.find('[data-testid="table-talk-report-open"]').exists()).toBe(true);
    expect(w.text()).not.toContain("2 of 3 other players must uphold");

    await w.get('[data-testid="table-talk-report-open"]').trigger("click");
    expect(w.find('[data-testid="table-talk-report-modal"]').exists()).toBe(true);
    expect(w.text()).toContain("2 of 3 other players must uphold");
  });

  it("shows compact limit hint when at report cap (no open button)", () => {
    const w = mount(SocialOverridePanel, {
      props: {
        canRequestTableTalkReport: true,
        tableTalkReportState: null,
        myTableTalkReportsUsed: 2,
        reportTargets: [{ id: "opp-a", name: "North" }],
        myPlayerId: "me",
      },
    });
    expect(w.find('[data-testid="social-override-panel"]').exists()).toBe(true);
    expect(w.find('[data-testid="table-talk-report-open"]').exists()).toBe(false);
    expect(w.text()).toContain("Table talk report limit reached for this game (2 per player).");
  });

  it("shows uphold/deny for a table talk voter with majority copy in overlay", () => {
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
      global: { stubs: { Teleport: teleportStub } },
    });
    expect(w.find('[data-testid="social-override-panel"]').exists()).toBe(false);
    expect(w.find('[data-testid="table-talk-report-modal"]').exists()).toBe(true);
    expect(w.text()).toContain("Uphold this table talk report?");
    expect(w.text()).toContain("Uphold");
    expect(w.text()).toContain("Deny");
  });

  it("exposes dialog semantics on the table talk overlay", async () => {
    const w = mount(SocialOverridePanel, {
      attachTo: document.body,
      props: {
        canRequestTableTalkReport: true,
        tableTalkReportState: null,
        reportTargets: [{ id: "opp-a", name: "North" }],
        myPlayerId: "me",
      },
      global: { stubs: { Teleport: teleportStub } },
    });
    await w.get('[data-testid="table-talk-report-open"]').trigger("click");
    await flushPromises();
    const modal = w.find('[data-testid="table-talk-report-modal"]');
    expect(modal.attributes("role")).toBe("dialog");
    expect(modal.attributes("aria-modal")).toBe("true");
    expect(modal.attributes("aria-labelledby")).toBe("table-talk-report-title");
    w.unmount();
  });

  it("uses a focusable dialog title when the reporter has no focusable controls in the body", async () => {
    const w = mount(SocialOverridePanel, {
      attachTo: document.body,
      props: {
        canRequestTableTalkReport: false,
        tableTalkReportState: {
          reporterId: "me",
          reportedPlayerId: "opp-a",
          description: "named a tile",
          expiresAt: Date.now() + 5000,
          voterIds: ["opp-a", "opp-b", "opp-c"],
          votes: {},
        },
        myPlayerId: "me",
        reportTargets: [{ id: "opp-a", name: "North" }],
      },
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();
    await nextTick();
    await nextTick();
    const title = w.find("#table-talk-report-title");
    expect(title.exists()).toBe(true);
    expect(title.attributes("tabindex")).toBe("-1");
    w.unmount();
  });
});
