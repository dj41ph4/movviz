import path from "node:path";
import fsp from "node:fs/promises";
import fs from "node:fs";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { loadNamingTemplates } from "@/lib/naming/store";
import { parseRelease } from "@/lib/naming/parser";
import { buildContext, renderSegment } from "@/lib/naming/render";
import type { ReleaseInfo } from "@/lib/naming/types";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { decodeLibraryRef } from "@/lib/library/types";
import { applyImportedFiles, type ImportedFile } from "@/lib/library/applyImportedFiles";
import { matchesBlockedWord, loadReleaseRules } from "@/lib/library/releaseRules";
import { loadActivityV2, logActivityV2, createImportRef } from "@/lib/activity/v2/store";

/**
 * Shared implementation of the "Récupérer les téléchargements" maintenance
 * action and the stuck-download scheduler task — moves files of COMPLETED
 * downloads that never made it into the library (an import callback that
 * failed, was lost on restart, or never fired) into the library using the
 * configured naming templates. Idempotent: a file whose destination already
 * exists is reported as a duplicate and skipped.
 *
 * SECURITY (mission 1e, revue fs): this NEVER moves files of a torrent that
 * is still downloading. The candidate set is built from the engine's own
 * torrent list — only torrents whose state is completed/seeding contribute
 * files. A blind scan of the download folder is deliberately avoided: a
 * misconfigured downloadPath (e.g. pointing at the media root) or a
 * still-downloading torrent would otherwise move partial/active files.
 * Every move is guarded (source must stay under downloadPath, destination
 * under completedPath) and executed atomically without overwrite.
 *
 * UNCLAIMED FILES: a torrent can vanish from the engine entirely (removed
 * from the client, lost across a restart, manually deleted) — its files sit
 * in the download folder forever, invisible to the engine-confirmed path
 * above since there's no torrent record left to list them. This covers both
 * a library item still marked "downloading" with that now-unknown infoHash,
 * AND one already reset back to "missing" by a stuck-download/reconciliation
 * pass that gave up on the claim before the file was ever recovered — once
 * that reset happens the item carries no marker at all, so requiring a live
 * "downloading" claim would make the file invisible forever. A file is still
 * never touched blindly: it must (a) not belong to any current torrent
 * (active or otherwise — never overrides the "still downloading" guard
 * above), and (b) sit quiet for a longer grace period since there's no
 * engine "completed" signal to rely on. Once both hold, it's matched against
 * the full library exactly like the engine-confirmed path above — the same
 * trust level, since "no torrent currently claims this file" is the
 * equivalent safety signal to "a completed torrent's own file list".
 */
export interface Recovered { title: string; src: string; dest: string; size: number; season?: number; episode?: number }
export interface Failed { src: string; size: number; reason: string }
export interface Duplicate { src: string; size: number }

/**
 * A completed torrent whose library item is still "downloading" — the import
 * callback never landed (engine crashed between completion and import, the
 * move failed, or the callback was lost) and its files are still sitting in
 * the download folder. Detected by reconcileStuckDownloads and recovered
 * through the same recoverDownloads() logic as the manual action.
 */
export interface StuckDownload {
  infoHash: string;
  name: string;
  libraryRef: string;
  instanceId: string;
  category: string;
}

/**
 * Detects completed torrents whose import never went through. A torrent is
 * stuck when the engine reports it done (completed/seeding) while the
 * library item it claims still says "downloading" with that same infoHash —
 * the import callback either never fired or was lost, and the files are
 * still in the download folder. Skips entirely when the engine is
 * unreachable. Returns only the torrents that are genuinely stuck (no false
 * positives from a torrent that is still legitimately downloading).
 */
