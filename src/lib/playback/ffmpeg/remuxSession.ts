/**
 * Gestionnaire de sessions ffmpeg — remux local server-side.
 *
 * Contourne le refus de Plex MDE de copier le bitstream HEVC (voir plan) :
 * Movviz récupère le fichier source brut via `resolvePlexPartUrl()` et le
 * remuxe lui-même (`-c:v copy` toujours, `-c:a copy|aac` selon whitelist) —
 * vidéo bit-exacte à coût CPU nul, audio garanti décodable par le navigateur.
 *
 * Registre de sessions sur `globalThis` (cross-route, voir CLAUDE.md) —
 * miroir du pattern `__movvizMseManifests` (mse/source.ts) et
 * `__movvizTranscodeSessions` (transcodeSessions.ts).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { resolveFfmpegBinary } from "../engine/mediaRuntime";
import { Readable } from "node:stream";
import { existsSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PlexPartRef } from "@/lib/playback/plexSource";
import { MAX_CONCURRENT_TRANSCODES, totalActiveTranscodeSessions } from "@/lib/playback/engine/sharedTranscodeLimit";

export const MAX_CONCURRENT = 3;
export const SESSION_TTL_MS = 5 * 60_000;
export const AUDIO_BITRATE_K = 192;

/**
 * Profils de compression vidéo locale (choix Qualité du player).
 * original = copie bit-exacte (zéro CPU, bitstream du fichier) ; les autres
 * presets ré-encodent en libx264 très rapide (veryfast, CRF 23) avec des
 * débits volontairement sobres — pensés NAS : qualité correcte sans saturer
 * le CPU ni le réseau. Le downscale ne dépasse jamais la source
 * (scale=min(W,iw):-2), donc un fichier 1080p en profil 4K reste en 1080p.
 */
export type FfmpegQuality = "original" | "4k" | "2k" | "fhd" | "hd";

export const FFMPEG_QUALITY_PRESETS: Record<
  FfmpegQuality,
  { maxWidth: number | null; maxrateK: number | null; bufsizeK: number | null }
> = {
  original: { maxWidth: null, maxrateK: null, bufsizeK: null },
  "4k": { maxWidth: 3840, maxrateK: 10000, bufsizeK: 20000 },
  "2k": { maxWidth: 2560, maxrateK: 6500, bufsizeK: 13000 },
  fhd: { maxWidth: 1920, maxrateK: 4000, bufsizeK: 8000 },
  hd: { maxWidth: 1280, maxrateK: 2200, bufsizeK: 4400 },
};

export function isFfmpegQuality(v: unknown): v is FfmpegQuality {
  return v === "original" || v === "4k" || v === "2k" || v === "fhd" || v === "hd";
}

// Audio copiable en remux local — VOLONTAIREMENT plus stricte que la
// whitelist du transcode Plex (qui inclut ac3/ac-3) : ici le flux est lu
// par le décodeur NATIF du <video> (pas hls.js/MSE), et Chrome/Edge ne
// décodent pas l'AC-3/EC-3 en lecture directe MP4 — copier l'AC-3
// produirait un flux muet. Seuls les codecs universellement décodables
// sont copiés ; tout le reste (ac-3, ec-3, dts, truehd...) est transcodé
// en AAC, la garantie du remux local.
const COPY_SAFE_AUDIO = ["aac", "mp4a", "mp3"];

/**
 * Erreur typée : une session avec exactement la MÊME clé
 * (`ratingKey:userId:audioIndex:seekSec`) a déjà un process ffmpeg vivant.
 *
 * Décision de conception (laissée ouverte par le plan) : un `ReadableStream`
 * Web ne peut être lu que par UN seul consommateur — on ne peut pas
 * brancher une deuxième requête HTTP sur le même `proc.stdout` déjà piped
 * sans risquer une lecture partagée/corrompue. Plutôt que de faire semblant
 * de partager le flux (silencieusement faux), `startRemux` REFUSE la
 * duplication en levant cette erreur ; c'est à la ROUTE de décider comment
 * répondre (409 « déjà en cours de streaming » plutôt que de démarrer un
 * second process ou de renvoyer un flux inutilisable). Ce choix est plus
 * sûr que la réutilisation silencieuse et plus simple que du multiplexage.
 */
export class DuplicateSessionError extends Error {
  constructor(public readonly key: string) {
    super(`[remux] session already active: ${key}`);
    this.name = "DuplicateSessionError";
  }
}

export interface StartRemuxOptions {
  audioIndex?: number;
  seekToSec?: number;
  audioBitrateK?: number;
  /** Profil de compression vidéo — "original" = copie bit-exacte (défaut). */
  quality?: FfmpegQuality;
}

