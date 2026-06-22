import { create } from "zustand";
import type { ActivityItem, Conversation } from "@/types/agent";
import type { LogEntry } from "@/types/log";
import { getActivity, getLogs, getConversations, sendMessage } from "@/services/agent.service";

interface AgentState {
  conversations: Conversation[];
  activeConversationId: string | null;
  activity: ActivityItem[];
  logs: LogEntry[];
  loading: boolean;
  error: string | null;

  loadConversations: () => Promise<void>;
  setActiveConversation: (id: string) => void;
  send: (conversationId: string, content: string) => Promise<void>;

  loadActivity: () => Promise<void>;
  loadLogs: (params?: { level?: string; source?: string; limit?: number }) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set) => ({
  conversations: [],
  activeConversationId: null,
  activity: [],
  logs: [],
  loading: false,
  error: null,

  loadConversations: async () => {
    set({ loading: true, error: null });
    try {
      const conversations = await getConversations();
      set({ conversations, activeConversationId: conversations[0]?.id ?? null });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  send: async (conversationId, content) => {
    const updated = await sendMessage(conversationId, content);
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === conversationId ? updated : c)),
    }));
  },

  loadActivity: async () => {
    set({ loading: true, error: null });
    try {
      set({ activity: await getActivity() });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  loadLogs: async (params) => {
    set({ loading: true, error: null });
    try {
      set({ logs: await getLogs(params) });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },
}));
