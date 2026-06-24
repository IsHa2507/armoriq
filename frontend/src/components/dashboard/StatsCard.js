import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
export function StatsCard({ stat }) {
    const { label, value, delta, trend } = stat;
    const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
    const trendColor = cn(trend === "up" && "text-emerald-600 dark:text-emerald-400", trend === "down" && "text-red-500 dark:text-red-400", (!trend || trend === "neutral") && "text-neutral-500 dark:text-neutral-400");
    return (_jsxs("div", { className: "rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400", children: label }), _jsx("p", { className: "mt-2 text-3xl font-semibold tabular-nums text-neutral-900 dark:text-white", children: value }), delta && (_jsxs("p", { className: cn("mt-1 flex items-center gap-1 text-xs", trendColor), children: [_jsx(TrendIcon, { size: 12, "aria-hidden": "true" }), delta] }))] }));
}
