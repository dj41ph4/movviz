import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveFfmpegBinary, resolveFfprobeBinary } from "@/lib/playback/engine/mediaRuntime";
import { getMovie, getMovieByPlexRatingKey, loadMovies, loadSeries } from "@/lib/library/store";
import { getPrimaryFile } from "@/lib/library/versions";
import { readableLocalPath } from "@/lib/playback/sourceResolver";
import { hasActivePlayback } from "@/lib/priority/userActivity";
import { listSessions } from "@/lib/playback/engine/sessionManager";

/**
 * Planches de vignettes (sprites) pour l'aperçu au survol de la barre de
 * progression, pour les fichiers que Plex n'a pas préparés.
 *
 * Choix de conception, mesurés sur un fichier de test (1080p, 20 min) :
 * - UN SAUT PAR VIGNETTE (`-ss` avant `-i`, `-noaccurate_seek`) plutôt qu'une
 *   passe sur tout le fichier : une passe lit le fichier en entier (très
 *   coûteux sur un disque de NAS avec un remux de 40 Go), alors que les sauts
 *   ne lisent qu'une petite fraction de chaque fichier.
 * - une vignette toutes les 10 s, regroupées en planches de 10×10 : un seul
 *   téléchargement charge 100 aperçus d'un coup, le survol est instantané.
 * - un processus à la fois, un thread, priorité la plus basse.
 */

export const SPRITE_INTERVAL_SEC = 10;
export const SPRITE_THUMB_W = 240;
// Hauteur paire : le filtre `pad` arrondit aux dimensions de chroma (4:2:0) et refuse 135.
export const SPRITE_THUMB_H = 136;
export const SPRITE_COLS = 10;
export const SPRITE_ROWS = 10;
const SPRITE_PER_SHEET = SPRITE_COLS * SPRITE_ROWS;
/** 2 000 vignettes = 5 h 30 : au-delà, l'intervalle serait de toute façon trop fin pour servir. */
const MAX_THUMBS = 2000;
const THUMB_TIMEOUT_MS = 25_000;
const PAUSE_BETWEEN_THUMBS_MS = 25;
/** Pendant une lecture (en copie de la vidéo) : pauses longues entre deux vignettes, pour que le disque reste disponible. */
const PAUSE_DURING_PLAYBACK_MS = 400;
/** Plus de 25 % de vignettes impossibles à extraire : le fichier est illisible, on ne publie rien. */
const MAX_FAILED_RATIO = 0.25;

export interface SpriteManifest {
  /** Taille + date du fichier source : un fichier remplacé invalide les planches. */
  version: string;
  intervalSec: number;
  thumbW: number;
  thumbH: number;
  cols: number;
  rows: number;
  count: number;
  sheets: number;
  durationSec: number;
}

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const ROOT = path.join(CONFIG_DIR, "scrub-sprites");

/** Générations simultanées au plus : chaque survol d'un épisode non préparé en lance une, et parcourir une saison ne doit jamais saturer le disque du serveur. */
const MAX_CONCURRENT = 2;
/** File d'attente bornée : au-delà, la demande est refusée (le lecteur réessaiera) plutôt que de s'empiler sans fin. */
const MAX_QUEUED = 12;
/** Un échec est mémorisé : sans ça, chaque survol relancerait aussitôt la même génération vouée à l'échec. */
const FAILURE_MEMORY_MS = 30 * 60 * 1000;

type Registry = { inflight: Map<string, Promise<boolean>>; running: number; waiters: Array<() => void>; failedAt: Map<string, number>; reasons: Map<string, string> };
const g = globalThis as typeof globalThis & { __movvizScrubSprites?: Registry };
const registry: Registry = (g.__movvizScrubSprites ??= { inflight: new Map(), running: 0, waiters: [], failedAt: new Map(), reasons: new Map() });

async function acquireSlot(): Promise<void> {
  if (registry.running < MAX_CONCURRENT) { registry.running++; return; }
  await new Promise<void>((resolve) => registry.waiters.push(resolve));
}
function releaseSlot(): void {
  const next = registry.waiters.shift();
  if (next) next(); // le créneau passe directement au suivant
  else registry.running--;
}

function safeKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
function dirFor(id: string): string {
  return path.join(ROOT, safeKey(id));
}

// ─── Résolution du fichier source ───────────────────────────────────────────

export interface LocalSource {
  /** Identifiant de cache stable (id de film, ou `<série>:s<S>e<E>`). */
  cacheId: string;
  filePath: string;
}

