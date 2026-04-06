import { useState, useCallback, useEffect } from "react";
import type { DipHolding, DipSignal, TradeLogEntry } from "../types/dip";
import {
  evaluateAllSignals,
  buildPriceFetchPrompt,
  parsePriceResponse,
} from "../lib/dipSignalEngine";
import type { PriceData } from "../lib/dipSignalEngine";
import {
  loadHoldings,
  saveHoldings,
  loadCachedSignals,
  saveCachedSignals,
  clearSignalCache,
  loadTradeLog,
  saveTradeLog,
  addTradeEntry,
  deleteTradeEntry,
  clearTradeLog,
  loadSettings,
  saveSettings,
} from "../lib/dipStorage";
import HoldingCard from "../components/dip/HoldingCard";
import TradeLog from "../components/dip/TradeLog";
import ExportReport from "../components/dip/ExportReport";

type Tab = "holdings" | "log" | "report" | "settings";

const EMPTY_HOLDING: DipHolding = {
  name: "",
  symbol: "",
  shares: 0,
  price: 0,
  avg_cost: 0,
  total_return: 0,
  equity: 0,
  type: "ETF",
  cashReserve: 0,
  profitThreshold: 15,
  sellPct: 25,
  tiers: [{ pct: 7, amount: 500 }],
};

