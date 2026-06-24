import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { GlassCard, RiskBadge } from "@/components/dashboard/widgets";
import { approvalsAPI } from "@/services/api";
import { Check, X, ArrowRight, GitBranch, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
// Derive a risk level from the tool name so RiskBadge gets something useful.
function riskForTool(toolName) {
    if (/delete|drop|destroy|remove/i.test(toolName))
        return "critical";
    if (/create|write|update|execute|send/i.test(toolName))
        return "high";
    if (/read|get|list|search/i.test(toolName))
        return "medium";
    return "low";
}
export function ApprovalsPage() {
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(null); // approval_id being processed
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState(null);
    // ── load real pending approvals from backend ─────────────────────────────
    const loadApprovals = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await approvalsAPI.getAll();
            // Show only pending ones in the queue; approved/rejected shown as resolved.
            setApprovals(data);
        }
        catch (err) {
            console.error("[Approvals] Failed to load:", err);
            setError("Could not load approvals from backend. Is Django running?");
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void loadApprovals();
    }, [loadApprovals]);
    // ── approve ───────────────────────────────────────────────────────────────
    const handleApprove = async (approvalId, toolName) => {
        setActing(approvalId);
        setFeedback(null);
        try {
            await approvalsAPI.approve(approvalId);
            console.log(`[Approvals] Approved ${approvalId} → tool ${toolName} executed.`);
            setFeedback({ id: approvalId, ok: true, msg: `Tool '${toolName}' approved and executed.` });
            // Remove from pending list
            setApprovals((prev) => prev.filter((a) => a.approval_id !== approvalId));
        }
        catch (err) {
            console.error("[Approvals] Approve failed:", err);
            setFeedback({ id: approvalId, ok: false, msg: `Approve failed: ${err.message}` });
        }
        finally {
            setActing(null);
        }
    };
    // ── reject ────────────────────────────────────────────────────────────────
    const handleReject = async (approvalId, toolName) => {
        setActing(approvalId);
        setFeedback(null);
        try {
            await approvalsAPI.reject(approvalId, "Rejected by human reviewer.");
            console.log(`[Approvals] Rejected ${approvalId} → tool ${toolName} NOT executed.`);
            setFeedback({ id: approvalId, ok: true, msg: `Tool '${toolName}' rejected. It will not execute.` });
            setApprovals((prev) => prev.filter((a) => a.approval_id !== approvalId));
        }
        catch (err) {
            console.error("[Approvals] Reject failed:", err);
            setFeedback({ id: approvalId, ok: false, msg: `Reject failed: ${err.message}` });
        }
        finally {
            setActing(null);
        }
    };
    const pending = approvals.filter((a) => a.status === "pending");
    return (_jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-3", children: [_jsxs(GlassCard, { className: "p-5 lg:col-span-2", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "Pending Queue" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning", children: [pending.length, " pending"] }), _jsxs("button", { type: "button", onClick: () => void loadApprovals(), disabled: loading, className: "inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50", children: [_jsx(RefreshCw, { className: cn("h-3 w-3", loading && "animate-spin") }), "Refresh"] })] })] }), feedback && (_jsx("div", { className: cn("mb-3 rounded-md px-3 py-2 text-xs font-medium", feedback.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"), children: feedback.msg })), error && (_jsx("div", { className: "mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive", children: error })), loading ? (_jsx("p", { className: "py-10 text-center text-sm text-muted-foreground", children: "Loading approvals\u2026" })) : pending.length === 0 ? (_jsx("p", { className: "py-10 text-center text-sm text-muted-foreground", children: "No pending approvals. Trigger a REQUIRE_APPROVAL rule from the Agent Console to see entries here." })) : (_jsx("div", { className: "space-y-3", children: pending.map((a, i) => {
                            const isActing = acting === a.approval_id;
                            return (_jsxs("div", { className: "rounded-lg border border-border bg-card/30 p-4 transition-colors hover:border-primary/30 animate-fade-in-up", style: { animationDelay: `${i * 50}ms` }, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("span", { className: "font-mono text-xs font-semibold text-primary", children: [a.approval_id.slice(0, 8), "\u2026"] }), _jsx(RiskBadge, { level: riskForTool(a.tool_name) }), _jsx("span", { className: "ml-auto text-[10px] text-muted-foreground", children: new Date(a.created_at).toLocaleTimeString() })] }), _jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2 font-mono text-xs", children: [_jsx("span", { className: "text-muted-foreground", children: a.session_id }), _jsx(ArrowRight, { className: "h-3 w-3 text-muted-foreground" }), _jsx("span", { className: "rounded bg-primary/10 px-2 py-0.5 text-primary", children: a.tool_name })] }), _jsx("pre", { className: "mt-2 overflow-x-auto rounded-md border border-border/60 bg-background/50 p-2 font-mono text-[11px] text-muted-foreground", children: JSON.stringify(a.arguments, null, 2) }), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsxs("button", { type: "button", onClick: () => void handleApprove(a.approval_id, a.tool_name), disabled: isActing, className: "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-success/15 px-3 py-1.5 text-xs font-semibold text-success ring-1 ring-success/30 hover:bg-success/25 disabled:opacity-50 disabled:cursor-not-allowed", children: [_jsx(Check, { className: "h-3.5 w-3.5" }), isActing ? "Processing…" : "Approve"] }), _jsxs("button", { type: "button", onClick: () => void handleReject(a.approval_id, a.tool_name), disabled: isActing, className: "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive ring-1 ring-destructive/30 hover:bg-destructive/25 disabled:opacity-50 disabled:cursor-not-allowed", children: [_jsx(X, { className: "h-3.5 w-3.5" }), isActing ? "Processing…" : "Reject"] })] })] }, a.approval_id));
                        }) }))] }), _jsxs(GlassCard, { className: "p-5", children: [_jsx("h2", { className: "mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground", children: "Approval Workflow" }), _jsx("div", { className: "space-y-2 text-xs", children: [
                            { step: "Agent invokes tool", state: "done" },
                            { step: "Guardrail evaluation", state: "done" },
                            { step: "Risk scoring", state: "done" },
                            { step: "Human review", state: "active" },
                            { step: "Action executed", state: "pending" },
                            { step: "Audit logged", state: "pending" },
                        ].map((s, i, arr) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsx("div", { className: `flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${s.state === "done"
                                                ? "bg-success/20 text-success ring-1 ring-success/40"
                                                : s.state === "active"
                                                    ? "bg-primary/20 text-primary ring-1 ring-primary/40 animate-pulse"
                                                    : "bg-muted/30 text-muted-foreground ring-1 ring-border"}`, children: s.state === "done" ? _jsx(Check, { className: "h-3 w-3" }) : i + 1 }), i < arr.length - 1 && (_jsx("div", { className: `h-6 w-px ${s.state === "done" ? "bg-success/40" : "bg-border"}` }))] }), _jsx("span", { className: s.state === "pending" ? "text-muted-foreground" : "", children: s.step })] }, s.step))) }), _jsxs("div", { className: "mt-6 rounded-lg border border-border bg-card/30 p-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx(GitBranch, { className: "h-3.5 w-3.5 text-primary" }), _jsx("span", { className: "font-medium", children: "Real-time approvals" })] }), _jsx("p", { className: "mt-1 text-[10px] text-muted-foreground", children: "Approve/Reject buttons execute or suppress the tool immediately via the backend." })] })] })] }));
}
