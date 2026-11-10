#!/usr/bin/env node
/**
 * Audit « coupure de Plex » — banc dynamique.
 *
 * Lance Movviz (next dev) sur une COPIE isolée du dossier de données, avec Plex dans l'un de ces états :
 *   - unconfigured : aucun plex.json (Plex jamais lié)
 *   - refused      : Plex configuré, serveur éteint (connexion refusée immédiatement)
 *   - hung         : Plex configuré, la machine répond au TCP mais ne dit jamais rien (NAS gelé / pare-feu qui jette)
 * puis appelle toutes les routes GET de l'API (et les pages) avec une session administrateur et consigne :
 *   statut HTTP, durée à chaud, présence d'une erreur 5xx, d'un blocage, d'un message d'erreur Plex qui fuit.
 *
 * Usage : node scripts/plex-cut-audit.mjs [unconfigured|refused|hung|all] [--port 9811] [--out <dossier>]
 * Ne touche JAMAIS à .movviz-data : tout se passe dans <out>/data-<scénario>.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const PORT = Number(flag("--port", "9811"));
const OUT = path.resolve(flag("--out", path.join(ROOT, ".tmp-plex-audit")));
const scenarioArg = args[0] && !args[0].startsWith("--") ? args[0] : "all";
const SCENARIOS = scenarioArg === "all" ? ["unconfigured", "refused", "hung"] : [scenarioArg];

const SECRET = "plex-cut-audit-secret";
const SKIP_GET = [
  /^system\/update/, /^system\/reset/, /^auth\/logout/, /^engine\/restart/, /^danger-zone/, /^engine\/\[\.\.\.path\]/,
  /^backup/, /^resolver\/restart/, /^cache\/.*clear/, /^stream\/plex-proxy/, /^playback\/\[ratingKey\]\/\[\.\.\.path\]/,
  /^playback\/session\/\[sessionId\]\/stream/, /^stream\/\[ratingKey\]$/, /^stream\/local\/\[movvizId\]$/,
  /^stream\/local\/episode\/\[seriesId\]\/\[seasonNumber\]\/\[episodeNumber\]$/, /^events$/, /^activity\/ping/,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function listRoutes() {
  const base = path.join(ROOT, "src", "app", "api");
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") {
        const src = fs.readFileSync(p, "utf8");
        const rel = path.relative(base, path.dirname(p)).split(path.sep).join("/");
        out.push({
          rel,
          get: /export\s+(async\s+)?function\s+GET\b|export\s+const\s+GET\b/.test(src),
          post: /export\s+(async\s+)?function\s+POST\b|export\s+const\s+POST\b/.test(src),
        });
      }
    }
  };
  walk(base);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

function listPages() {
  const base = path.join(ROOT, "src", "app");
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "api") continue;
        walk(p);
      } else if (e.name === "page.tsx") {
        out.push("/" + path.relative(base, path.dirname(p)).split(path.sep).join("/"));
      }
    }
  };
  walk(base);
  return out.map((p) => (p === "/." || p === "/" ? "/" : p.replace(/\/\.$/, ""))).sort();
}

function copyData(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const src = path.join(ROOT, ".movviz-data");
  for (const e of fs.readdirSync(src)) {
    if (/\.(tmp|corrupt-backup.*)$/.test(e) || e === "tmdb-cache.ndjson" || e === "torrents") continue;
    fs.cpSync(path.join(src, e), path.join(dest, e), { recursive: true });
  }
}

function seedAdmin(dataDir) {
  // Crée un administrateur local + session signée, via les vraies fonctions du produit.
  const code = `
    import { addUser, createSession } from "@/lib/auth/store";
    const u = addUser({ id: "audit-admin", username: "audit-admin", passwordHash: null, role: "admin", status: "approved",
      autoApproveRequests: true, autoRequestFromWatchlist: false, discoverContinents: [], requestLimitMovies: null,
      requestLimitSeries: null, canManageRequests: true, plexId: null, plexToken: null });
    const s = createSession(u.id);
    console.log("TOKEN=" + s.token);
  `;
  const r = spawnSync(
    process.execPath,
    ["--experimental-transform-types", "--no-warnings", "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", code],
    { cwd: ROOT, env: { ...process.env, MOVVIZ_DATA_DIR: dataDir, MOVVIZ_CONFIG_DIR: dataDir, MOVVIZ_SESSION_SECRET: SECRET }, encoding: "utf8" },
  );
  const m = /TOKEN=(\S+)/.exec(r.stdout ?? "");
  if (!m) throw new Error("Impossible de créer la session admin : " + (r.stderr || r.stdout));
  return m[1];
}

/**
 * Jeu de données de lecture, identique pour tous les scénarios :
 *   mv_audit_both      film avec fichier local ET clé Plex (cas normal d'aujourd'hui)
 *   mv_audit_local     film local seul, jamais vu par Plex
 *   mv_audit_plexonly  film connu seulement de Plex (chemin tel que Plex le voit, pas de fichier local)
 *   sr_audit           série : S01E01 local+Plex, S01E02 local seul, S01E03 Plex seul
 */
