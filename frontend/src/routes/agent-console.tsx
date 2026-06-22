import { GlassCard, RiskBadge } from "@/components/dashboard/widgets";
import { agentTimeline } from "@/lib/mock/data";
import { Bot, User, Send, Wrench, ShieldCheck, Zap, AlertTriangle, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const iconForPhase: Record<string, LucideIcon> = {
  "User Prompt":      User,
  "Tool Selected":    Wrench,
  "Policy Evaluation": ShieldCheck,
  "Tool Execution":   Zap,
  "Final Response":   Bot,
};

export function AgentConsolePage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <GlassCard className="p-5 lg:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow">
              <Bot className="h-4 w-4 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-card" />
            </div>
            <div>
              <div className="text-sm font-semibold">research-bot</div>
              <div className="text-[10px] text-muted-foreground font-mono">gpt-4o · postgres-mcp · github-mcp</div>
            </div>
          </div>
          <RiskBadge level="medium" />
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
              <User className="h-4 w-4" />
            </div>
            <div className="rounded-lg rounded-tl-none border border-border bg-card/40 px-3 py-2 text-sm">
              Find all users created in the last 30 days and email a summary to the ops team.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1 rounded-lg rounded-tl-none border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              I'll query the users table and prepare a summary email. Awaiting approval for the email send step (REQ-9821).
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card/40 p-2">
          <input
            placeholder="Send a follow-up message…"
            className="flex-1 bg-transparent px-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <button className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-glow px-3 py-1.5 text-xs font-semibold text-white">
            <Send className="h-3.5 w-3.5" /> Send
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reasoning Timeline</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live
          </span>
        </div>
        <ol className="relative space-y-3 border-l border-border pl-6">
          {agentTimeline.map((step, i) => {
            const Icon = iconForPhase[step.phase] ?? Bot;
            const tone =
              step.status === "warning" ? "bg-warning/20 text-warning ring-warning/40" :
              step.status === "pending" ? "bg-muted/30 text-muted-foreground ring-border animate-pulse" :
                                          "bg-success/20 text-success ring-success/40";
            return (
              <li key={i} className="relative animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                <span className={cn("absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background", tone)}>
                  <Icon className="h-3 w-3" />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{step.phase}</span>
                  {step.status === "warning" && (
                    <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      <AlertTriangle className="h-2.5 w-2.5" /> blocked
                    </span>
                  )}
                  {step.status === "done"    && <Check className="h-3 w-3 text-success" />}
                  {step.status === "pending" && <Clock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.content}</p>
              </li>
            );
          })}
        </ol>
      </GlassCard>
    </div>
  );
}
