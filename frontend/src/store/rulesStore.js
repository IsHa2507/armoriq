import { create } from "zustand";
import { getRules, createRule, updateRule, deleteRule, getApprovals, resolveApproval, } from "@/services/rules.service";
export const useRulesStore = create((set) => ({
    rules: [],
    approvals: [],
    loading: false,
    error: null,
    loadRules: async () => {
        set({ loading: true, error: null });
        try {
            set({ rules: await getRules() });
        }
        catch (e) {
            set({ error: e.message });
        }
        finally {
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
        }
        catch (e) {
            set({ error: e.message });
        }
        finally {
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
