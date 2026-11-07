import test from "node:test";
import assert from "node:assert/strict";
import { activeSeason, easterSunday } from "../src/lib/seasonal/calendar.ts";

const at = (iso: string) => activeSeason(new Date(`${iso}T12:00:00Z`));

test("saisons : fenêtres et anticipation", () => {
  assert.equal(at("2026-10-31"), "halloween");
  assert.equal(at("2026-11-02"), "halloween");
  assert.equal(at("2026-11-07"), null);
  assert.equal(at("2026-11-15"), "christmas");
  assert.equal(at("2026-12-26"), "christmas");
  assert.equal(at("2026-12-31"), "newYear");
  assert.equal(at("2027-01-06"), "newYear");
  assert.equal(at("2027-01-20"), null);
  assert.equal(at("2027-02-10"), "valentine");
  assert.equal(at("2026-07-14"), "summer");
});

test("Pâques : calcul et fenêtre", () => {
  assert.equal(easterSunday(2027).toISOString().slice(0, 10), "2027-03-28");
  assert.equal(at("2027-03-20"), "easter");
  assert.equal(at("2027-03-29"), "easter");
  assert.equal(at("2027-03-31"), null);
});
