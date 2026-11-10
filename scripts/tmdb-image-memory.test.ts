import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-tmdb-img-"));
process.env.MOVVIZ_CONFIG_DIR = dir;
const { readTmdbImage, tmdbImageMemoryStats, clearTmdbArtworkCache } = await import("@/lib/metadata/tmdbImageCache");

const put = (size: string, name: string, bytes: Buffer) => {
  fs.mkdirSync(path.join(dir, "tmdb-artwork", size), { recursive: true });
  fs.writeFileSync(path.join(dir, "tmdb-artwork", size, name), bytes);
};

test("image déjà sur disque : relue depuis la mémoire, même après disparition du fichier", async () => {
  put("w500", "poster.jpg", Buffer.from("poster-bytes"));
  const first = await readTmdbImage("w500", "poster.jpg");
  assert.equal(first?.body.toString(), "poster-bytes");
  assert.equal(first?.contentType, "image/jpeg");
  assert.deepEqual(tmdbImageMemoryStats(), { files: 1, bytes: 12 });
  fs.rmSync(path.join(dir, "tmdb-artwork", "w500", "poster.jpg"));
  const second = await readTmdbImage("w500", "poster.jpg");
  assert.equal(second?.body.toString(), "poster-bytes");
});

test("w780 sert le fichier w1280 et supprime le doublon w780 hérité", async () => {
  put("w1280", "fond.png", Buffer.from("grand"));
  put("w780", "fond.png", Buffer.from("ancien"));
  const image = await readTmdbImage("w780", "fond.png");
  assert.equal(image?.body.toString(), "grand");
  assert.equal(image?.contentType, "image/png");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(fs.existsSync(path.join(dir, "tmdb-artwork", "w780", "fond.png")), false);
});

test("taille ou nom refusés : rien n'est lu", async () => {
  assert.equal(await readTmdbImage("w999", "poster.jpg"), null);
  assert.equal(await readTmdbImage("w500", "../secret.jpg"), null);
});

test("vider le cache vide aussi la mémoire", async () => {
  await clearTmdbArtworkCache("all");
  assert.deepEqual(tmdbImageMemoryStats(), { files: 0, bytes: 0 });
});
