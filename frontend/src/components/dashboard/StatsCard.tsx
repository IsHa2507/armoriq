import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stat } from "@/types/agent";

interface StatsCardProps {
  stat: Stat;
}

export function StatsCard({ stat }: StatsCardProps) {
  const { label, value, delta, trend } = stat;

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor = cn(
    trend === "up" && "text-emerald-600 dark:text-emerald-400",
    trend === "down" && "text-red-500 dark:text-red-400",
    (!trend || trend === "neutral") && "text-neutral-500 dark:text-neutral-400"
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-white">
        {value}
      </p>
      {delta && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs", trendColor)}>
          <TrendIcon size={12} aria-hidden="true" />
          {delta}
        </p>
      )}
    </div>
  );
}
