import { useState, useEffect, useMemo } from "react";
import type { PortfolioData } from "../types";

export default function ApproachPage() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/portfolio.json")
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts) {
          setPortfolio(data as PortfolioData);
        } else {
          setPortfolio({ accounts: [data] } as PortfolioData);
        }
      })
      .catch(() => {});
  }, []);

  const breakdown = useMemo(() => {
    if (!portfolio) return null;
    const h = portfolio.accounts.flatMap((a) => a.holdings);
    const totalEquity = h.reduce((s: number, x) => s + x.equity, 0);

    const categories: Record<string, { tickers: string[]; equity: number }> = {
      "ESG / Sustainable": { tickers: [], equity: 0 },
      "AI / Robotics / Tech": { tickers: [], equity: 0 },
      "Broad Market / Index": { tickers: [], equity: 0 },
      "Dividend / Value": { tickers: [], equity: 0 },
      "Travel / Consumer": { tickers: [], equity: 0 },
      "Cloud / Software": { tickers: [], equity: 0 },
      "Clean Energy": { tickers: [], equity: 0 },
      "Crypto": { tickers: [], equity: 0 },
      "Real Estate": { tickers: [], equity: 0 },
      "Other": { tickers: [], equity: 0 },
    };

    const classify = (sym: string, name: string): string => {
      const n = (name + " " + sym).toLowerCase();
      if (n.includes("esg") || n.includes("sustainable") || sym === "DSI" || sym === "SUSA" || sym === "USSG") return "ESG / Sustainable";
      if (n.includes("robot") || n.includes("ai") || n.includes("ark") || sym === "ROBO" || sym === "BOTZ" || sym === "ARKQ" || sym === "ARKG") return "AI / Robotics / Tech";
      if (sym === "QQQ" || sym === "QQQJ" || sym === "VOO" || sym === "VEA" || sym === "NDAQ" || sym === "FDN") return "Broad Market / Index";
      if (n.includes("dividend") || sym === "VIG" || sym === "DVY" || sym === "MMM") return "Dividend / Value";
      if (n.includes("travel") || n.includes("hotel") || n.includes("leisure") || n.includes("entertainment") || sym === "PEJ" || sym === "BEDZ" || sym === "AWAY" || sym === "EB") return "Travel / Consumer";
      if (n.includes("cloud") || n.includes("software") || n.includes("data") || sym === "IGV" || sym === "WCLD" || sym === "DTCR" || sym === "TRFK" || sym === "DDOG" || sym === "NOW" || sym === "CRM" || sym === "HUBS" || sym === "MSFT" || sym === "SHOP") return "Cloud / Software";
      if (n.includes("clean energy") || n.includes("solar") || n.includes("sustainable energy") || sym === "ICLN" || sym === "SOLR") return "Clean Energy";
      if (n.includes("bitcoin") || n.includes("crypto") || sym === "IBIT") return "Crypto";
      if (n.includes("reit") || n.includes("mortgage") || sym === "VNQ" || sym === "GPMT") return "Real Estate";
      return "Other";
    };

    for (const item of h) {
      const cat = classify(item.symbol, item.name);
      categories[cat].tickers.push(item.symbol);
      categories[cat].equity += item.equity;
    }

    return Object.entries(categories)
      .filter(([, v]) => v.tickers.length > 0)
      .sort((a, b) => b[1].equity - a[1].equity)
      .map(([name, v]) => ({ name, ...v, pct: (v.equity / totalEquity) * 100 }));
  }, [portfolio]);

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Investment Approach</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Strategy, principles, and portfolio construction philosophy
        </p>
      </header>

      {/* Philosophy */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Philosophy</h2>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-4 text-gray-700 dark:text-gray-300">
          <p>
            This portfolio follows a <strong>thematic, signal-driven approach</strong> that combines
            prediction market data with traditional investment analysis. The core idea: prediction markets
            aggregate information efficiently, and shifts in market probabilities can signal upcoming
            sector rotations before they show up in price.
          </p>
          <p>Key principles:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>ESG-forward allocation</strong> — Significant core holdings in ESG-screened ETFs
              (ESGV, USSG, DSI, SUSA) reflecting a values-aligned investment approach
            </li>
            <li>
              <strong>Thematic diversification</strong> — Spread across AI/robotics, clean energy,
              cloud/software, travel, and dividends to capture multiple secular trends
            </li>
            <li>
              <strong>Small positions, broad exposure</strong> — Fractional shares across many names
              rather than concentrated bets, reducing single-stock risk
            </li>
            <li>
              <strong>Signal overlay</strong> — Use prediction market signals to inform timing
              of additions and trims, not as the sole basis for decisions
            </li>
            <li>
              <strong>Long-term horizon</strong> — Core positions are held through volatility;
              signals are used for tactical adjustments at the margin
            </li>
          </ul>
        </div>
      </section>

      {/* Thematic breakdown */}
      {breakdown && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Thematic Breakdown</h2>
          <div className="space-y-3">
            {breakdown.map((cat) => (
              <div key={cat.name} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {cat.pct.toFixed(1)}% &middot; ${cat.equity.toFixed(0)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-2">
                  <div
                    className="bg-indigo-500 rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(cat.pct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {cat.tickers.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How signals work */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">How Market Signals Inform Decisions</h2>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-4 text-gray-700 dark:text-gray-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">Consider Buying</h3>
              <ul className="text-sm space-y-1">
                <li>Strong bullish signal aligns with existing thesis</li>
                <li>Position is below target allocation</li>
                <li>Multiple themes confirm the direction</li>
              </ul>
            </div>
            <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">Hold / Monitor</h3>
              <ul className="text-sm space-y-1">
                <li>Mixed or weak signals</li>
                <li>Position at target allocation</li>
                <li>No clear catalyst from prediction markets</li>
              </ul>
            </div>
            <div className="border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">Consider Selling</h3>
              <ul className="text-sm space-y-1">
                <li>Strong bearish signal against thesis</li>
                <li>Position is significantly overweight</li>
                <li>Large unrealized loss with negative outlook</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mb-10">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
          <strong>Disclaimer:</strong> This is a personal portfolio tracker and educational tool, not financial advice.
          Prediction market signals are experimental and should not be the sole basis for investment decisions.
          Past performance does not guarantee future results.
        </div>
      </section>
    </div>
  );
}
