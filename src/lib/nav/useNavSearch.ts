"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

  // Keeps the box empty once the user has left Découverte (a stale leftover
  // query would be confusing back on the dashboard), picks up a bookmarked/
  // shared "/discover?q=..." link's own value on direct load, AND stays in
  // sync with Découverte's own resets (Réinitialiser, switching Films/
  // Séries) that clear `q` without a pathname change of their own.
  useEffect(() => {
    setValue(pathname === "/discover" ? (searchParams.get("q") ?? "") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  const onChange = (next: string) => {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(next.trim() ? `/discover?q=${encodeURIComponent(next.trim())}` : "/discover");
    }, 300);
  };

  return { value, onChange };
}
