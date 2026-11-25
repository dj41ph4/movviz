"use client";

/** Identité de CET appareil pour Movviz Connect (stable d'une visite à l'autre) et réglage « recevoir ». */

import type { DeviceKind } from "./types";

const ID_KEY = "movviz.connect.device";
const RECEIVER_KEY = "movviz.connect.receiver";

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID().replace(/-/g, "");
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`.padEnd(16, "0");
  }
}

let memoryId: string | null = null;

/** Identifiant stable ; sans stockage disponible (navigation privée), stable pour la durée de la page. */
export function getDeviceId(): string {
  if (memoryId) return memoryId;
  try {
    const saved = window.localStorage.getItem(ID_KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return (memoryId = saved);
    const fresh = randomId();
    window.localStorage.setItem(ID_KEY, fresh);
    return (memoryId = fresh);
  } catch {
    return (memoryId = randomId());
  }
}

export function detectDeviceKind(): DeviceKind {
  if (typeof navigator === "undefined") return "web";
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "mobile" : "web";
}

/** « Chrome · Windows », « Safari · iPhone » — lisible dans la liste des appareils. */
export function defaultDeviceName(): string {
  if (typeof navigator === "undefined") return "Movviz";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

export function getReceiverEnabled(): boolean {
  try {
    return window.localStorage.getItem(RECEIVER_KEY) === "1";
  } catch {
    return false;
  }
}

let receiverOverride: boolean | null = null;
const receiverListeners = new Set<() => void>();

export function setReceiverEnabled(on: boolean): void {
  receiverOverride = on;
  try {
    window.localStorage.setItem(RECEIVER_KEY, on ? "1" : "0");
  } catch {
    /* sans stockage : le réglage vaut pour cette page seulement */
  }
  receiverListeners.forEach((fn) => fn());
}

/** Pour useSyncExternalStore : lecture du réglage « recevoir » et abonnement à ses changements. */
export function readReceiverEnabled(): boolean {
  return receiverOverride ?? getReceiverEnabled();
}

export function subscribeReceiverEnabled(fn: () => void): () => void {
  receiverListeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === RECEIVER_KEY) { receiverOverride = null; fn(); } };
  window.addEventListener("storage", onStorage);
  return () => {
    receiverListeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export const CONNECT_EVENT = "movviz:connect";

export interface ConnectEventDetail {
  channel: "connect-roster" | "connect-command" | "connect-state";
  data: unknown;
}
