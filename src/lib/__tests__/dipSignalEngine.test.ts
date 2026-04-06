import { describe, it, expect } from "vitest";
import {
  findDeepestTriggeredTier,
  evaluateSignal,
  evaluateAllSignals,
  parsePriceResponse,
  buildPriceFetchPrompt,
} from "../dipSignalEngine";
import type { PriceData } from "../dipSignalEngine";
import type { DipHolding } from "../../types/dip";

function makeHolding(overrides: Partial<DipHolding> = {}): DipHolding {
  return {
    name: "Vanguard S&P 500",
    symbol: "VOO",
    shares: 10,
    price: 400,
    avg_cost: 380,
    total_return: 200,
    equity: 4000,
    type: "ETF",
    cashReserve: 2000,
    profitThreshold: 15,
    sellPct: 25,
    tiers: [
      { pct: 7, amount: 500 },
      { pct: 12, amount: 1000 },
      { pct: 20, amount: 2000 },
    ],
    ...overrides,
  };
}

describe("findDeepestTriggeredTier", () => {
  const tiers = [
    { pct: 7, amount: 500 },
    { pct: 12, amount: 1000 },
    { pct: 20, amount: 2000 },
  ];

  it("returns null when no tier is triggered", () => {
    expect(findDeepestTriggeredTier(tiers, -3)).toBeNull();
  });

  it("returns tier 1 when dip matches exactly", () => {
    const result = findDeepestTriggeredTier(tiers, -7);
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
    expect(result!.tier.pct).toBe(7);
  });

  it("returns tier 1 for a dip between tier 1 and tier 2", () => {
    const result = findDeepestTriggeredTier(tiers, -9);
    expect(result!.index).toBe(0);
  });

  it("returns tier 2 when dip is deep enough", () => {
    const result = findDeepestTriggeredTier(tiers, -15);
    expect(result!.index).toBe(1);
    expect(result!.tier.amount).toBe(1000);
  });

  it("returns tier 3 for a very deep dip", () => {
    const result = findDeepestTriggeredTier(tiers, -25);
    expect(result!.index).toBe(2);
  });

  it("returns null for positive pct30d", () => {
    expect(findDeepestTriggeredTier(tiers, 5)).toBeNull();
  });
});

describe("evaluateSignal", () => {
  it("returns BUY when tier is triggered and cash is sufficient", () => {
    const holding = makeHolding({ cashReserve: 2000 });
    const price: PriceData = { ticker: "VOO", currentPrice: 372, price30dAgo: 400 };
    // pct30d = (372 - 400) / 400 = -7%
    const signal = evaluateSignal(holding, price);
    expect(signal.action).toBe("BUY");
    expect(signal.tierLabel).toContain("T1");
    expect(signal.ticker).toBe("VOO");
  });

  it("returns SELL when profit threshold is hit and no dip tier active", () => {
    const holding = makeHolding({ avg_cost: 300, profitThreshold: 15 });
    const price: PriceData = { ticker: "VOO", currentPrice: 360, price30dAgo: 350 };
    // pctFromCost = (360 - 300) / 300 = 20% > 15%
    const signal = evaluateSignal(holding, price);
    expect(signal.action).toBe("SELL");
    expect(signal.suggestedShares).toBeDefined();
  });

  it("returns WATCH when tier triggered but insufficient cash", () => {
    const holding = makeHolding({ cashReserve: 100 });
    const price: PriceData = { ticker: "VOO", currentPrice: 372, price30dAgo: 400 };
    const signal = evaluateSignal(holding, price);
    expect(signal.action).toBe("WATCH");
    expect(signal.reason).toContain("cash reserve");
  });

  it("returns WATCH when approaching threshold (half of tier 1)", () => {
    const holding = makeHolding({
      tiers: [{ pct: 10, amount: 500 }],
    });
    // pct30d = -5%, which is >= 10 * 0.5 = 5%
    const price: PriceData = { ticker: "VOO", currentPrice: 380, price30dAgo: 400 };
    const signal = evaluateSignal(holding, price);
    expect(signal.action).toBe("WATCH");
    expect(signal.reason).toContain("approaching");
  });

  it("returns HOLD when no conditions are met", () => {
    const holding = makeHolding();
    const price: PriceData = { ticker: "VOO", currentPrice: 402, price30dAgo: 400 };
    const signal = evaluateSignal(holding, price);
    expect(signal.action).toBe("HOLD");
  });

  it("returns BUY with deepest tier when multiple tiers triggered", () => {
    const holding = makeHolding({ cashReserve: 5000 });
    // pct30d = (340 - 400) / 400 = -15% → triggers T1 (7%) and T2 (12%), deepest is T2
    const price: PriceData = { ticker: "VOO", currentPrice: 340, price30dAgo: 400 };
    const signal = evaluateSignal(holding, price);
    expect(signal.action).toBe("BUY");
    expect(signal.tierLabel).toContain("T2");
  });

  it("does not trigger SELL when a dip tier is also active", () => {
    // Even if pctFromCost >= profitThreshold, if pct30d triggers a tier, BUY takes precedence
    const holding = makeHolding({
      avg_cost: 100,
      profitThreshold: 5,
      cashReserve: 5000,
    });
    // pctFromCost = (372 - 100) / 100 = 272% >> 5%
    // pct30d = (372 - 400) / 400 = -7% → triggers T1
    const price: PriceData = { ticker: "VOO", currentPrice: 372, price30dAgo: 400 };
    const signal = evaluateSignal(holding, price);
    expect(signal.action).toBe("BUY");
  });
});

describe("evaluateAllSignals", () => {
  it("handles missing price data gracefully", () => {
    const holdings = [makeHolding()];
    const priceMap = new Map<string, PriceData>();
    const signals = evaluateAllSignals(holdings, priceMap);
    expect(signals).toHaveLength(1);
    expect(signals[0].action).toBe("HOLD");
    expect(signals[0].reason).toContain("unavailable");
  });

  it("evaluates multiple holdings", () => {
    const holdings = [
      makeHolding({ symbol: "VOO" }),
      makeHolding({ symbol: "QQQ", name: "Invesco QQQ" }),
    ];
    const priceMap = new Map<string, PriceData>([
      ["VOO", { ticker: "VOO", currentPrice: 402, price30dAgo: 400 }],
      ["QQQ", { ticker: "QQQ", currentPrice: 350, price30dAgo: 400 }],
    ]);
    const signals = evaluateAllSignals(holdings, priceMap);
    expect(signals).toHaveLength(2);
    expect(signals[0].ticker).toBe("VOO");
    expect(signals[1].ticker).toBe("QQQ");
  });
});

describe("parsePriceResponse", () => {
  it("parses a clean JSON array", () => {
    const json = '[{"ticker":"VOO","currentPrice":400,"price30dAgo":380}]';
    const result = parsePriceResponse(json);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("VOO");
  });

  it("extracts JSON from surrounding text", () => {
    const text = 'Here are the prices:\n[{"ticker":"VOO","currentPrice":400,"price30dAgo":380}]\nThat is all.';
    const result = parsePriceResponse(text);
    expect(result).toHaveLength(1);
  });

  it("returns empty array on invalid input", () => {
    expect(parsePriceResponse("no json here")).toEqual([]);
  });
});

describe("buildPriceFetchPrompt", () => {
  it("includes all tickers and the date", () => {
    const prompt = buildPriceFetchPrompt(["VOO", "QQQ"], "2026-04-06");
    expect(prompt).toContain("VOO");
    expect(prompt).toContain("QQQ");
    expect(prompt).toContain("2026-04-06");
  });
});
