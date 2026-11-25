"use client";

/**
 * Pont entre Movviz Connect et le lecteur de CET appareil. Le lecteur et son
 * fournisseur s'y déclarent ; Connect l'utilise pour obéir à un ordre reçu
 * (lire, pause, aller à…) et pour rapporter ce qui se lit.
 */

import type { PlayNowRequest } from "@/lib/player/PlayerProvider";

export interface LocalPlayback {
  playing: boolean;
  buffering: boolean;
  /** Secondes, position réelle dans le titre. */
  position: number;
  duration: number;
  title: string;
  mediaType: "movie" | "series";
  tmdbId?: number;
  season?: number;
  episode?: number;
}

interface ProviderControls {
  play: (request: PlayNowRequest) => void;
  close: () => void;
}

interface ActivePlayer {
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  read: () => LocalPlayback;
}

let provider: ProviderControls | null = null;
let active: ActivePlayer | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const playerBridge = {
  setProvider(next: ProviderControls | null) {
    provider = next;
  },
  setActive(next: ActivePlayer | null) {
    active = next;
    notify();
  },
  play(request: PlayNowRequest): boolean {
    if (!provider) return false;
    provider.play(request);
    return true;
  },
  close() {
    provider?.close();
  },
  /** Le lecteur de cet appareil, s'il est ouvert. */
  current(): ActivePlayer | null {
    return active;
  },
  read(): LocalPlayback | null {
    return active ? active.read() : null;
  },
  /** Prévenu quand un lecteur s'ouvre ou se ferme. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
