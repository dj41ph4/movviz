import { getMovie, updateMovie, getSeries, updateSeries } from "@/lib/library/store";
import { encodeLibraryRef, type LibraryFile } from "@/lib/library/types";
import { pathFor } from "@/lib/library/renamePath";
import { emitNotification } from "@/lib/notifications/store";
import { refreshPlexLibraryFor, scheduleLibrarySyncSoon } from "@/lib/plex/librarySync";
import { logActivity } from "@/lib/activity/store";
import { logActivityV2, createMediaRef, createReleaseRef, createImportRef } from "@/lib/activity/v2/store";
import { notifySeerrStatus } from "@/lib/seerr/mediaMap";
import { takePendingVersionIntent } from "@/lib/library/pendingVersionIntent";
import { takeManualGrab } from "@/lib/library/manualGrab";
import { addVersion, setPrimaryFile } from "@/lib/library/versions";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { matchesBlockedWord, loadReleaseRules } from "@/lib/library/releaseRules";
import { recordDecision } from "@/lib/library/decisionLog";
import { withKeyLock } from "@/lib/library/locks";
import { probeMovieInBackground, probeEpisodeInBackground } from "@/lib/playback/engine/probeLibrary";
import path from "node:path";
import fsp from "node:fs/promises";

export interface ImportedFile {
  path: string;
  quality: string | null;
  resolution: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
  source: string | null;
  size: number;
  season?: number | null;
  episode?: number | null;
  /** Set when one file covers a combined range of episodes (e.g. S04E01E02) — see src/lib/naming/parser.ts. */
  episodeEnd?: number | null;
}

export type LibraryImportRef =
  | { kind: "movie"; movieId: string }
  | { kind: "season"; seriesId: string; season: number }
  | { kind: "series"; seriesId: string }
  | { kind: "episode"; seriesId: string; season: number; episode: number };

/** True when `episodeNumber` is the file's episode, or falls inside its combined-episode range. */
function movedFileCoversEpisode(f: ImportedFile, episodeNumber: number): boolean {
  if (f.episode == null) return false;
  if (f.episode === episodeNumber) return true;
  return f.episodeEnd != null && episodeNumber > f.episode && episodeNumber <= f.episodeEnd;
}

/**
 * Season-part normalization for SINGLE-SEASON series only (DVD-ordering
 * splits — e.g. Disjointed: a "S02" release covering S1E11-20, matched via
 * partPackInfo in matching.ts). A file parsed as season N ≥ 2 of a
 * single-season show has its episode numbers translated into the season's
 * own numbering: season episode = (N-1)*ceil(total/N) + fileEpisode. This
 * runs BEFORE every season-consistency guard and episode match below, so
 * those stay exactly as they were for every normal file. Files that don't
 * map into the season's range are left untouched and fail the season guard
 * as before — no behaviour change. Multi-season series are never touched
 * (their S02 files belong to a real season 2).
 */
function normalizePartFiles(series: { seasons: Array<{ episodes: Array<unknown> }> }, files: ImportedFile[]): ImportedFile[] {
  if (series.seasons.length !== 1) return files;
  const total = series.seasons[0]?.episodes.length ?? 0;
  if (total < 2) return files;
  return files.map((f) => {
    if (f.season == null || f.season < 2 || f.episode == null) return f;
    const partSize = Math.ceil(total / f.season);
    const episode = (f.season - 1) * partSize + f.episode;
    if (episode < 1 || episode > total) return f;
    return { ...f, season: 1, episode };
  });
}

interface EpisodeLike {
  status: string;
  activeInfoHash: string | null;
}

/**
 * A multi-episode-target grab (season/series pack, or an episode grab that
 * fell back to one) can leave some of its targeted episodes without a
 * matching file — a filename that doesn't parse cleanly, an odd episode
 * numbering scheme, etc. Since the torrent this callback fires for is fully
 * imported, nothing more is ever coming for that episode from this grab: if
 * we leave it as "downloading" it stays stuck forever, because its
 * activeInfoHash now points at a completed/imported torrent that
 * reconcileDownloadingItems will never consider "gone". Release it back to
 * "missing" here instead so the next search tries again.
 */
