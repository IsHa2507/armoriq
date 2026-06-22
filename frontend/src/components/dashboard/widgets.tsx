import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Re-exports from individual dashboard components
export { StatsCard } from "./StatsCard";
export { ActivityFeed } from "./ActivityFeed";
export { MCPServerCard } from "./MCPServerCard";
export { RulesTable } from "./RulesTable";
export { ConversationPanel } from "./ConversationPanel";

export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("glass-card rounded-xl", className)}>{children}</div>;
}

const toneMap = {
  primary: "text-primary bg-primary/10 ring-primary/20",
  success: "text-success bg-success/10 ring-success/20",
  warning: "text-warning bg-warning/10 ring-warning/20",
  danger: "text-destructive bg-destructive/10 ring-destructive/20",
} as const;

export function KpiCard({
  label, value, delta, Icon, tone = "primary",
}: { label: string; value: string | number; delta: string; Icon: LucideIcon; tone?: keyof typeof toneMap }) {
  const positive = delta.startsWith("+");
  return (
    <GlassCard className="group relative overflow-hidden p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", positive ? "text-success" : "text-destructive")}>
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta} vs last week
          </div>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg ring-1", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </GlassCard>
  );
}

export function StatusDot({ status }: { status: "online" | "offline" | "warning" }) {
  const cls =
    status === "online" ? "bg-success" :
    status === "warning" ? "bg-warning" : "bg-muted-foreground";
  return (
    <span className="relative inline-flex h-2 w-2">
      {status === "online" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", cls)} />
    </span>
  );
}

const riskMap = {
  low: "text-success bg-success/10 ring-success/30",
  medium: "text-warning bg-warning/10 ring-warning/30",
  high: "text-orange-400 bg-orange-500/10 ring-orange-500/30",
  critical: "text-destructive bg-destructive/15 ring-destructive/40",
} as const;

export function RiskBadge({ level }: { level: keyof typeof riskMap }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset", riskMap[level])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level}
    </span>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {action}
    </div>
  );
}
