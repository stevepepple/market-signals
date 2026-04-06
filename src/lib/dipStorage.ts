import type { DipHolding, DipSignal, TradeLogEntry } from "../types/dip";

const KEYS = {
  holdings: "dw:holdings",
  signals: "dw:signals",
  lastChecked: "dw:lastChecked",
  tradeLog: "dw:tradeLog",
  settings: "dw:settings",
} as const;

// --- Holdings ---

export function loadHoldings(): DipHolding[] {
  try {
    const raw = localStorage.getItem(KEYS.holdings);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHoldings(holdings: DipHolding[]): void {
  localStorage.setItem(KEYS.holdings, JSON.stringify(holdings));
}

// --- Signals ---

export function loadCachedSignals(): { signals: DipSignal[]; lastChecked: string | null } {
  try {
    const raw = localStorage.getItem(KEYS.signals);
    const lastChecked = localStorage.getItem(KEYS.lastChecked);
    return { signals: raw ? JSON.parse(raw) : [], lastChecked };
  } catch {
    return { signals: [], lastChecked: null };
  }
}

export function saveCachedSignals(signals: DipSignal[]): void {
  localStorage.setItem(KEYS.signals, JSON.stringify(signals));
  localStorage.setItem(KEYS.lastChecked, new Date().toISOString());
}

export function clearSignalCache(): void {
  localStorage.removeItem(KEYS.signals);
  localStorage.removeItem(KEYS.lastChecked);
}

// --- Trade Log ---

export function loadTradeLog(): TradeLogEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.tradeLog);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTradeLog(log: TradeLogEntry[]): void {
  localStorage.setItem(KEYS.tradeLog, JSON.stringify(log));
}

export function addTradeEntry(entry: TradeLogEntry): TradeLogEntry[] {
  const log = loadTradeLog();
  log.unshift(entry);
  saveTradeLog(log);
  return log;
}

export function deleteTradeEntry(id: number): TradeLogEntry[] {
  const log = loadTradeLog().filter((e) => e.id !== id);
  saveTradeLog(log);
  return log;
}

export function clearTradeLog(): void {
  localStorage.removeItem(KEYS.tradeLog);
}

// --- Settings ---

export interface DipSettings {
  email?: string;
}

export function loadSettings(): DipSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSettings(settings: DipSettings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}
