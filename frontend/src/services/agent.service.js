import { mockActivity, mockLogs } from "@/lib/mock/activity";
import { mockConversations } from "@/lib/mock/conversations";
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
export async function getActivity() {
    return safeFetch(`${BASE}/activity`, mockActivity);
}
export async function getLogs(params) {
    const query = new URLSearchParams();
    if (params?.level)
        query.set("level", params.level);
    if (params?.source)
        query.set("source", params.source);
    if (params?.limit)
        query.set("limit", String(params.limit));
    const qs = query.toString();
    return safeFetch(qs ? `${BASE}/logs?${qs}` : `${BASE}/logs`, mockLogs);
}
export async function getConversations() {
    return safeFetch(`${BASE}/conversations`, mockConversations);
}
export async function sendMessage(conversationId, content) {
    const conversations = await getConversations();
    const conv = conversations.find((c) => c.id === conversationId);
    const now = new Date().toISOString();
    // Optimistic echo — real implementation would POST to backend
    return {
        ...conv,
        updatedAt: now,
        messages: [
            ...conv.messages,
            { id: crypto.randomUUID(), role: "user", content, timestamp: now },
        ],
    };
}