interface RemuxSession {
  key: string;
  proc: ChildProcess;
  stream: ReadableStream<Uint8Array>;
  lastAccess: number;
  seq: number;
  /**
   * Sortie secondaire WebVTT : pendant que le process de remux lit le fichier
   * pour produire le MP4 (pipe:1), il écrit AUSSI la piste de sous-titres
   * texte pré-extraite en WebVTT dans ce fichier temp — au même rythme que
   * la lecture du film. Zéro lecture disque/réseau supplémentaire : la route
   * subtitle tail-e ce fichier et streame les cues au client quasi en temps
   * réel (au lieu d'une extraction séparée qui doit relire tout le fichier,
   * ~1 min d'attente sur NAS). Null si aucune piste texte convertible.
   */
  subtitleVttPath: string | null;
  subtitleVttIndex: number | null;
}

/**
 * Chemin du fichier WebVTT temp d'une session — nom dérivé de la clé de
 * session, unique, restreint (base64url) pour un nettoyage sûr.
 */
function vttPathFor(key: string): string {
  return path.join(os.tmpdir(), `movviz-sub-${Buffer.from(key).toString("base64url")}.vtt`);
}

/**
 * Suppression sûre du fichier WebVTT temp : unlink ciblé uniquement, jamais
 * de suppression récursive ; le chemin doit être strictement dans le
 * répertoire temp du système et le nom strictement notre préfixe (garde
 * anti-suppression, cf. AGENTS.md).
 */
function removeVttFile(p: string | null | undefined): void {
  if (!p) return;
  try {
    const dir = path.dirname(p);
    if (dir !== os.tmpdir()) return;
    if (!/^movviz-sub-[A-Za-z0-9_-]+\.vtt$/.test(path.basename(p))) return;
    if (existsSync(p)) unlinkSync(p);
  } catch { /* déjà supprimé ou verrouillé — non bloquant */ }
}

/**
 * Index de la piste de sous-titres texte à pré-extraire avec le remux :
 * la piste sélectionnée par Plex si elle est convertible en texte, sinon la
 * première piste texte. Null si aucune piste texte (pistes image uniquement).
 */
function pickSubtitleIndex(ref: PlexPartRef): number | null {
  if (!ref.subtitleStreams || ref.subtitleStreams.length === 0) return null;
  const selected = ref.subtitleStreams.find((s) => s.selected && s.toTextConvertible);
  if (selected) return selected.index;
  const first = ref.subtitleStreams.find((s) => s.toTextConvertible);
  return first ? first.index : null;
}

/**
 * Retrouve le fichier WebVTT live de la session de remux active pour ce
 * ratingKey/userId dont la piste pré-extraite est `subtitleIndex` — la route
 * subtitle tail-e ce fichier au lieu de lancer une extraction ffmpeg séparée.
 */
export function findRemuxSubtitleVtt(ratingKey: string, userId: string, subtitleIndex: number): string | null {
  const prefix = `${ratingKey}:${userId}:`;
  let best: RemuxSession | null = null;
  for (const s of registry().values()) {
    if (!s.key.startsWith(prefix)) continue;
    if (s.proc.exitCode !== null || s.proc.killed) continue;
    if (s.subtitleVttPath && s.subtitleVttIndex === subtitleIndex && (!best || s.seq > best.seq)) best = s;
  }
  return best?.subtitleVttPath ?? null;
}

type SessionRegistry = Map<string, RemuxSession>;

function registry(): SessionRegistry {
  const g = globalThis as unknown as {
    __movvizFfmpegSessions?: SessionRegistry;
    __movvizFfmpegPurgeTimer?: NodeJS.Timeout;
  };
  if (!g.__movvizFfmpegSessions) {
    g.__movvizFfmpegSessions = new Map();
  }
  if (!g.__movvizFfmpegPurgeTimer) {
    const iv = setInterval(() => purgeStaleSessions(), 60_000);
    if (typeof iv.unref === "function") iv.unref();
    g.__movvizFfmpegPurgeTimer = iv;
  }
  return g.__movvizFfmpegSessions;
}