/**
 * Chemin que CE serveur peut réellement lire. Le chemin enregistré est parfois
 * celui que Plex voit (ex. /volume1/... côté NAS), invisible depuis le
 * conteneur : le lecteur le traduit avec les correspondances de chemins déjà
 * apprises, et les planches doivent faire exactement pareil — sinon la
 * génération échoue aussitôt (« fichier introuvable ») pour tout fichier lié à Plex.
 */
function pathOf(file: { diskPath?: string; path?: string } | null | undefined): string | null {
  return readableLocalPath(file?.diskPath ?? file?.path);
}

/** `ratingKey` du lecteur : id Movviz d'un film, `<série>:s<S>e<E>`, ou clé Plex. */
export function resolveLocalSource(ratingKey: string): LocalSource | null {
  const movie = getMovie(ratingKey) ?? getMovieByPlexRatingKey(ratingKey);
  if (movie) {
    const p = pathOf(getPrimaryFile(movie));
    return p ? { cacheId: movie.id, filePath: p } : null;
  }
  const m = /^(.+):s(\d+)e(\d+)$/.exec(ratingKey);
  const wanted = m ? { seriesId: m[1], season: Number(m[2]), episode: Number(m[3]) } : null;
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        const matches = wanted
          ? series.id === wanted.seriesId && season.seasonNumber === wanted.season && ep.episodeNumber === wanted.episode
          : ep.plexRatingKey === ratingKey;
        if (!matches) continue;
        const p = pathOf(ep.file);
        return p ? { cacheId: `${series.id}:s${season.seasonNumber}e${ep.episodeNumber}`, filePath: p } : null;
      }
    }
  }
  return null;
}

/** Tous les fichiers que Plex n'a pas liés : seuls ceux-là ont besoin de nos planches. */
export function listUnlinkedLocalSources(): LocalSource[] {
  const out: LocalSource[] = [];
  for (const movie of loadMovies()) {
    const p = pathOf(getPrimaryFile(movie));
    if (p && !movie.plexRatingKey) out.push({ cacheId: movie.id, filePath: p });
  }
  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      if (season.seasonNumber <= 0) continue;
      for (const ep of season.episodes) {
        const p = pathOf(ep.file);
        if (p && !ep.plexRatingKey) out.push({ cacheId: `${series.id}:s${season.seasonNumber}e${ep.episodeNumber}`, filePath: p });
      }
    }
  }
  return out;
}

// ─── Lecture ────────────────────────────────────────────────────────────────

async function versionOf(filePath: string): Promise<string | null> {
  try {
    const st = await fsp.stat(filePath);
    return `${st.size}-${Math.floor(st.mtimeMs)}`;
  } catch {
    return null;
  }
}

/** Manifeste à jour pour ce fichier, ou null (absent, périmé ou fichier introuvable). */
export async function readManifest(source: LocalSource): Promise<SpriteManifest | null> {
  const version = await versionOf(source.filePath);
  if (!version) return null;
  try {
    const manifest = JSON.parse(await fsp.readFile(path.join(dirFor(source.cacheId), "manifest.json"), "utf8")) as SpriteManifest;
    return manifest.version === version ? manifest : null;
  } catch {
    return null;
  }
}

export function sheetPath(cacheId: string, sheet: number): string | null {
  if (!Number.isInteger(sheet) || sheet < 1 || sheet > 100) return null;
  return path.join(dirFor(cacheId), `sheet${String(sheet).padStart(2, "0")}.jpg`);
}

// ─── Génération ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Lance un binaire à priorité minimale et attend sa fin ; `stdout` renvoyé en texte. */
function run(bin: string, args: string[], timeoutMs: number, cancelled?: () => boolean): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let settled = false;
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    try { if (child.pid) os.setPriority(child.pid, 19); } catch { /* priorité non modifiable : sans importance */ }
    // Priorité disque « inactif » quand l'outil existe (Linux) : le processus ne lit que si personne d'autre n'a besoin du disque.
    if (child.pid && process.platform === "linux") {
      try { spawn("ionice", ["-c", "3", "-p", String(child.pid)], { stdio: "ignore" }).on("error", () => {}); } catch { /* absent : sans importance */ }
    }
    const timer = setTimeout(() => { child.kill("SIGKILL"); }, timeoutMs);
    // Une lecture démarre : on tue ffmpeg tout de suite, sans attendre la fin de la vignette en cours.
    const watcher = cancelled ? setInterval(() => { if (cancelled()) child.kill("SIGKILL"); }, 300) : null;
    child.stdout.on("data", (d) => { if (out.length < 4096) out += String(d); });
    child.stderr.on("data", (d) => { err = (err + String(d)).slice(-400); });
    const done = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (watcher) clearInterval(watcher);
      resolve({ code, stdout: out, stderr: err });
    };
    child.on("error", () => done(null));
    child.on("close", (code) => done(code));
  });
}

