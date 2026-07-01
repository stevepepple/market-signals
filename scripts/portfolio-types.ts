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
