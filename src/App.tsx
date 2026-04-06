import { useState, useEffect, useMemo, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import type { Filters, NormalizedMarket, InsiderTrade } from "./types";
import type { EconomicIndicator, CalendarEvent, SentimentReading, NewsItem } from "./types/economic";
import { SIGNAL_THEMES } from "./lib/config";
import { loadMarketData, isStrongSignal, loadInsiderTrades, loadPortfolioHoldings } from "./api/fetchers";
import { loadEconomicData, loadCalendarData, loadSentimentData, loadNewsData } from "./api/loaders";
import { aggregateThemeSignals, generateRecommendations, buildPortfolioSummary } from "./lib/portfolio";
import Nav from "./components/Nav";
import Sidebar from "./components/Sidebar";
import SummaryMetrics from "./components/SummaryMetrics";
import SignalThemes from "./components/SignalThemes";
import Recommendations from "./components/Recommendations";
import SignalChart from "./components/SignalChart";
import RawDataExplorer from "./components/RawDataExplorer";
import InsiderTrades from "./components/InsiderTrades";
import EconomicPulse from "./components/EconomicPulse";
import SentimentGauge from "./components/SentimentGauge";
import EventsTimeline from "./components/EventsTimeline";
import NewsFeed from "./components/NewsFeed";
import PortfolioPage from "./pages/PortfolioPage";
import ApproachPage from "./pages/ApproachPage";
import DipWatcher from "./pages/DipWatcher";

const DEFAULT_FILTERS: Filters = {
  useKalshi: true,
  usePolymarket: true,
  filterVolume: true,
  signalFilter: "all",
  showEtfs: true,
  showStocks: true,
  selectedTheme: "All",
};

function Dashboard({
  filters,
  setFilters,
  markets,
  insiderTrades,
  loading,
  error,
  lastRefresh,
  handleRefresh,
  dark,
  onToggleDark,
  heldSymbols,
  economicIndicators,
  calendarEvents,
  sentimentReadings,
  newsItems,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  markets: NormalizedMarket[];
  insiderTrades: InsiderTrade[];
  loading: boolean;
  error: string | null;
  lastRefresh: string;
  handleRefresh: () => void;
  dark: boolean;
  onToggleDark: () => void;
  heldSymbols: Set<string>;
  economicIndicators: EconomicIndicator[];
  calendarEvents: CalendarEvent[];
  sentimentReadings: SentimentReading[];
  newsItems: NewsItem[];
}) {
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
    <div className="flex min-h-screen">
      <Sidebar
        filters={filters}
        onFilterChange={setFilters}
        lastRefresh={lastRefresh}
        onRefresh={handleRefresh}
        themeOptions={themeOptions}
        dark={dark}
        onToggleDark={onToggleDark}
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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              <SentimentGauge readings={sentimentReadings} />
              <EconomicPulse indicators={economicIndicators} />
              <EventsTimeline events={calendarEvents} />
            </div>

            <NewsFeed news={newsItems} />

            <hr className="border-gray-200 dark:border-gray-800 my-8" />

            <h2 className="text-2xl font-semibold mb-4">Portfolio Recommendations</h2>
            <Recommendations recommendations={filteredRecommendations} heldSymbols={heldSymbols} />

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

            <hr className="border-gray-200 dark:border-gray-800 my-8" />

            <h2 className="text-2xl font-semibold mb-4">Insider Trades</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Top insider purchases and sales this week from SEC Form 4 filings
            </p>
            <InsiderTrades trades={insiderTrades} />

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

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [markets, setMarkets] = useState<NormalizedMarket[]>([]);
  const [insiderTrades, setInsiderTrades] = useState<InsiderTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState("");
  const [dark, setDark] = useState(false);
  const [heldSymbols, setHeldSymbols] = useState<Set<string>>(new Set());
  const [economicIndicators, setEconomicIndicators] = useState<EconomicIndicator[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [sentimentReadings, setSentimentReadings] = useState<SentimentReading[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

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
      const [data, insider, held, economic, calendar, sentiment, news] = await Promise.all([
        loadMarketData({
          kalshi: filters.useKalshi,
          polymarket: filters.usePolymarket,
          volumeFilter: filters.filterVolume,
        }),
        loadInsiderTrades(),
        loadPortfolioHoldings(),
        loadEconomicData(),
        loadCalendarData(),
        loadSentimentData(),
        loadNewsData(),
      ]);
      setHeldSymbols(held);
      setEconomicIndicators(economic);
      setCalendarEvents(calendar);
      setSentimentReadings(sentiment);
      setNewsItems(news);

      setInsiderTrades(insider);

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

  const handleRefresh = useCallback(() => {
    setMarkets([]);
    loadData();
  }, [loadData]);

  const toggleDark = useCallback(() => setDark((d) => !d), []);

  // Compute recommendations for cross-page use
  const themedMarkets = useMemo(
    () => markets.filter((m) => m.themes.length > 0),
    [markets],
  );

  const themeSignals = useMemo(
    () => aggregateThemeSignals(themedMarkets),
    [themedMarkets],
  );

  const recommendations = useMemo(
    () => generateRecommendations(themeSignals),
    [themeSignals],
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Nav dark={dark} onToggleDark={toggleDark} />
      <div className="pt-14">
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                filters={filters}
                setFilters={setFilters}
                markets={markets}
                insiderTrades={insiderTrades}
                loading={loading}
                error={error}
                lastRefresh={lastRefresh}
                handleRefresh={handleRefresh}
                dark={dark}
                onToggleDark={toggleDark}
                heldSymbols={heldSymbols}
                economicIndicators={economicIndicators}
                calendarEvents={calendarEvents}
                sentimentReadings={sentimentReadings}
                newsItems={newsItems}
              />
            }
          />
          <Route path="/portfolio" element={<div className="max-w-7xl mx-auto p-8"><PortfolioPage recommendations={recommendations} /></div>} />
          <Route path="/approach" element={<div className="max-w-7xl mx-auto p-8"><ApproachPage /></div>} />
          <Route path="/dips" element={<DipWatcher />} />
        </Routes>
      </div>
    </div>
  );
}
