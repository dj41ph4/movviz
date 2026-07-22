"use client";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { MOVIE_CATEGORIES, TV_CATEGORIES, type CategoryNode } from "@/lib/indexers/categories";
import { Film, Tv, Check, Tags } from "lucide-react";

const isMovieRange = (id: number) => id >= 2000 && id < 3000;
const isTvRange = (id: number) => id >= 5000 && id < 6000;

function flatten(cats: CategoryNode[]): { id: number; name: string }[] {
  const out: { id: number; name: string }[] = [];
  for (const c of cats) {
    out.push({ id: c.id, name: c.name });
    for (const child of c.children ?? []) out.push({ id: child.id, name: child.name });
  }
  return out;
}

/**
 * Movies vs. series category checklist. When the indexer's own caps
 * response declared its real category tree (indexerCategories — parsed in
 * torznab.ts from t=caps, cached once the indexer has been tested), shows
 * THAT indexer's actual ids/names — a private tracker's numbering only
 * usually lines up with the standard Torznab tree, so checking against the
 * indexer directly beats assuming a fixed list. Falls back to the generic
 * standard tree for an indexer that hasn't been tested yet.
 */
export function CategoryPicker({
  value, onChange, indexerCategories,
}: {
  value: number[];
  onChange: (categories: number[]) => void;
  indexerCategories?: CategoryNode[];
}) {
  const t = useT();

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((c) => c !== id) : [...value, id]);
  };
  const toggleMany = (ids: number[]) => {
    const allOn = ids.every((id) => value.includes(id));
    onChange(allOn ? value.filter((c) => !ids.includes(c)) : [...new Set([...value, ...ids])]);
  };

  if (indexerCategories && indexerCategories.length > 0) {
    const all = flatten(indexerCategories);
    const movies = all.filter((c) => isMovieRange(c.id));
    const series = all.filter((c) => isTvRange(c.id));
    const other = all.filter((c) => !isMovieRange(c.id) && !isTvRange(c.id));
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {movies.length > 0 && (
          <FlatGroup icon={Film} label={t("common.movies")} items={movies} value={value} toggle={toggle} toggleMany={toggleMany} />
        )}
        {series.length > 0 && (
          <FlatGroup icon={Tv} label={t("common.series")} items={series} value={value} toggle={toggle} toggleMany={toggleMany} />
        )}
        {other.length > 0 && (
          <FlatGroup icon={Tags} label={t("indexerMgr.otherCategories")} items={other} value={value} toggle={toggle} toggleMany={toggleMany} className="sm:col-span-2" />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CategoryGroup group={MOVIE_CATEGORIES} icon={Film} label={t("common.movies")} value={value} toggle={toggle} toggleGroup={(g) => toggleMany(groupIds(g))} />
        <CategoryGroup group={TV_CATEGORIES} icon={Tv} label={t("common.series")} value={value} toggle={toggle} toggleGroup={(g) => toggleMany(groupIds(g))} />
      </div>
      <p className="mt-2 text-[11px] text-ink-dim">{t("indexerMgr.categoriesFallbackHint")}</p>
    </div>
  );
}

const groupIds = (group: CategoryNode) => [group.id, ...(group.children ?? []).map((c) => c.id)];

function FlatGroup({
  icon: Icon, label, items, value, toggle, toggleMany, className,
}: {
  icon: React.ElementType;
  label: string;
  items: { id: number; name: string }[];
  value: number[];
  toggle: (id: number) => void;
  toggleMany: (ids: number[]) => void;
  className?: string;
}) {
  const ids = items.map((i) => i.id);
  const allOn = ids.every((id) => value.includes(id));
  const someOn = ids.some((id) => value.includes(id));

  return (
    <div className={cn("rounded-xl border border-white/8 bg-black/20 p-3", className)}>
      <button onClick={() => toggleMany(ids)} className="mb-2 flex w-full items-center gap-2 text-left">
        <Checkbox on={allOn} indeterminate={!allOn && someOn} />
        <Icon className="h-4 w-4 text-brand-glow" />
        <span className="text-sm font-bold text-ink">{label}</span>
      </button>
      <div className="space-y-1 pl-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/5"
          >
            <Checkbox on={value.includes(item.id)} />
            <span className="truncate text-xs text-ink-soft">{item.name}</span>
            <span className="ml-auto shrink-0 text-[10px] text-ink-dim">{item.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryGroup({
  group, icon: Icon, label, value, toggle, toggleGroup,
}: {
  group: CategoryNode;
  icon: React.ElementType;
  label: string;
  value: number[];
  toggle: (id: number) => void;
  toggleGroup: (group: CategoryNode) => void;
}) {
  const ids = groupIds(group);
  const allOn = ids.every((id) => value.includes(id));
  const someOn = ids.some((id) => value.includes(id));

  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <button
        onClick={() => toggleGroup(group)}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <Checkbox on={allOn} indeterminate={!allOn && someOn} />
        <Icon className="h-4 w-4 text-brand-glow" />
        <span className="text-sm font-bold text-ink">{label}</span>
      </button>
      <div className="space-y-1 pl-1">
        {(group.children ?? []).map((child) => (
          <button
            key={child.id}
            onClick={() => toggle(child.id)}
            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/5"
          >
            <Checkbox on={value.includes(child.id)} />
            <span className="text-xs text-ink-soft">{child.name}</span>
            <span className="ml-auto text-[10px] text-ink-dim">{child.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Checkbox({ on, indeterminate }: { on: boolean; indeterminate?: boolean }) {
  return (
    <span className={cn(
      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
      on || indeterminate ? "border-brand bg-brand/80" : "border-white/20"
    )}>
      {on && <Check className="h-3 w-3 text-white" />}
      {!on && indeterminate && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
    </span>
  );
}
