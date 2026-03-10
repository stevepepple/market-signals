import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchEconomicCalendar, fetchEarningsCalendar, fetchMarketNews } from "../src/api/finnhub";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CALENDAR_PATH = resolve(__dirname, "../public/data/calendar.json");
const NEWS_PATH = resolve(__dirname, "../public/data/news.json");

function writeIfChanged(path: string, data: unknown) {
  const newJson = JSON.stringify(data, null, 2);
  let existing = "";
  try { existing = readFileSync(path, "utf-8"); } catch {}
  if (existing !== newJson) {
    writeFileSync(path, newJson);
    console.log(`Wrote ${path}`);
  } else {
    console.log(`No changes for ${path}`);
  }
}

export async function fetchFinnhubData() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.error("FINNHUB_API_KEY not set — skipping Finnhub fetch");
    return;
  }

  const today = new Date();
  const fromDate = today.toISOString().slice(0, 10);
  const toDate = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  console.log("Fetching Finnhub data...");

  const [economic, earnings, news] = await Promise.all([
    fetchEconomicCalendar(apiKey, fromDate, toDate).catch((e) => { console.error("Economic calendar:", e); return []; }),
    fetchEarningsCalendar(apiKey, fromDate, toDate).catch((e) => { console.error("Earnings calendar:", e); return []; }),
    fetchMarketNews(apiKey).catch((e) => { console.error("Market news:", e); return []; }),
  ]);

  const calendar = [...economic, ...earnings].sort((a, b) => a.date.localeCompare(b.date));
  console.log(`Fetched ${calendar.length} calendar events, ${news.length} news items`);

  writeIfChanged(CALENDAR_PATH, calendar);
  writeIfChanged(NEWS_PATH, news);
}

if (process.argv[1]?.includes("fetch-finnhub")) {
  fetchFinnhubData().catch((e) => {
    console.error("Finnhub fetch error:", e);
    process.exit(1);
  });
}