export async function detectStuckDownloads(): Promise<StuckDownload[]> {
  const instRes = await fetch(`${ENGINE_BASE}/instances`, {
    headers: engineHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!instRes.ok) return [];
  const { instances } = await instRes.json() as {
    instances: Array<{ id: string; category: string }>;
  };
  const instanceByCategory = new Map((instances ?? []).map((i) => [i.category, i]));

  const tRes = await fetch(`${ENGINE_BASE}/torrents`, {
    headers: engineHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tRes.ok) return [];
  const { torrents } = await tRes.json() as {
    torrents: Array<{ infoHash: string; name: string; state: string; progress: number; libraryRef: string | null }>;
  };
  if (!torrents?.length) return [];

  // Library lookups keyed by what the libraryRef points at.
  const movies = loadMovies();
  const series = loadSeries();

  const stuck: StuckDownload[] = [];
  for (const t of torrents) {
    if (t.state !== "completed" && t.state !== "seeding") continue;
    if (!t.libraryRef) continue;
    const ref = decodeLibraryRef(t.libraryRef);
    if (!ref) continue;
    const inst = instanceByCategory.get(ref.kind === "movie" ? "movie" : "tv");
    if (!inst) continue;

    if (ref.kind === "movie") {
      const movie = movies.find((m) => m.id === ref.movieId);
      if (movie?.status === "downloading" && movie.activeInfoHash === t.infoHash) {
        stuck.push({ infoHash: t.infoHash, name: t.name, libraryRef: t.libraryRef, instanceId: inst.id, category: inst.category });
      }
      continue;
    }

    // Series — any monitored episode of the ref'd series still claimed by
    // this exact hash means the import never landed for that claim.
    const s = series.find((x) => x.id === ref.seriesId);
    if (!s) continue;
    const stillClaimed =
      ref.kind === "series"
        ? s.seasons.some((se) => se.episodes.some((e) => e.status === "downloading" && e.activeInfoHash === t.infoHash))
        : ref.kind === "season"
          ? s.seasons.find((se) => se.seasonNumber === ref.season)?.episodes.some((e) => e.status === "downloading" && e.activeInfoHash === t.infoHash)
          : s.seasons.find((se) => se.seasonNumber === ref.season)?.episodes.some((e) => e.episodeNumber === ref.episode && e.status === "downloading" && e.activeInfoHash === t.infoHash);
    if (stillClaimed) {
      stuck.push({ infoHash: t.infoHash, name: t.name, libraryRef: t.libraryRef, instanceId: inst.id, category: inst.category });
    }
  }
  return stuck;
}

const VIDEO_EXT_RE = /\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i;

/** Orphaned files have no engine "completed" signal to rely on, only file
 *  age — a longer quiet period than the engine-confirmed path's 30s. */
const ORPHAN_MIN_AGE_MS = 5 * 60_000;

function norm(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[._\s\-–:!?,;'"()]+/g, " ")
    .trim();
}

function fuzzyMatch(parsedTitle: string, libTitle: string): boolean {
  const p = norm(parsedTitle);
  const l = norm(libTitle);
  if (l.includes(p) || p.includes(l)) return true;
  const pWords = p.split(" ").filter((w) => w.length > 1);
  const lWords = l.split(" ").filter((w) => w.length > 1);
  if (pWords.length === 0 || lWords.length === 0) return false;
  const overlap = pWords.filter((w) => lWords.includes(w)).length;
  return overlap / Math.max(pWords.length, lWords.length) >= 0.6;
}

/**
 * A scene release is always named after the ORIGINAL title, never a
 * localized one — "New York, crime organisé" in the library vs.
 * "Law.and.Order.Organized.Crime..." on disk share zero words, so matching
 * against `title` alone systematically fails for any show whose French
 * display title diverges from its original name. Checks `originalTitle`
 * (TMDb's non-localized title, stored since it was added — see types.ts)
 * as a second candidate when present; entries added before this field
 * existed just fall back to title-only matching, same as before.
 */
function matchesTitle(parsedTitle: string, item: { title: string; originalTitle?: string | null }): boolean {
  return fuzzyMatch(parsedTitle, item.title) || (!!item.originalTitle && fuzzyMatch(parsedTitle, item.originalTitle));
}

async function scanVideoFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(d: string) {
    try {
      const entries = await fsp.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) { await walk(full); }
        else if (VIDEO_EXT_RE.test(e.name)) { results.push(full); }
      }
    } catch { /* skip inaccessible dirs */ }
  }
  await walk(dir);
  return results;
}

async function getFileAgeMs(fp: string): Promise<number> {
  try { return Date.now() - (await fsp.stat(fp)).mtimeMs; } catch { return 0; }
}

/** The download folder must be at least 2 levels deep — anything shallower
 *  (drive root, "/", or a mount point) is a misconfiguration that would let
 *  a scan touch far more than the engine's own downloads. */
function isSafeDownloadRoot(dir: string): boolean {
  const resolved = path.resolve(dir);
  const depth = resolved.split(/[\\/]/).filter(Boolean).length;
  return depth >= 2;
}

/** True when `candidate` resolves strictly inside `root`. */
function isInside(root: string, candidate: string): boolean {
  const r = path.resolve(root) + path.sep;
  return path.resolve(candidate).startsWith(r);
}

