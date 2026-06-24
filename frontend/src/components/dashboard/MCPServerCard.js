import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
const statusDot = {
    online: "bg-emerald-500",
    offline: "bg-red-500",
    degraded: "bg-amber-500",
};
const statusLabel = {
    online: "Online",
    offline: "Offline",
    degraded: "Degraded",
};
const statusText = {
    online: "text-emerald-600 dark:text-emerald-400",
    offline: "text-red-500 dark:text-red-400",
    degraded: "text-amber-600 dark:text-amber-400",
};
export function MCPServerCard({ server }) {
    return (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: cn("h-2.5 w-2.5 rounded-full", statusDot[server.status]), "aria-hidden": "true" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-neutral-900 dark:text-white", children: server.name }), _jsxs("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: ["v", server.version, " \u00B7 Last seen ", new Date(server.lastSeen).toLocaleTimeString()] })] })] }), _jsx("span", { className: cn("text-xs font-medium capitalize", statusText[server.status]), children: statusLabel[server.status] })] }));
}