function seedLibrary(dataDir) {
  const mediaRoot = path.resolve(dataDir, "..", "data", "media");
  fs.mkdirSync(path.join(mediaRoot, "movies"), { recursive: true });
  fs.mkdirSync(path.join(mediaRoot, "tv"), { recursive: true });
  const fixture = path.join(OUT, "fixture.mp4");
  if (!fs.existsSync(fixture)) {
    const r = spawnSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=duration=4:size=320x180:rate=24", "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", fixture], { encoding: "utf8" });
    if (r.status !== 0) throw new Error("ffmpeg indisponible pour fabriquer la vidéo de test : " + (r.stderr ?? "").slice(-300));
  }
  const files = {
    both: path.join(mediaRoot, "movies", "audit-both.mp4"),
    local: path.join(mediaRoot, "movies", "audit-local.mp4"),
    e1: path.join(mediaRoot, "tv", "audit-s01e01.mp4"),
    e2: path.join(mediaRoot, "tv", "audit-s01e02.mp4"),
  };
  for (const f of Object.values(files)) fs.copyFileSync(fixture, f);
  const size = fs.statSync(fixture).size;
  const code = `
    import { addMovie, addSeries } from "@/lib/library/store";
    const file = (p) => ({ path: p, diskPath: p, quality: "WEB-DL 1080p", resolution: "1080p", videoCodec: "h264", audioCodec: "AAC", hdr: null, source: "WEB-DL", size: ${size}, addedAt: Date.now() });
    const movie = (id, tmdbId, title, f, rk) => ({ id, tmdbId, imdbId: null, title, year: 2020, releaseDate: "2020-01-01", vfReleaseDate: null, overview: "", posterPath: null, backdropPath: null,
      rating: 7, runtime: 1, genres: [], monitored: true, qualityProfileId: "default", status: f ? "available" : "available", file: f, activeInfoHash: null, addedAt: Date.now(),
      plexRatingKey: rk, plexMediaInfo: null });
    addMovie(movie("mv_audit_both", 990001, "Audit Both", file(${JSON.stringify(files.both)}), "1001"));
    addMovie(movie("mv_audit_local", 990002, "Audit Local", file(${JSON.stringify(files.local)}), null));
    addMovie(movie("mv_audit_plexonly", 990003, "Audit PlexOnly", file("/volume1/Films/Audit PlexOnly (2020)/audit.mkv"), "1002"));
    const ep = (n, f, rk) => ({ seasonNumber: 1, episodeNumber: n, title: "Ep " + n, airDate: "2020-01-0" + n, monitored: true, status: "available", file: f, activeInfoHash: null, plexRatingKey: rk });
    addSeries({ id: "sr_audit", tmdbId: 990010, imdbId: null, title: "Audit Series", year: 2020, releaseDate: "2020-01-01", overview: "", posterPath: null, backdropPath: null,
      rating: 7, genres: [], tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: Date.now(), plexRatingKey: "3000",
      seasons: [{ seasonNumber: 1, name: "Saison 1", monitored: true, episodes: [
        ep(1, file(${JSON.stringify(files.e1)}), "2001"), ep(2, file(${JSON.stringify(files.e2)}), null), ep(3, file("/volume1/Series/Audit/S01E03.mkv"), "2003") ] }] });
    console.log("SEEDED");
  `;
  const r = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", code],
    { cwd: ROOT, env: { ...process.env, MOVVIZ_DATA_DIR: dataDir, MOVVIZ_CONFIG_DIR: dataDir, MOVVIZ_SESSION_SECRET: SECRET }, encoding: "utf8" });
  if (!/SEEDED/.test(r.stdout ?? "")) throw new Error("Échec du jeu de données : " + (r.stderr || r.stdout).slice(-800));
}

