import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatTile({
  label,
  value,
  icon: Icon,
  accent = "brand",
  delta,
  compact = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "brand" | "cyan" | "magenta" | "ok" | "amber";
  delta?: string;
  /** Slim pill instead of a full card — for surfaces that already have a big
   *  focal element above (e.g. the Cinematic Hero), where a second row of
   *  large tiles would just compete for attention. Same colors/icon, no new
   *  visual language, just less of it. */
  compact?: boolean;
}) {
  const tones: Record<string, string> = {
    brand: "text-brand-glow bg-brand/12",
    cyan: "text-cyan bg-cyan/12",
    magenta: "text-magenta bg-magenta/12",
    ok: "text-ok bg-ok/12",
    amber: "text-amber bg-amber/12",
  };
  const accentBorders: Record<string, string> = {
    brand: "hover:border-brand/25",
    cyan: "hover:border-cyan/25",
    magenta: "hover:border-magenta/25",
    ok: "hover:border-ok/25",
    amber: "hover:border-amber/25",
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2.5 rounded-xl glass px-3.5 py-2.5 transition-colors", accentBorders[accent])}>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tones[accent])}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-dim">{label}</p>
          <p className="text-lg font-black tracking-tight text-ink">{value}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl glass p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg",
      accentBorders[accent]
    )}>
      <span className={cn(
        "absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100",
        accent === "brand" && "bg-brand",
        accent === "cyan" && "bg-cyan",
        accent === "magenta" && "bg-magenta",
        accent === "ok" && "bg-ok",
        accent === "amber" && "bg-amber",
      )} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
            {label}
          </p>
          <p className="mt-1.5 text-3xl font-black tracking-tight text-ink">
            {value}
          </p>
          {delta && <p className="mt-1 text-xs font-medium text-ok">{delta}</p>}
        </div>
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
            tones[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
