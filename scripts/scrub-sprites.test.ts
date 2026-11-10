import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-sprites-"));
process.env.MOVVIZ_CONFIG_DIR = dir;
// Bibliothèque de test : un film dont le chemin enregistré est celui que Plex voit (illisible ici),
// un autre dans le dossier de la bibliothèque. Écrits AVANT l'import : les modules lisent ces fichiers au chargement.
const library = path.join(dir, "library");
fs.mkdirSync(library, { recursive: true });
fs.writeFileSync(path.join(dir, "engine-state.json"), JSON.stringify({ instances: { movies: { completedPath: library }, series: { completedPath: library } } }));
const movieOf = (id: string, plexRatingKey: string | null, file: string) => ({
  id, tmdbId: 1, title: id, monitored: true, status: "available", plexRatingKey,
  file: { path: file, quality: "", resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null, size: 1, addedAt: 1 },
});
fs.writeFileSync(path.join(dir, "library-movies.json"), JSON.stringify([
  movieOf("mv_plexpath", "111", "/volume1/plex/Films/Introuvable.mkv"),
  movieOf("mv_local", null, path.join(library, "local.mkv")),
]));
// Importé après la variable d'environnement : le dossier de cache est lu au chargement.
const sprites = await import("../src/lib/playback/scrubSprites.ts");

const ffmpegOk = spawnSync("ffmpeg", ["-version"]).status === 0;
const video = path.join(dir, "film.mkv");
if (ffmpegOk) {
  // 45 s, une image clé toutes les 2 s : 5 vignettes à 10 s d'intervalle.
  spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=45",
    "-c:v", "libx264", "-preset", "ultrafast", "-g", "48", "-pix_fmt", "yuv420p", video]);
}
const source = { cacheId: "film-test", filePath: video };

test("génère des planches valides et un manifeste à jour", { skip: !ffmpegOk }, async () => {
  assert.equal(await sprites.readManifest(source), null);
  assert.equal(await sprites.ensureSprites(source), true);
  const manifest = await sprites.readManifest(source);
  assert.ok(manifest);
  assert.equal(manifest.intervalSec, 10);
  assert.equal(manifest.count, 5); // 45 s → 0,10,20,30,40
  assert.equal(manifest.sheets, 1);
  const sheet = sprites.sheetPath("film-test", 1)!;
  const head = fs.readFileSync(sheet).subarray(0, 3);
  assert.deepEqual([...head], [0xff, 0xd8, 0xff]); // JPEG
  assert.ok(fs.statSync(sheet).size > 5_000);
});

test("un second appel ne régénère rien", { skip: !ffmpegOk }, async () => {
  const before = fs.statSync(sprites.sheetPath("film-test", 1)!).mtimeMs;
  assert.equal(await sprites.ensureSprites(source), true);
  assert.equal(fs.statSync(sprites.sheetPath("film-test", 1)!).mtimeMs, before);
});

test("un fichier remplacé invalide les planches", { skip: !ffmpegOk }, async () => {
  fs.appendFileSync(video, Buffer.alloc(16));
  assert.equal(await sprites.readManifest(source), null);
});

test("un fichier illisible ne publie aucune planche", { skip: !ffmpegOk }, async () => {
  const bad = { cacheId: "film-bad", filePath: path.join(dir, "bad.mkv") };
  fs.writeFileSync(bad.filePath, "pas une vidéo");
  assert.equal(await sprites.ensureSprites(bad), false);
  assert.equal(await sprites.readManifest(bad), null);
  assert.equal(fs.existsSync(path.join(dir, "scrub-sprites", "film-bad")), false);
});

test("l'annulation arrête la génération sans rien publier", { skip: !ffmpegOk }, async () => {
  const cancelled = { cacheId: "film-cancel", filePath: video };
  assert.equal(await sprites.ensureSprites(cancelled, { shouldCancel: () => true }), false);
  assert.equal(fs.existsSync(path.join(dir, "scrub-sprites", "film-cancel")), false);
});

test("un échec est mémorisé avec sa raison : pas de relance à chaque survol", { skip: !ffmpegOk }, async () => {
  const bad = { cacheId: "film-bad", filePath: path.join(dir, "bad.mkv") };
  assert.equal(sprites.hasRecentlyFailed("film-bad"), true); // échec du test précédent
  assert.match(sprites.failureReason("film-bad") ?? "", /durée illisible/);
  assert.equal(sprites.hasRecentlyFailed("film-test"), false);
  sprites.resetFailureMemory();
  assert.equal(sprites.hasRecentlyFailed(bad.cacheId), false);
});

