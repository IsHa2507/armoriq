import { GlassCard, SectionHeader } from "@/components/dashboard/widgets";
import { toolUsageSeries, topTools } from "@/lib/mock/data";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const colors = [
  "oklch(0.65 0.19 255)",
  "oklch(0.72 0.19 145)",
  "oklch(0.78 0.16 75)",
  "oklch(0.65 0.23 25)",
  "oklch(0.7 0.2 300)",
];

const approvalData = [
  { name: "Approved",     value: 142 },
  { name: "Rejected",     value: 23  },
  { name: "Auto-expired", value: 8   },
];

const tokenData = Array.from({ length: 14 }, (_, i) => ({
  day:    `D${i + 1}`,
  input:  Math.round(40000 + Math.sin(i) * 5000 + 10000),
  output: Math.round(20000 + Math.sin(i) * 3000 + 5000),
}));

const tooltipStyle = {
  background:   "oklch(0.22 0.025 260)",
  border:       "1px solid oklch(0.32 0.03 260 / 60%)",
  borderRadius: 8,
  fontSize:     12,
};

export function AnalyticsPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GlassCard className="p-5">
        <SectionHeader title="Tool Usage" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topTools}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.03 260 / 25%)" />
              <XAxis dataKey="name" stroke="oklch(0.7 0.025 256)" fontSize={10} />
              <YAxis stroke="oklch(0.7 0.025 256)" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.03 260 / 20%)" }} />
              <Bar dataKey="calls" radius={[6, 6, 0, 0]}>
                {topTools.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <SectionHeader title="Approval Rates" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={approvalData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                {approvalData.map((_, i) => (
                  <Cell key={i} fill={colors[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex justify-center gap-4 text-xs">
          {approvalData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colors[i] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <SectionHeader title="Policy Violations Trend" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={toolUsageSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.03 260 / 25%)" />
              <XAxis dataKey="hour" stroke="oklch(0.7 0.025 256)" fontSize={10} />
              <YAxis stroke="oklch(0.7 0.025 256)" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="blocked" stroke="oklch(0.65 0.23 25)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <SectionHeader title="Token Consumption · 14d" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tokenData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.03 260 / 25%)" />
              <XAxis dataKey="day" stroke="oklch(0.7 0.025 256)" fontSize={10} />
              <YAxis stroke="oklch(0.7 0.025 256)" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.3 0.03 260 / 20%)" }} />
              <Bar dataKey="input"  stackId="a" fill="oklch(0.65 0.19 255)" />
              <Bar dataKey="output" stackId="a" fill="oklch(0.72 0.22 280)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}