/**
 * Move src → dest WITHOUT ever overwriting an existing destination. On the
 * same filesystem this is a hard link (fails EEXIST if dest exists — atomic)
 * followed by unlink of the source; across filesystems it falls back to
 * copyFile with COPYFILE_EXCL (also fails EEXIST) + unlink. Either way an
 * existing destination aborts the move instead of silently replacing it.
 */
async function moveNoOverwrite(src: string, dest: string): Promise<void> {
  try {
    await fsp.link(src, dest);
    await fsp.unlink(src).catch(() => {});
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EEXIST") {
      throw new Error("Existe déjà dans la bibliothèque");
    }
    if (code === "EXDEV" || code === "EPERM" || code === "ENOSYS" || code === "EACCES") {
      // Cross-device or filesystem without hard links — copy with EXCL flag.
      await fsp.copyFile(src, dest, fs.constants.COPYFILE_EXCL);
      await fsp.unlink(src).catch(() => {});
      return;
    }
    throw e;
  }
}

// ─── Instance / torrent helpers ───────────────────────────────────────────

interface EngineInstance { id: string; category: string; downloadPath: string; completedPath: string }
interface EngineTorrent { infoHash: string; name: string; state: string; libraryRef: string | null; instanceId: string }

async function fetchInstances(): Promise<EngineInstance[]> {
  const res = await fetch(`${ENGINE_BASE}/instances`, {
    headers: engineHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error("engine_unreachable");
  const { instances } = await res.json() as { instances: EngineInstance[] };
  if (!instances?.length) throw new Error("no_instances");
  return instances;
}

async function fetchTorrents(): Promise<EngineTorrent[]> {
  const res = await fetch(`${ENGINE_BASE}/torrents`, {
    headers: engineHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const { torrents } = await res.json() as { torrents: EngineTorrent[] };
  return torrents ?? [];
}

interface TorrentDetailFile { name: string; path: string; length: number }

/** Resolve a torrent file's on-disk path the same way the engine does. */
function resolveTorrentFile(downloadPath: string, f: TorrentDetailFile): string {
  return path.isAbsolute(f.path) ? f.path : path.join(downloadPath, f.path);
}

const g = globalThis as typeof globalThis & { __movvizRecoverRunning?: boolean };

/**
 * A completed file recoverDownloads() cannot title-match to anything in the
 * library — the release's own name (or the internal filenames of a season
 * pack, e.g. "SDBZH Saison 1.Universe.Mission" for Super Dragon Ball Heroes,
 * confirmed live) doesn't overlap enough words with any known title —
 * previously only landed in the in-memory `failed` array, which the
 * scheduler task never persists anywhere. The file itself is never deleted
 * (it's still sitting in the download folder), so it silently existed
 * forever with no way for a human to notice or act on it. This surfaces it
 * through the SAME "unlinked downloads" activity entry + manual-link UI a
 * truly-manual no-title torrent add already produces, generically for any
 * title the parser/matcher couldn't confidently resolve — not a hack scoped
 * to this one show. Idempotent: skips if this exact file already has an
 * unlinked entry from a previous recovery pass.
 */
function recordUnlinked(fp: string, size: number, parsedTitle: string, category: string, season: number | null | undefined, quality: string | null | undefined) {
  const already = loadActivityV2().some((e) => e.kind === "imported" && e.import?.destinationPath === fp && e.media?.href === "#");
  if (already) return;
  logActivityV2({
    kind: "imported",
    media: {
      id: fp,
      title: parsedTitle,
      type: category === "movie" ? "movie" : "series",
      season: season ?? undefined,
      href: "#",
      linked: false,
    },
    actor: "system",
    import: createImportRef(fp, size, path.basename(fp), quality ?? "—"),
  });
}

/**
 * Recover completed downloads. When `stuck` is provided (scheduler path),
 * ONLY those torrents' files are candidates. Otherwise (manual action) every
 * file whose owning torrent is completed/seeding is a candidate — files of
 * still-downloading torrents are NEVER touched.
 *
 * After each successful move, the library metadata is updated exactly like
 * the engine's import callback would have (applyImportedFiles) — recovery is
 * a fallback import, so the item must not stay stuck on "downloading".
 */
export async function recoverDownloads(stuck?: StuckDownload[]): Promise<{
  recovered: Recovered[];
  failed: Failed[];
  duplicates: Duplicate[];
  summary: string;
}> {
  // Serialize concurrent runs (scheduler + manual action) — a second run
  // while one is moving files would race on the same destinations.
  if (g.__movvizRecoverRunning) {
    return { recovered: [], failed: [], duplicates: [], summary: "Déjà en cours d'exécution" };
  }
  g.__movvizRecoverRunning = true;
  try {
    const instances = await fetchInstances();
    const torrents = await fetchTorrents();

    const movies = loadMovies();
    const series = loadSeries();
    const naming = loadNamingTemplates();
    const releaseRules = loadReleaseRules();
    const recovered: Recovered[] = [];
    const failed: Failed[] = [];
    const duplicates: Duplicate[] = [];

    const stuckSet = new Map<string, StuckDownload>((stuck ?? []).map((s) => [s.infoHash, s]));

    for (const inst of instances) {
      if (!inst.downloadPath || !inst.completedPath) {
        failed.push({ src: `instance:${inst.id}`, size: 0, reason: "Chemins de téléchargement/destination manquants côté moteur" });
        continue;
      }
      if (!isSafeDownloadRoot(inst.downloadPath)) {
        failed.push({ src: `instance:${inst.id}`, size: 0, reason: "Dossier de téléchargement trop proche de la racine — configuration suspecte, récupération ignorée" });
        continue;
      }

      // Candidate torrents: completed/seeding ones (optionally narrowed to
      // the stuck list). Files of every OTHER torrent state (downloading,
      // paused, queued, blocked) are excluded outright.
      const instTorrents = torrents.filter((t) => t.instanceId === inst.id);
      const candidateTorrents = instTorrents.filter((t) =>
        (t.state === "completed" || t.state === "seeding") &&
        (stuckSet.size === 0 || stuckSet.has(t.infoHash))
      );

      // Build the allowed file set from the torrents' own file lists.
      const allowed = new Set<string>();
      for (const t of candidateTorrents) {
        let detail: { files?: TorrentDetailFile[] } | null = null;
        try {
          const res = await fetch(`${ENGINE_BASE}/torrents/${t.infoHash}`, {
            headers: engineHeaders(),
            signal: AbortSignal.timeout(10_000),
          });
          if (res.ok) detail = await res.json();
        } catch { /* unreachable → skip this torrent */ }
        for (const f of detail?.files ?? []) {
          if (!f.path) continue;
          const fp = resolveTorrentFile(inst.downloadPath, f);
          if (isInside(inst.downloadPath, fp)) allowed.add(fp);
        }
      }

      // Files belonging to ANY torrent the engine still tracks — including
      // active/paused/queued/blocked ones, not just the completed/seeding
      // candidates above — must never be eligible for the unclaimed path.
      // Otherwise a stalled-but-still-downloading torrent's file (its mtime
      // frozen past ORPHAN_MIN_AGE_MS) could be misattributed to an
      // unrelated library title it merely fuzzy-matches, silently stealing
      // an in-progress download.
      const activeTorrents = instTorrents.filter((t) => !candidateTorrents.includes(t));
      const activeFiles = new Set<string>();
      // If any active torrent's file list can't be confirmed, the unclaimed
      // path for this instance is disabled entirely this run rather than
      // silently trusting a partial activeFiles set — an unconfirmed active
      // torrent's files must never be eligible for unclaimed-matching by
      // omission (a transient engine timeout must not reopen the
      // misattribution window this whole block exists to close).
      let filesSafeThisInstance = true;
      for (const t of activeTorrents) {
        let detail: { files?: TorrentDetailFile[] } | null = null;
        try {
          const res = await fetch(`${ENGINE_BASE}/torrents/${t.infoHash}`, {
            headers: engineHeaders(),
            signal: AbortSignal.timeout(10_000),
          });
          if (res.ok) detail = await res.json();
          else filesSafeThisInstance = false;
        } catch { filesSafeThisInstance = false; }
        for (const f of detail?.files ?? []) {
          if (!f.path) continue;
          const fp = resolveTorrentFile(inst.downloadPath, f);
          if (isInside(inst.downloadPath, fp)) activeFiles.add(fp);
        }
      }

      const files = await scanVideoFiles(inst.downloadPath);
      for (const fp of files) {
        const engineConfirmed = allowed.has(fp);
        if (!engineConfirmed && (!filesSafeThisInstance || activeFiles.has(fp))) continue; // file of an active torrent or unconfirmed — never touch

        const age = await getFileAgeMs(fp);
        if (age < (engineConfirmed ? 30_000 : ORPHAN_MIN_AGE_MS)) continue;

        const size = await fsp.stat(fp).then((s) => s.size).catch(() => 0);
        const basename = path.basename(fp);
        let parsed = parseRelease(basename);
        // Some releases (fansub-style season packs especially) name each
        // episode file after its own episode title only — "01 - Ryusui vs.
        // Senku.mkv" — with the show name and season living solely in the
        // containing folder ("Dr.Stone.S04.MULTI...-AnimesForAll"). The file's
        // own basename never parses a season in that case, so fall back to
        // the parent folder's name (only ever consulted when the file itself
        // gave up), keeping the folder's title/season/quality but recovering
        // the episode number from the file's own leading digits.
        if (inst.category === "series" && parsed.season == null) {
          const folderParsed = parseRelease(path.basename(path.dirname(fp)));
          if (folderParsed.season != null) {
            const epMatch = basename.match(/^\D*(\d{1,3})\b/);
            parsed = { ...folderParsed, episode: epMatch ? parseInt(epMatch[1], 10) : folderParsed.episode };
          }
        }
        const parsedTitle = parsed.title;
        if (!parsedTitle || parsedTitle.length < 2) {
          failed.push({ src: fp, size, reason: "Impossible d'extraire un titre du nom de fichier" });
          continue;
        }

        // Same reasoning as applyImportedFiles.ts's post-import safety net —
        // a file's real name can carry a blocked term the original search
        // never saw (the indexer's own advertised title can differ from
        // what's actually inside the torrent). Recovery works from files
        // already sitting on disk with no grab decision to have blocked in
        // the first place, so this is the only checkpoint before it would
        // otherwise get silently imported as a normal available file.
        const blockedTerm = matchesBlockedWord(basename, releaseRules) ?? matchesBlockedWord(path.basename(path.dirname(fp)), releaseRules);
        if (blockedTerm) {
          failed.push({ src: fp, size, reason: `Terme interdit détecté : "${blockedTerm}"` });
          continue;
        }

        let dest: string | null = null;
        let destRoot = inst.completedPath;
        let label = "";
        let importRef: import("@/lib/library/applyImportedFiles").LibraryImportRef | null = null;

        if (inst.category === "movie") {
          const match = movies.find((m) => matchesTitle(parsedTitle, m));
          if (match) {
            const ctx = buildContext({ ...parsed, title: match.title, year: String(match.year ?? "") } as ReleaseInfo);
            const folder = renderSegment(naming.movieFolder, ctx, naming.useDotsInsteadOfSpaces);
            const file = renderSegment(naming.movieFile, ctx, naming.useDotsInsteadOfSpaces);
            const ext = path.extname(fp);
            dest = path.join(inst.completedPath, folder, file + ext);
            label = match.title;
            importRef = { kind: "movie", movieId: match.id };
          }
        } else if (inst.category === "series") {
          const sMatch = series.find((s) => matchesTitle(parsedTitle, s));
          if (sMatch && parsed.season != null) {
            const ctx = buildContext({ ...parsed, title: sMatch.title, year: String(sMatch.year ?? "") } as ReleaseInfo);
            const seriesFolder = renderSegment(naming.seriesFolder, ctx, naming.useDotsInsteadOfSpaces);
            // Specials always land in a literal "Specials" folder — see the
            // matching comment in the engine's AbstractBackend.mjs.
            const seasonFolder = parsed.season === 0 ? "Specials" : renderSegment(naming.seasonFolder, ctx, naming.useDotsInsteadOfSpaces);
            const file = renderSegment(naming.episodeFile, ctx, naming.useDotsInsteadOfSpaces);
            const ext = path.extname(fp);
            dest = path.join(inst.completedPath, seriesFolder, seasonFolder, file + ext);
            const ep = parsed.episode != null ? String(parsed.episode).padStart(2, "0") : "XX";
            label = `${sMatch.title} S${String(parsed.season).padStart(2, "0")}E${ep}`;
            // Season-kind apply: matches every episode of that season covered
            // by the file's parsed episode/range — the same matching the
            // engine's season-pack import callback performs.
            importRef = { kind: "season", seriesId: sMatch.id, season: parsed.season };
          } else {
            // A release with no season marker inside a series-category
            // download isn't necessarily an episode gone unparsed — franchise
            // "INTEGRALE" packs routinely bundle standalone TV movies
            // alongside the show itself (e.g. "Ben 10: Alien X-Tinction"
            // shipped inside a Ben 10 series pack). Falls back to the movie
            // library before giving up, using the MOVIE instance's own
            // completedPath since this file physically sits under the
            // series instance's downloadPath but belongs in the film library.
            const movieMatch = movies.find((m) => matchesTitle(parsedTitle, m));
            const movieInst = instances.find((i) => i.category === "movie");
            if (movieMatch && movieInst?.completedPath) {
              const ctx = buildContext({ ...parsed, title: movieMatch.title, year: String(movieMatch.year ?? "") } as ReleaseInfo);
              const folder = renderSegment(naming.movieFolder, ctx, naming.useDotsInsteadOfSpaces);
              const file = renderSegment(naming.movieFile, ctx, naming.useDotsInsteadOfSpaces);
              const ext = path.extname(fp);
              dest = path.join(movieInst.completedPath, folder, file + ext);
              destRoot = movieInst.completedPath;
              label = movieMatch.title;
              importRef = { kind: "movie", movieId: movieMatch.id };
            } else if (sMatch) {
              failed.push({ src: fp, size, reason: `Série "${sMatch.title}" trouvée mais saison non détectée` });
              recordUnlinked(fp, size, parsedTitle, inst.category, parsed.season, parsed.resolution);
              continue;
            }
          }
        }

        if (dest) {
          if (!isInside(destRoot, dest)) {
            failed.push({ src: fp, size, reason: "Destination hors du dossier de la bibliothèque — récupération ignorée" });
            continue;
          }
          try {
            const destStat = await fsp.stat(dest).catch(() => null);
            if (destStat) {
              // The file was already imported once — a duplicate grab (e.g.
              // a torrent whose libraryRef was lost across an engine restart
              // before it could import, see locks.ts) downloaded the same
              // episode again. The source copy is redundant (surfaced below
              // via `duplicates` for manual cleanup), but the library itself
              // can still be stuck reporting "missing"/"downloading" for an
              // episode that's genuinely already available — every scheduled
              // search then re-grabs it, compounding the duplicate downloads
              // forever. Reconcile the library status here using the file
              // that's ALREADY at its destination, same shared path as a
              // normal import.
              if (importRef) {
                const fileEntry: ImportedFile = {
                  path: dest,
                  quality: null,
                  resolution: parsed.resolution,
                  videoCodec: parsed.videoCodec,
                  audioCodec: parsed.audioCodec,
                  hdr: parsed.hdr,
                  source: parsed.source,
                  size: destStat.size,
                  season: parsed.season,
                  episode: parsed.episode,
                  episodeEnd: parsed.episodeEnd,
                };
                try {
                  await applyImportedFiles(importRef, [fileEntry], undefined);
                } catch { /* best-effort — duplicate cleanup below still applies regardless */ }
              }
              failed.push({ src: fp, size, reason: "Existe déjà dans la bibliothèque" });
              duplicates.push({ src: fp, size });
              continue;
            }
            await fsp.mkdir(path.dirname(dest), { recursive: true });
            await moveNoOverwrite(fp, dest);
            recovered.push({ title: label, src: fp, dest, size, season: parsed.season ?? undefined, episode: parsed.episode ?? undefined });

            // Fallback import: update library metadata exactly like the
            // engine's import callback would have (P4 — otherwise the item
            // stays "downloading" forever and the recovered file is orphaned).
            if (importRef) {
              const fileEntry: ImportedFile = {
                path: dest,
                quality: null,
                resolution: parsed.resolution,
                videoCodec: parsed.videoCodec,
                audioCodec: parsed.audioCodec,
                hdr: parsed.hdr,
                source: parsed.source,
                size,
                season: parsed.season,
                episode: parsed.episode,
                episodeEnd: parsed.episodeEnd,
              };
              try {
                await applyImportedFiles(importRef, [fileEntry], undefined);
              } catch (e) {
                failed.push({ src: fp, size, reason: `Fichier récupéré mais statut bibliothèque non mis à jour: ${(e as Error).message}` });
              }
            }
          } catch (e) {
            failed.push({ src: fp, size, reason: (e as Error).message });
          }
        } else {
          failed.push({ src: fp, size, reason: "Aucune correspondance trouvée dans la bibliothèque" });
          recordUnlinked(fp, size, parsedTitle, inst.category, parsed.season, parsed.resolution);
        }
      }
    }

    return {
      recovered, failed, duplicates,
      summary: `${recovered.length} récupéré(s), ${failed.length} ignoré(s), ${duplicates.length} doublon(s)`,
    };
  } finally {
    g.__movvizRecoverRunning = false;
  }
}
