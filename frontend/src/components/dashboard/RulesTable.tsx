import { cn } from "@/lib/utils";
import type { Rule } from "@/types/rule";

interface RulesTableProps {
  rules: Rule[];
  onEdit?: (rule: Rule) => void;
  onDelete?: (id: string) => void;
}

const statusStyles: Record<Rule["status"], string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  inactive: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export function RulesTable({ rules, onEdit, onDelete }: RulesTableProps) {
  if (rules.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-400">No rules found.</p>
    );
  }

  const hasActions = onEdit ?? onDelete;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-900">
            {["Name", "Description", "Status", "Updated"].map((h) => (
              <th key={h} className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                {h}
              </th>
            ))}
            {hasActions && (
              <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr
              key={rule.id}
              className="border-b border-neutral-100 bg-white last:border-0 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">
                {rule.name}
              </td>
              <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                {rule.description}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                    statusStyles[rule.status]
                  )}
                >
                  {rule.status}
                </span>
              </td>
              <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                {new Date(rule.updatedAt).toLocaleDateString()}
              </td>
              {hasActions && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(rule)}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(rule.id)}
                        className="text-xs text-red-500 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
