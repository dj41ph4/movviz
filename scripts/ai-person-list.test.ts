import test from "node:test";
import assert from "node:assert/strict";
import { extractPersonListFollowUp, buildPersonListCards, personListIntro, type PersonCredit } from "@/lib/ai/personList";
import { extractFilmographyRequest } from "@/lib/ai/intentParser";

test("les relances vues en direct sur Quentin Dupieux sont reconnues comme des demandes de liste", () => {
  assert.deepEqual(extractPersonListFollowUp("montre moi ses films"), { count: undefined, best: false, scope: "movie", pronoun: true });
  assert.deepEqual(extractPersonListFollowUp("montre les 10 meilleurs"), { count: 10, best: true, scope: "all", pronoun: false });
  assert.deepEqual(extractPersonListFollowUp("montre en 8"), { count: 8, best: false, scope: "all", pronoun: false });
  assert.equal(extractPersonListFollowUp("donne-moi sa filmographie")?.pronoun, true);
  assert.equal(extractPersonListFollowUp("le top 5 de ses séries")?.scope, "series");
});

test("ce qui n'est pas une liste n'est jamais pris pour une", () => {
  for (const m of ["montre-moi la bande annonce", "tu vas bien ?", "lance le daim", "j'ai adoré ce film", "montre moi la fiche", "et toi, tu préfères lequel de tous ses films quand tu es de bonne humeur un dimanche soir ?"]) {
    assert.equal(extractPersonListFollowUp(m), null, m);
  }
});

test("la demande de départ reste une demande de filmographie", () => {
  assert.equal(extractFilmographyRequest("remontre moi tous les film de quentin dupieux")?.person, "quentin dupieux");
});

const credits: PersonCredit[] = [
  { tmdbId: 1, type: "movie", title: "Le Daim", year: 2019, overview: "", posterPath: "/a.jpg", rating: 6.4, inLibrary: true },
  { tmdbId: 2, type: "movie", title: "Rubber", year: 2010, overview: "", posterPath: null, rating: 5.9, inLibrary: false },
  { tmdbId: 3, type: "movie", title: "Mandibules", year: 2020, overview: "", posterPath: null, rating: 6.6, inLibrary: false },
  { tmdbId: 4, type: "movie", title: "Inédit", year: 2027, overview: "", posterPath: null, rating: 0, inLibrary: false },
];

test("les N meilleurs : triés par note, sans les titres pas encore notés", () => {
  const cards = buildPersonListCards(credits, { count: 2, best: true });
  assert.deepEqual(cards.map((c) => c.title), ["Mandibules", "Le Daim"]);
});

test("sans nombre : toute la liste, dans l'ordre de popularité, en cartes complètes", () => {
  const cards = buildPersonListCards(credits, { best: false });
  assert.equal(cards.length, 4);
  assert.deepEqual(cards[0], { title: "Le Daim", year: 2019, type: "movie", tmdbId: 1, overview: "", posterPath: "/a.jpg", rating: 6.4, inLibrary: true });
});

test("l'intro dit les faits : combien, sur combien, et combien déjà dans la bibliothèque", () => {
  const cards = buildPersonListCards(credits, { count: 2, best: false });
  assert.equal(personListIntro("Quentin Dupieux", cards, 4, { count: 2, best: false, scope: "movie", directorOnly: true }), "Les 2 films les plus connus réalisés par Quentin Dupieux (sur 4) 🎬 Tu en as déjà 1 dans ta bibliothèque.");
});

test("« liste cliquable de 3 films des Dupieux » : 3 cartes, jamais un ajout", async () => {
  const { asksToAddMedia } = await import("@/lib/ai/chatAssist");
  const m = "fais moi une liste clicable de 3 film des dupieux";
  assert.deepEqual(extractPersonListFollowUp(m), { count: 3, best: false, scope: "movie", pronoun: false });
  assert.equal(asksToAddMedia(m), false);
});

test("un ajout ne part que sur une vraie demande d'ajout ou un oui à une proposition d'ajout", async () => {
  const { asksToAddMedia } = await import("@/lib/ai/chatAssist");
  for (const m of ["ajoute Le Daim", "télécharge les 3", "rajoute-moi Yannick", "récupère Mandibules", "mets Rubber", "prends le deuxième", "dl le daim"]) {
    assert.equal(asksToAddMedia(m), true, m);
  }
  assert.equal(asksToAddMedia("oui vas-y", "Je te l'ajoute à la bibliothèque ?"), true);
  for (const m of ["montre en 8", "propose moi des films de Dupieux", "mets-moi une liste de ses films", "Le Daim", "oui"]) {
    assert.equal(asksToAddMedia(m, "Tu veux qu'on en tente un ?"), false, m);
  }
});
