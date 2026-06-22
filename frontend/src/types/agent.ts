export type AgentStatus = "online" | "offline" | "degraded";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
}

export interface Stat {
  label: string;
  value: string | number;
  delta?: string;
  trend?: "up" | "down" | "neutral";
}
