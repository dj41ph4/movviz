"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, CornerDownLeft, Film, Magnet, Search, Tv, type LucideIcon } from "lucide-react";
import { NAV, GESTION_NAV } from "@/lib/nav";
import { SETTINGS_TABS, matchesSettingsQuery } from "@/lib/settingsNav";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { lockBodyScroll } from "@/lib/dom/bodyScrollLock";
import { TmdbImage } from "@/components/media/TmdbImage";
import { useT } from "@/i18n/provider";
import { usePremiumAppearance } from "@/components/appearance/AppearanceProvider";
import { cn } from "@/lib/utils";
import type { MetaSearchResult } from "@/lib/metadata/types";

/*
 * Palette de commandes (apparence Bêta, desktop) : un seul point d'entrée pour
 * les titres, les pages, les réglages et les recherches. Elle ne remplace
 * aucun moteur : les titres viennent de /api/metadata/search (comme
 * Découverte), « Rechercher dans Découverte » pousse le même /discover?q=
 * que l'ancienne barre, et la recherche torrent ouvre /search?q=.
 */

const OPEN_EVENT = "movviz:command-palette";

/** Ouvre la palette depuis n'importe quel composant (barre du haut, raccourci). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Entry = {
  id: string;
  section: "actions" | "titles" | "pages" | "settings";
  label: string;
  hint?: string;
  icon?: LucideIcon;
  posterPath?: string | null;
  href: string;
};

const SECTION_KEYS: Record<Entry["section"], string> = {
  actions: "nav.commandActions",
  titles: "nav.commandTitles",
  pages: "nav.commandPages",
  settings: "nav.commandSettings",
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandPalette() {
  const enabled = usePremiumAppearance();
  const t = useT();
  const router = useRouter();
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [titleResults, setTitleResults] = useState<{ query: string; items: MetaSearchResult[] }>({ query: "", items: [] });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Ctrl K / ⌘ K et l'évènement d'ouverture. Rien n'est écouté hors Bêta.
  useEffect(() => {
    if (!enabled) return;
    const show = () => {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) close(); else show();
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(OPEN_EVENT, show); window.removeEventListener("keydown", onKey); };
  }, [enabled, open]);

  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    inputRef.current?.focus();
    return () => {
      unlock();
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  // Fermer remet la palette à zéro pour la prochaine ouverture.
  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  const trimmed = query.trim();
  // Les résultats d'une frappe précédente ne s'affichent jamais sous une autre requête.
  const titles = useMemo(() => (trimmed.length >= 2 && titleResults.query === trimmed ? titleResults.items : []), [trimmed, titleResults]);

  // Titres : même source que Découverte, avec un petit délai de frappe.
  useEffect(() => {
    if (!open || trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/metadata/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store", signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((data: { results?: MetaSearchResult[] }) => setTitleResults({ query: trimmed, items: (data.results ?? []).filter((r) => r.type === "movie" || r.type === "series").slice(0, 6) }))
        .catch(() => { /* Abandon ou hors ligne : les autres sections restent utilisables. */ });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, trimmed]);

  const entries = useMemo<Entry[]>(() => {
    const q = normalize(trimmed);
    const list: Entry[] = [];
    if (trimmed) {
      list.push({ id: "action:discover", section: "actions", label: t("nav.commandSearchDiscover", { query: trimmed }), icon: Compass, href: `/discover?q=${encodeURIComponent(trimmed)}` });
      list.push({ id: "action:torrent", section: "actions", label: t("nav.commandSearchTorrent", { query: trimmed }), icon: Magnet, href: `/search?q=${encodeURIComponent(trimmed)}` });
    }
    for (const r of titles) {
      list.push({
        id: `title:${r.type}:${r.tmdbId}`, section: "titles", label: r.title,
        hint: [r.type === "movie" ? t("common.movies") : t("common.series"), r.year].filter(Boolean).join(" · "),
        icon: r.type === "movie" ? Film : Tv, posterPath: r.posterPath,
        href: `/title/${r.type === "movie" ? "movie" : "series"}/${r.tmdbId}`,
      });
    }
    const pages = [...NAV, ...GESTION_NAV].filter((item) => !item.adminOnly || isAdmin);
    for (const item of pages) {
      const label = t(item.labelKey);
      if (q && !normalize(label).includes(q) && !normalize(t(item.hintKey)).includes(q)) continue;
      list.push({ id: `page:${item.href}`, section: "pages", label, hint: t(item.hintKey), icon: item.icon, href: item.href });
    }
    if (q) {
      const settings = SETTINGS_TABS.filter((tab) => (!tab.adminOnly || isAdmin) && matchesSettingsQuery(tab, trimmed, t)).slice(0, 6);
      for (const tab of settings) {
        list.push({ id: `settings:${tab.id}`, section: "settings", label: t(tab.labelKey), hint: t(tab.hintKey), icon: tab.icon, href: `/settings?tab=${tab.id}` });
      }
    }
    return list;
  }, [trimmed, titles, isAdmin, t]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!enabled || !open) return null;

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    restoreFocusRef.current = null;
    close();
    router.push(entry.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(entries.length - 1, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === "Enter") { event.preventDefault(); go(entries[active]); }
    else if (event.key === "Tab") event.preventDefault();
  };

  let lastSection: Entry["section"] | null = null;
  const activeId = entries[active] ? `command-option-${active}` : undefined;

  return (
    <div className="nx-command fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="nx-command-scrim pointer-events-none absolute inset-0 bg-black/60" aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={t("nav.commandOpen")} onKeyDown={onKeyDown} className="nx-command-panel relative flex rounded-2xl border border-white/15 bg-[#141729] shadow-2xl max-h-[min(620px,72vh)] w-full max-w-[640px] flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.08] px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-ink-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder={t("nav.commandPlaceholder")}
            aria-label={t("nav.commandPlaceholder")}
            role="combobox"
            aria-expanded
            aria-controls="command-listbox"
            aria-activedescendant={activeId}
            type="search"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-dim"
          />
          <kbd className="nx-kbd">Esc</kbd>
        </div>
        <div ref={listRef} id="command-listbox" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
          {entries.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-dim">{t("nav.commandEmpty")}</p>}
          {entries.map((entry, index) => {
            const header = entry.section !== lastSection ? t(SECTION_KEYS[entry.section]) : null;
            lastSection = entry.section;
            const Icon = entry.icon;
            return (
              <div key={entry.id}>
                {header && <p className="nx-command-section px-3 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-dim">{header}</p>}
                <div
                  id={`command-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  onMouseMove={() => { if (index !== active) setActive(index); }}
                  onClick={() => go(entry)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2", index === active ? "bg-white/[0.07] text-ink" : "text-ink-soft")}
                >
                  {entry.section === "titles"
                    ? <span className="flex h-11 w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-white/[0.06]">{entry.posterPath ? <TmdbImage path={entry.posterPath} size="w92" alt="" className="h-full w-full object-cover" /> : Icon && <Icon className="h-4 w-4 text-ink-dim" />}</span>
                    : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">{Icon && <Icon className="h-4 w-4" />}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{entry.label}</span>
                    {entry.hint && <span className="block truncate text-xs text-ink-dim">{entry.hint}</span>}
                  </span>
                  {index === active && <CornerDownLeft className="h-4 w-4 shrink-0 text-ink-dim" />}
                </div>
              </div>
            );
          })}
        </div>
        <p className="shrink-0 border-t border-white/[0.08] px-4 py-2.5 text-[11px] text-ink-dim">{t("nav.commandHint")}</p>
      </div>
    </div>
  );
}
