"use client";

import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A clickable column header for tabular lists — click sorts by that column,
 * click again flips direction. Active column reads clearly at a glance
 * (brand color + a filled pill around the arrow) instead of a barely-visible
 * icon swap, so the current sort is obvious without having to look twice.
 */
export function SortableColumnHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  column: string;
  activeColumn: string;
  direction: "asc" | "desc";
  onSort: (column: string) => void;
  align?: "left" | "right";
}) {
  const active = activeColumn === column;
  return (
    <button
      onClick={() => onSort(column)}
      className={cn(
        "-mx-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors",
        align === "right" && "flex-row-reverse",
        active ? "font-bold text-brand-glow" : "text-ink-dim hover:text-ink-soft"
      )}
    >
      {label}
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded",
          active && "bg-brand/18"
        )}
      >
        {active ? (
          direction === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        )}
      </span>
    </button>
  );
}
