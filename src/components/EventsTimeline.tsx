import type { CalendarEvent } from "../types/economic";

function ImpactDot({ impact }: { impact: string }) {
  const color = impact === "high" ? "bg-red-500" : impact === "medium" ? "bg-yellow-400" : "bg-gray-300";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={impact} />;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export default function EventsTimeline({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  const upcoming = events
    .filter((e) => daysUntil(e.date) >= 0)
    .slice(0, 7);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming Events</h3>
      <div className="flex flex-col gap-2">
        {upcoming.map((event, i) => {
          const days = daysUntil(event.date);
          return (
            <div key={`${event.date}-${i}`} className="flex items-center gap-2 text-xs">
              <ImpactDot impact={event.impact} />
              <span className="min-w-[4rem] text-gray-500 dark:text-gray-400">
                {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
              </span>
              <span className="flex-1 text-gray-700 dark:text-gray-300">{event.event}</span>
              <span className="text-gray-400">{event.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
