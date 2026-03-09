import { useState } from "react";
import type { InsiderTrade } from "../types";

interface InsiderTradesProps {
  trades: InsiderTrade[];
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

export default function InsiderTrades({ trades }: InsiderTradesProps) {
  const [showAll, setShowAll] = useState(false);

  if (trades.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No insider trade data available.</p>;
  }

  const purchases = trades.filter((t) => t.trade_type === "Purchase");
  const sales = trades.filter((t) => t.trade_type === "Sale");
  const displayed = showAll ? trades : trades.slice(0, 20);

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {purchases.length} purchases &middot; {sales.length} sales &middot;{" "}
          {formatValue(trades.reduce((sum, t) => sum + t.value, 0))} total value
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-gray-500 dark:text-gray-400">
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 pr-3 font-medium">Ticker</th>
              <th className="py-2 pr-3 font-medium">Company</th>
              <th className="py-2 pr-3 font-medium">Insider</th>
              <th className="py-2 pr-3 font-medium">Title</th>
              <th className="py-2 pr-3 font-medium text-right">Price</th>
              <th className="py-2 pr-3 font-medium text-right">Value</th>
              <th className="py-2 font-medium">Trade Date</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((t, i) => (
              <tr
                key={`${t.ticker}-${t.insider_name}-${t.trade_date}-${i}`}
                className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              >
                <td className="py-2 pr-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      t.trade_type === "Purchase"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                    }`}
                  >
                    {t.trade_type === "Purchase" ? "BUY" : "SELL"}
                  </span>
                </td>
                <td className="py-2 pr-3 font-semibold text-gray-900 dark:text-gray-100">
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {t.ticker}
                  </a>
                </td>
                <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                  {t.company_name}
                </td>
                <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 max-w-[150px] truncate">
                  {t.insider_name}
                </td>
                <td className="py-2 pr-3 text-gray-500 dark:text-gray-400 text-xs">
                  {t.title}
                </td>
                <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">
                  ${t.price.toFixed(2)}
                </td>
                <td className="py-2 pr-3 text-right font-medium text-gray-900 dark:text-gray-100">
                  {formatValue(t.value)}
                </td>
                <td className="py-2 text-gray-500 dark:text-gray-400">
                  {t.trade_date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trades.length > 20 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {showAll ? "Show less" : `Show all ${trades.length} trades`}
        </button>
      )}

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Source: <a href="http://openinsider.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500 dark:hover:text-gray-400">OpenInsider</a> (SEC Form 4 filings)
      </p>
    </div>
  );
}
