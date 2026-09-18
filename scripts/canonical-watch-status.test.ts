import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { getUserContextHealth } from "@/lib/userContext/database";
import { applyWatchDecision, getCanonicalWatchStatus } from "@/lib/userContext/watchBridge";
import { setWatchedMovies, getWatchStatus } from "@/lib/plex/watchStore";

function freshUserId(): string {
  return `test-canonical-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function skipIfNoDb(t: { skip: (msg: string) => void }): boolean {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return true;
  }
  return false;
}

/**
 * Test explicite du plan de finalisation (§39) : la preuve que SQLite est
 * réellement devenu la source de vérité côté lecture client, pas juste côté
 * écriture. Le JSON legacy (plex-watch-status.json) est délibérément
 * désynchronisé à la main ici pour simuler l'écart réel possible (une
 * écriture JSON refusée par jsonCacheReadFailed, une donnée héritée jamais
 * réconciliée...) sans passer par le chemin normal qui les garde alignés.
 */
test("SQLite WATCHED, JSON vide/périmé -> getCanonicalWatchStatus() renvoie WATCHED", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 500_001;
  const result = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "watched", occurredAt: Date.now(), source: "movviz_manual" });
  assert.equal(result.accepted, true);
  // JSON jamais touché pour cet utilisateur : getWatchStatus() est vide/null.
  assert.deepEqual(getWatchStatus(userId)?.movies ?? [], []);
  const canonical = getCanonicalWatchStatus(userId);
  assert.ok(canonical);
  assert.ok(canonical!.movies.includes(tmdbId), "le canonique doit refléter SQLite, pas le JSON vide");
});

test("SQLite UNWATCHED, JSON dit encore WATCHED -> getCanonicalWatchStatus() renvoie UNWATCHED", (t) => {
  if (skipIfNoDb(t)) return;
  const userId = freshUserId();
  const tmdbId = 500_002;
  const T1 = 1_000_000;
  const T2 = 2_000_000;
  // 1) Watched normal (JSON + SQLite s'accordent).
  setWatchedMovies(userId, [tmdbId], true, "Film Test", T1, "movviz_manual");
  assert.ok(getWatchStatus(userId)?.movies.includes(tmdbId));
  // 2) Décision SQLite directe plus récente (unwatched) SANS passer par
  //    setWatchedMovies — simule un écart réel où seul SQLite a été mis à
  //    jour (ex. une future intégration qui écrirait directement au
  //    resolver sans repasser par la façade JSON).
  const decision = applyWatchDecision({ userId, tmdbId, mediaType: "movie", state: "unwatched", occurredAt: T2, source: "movviz_manual" });
  assert.equal(decision.accepted, true);
  // Le JSON n'a pas bougé : il ment encore "watched".
  assert.ok(getWatchStatus(userId)?.movies.includes(tmdbId), "le JSON reste délibérément périmé pour ce test");
  const canonical = getCanonicalWatchStatus(userId);
  assert.ok(canonical);
  assert.ok(!canonical!.movies.includes(tmdbId), "le canonique doit suivre SQLite (unwatched), pas le JSON périmé");
});

test("getCanonicalWatchStatus() renvoie null quand le moteur de contexte est indisponible (jamais une fausse liste vide)", () => {
  // Processus enfant isolé (même raison que le test équivalent dans
  // watch-decision.test.ts) : muter le singleton globalThis partagé
  // causerait une race avec les fichiers de test exécutés en parallèle.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-canonical-off-"));
  try {
    const script = `
      import { getCanonicalWatchStatus } from "@/lib/userContext/watchBridge";
      process.stdout.write(JSON.stringify(getCanonicalWatchStatus("whoever")));
    `;
    const scriptPath = path.join(tmpDir, "repro.ts");
    fs.writeFileSync(scriptPath, script);
    const out = execFileSync(
      process.execPath,
      ["--experimental-transform-types", "--no-warnings", "--import", pathToFileURL(path.resolve("scripts/movviz-test-loader.mjs")).href, scriptPath],
      { env: { ...process.env, MOVVIZ_CONTEXT_ENGINE_DISABLED: "1", MOVVIZ_DATA_DIR: tmpDir }, encoding: "utf8" },
    );
    assert.equal(out.trim().split("\n").pop(), "null");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
