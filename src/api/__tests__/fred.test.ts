// src/api/__tests__/fred.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFredSeries, fetchAllFredIndicators, FRED_SERIES } from "../fred";

describe("FRED_SERIES config", () => {
  it("maps all series to a theme", () => {
    for (const [id, config] of Object.entries(FRED_SERIES)) {
      expect(config.theme).toBeTruthy();
      expect(config.label).toBeTruthy();
    }
  });

  it("covers expected themes", () => {
    const themes = new Set(Object.values(FRED_SERIES).map((c) => c.theme));
    expect(themes).toContain("fed_rate");
    expect(themes).toContain("inflation");
    expect(themes).toContain("recession");
    expect(themes).toContain("employment");
    expect(themes).toContain("housing");
    expect(themes).toContain("energy_climate");
  });
});

describe("fetchFredSeries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses FRED API response correctly", async () => {
    const mockResponse = {
      observations: [
        { date: "2026-03-07", value: "4.25" },
        { date: "2026-03-06", value: "4.30" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchFredSeries("DGS10", "test-key");
    expect(result).toEqual([
      { date: "2026-03-07", value: 4.25 },
      { date: "2026-03-06", value: 4.30 },
    ]);
  });

  it("filters out missing values (dot notation)", async () => {
    const mockResponse = {
      observations: [
        { date: "2026-03-07", value: "." },
        { date: "2026-03-06", value: "4.30" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchFredSeries("DGS10", "test-key");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(4.30);
  });

  it("throws on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as Response);

    await expect(fetchFredSeries("DGS10", "test-key")).rejects.toThrow("FRED API error: 429");
  });
});

describe("fetchAllFredIndicators", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("computes change_pct correctly", async () => {
    const mockResponse = {
      observations: [
        { date: "2026-03-07", value: "4.25" },
        { date: "2026-03-06", value: "4.00" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const results = await fetchAllFredIndicators("test-key");
    const dgs10 = results.find((r) => r.series_id === "DGS10");
    expect(dgs10).toBeDefined();
    expect(dgs10!.value).toBe(4.25);
    expect(dgs10!.previous_value).toBe(4.00);
    expect(dgs10!.change_pct).toBe(6.25);
  });
});
