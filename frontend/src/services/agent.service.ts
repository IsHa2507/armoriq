import type { ActivityItem, Conversation } from "@/types/agent";
import type { LogEntry } from "@/types/log";
import { mockActivity, mockLogs } from "@/lib/mock/activity";
import { mockConversations } from "@/lib/mock/conversations";

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

export async function getActivity(): Promise<ActivityItem[]> {
  return safeFetch<ActivityItem[]>(`${BASE}/activity`, mockActivity);
}

export async function getLogs(params?: {
  level?: string;
  source?: string;
  limit?: number;
}): Promise<LogEntry[]> {
  const query = new URLSearchParams();
  if (params?.level) query.set("level", params.level);
  if (params?.source) query.set("source", params.source);
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return safeFetch<LogEntry[]>(
    qs ? `${BASE}/logs?${qs}` : `${BASE}/logs`,
    mockLogs
  );
}

export async function getConversations(): Promise<Conversation[]> {
  return safeFetch<Conversation[]>(`${BASE}/conversations`, mockConversations);
}

export async function sendMessage(
  conversationId: string,
  content: string
): Promise<Conversation> {
  const conversations = await getConversations();
  const conv = conversations.find((c) => c.id === conversationId)!;
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
