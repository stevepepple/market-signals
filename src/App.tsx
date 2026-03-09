import { useState, useEffect, useMemo, useCallback } from "react";
import type { Filters, NormalizedMarket } from "./types";
import { SIGNAL_THEMES } from "./lib/config";
import { loadMarketData, isStrongSignal } from "./api/fetchers";
import { aggregateThemeSignals, generateRecommendations, buildPortfolioSummary } from "./lib/portfolio";
import Sidebar from "./components/Sidebar";
import SummaryMetrics from "./components/SummaryMetrics";
import SignalThemes from "./components/SignalThemes";
import Recommendations from "./components/Recommendations";
import SignalChart from "./components/SignalChart";
import RawDataExplorer from "./components/RawDataExplorer";

const DEFAULT_FILTERS: Filters = {
  useKalshi: true,
  usePolymarket: true,
  filterVolume: true,
  signalFilter: "all",
  showEtfs: true,
  showStocks: true,
  selectedTheme: "All",
};

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [markets, setMarkets] = useState<NormalizedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const loadData = useCallback(async () => {
    if (!filters.useKalshi && !filters.usePolymarket) {
      setError("Enable at least one data source (Kalshi or Polymarket).");
      setMarkets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await loadMarketData({
        kalshi: filters.useKalshi,
        polymarket: filters.usePolymarket,
        volumeFilter: filters.filterVolume,
      });

      if (data.length > 0) {
        setMarkets(data);
        setLastRefresh(new Date().toLocaleTimeString());
      } else {
        setError("No market data available. Data is refreshed daily via cron.");
        setMarkets([]);
      }
    } catch (e) {
      console.warn("Failed to load market data:", e);
      setError("Failed to load market data.");
      setMarkets([]);
    }

    setLoading(false);
  }, [filters.useKalshi, filters.usePolymarket, filters.filterVolume]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const themedMarkets = useMemo(
    () => markets.filter((m) => m.themes.length > 0),
    [markets],
  );

  const unclassified = useMemo(
    () => markets.filter((m) => m.themes.length === 0),
    [markets],
  );

  const themeSignals = useMemo(
    () => aggregateThemeSignals(themedMarkets),
    [themedMarkets],
  );

  const filteredThemeSignals = useMemo(() => {
    let signals = { ...themeSignals };

    if (filters.selectedTheme && filters.selectedTheme !== "All") {
      const matching: Record<string, typeof signals[string]> = {};
      for (const [key, val] of Object.entries(signals)) {
        if (val.label === filters.selectedTheme) {
          matching[key] = val;
        }
      }
      signals = matching;
    }

    if (filters.signalFilter === "strong") {
      const filtered: Record<string, typeof signals[string]> = {};
      for (const [key, val] of Object.entries(signals)) {
        if (val.strength === "strong") filtered[key] = val;
      }
      signals = filtered;
    } else if (filters.signalFilter === "moderate+") {
      const filtered: Record<string, typeof signals[string]> = {};
      for (const [key, val] of Object.entries(signals)) {
        if (val.strength === "strong" || val.strength === "moderate") filtered[key] = val;
      }
      signals = filtered;
    }

    return signals;
  }, [themeSignals, filters.selectedTheme, filters.signalFilter]);

  const recommendations = useMemo(
    () => generateRecommendations(filteredThemeSignals),
    [filteredThemeSignals],
  );

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((r) => {
      if (!filters.showStocks && r.type === "stock") return false;
      if (!filters.showEtfs && r.type === "ETF") return false;
      return true;
    });
  }, [recommendations, filters.showStocks, filters.showEtfs]);

  const portfolioSummary = useMemo(
    () => buildPortfolioSummary(filteredRecommendations),
    [filteredRecommendations],
  );

  const summaryMetrics = useMemo(() => ({
    totalMarkets: markets.length,
    themedMarkets: themedMarkets.length,
    strongSignals: markets.filter((m) => isStrongSignal(m)).length,
    kalshiCount: markets.filter((m) => m.source === "kalshi").length,
    polymarketCount: markets.filter((m) => m.source === "polymarket").length,
  }), [markets, themedMarkets]);

  const themeOptions = useMemo(
    () => Object.values(SIGNAL_THEMES).map((t) => t.label).sort(),
    [],
  );

  const handleRefresh = useCallback(() => {
    setMarkets([]);
    loadData();
  }, [loadData]);

  const handleDownloadCsv = useCallback(() => {
    if (filteredRecommendations.length === 0) return;
    const header = "Ticker,Name,Type,Score,Direction,Themes,Rationale";
    const rows = filteredRecommendations.map(
      (r) =>
        `${r.ticker},"${r.name}",${r.type},${r.score},${r.direction},"${r.signal_themes}","${r.rationale}"`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `market-signals-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRecommendations]);

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Sidebar
        filters={filters}
        onFilterChange={setFilters}
        lastRefresh={lastRefresh}
        onRefresh={handleRefresh}
        themeOptions={themeOptions}
        dark={dark}
        onToggleDark={() => setDark(!dark)}
      />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-1">
            Market Signals Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Prediction market signals mapped to ETF &amp; stock recommendations
          </p>
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
            Data refreshed daily via cron
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
            <span className="ml-4 text-gray-500 dark:text-gray-400">Loading market data...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300 rounded-lg px-6 py-4">
            {error}
          </div>
        ) : (
          <>
            <SummaryMetrics
              totalMarkets={summaryMetrics.totalMarkets}
              themedMarkets={summaryMetrics.themedMarkets}
              strongSignals={summaryMetrics.strongSignals}
              kalshiCount={summaryMetrics.kalshiCount}
              polymarketCount={summaryMetrics.polymarketCount}
            />

            <hr className="border-gray-200 dark:border-gray-800 my-8" />

            <h2 className="text-2xl font-semibold mb-4">Signal Themes</h2>
            <SignalThemes themeSignals={filteredThemeSignals} />

            <hr className="border-gray-200 dark:border-gray-800 my-8" />

            <h2 className="text-2xl font-semibold mb-4">Portfolio Recommendations</h2>
            <Recommendations recommendations={filteredRecommendations} />

            <button
              onClick={handleDownloadCsv}
              disabled={filteredRecommendations.length === 0}
              className="mt-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-200 text-sm font-medium py-2 px-4 rounded transition-colors"
            >
              Download CSV
            </button>

            <hr className="border-gray-200 dark:border-gray-800 my-8" />

            <h2 className="text-2xl font-semibold mb-4">Signal Strength by Theme</h2>
            <SignalChart themeSignals={filteredThemeSignals} dark={dark} />

            <div className="mt-8">
              <RawDataExplorer
                markets={markets}
                themedCount={themedMarkets.length}
                unclassifiedCount={unclassified.length}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
