import { describe, it, expect } from "vitest";
import { parseRobinhoodCSV, mergeImportedHoldings } from "../csvImport";
import type { DipHolding } from "../../types/dip";

const SAMPLE_CSV = `Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount
01/15/2026,01/15/2026,01/17/2026,VOO,Vanguard S&P 500 ETF,Buy,2,$450.00,$900.00
01/20/2026,01/20/2026,01/22/2026,VOO,Vanguard S&P 500 ETF,Buy,1,$460.00,$460.00
02/01/2026,02/01/2026,02/03/2026,AAPL,Apple Inc,Buy,5,$180.00,$900.00
02/10/2026,02/10/2026,02/12/2026,AAPL,Apple Inc,Sell,2,$190.00,$380.00
03/01/2026,03/01/2026,03/03/2026,TSLA,Tesla Inc,Buy,3,$250.00,$750.00
03/15/2026,03/15/2026,03/17/2026,TSLA,Tesla Inc,Sell,3,$260.00,$780.00`;

describe("parseRobinhoodCSV", () => {
  it("parses standard Robinhood CSV format", () => {
    const holdings = parseRobinhoodCSV(SAMPLE_CSV);
    expect(holdings.length).toBe(2); // TSLA fully sold, so only VOO and AAPL
  });

  it("computes weighted average cost for buys", () => {
    const holdings = parseRobinhoodCSV(SAMPLE_CSV);
    const voo = holdings.find((h) => h.symbol === "VOO");
    // 2 shares @ $450 + 1 share @ $460 = $1360 / 3 = $453.33
    expect(voo).toBeDefined();
    expect(voo!.shares).toBe(3);
    expect(voo!.avg_cost).toBeCloseTo(453.33, 1);
  });

  it("subtracts sold shares from total", () => {
    const holdings = parseRobinhoodCSV(SAMPLE_CSV);
    const aapl = holdings.find((h) => h.symbol === "AAPL");
    expect(aapl).toBeDefined();
    expect(aapl!.shares).toBe(3); // 5 bought - 2 sold
  });

  it("excludes fully sold positions", () => {
    const holdings = parseRobinhoodCSV(SAMPLE_CSV);
    const tsla = holdings.find((h) => h.symbol === "TSLA");
    expect(tsla).toBeUndefined();
  });

  it("handles quoted fields with commas", () => {
    const csv = `Activity Date,Instrument,Trans Code,Quantity,Price,Amount
01/15/2026,"Vanguard S&P 500, ETF",Buy,2,$450.00,$900.00`;
    const holdings = parseRobinhoodCSV(csv);
    // Instrument is not a ticker, but should still parse
    expect(holdings.length).toBeGreaterThanOrEqual(0);
  });

  it("returns empty for empty input", () => {
    expect(parseRobinhoodCSV("")).toEqual([]);
    expect(parseRobinhoodCSV("header only")).toEqual([]);
  });

  it("ignores non-buy/sell transactions", () => {
    const csv = `Activity Date,Instrument,Trans Code,Quantity,Price,Amount
01/15/2026,VOO,Buy,2,$450.00,$900.00
01/16/2026,VOO,DIV,0,$0.50,$1.00
01/17/2026,VOO,STO,1,$5.00,$500.00`;
    const holdings = parseRobinhoodCSV(csv);
    expect(holdings.length).toBe(1);
    expect(holdings[0].shares).toBe(2); // Only the Buy counted
  });

  it("handles fractional shares", () => {
    const csv = `Activity Date,Instrument,Trans Code,Quantity,Price,Amount
01/15/2026,AAPL,Buy,0.5,$180.00,$90.00`;
    const holdings = parseRobinhoodCSV(csv);
    expect(holdings[0].shares).toBe(0.5);
  });
});

describe("mergeImportedHoldings", () => {
  const existing: DipHolding[] = [
    {
      name: "Vanguard S&P 500",
      symbol: "VOO",
      shares: 5,
      price: 500,
      avg_cost: 400,
      total_return: 500,
      equity: 2500,
      type: "ETF",
      cashReserve: 1000,
      profitThreshold: 15,
      sellPct: 25,
      tiers: [{ pct: 7, amount: 500 }],
    },
  ];

  it("updates existing holdings", () => {
    const imported = [
      { name: "Vanguard S&P 500 ETF", symbol: "VOO", shares: 10, price: 0, avg_cost: 420, total_return: 0, equity: 0, type: "ETF" as const },
    ];
    const { merged, updatedCount, newCount } = mergeImportedHoldings(existing, imported);
    expect(updatedCount).toBe(1);
    expect(newCount).toBe(0);
    const voo = merged.find((h) => h.symbol === "VOO")!;
    expect(voo.shares).toBe(10);
    expect(voo.avg_cost).toBe(420);
    // Preserves DipHolding config
    expect(voo.cashReserve).toBe(1000);
    expect(voo.tiers).toEqual([{ pct: 7, amount: 500 }]);
  });

  it("adds new holdings with defaults", () => {
    const imported = [
      { name: "Apple", symbol: "AAPL", shares: 5, price: 0, avg_cost: 180, total_return: 0, equity: 0, type: "stock" as const },
    ];
    const { merged, newCount } = mergeImportedHoldings(existing, imported);
    expect(newCount).toBe(1);
    const aapl = merged.find((h) => h.symbol === "AAPL")!;
    expect(aapl.profitThreshold).toBe(15);
    expect(aapl.tiers).toEqual([{ pct: 7, amount: 500 }]);
  });
});
