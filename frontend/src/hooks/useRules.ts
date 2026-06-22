import { useEffect } from "react";
import { useRulesStore } from "@/store/rulesStore";

export function useRules() {
  const store = useRulesStore();

  useEffect(() => {
    void store.loadRules();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    rules: store.rules,
    loading: store.loading,
    error: store.error,
    addRule: store.addRule,
    editRule: store.editRule,
    removeRule: store.removeRule,
  };
}

export function useApprovals() {
  const store = useRulesStore();

  useEffect(() => {
    void store.loadApprovals();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    approvals: store.approvals,
    loading: store.loading,
    error: store.error,
    approve: store.approve,
    reject: store.reject,
  };
}
