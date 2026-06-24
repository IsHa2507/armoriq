import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
// Re-exports from individual dashboard components
export { StatsCard } from "./StatsCard";
export { ActivityFeed } from "./ActivityFeed";
export { MCPServerCard } from "./MCPServerCard";
export { RulesTable } from "./RulesTable";
export { ConversationPanel } from "./ConversationPanel";
export function GlassCard({ children, className }) {
    return _jsx("div", { className: cn("glass-card rounded-xl", className), children: children });
}
const toneMap = {
    primary: "text-primary bg-primary/10 ring-primary/20",
    success: "text-success bg-success/10 ring-success/20",
    warning: "text-warning bg-warning/10 ring-warning/20",
    danger: "text-destructive bg-destructive/10 ring-destructive/20",
};
export function KpiCard({ label, value, delta, Icon, tone = "primary", }) {
    const positive = delta.startsWith("+");
    return (_jsxs(GlassCard, { className: "group relative overflow-hidden p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5", children: [_jsx("div", { className: "absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" }), _jsxs("div", { className: "relative flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-muted-foreground", children: label }), _jsx("p", { className: "mt-2 text-3xl font-bold tracking-tight", children: value }), _jsxs("div", { className: cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", positive ? "text-success" : "text-destructive"), children: [positive ? _jsx(TrendingUp, { className: "h-3 w-3" }) : _jsx(TrendingDown, { className: "h-3 w-3" }), delta, " vs last week"] })] }), _jsx("div", { className: cn("flex h-10 w-10 items-center justify-center rounded-lg ring-1", toneMap[tone]), children: _jsx(Icon, { className: "h-5 w-5" }) })] })] }));
}
export function StatusDot({ status }) {
    const cls = status === "online" ? "bg-success" :
        status === "warning" ? "bg-warning" : "bg-muted-foreground";
    return (_jsxs("span", { className: "relative inline-flex h-2 w-2", children: [status === "online" && _jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" }), _jsx("span", { className: cn("relative inline-flex h-2 w-2 rounded-full", cls) })] }));
}
const riskMap = {
    low: "text-success bg-success/10 ring-success/30",
    medium: "text-warning bg-warning/10 ring-warning/30",
    high: "text-orange-400 bg-orange-500/10 ring-orange-500/30",
    critical: "text-destructive bg-destructive/15 ring-destructive/40",
};
export function RiskBadge({ level }) {
    return (_jsxs("span", { className: cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset", riskMap[level]), children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-current" }), level] }));
}
export function SectionHeader({ title, action }) {
    return (_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: title }), action] }));
}
