import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { GlassCard, SectionHeader } from "@/components/dashboard/widgets";
import { toolUsageSeries, topTools } from "@/lib/mock/data";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
const colors = [
    "oklch(0.65 0.19 255)",
    "oklch(0.72 0.19 145)",
    "oklch(0.78 0.16 75)",
    "oklch(0.65 0.23 25)",
    "oklch(0.7 0.2 300)",
];
const approvalData = [
    { name: "Approved", value: 142 },
    { name: "Rejected", value: 23 },
    { name: "Auto-expired", value: 8 },
];
const tokenData = Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    input: Math.round(40000 + Math.sin(i) * 5000 + 10000),
    output: Math.round(20000 + Math.sin(i) * 3000 + 5000),
}));
const tooltipStyle = {
    background: "oklch(0.22 0.025 260)",
    border: "1px solid oklch(0.32 0.03 260 / 60%)",
    borderRadius: 8,
    fontSize: 12,
};
export function AnalyticsPage() {
    return (_jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-2", children: [_jsxs(GlassCard, { className: "p-5", children: [_jsx(SectionHeader, { title: "Tool Usage" }), _jsx("div", { className: "h-64", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: topTools, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "oklch(0.4 0.03 260 / 25%)" }), _jsx(XAxis, { dataKey: "name", stroke: "oklch(0.7 0.025 256)", fontSize: 10 }), _jsx(YAxis, { stroke: "oklch(0.7 0.025 256)", fontSize: 10 }), _jsx(Tooltip, { contentStyle: tooltipStyle, cursor: { fill: "oklch(0.3 0.03 260 / 20%)" } }), _jsx(Bar, { dataKey: "calls", radius: [6, 6, 0, 0], children: topTools.map((_, i) => (_jsx(Cell, { fill: colors[i % colors.length] }, i))) })] }) }) })] }), _jsxs(GlassCard, { className: "p-5", children: [_jsx(SectionHeader, { title: "Approval Rates" }), _jsx("div", { className: "h-64", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: approvalData, dataKey: "value", nameKey: "name", innerRadius: 60, outerRadius: 90, paddingAngle: 3, children: approvalData.map((_, i) => (_jsx(Cell, { fill: colors[i] }, i))) }), _jsx(Tooltip, { contentStyle: tooltipStyle })] }) }) }), _jsx("div", { className: "mt-2 flex justify-center gap-4 text-xs", children: approvalData.map((d, i) => (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "h-2 w-2 rounded-full", style: { background: colors[i] } }), _jsx("span", { className: "text-muted-foreground", children: d.name }), _jsx("span", { className: "font-semibold", children: d.value })] }, d.name))) })] }), _jsxs(GlassCard, { className: "p-5", children: [_jsx(SectionHeader, { title: "Policy Violations Trend" }), _jsx("div", { className: "h-64", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: toolUsageSeries, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "oklch(0.4 0.03 260 / 25%)" }), _jsx(XAxis, { dataKey: "hour", stroke: "oklch(0.7 0.025 256)", fontSize: 10 }), _jsx(YAxis, { stroke: "oklch(0.7 0.025 256)", fontSize: 10 }), _jsx(Tooltip, { contentStyle: tooltipStyle }), _jsx(Line, { type: "monotone", dataKey: "blocked", stroke: "oklch(0.65 0.23 25)", strokeWidth: 2.5, dot: false })] }) }) })] }), _jsxs(GlassCard, { className: "p-5", children: [_jsx(SectionHeader, { title: "Token Consumption \u00B7 14d" }), _jsx("div", { className: "h-64", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: tokenData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "oklch(0.4 0.03 260 / 25%)" }), _jsx(XAxis, { dataKey: "day", stroke: "oklch(0.7 0.025 256)", fontSize: 10 }), _jsx(YAxis, { stroke: "oklch(0.7 0.025 256)", fontSize: 10 }), _jsx(Tooltip, { contentStyle: tooltipStyle, cursor: { fill: "oklch(0.3 0.03 260 / 20%)" } }), _jsx(Bar, { dataKey: "input", stackId: "a", fill: "oklch(0.65 0.19 255)" }), _jsx(Bar, { dataKey: "output", stackId: "a", fill: "oklch(0.72 0.22 280)", radius: [6, 6, 0, 0] })] }) }) })] })] }));
}
