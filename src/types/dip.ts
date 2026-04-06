import type { Holding } from "../types";

export interface DipTier {
  pct: number;    // dip % trigger over 30 days (e.g. 7 = −7%)
  amount: number; // dollars to deploy when this tier fires
}

export interface DipHolding extends Holding {
  cashReserve: number;      // total cash available for buy signals
  profitThreshold: number;  // sell signal when up X% from avg_cost
  sellPct: number;          // % of shares to sell on profit signal
  tiers: DipTier[];         // 1–3 scaled buy tiers, sorted by pct asc
}

export type SignalAction = "BUY" | "SELL" | "WATCH" | "HOLD";

export interface DipSignal {
  ticker: string;
  currentPrice: number;
  price30dAgo: number;
  pct30d: number;           // (current - 30d) / 30d
  pctFromCost: number;      // (current - avg_cost) / avg_cost
  action: SignalAction;
  tierLabel?: string;       // e.g. 'T2 ($1,000)'
  reason: string;           // human-readable signal explanation
  detail: string;           // actionable detail (shares, dollars)
  suggestedShares?: string; // pre-computed for log pre-fill
  name?: string;            // full fund name
}

export interface TradeLogEntry {
  id: number;               // timestamp-based
  ticker: string;
  action: "BUY" | "SELL";
  date: string;             // ISO date string YYYY-MM-DD
  price: number;
  shares: number;
  amount: number;           // price * shares, rounded
  notes?: string;
}
