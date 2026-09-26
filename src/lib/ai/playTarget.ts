import { getMovieByTmdbId, getSeriesByTmdbId, loadMovies, loadSeries } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
import type { AiPlayTarget } from "./types";

// « lance-le », « démarre-le », « joue le film », « lance la lecture »,
// « mets-le » (but not « mets-le en vu », the seen command, handled first).
const PLAY_WITH_OBJECT_RE = /\b(?:lance[sz]?|lancer|d[ée]marre[sz]?|d[ée]marrer|joue[sz]?|jouer|mets|mettre)[- ](?:le|la|les|l['’])(?:\s*(?:film|s[ée]rie|[ée]pisode|lecture|suivant|prochain))?\b(?!\s+(?:en|dans|comme|à|a|de|du|sur)\b)/i;
// « lance », « vas-y lance », « ok démarre », « play » — an order on its own.
const PLAY_ALONE_RE = /^[\s,.!]*(?:(?:ouais|oui|ok|okay|vas[- ]y|allez|go|bon|alors)[\s,.!]+)*(?:lance|d[ée]marre|joue|play)[\s,.!]*$/i;

export function isPlayRequest(message: string): boolean {
  return PLAY_WITH_OBJECT_RE.test(message) || PLAY_ALONE_RE.test(message.trim());
}

/**
 * What « lance-le » plays for this user: the film itself, or for a series
 * the episode they are in the middle of, else the first one not yet seen —
 * always one with a file (Movviz or Plex). Null when the title is not
 * playable from the library.
 */
export function resolvePlayTarget(userId: string, subject: { tmdbId: number; type: "movie" | "series" }): AiPlayTarget | null {
  if (subject.type === "movie") {
    const movie = getMovieByTmdbId(subject.tmdbId);
    if (!movie || (!movie.file && !movie.plexRatingKey)) return null;
    return {
      type: "movie", tmdbId: movie.tmdbId, title: movie.title, posterPath: movie.posterPath,
      ratingKey: movie.plexRatingKey ?? movie.id, movvizId: movie.id,
    };
  }
  const series = getSeriesByTmdbId(subject.tmdbId);
  if (!series) return null;
  const playable = series.seasons
    .filter((season) => season.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .flatMap((season) => [...season.episodes]
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
      .filter((ep) => ep.file || ep.plexRatingKey)
      .map((ep) => ({ season: season.seasonNumber, ep })));
  if (!playable.length) return null;
  const inProgress = listPlaybackProgress(userId)
    .filter((p) => p.mediaType === "episode" && p.tmdbId === series.tmdbId)
    .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))[0];
  const watched = new Set((getWatchStatus(userId)?.episodes ?? [])
    .filter((e) => e.tmdbId === series.tmdbId)
    .map((e) => `${e.season}:${e.episode}`));
  const pick = (inProgress && playable.find((x) => x.season === inProgress.seasonNumber && x.ep.episodeNumber === inProgress.episodeNumber))
    ?? playable.find((x) => !watched.has(`${x.season}:${x.ep.episodeNumber}`))
    ?? playable[0];
  const movvizId = `${series.id}:s${pick.season}e${pick.ep.episodeNumber}`;
  return {
    type: "series", tmdbId: series.tmdbId, title: series.title, posterPath: series.posterPath,
    ratingKey: pick.ep.plexRatingKey ?? movvizId, movvizId, seriesId: series.id,
    seasonNumber: pick.season, episodeNumber: pick.ep.episodeNumber, episodeTitle: pick.ep.title || undefined,
  };
}

// ── « lance Silent Night », « lance un film d'action au hasard » ─────────

const PLAY_VERB_RE = /\b(?:lance[sz]?|lancer|d[ée]marre[sz]?|d[ée]marrer|joue[sz]?|jouer|mets)(?:[- ]moi)?\s+(.+)$/i;
// « lance un film », « mets n'importe quel film », « lance quelque chose »
const PLAY_ANY_RE = /\b(?:lance[sz]?|lancer|d[ée]marre[sz]?|joue[sz]?|mets)(?:[- ]moi)?\s+(?:un|une|n['’]importe quel(?:le)?|quelque chose|un truc)\b/i;

/** Genre words a user says → TMDb genre names (fr-FR, as the library stores them). */
const GENRES: [RegExp, string[]][] = [
  [/\baction\b/i, ["Action"]],
  [/\baventures?\b/i, ["Aventure"]],
  [/\banim(?:ation|[ée]s?)\b|dessins? anim[ée]s?/i, ["Animation"]],
  [/\bcom[ée]die|\bdr[ôo]le|\brire\b|marrant/i, ["Comédie"]],
  [/\bpolar|\bpolicier|\bcrime|gangsters?/i, ["Crime"]],
  [/\bdocumentaire|\bdocu\b/i, ["Documentaire"]],
  [/\bdrame|\bdramatique/i, ["Drame"]],
  [/\bfamil(?:le|ial)|\benfants?\b/i, ["Familial"]],
  [/\bfantastique|\bfantasy/i, ["Fantastique"]],
  [/\bhorreur|\bflippant|\bpeur\b|\bpour flipper/i, ["Horreur"]],
  [/\bmyst[èe]re|\benqu[êe]te/i, ["Mystère"]],
  [/\bromance|\bromantique|\bamour\b/i, ["Romance"]],
  [/\bscience[- ]fiction|\bsf\b|\bsci[- ]?fi|\bspatial/i, ["Science-Fiction"]],
  [/\bthriller|\bsuspense/i, ["Thriller"]],
  [/\bguerre\b/i, ["Guerre"]],
  [/\bwestern/i, ["Western"]],
];

const strip = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** « vas-y lance Silent Night » → Silent Night, found in THIS library
 *  (films first, then series) — nothing is invented: no match, no play. */
export function findNamedPlayTarget(userId: string, message: string): AiPlayTarget | null {
  const asked = message.match(PLAY_VERB_RE)?.[1];
  if (!asked) return null;
  const wanted = strip(asked.replace(/^(?:le film|la s[ée]rie|l['’]?[ée]pisode|le|la|les)\s+/i, "")).replace(/\s+(?:stp|s il te plait|merci)$/, "");
  if (wanted.length < 2) return null;
  const movie = loadMovies().find((m) => (m.file || m.plexRatingKey) && strip(m.title) === wanted);
  if (movie) return resolvePlayTarget(userId, { tmdbId: movie.tmdbId, type: "movie" });
  const series = loadSeries().find((s) => strip(s.title) === wanted);
  if (series) return resolvePlayTarget(userId, { tmdbId: series.tmdbId, type: "series" });
  return null;
}

export function isPlayAnyRequest(message: string): boolean {
  return PLAY_ANY_RE.test(message);
}

/** « lance un film d'action » : a film of THIS library, with a file, not
 *  seen yet, of the genre asked if any — the better rated ones more likely. */
export function pickRandomPlayTarget(userId: string, message: string): { target: AiPlayTarget; genre: string | null } | null {
  const genre = GENRES.find(([re]) => re.test(message))?.[1] ?? null;
  const watched = new Set(getWatchStatus(userId)?.movies ?? []);
  const candidates = loadMovies().filter((m) =>
    (m.file || m.plexRatingKey) && !watched.has(m.tmdbId) && (!genre || m.genres.some((g) => genre.includes(g))));
  if (!candidates.length) return null;
  // Weighted draw: a 8/10 film is about twice as likely as a 4/10 one.
  const weights = candidates.map((m) => Math.max(1, (m.rating ?? 0) - 3));
  let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  const pick = candidates.find((_, i) => (roll -= weights[i]) <= 0) ?? candidates[candidates.length - 1];
  const target = resolvePlayTarget(userId, { tmdbId: pick.tmdbId, type: "movie" });
  return target ? { target, genre: genre?.[0] ?? null } : null;
}
