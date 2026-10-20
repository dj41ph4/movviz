"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { rememberSearch } from "./recentSearches";

/**
 * THE search entry point (films/séries/acteurs/réalisateurs) — shared by
 * the desktop nav rail (Sidebar) and the mobile topbar, so both stay behind
 * the exact same debounce/navigation behavior instead of two hand-rolled
 * copies drifting apart. Typing pushes to /discover?q=, whose own card grid
 * replaces the dashboard; Découverte reads `q` reactively from the URL
 * since this hook is the only thing that ever writes it.
 */
export function useNavSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [value, setValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(false);
  // Last query recorded during the current typing session — "s", "st",
  // "str"… all collapse into one recent-search entry instead of one each.
  const sessionQueryRef = useRef<string | null>(null);

  // Keeps the box empty once the user has left Découverte (a stale leftover
  // query would be confusing back on the dashboard), picks up a bookmarked/
  // shared "/discover?q=..." link's own value on direct load, AND stays in
  // sync with Découverte's own resets (Réinitialiser, switching Films/
  // Séries) that clear `q` without a pathname change of their own.
  useEffect(() => {
    // An older router.push may settle while the user is still typing. Never
    // copy that older URL into the controlled input and discard new letters.
    if (pathname !== "/discover" || !focusedRef.current) {
      setValue(pathname === "/discover" ? (searchParams.get("q") ?? "") : "");
    }
    // Leaving Découverte cancels a pending search navigation. URL changes
    // while staying on Découverte must not cancel the user's next keystroke.
    if (debounceRef.current && pathname !== "/discover") {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [pathname, searchParams]);

  const navigate = (query: string) => {
    const target = query ? `/discover?q=${encodeURIComponent(query)}` : "/discover";
    // One history entry per search: entering a search pushes, every later
    // letter (or the final clear) replaces — Back never replays "s", "st"…
    const searching = pathname === "/discover" && !!searchParams.get("q");
    if (searching) router.replace(target, { scroll: false });
    else router.push(target, { scroll: false });
    if (query.length >= 2) {
      rememberSearch(query, sessionQueryRef.current);
      sessionQueryRef.current = query;
    }
  };

  const onChange = (next: string) => {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = next.trim();
    // Clearing the box returns to the catalog immediately — nothing to wait for.
    if (!query) { debounceRef.current = null; navigate(""); return; }
    debounceRef.current = setTimeout(() => navigate(query), 300);
  };

  /** Runs a query right away (recent search or suggestion click). */
  const submit = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    sessionQueryRef.current = null;
    setValue(query);
    navigate(query.trim());
  };

  return {
    value,
    onChange,
    submit,
    onFocus: () => { focusedRef.current = true; sessionQueryRef.current = null; },
    onBlur: () => { focusedRef.current = false; },
  };
}
