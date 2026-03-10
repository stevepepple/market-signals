import type { EconomicIndicator } from "../types/economic";

function TrendArrow({ changePct }: { changePct: number }) {
  if (Math.abs(changePct) < 0.5) return <span className="text-gray-400">&mdash;</span>;
  return changePct > 0
    ? <span className="text-red-500" title={`+${changePct}%`}>{"\u25B2"}</span>
    : <span className="text-green-500" title={`${changePct}%`}>{"\u25BC"}</span>;
}

export default function EconomicPulse({ indicators }: { indicators: EconomicIndicator[] }) {
  if (indicators.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Economic Pulse</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-4">
        {indicators
          .filter((i) => i.theme !== "_sentiment")
          .map((ind) => (
            <div key={ind.series_id} className="flex items-center justify-between gap-1 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <span className="truncate text-gray-600 dark:text-gray-400" title={ind.label}>
                {ind.label}
              </span>
              <span className="flex items-center gap-1 font-mono text-gray-900 dark:text-gray-100">
                {typeof ind.value === "number" ? ind.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ind.value}
                <TrendArrow changePct={ind.change_pct} />
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
