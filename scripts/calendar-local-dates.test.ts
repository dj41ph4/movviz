import test from "node:test";
import assert from "node:assert/strict";
import { localIso, monthCells, parseLocalIso, weekDays } from "@/lib/calendar/localDate";

// Ahead of UTC (France/Belgium, NZ), behind (US), and UTC itself: the old
// toISOString().slice(0, 10) was wrong for every zone east of Greenwich.
const ZONES = ["Europe/Brussels", "Pacific/Auckland", "America/Los_Angeles", "UTC"];

function inZone(tz: string, run: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try { run(); } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
}

test("localIso garde le jour local, quel que soit le fuseau", () => {
  for (const tz of ZONES) inZone(tz, () => {
    assert.equal(localIso(new Date(2026, 10, 2)), "2026-11-02", tz);
    assert.equal(localIso(new Date(2026, 10, 2, 23, 59)), "2026-11-02", tz);
    assert.equal(localIso(new Date(2026, 0, 1)), "2026-01-01", tz);
  });
});

test("une semaine commence bien le lundi et chaque jour garde sa date", () => {
  for (const tz of ZONES) inZone(tz, () => {
    const days = weekDays(new Date(2026, 10, 2));
    assert.deepEqual(days.map((d) => d.iso), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"], tz);
    assert.deepEqual(days.map((d) => d.date.getDate()), [2, 3, 4, 5, 6, 7, 8], tz);
  });
});

test("la grille du mois place le 1er au bon jour de semaine et numérote sans décalage", () => {
  for (const tz of ZONES) inZone(tz, () => {
    const cells = monthCells(new Date(2026, 10, 1));
    // 1 novembre 2026 = dimanche : 6 cases vides avant, puis le 1er.
    assert.equal(cells.findIndex((c) => c !== null), 6, tz);
    const real = cells.filter((c): c is { iso: string; dayNum: number } => c !== null);
    assert.equal(real.length, 30, tz);
    assert.equal(real[0].iso, "2026-11-01", tz);
    assert.equal(real[1].iso, "2026-11-02", tz);
    assert.equal(real[29].iso, "2026-11-30", tz);
    assert.ok(real.every((c) => Number(c.iso.slice(8)) === c.dayNum), tz);
  });
});

test("le titre du panneau d'un jour lit la date en local, pas en UTC", () => {
  for (const tz of ZONES) inZone(tz, () => {
    const d = parseLocalIso("2026-11-03");
    assert.equal(d.getDate(), 3, tz);
    assert.equal(d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }), "mardi 3 novembre", tz);
  });
});
