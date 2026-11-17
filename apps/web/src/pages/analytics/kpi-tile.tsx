export function formatChange(current: number, previous: number): string {
  if (previous === 0) return "–";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return `+${pct} %`;
  if (pct < 0) return `−${Math.abs(pct)} %`;
  return "0 %";
}

export const numberFormat = new Intl.NumberFormat("de-DE");

export function KpiTile({ label, value, previous }: { label: string; value: number; previous: number }) {
  const change = formatChange(value, previous);
  const tone = change.startsWith("+") ? " analytics-kpi__change--up" : change.startsWith("−") ? " analytics-kpi__change--down" : "";
  return (
    <li className="analytics-kpi">
      <span className="analytics-kpi__label">{label}</span>
      <strong className="analytics-kpi__value">{numberFormat.format(value)}</strong>
      <span className={`analytics-kpi__change${tone}`}>{change} <span className="analytics-kpi__hint">zur Vorperiode</span></span>
    </li>
  );
}
