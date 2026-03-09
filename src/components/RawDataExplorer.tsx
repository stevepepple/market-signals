import { useState } from "react";
import type { NormalizedMarket } from "../types";

interface RawDataExplorerProps {
  markets: NormalizedMarket[];
  themedCount: number;
  unclassifiedCount: number;
}

export default function RawDataExplorer({
  markets,
  themedCount,
  unclassifiedCount,
}: RawDataExplorerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? markets.filter((m) =>
        m.title.toLowerCase().includes(search.toLowerCase())
      )
    : markets;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="text-lg font-semibold text-gray-100">
          {open ? "\u25BC" : "\u25B6"} Raw Market Data Explorer
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({themedCount} themed, {unclassifiedCount} unclassified)
          </span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <input
            type="text"
            placeholder="Search markets by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 mb-4"
          />

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="py-2 px-3">Source</th>
                  <th className="py-2 px-3">Title</th>
                  <th className="py-2 px-3">Yes Price</th>
                  <th className="py-2 px-3">Volume 24h</th>
                  <th className="py-2 px-3">Themes</th>
                  <th className="py-2 px-3">URL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr
                    key={`${m.source}-${m.id}`}
                    className="border-b border-gray-800/50 even:bg-gray-900/50"
                  >
                    <td className="py-2 px-3 text-gray-300 capitalize">
                      {m.source}
                    </td>
                    <td className="py-2 px-3 text-gray-100">{m.title}</td>
                    <td className="py-2 px-3 text-gray-300">
                      {m.yes_price != null
                        ? Math.round(m.yes_price * 100) + "%"
                        : "N/A"}
                    </td>
                    <td className="py-2 px-3 text-gray-300">
                      {m.volume_24h.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-gray-400">
                      {m.themes.join(", ") || "\u2014"}
                    </td>
                    <td className="py-2 px-3">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No markets match your search.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
