import { test } from "node:test";
import assert from "node:assert/strict";
import { isInTaskWindow, nextInTaskWindow, parseTaskWindow } from "@/lib/scheduler/window";

const at = (h: number, m = 0, day = 15) => new Date(2026, 9, day, h, m, 0, 0).getTime();

test("sans plage, tout instant est autorisé", () => {
  assert.equal(isInTaskWindow(at(12), null), true);
  assert.equal(nextInTaskWindow(at(12), undefined), at(12));
});

test("plage 4-6 : début inclus, fin exclue", () => {
  const w = { startHour: 4, endHour: 6 };
  assert.equal(isInTaskWindow(at(3, 59), w), false);
  assert.equal(isInTaskWindow(at(4), w), true);
  assert.equal(isInTaskWindow(at(5, 59), w), true);
  assert.equal(isInTaskWindow(at(6), w), false);
});

test("plage passant minuit 22-2", () => {
  const w = { startHour: 22, endHour: 2 };
  assert.equal(isInTaskWindow(at(23), w), true);
  assert.equal(isInTaskWindow(at(1), w), true);
  assert.equal(isInTaskWindow(at(2), w), false);
  assert.equal(isInTaskWindow(at(12), w), false);
});

test("la prochaine exécution attend le début de plage, aujourd'hui ou demain", () => {
  const w = { startHour: 4, endHour: 6 };
  assert.equal(nextInTaskWindow(at(2), w), at(4));
  assert.equal(nextInTaskWindow(at(10), w), at(4, 0, 16));
  assert.equal(nextInTaskWindow(at(5), w), at(5));
});

test("une plage invalide est refusée", () => {
  assert.equal(parseTaskWindow({ startHour: 4, endHour: 4 }), null);
  assert.equal(parseTaskWindow({ startHour: 4, endHour: 24 }), null);
  assert.equal(parseTaskWindow({ startHour: 4.5, endHour: 6 }), null);
  assert.equal(parseTaskWindow(null), null);
  assert.deepEqual(parseTaskWindow({ startHour: 4, endHour: 6 }), { startHour: 4, endHour: 6 });
});
