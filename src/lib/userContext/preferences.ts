import { withUserContextDb } from "./database";

export type UserPreferenceSource = "explicit" | "correction" | "rating" | "feedback" | "inferred";

export interface UserPreference {
  userId: string;
  dimension: "title" | "genre" | "mood" | "franchise" | "language" | "duration" | "other";
  key: string;
  label: string;
  affinity: number;
  confidence: number;
  source: UserPreferenceSource;
  tmdbId?: number | null;
  mediaType?: "movie" | "series" | null;
  evidenceCount: number;
  updatedAt: number;
}

function clampAffinity(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function upsertExplicitTitlePreference(input: {
  userId: string;
  tmdbId: number;
  mediaType: "movie" | "series";
  title: string;
  affinity: number;
  source: "explicit" | "correction";
}): boolean {
  const key = `${input.mediaType}:${input.tmdbId}`;
  const now = Date.now();
  return withUserContextDb((db) => {
    db.prepare(`
      INSERT INTO user_preferences(
        user_id, dimension, pref_key, label, affinity, confidence, source,
        tmdb_id, media_type, evidence_count, updated_at
      ) VALUES(?, 'title', ?, ?, ?, 1, ?, ?, ?, 1, ?)
      ON CONFLICT(user_id, dimension, pref_key) DO UPDATE SET
        label = excluded.label,
        affinity = excluded.affinity,
        confidence = 1,
        source = excluded.source,
        tmdb_id = excluded.tmdb_id,
        media_type = excluded.media_type,
        evidence_count = user_preferences.evidence_count + 1,
        updated_at = excluded.updated_at
    `).run(
      input.userId,
      key,
      input.title,
      clampAffinity(input.affinity),
      input.source,
      input.tmdbId,
      input.mediaType,
      now,
    );
    return true;
  }, false);
}

export function getExplicitTitlePreferences(userId: string, limit = 100): UserPreference[] {
  const max = Math.max(1, Math.min(500, Math.round(limit || 1)));
  return withUserContextDb((db) => {
    const rows = db.prepare(`
      SELECT user_id, dimension, pref_key, label, affinity, confidence, source,
             tmdb_id, media_type, evidence_count, updated_at
      FROM user_preferences
      WHERE user_id = ? AND dimension = 'title'
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(userId, max) as Record<string, unknown>[];
    return rows.map((row) => ({
      userId: String(row.user_id),
      dimension: "title" as const,
      key: String(row.pref_key),
      label: String(row.label),
      affinity: clampAffinity(Number(row.affinity)),
      confidence: clampConfidence(Number(row.confidence)),
      source: (row.source === "correction" ? "correction" : "explicit") as UserPreferenceSource,
      tmdbId: typeof row.tmdb_id === "number" ? row.tmdb_id : row.tmdb_id == null ? null : Number(row.tmdb_id),
      mediaType: row.media_type === "movie" || row.media_type === "series" ? row.media_type : null,
      evidenceCount: Math.max(1, Number(row.evidence_count) || 1),
      updatedAt: Number(row.updated_at) || 0,
    }));
  }, []);
}

export function getExplicitTitlePreference(userId: string, tmdbId: number, mediaType: "movie" | "series"): UserPreference | null {
  return getExplicitTitlePreferences(userId, 500).find((pref) => pref.key === `${mediaType}:${tmdbId}`) ?? null;
}

export function getLatestExplicitPreference(userId: string): UserPreference | null {
  return getExplicitTitlePreferences(userId, 1)[0] ?? null;
}

export function formatExplicitPreferencesContext(userId: string, limit = 12): string {
  const prefs = getExplicitTitlePreferences(userId, limit);
  if (!prefs.length) return "";
  return prefs.map((pref) => {
    const stance = pref.affinity >= 0.6 ? "aime explicitement" : pref.affinity <= -0.6 ? "n'aime explicitement pas" : "avis explicite mitigé sur";
    const correction = pref.source === "correction" ? " — correction utilisateur, PRIORITAIRE" : "";
    return `${stance} « ${pref.label} » [confiance ${Math.round(pref.confidence * 100)}%, preuves ${pref.evidenceCount}${correction}]`;
  }).join(" ; ");
}
