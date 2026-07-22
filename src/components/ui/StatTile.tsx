import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatTile({
  label,
  value,
  icon: Icon,
  accent = "brand",
  delta,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "brand" | "cyan" | "magenta" | "ok" | "amber";
  delta?: string;
}) {
  const tones: Record<string, string> = {
    brand: "text-brand-glow bg-brand/12",
    cyan: "text-cyan bg-cyan/12",
    magenta: "text-magenta bg-magenta/12",
    ok: "text-ok bg-ok/12",
    amber: "text-amber bg-amber/12",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl glass p-5 transition-colors hover:border-brand/25">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-ink">
            {value}
          </p>
          {delta && <p className="mt-1 text-xs font-medium text-ok">{delta}</p>}
        </div>
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            tones[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
