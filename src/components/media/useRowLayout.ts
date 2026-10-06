"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import type { RowLayoutPref } from "@/lib/auth/types";
import { applyRowLayout, EMPTY_ROW_LAYOUT } from "@/lib/rowLayout";

type LayoutsResponse = { layouts: Record<string, RowLayoutPref> };

/**
 * Organisation personnelle des rangées d'une page (ordre + masquage),
 * enregistrée sur le compte de l'utilisateur. Mise à jour optimiste : le
 * clic s'applique tout de suite, l'enregistrement part en arrière-plan.
 */
export function useRowLayout(page: string) {
  const { data, mutate } = useSWR<LayoutsResponse>("/api/profile/row-layout", { revalidateOnFocus: false });
  const [editing, setEditing] = useState(false);
  const layout = data?.layouts?.[page] ?? EMPTY_ROW_LAYOUT;

  const save = useCallback((next: RowLayoutPref) => {
    const layouts = { ...(data?.layouts ?? {}) };
    if (next.order.length === 0 && next.hidden.length === 0) delete layouts[page];
    else layouts[page] = next;
    void mutate(
      fetch("/api/profile/row-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, ...next }),
      }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("save failed")))),
      { optimisticData: { layouts }, rollbackOnError: true, revalidate: false },
    ).catch(() => undefined);
  }, [data, mutate, page]);

  /** Rangées dans l'ordre voulu ; en édition, les masquées restent visibles (estompées) pour pouvoir les réafficher. */
  const arrange = useCallback(<T extends { key: string }>(rows: T[]) => applyRowLayout(rows, layout, { includeHidden: editing }), [layout, editing]);

  const isHidden = (key: string) => layout.hidden.includes(key);

  const move = (rows: { key: string }[], key: string, direction: "up" | "down" | "top") => {
    const keys = applyRowLayout(rows, layout, { includeHidden: true }).map((r) => r.key);
    const i = keys.indexOf(key);
    if (i < 0) return;
    const j = direction === "top" ? 0 : direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= keys.length || j === i) return;
    keys.splice(i, 1);
    keys.splice(j, 0, key);
    save({ order: keys, hidden: layout.hidden });
  };

  const toggleHidden = (rows: { key: string }[], key: string) => {
    const hidden = isHidden(key) ? layout.hidden.filter((k) => k !== key) : [...layout.hidden, key];
    const order = layout.order.length ? layout.order : rows.map((r) => r.key);
    save({ order, hidden });
  };

  const reset = () => save(EMPTY_ROW_LAYOUT);
  const customized = layout.order.length > 0 || layout.hidden.length > 0;

  return { editing, setEditing, arrange, move, toggleHidden, isHidden, reset, customized };
}

export type RowLayoutApi = ReturnType<typeof useRowLayout>;
