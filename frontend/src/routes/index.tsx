import { GlassCard, KpiCard, SectionHeader } from "@/components/dashboard/widgets";
import { kpis, toolUsageSeries, topTools, securityEvents } from "@/lib/mock/data";
import { Bot, Server, Zap, ShieldAlert, Clock, Activity, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = { Bot, Server, Zap, ShieldAlert, Clock, Activity };

export function IndexRoute() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <div key={k.label} style={{ animationDelay: `${i * 50}ms` }} className="animate-fade-in-up">
            <KpiCard
              label={k.label}
              value={k.value}
              delta={k.delta}
              Icon={iconMap[k.icon]}
              tone={k.tone as "primary" | "success" | "warning" | "danger"}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2">
          <SectionHeader
            title="Tool Usage · last 24h"
            action={<span className="text-xs text-muted-foreground">Calls vs Blocked</span>}
          />
          <div className="h-72 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={toolUsageSeries}>
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
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader title="Top Tools" action={<span className="text-xs text-muted-foreground">7d</span>} />
          <ul className="space-y-3">
            {topTools.map((t, i) => (
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
                    style={{ width: `${(t.calls / topTools[0].calls) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

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
          <ol className="relative space-y-4 border-l border-border pl-6">
            {securityEvents.map((e, i) => {
              const tone =
                e.severity === "critical" ? "text-destructive bg-destructive/10 ring-destructive/30" :
                e.severity === "warning"  ? "text-warning bg-warning/10 ring-warning/30" :
                                            "text-primary bg-primary/10 ring-primary/30";
              return (
                <li key={i} className="relative">
                  <span className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${tone}`}>
                    {e.severity === "critical"
                      ? <AlertTriangle className="h-3 w-3" />
                      : <ShieldCheck className="h-3 w-3" />}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{e.time}</span>
                    <span className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] uppercase">{e.severity}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="font-mono text-xs text-primary">{e.agent}</span>
                  </div>
                  <p className="mt-1 text-sm">{e.message}</p>
                </li>
              );
            })}
          </ol>
        </GlassCard>

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
                <path d="M100 40 L150 60 L150 110 Q150 145 100 165 Q50 145 50 110 L50 60 Z"
                  fill="url(#shield-grad)" opacity="0.15" stroke="url(#shield-grad)" strokeWidth="2" />
                <path d="M80 100 L95 115 L125 85" fill="none" stroke="oklch(0.72 0.19 145)"
                  strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold gradient-text">94</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Security Score</p>
            <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
              {[
                { label: "Allowed", value: "142", cls: "text-success" },
                { label: "Pending", value: "6",   cls: "text-warning" },
                { label: "Blocked", value: "47",  cls: "text-destructive" },
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
