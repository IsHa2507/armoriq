export const mockConversations = [
    {
        id: "conv-1",
        title: "Guardrail review session",
        createdAt: "2026-06-20T09:00:00Z",
        updatedAt: "2026-06-20T09:15:00Z",
        messages: [
            {
                id: "msg-1",
                role: "user",
                content: "Can you summarise the active guardrail rules?",
                timestamp: "2026-06-20T09:00:00Z",
            },
            {
                id: "msg-2",
                role: "assistant",
                content: "Sure! There are currently 3 active rules: PII Redaction, Rate Limit Enforcement, and Prompt Injection Filter.",
                timestamp: "2026-06-20T09:00:05Z",
            },
        ],
    },
    {
        id: "conv-2",
        title: "MCP server health check",
        createdAt: "2026-06-21T14:30:00Z",
        updatedAt: "2026-06-21T14:32:00Z",
        messages: [
            {
                id: "msg-3",
                role: "user",
                content: "Which MCP servers are currently degraded?",
                timestamp: "2026-06-21T14:30:00Z",
            },
            {
                id: "msg-4",
                role: "assistant",
                content: "Server 'analytics-mcp' is showing a degraded status since 14:10 UTC.",
                timestamp: "2026-06-21T14:30:04Z",
            },
        ],
    },
];
