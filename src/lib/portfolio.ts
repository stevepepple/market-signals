import type { NormalizedMarket, ThemeSignal, Recommendation, PortfolioSummary } from "../types";
import {
  SIGNAL_THEMES,
  THEME_INVESTMENTS,
  STRONG_SIGNAL_THRESHOLD,
  MODERATE_SIGNAL_THRESHOLD,
} from "./config";

export function signalStrength(yesPrice: number | null): [string, number, string] {
  if (yesPrice === null) return ["none", 0, "neutral"];

  const deviation = Math.abs(yesPrice - 0.5);
  const direction = yesPrice > 0.5 ? "yes" : yesPrice < 0.5 ? "no" : "neutral";

  if (yesPrice >= STRONG_SIGNAL_THRESHOLD || yesPrice <= 1 - STRONG_SIGNAL_THRESHOLD) {
    return ["strong", deviation * 2, direction];
  }
  if (yesPrice >= MODERATE_SIGNAL_THRESHOLD || yesPrice <= 1 - MODERATE_SIGNAL_THRESHOLD) {
    return ["moderate", deviation * 2, direction];
  }
  return ["weak", deviation * 2, direction];
}

export function aggregateThemeSignals(markets: NormalizedMarket[]): Record<string, ThemeSignal> {
  const themeData: Record<string, { prices: number[]; volumes: number[]; markets: NormalizedMarket[] }> = {};

  for (const market of markets) {
    for (const theme of market.themes) {
      if (!themeData[theme]) themeData[theme] = { prices: [], volumes: [], markets: [] };
      const price = market.yes_price;
      const vol = market.volume_24h || 1;
      if (price !== null) {
        themeData[theme].prices.push(price);
        themeData[theme].volumes.push(vol);
        themeData[theme].markets.push(market);
      }
    }
  }

  const results: Record<string, ThemeSignal> = {};
  for (const [theme, data] of Object.entries(themeData)) {
    if (!data.prices.length) continue;

    const totalVol = data.volumes.reduce((a, b) => a + b, 0);
    const avgPrice = totalVol > 0
      ? data.prices.reduce((sum, p, i) => sum + p * data.volumes[i], 0) / totalVol
      : data.prices.reduce((a, b) => a + b, 0) / data.prices.length;

    const [strength, magnitude, direction] = signalStrength(avgPrice);
    const sortedMarkets = [...data.markets].sort((a, b) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0));

    results[theme] = {
      label: SIGNAL_THEMES[theme]?.label ?? theme,
      avg_yes_price: Math.round(avgPrice * 10000) / 10000,
      market_count: data.prices.length,
      total_volume_24h: totalVol,
      strength: strength as ThemeSignal["strength"],
      magnitude: Math.round(magnitude * 10000) / 10000,
      direction: direction as ThemeSignal["direction"],
      top_markets: sortedMarkets.slice(0, 5),
    };
  }

  return results;
}

function isScenarioActive(scenarioKey: string, avgPrice: number): boolean {
  const key = scenarioKey.toLowerCase();
  const highProbKeywords = ["likely", "increase", "elevated", "high", "downturn", "bullish", "strong", "growth"];
  const lowProbKeywords = ["unlikely", "decrease", "low"];

  for (const kw of highProbKeywords) {
    if (key.includes(kw)) return avgPrice > 0.5;
  }
  for (const kw of lowProbKeywords) {
    if (key.includes(kw)) return avgPrice < 0.5;
  }
  return avgPrice > 0.5;
}

export function generateRecommendations(themeSignals: Record<string, ThemeSignal>): Recommendation[] {
  const tickerScores: Record<string, {
    name: string;
    type: "ETF" | "stock";
    rawScore: number;
    contributingThemes: string[];
    rationales: string[];
  }> = {};

  for (const [themeKey, signal] of Object.entries(themeSignals)) {
    if (!(themeKey in THEME_INVESTMENTS)) continue;
    if (signal.strength === "weak") continue;

    const avgPrice = signal.avg_yes_price;
    const { magnitude, strength } = signal;

    for (const [scenarioKey, investments] of Object.entries(THEME_INVESTMENTS[themeKey])) {
      if (!isScenarioActive(scenarioKey, avgPrice)) continue;

      for (const inv of investments) {
        const directionFactor = inv.direction === "positive" ? 1.0 : -1.0;
        const score = magnitude * inv.weight * directionFactor;

        if (!tickerScores[inv.ticker]) {
          tickerScores[inv.ticker] = {
            name: inv.name,
            type: inv.type ?? "ETF",
            rawScore: 0,
            contributingThemes: [],
            rationales: [],
          };
        }

        const entry = tickerScores[inv.ticker];
        entry.rawScore += score;
        entry.contributingThemes.push(signal.label);
        entry.rationales.push(`${signal.label}: ${Math.round(avgPrice * 100)}% probability (${strength})`);
      }
    }
  }

  const rows: Recommendation[] = [];
  for (const [ticker, data] of Object.entries(tickerScores)) {
    if (Math.abs(data.rawScore) < 0.05) continue;
    rows.push({
      ticker,
      name: data.name,
      type: data.type,
      score: Math.round(data.rawScore * 1000) / 1000,
      abs_score: Math.round(Math.abs(data.rawScore) * 1000) / 1000,
      direction: data.rawScore > 0 ? "bullish" : "bearish",
      signal_themes: [...new Set(data.contributingThemes)].sort().join(", "),
      rationale: data.rationales.slice(0, 3).join(" | "),
    });
  }

  return rows.sort((a, b) => b.abs_score - a.abs_score);
}

export function buildPortfolioSummary(recommendations: Recommendation[]): PortfolioSummary {
  if (!recommendations.length) {
    return { total_signals: 0, bullish_count: 0, bearish_count: 0, etf_count: 0, stock_count: 0, top_bullish: [], top_bearish: [], all_themes: [] };
  }

  const bullish = recommendations.filter((r) => r.direction === "bullish");
  const bearish = recommendations.filter((r) => r.direction === "bearish");

  const allThemes = new Set<string>();
  for (const r of recommendations) {
    for (const t of r.signal_themes.split(",")) {
      allThemes.add(t.trim());
    }
  }

  return {
    total_signals: recommendations.length,
    bullish_count: bullish.length,
    bearish_count: bearish.length,
    etf_count: recommendations.filter((r) => r.type === "ETF").length,
    stock_count: recommendations.filter((r) => r.type === "stock").length,
    top_bullish: bullish.slice(0, 5),
    top_bearish: bearish.slice(0, 5),
    all_themes: [...allThemes].sort(),
  };
}
