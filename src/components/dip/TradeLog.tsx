import type { TradeLogEntry } from "../../types/dip";

interface TradeLogProps {
  entries: TradeLogEntry[];
  onDelete: (id: number) => void;
}

export default function TradeLog({ entries, onDelete }: TradeLogProps) {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">No trades logged yet</p>
        <p className="text-sm mt-1">Trades will appear here when you log them from holding cards</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
            <th className="py-2 px-2 font-medium">Date</th>
            <th className="py-2 px-2 font-medium">Ticker</th>
            <th className="py-2 px-2 font-medium">Action</th>
            <th className="py-2 px-2 font-medium text-right">Price</th>
            <th className="py-2 px-2 font-medium text-right">Shares</th>
            <th className="py-2 px-2 font-medium text-right">Amount</th>
            <th className="py-2 px-2 font-medium">Notes</th>
            <th className="py-2 px-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={entry.id} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{entry.date}</td>
              <td className="py-2 px-2 font-medium text-gray-900 dark:text-gray-100">{entry.ticker}</td>
              <td className="py-2 px-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  entry.action === "BUY"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                }`}>
                  {entry.action}
                </span>
              </td>
              <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">${entry.price.toFixed(2)}</td>
              <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{entry.shares}</td>
              <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">${entry.amount.toLocaleString()}</td>
              <td className="py-2 px-2 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{entry.notes ?? ""}</td>
              <td className="py-2 px-2">
                <button onClick={() => onDelete(entry.id)} className="text-gray-400 hover:text-red-500" title="Delete entry">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L6.94 8l-1.72 1.72a.75.75 0 1 0 1.06 1.06L8 9.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L9.06 8l1.72-1.72a.75.75 0 0 0-1.06-1.06L8 6.94 6.28 5.22Z" /></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
