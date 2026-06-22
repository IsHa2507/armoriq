// ── KPI Cards ────────────────────────────────────────────────────────────────

export const kpis = [
  { label: "Active Agents",      value: "12",    delta: "+2",   icon: "Bot",        tone: "primary"  },
  { label: "MCP Servers",        value: "7",     delta: "+1",   icon: "Server",     tone: "success"  },
  { label: "Tool Calls Today",   value: "4,821", delta: "+18%", icon: "Zap",        tone: "primary"  },
  { label: "Blocked Actions",    value: "47",    delta: "-12%", icon: "ShieldAlert", tone: "danger"  },
  { label: "Pending Approvals",  value: "6",     delta: "+3",   icon: "Clock",      tone: "warning"  },
  { label: "Uptime",             value: "99.98%",delta: "0%",   icon: "Activity",   tone: "success"  },
] as const;

// ── Tool Usage Chart ──────────────────────────────────────────────────────────

export const toolUsageSeries = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  calls:   Math.round(80 + Math.sin(i / 3) * 40 + Math.random() * 30),
  blocked: Math.round(2  + Math.sin(i / 4) * 3  + Math.random() * 4),
}));

// ── Top Tools ────────────────────────────────────────────────────────────────

export const topTools = [
  { name: "search_repos",   calls: 1240 },
  { name: "execute_sql",    calls: 980  },
  { name: "read_file",      calls: 870  },
  { name: "create_issue",   calls: 620  },
  { name: "send_email",     calls: 410  },
];

// ── Security Events ───────────────────────────────────────────────────────────

export const securityEvents = [
  { time: "08:42:11", severity: "info",     agent: "research-bot",  message: "SQL query executed via postgres-mcp — 312 rows returned." },
  { time: "08:39:04", severity: "warning",  agent: "ops-agent",     message: "Attempt to call delete_file blocked by guardrail G-104." },
  { time: "08:35:57", severity: "critical", agent: "finance-bot",   message: "Prompt injection detected — session quarantined." },
  { time: "08:30:22", severity: "info",     agent: "data-agent",    message: "Tool discovery completed — 6 new tools registered." },
  { time: "08:22:09", severity: "warning",  agent: "research-bot",  message: "Token budget exceeded 80% threshold. Throttling applied." },
];

// ── Agent Console Timeline ────────────────────────────────────────────────────

export const agentTimeline: Array<{
  phase: string;
  status: "done" | "warning" | "pending";
  content: string;
}> = [
  { phase: "User Prompt",       status: "done",    content: "Find users created in last 30 days and email ops team." },
  { phase: "Tool Selected",     status: "done",    content: "postgres-mcp → execute_sql" },
  { phase: "Policy Evaluation", status: "warning", content: "send_email requires human approval (risk: high)" },
  { phase: "Tool Execution",    status: "done",    content: "SELECT query returned 28 rows in 142ms." },
  { phase: "Final Response",    status: "pending", content: "Awaiting approval REQ-9821 before email dispatch." },
];

// ── Approvals ────────────────────────────────────────────────────────────────

export const approvals = [
  {
    id: "REQ-9821",
    agent: "research-bot",
    tool: "send_email",
    risk: "high",
    time: "08:42",
    params: JSON.stringify({ to: "ops@acme.com", subject: "New users report", body: "28 users…" }, null, 2),
  },
  {
    id: "REQ-9820",
    agent: "finance-bot",
    tool: "execute_sql",
    risk: "critical",
    time: "08:35",
    params: JSON.stringify({ query: "SELECT * FROM transactions WHERE amount > 10000" }, null, 2),
  },
  {
    id: "REQ-9818",
    agent: "ops-agent",
    tool: "delete_file",
    risk: "medium",
    time: "08:30",
    params: JSON.stringify({ path: "/tmp/export-2026-06-22.csv" }, null, 2),
  },
];

// ── Guardrails ────────────────────────────────────────────────────────────────

export const guardrails: Array<{
  id: string;
  condition: string;
  action: string;
  hits: number;
  enabled: boolean;
}> = [
  { id: "G-101", condition: "tool == 'delete_file'",       action: "Block",            hits: 12,  enabled: true  },
  { id: "G-102", condition: "tool == 'send_email'",        action: "Require Approval", hits: 34,  enabled: true  },
  { id: "G-103", condition: "param.query CONTAINS 'DROP'", action: "Block",            hits: 5,   enabled: true  },
  { id: "G-104", condition: "token_count > 8000",          action: "Log",              hits: 89,  enabled: false },
  { id: "G-105", condition: "agent == 'finance-bot'",      action: "Require Approval", hits: 21,  enabled: true  },
];

// ── MCP Servers ───────────────────────────────────────────────────────────────

export const mcpServers = [
  { name: "github-mcp",     status: "online",   transport: "SSE",   tools: 8,  risk: "medium", lastHeartbeat: "2s ago"  },
  { name: "postgres-mcp",   status: "online",   transport: "STDIO", tools: 5,  risk: "high",   lastHeartbeat: "1s ago"  },
  { name: "filesystem-mcp", status: "online",   transport: "STDIO", tools: 4,  risk: "high",   lastHeartbeat: "3s ago"  },
  { name: "email-mcp",      status: "online",   transport: "SSE",   tools: 3,  risk: "medium", lastHeartbeat: "5s ago"  },
  { name: "analytics-mcp",  status: "warning",  transport: "SSE",   tools: 6,  risk: "low",    lastHeartbeat: "14m ago" },
  { name: "legacy-mcp",     status: "offline",  transport: "STDIO", tools: 2,  risk: "low",    lastHeartbeat: "3h ago"  },
];

// ── Activity Logs ─────────────────────────────────────────────────────────────

export const activityLogs: Array<{
  ts: string;
  agent: string;
  tool: string;
  action: string;
  result: "allowed" | "blocked" | "approval";
  decision: string;
}> = [
  { ts: "08:42:11.342", agent: "research-bot", tool: "execute_sql",  action: "SELECT users",        result: "allowed",  decision: "G-PASS"  },
  { ts: "08:41:58.001", agent: "research-bot", tool: "send_email",   action: "Email ops@acme.com",  result: "approval", decision: "G-102"   },
  { ts: "08:39:04.210", agent: "ops-agent",    tool: "delete_file",  action: "DELETE /tmp/*.csv",   result: "blocked",  decision: "G-101"   },
  { ts: "08:37:22.900", agent: "finance-bot",  tool: "execute_sql",  action: "SELECT transactions", result: "approval", decision: "G-105"   },
  { ts: "08:35:57.445", agent: "finance-bot",  tool: "execute_sql",  action: "Injection attempt",   result: "blocked",  decision: "G-103"   },
  { ts: "08:30:22.100", agent: "data-agent",   tool: "read_file",    action: "READ config.json",    result: "allowed",  decision: "G-PASS"  },
  { ts: "08:22:09.780", agent: "research-bot", tool: "search_repos", action: "SEARCH vite repos",   result: "allowed",  decision: "G-PASS"  },
  { ts: "08:15:44.320", agent: "ops-agent",    tool: "create_issue", action: "CREATE issue #821",   result: "allowed",  decision: "G-PASS"  },
];
