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
import { Readable } from "node:stream";
import type { PlexPartRef } from "@/lib/playback/plexSource";

export const MAX_CONCURRENT = 3;
export const SESSION_TTL_MS = 5 * 60_000;
export const AUDIO_BITRATE_K = 192;

// Miroir de COPY_SAFE_AUDIO (transcode/route.ts lignes 263-269) — ne pas
// réinventer une whitelist différente.
const COPY_SAFE_AUDIO = ["aac", "mp4a", "ac3", "ac-3", "mp3"];

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
}

interface RemuxSession {
  key: string;
  proc: ChildProcess;
  lastAccess: number;
  seq: number;
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

function ffmpegBin(): string {
  return process.env.MOVVIZ_FFMPEG_PATH?.trim() || "ffmpeg";
}

let cachedFfmpeg: boolean | null = null;

/** Disponibilité du binaire ffmpeg — mémoïsée pour la vie du process serveur. */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (cachedFfmpeg !== null) return cachedFfmpeg;
  const bin = ffmpegBin();
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

function sessionKey(ratingKey: string, userId: string, audioIndex: number, seekSec: number): string {
  return `${ratingKey}:${userId}:${audioIndex}:${seekSec}`;
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
  const key = sessionKey(ratingKey, userId, audioIndex, seekSec);

  const reg = registry();
  const existing = reg.get(key);
  if (existing && existing.proc.exitCode === null && !existing.proc.killed) {
    throw new DuplicateSessionError(key);
  }
  if (existing) {
    // Process déjà terminé mais pas encore purgé — nettoyage avant relance.
    reg.delete(key);
  }

  if (reg.size >= MAX_CONCURRENT) {
    console.error(`[remux] refus démarrage ${key} — MAX_CONCURRENT=${MAX_CONCURRENT} atteint`);
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
  args.push("-c:v", "copy");
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

  const bin = ffmpegBin();
  console.log(`[remux] start ${key} — a=${audioCodec || "?"} (${copyAudioSafe ? "copy" : `aac ${bitrateK}k`}) seek=${seekSec}s`);

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
  // Le garde `!proc.stdout.destroyed` est CRITIQUE, pas cosmétique — v1.13.62
  // ajoutait un listener 'error' no-op en pensant éviter le crash, mais
  // `Readable.toWeb()` enregistre TOUJOURS son propre listener interne (qui
  // relaie vers le controller du ReadableStream Web) ; notre listener
  // supplémentaire ne l'empêche pas de s'exécuter. Confirmé en prod (Ace
  // Ventura 500751, plusieurs occurrences le 13/08) : le vrai crash arrive
  // quand le CLIENT abandonne en premier — ça détruit déjà `proc.stdout` du
  // côté web (cancel() implicite), PUIS ce handler `exit` rappelait
  // `destroy(err)` une seconde fois sur un flux déjà détruit, et
  // l'adaptateur interne de Node tente `controller.error()` sur un
  // controller déjà fermé → `uncaughtException: Controller is already
  // closed`, qui a fait planter tout le process serveur (503 généralisé,
  // pas seulement cette requête). Ne plus jamais redestroy un flux déjà mort.
  proc.on("exit", (code) => {
    if (code !== 0 && code !== null && proc.stdout && !proc.stdout.readableEnded && !proc.stdout.destroyed) {
      proc.stdout.destroy(new Error(`ffmpeg exited with code ${code}`));
    }
  });

  reg.set(key, { key, proc, lastAccess: Date.now(), seq: (existing?.seq ?? 0) + 1 });

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
