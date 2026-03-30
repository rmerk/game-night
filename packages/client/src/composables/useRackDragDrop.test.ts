import { describe, it, expect } from "vitest";

// Vue DnD Kit composables (makeDraggable/makeDroppable) require DnDProvider context
// and real DOM interaction to test meaningfully. Unit testing the composable wrappers
// in isolation with happy-dom would require extensive mocking that wouldn't provide
// meaningful coverage. The drag-drop behavior is verified via:
// 1. The RackShowcase dev page for manual visual verification
// 2. E2E tests (Playwright) when those are added
//
// This file tests the module exports are available.

describe("useRackDragDrop — module exports", () => {
  it("exports useRackTileDraggable", async () => {
    const mod = await import("./useRackDragDrop");
    expect(mod.useRackTileDraggable).toBeDefined();
    expect(typeof mod.useRackTileDraggable).toBe("function");
  });

  it("exports useRackDroppable", async () => {
    const mod = await import("./useRackDragDrop");
    expect(mod.useRackDroppable).toBeDefined();
    expect(typeof mod.useRackDroppable).toBe("function");
  });
});
