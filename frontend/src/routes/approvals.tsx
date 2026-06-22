import { GlassCard, RiskBadge } from "@/components/dashboard/widgets";
import { approvals } from "@/lib/mock/data";
import { Check, X, ArrowRight, GitBranch } from "lucide-react";

export function ApprovalsPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <GlassCard className="p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pending Queue</h2>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            {approvals.length} pending
          </span>
        </div>
        <div className="space-y-3">
          {approvals.map((a, i) => (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-card/30 p-4 transition-colors hover:border-primary/30 animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-semibold text-primary">{a.id}</span>
                <RiskBadge level={a.risk as "high" | "critical" | "medium"} />
                <span className="ml-auto text-[10px] text-muted-foreground">{a.time}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="text-muted-foreground">{a.agent}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">{a.tool}</span>
              </div>
              <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-background/50 p-2 font-mono text-[11px] text-muted-foreground">
                {a.params}
              </pre>
              <div className="mt-3 flex gap-2">
                <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-success/15 px-3 py-1.5 text-xs font-semibold text-success ring-1 ring-success/30 hover:bg-success/25">
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive ring-1 ring-destructive/30 hover:bg-destructive/25">
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Approval Workflow</h2>
        <div className="space-y-2 text-xs">
          {[
            { step: "Agent invokes tool",  state: "done"    },
            { step: "Guardrail evaluation", state: "done"   },
            { step: "Risk scoring",         state: "done"   },
            { step: "Human review",         state: "active" },
            { step: "Action executed",      state: "pending"},
            { step: "Audit logged",         state: "pending"},
          ].map((s, i, arr) => (
            <div key={s.step} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.state === "done"   ? "bg-success/20 text-success ring-1 ring-success/40" :
                    s.state === "active" ? "bg-primary/20 text-primary ring-1 ring-primary/40 animate-pulse" :
                                          "bg-muted/30 text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {s.state === "done" ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                {i < arr.length - 1 && (
                  <div className={`h-6 w-px ${s.state === "done" ? "bg-success/40" : "bg-border"}`} />
                )}
              </div>
              <span className={s.state === "pending" ? "text-muted-foreground" : ""}>{s.step}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg border border-border bg-card/30 p-3">
          <div className="flex items-center gap-2 text-xs">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">SLA: 5 min</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Median response time today: 47s</p>
        </div>
      </GlassCard>
    </div>
  );
}
