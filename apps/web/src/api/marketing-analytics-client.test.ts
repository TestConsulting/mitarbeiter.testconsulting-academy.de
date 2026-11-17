import { describe, expect, it, vi } from "vitest";
import type { MarketingAnalytics } from "@portal/shared";
import example from "../pages/analytics/__fixtures__/analytics.example.json";
import { fetchMarketingAnalytics, syncMarketingAnalytics } from "./marketing-analytics-client.js";

const data = example as MarketingAnalytics;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("fetchMarketingAnalytics", () => {
  it("returns data for a JSON 200", async () => {
    const f = vi.fn().mockResolvedValue(json(data));
    expect(await fetchMarketingAnalytics(7, f)).toEqual({ status: "ok", data });
    expect(f).toHaveBeenCalledWith(
      "/marketing/dashboard/analytics.json?days=7",
      expect.objectContaining({ credentials: "same-origin", redirect: "manual" }),
    );
  });

  it("maps 401 to unauthorized", async () => {
    expect(await fetchMarketingAnalytics(7, vi.fn().mockResolvedValue(json({ error: "Nicht angemeldet" }, 401)))).toEqual({ status: "unauthorized" });
  });

  it("maps an opaque redirect (session lost) to unauthorized", async () => {
    const opaque = { status: 0, type: "opaqueredirect", ok: false, headers: new Headers() } as unknown as Response;
    expect(await fetchMarketingAnalytics(7, vi.fn().mockResolvedValue(opaque))).toEqual({ status: "unauthorized" });
  });

  it("treats HTML, 5xx, 503 JSON and network errors as unavailable", async () => {
    for (const f of [
      vi.fn().mockResolvedValue(new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } })),
      vi.fn().mockResolvedValue(new Response("", { status: 502 })),
      vi.fn().mockResolvedValue(json({ error: "Portal nicht erreichbar" }, 503)),
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    ]) expect(await fetchMarketingAnalytics(7, f)).toEqual({ status: "unavailable" });
  });
});

describe("syncMarketingAnalytics", () => {
  it("posts to the sync route and returns the row count", async () => {
    const f = vi.fn().mockResolvedValue(json({ rows: 12 }));
    expect(await syncMarketingAnalytics(f)).toEqual({ status: "ok", rows: 12 });
    expect(f).toHaveBeenCalledWith(
      "/marketing/dashboard/analytics/sync",
      expect.objectContaining({ method: "POST", credentials: "same-origin", redirect: "manual" }),
    );
  });

  it("passes the sync error message through", async () => {
    const f = vi.fn().mockResolvedValue(json({ error: "GA4 Quota" }, 502));
    expect(await syncMarketingAnalytics(f)).toEqual({ status: "error", message: "GA4 Quota" });
  });

  it("maps 401 and opaque redirects to unauthorized", async () => {
    expect(await syncMarketingAnalytics(vi.fn().mockResolvedValue(json({ error: "Nicht angemeldet" }, 401)))).toEqual({ status: "unauthorized" });
    const opaque = { status: 0, type: "opaqueredirect", ok: false, headers: new Headers() } as unknown as Response;
    expect(await syncMarketingAnalytics(vi.fn().mockResolvedValue(opaque))).toEqual({ status: "unauthorized" });
  });

  it("explains a 403 in German", async () => {
    const f = vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403, headers: { "content-type": "text/plain" } }));
    const result = await syncMarketingAnalytics(f);
    expect(result).toEqual({ status: "error", message: expect.stringContaining("Berechtigung") });
  });

  it("reports network errors and unreadable bodies as error", async () => {
    expect((await syncMarketingAnalytics(vi.fn().mockRejectedValue(new TypeError("x")))).status).toBe("error");
    expect((await syncMarketingAnalytics(vi.fn().mockResolvedValue(new Response("<html>", { status: 500 })))).status).toBe("error");
  });
});
