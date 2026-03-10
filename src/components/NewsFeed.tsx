import { useState } from "react";
import type { NewsItem } from "../types/economic";

export default function NewsFeed({ news }: { news: NewsItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (news.length === 0) return null;

  const themed = news.filter((n) => n.themes.length > 0);
  const displayed = expanded ? themed : themed.slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">News</h3>
        {themed.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {expanded ? "Show less" : `Show all (${themed.length})`}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {displayed.map((item, i) => (
          <a
            key={`${item.url}-${i}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-0.5 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <span className="text-xs text-gray-800 group-hover:text-blue-600 dark:text-gray-200 dark:group-hover:text-blue-400">
              {item.headline}
            </span>
            <span className="flex items-center gap-2 text-[10px] text-gray-400">
              <span>{item.source}</span>
              <span>{new Date(item.datetime).toLocaleDateString()}</span>
              {item.themes.length > 0 && (
                <span className="rounded bg-gray-100 px-1 dark:bg-gray-700">{item.themes.join(", ")}</span>
              )}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
