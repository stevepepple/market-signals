import { useState } from "react";
import type { DipHolding, DipSignal, TradeLogEntry } from "../../types/dip";

const ACTION_COLORS: Record<string, string> = {
  BUY: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  SELL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  WATCH: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  HOLD: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

interface HoldingCardProps {
  holding: DipHolding;
  signal?: DipSignal;
  recentTrades: TradeLogEntry[];
  onEdit: (holding: DipHolding) => void;
  onRemove: (symbol: string) => void;
  onLogTrade: (entry: Omit<TradeLogEntry, "id">) => void;
}

export default function HoldingCard({
  holding,
  signal,
  recentTrades,
  onEdit,
  onRemove,
  onLogTrade,
}: HoldingCardProps) {
  const [editing, setEditing] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [draft, setDraft] = useState<DipHolding>({ ...holding });

  // Trade form state
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));
  const [tradePrice, setTradePrice] = useState(signal?.currentPrice?.toString() ?? "");
  const [tradeShares, setTradeShares] = useState(signal?.suggestedShares ?? "");
  const [tradeNotes, setTradeNotes] = useState("");

  const pctFromCost = signal
    ? signal.pctFromCost
    : ((holding.price - holding.avg_cost) / holding.avg_cost) * 100;

  function handleSave() {
    // Validate and sort tiers
    const cleaned = {
      ...draft,
      tiers: draft.tiers
        .filter((t) => t.pct > 0 && t.amount > 0)
        .sort((a, b) => a.pct - b.pct),
    };
    if (cleaned.tiers.length === 0) return;
    onEdit(cleaned);
    setEditing(false);
  }

  function handleLogTrade() {
    if (!signal) return;
    const price = parseFloat(tradePrice);
    const shares = parseFloat(tradeShares);
    if (isNaN(price) || isNaN(shares) || shares <= 0) return;
    onLogTrade({
      ticker: holding.symbol,
      action: signal.action === "SELL" ? "SELL" : "BUY",
      date: tradeDate,
      price,
      shares,
      amount: Math.round(price * shares * 100) / 100,
      notes: tradeNotes || undefined,
    });
    setShowTradeForm(false);
    setTradeNotes("");
  }

  function updateTier(idx: number, field: "pct" | "amount", value: string) {
    const tiers = [...draft.tiers];
    tiers[idx] = { ...tiers[idx], [field]: parseFloat(value) || 0 };
    setDraft({ ...draft, tiers });
  }

  function addTier() {
    if (draft.tiers.length >= 3) return;
    setDraft({ ...draft, tiers: [...draft.tiers, { pct: 0, amount: 0 }] });
  }

  function removeTier(idx: number) {
    if (draft.tiers.length <= 1) return;
    setDraft({ ...draft, tiers: draft.tiers.filter((_, i) => i !== idx) });
  }

  if (editing) {
    return (
      <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 dark:border-gray-700 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Edit {holding.symbol}
          </h3>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
              Save
            </button>
            <button onClick={() => { setEditing(false); setDraft({ ...holding }); }} className="px-3 py-1 text-sm border rounded text-gray-600 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400">Shares</span>
            <input type="number" value={draft.shares} onChange={(e) => setDraft({ ...draft, shares: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400">Avg Cost</span>
            <input type="number" step="0.01" value={draft.avg_cost} onChange={(e) => setDraft({ ...draft, avg_cost: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400">Cash Reserve ($)</span>
            <input type="number" value={draft.cashReserve} onChange={(e) => setDraft({ ...draft, cashReserve: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400">Profit Threshold (%)</span>
            <input type="number" value={draft.profitThreshold} onChange={(e) => setDraft({ ...draft, profitThreshold: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400">Sell % on Profit</span>
            <input type="number" value={draft.sellPct} onChange={(e) => setDraft({ ...draft, sellPct: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Buy Tiers</span>
            {draft.tiers.length < 3 && (
              <button onClick={addTier} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">+ Add tier</button>
            )}
          </div>
          {draft.tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400 w-6">T{i + 1}</span>
              <input type="number" placeholder="Dip %" value={tier.pct || ""} onChange={(e) => updateTier(i, "pct", e.target.value)}
                className="w-20 border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              <span className="text-gray-400">%</span>
              <input type="number" placeholder="Amount $" value={tier.amount || ""} onChange={(e) => updateTier(i, "amount", e.target.value)}
                className="w-24 border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              <span className="text-gray-400">$</span>
              {draft.tiers.length > 1 && (
                <button onClick={() => removeTier(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 dark:border-gray-700 space-y-3">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{holding.symbol}</h3>
            {signal && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[signal.action]}`}>
                {signal.action}{signal.tierLabel ? ` (${signal.tierLabel})` : ""}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{holding.name}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => { setDraft({ ...holding }); setEditing(true); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.22 10.306a.75.75 0 0 0-.188.335l-.758 2.8a.375.375 0 0 0 .465.465l2.8-.758a.75.75 0 0 0 .335-.188l7.793-7.793a1.75 1.75 0 0 0 0-2.475Z" /></svg>
          </button>
          <button onClick={() => onRemove(holding.symbol)} className="p-1 text-gray-400 hover:text-red-500" title="Remove">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.286a1.5 1.5 0 0 0 1.492-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400 text-xs">Shares</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">{holding.shares}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 text-xs">Avg Cost</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">${holding.avg_cost.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 text-xs">Current</span>
          <p className="font-medium text-gray-900 dark:text-gray-100">${signal?.currentPrice?.toFixed(2) ?? holding.price.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 text-xs">From Cost</span>
          <p className={`font-medium ${pctFromCost >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {pctFromCost >= 0 ? "+" : ""}{pctFromCost.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Signal details */}
      {signal && signal.action !== "HOLD" && (
        <div className="text-sm bg-gray-50 dark:bg-gray-800 rounded p-2 space-y-1">
          <p className="text-gray-700 dark:text-gray-300">{signal.reason}</p>
          <p className="text-gray-600 dark:text-gray-400 font-mono text-xs">{signal.detail}</p>
        </div>
      )}

      {/* Tier summary */}
      <div className="flex gap-2 flex-wrap text-xs">
        {holding.tiers.map((t, i) => (
          <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
            T{i + 1}: -{t.pct}% → ${t.amount.toLocaleString()}
          </span>
        ))}
        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
          Cash: ${holding.cashReserve.toLocaleString()}
        </span>
        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
          Profit: {holding.profitThreshold}% → sell {holding.sellPct}%
        </span>
      </div>

      {/* Log trade affordance */}
      {signal && (signal.action === "BUY" || signal.action === "SELL") && (
        <div>
          {!showTradeForm ? (
            <button onClick={() => {
              setTradeDate(new Date().toISOString().slice(0, 10));
              setTradePrice(signal.currentPrice.toString());
              setTradeShares(signal.suggestedShares ?? "");
              setShowTradeForm(true);
            }} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              Log trade
            </button>
          ) : (
            <div className="border-t pt-3 dark:border-gray-700 space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Log {signal.action} trade</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="space-y-0.5">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Date</span>
                  <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </label>
                <label className="space-y-0.5">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Price</span>
                  <input type="number" step="0.01" value={tradePrice} onChange={(e) => setTradePrice(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </label>
                <label className="space-y-0.5">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Shares</span>
                  <input type="number" step="0.1" value={tradeShares} onChange={(e) => setTradeShares(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </label>
              </div>
              <input type="text" placeholder="Notes (optional)" value={tradeNotes} onChange={(e) => setTradeNotes(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              <div className="flex gap-2">
                <button onClick={handleLogTrade} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
                <button onClick={() => setShowTradeForm(false)} className="px-3 py-1 text-sm border rounded text-gray-600 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent trades */}
      {recentTrades.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Recent: {recentTrades.slice(0, 3).map((t) => `${t.action} ${t.date.slice(5)}`).join(", ")}
        </p>
      )}
    </div>
  );
}
