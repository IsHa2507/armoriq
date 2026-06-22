import { NavLink, useLocation, Outlet } from "react-router-dom";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Bot, Server, ShieldCheck, UserCheck, ScrollText,
  BarChart3, Settings, Search, Bell, ChevronLeft, Shield, Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agent-console", label: "Agent Console", icon: Bot },
  { to: "/mcp-servers", label: "MCP Servers", icon: Server },
  { to: "/guardrails", label: "Guardrails", icon: ShieldCheck },
  { to: "/approvals", label: "Human Approvals", icon: UserCheck },
  { to: "/logs", label: "Activity Logs", icon: ScrollText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardLayout({ children, title, subtitle }: { children?: ReactNode; title: string; subtitle?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 h-screen border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl transition-all duration-300",
          collapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow shadow-[0_0_20px_-4px_var(--color-primary)]">
            <Shield className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-tight">ArmorIQ</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Agent Security</span>
            </div>
          )}
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("h-4.5 w-4.5 shrink-0", active && "text-primary")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {active && !collapsed && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                )}
              </NavLink>
            );
          })}
        </nav>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>
        {!collapsed && (
          <div className="absolute bottom-4 left-3 right-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-xs font-medium">All systems operational</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">99.98% uptime · 142ms p50</p>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className={cn("flex flex-1 flex-col transition-all duration-300", collapsed ? "ml-[72px]" : "ml-[248px]")}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search agents, tools, policies…"
              className="h-9 w-full rounded-lg border border-border bg-card/40 pl-9 pr-16 text-sm placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              <Command className="inline h-3 w-3" />K
            </kbd>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/40 text-muted-foreground transition-colors hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
            </button>
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card/40 py-1 pl-1 pr-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-white">
                AK
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold">Alex Kim</span>
                <span className="text-[10px] text-muted-foreground">SecOps Admin</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-6 animate-fade-in-up">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}