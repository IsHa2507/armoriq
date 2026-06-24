import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/dashboard/widgets";
import { logsAPI } from "@/services/api";
import { Filter, Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Shape returned by GET /api/logs/
interface ToolCallLog {
  id: number;
  session_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  result: string | null;
  status: string;         // allowed | blocked | pending | error | executed
  policy_decision: {
    action?: string;
    rule_name?: string | null;
    rule_id?: string | null;
  } | null;
  timestamp: string;
}

// Map backend status → display result category used by the filter buttons
function resultCategory(status: string): "allowed" | "blocked" | "approval" {
  if (status === "blocked")         return "blocked";
  if (status === "pending")         return "approval";
  return "allowed";
}

const filters = ["All", "Allowed", "Blocked", "Approval Required"] as const;
type FilterType = typeof filters[number];

export function LogsPage() {
  const [logs, setLogs]           = useState<ToolCallLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [active, setActive]       = useState<FilterType>("All");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await logsAPI.getLogs(undefined, 200) as ToolCallLog[];
      // Newest first
      setLogs([...data].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
    } catch (err) {
      console.error("[Logs] Failed to load:", err);
      setError("Could not load logs from backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = logs.filter((l) => {
    if (active === "All")               return true;
    if (active === "Allowed")           return resultCategory(l.status) === "allowed";
    if (active === "Blocked")           return resultCategory(l.status) === "blocked";
    if (active === "Approval Required") return resultCategory(l.status) === "approval";
    return true;
  });

  const handleExport = () => {
    const rows = [
      ["Timestamp", "Session", "Tool", "Status", "Policy Rule"].join(","),
      ...filtered.map((l) =>
        [
          l.timestamp,
          l.session_id,
          l.tool_name,
          l.status,
          l.policy_decision?.rule_name ?? "—",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `armoriq-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActive(f)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active === f
                ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                : "border border-border bg-card/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs hover:bg-card/70 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs hover:bg-card/70"
        >
          <Download className="h-3 w-3" /> Export CSV
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Timestamp", "Session", "Tool", "Status", "Policy Rule"].map((h) => (
                <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Loading logs…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No logs found. Use the Agent Console to generate activity.
                </td>
              </tr>
            ) : (
              filtered.map((l) => {
                const cat = resultCategory(l.status);
                return (
                  <tr key={l.id} className="border-b border-border/50 transition-colors hover:bg-muted/10">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(l.timestamp).toLocaleTimeString([], {
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs max-w-[120px] truncate">
                      {l.session_id}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                        {l.tool_name}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                          cat === "allowed"
                            ? "bg-success/10 text-success ring-success/30"
                            : cat === "blocked"
                              ? "bg-destructive/15 text-destructive ring-destructive/40"
                              : "bg-warning/10 text-warning ring-warning/30",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {l.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {l.policy_decision?.rule_name ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!loading && filtered.length > 0 && (
          <div className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
            Showing {filtered.length} of {logs.length} records
          </div>
        )}
      </GlassCard>
    </>
  );
}
