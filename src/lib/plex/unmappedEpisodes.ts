import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { PlexServerConfig } from "./types";
import { batchTmdbIds, getEpisodeIdentities, type PlexEpisodeIdentity } from "./client";

/**
 * Registre des épisodes VUS dans Plex mais absents de la bibliothèque Movviz (aucune fiche ne porte
 * leur clé Plex), regroupés par série. Alimenté par la synchro des vues Plex ; l'administrateur les
 * ajoute ou les ignore À LA MAIN dans Réglages → Plex. Rien n'est ajouté automatiquement : une série
 * supprimée exprès de Movviz mais vue par quelqu'un reviendrait sinon toute seule.
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "plex-unmapped.json");

/** Clés inconnues nommées par passage (50 par requête) : le reste est repris au passage suivant. */
const MAX_NEW_LOOKUPS = 400;

export interface UnmappedEpisode {
  ratingKey: string;
  season: number;
  episode: number;
  title: string;
}

export interface UnmappedShow {
  showKey: string;
  showTitle: string;
  /** Identifiant TMDb de la série d'après Plex ; null = Plex ne l'a pas associée à TMDb. */
  tmdbId: number | null;
  /** Vrai une fois la série interrogée (tmdbId peut alors rester null). */
  tmdbChecked: boolean;
  episodes: UnmappedEpisode[];
  firstSeenAt: number;
  updatedAt: number;
  /** Ignorée par l'administrateur : masquée de la liste tant qu'il ne la rétablit pas. */
  dismissed: boolean;
}

export interface UnmappedRegistry {
  version: 1;
  shows: Record<string, UnmappedShow>;
}

const empty = (): UnmappedRegistry => ({ version: 1, shows: {} });

export function loadUnmappedRegistry(): UnmappedRegistry {
  const raw = readJsonCached<UnmappedRegistry | null>(FILE, null);
  return raw && raw.version === 1 && raw.shows ? raw : empty();
}

function saveUnmappedRegistry(registry: UnmappedRegistry) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, registry);
}

/**
 * Fusion pure : le registre précédent + ce que Plex vient de dire. Seuls les épisodes encore vus ET
 * toujours sans fiche restent ; les séries ignorées, la date de première apparition et l'identité déjà
 * résolue sont conservées. Une clé dont l'identité n'est pas (encore) connue est sautée, pas perdue.
 */
export function mergeUnmappedRegistry(
  previous: UnmappedRegistry,
  unmappedRatingKeys: Iterable<string>,
  identities: Map<string, PlexEpisodeIdentity>,
  tmdbByShow: Map<string, number | null>,
  now: number,
): UnmappedRegistry {
  const known = new Map<string, PlexEpisodeIdentity>();
  for (const show of Object.values(previous.shows)) {
    for (const e of show.episodes) {
      known.set(e.ratingKey, { ratingKey: e.ratingKey, title: e.title, showKey: show.showKey, showTitle: show.showTitle, season: e.season, episode: e.episode });
    }
  }
  for (const [rk, identity] of identities) known.set(rk, identity);

  const grouped = new Map<string, PlexEpisodeIdentity[]>();
  for (const rk of new Set(unmappedRatingKeys)) {
    const identity = known.get(rk);
    if (!identity) continue;
    const list = grouped.get(identity.showKey) ?? [];
    list.push(identity);
    grouped.set(identity.showKey, list);
  }

  const shows: Record<string, UnmappedShow> = {};
  for (const [showKey, episodes] of grouped) {
    const before = previous.shows[showKey];
    const resolved = tmdbByShow.has(showKey);
    shows[showKey] = {
      showKey,
      showTitle: episodes[0].showTitle || before?.showTitle || "",
      tmdbId: resolved ? (tmdbByShow.get(showKey) ?? null) : (before?.tmdbId ?? null),
      tmdbChecked: resolved || before?.tmdbChecked === true,
      episodes: episodes
        .map((e) => ({ ratingKey: e.ratingKey, season: e.season, episode: e.episode, title: e.title }))
        .sort((a, b) => a.season - b.season || a.episode - b.episode),
      firstSeenAt: before?.firstSeenAt ?? now,
      updatedAt: now,
      dismissed: before?.dismissed === true,
    };
  }
  return { version: 1, shows };
}

/**
 * Appelé par la synchro des vues Plex avec les épisodes vus sans fiche. Lecture seule côté Plex ;
 * borné (400 nouvelles clés par passage) ; sans effet sur la synchro si Plex ne répond pas.
 */
export async function refreshUnmappedRegistry(
  cfg: PlexServerConfig,
  token: string,
  unmappedRatingKeys: string[],
  now = Date.now(),
): Promise<{ shows: number; episodes: number }> {
  const previous = loadUnmappedRegistry();
  const known = new Set<string>();
  for (const show of Object.values(previous.shows)) for (const e of show.episodes) known.add(e.ratingKey);

  const fresh = unmappedRatingKeys.filter((rk) => !known.has(rk)).slice(0, MAX_NEW_LOOKUPS);
  const identities = fresh.length > 0 ? await getEpisodeIdentities(cfg, token, fresh) : new Map<string, PlexEpisodeIdentity>();

  // Séries à interroger côté TMDb : celles qu'on vient de découvrir et celles jamais résolues.
  const toResolve = new Set<string>();
  for (const identity of identities.values()) toResolve.add(identity.showKey);
  for (const show of Object.values(previous.shows)) if (!show.tmdbChecked) toResolve.add(show.showKey);
  const tmdbByShow = new Map<string, number | null>();
  if (toResolve.size > 0) {
    const infos = await batchTmdbIds(cfg, token, [...toResolve]);
    // Absent de la réponse = requête échouée : la série reste « non vérifiée » et sera redemandée.
    for (const key of toResolve) if (infos.has(key)) tmdbByShow.set(key, infos.get(key)?.tmdbId ?? null);
  }

  const merged = mergeUnmappedRegistry(previous, unmappedRatingKeys, identities, tmdbByShow, now);
  const changed = JSON.stringify(stripTimes(merged)) !== JSON.stringify(stripTimes(previous));
  if (changed) saveUnmappedRegistry(merged);
  return { shows: Object.keys(merged.shows).length, episodes: Object.values(merged.shows).reduce((n, s) => n + s.episodes.length, 0) };
}

/** Comparaison sans les horodatages, pour ne pas réécrire le fichier à chaque passage identique. */
function stripTimes(registry: UnmappedRegistry) {
  return Object.values(registry.shows).map((s) => ({ ...s, updatedAt: 0 }));
}

export function setShowsDismissed(showKeys: string[], dismissed: boolean): number {
  const registry = loadUnmappedRegistry();
  let changed = 0;
  for (const key of showKeys) {
    const show = registry.shows[key];
    if (!show || show.dismissed === dismissed) continue;
    registry.shows[key] = { ...show, dismissed };
    changed++;
  }
  if (changed > 0) saveUnmappedRegistry(registry);
  return changed;
}

/** Retire des séries du registre (après ajout à la bibliothèque) ; la synchro suivante les recalcule. */
export function removeUnmappedShows(showKeys: string[]): void {
  const registry = loadUnmappedRegistry();
  let changed = false;
  for (const key of showKeys) {
    if (key in registry.shows) { delete registry.shows[key]; changed = true; }
  }
  if (changed) saveUnmappedRegistry(registry);
}
