"use client";

import { ArrowUpToLine, Check, ChevronDown, ChevronUp, Eye, EyeOff, Pencil, RotateCcw } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { RowLayoutApi } from "./useRowLayout";

/** Bouton crayon (et, en édition, « Terminé » / « Réinitialiser ») à placer dans l'en-tête de la page. */
export function RowLayoutToggle({ layout }: { layout: RowLayoutApi }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      {layout.editing && layout.customized && (
        <button
          onClick={layout.reset}
          className="flex h-10 items-center gap-1.5 rounded-xl glass px-3 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <RotateCcw className="h-4 w-4" /> {t("rowLayout.reset")}
        </button>
      )}
      <button
        onClick={() => layout.setEditing(!layout.editing)}
        title={layout.editing ? t("rowLayout.done") : t("rowLayout.edit")}
        aria-label={layout.editing ? t("rowLayout.done") : t("rowLayout.edit")}
        aria-pressed={layout.editing}
        className={cn(
          "flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-transform",
          layout.editing ? "brand-gradient text-white shadow hover:scale-105" : "glass text-ink-soft hover:text-ink",
        )}
      >
        {layout.editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        <span className={layout.editing ? "" : "hidden sm:inline"}>{layout.editing ? t("rowLayout.done") : t("rowLayout.edit")}</span>
      </button>
    </div>
  );
}

/** Enveloppe d'une rangée : en édition, ajoute la barre monter / descendre / tout en haut / masquer. */
export function EditableRow({
  rowKey, rows, layout, children,
}: {
  rowKey: string;
  rows: { key: string }[];
  layout: RowLayoutApi;
  children: React.ReactNode;
}) {
  const t = useT();
  if (!layout.editing) return <>{children}</>;
  const hidden = layout.isHidden(rowKey);
  const index = rows.findIndex((r) => r.key === rowKey);
  const btn = "flex h-8 w-8 items-center justify-center rounded-lg glass text-ink-soft transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className={cn("rounded-2xl border border-dashed border-brand/30 p-2 sm:p-3", hidden && "opacity-50")}>
      <div className="mb-2 flex items-center justify-end gap-1.5">
        <button className={btn} disabled={index <= 0} onClick={() => layout.move(rows, rowKey, "top")} title={t("rowLayout.moveTop")} aria-label={t("rowLayout.moveTop")}>
          <ArrowUpToLine className="h-4 w-4" />
        </button>
        <button className={btn} disabled={index <= 0} onClick={() => layout.move(rows, rowKey, "up")} title={t("rowLayout.moveUp")} aria-label={t("rowLayout.moveUp")}>
          <ChevronUp className="h-4 w-4" />
        </button>
        <button className={btn} disabled={index >= rows.length - 1} onClick={() => layout.move(rows, rowKey, "down")} title={t("rowLayout.moveDown")} aria-label={t("rowLayout.moveDown")}>
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          onClick={() => layout.toggleHidden(rows, rowKey)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold",
            hidden ? "border-ok/30 bg-ok/12 text-ok" : "border-amber/30 bg-amber/12 text-amber",
          )}
        >
          {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {hidden ? t("rowLayout.show") : t("rowLayout.hide")}
        </button>
      </div>
      {children}
    </div>
  );
}
