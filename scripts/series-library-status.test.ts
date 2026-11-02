import test from "node:test";
import assert from "node:assert/strict";
import { seriesLibraryStatus } from "@/lib/library/seriesLibraryStatus";

const ep = (status: string, extra: Record<string, unknown> = {}) => ({ monitored: true, status, activeInfoHash: null, ...extra });
const series = (episodes: unknown[]) => ({ seasons: [{ episodes }] }) as Parameters<typeof seriesLibraryStatus>[0];

test("une série complète reste disponible malgré un ancien claim activeInfoHash", () => {
  assert.equal(seriesLibraryStatus(series([ep("available", { activeInfoHash: "abc" }), ep("available")])), "available");
});

test("un épisode réellement en téléchargement, recherche ou réclamé sans fichier garde le badge en cours", () => {
  assert.equal(seriesLibraryStatus(series([ep("available"), ep("downloading")])), "downloading");
  assert.equal(seriesLibraryStatus(series([ep("available"), ep("searching")])), "downloading");
  assert.equal(seriesLibraryStatus(series([ep("available"), ep("missing", { activeInfoHash: "abc" })])), "downloading");
});

test("manquant et à venir inchangés", () => {
  assert.equal(seriesLibraryStatus(series([ep("available"), ep("missing")])), "missing");
  assert.equal(seriesLibraryStatus(series([ep("upcoming")])), "upcoming");
  assert.equal(seriesLibraryStatus(series([ep("missing", { monitored: false })])), "missing");
});
