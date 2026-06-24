import type { MCPServer } from "@/types/mcp";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  } catch {
    return fallback;
  }
}

// Fetches live server status from Django backend GET /api/mcp/servers/
// and maps it to the MCPServer shape used by the store + MCPServerCard.
export async function getMCPServers(): Promise<MCPServer[]> {
  type BackendServer = {
    status: string;
    transport: string;
    tool_count: number;
    tools: string[];
    registered_at: string | null;
    last_heartbeat: string | null;
    server_info: Record<string, unknown> | null;
    command: string | null;
    error: string | null;
  };

  const data = await safeFetch<Record<string, BackendServer>>(
    `${BASE}/mcp/servers/`,
    {},
  );

  return Object.entries(data).map(([name, srv]) => ({
    id:       name,
    name:     name,
    status:   srv.status === "connected" ? "online" : "offline",
    version:  srv.server_info
                ? String(srv.server_info.version ?? "1.0.0")
                : "1.0.0",
    lastSeen: srv.last_heartbeat ?? srv.registered_at ?? new Date().toISOString(),
    tools:    srv.tools.map((t, i) => ({
      id:          `${name}-${i}`,
      name:        t,
      description: t,
      enabled:     true,
    })),
  }));
}

export async function getMCPServer(id: string): Promise<MCPServer | undefined> {
  const servers = await getMCPServers();
  return servers.find((s) => s.id === id);
}

