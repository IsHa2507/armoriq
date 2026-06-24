import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { GlassCard, StatusDot, RiskBadge } from "@/components/dashboard/widgets";
import { mcpAPI } from "@/services/api";
import { RefreshCw, Radio, Terminal, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
// Map server name → risk level for RiskBadge
function riskForServer(name) {
    if (/filesystem|fs/i.test(name))
        return "high";
    if (/notes|data/i.test(name))
        return "medium";
    return "low";
}
function heartbeatLabel(iso) {
    if (!iso)
        return "never";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 5000)
        return "just now";
    if (diff < 60000)
        return `${Math.round(diff / 1000)}s ago`;
    return `${Math.round(diff / 60000)}m ago`;
}
export function MCPServersPage() {
    const [servers, setServers] = useState({});
    const [tools, setTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [expandedServer, setExpanded] = useState(null);
    // ── load server status and tool list from backend ──────────────────────────
    const load = useCallback(async () => {
        setError(null);
        try {
            const [statusData, toolsData] = await Promise.all([
                mcpAPI.getServers(),
                mcpAPI.getTools(),
            ]);
            setServers(statusData);
            setTools(Array.isArray(toolsData) ? toolsData : []);
        }
        catch (err) {
            console.error("[MCPServers] Load failed:", err);
            setError("Could not reach backend. Is Django running on localhost:8000?");
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await mcpAPI.refreshTools();
            await load();
            console.log("[MCPServers] Tool refresh completed.");
        }
        catch (err) {
            console.error("[MCPServers] Refresh failed:", err);
            setError(`Refresh failed: ${err.message}`);
        }
        finally {
            setRefreshing(false);
        }
    };
    const serverEntries = Object.entries(servers);
    const totalTools = serverEntries.reduce((s, [, v]) => s + (v.tool_count ?? 0), 0);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-2", children: [_jsxs("span", { className: "text-xs text-muted-foreground", children: [serverEntries.length, " server", serverEntries.length !== 1 ? "s" : "", " registered", " · ", totalTools, " tools discovered"] }), _jsx("div", { className: "ml-auto flex gap-2", children: _jsxs("button", { type: "button", onClick: () => void handleRefresh(), disabled: refreshing || loading, className: "inline-flex items-center gap-2 rounded-lg border border-border bg-card/40 px-4 py-2 text-sm font-medium hover:bg-card/70 disabled:opacity-50", children: [_jsx(RefreshCw, { className: cn("h-4 w-4", refreshing && "animate-spin") }), refreshing ? "Refreshing…" : "Refresh Discovery"] }) })] }), error && (_jsx("div", { className: "mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive", children: error })), _jsx(GlassCard, { className: "overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground", children: _jsx("tr", { children: ["Server", "Status", "Transport", "Tools", "Risk", "Last Heartbeat", ""].map((h, i) => (_jsx("th", { className: `px-5 py-3 font-medium ${i === 6 ? "text-right" : "text-left"}`, children: h }, h + i))) }) }), _jsx("tbody", { children: loading ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-5 py-10 text-center text-sm text-muted-foreground", children: "Loading servers\u2026" }) })) : serverEntries.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-5 py-10 text-center text-sm text-muted-foreground", children: "No servers registered. Check the Django console for startup errors." }) })) : (serverEntries.map(([name, srv], i) => (_jsxs(_Fragment, { children: [_jsxs("tr", { className: "border-b border-border/50 transition-colors hover:bg-muted/10 cursor-pointer", style: { animationDelay: `${i * 30}ms` }, onClick: () => setExpanded(expandedServer === name ? null : name), children: [_jsx("td", { className: "px-5 py-4", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20", children: _jsx(Radio, { className: "h-4 w-4 text-primary" }) }), _jsxs("div", { children: [_jsx("div", { className: "font-mono text-sm font-semibold", children: name }), _jsx("div", { className: "text-[10px] text-muted-foreground", children: srv.server_info
                                                                        ? `${String(srv.server_info.name ?? name)} v${String(srv.server_info.version ?? "1.0")}`
                                                                        : "mcp://stdio" })] })] }) }), _jsx("td", { className: "px-5 py-4", children: _jsxs("span", { className: "inline-flex items-center gap-2 text-xs capitalize", children: [_jsx(StatusDot, { status: srv.status === "connected" ? "online" : "offline" }), srv.status === "connected" ? "online" : "error"] }) }), _jsx("td", { className: "px-5 py-4", children: _jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5 font-mono text-[11px]", children: [_jsx(Terminal, { className: "h-3 w-3" }), srv.transport ?? "STDIO"] }) }), _jsx("td", { className: "px-5 py-4", children: _jsxs("span", { className: "inline-flex items-center gap-1.5 text-sm", children: [_jsx(Wrench, { className: "h-3.5 w-3.5 text-muted-foreground" }), srv.tool_count] }) }), _jsx("td", { className: "px-5 py-4", children: _jsx(RiskBadge, { level: riskForServer(name) }) }), _jsx("td", { className: "px-5 py-4 font-mono text-xs text-muted-foreground", children: heartbeatLabel(srv.last_heartbeat) }), _jsx("td", { className: "px-5 py-4 text-right", children: _jsx("button", { type: "button", className: "inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs hover:bg-muted/20", onClick: (e) => {
                                                        e.stopPropagation();
                                                        setExpanded(expandedServer === name ? null : name);
                                                    }, children: expandedServer === name
                                                        ? _jsxs(_Fragment, { children: [_jsx(ChevronDown, { className: "h-3 w-3" }), " Hide tools"] })
                                                        : _jsxs(_Fragment, { children: [_jsx(ChevronRight, { className: "h-3 w-3" }), " Show tools"] }) }) })] }, name), expandedServer === name && (_jsx("tr", { className: "bg-muted/5", children: _jsx("td", { colSpan: 7, className: "px-5 pb-4 pt-2", children: srv.error ? (_jsxs("p", { className: "text-xs text-destructive", children: ["Error: ", srv.error] })) : srv.tools.length === 0 ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "No tools discovered." })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: srv.tools.map((t) => (_jsx("span", { className: "rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary", children: t }, t))) })) }) }, name + "-tools"))] })))) })] }) }), _jsxs("div", { className: "mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2", children: [_jsxs(GlassCard, { className: "p-5", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "Live Tool Discovery" }), _jsxs("span", { className: "inline-flex items-center gap-1.5 text-xs text-success", children: [_jsxs("span", { className: "relative flex h-2 w-2", children: [_jsx("span", { className: "absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" }), _jsx("span", { className: "relative inline-flex h-2 w-2 rounded-full bg-success" })] }), tools.length, " tools"] })] }), _jsx("div", { className: "max-h-64 space-y-1.5 overflow-y-auto", children: loading ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "Loading\u2026" })) : tools.length === 0 ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "No tools discovered." })) : (tools.map((t, i) => (_jsxs("div", { className: "flex items-center justify-between rounded-md border border-border/60 bg-card/30 px-3 py-2 animate-fade-in-up", style: { animationDelay: `${i * 40}ms` }, children: [_jsxs("div", { className: "flex items-center gap-2 font-mono text-xs", children: [_jsx("span", { className: "rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary", children: "TOOL" }), _jsx("span", { className: "font-semibold", children: String(t.name) }), _jsxs("span", { className: "text-muted-foreground", children: ["\u2192 ", String(t.server)] })] }), _jsx("span", { className: "text-[10px] text-success", children: "discovered" })] }, String(t.name))))) })] }), _jsxs(GlassCard, { className: "p-5", children: [_jsx("h2", { className: "mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "Server Health" }), _jsx("div", { className: "space-y-3", children: loading ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "Loading\u2026" })) : serverEntries.length === 0 ? (_jsx("p", { className: "text-xs text-muted-foreground", children: "No servers registered." })) : (serverEntries.map(([name, srv]) => {
                                    const health = srv.status === "connected" ? 100 : 0;
                                    return (_jsxs("div", { className: "rounded-lg border border-border bg-card/30 p-3", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "font-mono", children: name }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [srv.tool_count, " tools \u00B7 ", srv.status === "connected" ? "healthy" : "error"] })] }), _jsx("div", { className: "mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40", children: _jsx("div", { className: `h-full rounded-full ${health === 100 ? "bg-success" : "bg-destructive"}`, style: { width: `${health}%` } }) }), srv.error && (_jsx("p", { className: "mt-1 text-[10px] text-destructive", children: srv.error }))] }, name));
                                })) })] })] })] }));
}
