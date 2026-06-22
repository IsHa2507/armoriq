import { useState } from "react";
import { GlassCard } from "@/components/dashboard/widgets";
import { activityLogs } from "@/lib/mock/data";
import { Filter, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityLog = typeof activityLogs[number];

const filters = ["All", "Allowed", "Blocked", "Approval Required"] as const;
type Filter = typeof filters[number];

export function LogsPage() {
  const [active, setActive] = useState<Filter>("All");

  const filtered = activityLogs.filter((l: ActivityLog) => {
    if (active === "All")              return true;
    if (active === "Allowed")          return l.result === "allowed";
    if (active === "Blocked")          return l.result === "blocked";
    if (active === "Approval Required") return l.result === "approval";
    return true;
  });

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
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs hover:bg-card/70"
        >
          <Download className="h-3 w-3" /> Export CSV
        </button>
      </div>

      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {["Timestamp", "Agent", "Tool", "Action", "Result", "Policy"].map((h) => (
                <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={i} className="border-b border-border/50 transition-colors hover:bg-muted/10">
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{l.ts}</td>
                <td className="px-5 py-3 font-mono text-xs">{l.agent}</td>
                <td className="px-5 py-3">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">{l.tool}</span>
                </td>
                <td className="px-5 py-3 text-xs">{l.action}</td>
                <td className="px-5 py-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                    l.result === "allowed"  ? "bg-success/10 text-success ring-success/30" :
                    l.result === "blocked"  ? "bg-destructive/15 text-destructive ring-destructive/40" :
                                              "bg-warning/10 text-warning ring-warning/30",
                  )}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {l.result}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{l.decision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </>
  );
}
