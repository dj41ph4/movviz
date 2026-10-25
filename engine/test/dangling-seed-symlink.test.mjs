import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDanglingSymlinks } from "../src/backends/AbstractBackend.mjs";

function canSymlink(dir) {
  try { fs.symlinkSync(path.join(dir, "nope"), path.join(dir, ".probe")); fs.unlinkSync(path.join(dir, ".probe")); return true; } catch { return false; }
}

test("a dangling seed symlink in the download folder is removed, valid files and links are kept", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-dl-"));
  const library = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-lib-"));
  if (!canSymlink(root)) { t.skip("symlinks unavailable on this machine"); return; }
  fs.symlinkSync(path.join(library, "Buddy (2026)", "Buddy (2026).mkv"), path.join(root, "Buddy.mkv"));
  fs.writeFileSync(path.join(library, "kept.mkv"), "x");
  fs.symlinkSync(path.join(library, "kept.mkv"), path.join(root, "Valid.mkv"));
  fs.writeFileSync(path.join(root, "Real.mkv"), "y");
  assert.equal(removeDanglingSymlinks(root, ["Buddy.mkv", "Valid.mkv", "Real.mkv", "../escape.mkv"]), 1);
  assert.equal(fs.existsSync(path.join(root, "Valid.mkv")), true);
  assert.equal(fs.existsSync(path.join(root, "Real.mkv")), true);
  assert.throws(() => fs.lstatSync(path.join(root, "Buddy.mkv")));
  // Après nettoyage, l'ouverture avec création réussit (c'est ce qui échouait en ENOENT).
  fs.closeSync(fs.openSync(path.join(root, "Buddy.mkv"), fs.constants.O_RDWR | fs.constants.O_CREAT));
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(library, { recursive: true, force: true });
});
