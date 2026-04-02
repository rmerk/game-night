import { expect } from "vite-plus/test";

export function expectHtmlElement(el: unknown): HTMLElement {
  if (!(el instanceof HTMLElement)) {
    expect.fail(`expected HTMLElement, got ${Object.prototype.toString.call(el)}`);
  }
  return el;
}
