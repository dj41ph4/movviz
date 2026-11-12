import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const exists = (p: string) => fsp.lstat(p).then(() => true, () => false);

test("moteur : nom final libre → direct ; nom occupé → dossier d'attente, jamais « (2) » à côté de l'ancien", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-incoming-engine-"));
  const config = path.join(sandbox, "config"), root = path.join(sandbox, "library"), download = path.join(sandbox, "downloads");
  await Promise.all([config, root, download].map((p) => fsp.mkdir(p, { recursive: true })));
  const previousConfig = process.env.MOVVIZ_CONFIG_DIR, previousFetch = globalThis.fetch;
  process.env.MOVVIZ_CONFIG_DIR = config;
  globalThis.fetch = async () => Response.json({});
  try {
    const { AbstractBackend, placeOrStage, INCOMING_DIR_NAME } = await import("../engine/src/backends/AbstractBackend.mjs");
    const { movePath } = await import("../engine/src/store.mjs");
    const backend = new AbstractBackend({ id: "t", category: "movies", completedPath: root, downloadPath: download, seedRatio: 0 });

    const canonical = path.join(root, "Film (2020)", "Film (2020).mkv");
    await fsp.mkdir(path.dirname(canonical), { recursive: true });
    assert.deepEqual(await placeOrStage(canonical, { completedPath: root, infoHash: "aaa", stage: true }), { dest: canonical });

    await fsp.writeFile(canonical, "ancien");
    const staged = await placeOrStage(canonical, { completedPath: root, infoHash: "aaa", stage: true });
    assert.equal(staged.stagedFor, canonical);
    assert.equal(staged.dest, path.join(root, INCOMING_DIR_NAME, "aaa", "Film (2020)", "Film (2020).mkv"));
    // Placement explicite (Bleach) : l'ancien comportement « (2) » est conservé.
    assert.equal((await placeOrStage(canonical, { completedPath: root, infoHash: "aaa", stage: false })).dest, path.join(root, "Film (2020)", "Film (2020) (2).mkv"));

    // Import complet d'un film dont le nom final existe déjà.
    await fsp.rm(canonical);
    const name = "Film.2020.1080p.WEB.mkv";
    const run = async (hash: string, content: string) => {
      await fsp.writeFile(path.join(download, name), content);
      backend.meta.set(hash, { title: "Film", year: 2020, libraryRef: "movie:mv_x", addedAt: 1 });
      await backend._import({ infoHash: hash, name, files: [{ name, path: name, length: 999, selected: true }] }, movePath);
      return backend.meta.get(hash).movedFiles[0];
    };
    const first = await run("bbb", "premier");
    assert.equal(first.stagedFor, undefined, "nom libre : installé directement");
    const folder = path.dirname(first.path);
    const second = await run("ccc", "nouveau contenu");
    assert.ok(second.stagedFor, "nom occupé : arrivée mise en attente");
    assert.equal(second.stagedFor, first.path);
    assert.ok(second.path.includes(INCOMING_DIR_NAME) && second.path.includes(`${path.sep}ccc${path.sep}`));
    assert.equal(second.size, Buffer.byteLength("nouveau contenu"), "taille réelle du disque, pas la longueur annoncée");
    assert.deepEqual(await fsp.readdir(folder), [path.basename(first.path)], "aucun « (2) » dans le dossier du film");
    assert.equal(await fsp.readFile(first.path, "utf8"), "premier");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousConfig === undefined) delete process.env.MOVVIZ_CONFIG_DIR; else process.env.MOVVIZ_CONFIG_DIR = previousConfig;
    await fsp.rm(sandbox, { recursive: true, force: true });
  }
});

