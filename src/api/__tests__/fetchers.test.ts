import { describe, it, expect } from "vitest";
import { normalizeKalshiMarket, normalizePolymarketMarket, classifyMarket, isStrongSignal } from "../fetchers";

describe("normalizeKalshiMarket", () => {
  it("converts cents to decimal and builds URL", () => {
    const raw = { ticker: "T1", event_ticker: "E1", title: "Fed rate", subtitle: "", last_price: 75, volume_24h: 5000, open_interest: 100, status: "open", close_time: "" };
    const result = normalizeKalshiMarket(raw);
    expect(result.source).toBe("kalshi");
    expect(result.yes_price).toBe(0.75);
    expect(result.no_price).toBeCloseTo(0.25);
    expect(result.url).toBe("https://kalshi.com/markets/E1");
  });
});

describe("normalizePolymarketMarket", () => {
  it("parses JSON outcomePrices string", () => {
    const raw = { id: "P1", groupItemTitle: "G1", question: "Will BTC hit 100k?", outcomePrices: "[0.65, 0.35]", volume24hr: 10000, liquidityNum: 5000, active: true, endDate: "", slug: "btc-100k" };
    const result = normalizePolymarketMarket(raw);
    expect(result.source).toBe("polymarket");
    expect(result.yes_price).toBe(0.65);
    expect(result.url).toBe("https://polymarket.com/event/btc-100k");
  });
});

describe("classifyMarket", () => {
  it("matches multiple themes", () => {
    const market = { title: "Will the Fed cut interest rates amid recession fears?", subtitle: "" };
    const themes = classifyMarket(market as any);
    expect(themes).toContain("fed_rate");
    expect(themes).toContain("recession");
  });

  it("returns empty for unmatched market", () => {
    const market = { title: "Will it snow tomorrow?", subtitle: "" };
    expect(classifyMarket(market as any)).toEqual([]);
  });
});

describe("isStrongSignal", () => {
  it("detects high conviction yes", () => {
    expect(isStrongSignal({ yes_price: 0.85 } as any)).toBe(true);
  });
  it("detects high conviction no", () => {
    expect(isStrongSignal({ yes_price: 0.15 } as any)).toBe(true);
  });
  it("rejects moderate signal", () => {
    expect(isStrongSignal({ yes_price: 0.65 } as any)).toBe(false);
  });
});
