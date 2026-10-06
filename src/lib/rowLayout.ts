import type { RowLayoutPref } from "@/lib/auth/types";

export const EMPTY_ROW_LAYOUT: RowLayoutPref = { order: [], hidden: [] };

/**
 * Applique l'organisation personnelle à la liste de rangées du serveur.
 * Les rangées citées dans `order` passent en premier, dans cet ordre ; toute
 * rangée inconnue de la préférence (nouvelle rangée, clé dynamique comme
 * "becauseYouWatched:…") garde sa place par défaut à la suite. Les clés
 * périmées de la préférence sont simplement ignorées.
 */
export function applyRowLayout<T extends { key: string }>(
  rows: T[],
  layout: RowLayoutPref,
  { includeHidden = false }: { includeHidden?: boolean } = {},
): T[] {
  const hidden = new Set(layout.hidden);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const ordered: T[] = [];
  for (const key of layout.order) {
    const row = byKey.get(key);
    if (row) {
      ordered.push(row);
      byKey.delete(key);
    }
  }
  for (const row of rows) if (byKey.has(row.key)) ordered.push(row);
  return includeHidden ? ordered : ordered.filter((row) => !hidden.has(row.key));
}

const MAX_KEYS = 200;
const MAX_KEY_LENGTH = 120;

export function sanitizeRowLayout(input: unknown): RowLayoutPref | null {
  if (!input || typeof input !== "object") return null;
  const { order, hidden } = input as Record<string, unknown>;
  const clean = (value: unknown): string[] | null => {
    if (!Array.isArray(value)) return null;
    const out = value.filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= MAX_KEY_LENGTH);
    return [...new Set(out)].slice(0, MAX_KEYS);
  };
  const o = clean(order);
  const h = clean(hidden);
  return o && h ? { order: o, hidden: h } : null;
}