export default function DipWatcher() {
  const [tab, setTab] = useState<Tab>("holdings");
  const [holdings, setHoldings] = useState<DipHolding[]>(() => loadHoldings());
  const [signals, setSignals] = useState<DipSignal[]>(() => loadCachedSignals().signals);
  const [lastChecked, setLastChecked] = useState<string | null>(() => loadCachedSignals().lastChecked);
  const [tradeLog, setTradeLog] = useState<TradeLogEntry[]>(() => loadTradeLog());
  const [email, setEmail] = useState(() => loadSettings().email ?? "");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHolding, setNewHolding] = useState<DipHolding>({ ...EMPTY_HOLDING });
  const [missingTickers, setMissingTickers] = useState<string[]>([]);

  // Persist holdings whenever they change
  useEffect(() => { saveHoldings(holdings); }, [holdings]);

  const signalMap = new Map(signals.map((s) => [s.ticker, s]));

  // --- Holdings management ---
  function handleAddHolding() {
    const cleaned: DipHolding = {
      ...newHolding,
      symbol: newHolding.symbol.toUpperCase().trim(),
      tiers: newHolding.tiers.filter((t) => t.pct > 0 && t.amount > 0).sort((a, b) => a.pct - b.pct),
    };
    if (!cleaned.symbol || cleaned.tiers.length === 0) return;
    if (holdings.some((h) => h.symbol === cleaned.symbol)) return;
    setHoldings([...holdings, cleaned]);
    setNewHolding({ ...EMPTY_HOLDING });
    setShowAddForm(false);
  }

  function handleEditHolding(updated: DipHolding) {
    setHoldings(holdings.map((h) => (h.symbol === updated.symbol ? updated : h)));
  }

  function handleRemoveHolding(symbol: string) {
    setHoldings(holdings.filter((h) => h.symbol !== symbol));
    setSignals(signals.filter((s) => s.ticker !== symbol));
  }

  function handleLogTrade(entry: Omit<TradeLogEntry, "id">) {
    const full: TradeLogEntry = { ...entry, id: Date.now() };
    const updated = addTradeEntry(full);
    setTradeLog(updated);
  }

  function handleDeleteTrade(id: number) {
    const updated = deleteTradeEntry(id);
    setTradeLog(updated);
  }

  // --- Signal check ---
  const checkSignals = useCallback(async () => {
    if (holdings.length === 0) return;
    setChecking(true);
    setError(null);
    setMissingTickers([]);

    const tickers = holdings.map((h) => h.symbol);
    const todayDate = new Date().toISOString().slice(0, 10);
    const prompt = buildPriceFetchPrompt(tickers, todayDate);

    try {
      // Use Anthropic API with web_search tool
      const apiKey = (window as Record<string, unknown>).__ANTHROPIC_API_KEY__ as string | undefined;
      if (!apiKey) {
        setError("Anthropic API key not found. Set window.__ANTHROPIC_API_KEY__ or use the Claude in Chrome extension.");
        setChecking(false);
        return;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API error ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await response.json();

      // Extract text from response content blocks
      let responseText = "";
      for (const block of data.content ?? []) {
        if (block.type === "text") responseText += block.text;
      }

      const priceResults = parsePriceResponse(responseText);
      if (priceResults.length === 0) {
        throw new Error("Could not parse price data from API response. Try again.");
      }

      const priceMap = new Map<string, PriceData>(priceResults.map((p) => [p.ticker, p]));

      // Check for missing tickers
      const missing = tickers.filter((t) => !priceMap.has(t));
      if (missing.length > 0) {
        setMissingTickers(missing);
      }

      const evaluated = evaluateAllSignals(holdings, priceMap);
      setSignals(evaluated);
      saveCachedSignals(evaluated);
      setLastChecked(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signal check failed");
    } finally {
      setChecking(false);
    }
  }, [holdings]);

  // --- Settings ---
  function handleSaveEmail() {
    saveSettings({ email });
  }

  function handleClearCache() {
    clearSignalCache();
    setSignals([]);
    setLastChecked(null);
  }

  function handleClearTradeLog() {
    if (!confirm("Are you sure you want to clear the entire trade log? This cannot be undone.")) return;
    clearTradeLog();
    setTradeLog([]);
  }

  // --- Add holding form tier helpers ---
  function updateNewTier(idx: number, field: "pct" | "amount", value: string) {
    const tiers = [...newHolding.tiers];
    tiers[idx] = { ...tiers[idx], [field]: parseFloat(value) || 0 };
    setNewHolding({ ...newHolding, tiers });
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-t transition-colors ${
      tab === t
        ? "bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 border border-b-0 dark:border-gray-700"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    }`;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">DipWatcher</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dip-buy & profit-take signal engine
            {lastChecked && (
              <> · Checked {new Date(lastChecked).toLocaleString()}</>
            )}
          </p>
        </div>
        <button
          onClick={checkSignals}
          disabled={checking || holdings.length === 0}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {checking ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking...
            </>
          ) : (
            "Check Signals"
          )}
        </button>
      </div>

      {/* Error / warnings */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex justify-between items-start">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" /></svg>
          </button>
        </div>
      )}
      {missingTickers.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Could not fetch prices for: {missingTickers.join(", ")}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b dark:border-gray-700">
        <button onClick={() => setTab("holdings")} className={tabClass("holdings")}>
          Holdings ({holdings.length})
        </button>
        <button onClick={() => setTab("log")} className={tabClass("log")}>
          Trade Log ({tradeLog.length})
        </button>
        <button onClick={() => setTab("report")} className={tabClass("report")}>
          Report
        </button>
        <button onClick={() => setTab("settings")} className={tabClass("settings")}>
          Settings
        </button>
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-b-lg rounded-tr-lg p-4">
        {/* Holdings tab */}
        {tab === "holdings" && (
          <div className="space-y-4">
            {holdings.length === 0 && !showAddForm && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-lg">No holdings configured</p>
                <p className="text-sm mt-1">Add your first holding to start watching for dip-buy signals</p>
              </div>
            )}

            {/* Holding cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {holdings.map((h) => (
                <HoldingCard
                  key={h.symbol}
                  holding={h}
                  signal={signalMap.get(h.symbol)}
                  recentTrades={tradeLog.filter((t) => t.ticker === h.symbol)}
                  onEdit={handleEditHolding}
                  onRemove={handleRemoveHolding}
                  onLogTrade={handleLogTrade}
                />
              ))}
            </div>

            {/* Add holding form */}
            {showAddForm ? (
              <div className="border rounded-lg p-4 dark:border-gray-700 space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add Holding</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <label className="space-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Ticker</span>
                    <input value={newHolding.symbol} onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
                      placeholder="e.g. VOO" className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Name</span>
                    <input value={newHolding.name} onChange={(e) => setNewHolding({ ...newHolding, name: e.target.value })}
                      placeholder="e.g. Vanguard S&P 500" className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Type</span>
                    <select value={newHolding.type} onChange={(e) => setNewHolding({ ...newHolding, type: e.target.value as "ETF" | "stock" })}
                      className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                      <option value="ETF">ETF</option>
                      <option value="stock">Stock</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Shares</span>
                    <input type="number" value={newHolding.shares || ""} onChange={(e) => setNewHolding({ ...newHolding, shares: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Avg Cost ($)</span>
                    <input type="number" step="0.01" value={newHolding.avg_cost || ""} onChange={(e) => setNewHolding({ ...newHolding, avg_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Cash Reserve ($)</span>
                    <input type="number" value={newHolding.cashReserve || ""} onChange={(e) => setNewHolding({ ...newHolding, cashReserve: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Profit Threshold (%)</span>
                    <input type="number" value={newHolding.profitThreshold || ""} onChange={(e) => setNewHolding({ ...newHolding, profitThreshold: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-gray-500 dark:text-gray-400">Sell % on Profit</span>
                    <input type="number" value={newHolding.sellPct || ""} onChange={(e) => setNewHolding({ ...newHolding, sellPct: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </label>
                </div>

                {/* Tiers */}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Buy Tiers</span>
                  {newHolding.tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400 w-6">T{i + 1}</span>
                      <input type="number" placeholder="Dip %" value={tier.pct || ""} onChange={(e) => updateNewTier(i, "pct", e.target.value)}
                        className="w-20 border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                      <span className="text-gray-400">%</span>
                      <input type="number" placeholder="Amount $" value={tier.amount || ""} onChange={(e) => updateNewTier(i, "amount", e.target.value)}
                        className="w-24 border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                      <span className="text-gray-400">$</span>
                      {newHolding.tiers.length > 1 && (
                        <button onClick={() => setNewHolding({ ...newHolding, tiers: newHolding.tiers.filter((_, j) => j !== i) })}
                          className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                      )}
                    </div>
                  ))}
                  {newHolding.tiers.length < 3 && (
                    <button onClick={() => setNewHolding({ ...newHolding, tiers: [...newHolding.tiers, { pct: 0, amount: 0 }] })}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">+ Add tier</button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={handleAddHolding} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    Add Holding
                  </button>
                  <button onClick={() => { setShowAddForm(false); setNewHolding({ ...EMPTY_HOLDING }); }}
                    className="px-3 py-1 text-sm border rounded text-gray-600 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddForm(true)}
                className="w-full py-3 border-2 border-dashed rounded-lg text-gray-500 dark:text-gray-400 dark:border-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-colors">
                + Add Holding
              </button>
            )}
          </div>
        )}

        {/* Trade Log tab */}
        {tab === "log" && (
          <TradeLog entries={tradeLog} onDelete={handleDeleteTrade} />
        )}

        {/* Report tab */}
        {tab === "report" && (
          <ExportReport signals={signals} tradeLog={tradeLog} lastChecked={lastChecked} email={email || undefined} />
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <div className="space-y-6 max-w-md">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (for report header)</label>
              <div className="flex gap-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                  className="flex-1 border rounded px-3 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                <button onClick={handleSaveEmail} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Management</h3>
              <div className="flex gap-3">
                <button onClick={handleClearCache}
                  className="px-3 py-1.5 text-sm border rounded text-gray-600 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Clear Signal Cache
                </button>
                <button onClick={handleClearTradeLog}
                  className="px-3 py-1.5 text-sm border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                  Clear Trade Log
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
