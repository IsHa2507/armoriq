import { GlassCard, SectionHeader } from "@/components/dashboard/widgets";
import { Key, Bell, Users, Shield } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GlassCard className="p-5">
        <SectionHeader title="Workspace" />
        <div className="space-y-3 text-sm">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Organization</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 focus:border-primary/60 focus:outline-none"
              defaultValue="Acme Security Corp"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Default Risk Threshold</label>
            <select className="mt-1 w-full rounded-md border border-border bg-card/50 px-3 py-2 focus:border-primary/60 focus:outline-none">
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {[
        { Icon: Key,    title: "API Keys",        desc: "Manage MCP server credentials and provider keys."       },
        { Icon: Bell,   title: "Notifications",   desc: "Configure Slack, email, and PagerDuty routing."          },
        { Icon: Users,  title: "Team & Roles",    desc: "Invite teammates and assign RBAC roles."                 },
        { Icon: Shield, title: "SSO & SAML",      desc: "Enterprise identity provider configuration."             },
      ].map(({ Icon, title, desc }) => (
        <GlassCard key={title} className="flex items-start gap-4 p-5 transition-colors hover:border-primary/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{title}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-border bg-card/40 px-3 py-1 text-xs hover:bg-card/70"
          >
            Configure
          </button>
        </GlassCard>
      ))}
    </div>
  );
}