test("moteur : la purge ne retire que les fichiers d'attente perdus, jamais les récents ni les attendus", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-incoming-sweep-"));
  const root = path.join(sandbox, "library");
  const previousConfig = process.env.MOVVIZ_CONFIG_DIR;
  process.env.MOVVIZ_CONFIG_DIR = path.join(sandbox, "config");
  try {
    const { AbstractBackend, INCOMING_DIR_NAME } = await import("../engine/src/backends/AbstractBackend.mjs");
    const backend = new AbstractBackend({ id: "t", category: "series", completedPath: root, downloadPath: path.join(sandbox, "dl"), seedRatio: 0 });
    const put = async (...parts: string[]) => { const p = path.join(root, ...parts); await fsp.mkdir(path.dirname(p), { recursive: true }); await fsp.writeFile(p, "x".repeat(10)); return p; };
    const library = await put("Serie", "Saison 1", "Serie - S01E01.mkv");
    const orphan = await put(INCOMING_DIR_NAME, "orphan", "Serie", "Saison 1", "Serie - S01E01.mkv");
    const pending = await put(INCOMING_DIR_NAME, "pending", "Serie", "Saison 1", "Serie - S01E02.mkv");
    const done = await put(INCOMING_DIR_NAME, "done", "Serie", "Saison 1", "Serie - S01E03.mkv");
    backend.meta.set("pending", { libraryRef: "episode:sr:1:2", notifiedLibrary: false, movedFiles: [{ path: pending, stagedFor: library }] });
    backend.meta.set("done", { libraryRef: "episode:sr:1:3", notifiedLibrary: true, movedFiles: [{ path: done, stagedFor: library }] });

    // Récents : rien n'est touché.
    assert.deepEqual(await backend.sweepIncoming(), { removed: 0, kept: 3, freedBytes: 0 });
    // 2 jours plus tard : orphelin et import terminé partent, l'import encore attendu reste.
    const later = Date.now() + 2 * 24 * 3600_000;
    const r = await backend.sweepIncoming({ now: later });
    assert.equal(r.removed, 2);
    assert.equal(r.freedBytes, 20);
    assert.ok(await exists(pending) && await exists(library));
    assert.ok(!(await exists(orphan)) && !(await exists(done)));
    assert.ok(!(await exists(path.join(root, INCOMING_DIR_NAME, "orphan"))), "dossier vide retiré");
    // 31 jours : même l'import attendu est purgé, la bibliothèque jamais.
    const muchLater = Date.now() + 31 * 24 * 3600_000;
    assert.equal((await backend.sweepIncoming({ now: muchLater })).removed, 1);
    assert.ok(!(await exists(pending)) && await exists(library));
  } finally {
    if (previousConfig === undefined) delete process.env.MOVVIZ_CONFIG_DIR; else process.env.MOVVIZ_CONFIG_DIR = previousConfig;
    await fsp.rm(sandbox, { recursive: true, force: true });
  }
});