test("des demandes simultanées pour un même fichier partagent une seule génération", { skip: !ffmpegOk }, async () => {
  const twin = { cacheId: "film-twin", filePath: video };
  fs.writeFileSync(video, fs.readFileSync(video).subarray(0, fs.statSync(video).size - 16)); // retire le suffixe ajouté plus haut
  const first = sprites.ensureSprites(twin);
  const second = sprites.ensureSprites(twin);
  assert.equal(sprites.isGenerating("film-twin"), true);
  assert.equal(first, second);
  assert.equal(await first, true);
  assert.equal(sprites.isGenerating("film-twin"), false);
});

test("une rafale de fichiers illisibles se termine sans rester bloquée dans la file", { skip: !ffmpegOk }, async () => {
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => {
    const file = path.join(dir, `junk${i}.mkv`);
    fs.writeFileSync(file, "x");
    return sprites.ensureSprites({ cacheId: `junk-${i}`, filePath: file });
  }));
  assert.ok(results.every((r) => r === false));
});

test("un chemin enregistré tel que Plex le voit (illisible ici) n'est pas pris pour un fichier", () => {
  assert.equal(sprites.resolveLocalSource("mv_plexpath"), null);
  assert.equal(sprites.resolveLocalSource("111"), null);
  assert.equal(sprites.resolveLocalSource("mv_inconnu"), null);
});

test("un fichier dans le dossier de la bibliothèque est résolu, par id Movviz", { skip: !ffmpegOk }, () => {
  fs.copyFileSync(video, path.join(library, "local.mkv"));
  const source = sprites.resolveLocalSource("mv_local");
  assert.ok(source);
  assert.equal(source.cacheId, "mv_local");
  assert.equal(path.resolve(source.filePath), path.resolve(path.join(library, "local.mkv")));
  // Sans lien Plex : à préparer en tâche de fond ; le film lié à Plex n'y figure pas.
  const unlinked = sprites.listUnlinkedLocalSources().map((x) => x.cacheId);
  assert.deepEqual(unlinked, ["mv_local"]);
});

test("un transcodage vidéo bloque la génération ; une lecture en copie de la vidéo ne la bloque pas", { skip: !ffmpegOk }, async () => {
  const engine = await import("../src/lib/playback/engine/sessionManager.ts");
  const playback = globalThis as typeof globalThis & { __movvizPlaybackSessions?: Map<string, { lastHeartbeatAt: number; lastIsPlaying: boolean }> };
  const startPlayback = (id: string) => { playback.__movvizPlaybackSessions = new Map([[id, { lastHeartbeatAt: Date.now(), lastIsPlaying: true }]]); };
  const session = (videoAction: "COPY" | "TRANSCODE") => engine.createSession({
    userId: "u", deviceId: "d", clientType: "desktop-web", mediaId: "m", mode: videoAction === "COPY" ? "DIRECT_STREAM" : "TRANSCODE",
    videoAction, audioAction: "TRANSCODE", subtitleAction: "NONE", plan: {} as never,
  });
  try {
    // Lecture en copie de la vidéo : l'aperçu se prépare (c'est ce qui donne l'aperçu du film regardé).
    startPlayback("copy");
    const copy = session("COPY");
    assert.equal(sprites.shouldYieldToPlayback(), false);
    assert.equal(await sprites.ensureSprites({ cacheId: "film-copy", filePath: video }), true);
    engine.endSession(copy.sessionId);

    // Transcodage vidéo en cours : refus immédiat, sans dossier ni échec mémorisé.
    const heavy = session("TRANSCODE");
    assert.equal(sprites.shouldYieldToPlayback(), true);
    assert.equal(await sprites.ensureSprites({ cacheId: "film-heavy", filePath: video }), false);
    assert.equal(sprites.hasRecentlyFailed("film-heavy"), false);
    assert.equal(fs.existsSync(path.join(dir, "scrub-sprites", "film-heavy")), false);
    engine.endSession(heavy.sessionId);

    // Transcodage démarré EN COURS de génération : arrêt rapide, aucun échec, aucune planche publiée.
    startPlayback("late");
    const running = sprites.ensureSprites({ cacheId: "film-midway", filePath: video });
    let heavy2: { sessionId: string } | null = null;
    setTimeout(() => { heavy2 = session("TRANSCODE"); }, 150);
    const started = Date.now();
    assert.equal(await running, false);
    assert.ok(Date.now() - started < 3_000, "doit s'interrompre sans attendre la fin");
    assert.equal(sprites.hasRecentlyFailed("film-midway"), false);
    assert.equal(fs.existsSync(path.join(dir, "scrub-sprites", "film-midway")), false);
    if (heavy2) engine.endSession((heavy2 as { sessionId: string }).sessionId);
  } finally {
    playback.__movvizPlaybackSessions = undefined;
  }
});

test("nettoyage", () => { fs.rmSync(dir, { recursive: true, force: true }); });
