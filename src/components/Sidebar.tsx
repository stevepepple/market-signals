import type { Filters } from "../types";

interface SidebarProps {
  filters: Filters;
  onFilterChange: (f: Filters) => void;
  lastRefresh: string;
  onRefresh: () => void;
  themeOptions: string[];
  dark: boolean;
  onToggleDark: () => void;
}

export default function Sidebar({
  filters,
  onFilterChange,
  lastRefresh,
  onRefresh,
  themeOptions,
  dark,
  onToggleDark,
}: SidebarProps) {
  const update = (patch: Partial<Filters>) =>
    onFilterChange({ ...filters, ...patch });

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-800 flex flex-col p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Market Signals
        </h2>
        <button
          onClick={onToggleDark}
          className="p-1.5 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Data Sources
        </h3>
        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.useKalshi}
            onChange={(e) => update({ useKalshi: e.target.checked })}
            className="accent-indigo-500"
          />
          Kalshi
        </label>
        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.usePolymarket}
            onChange={(e) => update({ usePolymarket: e.target.checked })}
            className="accent-indigo-500"
          />
          Polymarket
        </label>
      </section>

      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Filters
        </h3>

        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.filterVolume}
            onChange={(e) => update({ filterVolume: e.target.checked })}
            className="accent-indigo-500"
          />
          Filter low volume
        </label>

        <div className="mb-3">
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
            Signal Strength
          </label>
          <select
            value={filters.signalFilter}
            onChange={(e) =>
              update({
                signalFilter: e.target.value as Filters["signalFilter"],
              })
            }
            className="w-full bg-gray-50 border border-gray-300 dark:bg-gray-800 dark:border-gray-700 rounded px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="all">All</option>
            <option value="strong">Strong Only</option>
            <option value="moderate+">Moderate+</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showEtfs}
            onChange={(e) => update({ showEtfs: e.target.checked })}
            className="accent-indigo-500"
          />
          Show ETFs
        </label>

        <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showStocks}
            onChange={(e) => update({ showStocks: e.target.checked })}
            className="accent-indigo-500"
          />
          Show Stocks
        </label>

        <div className="mb-3">
          <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
            Theme Filter
          </label>
          <select
            value={filters.selectedTheme}
            onChange={(e) => update({ selectedTheme: e.target.value })}
            className="w-full bg-gray-50 border border-gray-300 dark:bg-gray-800 dark:border-gray-700 rounded px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="">All Themes</option>
            {themeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-800">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          Last refresh: {lastRefresh || "never"}
        </p>
        <button
          onClick={onRefresh}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
        >
          Refresh Data
        </button>
      </div>
    </aside>
  );
}
