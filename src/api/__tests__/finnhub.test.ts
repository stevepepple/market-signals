import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchEconomicCalendar, fetchMarketNews } from "../finnhub";

describe("fetchEconomicCalendar", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("parses and filters US events", async () => {
    const mock = {
      economicCalendar: [
        { country: "US", date: "2026-03-12", event: "CPI Release", impact: "high", actual: null, estimate: 3.1, prev: 3.0 },
        { country: "CA", date: "2026-03-12", event: "Canada Jobs", impact: "medium" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    } as Response);

    const events = await fetchEconomicCalendar("key", "2026-03-01", "2026-03-31");
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("CPI Release");
    expect(events[0].themes).toContain("inflation");
    expect(events[0].source).toBe("finnhub");
  });
});

describe("fetchMarketNews", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps articles to NewsItem with theme classification", async () => {
    const mock = [
      { headline: "Fed signals rate cut", source: "Reuters", url: "https://example.com", datetime: 1741824000, summary: "FOMC meeting" },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    } as Response);

    const news = await fetchMarketNews("key");
    expect(news).toHaveLength(1);
    expect(news[0].themes).toContain("fed_rate");
    expect(news[0].headline).toBe("Fed signals rate cut");
  });
});
