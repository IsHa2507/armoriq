/**
 * API service — single source of truth for all backend communication.
 *
 * Uses relative /api/* paths so that Vite's dev-proxy forwards requests to
 * Django (localhost:8000) without CORS issues. In production, set
 * VITE_API_BASE to the absolute backend URL.
 *
 * Django URL layout (backend/agent/urls.py):
 *   GET    /api/rules/
 *   POST   /api/rules/create/
 *   PUT    /api/rules/<id>/
 *   DELETE /api/rules/<id>/delete/
 *   POST   /api/rules/<id>/toggle/
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
// ── core fetch wrapper ────────────────────────────────────────────────────────
async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const body = await response.json();
            message = body.error ?? body.detail ?? body.message ?? message;
        }
        catch {
            // ignore JSON parse errors
        }
        throw new Error(`[${url}] ${message}`);
    }
    // 204 No Content — return null
    if (response.status === 204)
        return null;
    return response.json();
}
// ── Guardrails / Rules API ────────────────────────────────────────────────────
export const rulesAPI = {
    /** Fetch all rules from the backend (reads rules.json via RuleStore). */
    getAll: () => request("/rules/"),
    /** Create a new rule. Backend writes it to rules.json immediately. */
    create: (rule) => request("/rules/create/", {
        method: "POST",
        body: JSON.stringify(rule),
    }),
    /** Full update of a rule. */
    update: (ruleId, updates) => request(`/rules/${encodeURIComponent(ruleId)}/`, {
        method: "PUT",
        body: JSON.stringify(updates),
    }),
    /** Delete a rule. */
    delete: (ruleId) => request(`/rules/${encodeURIComponent(ruleId)}/delete/`, {
        method: "DELETE",
    }),
    /**
     * Toggle a rule's enabled flag.
     * Backend flips the flag in rules.json and returns the updated rule.
     * PolicyEngine.evaluate() re-reads rules.json on every call, so the
     * change takes effect on the very next tool execution — no restart needed.
     */
    toggle: (ruleId) => request(`/rules/${encodeURIComponent(ruleId)}/toggle/`, {
        method: "POST",
    }),
};
// ── MCP Servers API ───────────────────────────────────────────────────────────
export const mcpAPI = {
    getServers: () => request("/mcp/servers/"),
    getTools: () => request("/mcp/tools/"),
    refreshTools: () => request("/mcp/refresh/", { method: "POST" }),
};
// ── Chat / Agent API ──────────────────────────────────────────────────────────
export const chatAPI = {
    sendMessage: (message, sessionId) => request("/chat/", {
        method: "POST",
        body: JSON.stringify({ message, session_id: sessionId }),
    }),
};
// ── Approvals API ─────────────────────────────────────────────────────────────
export const approvalsAPI = {
    getAll: () => request("/approvals/"),
    /** Approve and immediately execute the tool (runs through PolicyEngine). */
    approve: (approvalId) => request(`/approvals/${encodeURIComponent(approvalId)}/approve/`, { method: "POST" }),
    reject: (approvalId, reason) => request(`/approvals/${encodeURIComponent(approvalId)}/reject/`, {
        method: "POST",
        body: JSON.stringify({ reason }),
    }),
};
// ── Logs & Analytics API ──────────────────────────────────────────────────────
export const logsAPI = {
    getLogs: (sessionId, limit) => {
        const params = new URLSearchParams();
        if (sessionId)
            params.append("session_id", sessionId);
        if (limit)
            params.append("limit", String(limit));
        return request(`/logs/?${params}`);
    },
    getAnalytics: () => request("/analytics/"),
};
// ── Health ────────────────────────────────────────────────────────────────────
export const healthAPI = {
    check: () => request("/health/"),
};
export const dashboardAPI = {
    get: () => request("/dashboard/"),
};
