import { useState, useEffect, useCallback } from "react";
import { GlassCard, RiskBadge } from "@/components/dashboard/widgets";
import { approvalsAPI, type BackendApproval } from "@/services/api";
import { Check, X, ArrowRight, GitBranch, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Derive a risk level from the tool name so RiskBadge gets something useful.
function riskForTool(toolName: string): "high" | "critical" | "medium" | "low" {
  if (/delete|drop|destroy|remove/i.test(toolName)) return "critical";
  if (/create|write|update|execute|send/i.test(toolName)) return "high";
  if (/read|get|list|search/i.test(toolName)) return "medium";
  return "low";
}

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<BackendApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null); // approval_id being processed
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  // ── load real pending approvals from backend ─────────────────────────────
  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await approvalsAPI.getAll();
      // Show only pending ones in the queue; approved/rejected shown as resolved.
      setApprovals(data);
    } catch (err) {
      console.error("[Approvals] Failed to load:", err);
      setError("Could not load approvals from backend. Is Django running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  // ── approve ───────────────────────────────────────────────────────────────
  const handleApprove = async (approvalId: string, toolName: string) => {
    setActing(approvalId);
    setFeedback(null);
    try {
      await approvalsAPI.approve(approvalId);
      console.log(`[Approvals] Approved ${approvalId} → tool ${toolName} executed.`);
      setFeedback({ id: approvalId, ok: true, msg: `Tool '${toolName}' approved and executed.` });
      // Remove from pending list
      setApprovals((prev) => prev.filter((a) => a.approval_id !== approvalId));
    } catch (err) {
      console.error("[Approvals] Approve failed:", err);
      setFeedback({ id: approvalId, ok: false, msg: `Approve failed: ${(err as Error).message}` });
    } finally {
      setActing(null);
    }
  };

  // ── reject ────────────────────────────────────────────────────────────────
  const handleReject = async (approvalId: string, toolName: string) => {
    setActing(approvalId);
    setFeedback(null);
    try {
      await approvalsAPI.reject(approvalId, "Rejected by human reviewer.");
      console.log(`[Approvals] Rejected ${approvalId} → tool ${toolName} NOT executed.`);
      setFeedback({ id: approvalId, ok: true, msg: `Tool '${toolName}' rejected. It will not execute.` });
      setApprovals((prev) => prev.filter((a) => a.approval_id !== approvalId));
    } catch (err) {
      console.error("[Approvals] Reject failed:", err);
      setFeedback({ id: approvalId, ok: false, msg: `Reject failed: ${(err as Error).message}` });
    } finally {
      setActing(null);
    }
  };

  const pending = approvals.filter((a) => a.status === "pending");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <GlassCard className="p-5 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pending Queue
          </h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              {pending.length} pending
            </span>
            <button
              type="button"
              onClick={() => void loadApprovals()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* global feedback banner */}
        {feedback && (
          <div
            className={cn(
              "mb-3 rounded-md px-3 py-2 text-xs font-medium",
              feedback.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {feedback.msg}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading approvals…</p>
        ) : pending.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No pending approvals. Trigger a REQUIRE_APPROVAL rule from the Agent Console to see entries here.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((a, i) => {
              const isActing = acting === a.approval_id;
              return (
                <div
                  key={a.approval_id}
                  className="rounded-lg border border-border bg-card/30 p-4 transition-colors hover:border-primary/30 animate-fade-in-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {a.approval_id.slice(0, 8)}…
                    </span>
                    <RiskBadge level={riskForTool(a.tool_name)} />
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="text-muted-foreground">{a.session_id}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">
                      {a.tool_name}
                    </span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-background/50 p-2 font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(a.arguments, null, 2)}
                  </pre>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleApprove(a.approval_id, a.tool_name)}
                      disabled={isActing}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-success/15 px-3 py-1.5 text-xs font-semibold text-success ring-1 ring-success/30 hover:bg-success/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isActing ? "Processing…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReject(a.approval_id, a.tool_name)}
                      disabled={isActing}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive ring-1 ring-destructive/30 hover:bg-destructive/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-3.5 w-3.5" />
                      {isActing ? "Processing…" : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Approval Workflow
        </h2>
        <div className="space-y-2 text-xs">
          {[
            { step: "Agent invokes tool",   state: "done"    },
            { step: "Guardrail evaluation", state: "done"    },
            { step: "Risk scoring",         state: "done"    },
            { step: "Human review",         state: "active"  },
            { step: "Action executed",      state: "pending" },
            { step: "Audit logged",         state: "pending" },
          ].map((s, i, arr) => (
            <div key={s.step} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.state === "done"
                      ? "bg-success/20 text-success ring-1 ring-success/40"
                      : s.state === "active"
                        ? "bg-primary/20 text-primary ring-1 ring-primary/40 animate-pulse"
                        : "bg-muted/30 text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {s.state === "done" ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={`h-6 w-px ${s.state === "done" ? "bg-success/40" : "bg-border"}`}
                  />
                )}
              </div>
              <span className={s.state === "pending" ? "text-muted-foreground" : ""}>{s.step}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg border border-border bg-card/30 p-3">
          <div className="flex items-center gap-2 text-xs">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Real-time approvals</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Approve/Reject buttons execute or suppress the tool immediately via the backend.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
