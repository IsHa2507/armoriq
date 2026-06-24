import { create } from "zustand";
import { getMCPServers } from "@/services/mcp.service";
export const useMCPStore = create((set) => ({
    servers: [],
    loading: false,
    error: null,
    loadServers: async () => {
        set({ loading: true, error: null });
        try {
            set({ servers: await getMCPServers() });
        }
        catch (e) {
            set({ error: e.message });
        }
        finally {
            set({ loading: false });
        }
    },
}));
