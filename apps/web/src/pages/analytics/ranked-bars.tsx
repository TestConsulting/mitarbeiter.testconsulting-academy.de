import { numberFormat } from "./kpi-tile.js";

export function RankedBars({ title, keyLabel, valueLabel, rows }: { title: string; keyLabel: string; valueLabel: string; rows: { key: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="analytics-card">
      <h2>{title}</h2>
      <div className="analytics-table-scroll">
        <table aria-label={title}>
          <thead><tr><th>{keyLabel}</th><th>{valueLabel}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="analytics-wrap">{r.key}</td>
                <td className="analytics-bar-cell">
                  <span className="analytics-bar" style={{ width: `${Math.round((r.value / max) * 100)}%` }} aria-hidden="true" />
                  <span className="analytics-num">{numberFormat.format(r.value)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