async function probeDuration(filePath: string, cancelled?: () => boolean): Promise<number | null> {
  const { code, stdout } = await run(resolveFfprobeBinary(), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath], 30_000, cancelled);
  const duration = Number.parseFloat(stdout.trim());
  return code === 0 && Number.isFinite(duration) && duration > 0 ? duration : null;
}

/**
 * La génération doit-elle céder la place ? Oui dès qu'un TRANSCODAGE VIDÉO est en cours : c'est la seule
 * charge qui peut faire manquer le temps réel à une lecture (CPU saturé). Une lecture en copie de la vidéo
 * (DIRECT_STREAM, REMUX : seul l'audio est converti) ne coûte presque rien : ffmpeg d'aperçu, à priorité
 * minimale et avec de longues pauses, peut alors travailler — c'est ce qui permet d'avoir l'aperçu du film
 * que l'on regarde sans attendre un moment de repos du serveur.
 */
export function shouldYieldToPlayback(): boolean {
  if (!hasActivePlayback()) return false;
  try {
    return listSessions().some((session) => session.videoAction === "TRANSCODE");
  } catch {
    return true; // dans le doute, la lecture passe avant
  }
}

export interface GenerateOptions {
  /** Interrompt proprement la génération (lecture démarrée, arrêt demandé…). */
  shouldCancel?: () => boolean;
}

/**
 * Génère (ou régénère) les planches d'un fichier. Idempotent : si le manifeste
 * est déjà à jour, ne fait rien. Un appel concurrent pour le même fichier
 * partage la même génération. Résout à `true` si des planches valides existent.
 */
export function ensureSprites(source: LocalSource, opts: GenerateOptions = {}): Promise<boolean> {
  const running = registry.inflight.get(source.cacheId);
  if (running) return running;
  if (registry.waiters.length >= MAX_QUEUED) return Promise.resolve(false);
  const promise = (async () => {
    await acquireSlot();
    try {
      const outcome = await generate(source, opts);
      // Une annulation volontaire (lecture démarrée) n'est pas un échec du fichier.
      if (outcome === true) { registry.failedAt.delete(source.cacheId); registry.reasons.delete(source.cacheId); }
      else if (outcome === false) registry.failedAt.set(source.cacheId, Date.now());
      return outcome === true;
    } finally {
      releaseSlot();
    }
  })().finally(() => registry.inflight.delete(source.cacheId));
  registry.inflight.set(source.cacheId, promise);
  return promise;
}

export function isGenerating(cacheId: string): boolean {
  return registry.inflight.has(cacheId);
}

/** La dernière génération de ce fichier a échoué il y a peu : inutile de réessayer tout de suite. */
export function hasRecentlyFailed(cacheId: string): boolean {
  const at = registry.failedAt.get(cacheId);
  return at != null && Date.now() - at < FAILURE_MEMORY_MS;
}

/** Raison du dernier échec de ce fichier (diagnostic : renvoyée par la route, aucun journal du serveur web n'étant accessible sur un NAS). */
export function failureReason(cacheId: string): string | null {
  return registry.reasons.get(cacheId) ?? null;
}

/** Pour les tests : vide la mémoire des échecs. */
export function resetFailureMemory(): void {
  registry.failedAt.clear();
  registry.reasons.clear();
}