/**
 * Flux dont le CLIENT a abandonné la connexion (req.signal abort) — le
 * consumer du ReadableStream Web est parti, son controller est fermé.
 * Marquer le flux ici interdit au handler `exit` de faire un
 * `stdout.destroy(err)` : la course fatale est que ffmpeg meurt (Broken
 * pipe/Connection reset) pendant la propagation asynchrone du cancel HTTP,
 * que le guard `!proc.stdout.destroyed` voie le flux encore vivant, et que
 * notre destroy émette une erreur sur un stdout dont le controller Web est
 * déjà fermé → `uncaughtException: Invalid state: Controller is already
 * closed` qui tue le process serveur (v1.13.62 + v1.13.75 : confirmé en
 * prod à chaque abandon client sur un transcode vidéo).
 */
function abortedStreams(): WeakSet<ReadableStream<Uint8Array>> {
  const g = globalThis as unknown as { __movvizFfmpegAbortedStreams?: WeakSet<ReadableStream<Uint8Array>> };
  if (!g.__movvizFfmpegAbortedStreams) g.__movvizFfmpegAbortedStreams = new WeakSet();
  return g.__movvizFfmpegAbortedStreams;
}

/** À appeler quand le client abandonne (abort de la requête HTTP) — le flux ne doit plus jamais être détruit avec erreur. */
export function markStreamAborted(key: string): void {
  const session = registry().get(key);
  if (session) abortedStreams().add(session.stream);
}


let cachedFfmpeg: boolean | null = null;

/** Disponibilité du binaire ffmpeg — mémoïsée pour la vie du process serveur. */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (cachedFfmpeg !== null) return cachedFfmpeg;
  const bin = resolveFfmpegBinary();
  cachedFfmpeg = await new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    let p: ChildProcess;
    try {
      p = spawn(bin, ["-version"], { stdio: "ignore" });
    } catch {
      settle(false);
      return;
    }
    const t = setTimeout(() => {
      try { p.kill(); } catch { /* déjà mort */ }
      settle(false);
    }, 3000);
    p.on("error", () => { clearTimeout(t); settle(false); });
    p.on("exit", (code) => { clearTimeout(t); settle(code === 0); });
  });
  if (!cachedFfmpeg) console.error(`[remux] ffmpeg indisponible (bin="${bin}")`);
  return cachedFfmpeg;
}

function sessionKey(ratingKey: string, userId: string, audioIndex: number, seekSec: number, quality: FfmpegQuality): string {
  return `${ratingKey}:${userId}:${audioIndex}:${seekSec}:${quality}`;
}

/** Trouve le header Plex token de façon insensible à la casse (plexClientHeaders → "x-plex-token"). */
function findPlexToken(headers: Record<string, string>): string | null {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "x-plex-token") return v;
  }
  return null;
}

export function activeSessionCount(): number {
  return registry().size;
}

/**
 * Démarre (ou réutilise) une session de remux ffmpeg.
 *
 * - Session avec la MÊME clé déjà active (process vivant) → lève
 *   `DuplicateSessionError` (voir doc de la classe).
 * - `activeSessionCount() >= MAX_CONCURRENT` → retourne `null` (la route
 *   répond 429).
 */
