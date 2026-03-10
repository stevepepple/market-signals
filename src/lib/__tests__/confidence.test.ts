import { describe, it, expect } from "vitest";
import { computeConfidence } from "../confidence";
import type { EconomicIndicator } from "../../types/economic";
import type { ThemeSignal } from "../../types";

function makeSignal(overrides: Partial<ThemeSignal>): ThemeSignal {
  return {
    label: "Test",
    avg_yes_price: 0.5,
    market_count: 1,
    total_volume_24h: 1000,
    strength: "moderate",
    magnitude: 0.5,
    direction: "yes",
    top_markets: [],
    ...overrides,
  };
}

function makeIndicator(overrides: Partial<EconomicIndicator>): EconomicIndicator {
  return {
    series_id: "TEST",
    theme: "fed_rate",
    label: "Test",
    value: 4.0,
    date: "2026-03-10",
    previous_value: 4.0,
    change_pct: 0,
    ...overrides,
  };
}

describe("computeConfidence", () => {
  it("returns neutral for themes without FRED data", () => {
    const result = computeConfidence("ai_tech", makeSignal({}), []);
    expect(result.status).toBe("neutral");
  });

  it("detects confirmation for fed_rate when yields falling and signal says rate cut", () => {
    const signal = makeSignal({ avg_yes_price: 0.75, direction: "yes" });
    const indicators = [
      makeIndicator({ series_id: "DGS2", theme: "fed_rate", value: 3.8, previous_value: 4.2, change_pct: -9.52 }),
    ];
    const result = computeConfidence("fed_rate", signal, indicators);
    expect(result.status).toBe("confirmed");
  });

  it("detects divergence for recession when Sahm triggered but market says no recession", () => {
    const signal = makeSignal({ avg_yes_price: 0.25, direction: "no" });
    const indicators = [
      makeIndicator({ series_id: "SAHM", theme: "recession", value: 0.6, previous_value: 0.3, change_pct: 100 }),
    ];
    const result = computeConfidence("recession", signal, indicators);
    expect(result.status).toBe("divergent");
  });

  it("returns neutral when data is inconclusive", () => {
    const signal = makeSignal({ avg_yes_price: 0.5, direction: "neutral" });
    const indicators = [
      makeIndicator({ series_id: "DGS10", theme: "fed_rate", value: 4.0, previous_value: 4.0, change_pct: 0 }),
    ];
    const result = computeConfidence("fed_rate", signal, indicators);
    expect(result.status).toBe("neutral");
  });
});