const PROFILE = {
  clientType: "web", deviceId: "audit-device", videoCapabilities: [{ codec: "h264", maxWidth: 3840, maxHeight: 2160 }],
  audioCapabilities: [{ codec: "aac", maxChannels: 2 }], subtitleCapabilities: [], containers: ["mp4"],
};

/** Parcours de lecture et d'usage courant, rejoués dans chaque scénario. attendu = ce qu'il FAUT pour que la coupure Plex soit sans douleur. */
function targetedCases() {
  const T = [];
  const add = (group, name, method, url, body, expectOk = true) => T.push({ group, name, method, url, body, expectOk });
  for (const [label, id, plex] of [["film local+Plex", "mv_audit_both", "1001"], ["film local seul", "mv_audit_local", null], ["film Plex seul", "mv_audit_plexonly", "1002"]]) {
    const local = id !== "mv_audit_plexonly";
    add("Lecture film", `${label} · infos de flux`, "GET", `/api/stream/local/${id}/info`, null, local);
    add("Lecture film", `${label} · octets (Range)`, "GET", `/api/stream/local/${id}`, { range: "bytes=0-1023" }, local);
    add("Lecture film", `${label} · préparation moteur`, "POST", "/api/playback/prepare", { mediaId: id, ratingKey: plex ?? "", clientProfile: PROFILE }, local);
    add("Lecture film", `${label} · ouverture de session`, "POST", "/api/playback/sessions", { ratingKey: plex ?? id, mediaId: id, mediaType: "movie", durationMs: 4000, tmdbId: 990001 }, true);
    add("Fiche titre", `${label} · fiche film`, "GET", `/api/library/movies/${id}`, null, true);
  }
  for (const [label, n, plex] of [["épisode local+Plex", 1, "2001"], ["épisode local seul", 2, null], ["épisode Plex seul", 3, "2003"]]) {
    const local = n !== 3;
    const mediaId = `sr_audit:s1e${n}`;
    add("Lecture série", `${label} · infos de flux`, "GET", `/api/stream/local/episode/sr_audit/1/${n}/info`, null, local);
    add("Lecture série", `${label} · octets (Range)`, "GET", `/api/stream/local/episode/sr_audit/1/${n}`, { range: "bytes=0-1023" }, local);
    add("Lecture série", `${label} · préparation moteur`, "POST", "/api/playback/prepare", { mediaId, ratingKey: plex ?? "", clientProfile: PROFILE }, local);
    add("Lecture série", `${label} · ouverture de session`, "POST", "/api/playback/sessions", { ratingKey: plex ?? mediaId, mediaId, mediaType: "episode", durationMs: 4000, tmdbId: 990010, seasonNumber: 1, episodeNumber: n }, true);
  }
  add("Lecture via Plex", "flux Plex (clé 1001) — infos", "GET", "/api/stream/1001/info", null, false);
  add("Lecture via Plex", "flux Plex (clé 1001) — transcode", "GET", "/api/stream/1001/transcode", null, false);
  add("Lecture via Plex", "flux Plex (clé 1001) — octets", "GET", "/api/stream/1001", { range: "bytes=0-1023" }, false);
  add("Lecture via Plex", "playback-ffmpeg clé 1001", "GET", "/api/playback-ffmpeg/1001", null, false);
  add("Lecture via Plex", "sous-titres playback-ffmpeg clé 1001", "GET", "/api/playback-ffmpeg/1001/subtitle", null, false);
  add("Lecture via Plex", "item playback clé 1001", "GET", "/api/playback/items/1001", null, false);
  add("Vu / reprise", "film marqué vu", "POST", "/api/watch/toggle", { tmdbId: 990001, type: "movie", watched: true, title: "Audit Both" }, true);
  add("Vu / reprise", "film marqué non vu", "POST", "/api/watch/toggle", { tmdbId: 990001, type: "movie", watched: false, title: "Audit Both" }, true);
  add("Vu / reprise", "série marquée vue", "POST", "/api/watch/toggle", { tmdbId: 990010, type: "series", watched: true, title: "Audit Series", scope: "series" }, true);
  add("Vu / reprise", "reprendre la lecture", "GET", "/api/playback/continue-watching", null, true);
  add("Vu / reprise", "statuts vus", "GET", "/api/watch-status", null, true);
  add("Vu / reprise", "historique", "GET", "/api/history", null, true);
  add("Accueil", "héros du tableau de bord", "GET", "/api/dashboard/hero", null, true);
  add("Accueil", "revoir", "GET", "/api/dashboard/rewatch", null, true);
  add("Accueil", "on-deck Plex", "GET", "/api/plex/on-deck", null, true);
  add("Bibliothèque", "liste films", "GET", "/api/library/movies", null, true);
  add("Bibliothèque", "liste séries", "GET", "/api/library/series", null, true);
  add("Bibliothèque", "série", "GET", "/api/library/series/sr_audit", null, true);
  add("Bibliothèque", "épisode", "GET", "/api/library/series/sr_audit/episode/1/1", null, true);
  add("Bibliothèque", "prochain épisode", "GET", "/api/library/series/sr_audit/next?season=1&episode=1", null, true);
  add("Bibliothèque", "résumé interface", "GET", "/api/interface/summary", null, true);
  add("Bibliothèque", "liste de suivi", "GET", "/api/watchlist", null, true);
  add("Bibliothèque", "demandes", "GET", "/api/requests", null, true);
  add("Réglages Plex", "statut Plex", "GET", "/api/plex/status", null, true);
  add("Réglages Plex", "config Plex", "GET", "/api/plex/config", null, true);
  add("Réglages Plex", "test de connexion Plex", "POST", "/api/plex/test", {}, true);
  add("Réglages Plex", "activité Plex", "GET", "/api/plex/activity", null, true);
  add("Réglages Plex", "correspondances de chemins", "GET", "/api/plex/path-mappings", null, true);
  add("Réglages Plex", "épisodes non reliés", "GET", "/api/plex/unmapped", null, true);
  add("Connexion", "état de session (login)", "GET", "/api/auth/me", null, true);
  add("Connexion", "création PIN Plex (plex.tv)", "POST", "/api/auth/plex/pin", {}, true);
  add("Santé", "santé", "GET", "/api/health", null, true);
  add("Santé", "diagnostic médecin", "GET", "/api/doctor", null, true);
  add("Santé", "tâches planifiées", "GET", "/api/tasks", null, true);
  add("Santé", "perf", "GET", "/api/perf", null, true);
  add("Santé", "sondage média (réglages)", "GET", "/api/library/media-probe/scan", null, true);
  return T;
}

