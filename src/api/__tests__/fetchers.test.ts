import { describe, it, expect } from "vitest";
import { classifyMarket, isStrongSignal } from "../fetchers";

describe("classifyMarket", () => {
  it("matches multiple themes", () => {
    const market = { title: "Will the Fed cut interest rates amid recession fears?", subtitle: "" };
    const themes = classifyMarket(market as any);
    expect(themes).toContain("fed_rate");
    expect(themes).toContain("recession");
  });

  it("matches new healthcare theme", () => {
    const market = { title: "Will the FDA approve this biotech drug?", subtitle: "" };
    const themes = classifyMarket(market as any);
    expect(themes).toContain("healthcare_biotech");
  });

  it("matches new defense theme", () => {
    const market = { title: "Will NATO budget increase military spending?", subtitle: "" };
    const themes = classifyMarket(market as any);
    expect(themes).toContain("defense_aerospace");
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
