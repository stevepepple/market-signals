import type { Filters } from "../types";

interface SidebarProps {
  filters: Filters;
  onFilterChange: (f: Filters) => void;
  lastRefresh: string;
  onRefresh: () => void;
  themeOptions: string[];
}

export default function Sidebar({
  filters,
  onFilterChange,
  lastRefresh,
  onRefresh,
  themeOptions,
}: SidebarProps) {
  const update = (patch: Partial<Filters>) =>
    onFilterChange({ ...filters, ...patch });

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold text-gray-100 mb-6">
        Market Signals
      </h2>

      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Data Sources
        </h3>
        <label className="flex items-center gap-2 text-gray-300 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.useKalshi}
            onChange={(e) => update({ useKalshi: e.target.checked })}
            className="accent-indigo-500"
          />
          Kalshi
        </label>
        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
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
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          Filters
        </h3>

        <label className="flex items-center gap-2 text-gray-300 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.filterVolume}
            onChange={(e) => update({ filterVolume: e.target.checked })}
            className="accent-indigo-500"
          />
          Filter low volume
        </label>

        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">
            Signal Strength
          </label>
          <select
            value={filters.signalFilter}
            onChange={(e) =>
              update({
                signalFilter: e.target.value as Filters["signalFilter"],
              })
            }
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
          >
            <option value="all">All</option>
            <option value="strong">Strong Only</option>
            <option value="moderate+">Moderate+</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-gray-300 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showEtfs}
            onChange={(e) => update({ showEtfs: e.target.checked })}
            className="accent-indigo-500"
          />
          Show ETFs
        </label>

        <label className="flex items-center gap-2 text-gray-300 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showStocks}
            onChange={(e) => update({ showStocks: e.target.checked })}
            className="accent-indigo-500"
          />
          Show Stocks
        </label>

        <div className="mb-3">
          <label className="block text-sm text-gray-400 mb-1">
            Theme Filter
          </label>
          <select
            value={filters.selectedTheme}
            onChange={(e) => update({ selectedTheme: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
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

      <div className="mt-auto pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 mb-2">
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