function writePlexConfig(dataDir, scenario, hungPort) {
  const file = path.join(dataDir, "plex.json");
  fs.rmSync(file, { force: true });
  if (scenario === "unconfigured") return;
  const base = {
    useSsl: false, adminToken: "AUDIT-FAKE-TOKEN", clientId: "audit-client", syncLibrary: true,
    watchlistSyncEnabled: true, markerSyncEnabled: true, machineIdentifier: "audit-machine",
  };
  const cfg = scenario === "refused" ? { ...base, hostname: "127.0.0.1", port: 1 } : { ...base, hostname: "127.0.0.1", port: hungPort };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
}

function startHungServer() {
  return new Promise((resolve) => {
    const sockets = new Set();
    const srv = net.createServer((s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); s.on("error", () => {}); });
    srv.listen(0, "127.0.0.1", () => resolve({ port: srv.address().port, close: () => { for (const s of sockets) s.destroy(); srv.close(); } }));
  });
}

async function waitReady(base, child, logs) {
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    if (child.exitCode !== null) throw new Error("next dev s'est arrêté : " + logs.join("").slice(-1500));
    try {
      const r = await fetch(base + "/api/healthz", { signal: AbortSignal.timeout(20_000) });
      if (r.status < 500) return;
    } catch { /* pas encore prêt */ }
    await sleep(1000);
  }
  throw new Error("Timeout démarrage next dev");
}

