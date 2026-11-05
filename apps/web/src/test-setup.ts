import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = MockResizeObserver;
}
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = MockResizeObserver;
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => "blob:question-image-preview");
  URL.revokeObjectURL = vi.fn();
}

afterEach(() => cleanup());