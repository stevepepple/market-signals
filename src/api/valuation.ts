// src/api/valuation.ts
// Valuation & momentum indicators for DCA pacing decisions.
// Uses Yahoo Finance v8 (free, no API key required).

export interface ValuationIndicator {
  ticker: string;
  name: string;
  theme: string;
  price: number;
  sma_50: number;
  sma_200: number;
  rsi_14: number;
  price_vs_sma50_pct: number;   // % above/below 50-day MA
  price_vs_sma200_pct: number;  // % above/below 200-day MA
  drawdown_from_high: number;   // % below 52-week high
  date: string;
  dca_signal: "accelerate" | "steady" | "slow" | "pause";
}

// Representative ETF per theme — one liquid ETF to gauge each sector
export const THEME_ETFS: Record<string, { ticker: string; name: string }> = {
  broad_market: { ticker: "SPY", name: "S&P 500" },
  tech_ai: { ticker: "QQQ", name: "Nasdaq 100" },
  treasury_bonds: { ticker: "TLT", name: "20+ Year Treasury" },
  crypto: { ticker: "IBIT", name: "iShares Bitcoin Trust" },
  clean_energy: { ticker: "ICLN", name: "Global Clean Energy" },
  real_estate: { ticker: "VNQ", name: "Vanguard Real Estate" },
  healthcare: { ticker: "XLV", name: "Health Care Select" },
  financials: { ticker: "XLF", name: "Financial Select" },
  energy: { ticker: "XLE", name: "Energy Select" },
  consumer: { ticker: "XLY", name: "Consumer Discretionary" },
  defense: { ticker: "ITA", name: "US Aerospace & Defense" },
  commodities: { ticker: "DBC", name: "Invesco DB Commodity" },
  volatility: { ticker: "VIXY", name: "ProShares VIX Short-Term" },
};

interface YahooChartResult {
  timestamp: number[];
  indicators: {
    quote: Array<{
      close: (number | null)[];
      high: (number | null)[];
    }>;
  };
}

function computeSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50; // neutral default
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function classifyDCASignal(
  priceVsSma50: number,
  priceVsSma200: number,
  rsi: number,
  drawdown: number,
): ValuationIndicator["dca_signal"] {
  // Dip detection: significantly below moving averages or large drawdown
  const isBigDip = drawdown < -15 || priceVsSma200 < -10;
  const isModerateDip = drawdown < -8 || priceVsSma50 < -5;
  const isFrothy = rsi > 70 && priceVsSma50 > 8;
  const isExtreme = rsi > 80 && priceVsSma50 > 15;

  if (isExtreme) return "pause";
  if (isFrothy) return "slow";
  if (isBigDip) return "accelerate";
  if (isModerateDip) return "accelerate";
  return "steady";
}

export async function fetchValuationForTicker(
  ticker: string,
  name: string,
  theme: string,
): Promise<ValuationIndicator | null> {
  try {
    // Fetch ~1 year of daily data
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1y&interval=1d`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    const result: YahooChartResult = data.chart?.result?.[0];
    if (!result?.indicators?.quote?.[0]) return null;

    const closes = result.indicators.quote[0].close
      .filter((v): v is number => v !== null);
    const highs = result.indicators.quote[0].high
      .filter((v): v is number => v !== null);

    if (closes.length < 50) return null;

    const currentPrice = closes[closes.length - 1];
    const sma50 = computeSMA(closes, 50);
    const sma200 = computeSMA(closes, 200);
    const rsi14 = computeRSI(closes, 14);
    const high52w = Math.max(...highs);
    const drawdown = ((currentPrice - high52w) / high52w) * 100;

    const priceVsSma50 = ((currentPrice - sma50) / sma50) * 100;
    const priceVsSma200 = ((currentPrice - sma200) / sma200) * 100;

    return {
      ticker,
      name,
      theme,
      price: Math.round(currentPrice * 100) / 100,
      sma_50: Math.round(sma50 * 100) / 100,
      sma_200: Math.round(sma200 * 100) / 100,
      rsi_14: Math.round(rsi14 * 10) / 10,
      price_vs_sma50_pct: Math.round(priceVsSma50 * 10) / 10,
      price_vs_sma200_pct: Math.round(priceVsSma200 * 10) / 10,
      drawdown_from_high: Math.round(drawdown * 10) / 10,
      date: new Date().toISOString().slice(0, 10),
      dca_signal: classifyDCASignal(priceVsSma50, priceVsSma200, rsi14, drawdown),
    };
  } catch {
    return null;
  }
}

export async function fetchAllValuations(): Promise<ValuationIndicator[]> {
  const results: ValuationIndicator[] = [];
  for (const [theme, config] of Object.entries(THEME_ETFS)) {
    const indicator = await fetchValuationForTicker(config.ticker, config.name, theme);
    if (indicator) results.push(indicator);
    // Rate limit courtesy
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
