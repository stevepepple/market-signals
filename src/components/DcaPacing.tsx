import { useState, useEffect } from "react";
import { loadValuationData } from "../api/loaders";
import type { ValuationIndicator } from "../api/valuation";

const SIGNAL_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  accelerate: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800", label: "Accelerate" },
  steady: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800", label: "Steady DCA" },
  slow: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", label: "Slow / Hedge" },
  pause: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800", label: "Pause" },
};

function RsiBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = value > 70 ? "bg-red-500" : value < 30 ? "bg-green-500" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
        <div className={`${color} rounded-full h-1.5 transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums">{value}</span>
    </div>
  );
}

function PriceVsMa({ value, label }: { value: number; label: string }) {
  const color = value < -5 ? "text-green-600 dark:text-green-400" : value > 8 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400";
  return (
    <span className={`text-xs ${color}`} title={`vs ${label}`}>
      {value > 0 ? "+" : ""}{value}%
    </span>
  );
}

export default function DcaPacing() {
  const [data, setData] = useState<ValuationIndicator[]>([]);

  useEffect(() => {
    loadValuationData().then(setData);
  }, []);

  if (data.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic p-4">
        Valuation data not yet available. Run the data pipeline to populate.
      </div>
    );
  }

  const grouped = {
    accelerate: data.filter((d) => d.dca_signal === "accelerate"),
    steady: data.filter((d) => d.dca_signal === "steady"),
    slow: data.filter((d) => d.dca_signal === "slow"),
    pause: data.filter((d) => d.dca_signal === "pause"),
  };

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {(["accelerate", "steady", "slow", "pause"] as const).map((signal) => {
          const style = SIGNAL_COLORS[signal];
          const count = grouped[signal].length;
          if (count === 0) return null;
          return (
            <span key={signal} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
              {style.label}: {count}
            </span>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <th className="pb-2 font-medium">Sector</th>
              <th className="pb-2 font-medium">ETF</th>
              <th className="pb-2 font-medium text-right">Price</th>
              <th className="pb-2 font-medium text-right">vs 50d</th>
              <th className="pb-2 font-medium text-right">vs 200d</th>
              <th className="pb-2 font-medium text-right">Drawdown</th>
              <th className="pb-2 font-medium">RSI</th>
              <th className="pb-2 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data
              .sort((a, b) => {
                const order = { accelerate: 0, steady: 1, slow: 2, pause: 3 };
                return order[a.dca_signal] - order[b.dca_signal];
              })
              .map((d) => {
                const style = SIGNAL_COLORS[d.dca_signal];
                return (
                  <tr key={d.ticker} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="py-2 text-gray-700 dark:text-gray-300">{d.name}</td>
                    <td className="py-2 font-mono text-xs">{d.ticker}</td>
                    <td className="py-2 text-right tabular-nums">${d.price}</td>
                    <td className="py-2 text-right"><PriceVsMa value={d.price_vs_sma50_pct} label="50-day MA" /></td>
                    <td className="py-2 text-right"><PriceVsMa value={d.price_vs_sma200_pct} label="200-day MA" /></td>
                    <td className="py-2 text-right">
                      <span className={`text-xs ${d.drawdown_from_high < -10 ? "text-green-600 dark:text-green-400 font-medium" : "text-gray-500"}`}>
                        {d.drawdown_from_high}%
                      </span>
                    </td>
                    <td className="py-2"><RsiBar value={d.rsi_14} /></td>
                    <td className="py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Signals based on RSI-14, price vs. 50/200-day moving averages, and drawdown from 52-week high.
        Updated {data[0]?.date ?? "—"}.
      </p>
    </div>
  );
}
