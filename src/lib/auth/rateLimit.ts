import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Limiteur d'échecs de connexion, en mémoire (même convention globalThis que le reste de l'app :
 * partagé entre bundles, remis à zéro au redémarrage — c'est voulu, jamais de verrou persistant
 * qui pourrait enfermer le propriétaire dehors).
 *
 * Seuls les ÉCHECS comptent : un utilisateur légitime qui se connecte du premier coup n'est jamais
 * ralenti, et une connexion réussie efface son compteur. Les seuils sont larges (un humain qui se
 * trompe de mot de passe quelques fois ne verra jamais le blocage) mais ferment la force brute.
 */

interface Bucket { count: number; windowStart: number; blockedUntil: number }

const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 5 * 60 * 1000;
const MAX_BUCKETS = 5000;

const store = globalThis as typeof globalThis & { __movvizLoginBuckets?: Map<string, Bucket> };
const buckets = (store.__movvizLoginBuckets ??= new Map<string, Bucket>());

// Limites d'échecs par fenêtre : même pseudo + même adresse, même pseudo (adresse usurpée), même adresse.
const LIMIT_PAIR = 8;
const LIMIT_USER = 30;
const LIMIT_IP = 40;

function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, b] of buckets) if (b.blockedUntil < now && now - b.windowStart > WINDOW_MS) buckets.delete(key);
  // Borne dure : si l'on est toujours plein (attaque massive), on repart d'une table vide.
  if (buckets.size >= MAX_BUCKETS) buckets.clear();
}

function keysFor(ip: string, username: string): { key: string; limit: number }[] {
  const user = username.trim().toLowerCase().slice(0, 80);
  return [
    { key: `pair|${ip}|${user}`, limit: LIMIT_PAIR },
    { key: `user|${user}`, limit: LIMIT_USER },
    { key: `ip|${ip}`, limit: LIMIT_IP },
  ];
}

/** Adresse du client telle que vue par le serveur (derrière un proxy inverse : premier saut de x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || req.headers.get("x-real-ip") || "local").slice(0, 64);
}

/** Secondes restantes avant la prochaine tentative autorisée, ou 0 si la connexion peut être tentée. */
export function loginBlockedFor(ip: string, username: string): number {
  const now = Date.now();
  let wait = 0;
  for (const { key } of keysFor(ip, username)) {
    const b = buckets.get(key);
    if (b && b.blockedUntil > now) wait = Math.max(wait, Math.ceil((b.blockedUntil - now) / 1000));
  }
  return wait;
}

export function recordLoginFailure(ip: string, username: string): void {
  const now = Date.now();
  prune(now);
  for (const { key, limit } of keysFor(ip, username)) {
    let b = buckets.get(key);
    if (!b || now - b.windowStart > WINDOW_MS) {
      b = { count: 0, windowStart: now, blockedUntil: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count >= limit) {
      b.blockedUntil = now + BLOCK_MS;
      b.count = 0;
      b.windowStart = now;
    }
  }
}

export function recordLoginSuccess(ip: string, username: string): void {
  // Seul le couple pseudo+adresse est effacé : un succès ne doit pas remettre à zéro le compteur par adresse
  // qu'un attaquant alimenterait avec son propre compte.
  buckets.delete(keysFor(ip, username)[0].key);
}

/** Comparaison de secrets à temps constant (jetons, signatures). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ---- Inscriptions : plafond par adresse pour éviter le remplissage de la liste « en attente ». ----

const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_LIMIT = 20;
const regStore = globalThis as typeof globalThis & { __movvizRegisterHits?: Map<string, number[]> };
const registerHits = (regStore.__movvizRegisterHits ??= new Map<string, number[]>());

/** Compte une tentative d'inscription ; false = plafond atteint pour cette adresse. */
export function allowRegistration(ip: string): boolean {
  const now = Date.now();
  if (registerHits.size > MAX_BUCKETS) registerHits.clear();
  const recent = (registerHits.get(ip) ?? []).filter((t) => now - t < REGISTER_WINDOW_MS);
  if (recent.length >= REGISTER_LIMIT) { registerHits.set(ip, recent); return false; }
  recent.push(now);
  registerHits.set(ip, recent);
  return true;
}
