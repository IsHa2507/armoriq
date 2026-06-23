const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

// Guardrails/Rules API
export const rulesAPI = {
  getAll: () => fetchAPI('/rules/'),
  create: (rule: any) => fetchAPI('/rules/create/', {
    method: 'POST',
    body: JSON.stringify(rule),
  }),
  update: (ruleId: string, updates: any) => fetchAPI(`/rules/${ruleId}/`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }),
  delete: (ruleId: string) => fetchAPI(`/rules/${ruleId}/delete/`, {
    method: 'DELETE',
  }),
  toggle: (ruleId: string) => fetchAPI(`/rules/${ruleId}/toggle/`, {
    method: 'POST',
  }),
};

// MCP Servers API
export const mcpAPI = {
  getServers: () => fetchAPI('/mcp/servers/'),
  getTools: () => fetchAPI('/mcp/tools/'),
  refreshTools: () => fetchAPI('/mcp/refresh/', {
    method: 'POST',
  }),
};

// Chat/Agent API
export const chatAPI = {
  sendMessage: (message: string, sessionId?: string) => fetchAPI('/chat/', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId }),
  }),
};

// Approvals API
export const approvalsAPI = {
  getAll: () => fetchAPI('/approvals/'),
  approve: (approvalId: string) => fetchAPI(`/approvals/${approvalId}/approve/`, {
    method: 'POST',
  }),
  reject: (approvalId: string, reason?: string) => fetchAPI(`/approvals/${approvalId}/reject/`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
};

// Logs & Analytics API
export const logsAPI = {
  getLogs: (sessionId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    if (limit) params.append('limit', limit.toString());
    return fetchAPI(`/logs/?${params}`);
  },
  getAnalytics: () => fetchAPI('/analytics/'),
};

// Health check
export const healthAPI = {
  check: () => fetchAPI('/health/'),
};
