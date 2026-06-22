import type { ActivityItem } from "@/types/agent";

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-neutral-400">
        No recent activity.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4" aria-label="Activity feed">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span
            className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <span className="font-medium text-neutral-900 dark:text-white">
                {item.actor}
              </span>{" "}
              {item.action}{" "}
              <span className="font-medium text-neutral-900 dark:text-white">
                {item.target}
              </span>
            </p>
            <time dateTime={item.timestamp} className="text-xs text-neutral-400">
              {new Date(item.timestamp).toLocaleString()}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
