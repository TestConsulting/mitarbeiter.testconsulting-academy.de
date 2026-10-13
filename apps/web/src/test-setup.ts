import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
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

afterEach(() => cleanup());