async function hit(base, method, url, cookie, body, timeoutMs) {
  const t0 = Date.now();
  try {
    const r = await fetch(base + url, {
      method,
      headers: { cookie: `movviz_session=${cookie}`, ...(method === "GET" && body?.range ? { range: body.range } : body ? { "content-type": "application/json" } : {}) },
      body: method !== "GET" && body ? JSON.stringify(body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await r.text().catch(() => "");
    return { status: r.status, ms: Date.now() - t0, body: text.slice(0, 400), size: text.length };
  } catch (e) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    return { status: timedOut ? "TIMEOUT" : "NETERR", ms: Date.now() - t0, body: String(e?.message ?? e).slice(0, 200), size: 0 };
  }
}

function fill(rel, ids) {
  return rel
    .replace("[...path]", "x")
    .replace(/\[ratingKey\]/g, ids.ratingKey)
    .replace(/\[movvizId\]|\[movieId\]/g, ids.movieId)
    .replace(/\[seriesId\]/g, ids.seriesId)
    .replace(/\[seasonNumber\]|\[season\]/g, "1")
    .replace(/\[episodeNumber\]|\[episode\]/g, "1")
    .replace(/\[type\]/g, "movie")
    .replace(/\[sessionId\]/g, "audit-session")
    .replace(/\[id\]/g, ids.seriesId)
    .replace(/\[infoHash\]/g, "0".repeat(40))
    .replace(/\[name\]/g, "tmdb")
    .replace(/\[libraryRef\]/g, "x")
    .replace(/\[versionId\]/g, "x");
}

async function runScenario(scenario, routes, pages) {
  const dataDir = path.join(OUT, `data-${scenario}`);
  console.log(`\n=== Scénario « ${scenario} » ===`);
  copyData(dataDir);
  const hung = scenario === "hung" ? await startHungServer() : null;
  writePlexConfig(dataDir, scenario, hung?.port ?? 1);
  const cookie = seedAdmin(dataDir);
  seedLibrary(dataDir);
  const base = `http://127.0.0.1:${PORT}`;
  const logs = [];
  const child = spawn(process.execPath, [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: ROOT,
    env: { ...process.env, MOVVIZ_DATA_DIR: dataDir, MOVVIZ_CONFIG_DIR: dataDir, MOVVIZ_SESSION_SECRET: SECRET, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => logs.push(String(d)));
  child.stderr.on("data", (d) => logs.push(String(d)));
  const results = [];
  try {
    await waitReady(base, child, logs);
    // Identifiants réels si la bibliothèque en contient.
    const ids = { ratingKey: "1001", movieId: "mv_audit_both", seriesId: "sr_audit" };

    const getRoutes = routes.filter((r) => r.get && !SKIP_GET.some((re) => re.test(r.rel)));
    for (const r of getRoutes) {
      const url = "/api/" + fill(r.rel, ids);
      await hit(base, "GET", url, cookie, null, 120_000); // chauffe (compilation à la demande)
      const res = await hit(base, "GET", url, cookie, null, 20_000);
      results.push({ kind: "api", route: "GET /api/" + r.rel, url, ...res });
      process.stdout.write(`${String(res.status).padEnd(8)} ${String(res.ms).padStart(6)}ms  ${url}\n`);
    }
    for (const p of pages) {
      const url = fill(p.replace(/\[([a-zA-Z]+)\]/g, (m) => m), ids).replace(/\[[^\]]+\]/g, "1");
      await hit(base, "GET", url, cookie, null, 120_000);
      const res = await hit(base, "GET", url, cookie, null, 20_000);
      results.push({ kind: "page", route: "PAGE " + p, url, ...res });
      process.stdout.write(`${String(res.status).padEnd(8)} ${String(res.ms).padStart(6)}ms  ${url}\n`);
    }
    for (const c of targetedCases()) {
      await hit(base, c.method, c.url, cookie, c.body, 120_000);
      const res = await hit(base, c.method, c.url, cookie, c.body, 25_000);
      results.push({ kind: "targeted", group: c.group, name: c.name, expectOk: c.expectOk, route: c.method + " " + c.url, url: c.url, ...res });
      process.stdout.write(`${String(res.status).padEnd(8)} ${String(res.ms).padStart(6)}ms  [${c.group}] ${c.name}
`);
    }
    await sleep(3000);
  } finally {
    child.kill();
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    hung?.close();
  }
  const serverLog = logs.join("");
  fs.writeFileSync(path.join(OUT, `server-${scenario}.log`), serverLog);
  fs.writeFileSync(path.join(OUT, `results-${scenario}.json`), JSON.stringify(results, null, 2));
  return results;
}

fs.mkdirSync(OUT, { recursive: true });
const routes = listRoutes();
const pages = listPages();
console.log(`${routes.length} routes API (${routes.filter((r) => r.get).length} GET, ${routes.filter((r) => r.post).length} POST), ${pages.length} pages`);
for (const s of SCENARIOS) {
  const res = await runScenario(s, routes, pages);
  const bad = res.filter((r) => r.status === "TIMEOUT" || r.status === "NETERR" || (typeof r.status === "number" && r.status >= 500));
  const slow = res.filter((r) => typeof r.ms === "number" && r.ms > 3000 && !bad.includes(r));
  console.log(`\n[${s}] ${res.length} appels — ${bad.length} échecs 5xx/timeout, ${slow.length} lents (>3 s)`);
}
