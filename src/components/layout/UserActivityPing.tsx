"use client";

import { useEffect, useRef } from "react";

/**
 * Marqueur d'activité utilisateur côté client : à chaque pointerdown réel
 * (clic souris, toucher, stylet — en phase capture, donc même sur un clic
 * qui déclenche une navigation), envoie un ping POST déterministe à
 * /api/activity/ping qui enregistre l'activité dans le processus serveur.
 * C'est le signal qui fait céder l'arrière-plan (yieldToUser) dès le clic,
 * pour que la navigation et le chargement de page restent prioritaires.
 *
 * Limitné à ~1 ping/s : la fenêtre d'activité côté serveur est de 2,5 s
 * (reprise après 4 s d'inactivité) — un clic par seconde pendant une session
 * de clics suffit largement à maintenir la priorité, sans marteler le
 * serveur. keepalive garantit l'envoi même si la page navigue aussitôt.
 */
export function UserActivityPing() {
  const lastSent = useRef(0);

  useEffect(() => {
    const THROTTLE_MS = 1_000;
    const ping = () => {
      const now = Date.now();
      if (now - lastSent.current < THROTTLE_MS) return;
      lastSent.current = now;
      fetch("/api/activity/ping", { method: "POST", keepalive: true }).catch(() => void 0);
    };
    const onPointer = (e: PointerEvent) => {
      // Seul un vrai clic/interaction physique compte — pointermove, hover
      // et événements synthétiques (programmatic .click()) sont ignorés.
      if (e.pointerType === "" || e.detail < 1) return;
      ping();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
