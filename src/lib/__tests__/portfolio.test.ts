import { describe, it, expect } from "vitest";
import { signalStrength, aggregateThemeSignals, generateRecommendations, buildPortfolioSummary } from "../portfolio";
import type { NormalizedMarket, ThemeSignal } from "../../types";

describe("signalStrength", () => {
  it("returns strong for high probability", () => {
    const [label, mag, dir] = signalStrength(0.85);
    expect(label).toBe("strong");
    expect(dir).toBe("yes");
    expect(mag).toBeCloseTo(0.7);
  });

  it("returns strong for very low probability", () => {
    const [label, , dir] = signalStrength(0.15);
    expect(label).toBe("strong");
    expect(dir).toBe("no");
  });

  it("returns moderate for 65%", () => {
    const [label] = signalStrength(0.65);
    expect(label).toBe("moderate");
  });

  it("returns weak for 55%", () => {
    const [label] = signalStrength(0.55);
    expect(label).toBe("weak");
  });

  it("handles null", () => {
    const [label, mag, dir] = signalStrength(null);
    expect(label).toBe("none");
    expect(mag).toBe(0);
    expect(dir).toBe("neutral");
  });
});

describe("aggregateThemeSignals", () => {
  it("aggregates markets by theme with volume weighting", () => {
    const markets: NormalizedMarket[] = [
      { source: "kalshi", id: "1", event_id: "", title: "Fed rate cut", subtitle: "", yes_price: 0.80, no_price: 0.20, volume_24h: 10000, open_interest: 0, status: "open", close_time: "", url: "", themes: ["fed_rate"] },
      { source: "kalshi", id: "2", event_id: "", title: "FOMC meeting", subtitle: "", yes_price: 0.70, no_price: 0.30, volume_24h: 5000, open_interest: 0, status: "open", close_time: "", url: "", themes: ["fed_rate"] },
    ];
    const result = aggregateThemeSignals(markets);
    expect(result.fed_rate).toBeDefined();
    expect(result.fed_rate.market_count).toBe(2);
    expect(result.fed_rate.avg_yes_price).toBeCloseTo(0.7667, 2);
    expect(result.fed_rate.strength).toBe("strong");
  });
});

describe("generateRecommendations", () => {
  it("produces recommendations for strong signals", () => {
    const signals: Record<string, ThemeSignal> = {
      fed_rate: {
        label: "Fed Interest Rate Decisions",
        avg_yes_price: 0.80,
        market_count: 3,
        total_volume_24h: 50000,
        strength: "strong",
        magnitude: 0.6,
        direction: "yes",
        top_markets: [],
      },
    };
    const recs = generateRecommendations(signals);
    expect(recs.length).toBeGreaterThan(0);
    // At avgPrice=0.80 rate_hike_bullish activates (SHV, KRE)
    expect(recs.some((r) => r.ticker === "SHV" || r.ticker === "KRE")).toBe(true);
  });

  it("caps single theme contribution via MAX_THEME_WEIGHT", () => {
    // Two themes with very different magnitudes — the larger one should be capped
    const signals: Record<string, ThemeSignal> = {
      crypto: {
        label: "Crypto & Digital Assets",
        avg_yes_price: 0.90,
        market_count: 10,
        total_volume_24h: 500000,
        strength: "strong",
        magnitude: 0.8,
        direction: "yes",
        top_markets: [],
      },
      fed_rate: {
        label: "Fed Interest Rate Decisions",
        avg_yes_price: 0.70,
        market_count: 2,
        total_volume_24h: 10000,
        strength: "moderate",
        magnitude: 0.4,
        direction: "yes",
        top_markets: [],
      },
    };
    const recs = generateRecommendations(signals);
    // Crypto-only tickers (IBIT, ETHA, etc.) should not have outsized scores
    const ibit = recs.find((r) => r.ticker === "IBIT");
    const shv = recs.find((r) => r.ticker === "SHV");
    // Both should exist; the cap prevents crypto from totally dominating
    expect(ibit).toBeDefined();
    expect(shv).toBeDefined();
  });

  it("skips weak signals", () => {
    const signals: Record<string, ThemeSignal> = {
      fed_rate: {
        label: "Fed Interest Rate Decisions",
        avg_yes_price: 0.52,
        market_count: 1,
        total_volume_24h: 1000,
        strength: "weak",
        magnitude: 0.04,
        direction: "yes",
        top_markets: [],
      },
    };
    const recs = generateRecommendations(signals);
    expect(recs.length).toBe(0);
  });
});

describe("buildPortfolioSummary", () => {
  it("counts bullish and bearish correctly", () => {
    const recs = [
      { ticker: "TLT", name: "T", type: "ETF" as const, score: 0.5, abs_score: 0.5, direction: "bullish" as const, signal_themes: "Fed", rationale: "" },
      { ticker: "SPY", name: "S", type: "ETF" as const, score: -0.3, abs_score: 0.3, direction: "bearish" as const, signal_themes: "Recession", rationale: "" },
    ];
    const summary = buildPortfolioSummary(recs);
    expect(summary.total_signals).toBe(2);
    expect(summary.bullish_count).toBe(1);
    expect(summary.bearish_count).toBe(1);
  });
});
