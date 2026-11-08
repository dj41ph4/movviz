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
  /** Le titre ou le synopsis doit évoquer la fête : les mots-clés TMDb sont bruités (une série catastrophe étiquetée « Noël »). */
  theme: RegExp;
  /** Classiques de la fête (films TMDb), toujours proposés — un même film peut figurer dans plusieurs fêtes. */
  pinnedMovies: number[];
  /** Langues d'origine écartées (ISO 639-1) : Noël = ambiance occidentale, pas de production asiatique ou africaine. */
  excludeLanguages?: readonly string[];
}

const ASIAN_AFRICAN_LANGUAGES = [
  "ja", "ko", "zh", "cn", "th", "vi", "id", "ms", "tl", "hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu", "ur", "ne", "si", "km", "lo", "my", "mn",
  "sw", "am", "yo", "ha", "zu", "xh", "ig", "so", "wo", "ln", "rw", "sn", "st", "tn", "af", "ar",
] as const;

const SEASONS: Record<SeasonId, SeasonDef> = {
  halloween: {
    id: "halloween", keywords: "3335|9694|318653|182794|232795|9694",
    theme: /halloween|sorci[eè]r|witch|fant[ôo]me|ghost|monstre|monster|vampire|zombie|hant[ée]|haunt|citrouille|pumpkin|croque-mitaine|boogey/i,
    // Jack, Hocus Pocus, Beetlejuice, Casper, Coraline, Noces funèbres, Hôtel Transylvanie, Gremlins, Scream, Edward, Cinq Légendes
    pinnedMovies: [9479, 10439, 4011, 8839, 14836, 3933, 76492, 927, 4232, 162, 81188],
  },
  christmas: {
    id: "christmas", keywords: "207317|5570|260365|386830|255088|363215|1441|193048|189966|272698|172742|299335|240515|386817|308983|344102|299268|364506|1991|186466|323756|274211|12200|34154|603|10385|10115|355701|274371|284235|273278|33694|274507|169826|65",
    theme: /no[eë]l|christmas|xmas|santa|p[eè]re no|r[eé]veillon|lutin|elf|elves|rennes?|reindeer|sapin|gui|mistletoe|fêtes de fin|holiday season|neige|snow/i,
    // Cinq Légendes, Jack, Maman j'ai raté l'avion, Elfe, Love Actually, Pôle Express, The Holiday, Piège de cristal, Klaus, Grinch, Gremlins, Edward, Krampus
    pinnedMovies: [81188, 9479, 771, 10719, 508, 5255, 1581, 562, 508965, 8871, 927, 162, 287903],
    excludeLanguages: ASIAN_AFRICAN_LANGUAGES,
  },
  newYear: {
    id: "newYear", keywords: "252123|336526|613",
    theme: /nouvel an|new year|nouvelle ann[ée]e|r[eé]veillon|saint-sylvestre|sylvester|r[eé]solution|resolution|minuit|midnight/i,
    pinnedMovies: [639],
  },
  valentine: {
    id: "valentine", keywords: "251912|366924",
    theme: /valentin|amour|love|romance|romantique|romantic|couple|c[oœ]ur|heart/i,
    pinnedMovies: [508, 11036, 597, 639, 88],
  },
  easter: {
    id: "easter", keywords: "9921|9923|351806",
    theme: /p[aâ]ques|easter|lapin|bunny|rabbit|[oœ]ufs?|eggs?|chocolat/i,
    pinnedMovies: [81188, 50359],
  },
  summer: {
    id: "summer", keywords: "13088|14714|966",
    theme: /été|summer|vacances|vacation|plage|beach|soleil|sun|camp de vacances|surf/i,
    pinnedMovies: [578, 621, 11544, 11631, 88],
  },
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

/** Fenêtre d'une fête à date fixe : "MM-JJ" inclus des deux côtés (peut enjamber le Nouvel An). */
export interface SeasonWindow { start: string; end: string }
/** Pâques bouge chaque année : fenêtre en jours avant / après le dimanche de Pâques. */
export interface EasterWindow { before: number; after: number }
export interface SeasonSettings {
  /** Surcharges par fête ; une fête absente garde sa fenêtre par défaut. */
  windows: Partial<Record<Exclude<SeasonId, "easter">, SeasonWindow>>;
  easter?: EasterWindow;
}

export const DEFAULT_SEASON_WINDOWS: Record<Exclude<SeasonId, "easter">, SeasonWindow> = {
  halloween: { start: "09-28", end: "11-02" },
  christmas: { start: "11-03", end: "12-26" },
  newYear: { start: "12-27", end: "01-06" },
  valentine: { start: "01-31", end: "02-14" },
  summer: { start: "06-21", end: "08-31" },
};
export const DEFAULT_EASTER_WINDOW: EasterWindow = { before: 14, after: 1 };

const MM_DD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]d|3[01])$/;

/** Ne garde que des fenêtres valides — jamais de confiance dans un JSON stocké. */
export function sanitizeSeasonSettings(input: unknown): SeasonSettings {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const windows: SeasonSettings["windows"] = {};
  const raw = obj.windows && typeof obj.windows === "object" ? (obj.windows as Record<string, unknown>) : {};
  for (const id of Object.keys(DEFAULT_SEASON_WINDOWS) as (keyof typeof DEFAULT_SEASON_WINDOWS)[]) {
    const w = raw[id] as Partial<SeasonWindow> | undefined;
    if (w && typeof w.start === "string" && typeof w.end === "string" && MM_DD.test(w.start) && MM_DD.test(w.end)) windows[id] = { start: w.start, end: w.end };
  }
  const e = obj.easter as Partial<EasterWindow> | undefined;
  const days = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(60, Math.max(0, Math.round(v))) : fallback);
  return { windows, ...(e && typeof e === "object" ? { easter: { before: days(e.before, DEFAULT_EASTER_WINDOW.before), after: days(e.after, DEFAULT_EASTER_WINDOW.after) } } : {}) };
}

function inWindow(day: string, w: SeasonWindow): boolean {
  return w.start <= w.end ? day >= w.start && day <= w.end : day >= w.start || day <= w.end;
}

const DAY_MS = 86_400_000;

/**
 * Fête active à une date (UTC, jour calendaire), ou null hors fenêtre.
 * Fenêtres par défaut dans DEFAULT_SEASON_WINDOWS, modifiables par l'utilisateur.
 */
export function activeSeason(now: Date, settings?: SeasonSettings): SeasonId | null {
  const day = `${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const win = (id: keyof typeof DEFAULT_SEASON_WINDOWS) => settings?.windows[id] ?? DEFAULT_SEASON_WINDOWS[id];
  const easter = settings?.easter ?? DEFAULT_EASTER_WINDOW;
  for (const id of ["halloween", "christmas", "newYear", "valentine"] as const) if (inWindow(day, win(id))) return id;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sunday = easterSunday(now.getUTCFullYear()).getTime();
  if (today >= sunday - easter.before * DAY_MS && today <= sunday + easter.after * DAY_MS) return "easter";
  if (inWindow(day, win("summer"))) return "summer";
  return null;
}
