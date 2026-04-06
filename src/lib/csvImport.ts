import type { Holding } from "../types";
import type { DipHolding } from "../types/dip";

interface CsvRow {
  date: string;
  symbol: string;
  name: string;
  transCode: string;
  quantity: number;
  price: number;
  amount: number;
}

/**
 * Parse a Robinhood CSV export into aggregated holdings.
 * Robinhood CSV columns (detected by header):
 *   Activity Date, Process Date, Settle Date, Instrument,
 *   Description, Trans Code, Quantity, Price, Amount
 */
export function parseRobinhoodCSV(csvText: string): Holding[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const colIdx = detectColumns(header);
  if (!colIdx) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < header.length) continue;

    const transCode = cols[colIdx.transCode]?.trim() ?? "";
    // Only care about Buy and Sell transactions
    if (!/^(Buy|Sell)$/i.test(transCode)) continue;

    const symbol = extractTicker(
      cols[colIdx.instrument]?.trim() ?? "",
      cols[colIdx.description]?.trim() ?? ""
    );
    if (!symbol) continue;

    rows.push({
      date: cols[colIdx.date]?.trim() ?? "",
      symbol,
      name: cols[colIdx.instrument]?.trim() ?? symbol,
      transCode: transCode.toLowerCase(),
      quantity: Math.abs(parseFloat(cols[colIdx.quantity]) || 0),
      price: Math.abs(parseFloat(stripDollar(cols[colIdx.price])) || 0),
      amount: Math.abs(parseFloat(stripDollar(cols[colIdx.amount])) || 0),
    });
  }

  return aggregateHoldings(rows);
}

/** Detect column indices from the header row */
function detectColumns(header: string[]): {
  date: number;
  instrument: number;
  description: number;
  transCode: number;
  quantity: number;
  price: number;
  amount: number;
} | null {
  const lower = header.map((h) => h.trim().toLowerCase());
  const find = (candidates: string[]) =>
    lower.findIndex((h) => candidates.some((c) => h.includes(c)));

  const date = find(["activity date", "date"]);
  const instrument = find(["instrument"]);
  const description = find(["description"]);
  const transCode = find(["trans code", "transaction"]);
  const quantity = find(["quantity", "qty"]);
  const price = find(["price"]);
  const amount = find(["amount"]);

  if (transCode === -1 || quantity === -1 || price === -1) return null;

  return {
    date: date >= 0 ? date : 0,
    instrument: instrument >= 0 ? instrument : 0,
    description: description >= 0 ? description : instrument >= 0 ? instrument : 0,
    transCode,
    quantity,
    price,
    amount: amount >= 0 ? amount : price,
  };
}

/** Parse a single CSV line, handling quoted fields */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/** Extract ticker symbol from Instrument or Description column */
function extractTicker(instrument: string, description: string): string | null {
  // If instrument looks like a ticker (all caps, 1-5 chars)
  if (/^[A-Z]{1,5}$/.test(instrument)) return instrument;

  // Try to find ticker in description (often "Symbol - Name" or just the symbol)
  const tickerMatch = description.match(/\b([A-Z]{1,5})\b/);
  if (tickerMatch) return tickerMatch[1];

  // Try instrument as-is if it's short enough
  const cleaned = instrument.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (cleaned.length >= 1 && cleaned.length <= 5) return cleaned;

  return null;
}

function stripDollar(s: string): string {
  return s.replace(/[$,]/g, "");
}

/** Aggregate buy/sell rows into net holdings with weighted avg cost */
function aggregateHoldings(rows: CsvRow[]): Holding[] {
  const map = new Map<string, { name: string; totalShares: number; totalCost: number }>();

  for (const row of rows) {
    const entry = map.get(row.symbol) ?? { name: row.name, totalShares: 0, totalCost: 0 };
    if (row.transCode === "buy") {
      entry.totalCost += row.quantity * row.price;
      entry.totalShares += row.quantity;
    } else {
      // Sell: reduce shares (cost basis stays as weighted average)
      entry.totalShares -= row.quantity;
    }
    if (!map.has(row.symbol)) entry.name = row.name;
    map.set(row.symbol, entry);
  }

  const holdings: Holding[] = [];
  for (const [symbol, data] of map) {
    if (data.totalShares <= 0) continue; // fully sold
    const avgCost = data.totalCost > 0 && data.totalShares > 0
      ? data.totalCost / data.totalShares
      : 0;
    holdings.push({
      name: data.name,
      symbol,
      shares: Math.round(data.totalShares * 1000) / 1000,
      price: 0,       // unknown from CSV
      avg_cost: Math.round(avgCost * 100) / 100,
      total_return: 0, // unknown without current price
      equity: 0,       // unknown without current price
      type: "stock",   // default, user can change
    });
  }

  return holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/**
 * Merge imported holdings into existing DipHoldings.
 * - Updates shares and avg_cost for existing symbols
 * - Adds new symbols with DipHolding defaults
 */
export function mergeImportedHoldings(
  existing: DipHolding[],
  imported: Holding[]
): { merged: DipHolding[]; newCount: number; updatedCount: number } {
  const existingMap = new Map(existing.map((h) => [h.symbol, h]));
  let newCount = 0;
  let updatedCount = 0;

  for (const imp of imported) {
    const ex = existingMap.get(imp.symbol);
    if (ex) {
      existingMap.set(imp.symbol, {
        ...ex,
        shares: imp.shares,
        avg_cost: imp.avg_cost,
        name: imp.name || ex.name,
      });
      updatedCount++;
    } else {
      existingMap.set(imp.symbol, {
        ...imp,
        cashReserve: 0,
        profitThreshold: 15,
        sellPct: 25,
        tiers: [{ pct: 7, amount: 500 }],
      });
      newCount++;
    }
  }

  return {
    merged: Array.from(existingMap.values()),
    newCount,
    updatedCount,
  };
}
