import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketingAnalytics } from "@portal/shared";
import fixture from "./__fixtures__/analytics.example.json";
import { AnalyticsPage, formatChange } from "./analytics-page.js";

const client = vi.hoisted(() => ({ fetchMarketingAnalytics: vi.fn(), syncMarketingAnalytics: vi.fn() }));
vi.mock("../../api/marketing-analytics-client.js", () => client);

const base = fixture as MarketingAnalytics;
const live: MarketingAnalytics = { ...base, stub: false, canSync: true };

function renderPage(path = "/areas/analytics?days=7") {
  return render(<MemoryRouter initialEntries={[path]}><AnalyticsPage /></MemoryRouter>);
}

beforeEach(() => {
  client.fetchMarketingAnalytics.mockReset();
  client.syncMarketingAnalytics.mockReset();
  client.fetchMarketingAnalytics.mockResolvedValue({ status: "ok", data: live });
});

describe("formatChange", () => {
  it("formats positive, negative and zero baseline", () => {
    expect(formatChange(112, 100)).toBe("+12 %");
    expect(formatChange(95, 100)).toBe("−5 %");
    expect(formatChange(5, 0)).toBe("–");
    expect(formatChange(0, 0)).toBe("–");
    expect(formatChange(100, 100)).toBe("0 %");
  });
});

describe("AnalyticsPage", () => {
  it("renders KPIs, chart and tables from the fixture", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Analyse" })).toBeInTheDocument();
    const kpis = await screen.findByRole("list", { name: "Kennzahlen" });
    for (const l of ["Nutzer (Summe Tageswerte)", "Sitzungen", "Seitenaufrufe"]) expect(within(kpis).getByText(l)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Sitzungen pro Tag/ })).toBeInTheDocument();
    const posts = screen.getByRole("table", { name: "LinkedIn-Posts" });
    expect(within(posts).getByRole("link", { name: "Flaky Tests kosten Vertrauen" })).toHaveAttribute("href", "https://www.linkedin.com/feed/update/urn:li:share:1");
    expect(screen.getByRole("table", { name: "Nach Säule" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Nach Format" })).toBeInTheDocument();
    expect(client.fetchMarketingAnalytics).toHaveBeenCalledWith(7);
  });

  it("shows a dash instead of a percentage when the previous period is 0", async () => {
    client.fetchMarketingAnalytics.mockResolvedValue({ status: "ok", data: { ...live, previousTotals: { activeUsers: 0, sessions: 0, pageViews: 0 } } });
    renderPage();
    const kpis = await screen.findByRole("list", { name: "Kennzahlen" });
    expect(kpis.textContent).not.toMatch(/Infinity|NaN/);
    expect(within(kpis).getAllByText("–")).toHaveLength(3);
  });

  it("switches range via the URL", async () => {
    renderPage("/areas/analytics");
    expect(client.fetchMarketingAnalytics).toHaveBeenCalledWith(28);
    await userEvent.click(await screen.findByRole("link", { name: "90 Tage" }));
    await waitFor(() => expect(client.fetchMarketingAnalytics).toHaveBeenLastCalledWith(90));
  });

  it("shows stub hint and hides sync in stub mode", async () => {
    client.fetchMarketingAnalytics.mockResolvedValue({ status: "ok", data: { ...live, stub: true } });
    renderPage();
    expect(await screen.findByText(/Beispieldaten/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jetzt synchronisieren" })).not.toBeInTheDocument();
  });

  it("hides sync without canSync, shows it for admins with live data", async () => {
    client.fetchMarketingAnalytics.mockResolvedValue({ status: "ok", data: { ...live, canSync: false } });
    const { unmount } = renderPage();
    await screen.findByRole("list", { name: "Kennzahlen" });
    expect(screen.queryByRole("button", { name: "Jetzt synchronisieren" })).not.toBeInTheDocument();
    unmount();
    client.fetchMarketingAnalytics.mockResolvedValue({ status: "ok", data: live });
    renderPage();
    expect(await screen.findByRole("button", { name: "Jetzt synchronisieren" })).toBeInTheDocument();
  });

  it("shows login hint on 401 without a chart", async () => {
    client.fetchMarketingAnalytics.mockResolvedValue({ status: "unauthorized" });
    renderPage();
    expect(await screen.findByText(/Bitte neu anmelden/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zur Anmeldung" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows outage hint when unavailable", async () => {
    client.fetchMarketingAnalytics.mockResolvedValue({ status: "unavailable" });
    renderPage();
    expect(await screen.findByText("Analyse-Daten derzeit nicht erreichbar")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps data and shows message when sync fails", async () => {
    client.syncMarketingAnalytics.mockResolvedValue({ status: "error", message: "GA4 Quota" });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Jetzt synchronisieren" }));
    expect(await screen.findByText(/GA4 Quota/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Kennzahlen" })).getByText("Sitzungen")).toBeInTheDocument();
    expect(client.fetchMarketingAnalytics).toHaveBeenCalledTimes(1);
  });

  it("reloads data after a successful sync", async () => {
    client.syncMarketingAnalytics.mockResolvedValue({ status: "ok", rows: 5 });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Jetzt synchronisieren" }));
    await waitFor(() => expect(client.fetchMarketingAnalytics).toHaveBeenCalledTimes(2));
  });
});
