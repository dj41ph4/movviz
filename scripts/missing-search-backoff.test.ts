import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.MOVVIZ_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-backoff-"));
const { backoffDelayMs, isDueForRetry, recordRetryPass } = await import("@/lib/library/missingSearchBackoff");

const DAY = 24 * 60 * 60 * 1000;

test("relance des manquants : délai 1 j, puis 3 j au maximum", () => {
  assert.equal(backoffDelayMs(0), 0);
  assert.equal(backoffDelayMs(1), DAY);
  assert.equal(backoffDelayMs(2), 3 * DAY);
  assert.equal(backoffDelayMs(3), 3 * DAY);
  assert.equal(backoffDelayMs(9), 3 * DAY);
});

test("relance des manquants : un titre cherché en vain attend, un titre jamais cherché passe", () => {
  const t0 = Date.parse("2026-10-12T00:00:00Z");
  assert.equal(isDueForRetry("movie:a", t0), true);
  recordRetryPass("movie:", ["movie:a"], new Set(["movie:a", "movie:b"]), t0);
  assert.equal(isDueForRetry("movie:a", t0 + DAY - 1), false);
  assert.equal(isDueForRetry("movie:a", t0 + DAY), true);
  assert.equal(isDueForRetry("movie:b", t0), true);
  recordRetryPass("movie:", ["movie:a"], new Set(["movie:a"]), t0 + DAY);
  assert.equal(isDueForRetry("movie:a", t0 + DAY + 3 * DAY - 1), false);
  assert.equal(isDueForRetry("movie:a", t0 + 4 * DAY), true);
});

test("relance des manquants : un titre trouvé repart de zéro, l'autre type n'est pas touché", () => {
  const t0 = Date.parse("2026-11-01T00:00:00Z");
  recordRetryPass("series:", ["series:s"], new Set(["series:s"]), t0);
  recordRetryPass("movie:", ["movie:c"], new Set(["movie:c"]), t0);
  // movie:c found (no longer active) — dropped; series:s kept.
  recordRetryPass("movie:", [], new Set(), t0 + 1);
  assert.equal(isDueForRetry("movie:c", t0 + 2), true);
  assert.equal(isDueForRetry("series:s", t0 + 2), false);
});
