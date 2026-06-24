import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { GlassCard, KpiCard, SectionHeader } from "@/components/dashboard/widgets";
import { dashboardAPI, } from "@/services/api";
import { Bot, Server, Zap, ShieldAlert, Clock, Activity, ShieldCheck, AlertTriangle, RefreshCw, } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, } from "recharts";
import { cn } from "@/lib/utils";
// ── helpers ───────────────────────────────────────────────────────────────────
/** Format a raw number into a display string (e.g. 4821 → "4,821") */
function fmt(n) {
    return n.toLocaleString();
}
// ── sub-components ────────────────────────────────────────────────────────────
function SkeletonKpi() {
    return (_jsxs(GlassCard, { className: "p-5 animate-pulse", children: [_jsx("div", { className: "h-3 w-24 rounded bg-muted/40 mb-3" }), _jsx("div", { className: "h-8 w-20 rounded bg-muted/40 mb-2" }), _jsx("div", { className: "h-3 w-16 rounded bg-muted/30" })] }));
}
// ── page ──────────────────────────────────────────────────────────────────────
export function IndexRoute() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const load = useCallback(async (silent = false) => {
        if (!silent)
            setLoading(true);
        else
            setRefreshing(true);
        setError(null);
        try {
            const result = await dashboardAPI.get();
            setData(result);
        }
        catch (err) {
            console.error("[Dashboard] Failed to load:", err);
            setError("Could not reach backend. Is Django running on :8000?");
        }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);
    useEffect(() => {
        void load();
        // Auto-refresh every 30 seconds
        const id = setInterval(() => void load(true), 30000);
        return () => clearInterval(id);
    }, [load]);
    // ── build KPI cards from live data ────────────────────────────────────
    const kpiCards = data
        ? [
            {
                label: "Active Sessions",
                value: fmt(data.kpis.active_sessions),
                delta: "+0",
                icon: Bot,
                tone: "primary",
            },
            {
                label: "MCP Servers",
                value: data.kpis.mcp_servers,
                delta: "+0",
                icon: Server,
                tone: "success",
            },
            {
                label: "Tool Calls Today",
                value: fmt(data.kpis.tool_calls_today),
                delta: data.kpi_deltas.tool_calls_today,
                icon: Zap,
                tone: "primary",
            },
            {
                label: "Blocked Actions",
                value: fmt(data.kpis.blocked_today),
                delta: data.kpi_deltas.blocked_today,
                icon: ShieldAlert,
                tone: "danger",
            },
            {
                label: "Pending Approvals",
                value: fmt(data.kpis.pending_approvals),
                delta: "+0",
                icon: Clock,
                tone: "warning",
            },
            {
                label: "Uptime",
                value: `${data.kpis.uptime_pct}%`,
                delta: "0%",
                icon: Activity,
                tone: "success",
            },
        ]
        : [];
    const series = data?.tool_usage_series ?? [];
    const topTools = data?.top_tools ?? [];
    const events = data?.security_events ?? [];
    const shield = data?.threat_shield ?? { score: 0, allowed: 0, blocked: 0, pending: 0 };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("span", { className: "text-[10px] text-muted-foreground", children: loading ? "Loading…" : error ? "Backend unreachable" : "Live · updates every 30s" }), _jsxs("button", { type: "button", onClick: () => void load(true), disabled: refreshing || loading, className: "inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50", children: [_jsx(RefreshCw, { className: cn("h-3 w-3", refreshing && "animate-spin") }), "Refresh"] })] }), error && (_jsx("div", { className: "mb-4 rounded-md bg-destructive/10 px-4 py-2 text-xs text-destructive", children: error })), _jsx("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", children: loading
                    ? Array.from({ length: 6 }).map((_, i) => _jsx(SkeletonKpi, {}, i))
                    : kpiCards.map((k, i) => (_jsx("div", { style: { animationDelay: `${i * 50}ms` }, className: "animate-fade-in-up", children: _jsx(KpiCard, { label: k.label, value: k.value, delta: k.delta, Icon: k.icon, tone: k.tone }) }, k.label))) }), _jsxs("div", { className: "mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3", children: [_jsxs(GlassCard, { className: "p-5 lg:col-span-2", children: [_jsx(SectionHeader, { title: "Tool Usage \u00B7 last 24h", action: _jsx("span", { className: "text-xs text-muted-foreground", children: loading ? "—" : `${fmt(data?.kpis.tool_calls_today ?? 0)} calls` }) }), _jsx("div", { className: "h-72 -ml-2", children: loading ? (_jsx("div", { className: "h-full w-full animate-pulse rounded-lg bg-muted/20" })) : (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: series, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "g-calls", x1: "0", x2: "0", y1: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "oklch(0.65 0.19 255)", stopOpacity: 0.5 }), _jsx("stop", { offset: "100%", stopColor: "oklch(0.65 0.19 255)", stopOpacity: 0 })] }), _jsxs("linearGradient", { id: "g-block", x1: "0", x2: "0", y1: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "oklch(0.65 0.23 25)", stopOpacity: 0.4 }), _jsx("stop", { offset: "100%", stopColor: "oklch(0.65 0.23 25)", stopOpacity: 0 })] })] }), _jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "oklch(0.4 0.03 260 / 25%)" }), _jsx(XAxis, { dataKey: "hour", stroke: "oklch(0.7 0.025 256)", fontSize: 11 }), _jsx(YAxis, { stroke: "oklch(0.7 0.025 256)", fontSize: 11 }), _jsx(Tooltip, { contentStyle: {
                                                    background: "oklch(0.22 0.025 260)",
                                                    border: "1px solid oklch(0.32 0.03 260 / 60%)",
                                                    borderRadius: 8,
                                                    fontSize: 12,
                                                } }), _jsx(Area, { type: "monotone", dataKey: "calls", stroke: "oklch(0.65 0.19 255)", strokeWidth: 2, fill: "url(#g-calls)" }), _jsx(Area, { type: "monotone", dataKey: "blocked", stroke: "oklch(0.65 0.23 25)", strokeWidth: 2, fill: "url(#g-block)" })] }) })) })] }), _jsxs(GlassCard, { className: "p-5", children: [_jsx(SectionHeader, { title: "Top Tools", action: _jsx("span", { className: "text-xs text-muted-foreground", children: "All time" }) }), loading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-8 animate-pulse rounded bg-muted/20" }, i))) })) : topTools.length === 0 ? (_jsx("p", { className: "py-4 text-center text-xs text-muted-foreground", children: "No tool calls recorded yet." })) : (_jsx("ul", { className: "space-y-3", children: topTools.slice(0, 8).map((t, i) => (_jsxs("li", { children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary", children: i + 1 }), _jsx("span", { className: "font-mono text-xs", children: t.name })] }), _jsx("span", { className: "text-xs text-muted-foreground", children: t.calls.toLocaleString() })] }), _jsx("div", { className: "mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/40", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all", style: { width: `${(t.calls / (topTools[0]?.calls || 1)) * 100}%` } }) })] }, t.name))) }))] })] }), _jsxs("div", { className: "mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3", children: [_jsxs(GlassCard, { className: "p-5 lg:col-span-2", children: [_jsx(SectionHeader, { title: "Security Events Timeline", action: _jsxs("span", { className: "inline-flex items-center gap-1.5 text-xs text-success", children: [_jsxs("span", { className: "relative flex h-2 w-2", children: [_jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" }), _jsx("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-success" })] }), "Live"] }) }), loading ? (_jsx("div", { className: "space-y-4", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-12 animate-pulse rounded bg-muted/20" }, i))) })) : events.length === 0 ? (_jsx("p", { className: "py-6 text-center text-xs text-muted-foreground", children: "No tool call events recorded yet. Use the Agent Console to generate activity." })) : (_jsx("ol", { className: "relative space-y-4 border-l border-border pl-6", children: events.map((e, i) => {
                                    const tone = e.severity === "critical"
                                        ? "text-destructive bg-destructive/10 ring-destructive/30"
                                        : e.severity === "warning"
                                            ? "text-warning bg-warning/10 ring-warning/30"
                                            : "text-primary bg-primary/10 ring-primary/30";
                                    return (_jsxs("li", { className: "relative", children: [_jsx("span", { className: `absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${tone}`, children: e.severity === "critical"
                                                    ? _jsx(AlertTriangle, { className: "h-3 w-3" })
                                                    : _jsx(ShieldCheck, { className: "h-3 w-3" }) }), _jsxs("div", { className: "flex flex-wrap items-baseline gap-2", children: [_jsx("span", { className: "font-mono text-xs text-muted-foreground", children: e.time }), _jsx("span", { className: "rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase", children: e.severity }), _jsx("span", { className: "text-xs text-muted-foreground", children: "\u00B7" }), _jsx("span", { className: "font-mono text-xs text-primary", children: e.agent }), _jsx("span", { className: "rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary", children: e.tool })] }), _jsx("p", { className: "mt-1 text-sm", children: e.message })] }, i));
                                }) }))] }), _jsxs(GlassCard, { className: "relative overflow-hidden p-5", children: [_jsx(SectionHeader, { title: "Threat Shield" }), _jsxs("div", { className: "flex flex-col items-center justify-center py-6", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-2xl" }), _jsxs("svg", { viewBox: "0 0 200 200", className: "relative h-44 w-44", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "shield-grad", x1: "0", x2: "0", y1: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "oklch(0.72 0.22 280)" }), _jsx("stop", { offset: "100%", stopColor: "oklch(0.65 0.19 255)" })] }) }), _jsx("circle", { cx: "100", cy: "100", r: "92", fill: "none", stroke: "oklch(0.3 0.03 260 / 40%)", strokeWidth: "2", strokeDasharray: "4 6" }), _jsx("circle", { cx: "100", cy: "100", r: "72", fill: "none", stroke: "url(#shield-grad)", strokeWidth: "2", opacity: "0.6" }), _jsx("path", { d: "M100 40 L150 60 L150 110 Q150 145 100 165 Q50 145 50 110 L50 60 Z", fill: "url(#shield-grad)", opacity: "0.15", stroke: "url(#shield-grad)", strokeWidth: "2" }), _jsx("path", { d: "M80 100 L95 115 L125 85", fill: "none", stroke: "oklch(0.72 0.19 145)", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" })] })] }), _jsx("p", { className: "mt-2 text-3xl font-bold gradient-text", children: loading ? "—" : shield.score }), _jsx("p", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: "Security Score" }), _jsx("div", { className: "mt-4 grid w-full grid-cols-3 gap-2 text-center", children: [
                                            { label: "Allowed", value: loading ? "—" : fmt(shield.allowed), cls: "text-success" },
                                            { label: "Pending", value: loading ? "—" : fmt(shield.pending), cls: "text-warning" },
                                            { label: "Blocked", value: loading ? "—" : fmt(shield.blocked), cls: "text-destructive" },
                                        ].map((s) => (_jsxs("div", { className: "rounded-md border border-border bg-card/30 py-1.5", children: [_jsx("div", { className: `text-xs font-bold ${s.cls}`, children: s.value }), _jsx("div", { className: "text-[10px] text-muted-foreground", children: s.label })] }, s.label))) })] })] })] })] }));
}
