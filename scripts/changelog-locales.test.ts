import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("./check-changelog-locales.mjs", import.meta.url));
const french = "## v2.0.0 — octobre\n### Interface\n- Une correction.\n## v1.0.0 — septembre\n### Installation\n- Une option.\n";
const translated = "## v2.0.0 — October\n### Interface\n- One fix.\n## v1.0.0 — September\n### Installation\n- One option.\n";

test("la vérification refuse une langue avec une version ou une puce manquante", (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "movviz-locale-guard-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith("movviz-locale-guard-"));
    rmSync(dir, { recursive: true, force: true });
  });
  writeFileSync(path.join(dir, "CHANGELOG.md"), french);
  for (const locale of ["en", "it", "nl", "de"]) writeFileSync(path.join(dir, `CHANGELOG.${locale}.md`), translated);
  const check = () => execFileSync(process.execPath, [checker], { cwd: dir, stdio: "pipe" }).toString();
  assert.match(check(), /2 versions/);
  writeFileSync(path.join(dir, "CHANGELOG.nl.md"), translated.replace("- One option.\n", ""));
  assert.throws(check, /sections ou puces/);
  writeFileSync(path.join(dir, "CHANGELOG.nl.md"), translated.replace(/^## v1\.0\.0[\s\S]*/m, ""));
  assert.throws(check, /versions/);
});
