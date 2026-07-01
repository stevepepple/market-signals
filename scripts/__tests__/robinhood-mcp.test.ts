import { describe, it, expect } from "vitest";
import {
  parsePositions,
  parseQuotes,
  toHoldings,
  parseSseResponse,
  toolResultToData,
} from "../robinhood-mcp";

describe("parsePositions", () => {
  it("parses a Robinhood-style positions envelope", () => {
    const data = {
      positions: [
        {
          symbol: "AAPL",
          instrument_name: "Apple",
          quantity: "2.5",
          average_buy_price: "150.00",
          last_trade_price: "200.00",
          instrument_type: "stock",
        },
        {
          symbol: "VTI",
          instrument_name: "Vanguard Total Stock Market ETF",
          quantity: 1,
          average_buy_price: 220,
          last_trade_price: 260,
          instrument_type: "etf",
        },
      ],
    };
    const positions = parsePositions(data);
    expect(positions).toHaveLength(2);
    expect(positions[0]).toMatchObject({
      symbol: "AAPL",
      name: "Apple",
      shares: 2.5,
      avgCost: 150,
      price: 200,
      type: "stock",
    });
    expect(positions[1].type).toBe("ETF");
  });

  it("handles bare arrays, alternate field names, and money objects", () => {
    const data = [
      {
        ticker: "MSFT",
        name: "Microsoft",
        shares: 3,
        cost_basis: { amount: "300.00", currency: "USD" }, // total, not per-share
        market_value: { amount: "1500.00", currency: "USD" },
      },
    ];
    const positions = parsePositions(data);
    expect(positions).toHaveLength(1);
    expect(positions[0].avgCost).toBe(100);
    expect(positions[0].equity).toBe(1500);
    expect(positions[0].price).toBeNull();
  });

  it("finds positions nested one level deep and skips bad rows", () => {
    const data = {
      portfolio: {
        equity_positions: [
          { symbol: "NVDA", quantity: 1, last_price: 120 },
          { symbol: "ZERO", quantity: 0, last_price: 10 },
          { quantity: 5, last_price: 10 },
        ],
      },
    };
    const positions = parsePositions(data);
    expect(positions).toHaveLength(1);
    expect(positions[0].symbol).toBe("NVDA");
  });

  it("returns empty for unrecognized payloads", () => {
    expect(parsePositions("not json")).toEqual([]);
    expect(parsePositions(null)).toEqual([]);
    expect(parsePositions({ message: "hi" })).toEqual([]);
  });
});

describe("toHoldings", () => {
  it("computes derived fields and sorts by total return", () => {
    const holdings = toHoldings([
      { symbol: "A", name: "A", shares: 2, avgCost: 10, price: 11, equity: null, type: "stock" },
      { symbol: "B", name: "B", shares: 1, avgCost: 10, price: 40, equity: null, type: "ETF" },
    ]);
    expect(holdings.map((h) => h.symbol)).toEqual(["B", "A"]);
    expect(holdings[0]).toMatchObject({ total_return: 30, equity: 40, avg_cost: 10 });
    expect(holdings[1]).toMatchObject({ total_return: 2, equity: 22 });
  });

  it("fills price from quotes, then from equity, and skips priceless rows", () => {
    const holdings = toHoldings(
      [
        { symbol: "Q", name: "Q", shares: 2, avgCost: 5, price: null, equity: null, type: "stock" },
        { symbol: "E", name: "E", shares: 4, avgCost: 5, price: null, equity: 100, type: "stock" },
        { symbol: "X", name: "X", shares: 1, avgCost: 5, price: null, equity: null, type: "stock" },
      ],
      { Q: 7.5 }
    );
    expect(holdings).toHaveLength(2);
    expect(holdings.find((h) => h.symbol === "Q")).toMatchObject({ price: 7.5, equity: 15 });
    expect(holdings.find((h) => h.symbol === "E")).toMatchObject({ price: 25, equity: 100 });
  });

  it("falls back to price as avg_cost when cost is unknown", () => {
    const [h] = toHoldings([
      { symbol: "A", name: "A", shares: 1, avgCost: null, price: 50, equity: null, type: "stock" },
    ]);
    expect(h.avg_cost).toBe(50);
    expect(h.total_return).toBe(0);
  });
});

describe("parseQuotes", () => {
  it("parses arrays of quote objects", () => {
    const quotes = parseQuotes([
      { symbol: "aapl", last_trade_price: "201.50" },
      { symbol: "VTI", price: 260 },
    ]);
    expect(quotes).toEqual({ AAPL: 201.5, VTI: 260 });
  });

  it("parses flat symbol→price maps", () => {
    expect(parseQuotes({ AAPL: 200, VTI: "260.25" })).toEqual({ AAPL: 200, VTI: 260.25 });
  });
});

describe("parseSseResponse", () => {
  it("extracts the JSON-RPC result matching the request id", () => {
    const body = [
      ": keep-alive",
      "",
      'data: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}',
      "",
      'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}',
      "",
    ].join("\n");
    const msg = parseSseResponse(body, 2);
    expect(msg?.result).toEqual({ ok: true });
    expect(parseSseResponse(body, 99)).toBeNull();
  });
});

describe("toolResultToData", () => {
  it("prefers structuredContent", () => {
    expect(
      toolResultToData({ structuredContent: { a: 1 }, content: [{ type: "text", text: "{}" }] })
    ).toEqual({ a: 1 });
  });

  it("parses JSON from text content blocks", () => {
    expect(toolResultToData({ content: [{ type: "text", text: '{"positions":[]}' }] })).toEqual({
      positions: [],
    });
  });

  it("returns raw text when not JSON", () => {
    expect(toolResultToData({ content: [{ type: "text", text: "plain" }] })).toBe("plain");
  });
});
