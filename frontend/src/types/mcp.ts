import type { AgentStatus } from "./agent";

export interface MCPServer {
  id: string;
  name: string;
  status: AgentStatus;
  version: string;
  lastSeen: string;
  tools?: MCPTool[];
}

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}