test("bibliothèque : un fichier d'attente remplace l'ancien épisode et reprend son nom, ou s'installe si rien n'existe", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-incoming-library-"));
  const config = path.join(sandbox, "config"), root = path.join(sandbox, "library");
  const folder = path.join(root, "Ma série", "Saison 1");
  await fsp.mkdir(config, { recursive: true });
  await fsp.mkdir(folder, { recursive: true });
  const previousConfig = process.env.MOVVIZ_CONFIG_DIR, previousFetch = globalThis.fetch;
  process.env.MOVVIZ_CONFIG_DIR = config;
  globalThis.fetch = async () => Response.json({ instances: [{ completedPath: root }] });
  try {
    const [{ addSeries, getSeries }, { applyImportedFiles }, { flushPendingJsonWritesSync }, { INCOMING_DIR_NAME }] = await Promise.all([
      import("@/lib/library/store"),
      import("@/lib/library/applyImportedFiles"),
      import("@/lib/fsJsonCache"),
      import("@/lib/library/incomingDir"),
    ]);
    const e1 = path.join(folder, "Ma série - S01E01.mkv");
    const e2 = path.join(folder, "Ma série - S01E02.mkv");
    await fsp.writeFile(e1, "ancien 1");
    const stage = async (hash: string, name: string, content: string) => {
      const p = path.join(root, INCOMING_DIR_NAME, hash, "Ma série", "Saison 1", name);
      await fsp.mkdir(path.dirname(p), { recursive: true });
      await fsp.writeFile(p, content);
      return p;
    };
    const file = (p: string, stagedFor: string, episode: number, content: string) => ({ path: p, stagedFor, quality: "WEB", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: null, size: Buffer.byteLength(content), season: 1, episode });
    const lib = (n: number, p: string | null, size: number) => ({
      seasonNumber: 1, episodeNumber: n, title: `E${n}`, airDate: null, monitored: true, status: p ? "available" : "downloading", activeInfoHash: null, plexRatingKey: null,
      file: p ? { path: p, quality: "1080p", resolution: "1080p", videoCodec: null, audioCodec: null, hdr: null, source: null, size, addedAt: 1 } : null,
    });
    addSeries({
      id: "sr_stage", tmdbId: 987654321, imdbId: null, title: "Ma série", year: 2026, releaseDate: null, overview: "", posterPath: null, backdropPath: null, rating: 0,
      genres: [], tvStatus: "Returning Series", monitored: true, qualityProfileId: "default",
      seasons: [{ seasonNumber: 1, name: "S1", monitored: true, episodes: [lib(1, e1, 8), lib(2, null, 0)] }], addedAt: 1,
    } as unknown as Parameters<typeof addSeries>[0]);

    // Remplacement : l'ancien disparaît, le nouveau prend son nom, l'attente est vidée.
    const s1 = await stage("h1", "Ma série - S01E01.mkv", "nouveau 1");
    const r1 = await applyImportedFiles({ kind: "episode", seriesId: "sr_stage", season: 1, episode: 1 }, [file(s1, e1, 1, "nouveau 1")], "h1");
    assert.equal(r1.ok, true);
    assert.equal(await fsp.readFile(e1, "utf8"), "nouveau 1");
    assert.ok(!(await exists(s1)));
    assert.deepEqual(await fsp.readdir(folder), ["Ma série - S01E01.mkv"], "aucun « (2) » dans la saison");
    assert.equal(getSeries("sr_stage")!.seasons[0].episodes[0].file?.path, e1);

    // Rien à remplacer : le fichier d'attente s'installe sous son nom final.
    const s2 = await stage("h2", "Ma série - S01E02.mkv", "nouveau 2");
    const r2 = await applyImportedFiles({ kind: "episode", seriesId: "sr_stage", season: 1, episode: 2 }, [file(s2, e2, 2, "nouveau 2")], "h2");
    assert.equal(r2.ok, true);
    assert.equal(await fsp.readFile(e2, "utf8"), "nouveau 2");
    assert.ok(!(await exists(s2)));
    assert.equal(getSeries("sr_stage")!.seasons[0].episodes[1].file?.path, e2);
    flushPendingJsonWritesSync();
    await new Promise((resolve) => setTimeout(resolve, 300));
  } finally {
    const { flushPendingJsonWritesSync } = await import("@/lib/fsJsonCache");
    flushPendingJsonWritesSync();
    globalThis.fetch = previousFetch;
    if (previousConfig === undefined) delete process.env.MOVVIZ_CONFIG_DIR; else process.env.MOVVIZ_CONFIG_DIR = previousConfig;
    await fsp.rm(sandbox, { recursive: true, force: true });
  }
});

test("bibliothèque : version supplémentaire sortie du dossier d'attente sous un nom libre ; parcours disque ignorent l'attente", async () => {
  const sandbox = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-incoming-extra-"));
  const root = path.join(sandbox, "library");
  const previousConfig = process.env.MOVVIZ_CONFIG_DIR;
  process.env.MOVVIZ_CONFIG_DIR = path.join(sandbox, "config");
  try {
    const { settleStagedAsExtraVersion } = await import("@/lib/library/applyImportedFiles");
    const { INCOMING_DIR_NAME, isInIncomingDir } = await import("@/lib/library/incomingDir");
    const canonical = path.join(root, "Film (2020)", "Film (2020).mkv");
    await fsp.mkdir(path.dirname(canonical), { recursive: true });
    await fsp.writeFile(canonical, "principal");
    const staged = path.join(root, INCOMING_DIR_NAME, "h", "Film (2020)", "Film (2020).mkv");
    await fsp.mkdir(path.dirname(staged), { recursive: true });
    await fsp.writeFile(staged, "supplémentaire");
    const settled = await settleStagedAsExtraVersion(staged, canonical, [root]);
    assert.equal(settled, path.join(root, "Film (2020)", "Film (2020) (2).mkv"));
    assert.equal(await fsp.readFile(canonical, "utf8"), "principal");
    assert.equal(await fsp.readFile(settled, "utf8"), "supplémentaire");
    assert.ok(!(await exists(staged)));
    await assert.rejects(settleStagedAsExtraVersion(staged, path.join(sandbox, "dehors", "x.mkv"), [root]), /hors bibliothèque/);

    assert.equal(isInIncomingDir(staged), true);
    assert.equal(isInIncomingDir(path.join(INCOMING_DIR_NAME, "h", "a.mkv")), true);
    assert.equal(isInIncomingDir(canonical), false);
  } finally {
    if (previousConfig === undefined) delete process.env.MOVVIZ_CONFIG_DIR; else process.env.MOVVIZ_CONFIG_DIR = previousConfig;
    await fsp.rm(sandbox, { recursive: true, force: true });
  }
});