export function startRemux(
  ratingKey: string,
  userId: string,
  ref: PlexPartRef,
  opts: StartRemuxOptions
): { proc: ChildProcess; stream: ReadableStream<Uint8Array>; key: string } | null {
  const audioIndex = opts.audioIndex ?? 0;
  const seekSec = opts.seekToSec && opts.seekToSec > 0 ? Math.floor(opts.seekToSec) : 0;
  const bitrateK = opts.audioBitrateK ?? AUDIO_BITRATE_K;
  const quality = opts.quality && isFfmpegQuality(opts.quality) ? opts.quality : "original";
  const key = sessionKey(ratingKey, userId, audioIndex, seekSec, quality);

  const reg = registry();
  const existing = reg.get(key);
  if (existing && existing.proc.exitCode === null && !existing.proc.killed) {
    throw new DuplicateSessionError(key);
  }
  if (existing) {
    // Process déjà terminé mais pas encore purgé — nettoyage avant relance.
    reg.delete(key);
  }

  // Shared ceiling with the local engine, not this module's own — see
  // sharedTranscodeLimit.ts's own comment for why.
  if (totalActiveTranscodeSessions() >= MAX_CONCURRENT_TRANSCODES) {
    console.error(`[remux] refus démarrage ${key} — MAX_CONCURRENT_TRANSCODES=${MAX_CONCURRENT_TRANSCODES} atteint (partagé avec le moteur local)`);
    return null;
  }

  const token = findPlexToken(ref.headers);
  if (!token) {
    console.error(`[remux] token Plex introuvable dans ref.headers pour ${key}`);
    return null;
  }

  const matched = ref.audioStreams.find((s) => s.index === audioIndex);
  const audioCodec = (matched?.codec ?? "").toLowerCase();
  const copyAudioSafe =
    !audioCodec.includes("eac3") &&
    audioCodec !== "ec-3" &&
    COPY_SAFE_AUDIO.some((c) => audioCodec.includes(c));

  const args: string[] = ["-v", "error", "-headers", `X-Plex-Token: ${token}\r\n`];
  if (seekSec > 0) args.push("-ss", String(seekSec));
  args.push("-i", ref.sourceUrl);
  args.push("-map", "0:v:0", "-map", `0:a:${audioIndex}`);
  const preset = FFMPEG_QUALITY_PRESETS[quality];
  if (preset.maxWidth && preset.maxrateK) {
    // Transcode local pensé NAS : downscale (jamais d'upscale — la source
    // est plafonnée par min(W,iw)) + libx264 ULTRAFAST (pas veryfast :
    // l'encodage logiciel est le goulot d'étranglement d'un NAS ARM/SoC —
    // ultrafast encodé ~2× plus vite, débit borné par maxrate de toute
    // façon) + zerolatency (frames livrées dès encodées, pas de lookahead :
    // le premier buffer arrive plus vite et les rebuffers repartent plus
    // tôt) + GOP court de 2s (g 48 à 24fps) : seek et changement de qualité
    // re-synchronisent en moins de 2s au lieu d'attendre un keyframe au
    // hasard (souvent 10s+) — c'est ce qui donnait « ça rame » en vidéo.
    // profile main : décodage hardware client garanti partout.
    args.push(
      "-vf",
      `scale=min(${preset.maxWidth}\\,iw):-2`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-profile:v",
      "main",
      "-g",
      "48",
      "-keyint_min",
      "48",
      "-sc_threshold",
      "0",
      "-crf",
      "23",
      "-maxrate",
      `${preset.maxrateK}k`,
      "-bufsize",
      `${preset.bufsizeK}k`,
      "-pix_fmt",
      "yuv420p"
    );
  } else {
    args.push("-c:v", "copy");
  }
  if (copyAudioSafe) {
    args.push("-c:a", "copy");
  } else {
    args.push("-c:a", "aac", "-b:a", `${bitrateK}k`);
  }
  // delay_moov est OBLIGATOIRE avec empty_moov + copie audio : le muxer MP4
  // ne peut pas écrire le moov avant d'avoir vu au moins un paquet AC3 (taille
  // de frame inconnue à l'avance) — confirmé en direct (Ace Ventura 500751) :
  // sans ce flag, ffmpeg écrit le ftyp+moov (quelques Ko) puis échoue
  // immédiatement sur "Cannot write moov atom before AC3 packets", ce qui
  // ressemble à un flux qui se termine proprement côté client (aucune
  // erreur HTTP, juste un stream anormalement court) — piège silencieux.
  args.push(
    "-movflags",
    "frag_keyframe+empty_moov+delay_moov+default_base_moof+omit_tfhd_offset",
    "-f",
    "mp4",
    "pipe:1"
  );

  // Sortie secondaire : la piste de sous-titres texte pré-extraite en WebVTT.
  // Le process démultiplexe déjà le fichier pour le MP4 — les paquets de la
  // piste s passent en copie (coût ~nul) et sont écrits dans un fichier temp
  // AU RYTHME DE LA LECTURE du film. La route subtitle tail-e ce fichier :
  // les cues arrivent quasi en temps réel, sans extraction séparée (qui
  // relisait tout le fichier depuis le début, ~1 min d'attente sur NAS).
  const subIdx = pickSubtitleIndex(ref);
  let vttPath: string | null = null;
  if (subIdx !== null) {
    vttPath = vttPathFor(key);
    args.push("-map", `0:s:${subIdx}`, "-c:s", "webvtt", "-f", "webvtt", vttPath);
    console.log(`[remux] ${key} sortie WebVTT piste=0:s:${subIdx} fichier=${vttPath}`);
  } else {
    console.log(`[remux] ${key} pas de piste sous-titres texte — pas de sortie WebVTT`);
  }

  const bin = resolveFfmpegBinary();
  console.log(
    `[remux] start ${key} — ${preset.maxWidth ? `x264 ${preset.maxWidth}px @ ${preset.maxrateK}k` : "video copy"} a=${audioCodec || "?"} (${copyAudioSafe ? "copy" : `aac ${bitrateK}k`}) seek=${seekSec}s`
  );

  // Jamais shell:true (défaut de spawn) — tous les arguments sont des
  // éléments de tableau séparés, aucune interpolation de chaîne shell.
  const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

  proc.stderr?.on("data", (d) => {
    console.error(`[remux] ${key} stderr: ${String(d).trim()}`);
  });
  proc.on("error", (err) => {
    console.error(`[remux] ${key} spawn error: ${err.message}`);
  });
  proc.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[remux] ${key} exit anormal code=${code} signal=${signal}`);
    } else {
      console.log(`[remux] ${key} exit code=${code} signal=${signal}`);
    }
    removeVttFile(vttPath);
    reg.delete(key);
  });

  if (!proc.stdout) {
    console.error(`[remux] ${key} pas de stdout — abandon`);
    try { proc.kill(); } catch { /* déjà mort */ }
    return null;
  }

  const stream = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;

  // Sur exit anormal AVANT la fin naturelle du flux (EOF), on force une
  // erreur sur le stdout Node sous-jacent plutôt que de laisser un EOF
  // silencieux passer pour une fin de flux valide — Readable.toWeb()
  // propage une erreur du flux Node source comme un reject/erreur du
  // ReadableStream Web correspondant (comportement documenté Node ≥ 17),
  // ce qui évite que la réponse HTTP reste juste tronquée sans signal.
  //
  // Trois gardes (chacun nécessaire, confirmés en prod) :
  // 1. `!proc.stdout.destroyed` — ne jamais redestroy un flux déjà mort
  //    (le cancel du client détruit le stdout via l'adaptateur toWeb).
  // 2. `!abortedStreams().has(stream)` — si le client a abandonné
  //    (req.signal abort vu par la route → markStreamAborted), le
  //    controller Web est fermé : TOUTE erreur émise après est un
  //    uncaughtException « Controller is already closed » qui tue le
  //    process. La course est réelle : le cancel HTTP se propage de façon
  //    asynchrone, ffmpeg meurt (Broken pipe) pendant ce délai, et le
  //    check `destroyed` voit un stdout encore vivant.
  // 3. `setImmediate` + re-check — laisse la propagation du cancel/abort
  //    se terminer avant de décider, réduit la fenêtre de course restante
  //    à zéro dans la pratique (le flag aborted est posé de façon
  //    synchrone par la route au moment même où le client part).
  proc.on("exit", (code) => {
    if (code !== 0 && code !== null && proc.stdout && !proc.stdout.readableEnded && !proc.stdout.destroyed && !abortedStreams().has(stream)) {
      setImmediate(() => {
        if (proc.stdout && !proc.stdout.readableEnded && !proc.stdout.destroyed && !abortedStreams().has(stream)) {
          proc.stdout.destroy(new Error(`ffmpeg exited with code ${code}`));
        }
      });
    }
  });

  reg.set(key, { key, proc, stream, lastAccess: Date.now(), seq: (existing?.seq ?? 0) + 1, subtitleVttPath: vttPath, subtitleVttIndex: subIdx });

  return { proc, stream, key };
}

export function stopRemux(key: string): void {
  const reg = registry();
  const session = reg.get(key);
  if (!session) return;
  reg.delete(key);
  const { proc } = session;
  if (proc.exitCode !== null || proc.killed) return;
  console.log(`[remux] stop ${key} — SIGTERM`);
  try { proc.kill("SIGTERM"); } catch { /* déjà mort */ }
  setTimeout(() => {
    if (proc.exitCode === null && !proc.killed) {
      console.log(`[remux] ${key} toujours vivant après 3s — SIGKILL`);
      try { proc.kill("SIGKILL"); } catch { /* déjà mort */ }
    }
  }, 3000);
}

/** Arrête toutes les sessions actives pour ce couple ratingKey/userId, quels que soient audioIndex/seekSec. */
export function stopAllForRatingKey(ratingKey: string, userId: string): void {
  const prefix = `${ratingKey}:${userId}:`;
  for (const key of Array.from(registry().keys())) {
    if (key.startsWith(prefix)) stopRemux(key);
  }
}

export function touchSession(key: string): void {
  const session = registry().get(key);
  if (session) session.lastAccess = Date.now();
}

export function purgeStaleSessions(): void {
  const now = Date.now();
  const reg = registry();
  for (const [key, session] of reg) {
    if (now - session.lastAccess > SESSION_TTL_MS) {
      console.log(`[remux] purge session inactive ${key}`);
      stopRemux(key);
    }
  }
}

/** See localExecutor.ts's stopAllLocalSessions() — same real gap (no
 *  process-exit cleanup for either engine), same fix, wired into
 *  instrumentation.ts's process signal handlers. */
export function stopAllRemuxSessions(): void {
  for (const key of Array.from(registry().keys())) stopRemux(key);
}
