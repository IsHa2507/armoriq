import { create } from "zustand";
import { getActivity, getLogs, getConversations, sendMessage } from "@/services/agent.service";
export const useAgentStore = create((set) => ({
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
        }
        catch (e) {
            set({ error: e.message });
        }
        finally {
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
        }
        catch (e) {
            set({ error: e.message });
        }
        finally {
            set({ loading: false });
        }
    },
    loadLogs: async (params) => {
        set({ loading: true, error: null });
        try {
            set({ logs: await getLogs(params) });
        }
        catch (e) {
            set({ error: e.message });
        }
        finally {
            set({ loading: false });
        }
    },
}));
