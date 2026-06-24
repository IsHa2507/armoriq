import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
const PAGE_TITLES = {
    "/": { title: "Security Overview", subtitle: "Live posture across all AI agents and MCP servers." },
    "/agent-console": { title: "Agent Console", subtitle: "Live session: research-bot · session-9821" },
    "/guardrails": { title: "Guardrails", subtitle: "Compose security policies that govern every tool call." },
    "/approvals": { title: "Human Approval Center", subtitle: "Review and decide on high-risk agent actions in real time." },
    "/mcp-servers": { title: "MCP Servers", subtitle: "Manage connected Model Context Protocol servers and their exposed tools." },
    "/logs": { title: "Activity Logs", subtitle: "Immutable security audit trail across all agents." },
    "/analytics": { title: "Analytics", subtitle: "Trends across agents, tools, policies, and token spend." },
    "/settings": { title: "Settings", subtitle: "Workspace configuration and security defaults." },
};
function TitledLayout() {
    const { pathname } = useLocation();
    const { title, subtitle } = PAGE_TITLES[pathname] ?? { title: "ArmorIQ" };
    return _jsx(DashboardLayout, { title: title, subtitle: subtitle });
}
export function RootRouter() {
    return (_jsx(BrowserRouter, { children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(TitledLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(IndexRoute, {}) }), _jsx(Route, { path: "/agent-console", element: _jsx(AgentConsolePage, {}) }), _jsx(Route, { path: "/guardrails", element: _jsx(GuardrailsPage, {}) }), _jsx(Route, { path: "/approvals", element: _jsx(ApprovalsPage, {}) }), _jsx(Route, { path: "/mcp-servers", element: _jsx(MCPServersPage, {}) }), _jsx(Route, { path: "/logs", element: _jsx(LogsPage, {}) }), _jsx(Route, { path: "/analytics", element: _jsx(AnalyticsPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) })] }) }) }));
}
