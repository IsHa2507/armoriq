import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
const statusStyles = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    inactive: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};
export function RulesTable({ rules, onEdit, onDelete }) {
    if (rules.length === 0) {
        return (_jsx("p", { className: "py-10 text-center text-sm text-neutral-400", children: "No rules found." }));
    }
    const hasActions = onEdit ?? onDelete;
    return (_jsx("div", { className: "overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900", children: [["Name", "Description", "Status", "Updated"].map((h) => (_jsx("th", { className: "px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400", children: h }, h))), hasActions && (_jsx("th", { className: "px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400", children: "Actions" }))] }) }), _jsx("tbody", { children: rules.map((rule) => (_jsxs("tr", { className: "border-b border-neutral-100 bg-white last:border-0 dark:border-neutral-800 dark:bg-neutral-950", children: [_jsx("td", { className: "px-4 py-3 font-medium text-neutral-900 dark:text-white", children: rule.name }), _jsx("td", { className: "px-4 py-3 text-neutral-500 dark:text-neutral-400", children: rule.description }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", statusStyles[rule.status]), children: rule.status }) }), _jsx("td", { className: "px-4 py-3 text-neutral-500 dark:text-neutral-400", children: new Date(rule.updatedAt).toLocaleDateString() }), hasActions && (_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-2", children: [onEdit && (_jsx("button", { type: "button", onClick: () => onEdit(rule), className: "text-xs text-blue-600 hover:underline dark:text-blue-400", children: "Edit" })), onDelete && (_jsx("button", { type: "button", onClick: () => onDelete(rule.id), className: "text-xs text-red-500 hover:underline dark:text-red-400", children: "Delete" }))] }) }))] }, rule.id))) })] }) }));
}
