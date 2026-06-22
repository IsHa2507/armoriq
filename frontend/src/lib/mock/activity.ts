import type { ActivityItem } from "@/types/agent";
import type { LogEntry } from "@/types/log";

export const mockActivity: ActivityItem[] = [
  {
    id: "act-1",
    actor: "alice@amor.ai",
    action: "activated rule",
    target: "PII Redaction",
    timestamp: "2026-06-22T08:05:00Z",
  },
  {
    id: "act-2",
    actor: "system",
    action: "restarted server",
    target: "core-mcp",
    timestamp: "2026-06-22T07:50:00Z",
  },
  {
    id: "act-3",
    actor: "bob@amor.ai",
    action: "submitted approval request for",
    target: "Hallucination Guard",
    timestamp: "2026-06-22T07:30:00Z",
  },
  {
    id: "act-4",
    actor: "alice@amor.ai",
    action: "rejected approval for",
    target: "Toxicity Classifier",
    timestamp: "2026-06-22T07:00:00Z",
  },
  {
    id: "act-5",
    actor: "system",
    action: "flagged degraded status on",
    target: "analytics-mcp",
    timestamp: "2026-06-22T06:50:00Z",
  },
];

export const mockLogs: LogEntry[] = [
  {
    id: "log-1",
    level: "info",
    source: "core-mcp",
    message: "Server started successfully on port 8080.",
    timestamp: "2026-06-22T07:50:00Z",
  },
  {
    id: "log-2",
    level: "warn",
    source: "analytics-mcp",
    message: "Response latency exceeded 2000ms threshold.",
    timestamp: "2026-06-22T06:50:00Z",
  },
  {
    id: "log-3",
    level: "error",
    source: "analytics-mcp",
    message: "Database connection pool exhausted.",
    timestamp: "2026-06-22T06:48:00Z",
  },
  {
    id: "log-4",
    level: "info",
    source: "rules-engine",
    message: "Rule 'PII Redaction' evaluated — 42 matches redacted.",
    timestamp: "2026-06-22T08:01:00Z",
  },
  {
    id: "log-5",
    level: "warn",
    source: "rules-engine",
    message: "Rule 'Prompt Injection Filter' triggered on request #8821.",
    timestamp: "2026-06-22T07:55:00Z",
  },
];
