import test from "node:test";
import assert from "node:assert/strict";
import { activeSeason, easterSunday, sanitizeSeasonSettings } from "../src/lib/seasonal/calendar.ts";

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

test("dates personnalisées remplacent les dates par défaut", () => {
  const settings = sanitizeSeasonSettings({ windows: { christmas: { start: "12-01", end: "12-31" }, halloween: { start: "13-99", end: "x" } }, easter: { before: 3, after: 0 } });
  assert.equal(activeSeason(new Date("2026-11-20T12:00:00Z"), settings), null);
  assert.equal(activeSeason(new Date("2026-12-10T12:00:00Z"), settings), "christmas");
  assert.equal(activeSeason(new Date("2026-10-15T12:00:00Z"), settings), "halloween");
  assert.equal(activeSeason(new Date("2027-03-20T12:00:00Z"), settings), null);
});