/** true = planches prêtes · false = échec du fichier · "cancelled" = interrompu pour laisser la place à une lecture. */
async function generate(source: LocalSource, opts: GenerateOptions): Promise<boolean | "cancelled"> {
  // La lecture passe TOUJOURS avant : aucune génération tant qu'un transcodage vidéo est en cours, et
  // toute génération en cours s'arrête dès qu'un transcodage démarre.
  const cancelled = () => shouldYieldToPlayback() || !!opts.shouldCancel?.();
  if (cancelled()) return "cancelled";
  const fail = (reason: string): false => {
    registry.reasons.set(source.cacheId, reason);
    console.error(`[scrub-sprites] ${source.cacheId}: ${reason}`);
    return false;
  };
  const version = await versionOf(source.filePath);
  if (!version) return fail("fichier source introuvable depuis le serveur");
  if (await readManifest(source)) return true;

  const duration = await probeDuration(source.filePath, cancelled);
  if (cancelled()) return "cancelled";
  if (!duration) return fail("durée illisible (ffprobe indisponible ou fichier non analysable)");

  const count = Math.min(MAX_THUMBS, Math.floor(duration / SPRITE_INTERVAL_SEC) + 1);
  const finalDir = dirFor(source.cacheId);
  const tmpDir = `${finalDir}.tmp-${process.pid}`;
  await fsp.rm(tmpDir, { recursive: true, force: true });
  await fsp.mkdir(tmpDir, { recursive: true });
  const ffmpeg = resolveFfmpegBinary();
  const scale = `scale=${SPRITE_THUMB_W}:${SPRITE_THUMB_H}:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,pad=${SPRITE_THUMB_W}:${SPRITE_THUMB_H}:(ow-iw)/2:(oh-ih)/2:black`;

  try {
    let failed = 0;
    let lastStderr = "";
    let lastGood: string | null = null;
    for (let i = 0; i < count; i++) {
      if (cancelled()) return "cancelled";
      const out = path.join(tmpDir, `t${i}.jpg`);
      // Milieu de l'intervalle : le tout début d'un film est souvent noir.
      const at = Math.min(duration - 0.5, (i + 0.5) * SPRITE_INTERVAL_SEC);
      const { code, stderr: thumbErr } = await run(
        ffmpeg,
        ["-hide_banner", "-loglevel", "error", "-y", "-threads", "1", "-ss", at.toFixed(2), "-noaccurate_seek", "-i", source.filePath, "-an", "-sn", "-frames:v", "1", "-vf", scale, "-q:v", "5", out],
        THUMB_TIMEOUT_MS,
        cancelled,
      );
      if (cancelled()) return "cancelled";
      if (code === 0 && fs.existsSync(out)) {
        lastGood = out;
      } else {
        failed++;
        lastStderr = thumbErr.trim().split("\n").pop() || (code == null ? "ffmpeg n'a pas démarré ou a dépassé le délai" : `code ${code}`);
        if (failed / count > MAX_FAILED_RATIO) return fail(`plus d'une vignette sur 4 impossible à extraire (${lastStderr})`);
        // Une vignette manquante reprend la précédente (ou, tout au début du
        // fichier, la première valide : voir plus bas) pour garder la grille continue.
        if (lastGood) await fsp.copyFile(lastGood, out);
      }
      await sleep(hasActivePlayback() ? PAUSE_DURING_PLAYBACK_MS : PAUSE_BETWEEN_THUMBS_MS);
    }
    // Les vignettes initiales manquantes (avant la première réussie) prennent la première valide.
    const first = Array.from({ length: count }, (_, i) => path.join(tmpDir, `t${i}.jpg`)).find((p) => fs.existsSync(p));
    if (!first) return fail("aucune vignette extraite");
    for (let i = 0; i < count; i++) {
      const p = path.join(tmpDir, `t${i}.jpg`);
      if (!fs.existsSync(p)) await fsp.copyFile(first, p);
    }

    const sheets = Math.ceil(count / SPRITE_PER_SHEET);
    // `tile` sort UNE image par groupe de 100 vignettes : `-frames:v 1` = une planche (la dernière,
    // incomplète, est émise à la fin des entrées).
    for (let s = 0; s < sheets; s++) {
      const { code, stderr } = await run(
        ffmpeg,
        ["-hide_banner", "-loglevel", "error", "-y", "-threads", "1", "-framerate", "1", "-start_number", String(s * SPRITE_PER_SHEET), "-i", path.join(tmpDir, "t%d.jpg"), "-frames:v", "1", "-vf", `tile=${SPRITE_COLS}x${SPRITE_ROWS}`, "-q:v", "5", path.join(tmpDir, `sheet${String(s + 1).padStart(2, "0")}.jpg`)],
        60_000,
        cancelled,
      );
      if (cancelled()) return "cancelled";
      if (code !== 0) {
        return fail(`assemblage de la planche ${s + 1} impossible (${stderr.trim().split("\n").pop() || "ffmpeg sans message"})`);
      }
    }
    for (let i = 0; i < count; i++) await fsp.rm(path.join(tmpDir, `t${i}.jpg`), { force: true });

    const manifest: SpriteManifest = { version, intervalSec: SPRITE_INTERVAL_SEC, thumbW: SPRITE_THUMB_W, thumbH: SPRITE_THUMB_H, cols: SPRITE_COLS, rows: SPRITE_ROWS, count, sheets, durationSec: duration };
    await fsp.writeFile(path.join(tmpDir, "manifest.json"), JSON.stringify(manifest));
    await fsp.rm(finalDir, { recursive: true, force: true });
    await fsp.rename(tmpDir, finalDir);
    return true;
  } catch (e) {
    return fail(`erreur inattendue : ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
