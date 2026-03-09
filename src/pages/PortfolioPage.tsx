import { useState, useEffect, useMemo } from "react";
import type { Holding, PortfolioData, PortfolioAccount, Recommendation } from "../types";

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPercent(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function returnColor(val: number): string {
  if (val > 0) return "text-green-600 dark:text-green-400";
  if (val < 0) return "text-red-600 dark:text-red-400";
  return "text-gray-500";
}

type SortKey = "equity" | "total_return" | "return_pct" | "symbol" | "name";
type SortDir = "asc" | "desc";

export default function PortfolioPage({ recommendations }: { recommendations: Recommendation[] }) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("equity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeFilter, setTypeFilter] = useState<"all" | "ETF" | "stock">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/portfolio.json")
      .then((r) => r.json())
      .then((data) => {
        // Support both legacy single-account and new multi-account format
        if (data.accounts) {
          setPortfolio(data as PortfolioData);
        } else {
          setPortfolio({ accounts: [data as PortfolioAccount] });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const signalMap = useMemo(() => {
    const map: Record<string, Recommendation> = {};
    for (const r of recommendations) {
      map[r.ticker] = r;
    }
    return map;
  }, [recommendations]);

  const allHoldings = useMemo(() => {
    if (!portfolio) return [];
    if (accountFilter === "all") {
      return portfolio.accounts.flatMap((a) => a.holdings);
    }
    const account = portfolio.accounts.find((a) => a.brokerage === accountFilter);
    return account ? account.holdings : [];
  }, [portfolio, accountFilter]);

  const holdings = useMemo(() => {
    let list = allHoldings;
    if (typeFilter !== "all") list = list.filter((h) => h.type === typeFilter);

    return [...list].sort((a, b) => {
      let av: number | string, bv: number | string;
      switch (sortKey) {
        case "equity": av = a.equity; bv = b.equity; break;
        case "total_return": av = a.total_return; bv = b.total_return; break;
        case "return_pct": av = (a.price - a.avg_cost) / a.avg_cost; bv = (b.price - b.avg_cost) / b.avg_cost; break;
        case "symbol": av = a.symbol; bv = b.symbol; break;
        case "name": av = a.name; bv = b.name; break;
        default: av = a.equity; bv = b.equity;
      }
      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [allHoldings, sortKey, sortDir, typeFilter]);

  const stats = useMemo(() => {
    if (!portfolio) return null;
    const h = allHoldings;
    const totalEquity = h.reduce((s, x) => s + x.equity, 0);
    const totalReturn = h.reduce((s, x) => s + x.total_return, 0);
    const totalCost = h.reduce((s, x) => s + x.avg_cost * x.shares, 0);
    const winners = h.filter((x) => x.total_return > 0).length;
    const losers = h.filter((x) => x.total_return < 0).length;
    const etfEquity = h.filter((x) => x.type === "ETF").reduce((s, x) => s + x.equity, 0);
    const stockEquity = h.filter((x) => x.type === "stock").reduce((s, x) => s + x.equity, 0);
    return { totalEquity, totalReturn, totalCost, winners, losers, etfEquity, stockEquity, count: h.length };
  }, [portfolio, allHoldings]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
        <span className="ml-4 text-gray-500 dark:text-gray-400">Loading portfolio...</span>
      </div>
    );
  }

  if (!portfolio || !stats) {
    return <p className="text-gray-500 py-10">No portfolio data found. Add your holdings to <code>public/data/portfolio.json</code>.</p>;
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">My Portfolio</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {portfolio.accounts.map((a) => a.brokerage).join(" + ")} &middot; {stats.count} holdings
        </p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Equity</p>
          <p className="text-2xl font-bold">{formatCurrency(stats.totalEquity)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Return</p>
          <p className={`text-2xl font-bold ${returnColor(stats.totalReturn)}`}>
            {formatCurrency(stats.totalReturn)}
            <span className="text-base ml-1">({formatPercent(stats.totalReturn / stats.totalCost * 100)})</span>
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Winners / Losers</p>
          <p className="text-2xl font-bold">
            <span className="text-green-600 dark:text-green-400">{stats.winners}</span>
            {" / "}
            <span className="text-red-600 dark:text-red-400">{stats.losers}</span>
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">ETF / Stock Split</p>
          <p className="text-lg font-bold">
            {((stats.etfEquity / stats.totalEquity) * 100).toFixed(0)}% ETF &middot;{" "}
            {((stats.stockEquity / stats.totalEquity) * 100).toFixed(0)}% Stock
          </p>
        </div>
      </div>

      {/* Allocation bar */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Allocation</h2>
        <div className="flex rounded-full overflow-hidden h-4">
          {holdings.slice(0, 15).map((h) => (
            <div
              key={h.symbol}
              className={`${h.total_return >= 0 ? "bg-indigo-500" : "bg-amber-500"} relative group`}
              style={{ width: `${(h.equity / stats.totalEquity) * 100}%`, minWidth: "2px" }}
              title={`${h.symbol}: ${formatCurrency(h.equity)} (${((h.equity / stats.totalEquity) * 100).toFixed(1)}%)`}
            />
          ))}
          {holdings.length > 15 && (
            <div
              className="bg-gray-300 dark:bg-gray-700"
              style={{ width: `${(holdings.slice(15).reduce((s, h) => s + h.equity, 0) / stats.totalEquity) * 100}%` }}
              title="Other holdings"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {holdings.slice(0, 10).map((h) => (
            <span key={h.symbol}>{h.symbol} {((h.equity / stats.totalEquity) * 100).toFixed(1)}%</span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {portfolio.accounts.length > 1 && (
          <div className="flex gap-1">
            <button
              onClick={() => setAccountFilter("all")}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                accountFilter === "all"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              All Accounts
            </button>
            {portfolio.accounts.map((a) => (
              <button
                key={a.brokerage}
                onClick={() => setAccountFilter(a.brokerage)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  accountFilter === a.brokerage
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {a.brokerage}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          {(["all", "ETF", "stock"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                typeFilter === t
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {t === "all" ? "All" : t === "ETF" ? "ETFs" : "Stocks"}
            </button>
          ))}
        </div>
      </div>

      {/* Holdings table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-gray-500 dark:text-gray-400">
              <th className="py-2 pr-4 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort("symbol")}>
                Symbol{sortIndicator("symbol")}
              </th>
              <th className="py-2 pr-4 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort("name")}>
                Name{sortIndicator("name")}
              </th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4 text-right">Shares</th>
              <th className="py-2 pr-4 text-right">Price</th>
              <th className="py-2 pr-4 text-right">Avg Cost</th>
              <th className="py-2 pr-4 text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort("return_pct")}>
                Return %{sortIndicator("return_pct")}
              </th>
              <th className="py-2 pr-4 text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort("total_return")}>
                Return ${sortIndicator("total_return")}
              </th>
              <th className="py-2 pr-4 text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200" onClick={() => toggleSort("equity")}>
                Equity{sortIndicator("equity")}
              </th>
              <th className="py-2 text-center">Signal</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const returnPct = ((h.price - h.avg_cost) / h.avg_cost) * 100;
              const signal = signalMap[h.symbol];
              return (
                <tr key={h.symbol} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2 pr-4 font-mono font-medium">{h.symbol}</td>
                  <td className="py-2 pr-4 max-w-48 truncate">{h.name}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      h.type === "ETF"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    }`}>
                      {h.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">{h.shares}</td>
                  <td className="py-2 pr-4 text-right font-mono">{formatCurrency(h.price)}</td>
                  <td className="py-2 pr-4 text-right font-mono">{formatCurrency(h.avg_cost)}</td>
                  <td className={`py-2 pr-4 text-right font-mono ${returnColor(returnPct)}`}>
                    {formatPercent(returnPct)}
                  </td>
                  <td className={`py-2 pr-4 text-right font-mono ${returnColor(h.total_return)}`}>
                    {formatCurrency(h.total_return)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">{formatCurrency(h.equity)}</td>
                  <td className="py-2 text-center">
                    {signal ? (
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          signal.direction === "bullish"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}
                        title={signal.rationale}
                      >
                        {signal.direction} ({signal.score.toFixed(1)})
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Signal overlay section */}
      {Object.keys(signalMap).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Holdings with Market Signals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {holdings
              .filter((h) => signalMap[h.symbol])
              .map((h) => {
                const signal = signalMap[h.symbol]!;
                const returnPct = ((h.price - h.avg_cost) / h.avg_cost) * 100;
                const alignedWithSignal =
                  (signal.direction === "bullish" && returnPct > 0) ||
                  (signal.direction === "bearish" && returnPct < 0);
                return (
                  <div
                    key={h.symbol}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-mono font-bold">{h.symbol}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">{h.name}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          signal.direction === "bullish"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}
                      >
                        {signal.direction} signal ({signal.score.toFixed(1)})
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{signal.rationale}</p>
                    <div className="flex gap-4 text-sm">
                      <span>Your return: <span className={returnColor(returnPct)}>{formatPercent(returnPct)}</span></span>
                      <span>Themes: {signal.signal_themes}</span>
                    </div>
                    {!alignedWithSignal && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        Signal and current position are misaligned — consider reviewing
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
