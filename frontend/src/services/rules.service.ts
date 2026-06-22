import type { Rule, Approval } from "@/types/rule";
import { mockRules, mockApprovals } from "@/lib/mock/rules";

// Swap these fetch calls for real API endpoints when the backend is ready.
// Currently falls back to mock data on any network error.

const BASE = "/api";

async function safeFetch<T>(url: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error(`Request failed: ${url}`);
  }
}

export async function getRules(): Promise<Rule[]> {
  return safeFetch<Rule[]>(`${BASE}/rules`, undefined, mockRules);
}

export async function createRule(
  payload: Omit<Rule, "id" | "createdAt" | "updatedAt">
): Promise<Rule> {
  const now = new Date().toISOString();
  const optimistic: Rule = { ...payload, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  return safeFetch<Rule>(
    `${BASE}/rules`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    optimistic
  );
}

export async function updateRule(
  id: string,
  payload: Partial<Omit<Rule, "id" | "createdAt" | "updatedAt">>
): Promise<Rule> {
  const existing = mockRules.find((r) => r.id === id)!;
  const optimistic: Rule = { ...existing, ...payload, updatedAt: new Date().toISOString() };
  return safeFetch<Rule>(
    `${BASE}/rules/${encodeURIComponent(id)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    optimistic
  );
}

export async function deleteRule(id: string): Promise<void> {
  return safeFetch<void>(
    `${BASE}/rules/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    undefined
  );
}

export async function getApprovals(): Promise<Approval[]> {
  return safeFetch<Approval[]>(`${BASE}/approvals`, undefined, mockApprovals);
}

export async function resolveApproval(
  id: string,
  status: "approved" | "rejected"
): Promise<Approval> {
  const existing = mockApprovals.find((a) => a.id === id)!;
  return safeFetch<Approval>(
    `${BASE}/approvals/${encodeURIComponent(id)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) },
    { ...existing, status }
  );
}
