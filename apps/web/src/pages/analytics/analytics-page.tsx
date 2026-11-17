import { useCallback, useEffect, useState } from "react";
import { Button } from "@fluentui/react-components";
import { Link, useSearchParams } from "react-router-dom";
import type { MarketingAnalytics } from "@portal/shared";
import { AreaIcon } from "../../app/area-icon.js";
import { fetchMarketingAnalytics, syncMarketingAnalytics } from "../../api/marketing-analytics-client.js";
import { KpiTile, numberFormat } from "./kpi-tile.js";
import { RankedBars } from "./ranked-bars.js";
import { SessionsChart } from "./sessions-chart.js";

export { formatChange } from "./kpi-tile.js";

const RANGES = [7, 28, 90] as const;
type Range = (typeof RANGES)[number];

type LoadState =
  | { status: "loading" }
  | { status: "ok"; data: MarketingAnalytics }
  | { status: "unauthorized" }
  | { status: "unavailable" };

function parseDays(value: string | null): Range {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 28;
}

function formatDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "–";
}

export function AnalyticsPage() {
  const [params] = useSearchParams();
  const days = parseDays(params.get("days"));
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Beim Zeitraumwechsel bleiben die alten Daten stehen, bis die neuen da sind.
    setRefreshing(true);
    void fetchMarketingAnalytics(days).then((result) => {
      if (cancelled) return;
      setState(result);
      setRefreshing(false);
    });
    return () => { cancelled = true; };
  }, [days, reloadKey]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    const result = await syncMarketingAnalytics();
    setSyncing(false);
    if (result.status === "ok") {
      setSyncMessage({ tone: "ok", text: `Synchronisiert (${numberFormat.format(result.rows)} Zeilen).` });
      setReloadKey((k) => k + 1);
    } else if (result.status === "unauthorized") {
      setState({ status: "unauthorized" });
    } else {
      setSyncMessage({ tone: "error", text: `Synchronisierung fehlgeschlagen: ${result.message}` });
    }
  }, []);

  const data = state.status === "ok" ? state.data : null;
  const busy = state.status === "loading" || refreshing || syncing;

  return (
    <div className="page-stack analytics-page" aria-busy={busy}>
      <div className="page-heading">
        <h1><AreaIcon slug="analytics" /> Analyse</h1>
        <nav className="analytics-ranges" aria-label="Zeitraum">
          {RANGES.map((d) => (
            <Link key={d} to={`?days=${d}`} aria-current={d === days ? "true" : undefined} className={d === days ? "analytics-range analytics-range--active" : "analytics-range"}>{d} Tage</Link>
          ))}
        </nav>
      </div>

      {state.status === "loading" && <p className="analytics-note" role="status">Daten werden geladen …</p>}

      {data && (refreshing || syncing) && <p className="analytics-note" role="status">Wird aktualisiert …</p>}

      {state.status === "unauthorized" && (
        <section className="analytics-notice" role="alert">
          <p><strong>Bitte neu anmelden.</strong> Deine Sitzung ist abgelaufen.</p>
          {/* Bewusst kein Router-Link: Der Auth-Kontext hält den Nutzer noch für angemeldet. Erst das Neuladen holt /api/auth/me (401) und zeigt das Formular. */}
          <a href="/login">Zur Anmeldung</a>
        </section>
      )}

      {state.status === "unavailable" && (
        <section className="analytics-notice" role="alert">
          <p><strong>Analyse-Daten derzeit nicht erreichbar</strong></p>
          <p>Bitte versuche es später noch einmal. Der Rest der Academy funktioniert weiter.</p>
        </section>
      )}

      {data && (
        <>
          <section className="analytics-card">
            {data.stub && <p className="analytics-stub"><strong>Beispieldaten:</strong> Kein GA4-Zugang konfiguriert, die Zahlen unten sind nicht echt.</p>}
            <p className="analytics-note">Zeitraum: {data.from} – {data.to}</p>
            <p className="analytics-note">
              Letzter erfolgreicher Sync: {formatDateTime(data.syncStatus?.lastOkAt)}
              {data.syncStatus?.lastError && <> · <strong>Letzter Fehler:</strong> {data.syncStatus.lastError}</>}
            </p>
            <p className="analytics-note">GA4 zählt nur Besuche mit Cookie-Einwilligung, die echten Zahlen liegen höher. Post-Zahlen erfassen nur Klicks auf den Link im Post.</p>
            {data.canSync && !data.stub && (
              <Button appearance="primary" disabled={syncing} onClick={() => void sync()}>Jetzt synchronisieren</Button>
            )}
            {syncMessage && <p className={`analytics-message analytics-message--${syncMessage.tone}`} role={syncMessage.tone === "error" ? "alert" : "status"}>{syncMessage.text}</p>}
          </section>

          <ul className="analytics-kpis" aria-label="Kennzahlen">
            <KpiTile label="Nutzer (Summe Tageswerte)" value={data.totals.activeUsers} previous={data.previousTotals.activeUsers} />
            <KpiTile label="Sitzungen" value={data.totals.sessions} previous={data.previousTotals.sessions} />
            <KpiTile label="Seitenaufrufe" value={data.totals.pageViews} previous={data.previousTotals.pageViews} />
          </ul>

          <section className="analytics-card">
            <SessionsChart daily={data.daily} previousDaily={data.previousDaily} from={data.from} to={data.to} />
          </section>

          <div className="analytics-grid-2">
            <RankedBars title="Kanäle" keyLabel="Kanal" valueLabel="Sitzungen" rows={data.channels.map((c) => ({ key: c.key, value: c.sessions }))} />
            <RankedBars title="Top-Seiten" keyLabel="Seite" valueLabel="Aufrufe" rows={data.pages.map((p) => ({ key: p.key, value: p.pageViews }))} />
          </div>

          <section className="analytics-card">
            <h2>LinkedIn-Posts</h2>
            <div className="analytics-table-scroll">
              <table aria-label="LinkedIn-Posts">
                <thead><tr><th>Post</th><th>Säule</th><th>Format</th><th>Sitzungen</th><th>Nutzer</th></tr></thead>
                <tbody>
                  {data.posts.map((p) => {
                    const label = p.title !== null ? p.title : `unbekannt (${p.campaign})`;
                    return (
                      <tr key={p.campaign}>
                        <td className="analytics-wrap">
                          {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{label}</a> : label}
                          {p.date && <span className="analytics-note"> ({p.date})</span>}
                        </td>
                        <td>{p.pillarLabel ?? "–"}</td>
                        <td>{p.format ?? "–"}</td>
                        <td>{numberFormat.format(p.sessions)}</td>
                        <td>{numberFormat.format(p.activeUsers)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="analytics-grid-2">
            <section className="analytics-card">
              <h2>Nach Säule</h2>
              <div className="analytics-table-scroll">
                <table aria-label="Nach Säule">
                  <thead><tr><th>Säule</th><th>Posts</th><th>Sitzungen</th></tr></thead>
                  <tbody>{data.byPillar.map((g) => <tr key={g.key}><td>{g.label}</td><td>{g.posts}</td><td>{numberFormat.format(g.sessions)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
            <section className="analytics-card">
              <h2>Nach Format</h2>
              <div className="analytics-table-scroll">
                <table aria-label="Nach Format">
                  <thead><tr><th>Format</th><th>Posts</th><th>Sitzungen</th></tr></thead>
                  <tbody>{data.byFormat.map((g) => <tr key={g.key}><td>{g.key}</td><td>{g.posts}</td><td>{numberFormat.format(g.sessions)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
