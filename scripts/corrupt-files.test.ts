import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectFile } from "@/lib/library/corruptFiles";

/**
 * Les 777 fichiers « Invalid data found » d'un NAS étaient des fichiers
 * pré-alloués : bonne taille, contenu absent. Ces tests verrouillent ce que
 * la liste « fichiers corrompus » doit signaler — et ce qu'elle doit laisser.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-corrupt-"));
const file = (name: string, data: Buffer) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, data);
  return p;
};
const MB = 1024 * 1024;

test("un fichier absent n'est pas « corrompu »", async () => {
  assert.equal(await inspectFile(path.join(dir, "nope.mkv")), null);
});

test("un fichier de 0 octet est vide", async () => {
  const r = await inspectFile(file("empty.mkv", Buffer.alloc(0)));
  assert.equal(r?.ok, false);
  assert.equal(r?.reason, "empty");
});

test("un fichier entièrement nul a un début vide", async () => {
  const r = await inspectFile(file("zeros.mkv", Buffer.alloc(5 * MB)));
  assert.equal(r?.ok, false);
  assert.equal(r?.reason, "zero_head");
});

test("un fichier plein de données valides est sain", async () => {
  const r = await inspectFile(file("full.mkv", crypto.randomBytes(5 * MB)));
  assert.equal(r?.ok, true);
  assert.equal(r?.reason, null);
});

test("un en-tête valide suivi de zéros est incomplet", async () => {
  const data = Buffer.alloc(8 * MB);
  crypto.randomBytes(64 * 1024).copy(data, 0);
  const r = await inspectFile(file("header-only.mkv", data));
  assert.equal(r?.ok, false);
  assert.equal(r?.reason, "partial");
});

test("seul le dernier morceau présent : début vide", async () => {
  const data = Buffer.alloc(8 * MB);
  crypto.randomBytes(64 * 1024).copy(data, data.length - 64 * 1024);
  const r = await inspectFile(file("tail-only.mkv", data));
  assert.equal(r?.reason, "zero_head");
});

test("un petit fichier valide (moins de 24 blocs) est sain", async () => {
  const r = await inspectFile(file("small.mp4", crypto.randomBytes(10_000)));
  assert.equal(r?.ok, true);
});
