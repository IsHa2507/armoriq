import { GlassCard, StatusDot, RiskBadge } from "@/components/dashboard/widgets";
import { mcpServers } from "@/lib/mock/data";
import { Plus, RefreshCw, Power, Radio, Terminal, Wrench } from "lucide-react";
export function MCPServersPage() {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-glow px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_-4px_var(--color-primary)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" /> Connect Server
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/40 px-4 py-2 text-sm font-medium hover:bg-card/70"
        >
          <RefreshCw className="h-4 w-4" /> Refresh Discovery
        </button>
      </div>

      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Server", "Status", "Transport", "Tools", "Risk", "Last Heartbeat", "Actions"].map((h, i) => (
                <th key={h} className={`px-5 py-3 font-medium ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mcpServers.map((s, i) => (
              <tr key={s.name} className="border-b border-border/50 transition-colors hover:bg-muted/10" style={{ animationDelay: `${i * 30}ms` }}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20">
                      <Radio className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-mono text-sm font-semibold">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">mcp://internal/{s.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-2 text-xs capitalize">
                    <StatusDot status={s.status as "online" | "offline" | "warning"} />
                    {s.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5 font-mono text-[11px]">
                    {s.transport === "SSE" ? <Radio className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                    {s.transport}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                    {s.tools}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <RiskBadge level={s.risk as "low" | "medium" | "high"} />
                </td>
                <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{s.lastHeartbeat}</td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
                  >
                    <Power className="h-3 w-3" /> Disconnect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Live Tool Discovery</h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Streaming
            </span>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {[
              "github.search_repos", "github.create_issue", "github.list_prs",
              "postgres.execute_sql", "postgres.list_tables", "filesystem.read_file",
            ].map((t, i) => (
              <div
                key={t}
                className="flex items-center justify-between rounded-md border border-border/60 bg-card/30 px-3 py-2 animate-fade-in-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">TOOL</span>
                  <span>{t}</span>
                </div>
                <span className="text-[10px] text-success">discovered</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Agent Health Monitor</h2>
          <div className="space-y-3">
            {[
              { name: "research-bot", latency: 124, health: 98 },
              { name: "ops-agent",    latency: 89,  health: 96 },
              { name: "finance-bot",  latency: 210, health: 88 },
              { name: "data-agent",   latency: 342, health: 72 },
            ].map((a) => (
              <div key={a.name} className="rounded-lg border border-border bg-card/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.latency}ms · health {a.health}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className={`h-full rounded-full ${a.health > 90 ? "bg-success" : a.health > 75 ? "bg-warning" : "bg-destructive"}`}
                    style={{ width: `${a.health}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
