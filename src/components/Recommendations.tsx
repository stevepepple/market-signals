import { useState } from "react";
import type { Recommendation } from "../types";

interface RecommendationsProps {
  recommendations: Recommendation[];
}

type Tab = "all" | "bullish" | "bearish";

function DirectionIcon({ direction }: { direction: "bullish" | "bearish" }) {
  if (direction === "bullish") {
    return <span className="text-green-600 dark:text-green-400">{"\u25B2"}</span>;
  }
  return <span className="text-red-600 dark:text-red-400">{"\u25BC"}</span>;
}

export default function Recommendations({
  recommendations,
}: RecommendationsProps) {
  const [tab, setTab] = useState<Tab>("all");

  const bullish = recommendations.filter((r) => r.direction === "bullish");
  const bearish = recommendations.filter((r) => r.direction === "bearish");
  const activeThemes = new Set(
    recommendations.flatMap((r) =>
      r.signal_themes.split(",").map((t) => t.trim())
    )
  );

  const filtered =
    tab === "bullish" ? bullish : tab === "bearish" ? bearish : recommendations;

  const tabClass = (t: Tab) =>
    t === tab
      ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white px-3 py-1.5 rounded text-sm font-medium"
      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-3 py-1.5 rounded text-sm font-medium transition-colors";

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-lg p-3 border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Picks</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {recommendations.length}
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Bullish</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{bullish.length}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Bearish</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{bearish.length}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active Themes</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {activeThemes.size}
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <button className={tabClass("all")} onClick={() => setTab("all")}>
          All Recommendations
        </button>
        <button
          className={tabClass("bullish")}
          onClick={() => setTab("bullish")}
        >
          Bullish
        </button>
        <button
          className={tabClass("bearish")}
          onClick={() => setTab("bearish")}
        >
          Bearish
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
          No recommendations available for this filter.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                <th className="py-2 px-3">Ticker</th>
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Score</th>
                <th className="py-2 px-3">Direction</th>
                <th className="py-2 px-3">Themes</th>
                <th className="py-2 px-3">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.ticker}
                  className="border-b border-gray-100 even:bg-gray-50/50 dark:border-gray-800/50 dark:even:bg-gray-900/50"
                >
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                    {r.ticker}
                  </td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-300">{r.name}</td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{r.type}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-300">
                    {r.score.toFixed(3)}
                  </td>
                  <td className="py-2 px-3">
                    <span className="flex items-center gap-1">
                      <DirectionIcon direction={r.direction} />
                      <span className="text-gray-600 dark:text-gray-300 capitalize">
                        {r.direction}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                    {r.signal_themes}
                  </td>
                  <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{r.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
