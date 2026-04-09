import { describe, it, expect } from "vite-plus/test";
import { flushPromises, mount } from "@vue/test-utils";
import TableTalkReportSection from "./TableTalkReportSection.vue";

describe("TableTalkReportSection", () => {
  it("resets reportedPlayerId when reportTargets changes and previous id is invalid", async () => {
    const w = mount(TableTalkReportSection, {
      props: {
        canRequestTableTalkReport: true,
        tableTalkReportState: null,
        reportTargets: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
        myPlayerId: "me",
      },
    });
    await flushPromises();
    const sel = w.find("select").element as HTMLSelectElement;
    expect(sel.value).toBe("a");

    await w.setProps({
      reportTargets: [
        { id: "c", name: "C" },
        { id: "d", name: "D" },
      ],
    });
    await flushPromises();
    expect((w.find("select").element as HTMLSelectElement).value).toBe("c");
  });

  it("clears reportedPlayerId when reportTargets becomes empty", async () => {
    const w = mount(TableTalkReportSection, {
      props: {
        canRequestTableTalkReport: true,
        tableTalkReportState: null,
        reportTargets: [{ id: "x", name: "X" }],
        myPlayerId: "me",
      },
    });
    await flushPromises();
    expect((w.find("select").element as HTMLSelectElement).value).toBe("x");

    await w.setProps({ reportTargets: [] });
    await flushPromises();
    expect((w.find("select").element as HTMLSelectElement).value).toBe("");
  });

  it("shows the inline section heading when omitHeading is false", async () => {
    const w = mount(TableTalkReportSection, {
      props: {
        canRequestTableTalkReport: true,
        tableTalkReportState: null,
        reportTargets: [{ id: "a", name: "A" }],
        myPlayerId: "me",
        omitHeading: false,
      },
    });
    await flushPromises();
    const heading = w.find("p.mb-2.font-medium");
    expect(heading.exists()).toBe(true);
    expect(heading.text()).toBe("Table talk report");
  });

  it("omits the inline section heading when omitHeading is true", async () => {
    const w = mount(TableTalkReportSection, {
      props: {
        canRequestTableTalkReport: true,
        tableTalkReportState: null,
        reportTargets: [{ id: "a", name: "A" }],
        myPlayerId: "me",
        omitHeading: true,
      },
    });
    await flushPromises();
    expect(w.find("p.mb-2.font-medium").exists()).toBe(false);
  });
});
