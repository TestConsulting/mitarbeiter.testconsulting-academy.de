import { numberFormat } from "./kpi-tile.js";

type Point = { date: string; sessions: number };

const W = 600;
const H = 160;

function dayLabel(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

function path(points: Point[], max: number): string {
  const step = points.length > 1 ? W / (points.length - 1) : 0;
  return points.map((p, i) => `${(i * step).toFixed(1)},${(H - (p.sessions / max) * H).toFixed(1)}`).join(" ");
}

export function SessionsChart({ daily, previousDaily, from, to }: { daily: Point[]; previousDaily: Point[]; from: string; to: string }) {
  const max = Math.max(1, ...daily.map((p) => p.sessions), ...previousDaily.map((p) => p.sessions));
  const step = daily.length > 1 ? W / (daily.length - 1) : 0;
  return (
    <div className="analytics-chart">
      <h2>Sitzungen pro Tag</h2>
      <ul className="analytics-legend" aria-label="Legende">
        <li><span className="analytics-key analytics-key--current" aria-hidden="true" />Zeitraum</li>
        <li><span className="analytics-key analytics-key--previous" aria-hidden="true" />Vorperiode</li>
      </ul>
      <div className="analytics-chart__plot">
        <div className="analytics-chart__y" aria-hidden="true"><span>{numberFormat.format(max)}</span><span>0</span></div>
        <svg viewBox={`0 0 ${W} ${H + 8}`} role="img" aria-label={`Sitzungen pro Tag, ${from} bis ${to}`}>
          <g transform="translate(0 4)">
            {[0, H / 2, H].map((y) => <line key={y} className="analytics-grid" x1="0" x2={W} y1={y} y2={y} />)}
            <polyline className="analytics-line analytics-line--previous" points={path(previousDaily, max)} />
            <polyline className="analytics-line analytics-line--current" points={path(daily, max)} />
            {daily.map((p, i) => (
              <circle key={p.date} className="analytics-dot" cx={i * step} cy={H - (p.sessions / max) * H} r="5">
                <title>{`${dayLabel(p.date)}: ${numberFormat.format(p.sessions)} Sitzungen`}</title>
              </circle>
            ))}
          </g>
        </svg>
      </div>
      <div className="analytics-chart__x" aria-hidden="true">
        <span>{daily.length ? dayLabel(daily[0].date) : ""}</span>
        <span>{daily.length ? dayLabel(daily[daily.length - 1].date) : ""}</span>
      </div>
      <details className="analytics-details">
        <summary>Als Tabelle anzeigen</summary>
        <div className="analytics-table-scroll">
          <table aria-label="Sitzungen pro Tag (Tabelle)">
            <thead><tr><th>Tag</th><th>Sitzungen</th><th>Vorperiode</th></tr></thead>
            <tbody>
              {daily.map((p, i) => (
                <tr key={p.date}><td>{dayLabel(p.date)}</td><td>{numberFormat.format(p.sessions)}</td><td>{previousDaily[i] ? numberFormat.format(previousDaily[i].sessions) : "–"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
