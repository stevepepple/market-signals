export interface NormalizedMarket {
  source: "kalshi" | "polymarket";
  id: string;
  event_id: string;
  title: string;
  subtitle: string;
  yes_price: number | null;
  no_price: number | null;
  volume_24h: number;
  open_interest: number;
  status: string;
  close_time: string;
  url: string;
  themes: string[];
}

export interface ThemeConfig {
  label: string;
  keywords: string[];
  kalshi_series: string[];
}

export interface Investment {
  ticker: string;
  name: string;
  direction: "positive" | "negative";
  weight: number;
  type?: "ETF" | "stock";
}

export interface ThemeSignal {
  label: string;
  avg_yes_price: number;
  market_count: number;
  total_volume_24h: number;
  strength: "strong" | "moderate" | "weak" | "none";
  magnitude: number;
  direction: "yes" | "no" | "neutral";
  top_markets: NormalizedMarket[];
}

export interface Recommendation {
  ticker: string;
  name: string;
  type: "ETF" | "stock";
  score: number;
  abs_score: number;
  direction: "bullish" | "bearish";
  signal_themes: string;
  rationale: string;
}

export interface PortfolioSummary {
  total_signals: number;
  bullish_count: number;
  bearish_count: number;
  etf_count: number;
  stock_count: number;
  top_bullish: Recommendation[];
  top_bearish: Recommendation[];
  all_themes: string[];
}

export interface InsiderTrade {
  filing_date: string;
  trade_date: string;
  ticker: string;
  company_name: string;
  insider_name: string;
  title: string;
  trade_type: "Purchase" | "Sale";
  price: number;
  qty: number;
  value: number;
  url: string;
}

export interface Filters {
  useKalshi: boolean;
  usePolymarket: boolean;
  filterVolume: boolean;
  signalFilter: "all" | "strong" | "moderate+";
  showEtfs: boolean;
  showStocks: boolean;
  selectedTheme: string;
}

export interface Holding {
  name: string;
  symbol: string;
  shares: number;
  price: number;
  avg_cost: number;
  total_return: number;
  equity: number;
  type: "ETF" | "stock";
}

export interface PortfolioAccount {
  brokerage: string;
  last_updated: string;
  holdings: Holding[];
}

export interface PortfolioData {
  accounts: PortfolioAccount[];
}
