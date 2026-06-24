export const mockServers = [
    {
        id: "srv-1",
        name: "core-mcp",
        status: "online",
        version: "2.4.1",
        lastSeen: new Date().toISOString(),
        tools: [
            { id: "t-1", name: "web_search", description: "Search the web", enabled: true },
            { id: "t-2", name: "code_exec", description: "Execute sandboxed code", enabled: true },
        ],
    },
    {
        id: "srv-2",
        name: "analytics-mcp",
        status: "degraded",
        version: "1.9.0",
        lastSeen: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        tools: [
            { id: "t-3", name: "query_db", description: "Run analytics queries", enabled: false },
        ],
    },
    {
        id: "srv-3",
        name: "storage-mcp",
        status: "online",
        version: "3.1.2",
        lastSeen: new Date().toISOString(),
        tools: [
            { id: "t-4", name: "read_file", description: "Read from object storage", enabled: true },
            { id: "t-5", name: "write_file", description: "Write to object storage", enabled: true },
        ],
    },
    {
        id: "srv-4",
        name: "legacy-mcp",
        status: "offline",
        version: "0.8.5",
        lastSeen: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        tools: [],
    },
];
