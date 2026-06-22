import { useState } from "react";
import { GlassCard, SectionHeader } from "@/components/dashboard/widgets";
import { guardrails } from "@/lib/mock/data";
import { Plus, Ban, UserCheck, ShieldCheck, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        on ? "bg-primary shadow-[0_0_12px_-2px_var(--color-primary)]" : "bg-muted/60",
      )}
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition", on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

type Guardrail = typeof guardrails[number];

export function GuardrailsPage() {
  const [rules, setRules] = useState<Guardrail[]>(guardrails);

  const ruleTypes = [
    { icon: Ban,        label: "Block Tool",        color: "text-destructive bg-destructive/10" },
    { icon: UserCheck,  label: "Require Approval",  color: "text-warning bg-warning/10"         },
    { icon: ShieldCheck,label: "Input Validation",  color: "text-primary bg-primary/10"         },
    { icon: Gauge,      label: "Token Budget",      color: "text-success bg-success/10"         },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ruleTypes.map((r) => (
          <button key={r.label} type="button" className="glass-card rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40">
            <div className={cn("mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg", r.color)}>
              <r.icon className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold">{r.label}</div>
            <div className="text-xs text-muted-foreground">Add new rule</div>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2">
          <SectionHeader
            title="Active Policies"
            action={
              <button type="button" className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/25">
                <Plus className="h-3 w-3" /> New Rule
              </button>
            }
          />
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card/30 p-3 transition-colors hover:border-primary/30">
                <span className="font-mono text-[10px] text-muted-foreground">{r.id}</span>
                <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-primary">IF</span>
                  <span className="font-mono">{r.condition}</span>
                  <span className="rounded bg-warning/10 px-2 py-0.5 font-mono text-warning">THEN</span>
                  <span className={cn(
                    "rounded px-2 py-0.5 font-mono font-semibold",
                    r.action === "Block"            ? "bg-destructive/15 text-destructive" :
                    r.action === "Require Approval" ? "bg-warning/15 text-warning" :
                                                      "bg-primary/15 text-primary",
                  )}>
                    {r.action}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{r.hits} hits</span>
                <Toggle
                  on={r.enabled}
                  onChange={() =>
                    setRules((prev) => prev.map((x) => x.id === r.id ? { ...x, enabled: !x.enabled } : x))
                  }
                />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionHeader title="Rule Builder" />
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">When</label>
              <select className="mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none">
                <option>Tool name equals</option>
                <option>Parameter contains</option>
                <option>Token usage exceeds</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 font-mono text-sm focus:border-primary/60 focus:outline-none"
                defaultValue="delete_file"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Action</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {["Block", "Approve", "Sanitize", "Log"].map((a, i) => (
                  <button
                    key={a}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs font-medium",
                      i === 0
                        ? "border-destructive/40 bg-destructive/15 text-destructive"
                        : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="mt-2 w-full rounded-md bg-gradient-to-r from-primary to-primary-glow py-2 text-sm font-semibold text-white shadow-[0_0_16px_-4px_var(--color-primary)]"
            >
              Deploy Rule
            </button>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