function releaseIfOrphaned<T extends EpisodeLike>(ep: T, infoHash: string | undefined): T {
  if (infoHash && ep.status === "downloading" && ep.activeInfoHash === infoHash) {
    return { ...ep, status: "missing", activeInfoHash: null };
  }
  return ep;
}

function refreshLoose(kind: "movie" | "tv") {
  void refreshPlexLibraryFor(kind).catch(() => {});
  // Tells Plex to scan; this schedules Movviz's OWN sync (the one that
  // actually picks up plexRatingKey/plexUrl) shortly after, instead of
  // leaving a freshly-available title stuck on "En attente de synchronisation
  // Plex" until the next 5-minute scheduled pass.
  scheduleLibrarySyncSoon();
}

/**
 * Remplacement d'une version (ré-téléchargement manuel, mise à niveau
 * qualité, LOT6 « remplacer la version actuelle ») — jamais pour une
 * « version supplémentaire » (pendingMode === "add" garde explicitement les
 * deux fichiers). Sans la suppression de l'ancien fichier, celui-ci reste
 * dans Plex comme une seconde version du même film : la lecture est résolue
 * via Plex (ratingKey → /library/metadata → version primaire), qui continue
 * de servir l'ANCIENNE version — le bug « le fichier ne change pas » après
 * un ré-téléchargement (observé en direct : Alita SBS → version non-SBS
 * téléchargée, lecture encore en SBS).
 */

/** Racines bibliothèque du moteur (completedPath de chaque instance) —
 *  tout chemin supprimé/renommé doit vivre sous l'une d'elles. */
