import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadEconomicData, loadCalendarData, loadSentimentData, loadNewsData } from "../loaders";

describe("data loaders", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loadEconomicData returns array from JSON", async () => {
    const mockData = [{ series_id: "DGS10", theme: "fed_rate", value: 4.25 }];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await loadEconomicData();
    expect(result).toEqual(mockData);
  });

  it("loadEconomicData returns empty array on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);
    expect(await loadEconomicData()).toEqual([]);
  });

  it("loadCalendarData returns array from JSON", async () => {
    const mockData = [{ date: "2026-03-15", event: "CPI Release" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await loadCalendarData();
    expect(result).toEqual(mockData);
  });

  it("loadSentimentData returns empty array on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);
    expect(await loadSentimentData()).toEqual([]);
  });

  it("loadNewsData returns empty array on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);
    expect(await loadNewsData()).toEqual([]);
  });
});
