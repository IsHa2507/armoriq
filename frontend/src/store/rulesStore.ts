import { create } from "zustand";
import type { Rule, Approval } from "@/types/rule";
import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  getApprovals,
  resolveApproval,
} from "@/services/rules.service";

interface RulesState {
  rules: Rule[];
  approvals: Approval[];
  loading: boolean;
  error: string | null;

  loadRules: () => Promise<void>;
  addRule: (payload: Omit<Rule, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  editRule: (id: string, payload: Partial<Omit<Rule, "id" | "createdAt" | "updatedAt">>) => Promise<void>;
  removeRule: (id: string) => Promise<void>;

  loadApprovals: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
}

export const useRulesStore = create<RulesState>((set) => ({
  rules: [],
  approvals: [],
  loading: false,
  error: null,

  loadRules: async () => {
    set({ loading: true, error: null });
    try {
      set({ rules: await getRules() });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  addRule: async (payload) => {
    const rule = await createRule(payload);
    set((s) => ({ rules: [...s.rules, rule] }));
  },

  editRule: async (id, payload) => {
    const updated = await updateRule(id, payload);
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? updated : r)) }));
  },

  removeRule: async (id) => {
    await deleteRule(id);
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }));
  },

  loadApprovals: async () => {
    set({ loading: true, error: null });
    try {
      set({ approvals: await getApprovals() });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  approve: async (id) => {
    const updated = await resolveApproval(id, "approved");
    set((s) => ({ approvals: s.approvals.map((a) => (a.id === id ? updated : a)) }));
  },

  reject: async (id) => {
    const updated = await resolveApproval(id, "rejected");
    set((s) => ({ approvals: s.approvals.map((a) => (a.id === id ? updated : a)) }));
  },
}));
