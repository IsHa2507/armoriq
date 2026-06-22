import type { MCPServer } from "@/types/mcp";
import { mockServers } from "@/lib/mock/servers";

const BASE = "/api";

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  } catch {
    return fallback;
  }
}

export async function getMCPServers(): Promise<MCPServer[]> {
  return safeFetch<MCPServer[]>(`${BASE}/mcp-servers`, mockServers);
}

export async function getMCPServer(id: string): Promise<MCPServer | undefined> {
  const servers = await getMCPServers();
  return servers.find((s) => s.id === id);
}