async function engineLibraryRoots(): Promise<string[]> {
  try {
    const res = await fetch(`${ENGINE_BASE}/instances`, {
      headers: engineHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const { instances } = await res.json() as { instances?: Array<{ completedPath?: string }> };
    return (instances ?? [])
      .map((i) => i.completedPath ?? "")
      .filter(Boolean)
      .map((p) => pathFor(p).resolve(p));
  } catch {
    return [];
  }
}

/** Vrai si `resolved` (déjà résolu) vit sous l'une des racines — comparaison
 *  insensible à la casse sur Windows (le chemin enregistré peut différer du
 *  completedPath configuré par la casse). `resolved` n'est jamais la racine
 *  elle-même. */
function isUnderLibraryRoot(resolved: string, sep: string, roots: string[], caseSensitive: boolean): boolean {
  const needle = caseSensitive ? resolved : resolved.toLowerCase();
  return roots.some((root) => {
    const candidate = caseSensitive ? root : root.toLowerCase();
    return needle.startsWith(candidate + sep) && needle.length > candidate.length + sep.length;
  });
}

/** Suppression d'un fichier bibliothèque — JAMAIS récursive (unlink simple),
 *  uniquement sous une racine completedPath du moteur, profondeur ≥ 2 et nom
 *  de base assaini (AGENTS.md — gardes de suppression obligatoires). */
async function deleteLibraryFile(filePath: string, roots: string[]): Promise<void> {
  const p = pathFor(filePath);
  const resolved = p.resolve(filePath);
  if (!isUnderLibraryRoot(resolved, p.sep, roots, process.platform !== "win32")) return;
  const depth = resolved.split(p.sep).filter(Boolean).length;
  if (depth < 2) return;
  const name = p.basename(resolved).replace(/[/\\:]/g, "_").replace(/\.\.+/g, "_");
  if (!name || name === "." || name === "..") return;
  await fsp.unlink(resolved).catch(() => {});
}

/** Suffixe de collision ajouté par le moteur (AbstractBackend.avoidCollision) :
 *  « (2) », « (3) »… collé juste avant l'extension quand le nom final attendu
 *  est déjà occupé sur disque au moment du renommage. */
function stripCollisionSuffix(basename: string): string {
  return basename.replace(/ \((\d+)\)$/, "");
}

/**
 * Finalisation d'un import de REMPLACEMENT (mode "replace"/"optimize"/
 * ré-import simple — tout sauf "add") :
 * 1. L'ANCIEN fichier primaire est supprimé du disque (deleteLibraryFile,
 *    gardes de sécurité complètes) AVANT toute manipulation du nouveau.
 * 2. Le moteur renomme le nouveau fichier AVANT de connaître l'intention
 *    (avoidCollision) : si le nom final attendu était occupé par l'ancien
 *    fichier, le nouveau a reçu un suffixe « (2) »/« (3) »…. Une fois
 *    l'ancien fichier supprimé, le nouveau fichier est ramené vers ce nom
 *    final — plus aucun doublon « (n) » dans Plex. Le renommage n'écrase
 *    JAMAIS un fichier existant et ne touche que des fichiers sous une
 *    racine bibliothèque du moteur.
 */
async function finalizeReplacePath<T extends { path: string }>(movie: { file: LibraryFile | null }, newFile: T, roots: string[]): Promise<T> {
  if (!movie.file) return newFile;
  const oldPath = movie.file.path;
  const newPath = newFile.path;
  if (!oldPath || !newPath) return newFile;
  const op = pathFor(oldPath);
  const np = pathFor(newPath);
  const resolvedOld = op.resolve(oldPath);
  const resolvedNew = np.resolve(newPath);
  if (resolvedOld === resolvedNew) return newFile; // self-delete guard

  // 1. Supprimer l'ancien fichier AVANT de renommer le nouveau.
  await deleteLibraryFile(oldPath, roots);

  // 2. Ramener le nouveau fichier vers son nom final attendu.
  const newBase = np.basename(resolvedNew);
  const stripped = stripCollisionSuffix(newBase);
  if (stripped === newBase) return newFile; // pas de suffixe de collision — nom déjà final
  // Les noms canoniques (sans suffixe) doivent correspondre — sinon ce n'est
  // pas le même nom final que l'ancien fichier, on ne renomme pas.
  if (stripCollisionSuffix(op.basename(resolvedOld)) !== stripped) return newFile;
  if (!isUnderLibraryRoot(resolvedNew, np.sep, roots, process.platform !== "win32")) return newFile;

  const expected = np.join(np.dirname(resolvedNew), stripped + np.extname(resolvedNew));
  if (np.resolve(expected) === resolvedNew) return newFile;
  try {
    await fsp.access(expected);
    return newFile; // nom final occupé par un autre fichier — ne jamais écraser
  } catch {
    // libre — on peut renommer
  }
  try {
    await fsp.rename(resolvedNew, expected);
    console.log(`[import] version remplacée renommée vers le nom final: ${expected}`);
    return { ...newFile, path: expected };
  } catch (err) {
    console.warn(`[import] renommage vers le nom final impossible (${(err as Error).message}) — nom actuel conservé`);
    return newFile;
  }
}

/** Same root-validated deletion pattern as deleteLibraryFile — never an
 *  arbitrary path, only one confirmed to sit under a known completed-library
 *  root. Used to remove a file quarantined by checkPostImportBlockedWord. */
async function deleteQuarantinedFile(filePath: string): Promise<void> {
  try {
    const res = await fetch(`${ENGINE_BASE}/instances`, {
      headers: engineHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return;
    const { instances } = await res.json() as { instances?: Array<{ completedPath?: string }> };
    const roots = (instances ?? []).map((i) => path.resolve(i.completedPath ?? "")).filter(Boolean);
    const resolved = path.resolve(filePath);
    if (!roots.some((root) => resolved.startsWith(root + path.sep))) return;
    await fsp.unlink(resolved).catch(() => {});
  } catch {
    // Engine unreachable — leave the file rather than guess.
  }
}

/**
 * Second-layer blocklist enforcement. The pre-grab filter (decisionGuard.ts)
 * only ever sees the INDEXER'S OWN advertised release title — confirmed live
 * that a release can ship with an actual torrent name that diverges from
 * what the indexer listed it as (e.g. indexer search result said "Japonais",
 * the real torrent was named "...SUBFRENCH..."), silently smuggling a
 * blocked term straight past the pre-download filter since there was nothing
 * to catch it on at grab time. By the time applyImportedFiles runs, the
 * engine knows the torrent's real name — checked here, in the one shared
 * import path both the engine callback and the recover-downloads fallback
 * already go through, so this closes the gap for both at once.
 */
async function checkPostImportBlockedWord(infoHash: string | undefined): Promise<string | null> {
  if (!infoHash) return null;
  try {
    const res = await fetch(`${ENGINE_BASE}/torrents/${infoHash}`, {
      headers: engineHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const detail = await res.json() as { name?: string };
    if (!detail.name) return null;
    return matchesBlockedWord(detail.name, loadReleaseRules());
  } catch {
    return null;
  }
}

/** Reverts whatever this import targeted back to "missing" so the next
 *  scheduled search retries it, and returns a human-readable label for the
 *  notification/decision log. Mirrors releaseIfOrphaned's own condition
 *  (only reverts an episode that's still "downloading" against this exact
 *  infoHash) so it never clobbers an unrelated concurrent grab. */
function revertBlockedImport(ref: LibraryImportRef, infoHash: string | undefined): string {
  if (ref.kind === "movie") {
    const movie = getMovie(ref.movieId);
    if (!movie) return "?";
    // Same guard as releaseIfOrphaned below — only revert if this movie is
    // still actually claimed by the exact torrent being quarantined. Without
    // this, a newer grab that started between the blocked torrent completing
    // and this async check running (duplicate/retried engine callback,
    // manual re-grab) would get its own in-progress state stomped back to
    // "missing" by a check that's really about the OLD, blocked download.
    if (!infoHash || movie.activeInfoHash === infoHash) {
      updateMovie(movie.id, { status: "missing", activeInfoHash: null });
    }
    return movie.title;
  }
  const series = getSeries(ref.seriesId);
  if (!series) return "?";
  const seasons = series.seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((ep) => releaseIfOrphaned(ep, infoHash)),
  }));
  updateSeries(series.id, { seasons });
  return ref.kind === "series" ? `${series.title} — intégrale` : ref.kind === "season" ? `${series.title} — saison ${ref.season}` : `${series.title} — ${ref.season}x${String(ref.episode).padStart(2, "0")}`;
}

/**
 * Shared implementation of the engine's import callback (and of the
 * recover-downloads fallback import): apply a list of moved files to the
 * library — flip statuses to "available", attach file metadata, log
 * activity, notify Plex/Seerr. Both callers must produce identical library
 * state, so there is exactly one implementation.
 */
export async function applyImportedFiles(ref: LibraryImportRef, files: ImportedFile[], infoHash?: string) {
  const lockKey = ref.kind === "movie" ? `movie:${ref.movieId}` : `series:${ref.seriesId}`;
  return withKeyLock(lockKey, () => applyImportedFilesLocked(ref, files, infoHash));
}

async function applyImportedFilesLocked(ref: LibraryImportRef, files: ImportedFile[], infoHash?: string) {
  // A MANUAL grab (user picked the release themselves — search page, film
  // card, add-version panel) is exempt from the post-import blocklist: the
  // user saw the name with the "forbidden word" and chose it anyway, so the
  // download must still be renamed/moved into the library instead of being
  // quarantined. Only AUTOMATIC grabs keep the blocked-word veto.
  const manualGrab = takeManualGrab(infoHash);
  const blockedTerm = manualGrab ? null : await checkPostImportBlockedWord(infoHash);
  if (blockedTerm) {
    for (const f of files) await deleteQuarantinedFile(f.path);
    const label = revertBlockedImport(ref, infoHash);
    recordDecision({
      refTitle: label,
      releaseTitle: files[0]?.path ? path.basename(files[0].path) : label,
      decision: "rejected",
      reasons: [{ type: "blocked_word", message: `Terme interdit détecté après téléchargement : "${blockedTerm}"` }],
    });
    emitNotification("import_blocked_word", `${label} — téléchargement supprimé (terme interdit "${blockedTerm}" détecté)`, "/library", { title: label, term: blockedTerm });
    return { ok: false as const, error: "blocked_word" };
  }

  if (ref.kind === "movie") {
    const movie = getMovie(ref.movieId);
    if (!movie) return { ok: false as const, error: "movie not found" };
    // Movie grabs have no episode-target matching gate (see _import()'s
    // targetList — null for movies, so every downloaded file passes through
    // untouched), so this is only reachable in a genuinely degenerate case
    // (empty extracted torrent). releaseIfOrphaned doesn't apply to movies —
    // just report failure instead of crashing on an undefined `best`.
    if (files.length === 0) return { ok: false as const, error: "no files" };
    const best = [...files].sort((a, b) => b.size - a.size)[0];
    const newFile = {
      path: best.path,
      quality: best.quality ?? "—",
      resolution: best.resolution,
      videoCodec: best.videoCodec,
      audioCodec: best.audioCodec,
      hdr: best.hdr,
      source: best.source,
      size: best.size,
      addedAt: Date.now(),
    };

    // A pending "add" intent (LOT6.2/6.10 — user explicitly chose "Ajouter
    // comme version supplémentaire") never overwrites the primary file. Any
    // other mode (replace/optimize/re-import) is a REPLACEMENT: the old
    // primary file is deleted from disk and the new file is brought back to
    // its final expected name (see finalizeReplacePath) so no " (2)"/" (3)"
    // collision duplicates ever accumulate in Plex.
    const pendingMode = takePendingVersionIntent(infoHash);
    let finalFile = newFile;
    if (pendingMode !== "add") {
      finalFile = await finalizeReplacePath(movie, newFile, await engineLibraryRoots());
    }
    const versioned = pendingMode === "add"
      ? addVersion(movie, finalFile, { versionSource: "indexer", reason: "Version supplémentaire" })
      : setPrimaryFile(movie, finalFile, { versionSource: "indexer", reason: movie.file ? "Mise à niveau qualité" : "Acquisition initiale" });

    updateMovie(movie.id, {
      status: "available",
      activeInfoHash: null,
      file: versioned.file,
      versions: versioned.versions,
    });
    // TODO_POST_MOTEUR_LECTURE.md item 1 — fire-and-forget, never blocks import.
    probeMovieInBackground(movie.id, versioned.file?.diskPath ?? versioned.file?.path);
    emitNotification("import_movie_available", `${movie.title} est maintenant disponible`, "/library", { title: movie.title });
    logActivity("imported", "system", movie.title, "/library", {
      libraryRef: encodeLibraryRef({ kind: "movie", movieId: movie.id }),
      quality: best.quality ?? undefined,
    });
    logActivityV2({
      kind: "imported",
      media: createMediaRef("movie", movie.id, movie.tmdbId, movie.title),
      actor: "system",
      release: best.quality ? createReleaseRef("", "Importé", "torrent", best.size, best.quality, 0) : undefined,
      import: createImportRef(finalFile.path, best.size, movie.title, best.quality ?? "—"),
    });
    refreshLoose("movie");
    void notifySeerrStatus("movie", movie.tmdbId, "available").catch(() => {});
    return { ok: true as const, updated: "movie", id: movie.id };
  }

  const series = getSeries(ref.seriesId);
  if (!series) return { ok: false as const, error: "series not found" };

  // Season-part normalization (single-season series only) — see
  // normalizePartFiles. Every branch below works on the normalized list.
  const normalizedFiles = normalizePartFiles(series, files);

  const label = ref.kind === "series" ? `${series.title} — intégrale` : `${series.title} — saison ${ref.season}`;
  const mediaLabel = ref.kind === "series" ? `${series.title} — Intégrale` : `${series.title} — Saison ${ref.season}`;
  const code = ref.kind === "episode" ? `${ref.season}x${String(ref.episode).padStart(2, "0")}` : null;

  if (ref.kind === "season") {
    // A file's own parsed season must agree with the season this grab was
    // FOR — without this check, a season pack that turns out to actually
    // contain a different season's episodes (mislabeled release, or a
    // release matched under the wrong season somewhere upstream) would still
    // get filed into ref.season just because the episode numbers happen to
    // line up (e.g. every season starts at episode 1). A season-less file
    // (f.season == null, e.g. a bare "01.mkv" the engine couldn't season-tag)
    // is still accepted — that's a real gap in the filename, not a mismatch.
    const seasonFiles = normalizedFiles.filter((f) => f.season == null || f.season === ref.season);
    const probedEpisodes: { season: number; episode: number; path: string }[] = [];
    const seasons = series.seasons.map((season) => {
      if (season.seasonNumber !== ref.season) return season;
      const episodes = season.episodes.map((ep) => {
        const match = seasonFiles.find((f) => movedFileCoversEpisode(f, ep.episodeNumber));
        if (!match) return releaseIfOrphaned(ep, infoHash);
        probedEpisodes.push({ season: season.seasonNumber, episode: ep.episodeNumber, path: match.path });
        return {
          ...ep,
          status: "available" as const,
          activeInfoHash: null,
          file: {
            path: match.path,
            quality: match.quality ?? "—",
            resolution: match.resolution,
            videoCodec: match.videoCodec,
            audioCodec: match.audioCodec,
            hdr: match.hdr,
            source: match.source,
            size: match.size,
            addedAt: Date.now(),
          },
        };
      });
      return { ...season, episodes };
    });
    updateSeries(series.id, { seasons });
    for (const pe of probedEpisodes) probeEpisodeInBackground(series.id, pe.season, pe.episode, pe.path);
    // Zero files means every targeted episode was just released back to
    // "missing" above (releaseIfOrphaned), not made available — none of
    // this "it's ready" signal (notification, activity log, Seerr) applies.
    // Before the caller was allowed to reach this branch with files=[], it
    // was unreachable; now that a zero-match season pack calls in here too
    // (see AbstractBackend.mjs's _import), skip the false "available" signal.
    if (normalizedFiles.length > 0) {
      emitNotification("import_season_available", `${label} est maintenant disponible`, `/title/series/${series.tmdbId}`, { title: series.title, season: ref.season });
      logActivity("imported", "system", label, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "season", seriesId: series.id, season: ref.season }),
        quality: normalizedFiles[0]?.quality ?? undefined,
      });
      logActivityV2({
        kind: "imported",
        media: createMediaRef("series", series.id, series.tmdbId, mediaLabel, ref.season),
        actor: "system",
        release: normalizedFiles[0]?.quality ? createReleaseRef("", "Importé", "torrent", normalizedFiles[0].size, normalizedFiles[0].quality, 0) : undefined,
      });
      refreshLoose("tv");
      void notifySeerrStatus("series", series.tmdbId, "available").catch(() => {});
    }
    return { ok: true as const, updated: "season", id: series.id };
  }

  if (ref.kind === "series") {
    // Complete-series pack — dispatch each file to its correct episode
    // across multiple seasons. Files without season/episode metadata are
    // skipped (they don't belong to any tracked episode).
    const probedEpisodes: { season: number; episode: number; path: string }[] = [];
    const seasons = series.seasons.map((season) => {
      const seasonFiles = normalizedFiles.filter((f) => f.season === season.seasonNumber);
      const episodes = season.episodes.map((ep) => {
        const match = seasonFiles.find((f) => movedFileCoversEpisode(f, ep.episodeNumber));
        if (!match) return releaseIfOrphaned(ep, infoHash);
        probedEpisodes.push({ season: season.seasonNumber, episode: ep.episodeNumber, path: match.path });
        return {
          ...ep,
          status: "available" as const,
          activeInfoHash: null,
          file: {
            path: match.path,
            quality: match.quality ?? "—",
            resolution: match.resolution,
            videoCodec: match.videoCodec,
            audioCodec: match.audioCodec,
            hdr: match.hdr,
            source: match.source,
            size: match.size,
            addedAt: Date.now(),
          },
        };
      });
      return { ...season, episodes };
    });
    updateSeries(series.id, { seasons });
    for (const pe of probedEpisodes) probeEpisodeInBackground(series.id, pe.season, pe.episode, pe.path);
    const importedCount = normalizedFiles.filter((f) => f.season != null && f.episode != null).length;
    // Zero matched episodes means every target was just released back to
    // "missing" above (releaseIfOrphaned) — skip the false "available"
    // signal (see the season branch's matching comment).
    if (importedCount > 0) {
      emitNotification("import_series_available", `${series.title} — ${importedCount} épisode(s) importés`, `/title/series/${series.tmdbId}`, { title: series.title });
      logActivity("imported", "system", `${series.title} — intégrale (${importedCount} ép.)`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "series", seriesId: series.id }),
        quality: normalizedFiles[0]?.quality ?? undefined,
      });
      logActivityV2({
        kind: "imported",
        media: createMediaRef("series", series.id, series.tmdbId, `${series.title} — Intégrale`),
        actor: "system",
        release: normalizedFiles[0]?.quality ? createReleaseRef("", "Importé", "torrent", normalizedFiles[0].size, normalizedFiles[0].quality, 0) : undefined,
      });
      refreshLoose("tv");
      void notifySeerrStatus("series", series.tmdbId, "available").catch(() => {});
    }
    return { ok: true as const, updated: "series", id: series.id, imported: importedCount };
  }

  // ref.kind === "episode" — two very different situations land here:
  //
  // 1. A plain single-episode grab: exactly one file, always meant for
  //    ref.episode regardless of what its own filename happens to parse to
  //    (a mislabeled/off-by-one release is still THE release the user or
  //    auto-search picked for this episode — there's no other candidate
  //    episode it could rightfully belong to). Assign it directly and leave
  //    every other episode alone.
  //
  // 2. A season-pack grab targeting several missing episodes at once that
  //    only carries ONE episode in libraryRef, but the engine moved files
  //    for every targeted episode in the same batch — match each file to its
  //    own episode by parsed number, or every episode past the first would
  //    stay stuck "downloading" forever despite already having a file.
  const singleFile = normalizedFiles.length === 1 ? normalizedFiles[0] : null;
  // Same season-consistency guard as the "season" branch above.
  const seasonFiles = normalizedFiles.filter((f) => f.season == null || f.season === ref.season);
  const probedEpisodes: { season: number; episode: number; path: string }[] = [];
  const seasons = series.seasons.map((season) => {
    if (season.seasonNumber !== ref.season) return season;
    const episodes = season.episodes.map((ep) => {
      if (singleFile) {
        if (ep.episodeNumber !== ref.episode) return releaseIfOrphaned(ep, infoHash);
        probedEpisodes.push({ season: season.seasonNumber, episode: ep.episodeNumber, path: singleFile.path });
        return {
          ...ep,
          status: "available" as const,
          activeInfoHash: null,
          file: {
            path: singleFile.path,
            quality: singleFile.quality ?? "—",
            resolution: singleFile.resolution,
            videoCodec: singleFile.videoCodec,
            audioCodec: singleFile.audioCodec,
            hdr: singleFile.hdr,
            source: singleFile.source,
            size: singleFile.size,
            addedAt: Date.now(),
          },
        };
      }
      const match = seasonFiles.find((f) => movedFileCoversEpisode(f, ep.episodeNumber));
      if (!match) return releaseIfOrphaned(ep, infoHash);
      probedEpisodes.push({ season: season.seasonNumber, episode: ep.episodeNumber, path: match.path });
      return {
        ...ep,
        status: "available" as const,
        activeInfoHash: null,
        file: {
          path: match.path,
          quality: match.quality ?? "—",
          resolution: match.resolution,
          videoCodec: match.videoCodec,
          audioCodec: match.audioCodec,
          hdr: match.hdr,
          source: match.source,
          size: match.size,
          addedAt: Date.now(),
        },
      };
    });
    return { ...season, episodes };
  });

  updateSeries(series.id, { seasons });
  for (const pe of probedEpisodes) probeEpisodeInBackground(series.id, pe.season, pe.episode, pe.path);
  // Zero files means every targeted episode was just released back to
  // "missing" above (releaseIfOrphaned) — skip the false "available" signal
  // (see the season branch's matching comment).
  if (normalizedFiles.length > 0) {
    emitNotification("import_episode_available", `${series.title} — ${code} est maintenant disponible`, `/title/series/${series.tmdbId}`, { title: series.title, code: code! });
    logActivity("imported", "system", `${series.title} — ${code}`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "episode", seriesId: series.id, season: ref.season, episode: ref.episode }),
      quality: normalizedFiles[0]?.quality ?? undefined,
    });
    logActivityV2({
      kind: "imported",
      media: createMediaRef("series", series.id, series.tmdbId, series.title, ref.season, ref.episode),
      actor: "system",
      release: normalizedFiles[0]?.quality ? createReleaseRef("", "Importé", "torrent", normalizedFiles[0].size, normalizedFiles[0].quality, 0) : undefined,
    });
    refreshLoose("tv");
    void notifySeerrStatus("series", series.tmdbId, "available").catch(() => {});
  }
  return { ok: true as const, updated: "episode", id: series.id };
}
