import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { User } from "@/lib/auth/types";

/**
 * Profils de foyer Android TV — « qui est-ce ? » façon Netflix, encrés dans
 * le serveur.
 *
 * Un profil TV référence un compte Movviz EXISTANT (id, nom, avatar) ; il
 * n'est ni un second système d'identités ni une copie du compte. Un APK
 * fraîchement installé ne montre JAMAIS cette liste : il arrive sur
 * l'écran de connexion, et ce n'est qu'après un login admin que les profils
 * du foyer reviennent. Les sessions (cookies) restent locales à chaque
 * appareil — jamais persistées ici.
 *
 * Règles de sécurité :
 * - Lecture ET écriture : ADMIN ONLY. Le foyer est la liste que l'admin a
 *   constituée — un compte invité qui se connecte depuis un APK (chez lui)
 *   ne doit JAMAIS apparaître dans le foyer de l'admin, ni le voir
 *   (GET /api/tv-profiles utilise requireAdmin).
 * - La suppression d'un profil TV ne supprime JAMAIS le compte utilisateur.
 */
export interface TvProfile {
  /** Id du compte Movviz référencé (User.id). */
  id: string;
  name: string;
  avatar: string | null;
  addedAt: number;
  lastUsedAt: number;
}

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const TV_PROFILES_FILE = path.join(CONFIG_DIR, "tv-profiles.json");

export function listTvProfiles(): TvProfile[] {
  const profiles = readJsonCached<TvProfile[]>(TV_PROFILES_FILE, []);
  return [...profiles].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/** Upsert d'un compte dans le foyer TV — appelé par l'ADMIN uniquement
 *  (l'APK lui présente la liste des comptes et il choisit qui rejoint le
 *  foyer, sans jamais connaître leurs mots de passe). Met à jour le
 *  nom/avatar (compte modifié) et lastUsedAt. */
export function upsertTvProfile(user: User): TvProfile {
  const profiles = readJsonCached<TvProfile[]>(TV_PROFILES_FILE, []);
  const existing = profiles.find((p) => p.id === user.id);
  const profile: TvProfile = {
    id: user.id,
    name: user.username,
    avatar: user.plexAvatar,
    addedAt: existing?.addedAt ?? Date.now(),
    lastUsedAt: Date.now(),
  };
  const next = [...profiles.filter((p) => p.id !== user.id), profile];
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(TV_PROFILES_FILE, next);
  return profile;
}

/** Retire un compte du foyer TV (ADMIN uniquement). Le compte Movviz est
 *  INTACT — seul le lien « membre du foyer TV » est supprimé. */
export function removeTvProfile(userId: string): boolean {
  const profiles = readJsonCached<TvProfile[]>(TV_PROFILES_FILE, []);
  const next = profiles.filter((p) => p.id !== userId);
  if (next.length === profiles.length) return false;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(TV_PROFILES_FILE, next);
  return true;
}