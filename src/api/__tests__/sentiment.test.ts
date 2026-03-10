import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFearAndGreed, fetchCryptoFearAndGreed, fetchAllSentiment } from "../sentiment";

describe("fetchFearAndGreed", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("parses CNN Fear & Greed response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        fear_and_greed: { score: 35, rating: "Fear", timestamp: 1741824000 },
        market_momentum: { score: 40 },
      }),
    } as Response);

    const result = await fetchFearAndGreed();
    expect(result).not.toBeNull();
    expect(result!.score).toBe(35);
    expect(result!.label).toBe("Fear");
    expect(result!.source).toBe("cnn_fear_greed");
  });

  it("returns null on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchFearAndGreed()).toBeNull();
  });
});

describe("fetchCryptoFearAndGreed", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("parses alternative.me response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ value: "25", value_classification: "Extreme Fear", timestamp: "1741824000" }],
      }),
    } as Response);

    const result = await fetchCryptoFearAndGreed();
    expect(result!.score).toBe(25);
    expect(result!.label).toBe("Extreme Fear");
    expect(result!.source).toBe("crypto_fear_greed");
  });
});

describe("fetchAllSentiment", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("includes VIX when provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false } as Response);
    const results = await fetchAllSentiment(22.5, "2026-03-10");
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("vix");
    expect(results[0].score).toBe(22.5);
    expect(results[0].label).toBe("Moderate");
  });
});
