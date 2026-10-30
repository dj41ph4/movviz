import test from "node:test";
import assert from "node:assert/strict";

/**
 * Un pack de saison téléchargé pour quelques épisodes : une fois les épisodes
 * importés (completedAt), le torrent continuait de recevoir le reste du pack
 * et gardait un slot actif — la file derrière restait bloquée.
 */
async function backendWith(torrents: { infoHash: string; meta: Record<string, unknown> }[], maxActive: number) {
  const { AbstractBackend } = await import("../engine/src/backends/AbstractBackend.mjs");
  const backend: any = Object.create(AbstractBackend.prototype);
  backend.cfg = { maxActive };
  backend.meta = new Map(torrents.map((t) => [t.infoHash, { queued: false, ...t.meta }]));
  const list = torrents.map((t) => ({ infoHash: t.infoHash, files: [], done: false }));
  backend._clientList = () => list;
  const paused: string[] = [];
  const resumed: string[] = [];
  backend._clientPause = async (h: string) => { paused.push(h); };
  backend._clientResume = async (h: string) => { resumed.push(h); };
  return { backend, paused, resumed };
}

test("un torrent dont l'import a démarré ne retient plus de slot", async () => {
  const { backend, paused } = await backendWith(
    [
      { infoHash: "pack-imported", meta: { completedAt: 1, addedAt: 1 } },
      { infoHash: "next-a", meta: { addedAt: 2 } },
      { infoHash: "next-b", meta: { addedAt: 3 } },
    ],
    2
  );
  backend.reconcileQueue();
  assert.equal(backend.meta.get("next-a").queued, false, "le suivant doit tourner");
  assert.equal(backend.meta.get("next-b").queued, false, "le suivant doit tourner");
  assert.deepEqual(paused, [], "personne n'est mis en attente à sa place");
});

test("sans torrent terminé, la limite de slots s'applique toujours", async () => {
  const { backend } = await backendWith(
    [
      { infoHash: "a", meta: { addedAt: 1 } },
      { infoHash: "b", meta: { addedAt: 2 } },
      { infoHash: "c", meta: { addedAt: 3 } },
    ],
    2
  );
  backend.reconcileQueue();
  assert.equal(backend.meta.get("a").queued, false);
  assert.equal(backend.meta.get("b").queued, false);
  assert.equal(backend.meta.get("c").queued, true);
});

test("après le repli « tout sélectionner », la sélection d'épisodes reste la référence de fin", async () => {
  const { AbstractBackend } = await import("../engine/src/backends/AbstractBackend.mjs");
  const { WebTorrentBackend } = await import("../engine/src/backends/WebTorrentBackend.mjs");
  const backend: any = Object.create(WebTorrentBackend.prototype);
  backend.meta = new Map([["h", { selectedFileIndices: new Set([1]) }]]);
  const files = [{ done: false }, { done: true }, { done: false }];
  // Épisode visé (index 1) complet, reste du pack incomplet : le torrent est fini.
  assert.equal(backend._isDone({ infoHash: "h", done: false, files }), true);
  assert.ok(AbstractBackend);
});

/**
 * Le contenu d'un pack est lu dès les métadonnées : si aucun fichier ne
 * correspond aux épisodes voulus, le pack est écarté AVANT tout octet
 * téléchargé (il restait sinon à 0 % en gardant son slot) et le web en
 * cherche un autre.
 */
async function selection(files: string[], targets: { season: number; episode: number }[], reject = true) {
  const { AbstractBackend } = await import("../engine/src/backends/AbstractBackend.mjs");
  const backend: any = Object.create(AbstractBackend.prototype);
  const selected: Set<number>[] = [];
  backend._clientSelectFiles = (_h: unknown, set: Set<number>) => selected.push(set);
  const meta: any = { episodeTargets: targets, rejectMissingSeriesPack: reject };
  backend._selectEpisodeFiles({ name: "Show.S02.MULTi.1080p", files: files.map((name) => ({ name, path: name })) }, meta);
  return { meta, selected };
}

test("pack de saison sans l'épisode voulu : écarté sur ses métadonnées", async () => {
  const { meta, selected } = await selection(
    ["Show.S02E01.mkv", "Show.S02E02.mkv", "Show.S02E03.mkv"],
    [{ season: 5, episode: 4 }, { season: 5, episode: 5 }]
  );
  assert.equal(meta.missingSeriesPack, true);
  assert.equal(selected.length, 0, "aucun fichier sélectionné, donc rien à télécharger");
});

test("pack de saison contenant l'épisode : sélection normale, pas de rejet", async () => {
  const { meta, selected } = await selection(
    ["Show.S02E01.mkv", "Show.S02E02.mkv", "Show.S02E03.mkv"],
    [{ season: 2, episode: 2 }]
  );
  assert.notEqual(meta.missingSeriesPack, true);
  assert.deepEqual([...selected[0]], [1]);
});

test("sans demande de rejet (grab manuel), un pack sans correspondance n'est jamais écarté", async () => {
  const { meta } = await selection(["Show.S02E01.mkv"], [{ season: 5, episode: 4 }, { season: 5, episode: 5 }], false);
  assert.notEqual(meta.missingSeriesPack, true);
});
