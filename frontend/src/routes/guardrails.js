import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { GlassCard, SectionHeader } from "@/components/dashboard/widgets";
import { Ban, UserCheck, ShieldCheck, Gauge, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { rulesAPI } from "@/services/api";
// ── small sub-components ──────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
    return (_jsx("button", { type: "button", onClick: onChange, "aria-pressed": on, className: cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none", on ? "bg-primary shadow-[0_0_12px_-2px_var(--color-primary)]" : "bg-muted/60"), children: _jsx("span", { className: cn("inline-block h-4 w-4 transform rounded-full bg-white transition", on ? "translate-x-4" : "translate-x-0.5") }) }));
}
// Map backend type → display info
const TYPE_META = {
    BLOCK_TOOL: { label: "Block Tool", color: "text-destructive bg-destructive/10", icon: Ban },
    REQUIRE_APPROVAL: { label: "Req. Approval", color: "text-warning bg-warning/10", icon: UserCheck },
    INPUT_VALIDATION: { label: "Input Validation", color: "text-primary bg-primary/10", icon: ShieldCheck },
    TOKEN_BUDGET: { label: "Token Budget", color: "text-success bg-success/10", icon: Gauge },
};
const WHEN_OPTIONS = [
    { label: "Tool name equals (Block)", type: "BLOCK_TOOL", patternField: "pattern" },
    { label: "Tool name equals (Require Approval)", type: "REQUIRE_APPROVAL", patternField: "pattern" },
    { label: "Parameter contains", type: "INPUT_VALIDATION", patternField: "tool" },
    { label: "Token usage exceeds", type: "TOKEN_BUDGET", patternField: "max_tokens" },
];
// ── Page ──────────────────────────────────────────────────────────────────────
export function GuardrailsPage() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deploying, setDeploying] = useState(false);
    const [feedback, setFeedback] = useState(null);
    // Rule Builder controlled state
    const [whenIdx, setWhenIdx] = useState(0);
    const [value, setValue] = useState("delete_note");
    const [ruleName, setRuleName] = useState("");
    // Extra fields for INPUT_VALIDATION
    const [paramName, setParamName] = useState("title");
    const [validationType, setValidationType] = useState("matches_regex");
    const [validationValue, setValidationValue] = useState("");
    // Extra field for TOKEN_BUDGET
    const [maxTokens, setMaxTokens] = useState("10000");
    // ── data loading ────────────────────────────────────────────────────────────
    const loadRules = async () => {
        setLoading(true);
        try {
            const data = await rulesAPI.getAll();
            setRules(data);
        }
        catch (err) {
            console.error("[Guardrails] Failed to load rules:", err);
            setFeedback({ ok: false, msg: "Could not load rules from backend." });
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void loadRules();
    }, []);
    // ── toggle ──────────────────────────────────────────────────────────────────
    const handleToggle = async (ruleId) => {
        // Optimistic update
        setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)));
        try {
            const updated = await rulesAPI.toggle(ruleId);
            // Reconcile with server truth
            setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));
            console.log(`[Guardrails] Rule ${ruleId} toggled → enabled=${updated.enabled}. ` +
                `PolicyEngine will pick this up on the next tool call (no restart needed).`);
        }
        catch (err) {
            console.error("[Guardrails] Toggle failed:", err);
            // Revert optimistic update
            setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)));
            setFeedback({ ok: false, msg: "Failed to toggle rule." });
        }
    };
    // ── delete ──────────────────────────────────────────────────────────────────
    const handleDelete = async (ruleId) => {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        try {
            await rulesAPI.delete(ruleId);
            console.log(`[Guardrails] Rule ${ruleId} deleted.`);
        }
        catch (err) {
            console.error("[Guardrails] Delete failed:", err);
            void loadRules(); // re-fetch to restore state
            setFeedback({ ok: false, msg: "Failed to delete rule." });
        }
    };
    // ── deploy ──────────────────────────────────────────────────────────────────
    const handleDeploy = async () => {
        const selectedWhen = WHEN_OPTIONS[whenIdx];
        const type = selectedWhen.type;
        const name = ruleName.trim() || `${TYPE_META[type].label}: ${value}`;
        // Build the payload the backend expects
        const payload = {
            name,
            type,
            enabled: true,
            priority: 100,
        };
        if (type === "BLOCK_TOOL" || type === "REQUIRE_APPROVAL") {
            payload.pattern = value.trim();
        }
        else if (type === "INPUT_VALIDATION") {
            payload.tool = value.trim();
            payload.parameter = paramName.trim();
            payload.validation_type = validationType;
            payload.validation_value = validationValue.trim();
        }
        else if (type === "TOKEN_BUDGET") {
            payload.max_tokens = parseInt(maxTokens, 10) || 10000;
        }
        console.log("[Guardrails] Deploying rule:", JSON.stringify(payload, null, 2));
        setDeploying(true);
        setFeedback(null);
        try {
            const created = await rulesAPI.create(payload);
            setRules((prev) => [...prev, created]);
            setFeedback({ ok: true, msg: `Rule "${created.name}" deployed. Active immediately.` });
            console.log(`[Guardrails] Rule deployed → id=${created.id} type=${created.type}. ` +
                `PolicyEngine reads rules.json on every evaluate() call — no restart needed.`);
            // Reset form
            setRuleName("");
            setValue("delete_note");
        }
        catch (err) {
            console.error("[Guardrails] Deploy failed:", err);
            setFeedback({ ok: false, msg: `Deploy failed: ${err.message}` });
        }
        finally {
            setDeploying(false);
        }
    };
    // ── render ───────────────────────────────────────────────────────────────────
    const selectedWhen = WHEN_OPTIONS[whenIdx];
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-2 gap-3 md:grid-cols-4", children: Object.entries(TYPE_META).map(([type, meta]) => (_jsxs("button", { type: "button", onClick: () => {
                        const idx = WHEN_OPTIONS.findIndex((o) => o.type === type);
                        if (idx >= 0)
                            setWhenIdx(idx);
                    }, className: "glass-card rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40", children: [_jsx("div", { className: cn("mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg", meta.color), children: _jsx(meta.icon, { className: "h-4 w-4" }) }), _jsx("div", { className: "text-sm font-semibold", children: meta.label }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Add new rule" })] }, type))) }), _jsxs("div", { className: "mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3", children: [_jsxs(GlassCard, { className: "p-5 lg:col-span-2", children: [_jsx(SectionHeader, { title: `Active Policies (${rules.length})`, action: _jsx("button", { type: "button", onClick: () => void loadRules(), className: "inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/25", children: "Refresh" }) }), loading ? (_jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "Loading rules\u2026" })) : rules.length === 0 ? (_jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "No rules yet. Deploy one \u2192" })) : (_jsx("div", { className: "space-y-2", children: rules.map((r) => {
                                    const meta = TYPE_META[r.type] ?? {
                                        label: r.type,
                                        color: "text-muted-foreground bg-muted/10",
                                        icon: ShieldCheck,
                                    };
                                    return (_jsxs("div", { className: "group flex items-center gap-3 rounded-lg border border-border bg-card/30 p-3 transition-colors hover:border-primary/30", children: [_jsx("span", { className: cn("shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold", meta.color), children: meta.label }), _jsxs("div", { className: "flex flex-1 flex-wrap items-center gap-2 text-xs min-w-0", children: [_jsx("span", { className: "font-medium truncate", children: r.name }), (r.pattern ?? r.tool) && (_jsx("span", { className: "rounded bg-muted/50 px-2 py-0.5 font-mono text-muted-foreground shrink-0", children: r.pattern ?? r.tool }))] }), _jsxs("span", { className: "shrink-0 text-[10px] text-muted-foreground", children: [r.hits ?? 0, " hits"] }), _jsx(Toggle, { on: r.enabled, onChange: () => void handleToggle(r.id) }), _jsx("button", { type: "button", onClick: () => void handleDelete(r.id), className: "shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive", "aria-label": "Delete rule", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] }, r.id));
                                }) }))] }), _jsxs(GlassCard, { className: "p-5", children: [_jsx(SectionHeader, { title: "Rule Builder" }), _jsxs("div", { className: "space-y-3 text-xs", children: [_jsxs("div", { children: [_jsx("label", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: "Rule Name (optional)" }), _jsx("input", { value: ruleName, onChange: (e) => setRuleName(e.target.value), placeholder: "e.g. Block create_note", className: "mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: "When" }), _jsx("select", { value: whenIdx, onChange: (e) => setWhenIdx(Number(e.target.value)), className: "mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none", children: WHEN_OPTIONS.map((o, i) => (_jsx("option", { value: i, children: o.label }, o.type + i))) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: selectedWhen.type === "TOKEN_BUDGET" ? "Max Tokens" : "Tool Name / Pattern" }), selectedWhen.type === "TOKEN_BUDGET" ? (_jsx("input", { value: maxTokens, onChange: (e) => setMaxTokens(e.target.value), type: "number", min: 1, className: "mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 font-mono text-sm focus:border-primary/60 focus:outline-none" })) : (_jsx("input", { value: value, onChange: (e) => setValue(e.target.value), placeholder: "e.g. create_note or delete_*", className: "mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 font-mono text-sm focus:border-primary/60 focus:outline-none" }))] }), selectedWhen.type === "INPUT_VALIDATION" && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: "Parameter Name" }), _jsx("input", { value: paramName, onChange: (e) => setParamName(e.target.value), placeholder: "e.g. title", className: "mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 font-mono text-sm focus:border-primary/60 focus:outline-none" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: "Validation Type" }), _jsxs("select", { value: validationType, onChange: (e) => setValidationType(e.target.value), className: "mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none", children: [_jsx("option", { value: "matches_regex", children: "Matches Regex" }), _jsx("option", { value: "contains", children: "Contains" }), _jsx("option", { value: "not_contains", children: "Not Contains" }), _jsx("option", { value: "max_length", children: "Max Length" }), _jsx("option", { value: "path_under", children: "Path Under" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: "Validation Value" }), _jsx("input", { value: validationValue, onChange: (e) => setValidationValue(e.target.value), placeholder: 'e.g. ^[a-zA-Z0-9]+$', className: "mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 font-mono text-sm focus:border-primary/60 focus:outline-none" })] })] })), feedback && (_jsx("div", { className: cn("rounded-md px-3 py-2 text-xs font-medium", feedback.ok
                                            ? "bg-success/10 text-success"
                                            : "bg-destructive/10 text-destructive"), children: feedback.msg })), _jsx("button", { type: "button", onClick: () => void handleDeploy(), disabled: deploying, className: "mt-2 w-full rounded-md bg-gradient-to-r from-primary to-primary-glow py-2 text-sm font-semibold text-white shadow-[0_0_16px_-4px_var(--color-primary)] disabled:opacity-60 disabled:cursor-not-allowed", children: deploying ? "Deploying…" : "Deploy Rule" }), _jsx("p", { className: "text-[10px] text-muted-foreground text-center", children: "Rules take effect immediately \u2014 no agent restart required." })] })] })] })] }));
}
