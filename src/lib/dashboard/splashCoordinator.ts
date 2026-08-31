"use client";

import { useEffect, useState } from "react";

/**
 * Cross-route signal so global overlays (WhatsNewModal in AppShell) know
 * whether the dashboard's full-screen cold-start splash (DashboardSplash,
 * a sibling component with no shared parent state) is currently covering
 * the screen. Bug fixed: the "what's new" modal used to pop up on top of
 * the splash (higher z-index) instead of waiting for it to finish, because
 * neither component knew about the other. Module-level state on
 * `globalThis`, same pattern as `__movvizFsJsonCache`/`__movvizPerf` — Next
 * bundles modules per-route, so a plain module variable wouldn't be shared.
 */
const g = globalThis as typeof globalThis & {
  __movvizSplashActive?: boolean;
  __movvizSplashListeners?: Set<() => void>;
};

function listeners(): Set<() => void> {
  return (g.__movvizSplashListeners ??= new Set());
}

export function setSplashActive(active: boolean): void {
  if (g.__movvizSplashActive === active) return;
  g.__movvizSplashActive = active;
  for (const listener of listeners()) listener();
}

export function useSplashActive(): boolean {
  const [active, setActive] = useState(() => !!g.__movvizSplashActive);
  useEffect(() => {
    const listener = () => setActive(!!g.__movvizSplashActive);
    listener();
    listeners().add(listener);
    return () => { listeners().delete(listener); };
  }, []);
  return active;
}
