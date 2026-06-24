import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ActivityFeed({ items }) {
    if (items.length === 0) {
        return (_jsx("p", { className: "py-6 text-center text-sm text-neutral-400", children: "No recent activity." }));
    }
    return (_jsx("ol", { className: "flex flex-col gap-4", "aria-label": "Activity feed", children: items.map((item) => (_jsxs("li", { className: "flex items-start gap-3", children: [_jsx("span", { className: "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500", "aria-hidden": "true" }), _jsxs("div", { className: "flex-1", children: [_jsxs("p", { className: "text-sm text-neutral-700 dark:text-neutral-300", children: [_jsx("span", { className: "font-medium text-neutral-900 dark:text-white", children: item.actor }), " ", item.action, " ", _jsx("span", { className: "font-medium text-neutral-900 dark:text-white", children: item.target })] }), _jsx("time", { dateTime: item.timestamp, className: "text-xs text-neutral-400", children: new Date(item.timestamp).toLocaleString() })] })] }, item.id))) }));
}
