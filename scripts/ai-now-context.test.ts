import test from "node:test";
import assert from "node:assert/strict";
import { buildNowContext, formatNow, validTimeZone } from "../src/lib/ai/nowContext";

test("the assistant gets the real date and time in the device's zone", () => {
  const now = new Date("2026-09-26T21:41:00Z");
  assert.equal(formatNow(now, "Europe/Paris"), "samedi 26 septembre 2026, 23:41");
  assert.equal(formatNow(now, "America/New_York"), "samedi 26 septembre 2026, 17:41");
  assert.match(buildNowContext(now, "Europe/Paris"), /26 septembre 2026, 23:41/);
});

test("an unknown time zone falls back to the server's instead of failing", () => {
  assert.equal(validTimeZone("Mars/Olympus"), null);
  assert.equal(validTimeZone(42), null);
  assert.equal(validTimeZone("Europe/Paris"), "Europe/Paris");
  assert.match(formatNow(new Date("2026-09-26T21:41:00Z"), "Mars/Olympus"), /2026/);
});
