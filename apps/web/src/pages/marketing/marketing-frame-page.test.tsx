import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MarketingFramePage } from "./marketing-frame-page.js";

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="loc">{location.pathname + location.search}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Link to="/areas/marketing/ideas">zu Ideen</Link>
      <Link to="/areas/marketing/reviews">zu Freigaben</Link>
      <Routes>
        <Route path="/areas/marketing/:page" element={<><MarketingFramePage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

function post(frame: HTMLIFrameElement, page: string, extra: Record<string, unknown> = {}) {
  window.dispatchEvent(new MessageEvent("message", {
    origin: window.location.origin,
    source: frame.contentWindow,
    data: { source: "tc-marketing", type: "navigate", page, search: "", ...extra },
  }));
}

describe("MarketingFramePage", () => {
  it("embeds the matching Marketing-AI page", () => {
    renderAt("/areas/marketing/reviews?x=1");
    expect(screen.getByTitle("Marketing – Freigaben")).toHaveAttribute("src", "/marketing/dashboard/reviews?x=1");
  });

  it("follows navigation messages without reloading the frame", async () => {
    renderAt("/areas/marketing/ideas");
    const frame = screen.getByTitle("Marketing – Ideen") as HTMLIFrameElement;
    post(frame, "reviews");
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/areas/marketing/reviews"));
    expect(frame).toHaveAttribute("src", "/marketing/dashboard/ideas");
  });

  it("ignores messages from other origins or windows", async () => {
    renderAt("/areas/marketing/ideas");
    const frame = screen.getByTitle("Marketing – Ideen") as HTMLIFrameElement;
    const msg = { source: "tc-marketing", type: "navigate", page: "reviews", search: "" };
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.example", source: frame.contentWindow, data: msg }));
    window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: window, data: msg }));
    post(frame, "unbekannt");
    post(frame, "reviews", { source: "anderes" });
    post(frame, "reviews", { type: "reload" });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId("loc")).toHaveTextContent("/areas/marketing/ideas");
  });

  it("redirects unknown pages to ideas", () => {
    renderAt("/areas/marketing/foo");
    expect(screen.getByTitle("Marketing – Ideen")).toBeInTheDocument();
  });

  it("changes src when navigating by link", async () => {
    renderAt("/areas/marketing/ideas");
    await userEvent.click(screen.getByRole("link", { name: "zu Freigaben" }));
    expect(screen.getByTitle("Marketing – Freigaben")).toHaveAttribute("src", "/marketing/dashboard/reviews");
  });

  it("changes src on the next real click after a message to the current page", async () => {
    renderAt("/areas/marketing/ideas");
    const frame = screen.getByTitle("Marketing – Ideen") as HTMLIFrameElement;
    post(frame, "ideas");
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.click(screen.getByRole("link", { name: "zu Freigaben" }));
    expect(screen.getByTitle("Marketing – Freigaben")).toHaveAttribute("src", "/marketing/dashboard/reviews");
  });

  it("changes src on a click after a message-driven navigation", async () => {
    renderAt("/areas/marketing/ideas");
    const frame = screen.getByTitle("Marketing – Ideen") as HTMLIFrameElement;
    post(frame, "reviews");
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/areas/marketing/reviews"));
    await userEvent.click(screen.getByRole("link", { name: "zu Ideen" }));
    await userEvent.click(screen.getByRole("link", { name: "zu Freigaben" }));
    expect(screen.getByTitle("Marketing – Freigaben")).toHaveAttribute("src", "/marketing/dashboard/reviews");
  });
});
