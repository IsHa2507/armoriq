import { create } from "zustand";
import type { MCPServer } from "@/types/mcp";
import { getMCPServers } from "@/services/mcp.service";

interface MCPState {
  servers: MCPServer[];
  loading: boolean;
  error: string | null;

  loadServers: () => Promise<void>;
}

export const useMCPStore = create<MCPState>((set) => ({
  servers: [],
  loading: false,
  error: null,

  loadServers: async () => {
    set({ loading: true, error: null });
    try {
      set({ servers: await getMCPServers() });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },
}));
