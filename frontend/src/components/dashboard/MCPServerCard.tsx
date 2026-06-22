import { cn } from "@/lib/utils";
import type { MCPServer } from "@/types/mcp";

interface MCPServerCardProps {
  server: MCPServer;
}

const statusDot: Record<MCPServer["status"], string> = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  degraded: "bg-amber-500",
};

const statusLabel: Record<MCPServer["status"], string> = {
  online: "Online",
  offline: "Offline",
  degraded: "Degraded",
};

const statusText: Record<MCPServer["status"], string> = {
  online: "text-emerald-600 dark:text-emerald-400",
  offline: "text-red-500 dark:text-red-400",
  degraded: "text-amber-600 dark:text-amber-400",
};

export function MCPServerCard({ server }: MCPServerCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3">
        <span
          className={cn("h-2.5 w-2.5 rounded-full", statusDot[server.status])}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            {server.name}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            v{server.version} · Last seen {new Date(server.lastSeen).toLocaleTimeString()}
          </p>
        </div>
      </div>
      <span className={cn("text-xs font-medium capitalize", statusText[server.status])}>
        {statusLabel[server.status]}
      </span>
    </div>
  );
}
