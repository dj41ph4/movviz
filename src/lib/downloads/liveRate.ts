"use client";

import { useSyncExternalStore } from "react";

/**
 * Débit temps réel partagé : UN seul sondage pour toute l'application, quel que
 * soit le nombre de composants abonnés (icône de la barre du haut, tuile des
 * téléchargements…).
 *
 * Coût maîtrisé : 2 requêtes par seconde seulement tant que quelque chose
 * transfère, puis 1 toutes les 4 s au repos ; arrêt complet onglet masqué et
 * sans abonné. La réponse est minuscule (deux nombres).
 */
export interface LiveRate {
  down: number;
  up: number;
  /** Derniers échantillons, du plus ancien au plus récent (1 toutes les 500 ms quand ça transfère). */
  downs: number[];
  ups: number[];
  /** Vrai dès qu'au moins un octet circule. */
  active: boolean;
}

const ACTIVE_MS = 500;
const IDLE_MS = 4000;
const HISTORY = 60;

let snapshot: LiveRate = { down: 0, up: 0, downs: [], ups: [], active: false };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let running = false;

function emit(next: LiveRate) {
  snapshot = next;
  listeners.forEach((l) => l());
}

async function tick() {
  timer = null;
  if (!running) return;
  if (typeof document !== "undefined" && document.hidden) return; // reprise sur visibilitychange
  controller = new AbortController();
  let delay = IDLE_MS;
  try {
    const res = await fetch("/api/engine/stats", { cache: "no-store", signal: controller.signal });
    if (res.ok) {
      const data = (await res.json()) as { downloadSpeed?: number; uploadSpeed?: number };
      const down = Math.max(0, data.downloadSpeed ?? 0);
      const up = Math.max(0, data.uploadSpeed ?? 0);
      const active = down > 0 || up > 0;
      emit({ down, up, active, downs: [...snapshot.downs, down].slice(-HISTORY), ups: [...snapshot.ups, up].slice(-HISTORY) });
      delay = active ? ACTIVE_MS : IDLE_MS;
    }
  } catch {
    /* hors ligne / interrompu : on réessaie au rythme du repos */
  }
  if (running) timer = setTimeout(tick, delay);
}

function onVisibility() {
  if (!running) return;
  if (document.hidden) {
    if (timer) clearTimeout(timer);
    timer = null;
    controller?.abort();
  } else if (!timer) {
    void tick();
  }
}

function start() {
  if (running) return;
  running = true;
  document.addEventListener("visibilitychange", onVisibility);
  void tick();
}

function stop() {
  running = false;
  document.removeEventListener("visibilitychange", onVisibility);
  if (timer) clearTimeout(timer);
  timer = null;
  controller?.abort();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = () => snapshot;
const SERVER_SNAPSHOT: LiveRate = { down: 0, up: 0, downs: [], ups: [], active: false };
const getServerSnapshot = (): LiveRate => SERVER_SNAPSHOT;

export function useLiveRate(): LiveRate {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
