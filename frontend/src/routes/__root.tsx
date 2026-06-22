import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/layout";
import { IndexRoute } from "./index";
import { AgentConsolePage } from "./agent-console";
import { GuardrailsPage } from "./guardrails";
import { ApprovalsPage } from "./approvals";
import { MCPServersPage } from "./mcp-servers";
import { LogsPage } from "./logs";
import { AnalyticsPage } from "./analytics";
import { SettingsPage } from "./settings";

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/":              { title: "Security Overview",       subtitle: "Live posture across all AI agents and MCP servers." },
  "/agent-console": { title: "Agent Console",           subtitle: "Live session: research-bot · session-9821" },
  "/guardrails":    { title: "Guardrails",              subtitle: "Compose security policies that govern every tool call." },
  "/approvals":     { title: "Human Approval Center",   subtitle: "Review and decide on high-risk agent actions in real time." },
  "/mcp-servers":   { title: "MCP Servers",             subtitle: "Manage connected Model Context Protocol servers and their exposed tools." },
  "/logs":          { title: "Activity Logs",           subtitle: "Immutable security audit trail across all agents." },
  "/analytics":     { title: "Analytics",               subtitle: "Trends across agents, tools, policies, and token spend." },
  "/settings":      { title: "Settings",                subtitle: "Workspace configuration and security defaults." },
};

function TitledLayout() {
  const { pathname } = useLocation();
  const { title, subtitle } = PAGE_TITLES[pathname] ?? { title: "ArmorIQ" };
  return <DashboardLayout title={title} subtitle={subtitle} />;
}

export function RootRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<TitledLayout />}>
          <Route path="/"              element={<IndexRoute />} />
          <Route path="/agent-console" element={<AgentConsolePage />} />
          <Route path="/guardrails"    element={<GuardrailsPage />} />
          <Route path="/approvals"     element={<ApprovalsPage />} />
          <Route path="/mcp-servers"   element={<MCPServersPage />} />
          <Route path="/logs"          element={<LogsPage />} />
          <Route path="/analytics"     element={<AnalyticsPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
