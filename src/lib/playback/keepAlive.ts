"use client";

/**
 * Garde la lecture à plein régime quand la fenêtre du film est cachée (jeu en plein écran sur
 * l'autre écran, onglet en arrière-plan). Deux protections, toutes deux sans effet si le
 * navigateur ne les prend pas en charge :
 *
 * - `sleep()` : minuterie portée par un Web Worker. Chrome ralentit les `setTimeout` d'une page
 *   cachée (1 s, puis 1 min après 5 min) mais pas ceux d'un Worker ; les boucles de remplissage
 *   du tampon profond ne prennent donc plus de retard. La minuterie de la page reste armée en
 *   secours : la première des deux qui répond gagne, donc au pire on retombe sur le comportement
 *   d'avant.
 * - `holdPlaybackLock()` : un verrou Web Locks tenu pendant la lecture. Chrome ne gèle pas une
 *   page qui en tient un (le gel d'onglet coupe tout JavaScript, fetch compris).
 */

import { useEffect } from "react";

const WORKER_SOURCE =
  "onmessage=function(e){var d=e.data;setTimeout(function(){postMessage(d.id)},d.ms)}";

type Pending = Map<number, () => void>;

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending: Pending = new Map();

function getWorker(): Worker | null {
  if (workerBroken || typeof window === "undefined" || typeof Worker !== "function") return null;
  if (worker) return worker;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = (e: MessageEvent<number>) => {
      const done = pending.get(e.data);
      if (done) done();
    };
    w.onerror = () => {
      workerBroken = true;
      worker = null;
      try { w.terminate(); } catch { /* déjà arrêté */ }
      // Les attentes en cours se terminent par leur minuterie de secours.
    };
    worker = w;
    return w;
  } catch {
    workerBroken = true;
    return null;
  }
}

/** Attend `ms` millisecondes ; ne prend pas de retard quand la page est cachée. */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const w = getWorker();
    let finished = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const id = ++seq;
    const done = () => {
      if (finished) return;
      finished = true;
      pending.delete(id);
      if (fallback !== undefined) clearTimeout(fallback);
      resolve();
    };
    if (w) {
      pending.set(id, done);
      try { w.postMessage({ id, ms }); } catch { pending.delete(id); }
    }
    // Secours (et seule minuterie sans Worker) : un peu plus tard, pour laisser la priorité au Worker.
    fallback = setTimeout(done, w ? ms + 1500 : ms);
  });
}

/** Tient un verrou partagé jusqu'à l'appel de la fonction renvoyée. Sans effet si indisponible. */
export function holdPlaybackLock(): () => void {
  let release: (() => void) | null = null;
  let released = false;
  try {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks) return () => void 0;
    void locks
      .request("movviz-playback", { mode: "shared" }, () => new Promise<void>((resolve) => {
        if (released) resolve();
        else release = resolve;
      }))
      .catch(() => void 0);
  } catch {
    return () => void 0;
  }
  return () => {
    released = true;
    release?.();
  };
}

/** Verrou de lecture tenu tant que le lecteur est affiché. */
export function usePlaybackKeepAlive(): void {
  useEffect(() => holdPlaybackLock(), []);
}
