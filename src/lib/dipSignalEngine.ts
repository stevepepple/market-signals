import type { DipHolding, DipSignal, DipTier } from "../types/dip";

/** Price data returned from the API fetch */
export interface PriceData {
  ticker: string;
  currentPrice: number;
  price30dAgo: number;
}

/**
 * Find the deepest triggered tier: the tier with the largest pct value
 * that is still <= abs(pct30d).
 * Tiers must be sorted by pct ascending (shallowest first).
 */
export function findDeepestTriggeredTier(
  tiers: DipTier[],
  pct30d: number
): { tier: DipTier; index: number } | null {
  const absDip = Math.abs(pct30d);
  let result: { tier: DipTier; index: number } | null = null;

  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].pct <= absDip) {
      result = { tier: tiers[i], index: i };
    }
  }
  return result;
}

/**
 * Evaluate a single holding against its price data and return a DipSignal.
 * Follows the signal rules from §4.3:
 *   1. BUY  — deepest tier triggered AND cashReserve >= tier.amount
 *   2. SELL — pctFromCost >= profitThreshold (no dip tier active)
 *   3. WATCH — tier triggered but insufficient cash; OR approaching threshold
 *   4. HOLD — none of the above
 */
export function evaluateSignal(
  holding: DipHolding,
  priceData: PriceData
): DipSignal {
  const { currentPrice, price30dAgo } = priceData;
  const pct30d = ((currentPrice - price30dAgo) / price30dAgo) * 100;
  const pctFromCost = ((currentPrice - holding.avg_cost) / holding.avg_cost) * 100;

  const sortedTiers = [...holding.tiers].sort((a, b) => a.pct - b.pct);
  const tier1 = sortedTiers[0] ?? null;
  const isDipping = pct30d < 0;

  const deepest = isDipping ? findDeepestTriggeredTier(sortedTiers, pct30d) : null;

  // Rule 1: BUY — deepest tier triggered AND enough cash
  if (deepest && holding.cashReserve >= deepest.tier.amount) {
    const tierNum = deepest.index + 1;
    const suggestedShares = (deepest.tier.amount / currentPrice).toFixed(1);
    return {
      ticker: holding.symbol,
      currentPrice,
      price30dAgo,
      pct30d: round2(pct30d),
      pctFromCost: round2(pctFromCost),
      action: "BUY",
      tierLabel: `T${tierNum} ($${deepest.tier.amount.toLocaleString()})`,
      reason: `Down ${Math.abs(round2(pct30d))}% / 30d — Tier ${tierNum} triggered`,
      detail: `→ Deploy $${deepest.tier.amount.toLocaleString()} → ~${suggestedShares} shares at $${currentPrice.toFixed(2)}`,
      suggestedShares,
      name: holding.name,
    };
  }

  // Rule 2: SELL — up past profit threshold with no dip tier active
  if (!deepest && pctFromCost >= holding.profitThreshold) {
    const sharesToSell = Math.floor(holding.shares * (holding.sellPct / 100));
    const proceeds = round2(sharesToSell * currentPrice);
    return {
      ticker: holding.symbol,
      currentPrice,
      price30dAgo,
      pct30d: round2(pct30d),
      pctFromCost: round2(pctFromCost),
      action: "SELL",
      reason: `Up ${round2(pctFromCost)}% from cost — profit threshold (${holding.profitThreshold}%) hit`,
      detail: `→ Sell ${sharesToSell} shares (${holding.sellPct}%) → ~$${proceeds.toLocaleString()}`,
      suggestedShares: String(sharesToSell),
      name: holding.name,
    };
  }

  // Rule 3a: WATCH — tier triggered but insufficient cash
  if (deepest && holding.cashReserve < deepest.tier.amount) {
    const tierNum = deepest.index + 1;
    return {
      ticker: holding.symbol,
      currentPrice,
      price30dAgo,
      pct30d: round2(pct30d),
      pctFromCost: round2(pctFromCost),
      action: "WATCH",
      tierLabel: `T${tierNum}`,
      reason: `Tier ${tierNum} triggered but cash reserve ($${holding.cashReserve.toLocaleString()}) < deploy amount ($${deepest.tier.amount.toLocaleString()})`,
      detail: `Fund cash reserve to act on this dip`,
      name: holding.name,
    };
  }

  // Rule 3b: WATCH — approaching threshold (pct30d <= -(tier1.pct * 0.5))
  if (tier1 && isDipping && Math.abs(pct30d) >= tier1.pct * 0.5) {
    const triggerPrice = round2(price30dAgo * (1 - tier1.pct / 100));
    return {
      ticker: holding.symbol,
      currentPrice,
      price30dAgo,
      pct30d: round2(pct30d),
      pctFromCost: round2(pctFromCost),
      action: "WATCH",
      reason: `Down ${Math.abs(round2(pct30d))}% / 30d — approaching Tier 1 threshold (${tier1.pct}%)`,
      detail: `Tier 1 triggers at $${triggerPrice.toFixed(2)}`,
      name: holding.name,
    };
  }

  // Rule 4: HOLD
  return {
    ticker: holding.symbol,
    currentPrice,
    price30dAgo,
    pct30d: round2(pct30d),
    pctFromCost: round2(pctFromCost),
    action: "HOLD",
    reason: "No action required",
    detail: `30d: ${pct30d >= 0 ? "+" : ""}${round2(pct30d)}% · From cost: ${pctFromCost >= 0 ? "+" : ""}${round2(pctFromCost)}%`,
    name: holding.name,
  };
}

/**
 * Evaluate all holdings against their price data.
 */
export function evaluateAllSignals(
  holdings: DipHolding[],
  priceMap: Map<string, PriceData>
): DipSignal[] {
  return holdings.map((h) => {
    const pd = priceMap.get(h.symbol);
    if (!pd) {
      return {
        ticker: h.symbol,
        currentPrice: h.price,
        price30dAgo: h.price,
        pct30d: 0,
        pctFromCost: 0,
        action: "HOLD" as const,
        reason: "Price data unavailable",
        detail: "Could not fetch price data for this ticker",
        name: h.name,
      };
    }
    return evaluateSignal(h, pd);
  });
}

/**
 * Build the Anthropic API prompt to fetch prices for all tickers.
 */
export function buildPriceFetchPrompt(tickers: string[], todayDate: string): string {
  return `Today is ${todayDate}. For each ticker below, provide the current price and the closing price from 30 calendar days ago. Return ONLY a JSON array, no other text.

Tickers: ${tickers.join(", ")}

Return format:
[{"ticker":"SYMBOL","currentPrice":123.45,"price30dAgo":120.00}]`;
}

/**
 * Parse price data from the Anthropic API response.
 * Tries JSON.parse first, falls back to regex extraction.
 */
export function parsePriceResponse(responseText: string): PriceData[] {
  // Try direct JSON parse
  try {
    const data = JSON.parse(responseText);
    if (Array.isArray(data)) return data;
  } catch {
    // fall through to regex
  }

  // Regex fallback: find JSON array in response
  const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data)) return data;
    } catch {
      // fall through
    }
  }

  return [];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
