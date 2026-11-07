/**
 * Calendrier des suggestions saisonnières : à chaque date correspond au plus
 * une saison active, avec une anticipation avant l'événement (Noël visible dès
 * mi-novembre) et une fin nette juste après. Calcul pur, sans I/O.
 */
export const SEASON_IDS = ["halloween", "christmas", "newYear", "valentine", "easter", "summer"] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

export interface SeasonDef {
  id: SeasonId;
  /** TMDb with_keywords (OR) — les films/séries étiquetés par la communauté. */
  keywords: string;
}

const SEASONS: Record<SeasonId, SeasonDef> = {
  halloween: { id: "halloween", keywords: "3335|9694|318653" },
  christmas: { id: "christmas", keywords: "207317|5570|260365" },
  newYear: { id: "newYear", keywords: "252123|336526" },
  valentine: { id: "valentine", keywords: "251912|366924" },
  easter: { id: "easter", keywords: "9921|9923|351806" },
  summer: { id: "summer", keywords: "13088|14714|966" },
};

export function seasonDef(id: SeasonId): SeasonDef {
  return SEASONS[id];
}

export function isSeasonId(value: unknown): value is SeasonId {
  return typeof value === "string" && (SEASON_IDS as readonly string[]).includes(value);
}

/** Dimanche de Pâques (algorithme grégorien anonyme), en UTC. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Jour de l'année sous forme MMJJ (ex. 15 novembre → 1115), comparable. */
function mmdd(date: Date): number {
  return (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

const DAY_MS = 86_400_000;

/**
 * Saison active à une date (UTC, jour calendaire), ou null hors fenêtre.
 *  - Halloween : 28 sept → 2 nov
 *  - Noël : 15 nov → 26 déc
 *  - Nouvel An : 27 déc → 6 janv
 *  - Saint-Valentin : 31 janv → 14 fév
 *  - Pâques : 14 jours avant → lundi de Pâques
 *  - Été : 21 juin → 31 août
 */
export function activeSeason(now: Date): SeasonId | null {
  const day = mmdd(now);
  if (day >= 928 && day <= 1102) return "halloween";
  if (day >= 1115 && day <= 1226) return "christmas";
  if (day >= 1227 || day <= 106) return "newYear";
  if (day >= 131 && day <= 214) return "valentine";
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const easter = easterSunday(now.getUTCFullYear()).getTime();
  if (today >= easter - 14 * DAY_MS && today <= easter + DAY_MS) return "easter";
  if (day >= 621 && day <= 831) return "summer";
  return null;
}
