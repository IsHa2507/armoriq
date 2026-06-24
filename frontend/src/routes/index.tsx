import { useState, useEffect, useCallback } from "react";
import { GlassCard, KpiCard, SectionHeader } from "@/components/dashboard/widgets";
import {
  dashboardAPI,
  type DashboardData,
  type ToolUsagePoint,
  type TopTool,
  type SecurityEvent,
} from "@/services/api";
import {
  Bot, Server, Zap, ShieldAlert, Clock, Activity,
  ShieldCheck, AlertTriangle, RefreshCw,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Format a raw number into a display string (e.g. 4821 → "4,821") */
function fmt(n: number): string {
  return n.toLocaleString();
}

// ── sub-components ────────────────────────────────────────────────────────────

function SkeletonKpi() {
  return (
    <GlassCard className="p-5 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted/40 mb-3" />
      <div className="h-8 w-20 rounded bg-muted/40 mb-2" />
      <div className="h-3 w-16 rounded bg-muted/30" />
    </GlassCard>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export function IndexRoute() {
  const [data, setData]         = useState<DashboardData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await dashboardAPI.get();
      setData(result);
    } catch (err) {
      console.error("[Dashboard] Failed to load:", err);
      setError("Could not reach backend. Is Django running on :8000?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Auto-refresh every 30 seconds
    const id = setInterval(() => void load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  // ── build KPI cards from live data ────────────────────────────────────
  const kpiCards = data
    ? [
        {
          label: "Active Sessions",
          value: fmt(data.kpis.active_sessions),
          delta: "+0",
          icon:  Bot,
          tone:  "primary" as const,
        },
        {
          label: "MCP Servers",
          value: data.kpis.mcp_servers,
          delta: "+0",
          icon:  Server,
          tone:  "success" as const,
        },
        {
          label: "Tool Calls Today",
          value: fmt(data.kpis.tool_calls_today),
          delta: data.kpi_deltas.tool_calls_today,
          icon:  Zap,
          tone:  "primary" as const,
        },
        {
          label: "Blocked Actions",
          value: fmt(data.kpis.blocked_today),
          delta: data.kpi_deltas.blocked_today,
          icon:  ShieldAlert,
          tone:  "danger" as const,
        },
        {
          label: "Pending Approvals",
          value: fmt(data.kpis.pending_approvals),
          delta: "+0",
          icon:  Clock,
          tone:  "warning" as const,
        },
        {
          label: "Uptime",
          value: `${data.kpis.uptime_pct}%`,
          delta: "0%",
          icon:  Activity,
          tone:  "success" as const,
        },
      ]
    : [];

  const series: ToolUsagePoint[]  = data?.tool_usage_series ?? [];
  const topTools: TopTool[]       = data?.top_tools ?? [];
  const events: SecurityEvent[]   = data?.security_events ?? [];
  const shield                    = data?.threat_shield ?? { score: 0, allowed: 0, blocked: 0, pending: 0 };

  return (
    <>
      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {loading ? "Loading…" : error ? "Backend unreachable" : "Live · updates every 30s"}
        </span>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)
          : kpiCards.map((k, i) => (
              <div key={k.label} style={{ animationDelay: `${i * 50}ms` }} className="animate-fade-in-up">
                <KpiCard
                  label={k.label}
                  value={k.value}
                  delta={k.delta}
                  Icon={k.icon}
                  tone={k.tone}
                />
              </div>
            ))}
      </div>

      {/* ── Tool usage chart + Top Tools ─────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2">
          <SectionHeader
            title="Tool Usage · last 24h"
            action={
              <span className="text-xs text-muted-foreground">
                {loading ? "—" : `${fmt(data?.kpis.tool_calls_today ?? 0)} calls`}
              </span>
            }
          />
          <div className="h-72 -ml-2">
            {loading ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-muted/20" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="g-calls" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.19 255)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.65 0.19 255)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-block" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.23 25)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(0.65 0.23 25)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.03 260 / 25%)" />
                  <XAxis dataKey="hour" stroke="oklch(0.7 0.025 256)" fontSize={11} />
                  <YAxis stroke="oklch(0.7 0.025 256)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.22 0.025 260)",
                      border: "1px solid oklch(0.32 0.03 260 / 60%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="calls"   stroke="oklch(0.65 0.19 255)" strokeWidth={2} fill="url(#g-calls)" />
                  <Area type="monotone" dataKey="blocked" stroke="oklch(0.65 0.23 25)"  strokeWidth={2} fill="url(#g-block)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader
            title="Top Tools"
            action={<span className="text-xs text-muted-foreground">All time</span>}
          />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted/20" />
              ))}
            </div>
          ) : topTools.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No tool calls recorded yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {topTools.slice(0, 8).map((t, i) => (
                <li key={t.name}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="font-mono text-xs">{t.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.calls.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
                      style={{ width: `${(t.calls / (topTools[0]?.calls || 1)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* ── Security timeline + Threat Shield ────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2">
          <SectionHeader
            title="Security Events Timeline"
            action={
              <span className="inline-flex items-center gap-1.5 text-xs text-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Live
              </span>
            }
          />
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted/20" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No tool call events recorded yet. Use the Agent Console to generate activity.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {events.map((e, i) => {
                const tone =
                  e.severity === "critical"
                    ? "text-destructive bg-destructive/10 ring-destructive/30"
                    : e.severity === "warning"
                      ? "text-warning bg-warning/10 ring-warning/30"
                      : "text-primary bg-primary/10 ring-primary/30";
                return (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${tone}`}
                    >
                      {e.severity === "critical"
                        ? <AlertTriangle className="h-3 w-3" />
                        : <ShieldCheck className="h-3 w-3" />}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{e.time}</span>
                      <span className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase">
                        {e.severity}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="font-mono text-xs text-primary">{e.agent}</span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                        {e.tool}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{e.message}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </GlassCard>

        {/* Threat Shield */}
        <GlassCard className="relative overflow-hidden p-5">
          <SectionHeader title="Threat Shield" />
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-2xl" />
              <svg viewBox="0 0 200 200" className="relative h-44 w-44">
                <defs>
                  <linearGradient id="shield-grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.22 280)" />
                    <stop offset="100%" stopColor="oklch(0.65 0.19 255)" />
                  </linearGradient>
                </defs>
                <circle cx="100" cy="100" r="92" fill="none" stroke="oklch(0.3 0.03 260 / 40%)" strokeWidth="2" strokeDasharray="4 6" />
                <circle cx="100" cy="100" r="72" fill="none" stroke="url(#shield-grad)" strokeWidth="2" opacity="0.6" />
                <path
                  d="M100 40 L150 60 L150 110 Q150 145 100 165 Q50 145 50 110 L50 60 Z"
                  fill="url(#shield-grad)"
                  opacity="0.15"
                  stroke="url(#shield-grad)"
                  strokeWidth="2"
                />
                <path
                  d="M80 100 L95 115 L125 85"
                  fill="none"
                  stroke="oklch(0.72 0.19 145)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold gradient-text">
              {loading ? "—" : shield.score}
            </p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Security Score</p>
            <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
              {[
                { label: "Allowed", value: loading ? "—" : fmt(shield.allowed), cls: "text-success" },
                { label: "Pending", value: loading ? "—" : fmt(shield.pending), cls: "text-warning" },
                { label: "Blocked", value: loading ? "—" : fmt(shield.blocked), cls: "text-destructive" },
              ].map((s) => (
                <div key={s.label} className="rounded-md border border-border bg-card/30 py-1.5">
                  <div className={`text-xs font-bold ${s.cls}`}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
