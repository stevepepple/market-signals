import { useState } from "react";
import type { ThemeSignal } from "../types";

interface SignalThemesProps {
  themeSignals: Record<string, ThemeSignal>;
}

const strengthColors: Record<string, string> = {
  strong: "bg-red-500",
  moderate: "bg-yellow-500",
  weak: "bg-green-500",
  none: "bg-gray-500",
};

function ThemeCard({ signal }: { signal: ThemeSignal }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {signal.label}
      </h3>

      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${strengthColors[signal.strength]}`}
        />
        <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
          {signal.strength}
        </span>
      </div>

      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        {Math.round(signal.avg_yes_price * 100)}%
      </p>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {signal.market_count} markets &middot;{" "}
        {signal.total_volume_24h.toLocaleString()} 24h vol
      </p>

      {signal.top_markets.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setOpen(!open)}
            className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
          >
            {open ? "\u25BC" : "\u25B6"} Top markets
          </button>

          {open && (
            <ul className="mt-2 space-y-2">
              {signal.top_markets.slice(0, 3).map((m) => (
                <li
                  key={m.id}
                  className="text-sm border-t border-gray-200 dark:border-gray-800 pt-2"
                >
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {m.title.length > 60
                      ? m.title.slice(0, 60) + "\u2026"
                      : m.title}
                  </a>
                  <p className="text-gray-500 dark:text-gray-400">
                    {m.yes_price != null
                      ? Math.round(m.yes_price * 100) + "%"
                      : "N/A"}{" "}
                    &middot; {m.source} &middot;{" "}
                    {m.volume_24h.toLocaleString()} vol
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function SignalThemes({ themeSignals }: SignalThemesProps) {
  const sorted = Object.values(themeSignals).sort(
    (a, b) => b.magnitude - a.magnitude
  );

  if (sorted.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No theme signals available.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map((s) => (
        <ThemeCard key={s.label} signal={s} />
      ))}
    </div>
  );
}
