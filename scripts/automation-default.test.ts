import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("activation par défaut, migration d'un ancien false et désactivation ultérieure persistante", () => {
  for (const initial of [null, { autoSearchMissingEnabled: false }, { autoSearchMissingEnabled: true }]) {
    const dir = mkdtempSync(path.join(tmpdir(), "movviz-auto-default-"));
    const file = path.join(dir, "automation-config.json");
    const run = (code: string) => {
      const result = spawnSync(process.execPath, [
        "--experimental-transform-types", "--no-warnings", "--import", "./scripts/movviz-test-loader.mjs",
        "--input-type=module", "-e", code,
      ], { encoding: "utf8", env: { ...process.env, MOVVIZ_CONFIG_DIR: dir } });
      assert.equal(result.status, 0, result.stderr + result.stdout);
    };
    try {
      if (initial) writeFileSync(file, JSON.stringify(initial));
      run(`
        import assert from 'node:assert/strict';
        import { isAutoSearchMissingEnabled } from '@/lib/settings/automation';
        import { flushPendingJsonWritesSync } from '@/lib/fsJsonCache';
        assert.equal(isAutoSearchMissingEnabled(), true);
        flushPendingJsonWritesSync();
      `);
      assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), {
        autoSearchMissingEnabled: true, autoSearchMissingDefaultVersion: 1,
      });
      run(`
        import assert from 'node:assert/strict';
        import { setAutoSearchMissingEnabled, isAutoSearchMissingEnabled } from '@/lib/settings/automation';
        import { flushPendingJsonWritesSync } from '@/lib/fsJsonCache';
        setAutoSearchMissingEnabled(false);
        assert.equal(isAutoSearchMissingEnabled(), false);
        flushPendingJsonWritesSync();
      `);
      // A fresh process proves the user's new opt-out survives a restart.
      run(`
        import assert from 'node:assert/strict';
        import { isAutoSearchMissingEnabled } from '@/lib/settings/automation';
        assert.equal(isAutoSearchMissingEnabled(), false);
      `);
      assert.equal(JSON.parse(readFileSync(file, "utf8")).autoSearchMissingEnabled, false);
    } finally {
      unlinkSync(file);
      rmdirSync(dir);
    }
  }
});
