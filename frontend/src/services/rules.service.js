/**
 * rules.service.ts — adapter between the Zustand store (uses frontend Rule/Approval
 * types from types/rule.ts) and the real backend API (uses BackendRule from api.ts).
 *
 * The old version of this file had wrong URLs (/api/rules with no trailing slash,
 * PATCH instead of PUT, /api/rules instead of /api/rules/create/), a schema
 * mismatch, and a silent fallback to mock data that hid every network error.
 *
 * This version:
 *  - Calls the correct backend endpoints via rulesAPI / approvalsAPI from api.ts
 *  - Maps BackendRule → frontend Rule shape so RulesTable gets the fields it expects
 *  - Maps backend ApprovalRequest → frontend Approval shape
 *  - Never silently falls back to mock data — errors propagate so the UI can show them
 */
import { rulesAPI, approvalsAPI } from "@/services/api";
// ── shape adapters ────────────────────────────────────────────────────────────
function toFrontendRule(r) {
    return {
        id: r.id,
        name: r.name,
        // Synthesise a description from the backend fields the frontend Rule type needs.
        description: r.pattern
            ? `${r.type} — pattern: ${r.pattern}`
            : r.tool
                ? `${r.type} — tool: ${r.tool}`
                : r.type,
        // Map enabled boolean to the status string the frontend uses.
        status: r.enabled ? "active" : "inactive",
        createdAt: new Date().toISOString(), // backend doesn't track createdAt; use now
        updatedAt: new Date().toISOString(),
    };
}
function toFrontendApproval(a) {
    return {
        id: a.approval_id,
        ruleId: "",
        ruleName: `Approval for ${a.tool_name}`,
        requestedBy: a.session_id,
        status: a.status,
        createdAt: a.created_at,
    };
}
// ── service functions (match the old API surface the store imports) ───────────
export async function getRules() {
    const rules = await rulesAPI.getAll();
    return rules.map(toFrontendRule);
}
export async function createRule(payload) {
    // Map the frontend Rule fields back to a minimal BackendRule payload.
    // Note: This path is used by the Zustand store / RulesTable, NOT by the
    // GuardrailsPage (which builds its own BackendRule payload directly).
    const backendPayload = {
        name: payload.name,
        type: "BLOCK_TOOL",
        enabled: payload.status === "active",
    };
    const created = await rulesAPI.create(backendPayload);
    return toFrontendRule(created);
}
export async function updateRule(id, payload) {
    const updates = {};
    if (payload.name !== undefined)
        updates.name = payload.name;
    if (payload.status !== undefined)
        updates.enabled = payload.status === "active";
    const updated = await rulesAPI.update(id, updates);
    return toFrontendRule(updated);
}
export async function deleteRule(id) {
    await rulesAPI.delete(id);
}
export async function getApprovals() {
    const approvals = await approvalsAPI.getAll();
    return approvals.map(toFrontendApproval);
}
export async function resolveApproval(id, resolution) {
    if (resolution === "approved") {
        await approvalsAPI.approve(id);
    }
    else {
        await approvalsAPI.reject(id);
    }
    // Return a synthetic object — the backend returns the execution result,
    // not the full ApprovalRequest record, so we construct a resolved approval.
    return {
        id,
        ruleId: "",
        ruleName: "",
        requestedBy: "",
        status: resolution,
        createdAt: new Date().toISOString(),
    };
}
