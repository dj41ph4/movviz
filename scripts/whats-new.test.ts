import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { CHANGELOG_SEEN_KEY, loadWhatsNew, readableChangelog } from "../src/lib/updates/whatsNew";
import { getChangelogRange, readEntry } from "../src/lib/changelog";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const version: string = pkg.version;
const entry = { version, date: null, sections: [{ heading: "Corrections", items: ["Notes visibles."] }] };
const payload = { version, entries: [entry] };

test("new acknowledgement key cannot inherit versions falsely marked seen by the old popup", () => {
  assert.notEqual(CHANGELOG_SEEN_KEY, "movviz_last_seen_version");
  const source = readFileSync(new URL("../src/components/layout/WhatsNewModal.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/localStorage\.setItem/g) ?? []).length, 1);
  const close = source.slice(source.indexOf("const close ="));
  assert.match(close, /visible && !splashActive && entries\.length/);
  assert.match(close, /localStorage\.setItem\(CHANGELOG_SEEN_KEY, entries\[0\]\.version\)/);
  assert.match(source, /return \(\) => \{ cancelled = true; controller\.abort\(\)/);
});

test("valid notes survive loading but empty, failed and wrong-version responses remain unread", async () => {
  assert.deepEqual(readableChangelog(payload, version), [entry]);
  for (const bad of [null, {}, { version, entries: [] }, { version: "0.0.0", entries: [entry] }, { version, entries: [{ ...entry, sections: [] }] }]) {
    let calls = 0;
    const result = await loadWhatsNew(version, async () => { calls++; return bad; }, async () => {}, () => false);
    assert.deepEqual(result, []); assert.equal(calls, 3);
  }
});

test("network failure retries twice and a successful retry preserves the real notes", async () => {
  let calls = 0;
  const delays: number[] = [];
  const notes = await loadWhatsNew(version, async () => { if (++calls < 3) throw new Error("offline"); return payload; }, async (ms) => { delays.push(ms); }, () => false);
  assert.deepEqual(notes, [entry]); assert.deepEqual(delays, [2000, 4000]); assert.equal(calls, 3);
});

test("unmount abort does not deliver late notes or start further requests", async () => {
  let cancelled = false, calls = 0;
  const result = await loadWhatsNew(version, async () => { calls++; cancelled = true; return payload; }, async () => {}, () => cancelled);
  assert.deepEqual(result, []); assert.equal(calls, 1);
  const before = await loadWhatsNew(version, async () => { throw new Error("must not fetch"); }, async () => {}, () => true);
  assert.deepEqual(before, []);
});

test("first visit sees only current notes; missed versions and backfilled releases remain available", () => {
  assert.deepEqual(getChangelogRange(null, version).map((item) => item.version), [version]);
  const missed = getChangelogRange("1.25.162", version).map((item) => item.version);
  assert.equal(missed[0], version);
  assert.deepEqual(missed.slice(-4), ["1.25.166", "1.25.165", "1.25.164", "1.25.163"]);
  assert.equal(new Set(missed).size, missed.length);
  assert.deepEqual(getChangelogRange(version, version), []);
  assert.ok(readEntry(fileURLToPath(new URL("../CHANGELOG.md", import.meta.url)), version)?.sections.some((section) => section.items.length));
});

test("release guard accepts current v-style notes and rejects missing notes, blank notes and stale README", (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "movviz-release-guard-"));
  t.after(() => { assert.equal(path.dirname(dir), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith("movviz-release-guard-")); rmSync(dir, { recursive: true, force: true }); });
  const script = fileURLToPath(new URL("../scripts/extract-changelog.mjs", import.meta.url));
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "9.9.9" }));
  writeFileSync(path.join(dir, "package-lock.json"), JSON.stringify({ version: "9.9.9", packages: { "": { version: "9.9.9" } } }));
  writeFileSync(path.join(dir, "README.md"), "Version actuelle : v9.9.9</strong>");
  const run = () => execFileSync(process.execPath, [script, "--check"], { cwd: dir, stdio: "pipe" }).toString();
  writeFileSync(path.join(dir, "CHANGELOG.md"), "## v9.9.9 — Octobre\n### Test\n- Notes complètes.\n");
  assert.match(run(), /9\.9\.9/);
  writeFileSync(path.join(dir, "CHANGELOG.md"), "## [9.9.9]\n### Test\n- Notes complètes.\n");
  assert.match(run(), /9\.9\.9/);
  writeFileSync(path.join(dir, "CHANGELOG.md"), "## v9.9.8\n### Test\n- Anciennes notes.\n");
  assert.throws(run);
  writeFileSync(path.join(dir, "CHANGELOG.md"), "## v9.9.9\n### Test\n"); assert.throws(run);
  writeFileSync(path.join(dir, "CHANGELOG.md"), "## v9.9.9\n### Test\n- Notes complètes.\n");
  writeFileSync(path.join(dir, "README.md"), "Version actuelle : v9.9.8</strong>"); assert.throws(run);
});
