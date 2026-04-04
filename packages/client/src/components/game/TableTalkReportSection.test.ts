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
});
