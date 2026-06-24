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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(`[${url}] ${message}`);
  }

  // 204 No Content — return null
  if (response.status === 204) return null as unknown as T;
  return response.json() as Promise<T>;
}

// ── Rule type that matches the backend schema ─────────────────────────────────
// The backend stores: id, name, type, enabled, priority, pattern, tool, etc.
// The frontend Rule type in types/rule.ts uses a different shape (description,
// status …) designed for a separate component that is NOT the Guardrails page.
// The GuardrailsPage uses BackendRule directly — no mapping needed.

export interface BackendRule {
  id: string;
  name: string;
  type: "BLOCK_TOOL" | "REQUIRE_APPROVAL" | "INPUT_VALIDATION" | "TOKEN_BUDGET";
  enabled: boolean;
  priority?: number;
  pattern?: string;
  tool?: string;
  parameter?: string;
  validation_type?: string;
  validation_value?: string;
  max_tokens?: number;
  hits?: number;
  [key: string]: unknown;
}

export interface BackendApproval {
  approval_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  session_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  resolved_at: string | null;
  rejection_reason: string | null;
}

// ── Guardrails / Rules API ────────────────────────────────────────────────────

export const rulesAPI = {
  /** Fetch all rules from the backend (reads rules.json via RuleStore). */
  getAll: (): Promise<BackendRule[]> =>
    request<BackendRule[]>("/rules/"),

  /** Create a new rule. Backend writes it to rules.json immediately. */
  create: (rule: Omit<BackendRule, "id">): Promise<BackendRule> =>
    request<BackendRule>("/rules/create/", {
      method: "POST",
      body: JSON.stringify(rule),
    }),

  /** Full update of a rule. */
  update: (ruleId: string, updates: Partial<BackendRule>): Promise<BackendRule> =>
    request<BackendRule>(`/rules/${encodeURIComponent(ruleId)}/`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  /** Delete a rule. */
  delete: (ruleId: string): Promise<{ success: boolean }> =>
    request<{ success: boolean }>(`/rules/${encodeURIComponent(ruleId)}/delete/`, {
      method: "DELETE",
    }),

  /**
   * Toggle a rule's enabled flag.
   * Backend flips the flag in rules.json and returns the updated rule.
   * PolicyEngine.evaluate() re-reads rules.json on every call, so the
   * change takes effect on the very next tool execution — no restart needed.
   */
  toggle: (ruleId: string): Promise<BackendRule> =>
    request<BackendRule>(`/rules/${encodeURIComponent(ruleId)}/toggle/`, {
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
  sendMessage: (message: string, sessionId?: string) =>
    request("/chat/", {
      method: "POST",
      body: JSON.stringify({ message, session_id: sessionId }),
    }),
};

// ── Approvals API ─────────────────────────────────────────────────────────────

export const approvalsAPI = {
  getAll: (): Promise<BackendApproval[]> =>
    request<BackendApproval[]>("/approvals/"),

  /** Approve and immediately execute the tool (runs through PolicyEngine). */
  approve: (approvalId: string) =>
    request(`/approvals/${encodeURIComponent(approvalId)}/approve/`, { method: "POST" }),

  reject: (approvalId: string, reason?: string) =>
    request(`/approvals/${encodeURIComponent(approvalId)}/reject/`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

// ── Logs & Analytics API ──────────────────────────────────────────────────────

export const logsAPI = {
  getLogs: (sessionId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (sessionId) params.append("session_id", sessionId);
    if (limit) params.append("limit", String(limit));
    return request(`/logs/?${params}`);
  },
  getAnalytics: () => request("/analytics/"),
};

// ── Health ────────────────────────────────────────────────────────────────────

export const healthAPI = {
  check: () => request("/health/"),
};
