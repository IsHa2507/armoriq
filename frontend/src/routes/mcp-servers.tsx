import { useState, useEffect, useCallback } from "react";
import { GlassCard, StatusDot, RiskBadge } from "@/components/dashboard/widgets";
import { mcpAPI } from "@/services/api";
import { Plus, RefreshCw, Power, Radio, Terminal, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── types inferred from the backend's get_server_status() response ────────────
interface ServerStatus {
  status: "connected" | "error";
  transport: string;
  tool_count: number;
  tools: string[];
  registered_at: string | null;
  last_heartbeat: string | null;
  server_info: Record<string, unknown> | null;
  command: string | null;
  error: string | null;
}

// Map server name → risk level for RiskBadge
function riskForServer(name: string): "low" | "medium" | "high" {
  if (/filesystem|fs/i.test(name)) return "high";
  if (/notes|data/i.test(name)) return "medium";
  return "low";
}

function heartbeatLabel(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  return `${Math.round(diff / 60000)}m ago`;
}

export function MCPServersPage() {
  const [servers, setServers]             = useState<Record<string, ServerStatus>>({});
  const [tools, setTools]                 = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [expandedServer, setExpanded]     = useState<string | null>(null);

  // ── load server status and tool list from backend ──────────────────────────
  const load = useCallback(async () => {
    setError(null);
    try {
      const [statusData, toolsData] = await Promise.all([
        mcpAPI.getServers() as Promise<Record<string, ServerStatus>>,
        mcpAPI.getTools()   as Promise<Record<string, unknown>[]>,
      ]);
      setServers(statusData);
      setTools(Array.isArray(toolsData) ? toolsData : []);
    } catch (err) {
      console.error("[MCPServers] Load failed:", err);
      setError("Could not reach backend. Is Django running on localhost:8000?");
    } finally {
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
    } catch (err) {
      console.error("[MCPServers] Refresh failed:", err);
      setError(`Refresh failed: ${(err as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const serverEntries = Object.entries(servers);
  const totalTools    = serverEntries.reduce((s, [, v]) => s + (v.tool_count ?? 0), 0);

  return (
    <>
      {/* action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {serverEntries.length} server{serverEntries.length !== 1 ? "s" : ""} registered
          {" · "}
          {totalTools} tools discovered
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/40 px-4 py-2 text-sm font-medium hover:bg-card/70 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh Discovery"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* server table */}
      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Server", "Status", "Transport", "Tools", "Risk", "Last Heartbeat", ""].map((h, i) => (
                <th key={h + i} className={`px-5 py-3 font-medium ${i === 6 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Loading servers…
                </td>
              </tr>
            ) : serverEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No servers registered. Check the Django console for startup errors.
                </td>
              </tr>
            ) : (
              serverEntries.map(([name, srv], i) => (
                <>
                  <tr
                    key={name}
                    className="border-b border-border/50 transition-colors hover:bg-muted/10 cursor-pointer"
                    style={{ animationDelay: `${i * 30}ms` }}
                    onClick={() => setExpanded(expandedServer === name ? null : name)}
                  >
                    {/* server name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20">
                          <Radio className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-mono text-sm font-semibold">{name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {srv.server_info
                              ? `${String(srv.server_info.name ?? name)} v${String(srv.server_info.version ?? "1.0")}`
                              : "mcp://stdio"}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* status */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 text-xs capitalize">
                        <StatusDot status={srv.status === "connected" ? "online" : "offline"} />
                        {srv.status === "connected" ? "online" : "error"}
                      </span>
                    </td>
                    {/* transport */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5 font-mono text-[11px]">
                        <Terminal className="h-3 w-3" />
                        {srv.transport ?? "STDIO"}
                      </span>
                    </td>
                    {/* tool count */}
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        {srv.tool_count}
                      </span>
                    </td>
                    {/* risk */}
                    <td className="px-5 py-4">
                      <RiskBadge level={riskForServer(name)} />
                    </td>
                    {/* heartbeat */}
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                      {heartbeatLabel(srv.last_heartbeat)}
                    </td>
                    {/* expand toggle */}
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs hover:bg-muted/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(expandedServer === name ? null : name);
                        }}
                      >
                        {expandedServer === name
                          ? <><ChevronDown className="h-3 w-3" /> Hide tools</>
                          : <><ChevronRight className="h-3 w-3" /> Show tools</>}
                      </button>
                    </td>
                  </tr>

                  {/* expanded tools row */}
                  {expandedServer === name && (
                    <tr key={name + "-tools"} className="bg-muted/5">
                      <td colSpan={7} className="px-5 pb-4 pt-2">
                        {srv.error ? (
                          <p className="text-xs text-destructive">Error: {srv.error}</p>
                        ) : srv.tools.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No tools discovered.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {srv.tools.map((t) => (
                              <span
                                key={t}
                                className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </GlassCard>

      {/* tool discovery feed + health monitor */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* live tool list from backend */}
        <GlassCard className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Live Tool Discovery
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              {tools.length} tools
            </span>
          </div>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : tools.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tools discovered.</p>
            ) : (
              tools.map((t, i) => (
                <div
                  key={String(t.name)}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-card/30 px-3 py-2 animate-fade-in-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      TOOL
                    </span>
                    <span className="font-semibold">{String(t.name)}</span>
                    <span className="text-muted-foreground">→ {String(t.server)}</span>
                  </div>
                  <span className="text-[10px] text-success">discovered</span>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* per-server health */}
        <GlassCard className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Server Health
          </h2>
          <div className="space-y-3">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : serverEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No servers registered.</p>
            ) : (
              serverEntries.map(([name, srv]) => {
                const health = srv.status === "connected" ? 100 : 0;
                return (
                  <div key={name} className="rounded-lg border border-border bg-card/30 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        {srv.tool_count} tools · {srv.status === "connected" ? "healthy" : "error"}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div
                        className={`h-full rounded-full ${health === 100 ? "bg-success" : "bg-destructive"}`}
                        style={{ width: `${health}%` }}
                      />
                    </div>
                    {srv.error && (
                      <p className="mt-1 text-[10px] text-destructive">{srv.error}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
