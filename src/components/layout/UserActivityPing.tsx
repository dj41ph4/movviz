"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { hasForegroundRequests, subscribeForegroundRequests } from "@/lib/priority/foregroundRequests";
import {
  createActivityPingThrottle,
  isUserActivitySignal,
  type ActivityPingThrottle,
} from "@/lib/priority/clientActivitySignal";

/**
 * Les interactions réelles et les navigations maintiennent la priorité de
 * l'utilisateur, sans observer les mouvements de souris ni le contenu saisi.
 * Au plus un POST par seconde ; renouvellement uniquement pendant un vrai
 * chargement sans données. Les pings cessent quand l'onglet devient caché.
 */
export function UserActivityPing() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const enabled = !!user && user.status !== "pending"
    && pathname !== "/login" && pathname !== "/setup";
  const active = useRef(false);
  const throttle = useRef<ActivityPingThrottle | null>(null);
  const foregroundUpdate = useRef<(() => void) | null>(null);

  useEffect(() => {
    active.current = enabled;
    if (!enabled) throttle.current?.cancelPending();
    foregroundUpdate.current?.();
  }, [enabled]);

  useEffect(() => {
    const activity = createActivityPingThrottle(
      () => {
        // Keepalive permet au clic de navigation d'atteindre le serveur.
        fetch("/api/activity/ping", {
          method: "POST", keepalive: true,
          ...(hasForegroundRequests() ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "foreground" }),
          } : {}),
        }).catch(() => void 0);
      },
      {
        now: () => performance.now(),
        schedule: (callback, delay) => window.setTimeout(callback, delay),
        cancel: (timer) => window.clearTimeout(timer),
        isActive: () => active.current && document.visibilityState === "visible",
      },
    );
    throttle.current = activity;
    let foregroundTimer: number | undefined;
    const updateForeground = () => {
      if (foregroundTimer !== undefined) window.clearInterval(foregroundTimer);
      foregroundTimer = undefined;
      if (hasForegroundRequests() && active.current && document.visibilityState === "visible") {
        activity.signal();
        foregroundTimer = window.setInterval(() => activity.signal(), 1_000);
      }
    };
    const unsubscribeForeground = subscribeForegroundRequests(updateForeground);
    foregroundUpdate.current = updateForeground;
    updateForeground();

    const onActivity = (event: Event) => {
      if (isUserActivitySignal(event)) activity.signal();
    };
    const onVisibility = (event: Event) => {
      if (!event.isTrusted) return;
      if (document.visibilityState === "visible") activity.signal();
      else activity.cancelPending();
      updateForeground();
    };
    // Capture couvre aussi les contrôles qui arrêtent la propagation et les
    // conteneurs scrollables. Passive préserve défilement, clavier et IME.
    const options = { capture: true, passive: true };
    const documentEvents = ["pointerdown", "keydown", "wheel", "scroll", "input"];
    for (const type of documentEvents) document.addEventListener(type, onActivity, options);
    window.addEventListener("popstate", onActivity, options);
    window.addEventListener("hashchange", onActivity, options);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const type of documentEvents) document.removeEventListener(type, onActivity, true);
      window.removeEventListener("popstate", onActivity, true);
      window.removeEventListener("hashchange", onActivity, true);
      document.removeEventListener("visibilitychange", onVisibility);
      activity.cancelPending();
      unsubscribeForeground();
      foregroundUpdate.current = null;
      if (foregroundTimer !== undefined) window.clearInterval(foregroundTimer);
      throttle.current = null;
    };
  }, []);

  // Couvre le chargement authentifié et les navigations App Router, y compris
  // celles qui ne passent pas par un pointerdown (retour, clavier, router).
  useEffect(() => {
    if (enabled) throttle.current?.signal();
  }, [enabled, pathname]);

  return null;
}
