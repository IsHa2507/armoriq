import { useEffect } from "react";
import { useAgentStore } from "@/store/agentStore";

export function useAgent() {
  const store = useAgentStore();

  useEffect(() => {
    void store.loadConversations();
    void store.loadActivity();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeConversation = store.conversations.find(
    (c) => c.id === store.activeConversationId
  );

  return {
    conversations: store.conversations,
    activeConversation,
    activity: store.activity,
    loading: store.loading,
    error: store.error,
    setActiveConversation: store.setActiveConversation,
    send: store.send,
  };
}
