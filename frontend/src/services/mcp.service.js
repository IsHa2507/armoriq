import { mockServers } from "@/lib/mock/servers";
const BASE = "/api";
async function safeFetch(url, fallback) {
    try {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.json();
    }
    catch {
        return fallback;
    }
}
export async function getMCPServers() {
    return safeFetch(`${BASE}/mcp-servers`, mockServers);
}
export async function getMCPServer(id) {
    const servers = await getMCPServers();
    return servers.find((s) => s.id === id);
}
