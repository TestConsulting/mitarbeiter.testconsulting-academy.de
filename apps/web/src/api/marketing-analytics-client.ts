import type { MarketingAnalytics } from "@portal/shared";

export type AnalyticsResult =
  | { status: "ok"; data: MarketingAnalytics }
  | { status: "unauthorized" }
  | { status: "unavailable" };

export type AnalyticsSyncResult =
  | { status: "ok"; rows: number }
  | { status: "error"; message: string }
  | { status: "unauthorized" };

const BASE = "/marketing/dashboard/analytics";

// Ein unerwarteter Redirect (opaqueredirect, Status 0) bedeutet in der Praxis: Session verloren.
function isUnauthorized(response: Response): boolean {
  return response.status === 401 || response.type === "opaqueredirect" || response.status === 0;
}

function isJson(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("application/json");
}

export async function fetchMarketingAnalytics(
  days: 7 | 28 | 90,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalyticsResult> {
  try {
    const response = await fetchImpl(`${BASE}.json?days=${days}`, { credentials: "same-origin", redirect: "manual" });
    if (isUnauthorized(response)) return { status: "unauthorized" };
    if (!response.ok || !isJson(response)) return { status: "unavailable" };
    return { status: "ok", data: (await response.json()) as MarketingAnalytics };
  } catch {
    return { status: "unavailable" };
  }
}

export async function syncMarketingAnalytics(fetchImpl: typeof fetch = fetch): Promise<AnalyticsSyncResult> {
  try {
    const response = await fetchImpl(`${BASE}/sync`, { method: "POST", credentials: "same-origin", redirect: "manual" });
    if (isUnauthorized(response)) return { status: "unauthorized" };
    if (response.status === 403) {
      return { status: "error", message: "Dafür fehlt die Berechtigung. Nur Administratoren dürfen synchronisieren." };
    }
    if (!isJson(response)) return { status: "error", message: "Synchronisierung fehlgeschlagen." };
    const body = (await response.json()) as { rows?: unknown; error?: unknown };
    if (response.ok && typeof body.rows === "number") return { status: "ok", rows: body.rows };
    return { status: "error", message: typeof body.error === "string" ? body.error : "Synchronisierung fehlgeschlagen." };
  } catch {
    return { status: "error", message: "Synchronisierung fehlgeschlagen." };
  }
}
