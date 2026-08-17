import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIntent, extractFacts, extractWatched, extractRatings, extractSelfIntroName, extractNameFromDirectAnswer, detectLibraryFalseNegativeCorrection, extractMissingFromEntity, extractFilmographyQuestion, extractLibraryPresenceQuestion, extractWatchStatusQuestion, extractCastCrewQuestion, extractSeriesStatusQuestion, extractBareTitleMention, isSeriesStatusAboutCurrentPage, isDegenerateReply, containsLeakedInternalBlock, sanitizeLeakedBlock, containsLeakedActionJson, sanitizeLeakedActionJson, isFalseNameDenial, isFalseInternetDenial, isUnresolvedCheckPromise, promisesListWithNothing } from "@/lib/ai/intentParser";
import { isEpisodeListRequest, buildEpisodeListContext, buildMissingFromFranchiseContext, buildFilmographyContext, buildLibraryPresenceContext, buildWatchStatusContext, buildCastCrewContext, buildTitleStatusContext, buildTitleMentionContext } from "@/lib/ai/actions";

test("add_media JSON seul dans la réponse", () => {
  const got = parseIntent('{"action":"add_media","items":[{"title":"Justice League: War","year":2014,"type":"movie"}]}');
  assert.equal(got.action, "add_media");
  assert.equal(got.items.length, 1);
  assert.equal(got.items[0].title, "Justice League: War");
  assert.equal(got.items[0].year, 2014);
  assert.equal(got.items[0].type, "movie");
  assert.equal(got.rawText, "");
});

test("recommend avec reasons", () => {
  const got = parseIntent('{"action":"recommend","items":[{"title":"Naked Gun","year":1988,"type":"movie","reason":"Même humour absurde"}]}');
  assert.equal(got.action, "recommend");
  assert.equal(got.items[0].reason, "Même humour absurde");
});

test("JSON entouré de prose et fences markdown", () => {
  const got = parseIntent('Voici ce que je propose :\n```json\n{"action":"recommend","items":[{"title":"Airplane!"}]}\n```\nJ\'espère que ça t\'aide !');
  assert.equal(got.action, "recommend");
  assert.equal(got.items[0].title, "Airplane!");
  assert.ok(got.rawText.includes("Voici ce que je propose"));
  assert.ok(got.rawText.includes("J'espère que ça t'aide !"));
});

test("items invalides sont écartés (title vide), champs invalides ignorés (type inconnu, year hors bornes)", () => {
  const got = parseIntent('{"action":"add_media","items":[{"title":"","year":1700,"type":"movie"},{"title":"Bon","year":2500,"type":"documentary"},{"title":"OK","year":1990,"type":"series"}]}');
  assert.equal(got.action, "add_media");
  assert.equal(got.items.length, 2);
  assert.equal(got.items[0].title, "Bon");
  assert.equal(got.items[0].year, undefined);
  assert.equal(got.items[0].type, undefined);
  assert.equal(got.items[1].title, "OK");
  assert.equal(got.items[1].year, 1990);
  assert.equal(got.items[1].type, "series");
});

test("cap à 25 items", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ title: `Film ${i}`, type: "movie" }));
  const got = parseIntent(JSON.stringify({ action: "add_media", items }));
  assert.equal(got.items.length, 25);
});

test("pas de JSON => action null", () => {
  const got = parseIntent("Je suis un simple message texte, rien à faire ici.");
  assert.equal(got.action, null);
  assert.equal(got.items.length, 0);
  assert.equal(got.rawText, "Je suis un simple message texte, rien à faire ici.");
});

test("JSON sans action => null", () => {
  const got = parseIntent('{"foo":"bar"}');
  assert.equal(got.action, null);
});

test("texte hors JSON bien extrait dans rawText", () => {
  const got = parseIntent('D\'accord, voilà : {"action":"add_media","items":[{"title":"Batman: Hush"}]} C\'est fait !');
  assert.equal(got.action, "add_media");
  assert.ok(got.rawText.includes("D'accord, voilà"));
  assert.ok(got.rawText.includes("C'est fait !"));
  assert.equal(got.items[0].title, "Batman: Hush");
});

test("title trop long ( > 200) est écarté", () => {
  const long = "X".repeat(300);
  const got = parseIntent(JSON.stringify({ action: "add_media", items: [{ title: long }] }));
  assert.equal(got.items.length, 0);
  assert.equal(got.action, null);
});

test("recommend : guillemets internes non échappés dans une reason sont réparés (confirmé en direct : cassait le parsing et affichait le JSON brut à l'utilisateur)", () => {
  const raw = '{"action":"recommend","items":[{"title":"American Gods","year":2017,"type":"series","reason":"Un univers riche, parfait si tu as aimé l\'aspect "mythologie moderne" de Lucifer."},{"title":"Good Omens","year":2019,"type":"series","reason":"Duo charismatique, humour noir."}]}';
  const got = parseIntent(raw);
  assert.equal(got.action, "recommend");
  assert.equal(got.items.length, 2);
  assert.equal(got.items[0].title, "American Gods");
  assert.ok(got.items[0].reason?.includes("mythologie moderne"));
  assert.equal(got.items[1].title, "Good Omens");
});

test("recommend : JSON toujours invalide même après réparation ne fuit jamais en clair — remplacé par un message générique", () => {
  const got = parseIntent('{"action":"recommend","items":[}}}broken');
  assert.equal(got.action, null);
  assert.ok(!got.rawText.includes("{"));
  assert.ok(!got.rawText.includes("action"));
});

test("recommend : réponse tronquée par une limite de tokens (item final coupé en plein milieu) récupère les items complets au lieu de tout jeter (bug confirmé en direct : réponse à 'même mood qu'Alien' → message générique d'erreur)", () => {
  const truncated = '{"action":"recommend","items":[{"title":"The Thing","year":1982,"type":"movie","reason":"Huis clos et paranoïa, menace invisible"},{"title":"Event Horizon","year":1997,"type":"movie","reason":"Horreur cosmiqu';
  const got = parseIntent(truncated);
  assert.equal(got.action, "recommend");
  assert.equal(got.items.length, 1);
  assert.equal(got.items[0].title, "The Thing");
  assert.equal(got.rawText, "");
});

test("add_media : réponse tronquée après le premier item complet reste utilisable", () => {
  const truncated = '{"action":"add_media","items":[{"title":"Dune","year":2021,"type":"movie"},{"title":"Dune: Pa';
  const got = parseIntent(truncated);
  assert.equal(got.action, "add_media");
  assert.equal(got.items.length, 1);
  assert.equal(got.items[0].title, "Dune");
});

test("containsLeakedInternalBlock: détecte les deux libellés internes (bug confirmé en direct : le modèle recopiait le bloc tel quel malgré la consigne)", () => {
  assert.equal(containsLeakedInternalBlock('VÉRIFICATION RÉELLE pour « Dune » → identifié comme Dune (2021) [film, tmdb:438631] : OUI, déjà dans la bibliothèque.'), true);
  assert.equal(containsLeakedInternalBlock('RECHERCHE RÉELLE pour « pokemon » (résultats obtenus...) :\nDéjà dans ta bibliothèque : Pokémon (1998)'), true);
  assert.equal(containsLeakedInternalBlock("Ouais, tu l'as déjà, Dune (2021) est bien dans ta bibliothèque !"), false);
});

test("sanitizeLeakedBlock: retire le libellé interne et sa structure sans changer les faits sous-jacents", () => {
  const got = sanitizeLeakedBlock('VÉRIFICATION RÉELLE pour « Dune » → identifié comme Dune (2021) [film, tmdb:438631] : OUI, déjà dans la bibliothèque.');
  assert.equal(containsLeakedInternalBlock(got), false);
  assert.ok(got.includes("Dune (2021)"));
  assert.ok(got.includes("OUI, déjà dans la bibliothèque"));
  assert.ok(!got.includes("tmdb:438631"));
  assert.ok(!got.includes("→"));
});

test("isFalseNameDenial: détecte le déni alors qu'un prénom connu existe (bug confirmé en direct : l'assistant avait utilisé « Seb » plus tôt dans la MÊME conversation puis a nié le connaître)", () => {
  assert.equal(isFalseNameDenial("Au fait, tu te souviens de mon prénom ?", "Je ne sais pas encore, dis-le-moi !", "Prénom : Seb"), true);
  assert.equal(isFalseNameDenial("Tu te souviens de moi ?", "Tu ne me l'as pas donné pour l'instant", "Prénom : Seb"), true);
});

test("isFalseNameDenial: ne se déclenche jamais sans prénom connu (un vrai 'je ne sais pas' reste légitime)", () => {
  assert.equal(isFalseNameDenial("Tu te souviens de mon prénom ?", "Je ne sais pas encore, dis-le-moi !", undefined), false);
});

test("isFalseNameDenial: ne se déclenche pas si la réponse ne nie rien (cas normal, prénom bien utilisé)", () => {
  assert.equal(isFalseNameDenial("Tu te souviens de mon prénom ?", "Bien sûr, Seb !", "Prénom : Seb"), false);
});

test("isFalseNameDenial: ne se déclenche pas sur une question sans rapport", () => {
  assert.equal(isFalseNameDenial("Tu as quoi comme film d'horreur ?", "Je ne sais pas trop, plein de choix !", "Prénom : Seb"), false);
});

test("promisesListWithNothing: détecte une réponse qui annonce une liste sans rien derrière (bug confirmé en direct : 'surprends-moi' répondait en texte libre sans jamais basculer en JSON, aucune carte de recommandation affichée)", () => {
  assert.equal(promisesListWithNothing("Voici ce qui devrait te surprendre tout en gardant un lien avec ce que tu as aimé :"), true);
  assert.equal(promisesListWithNothing("Voici quelques idées :"), true);
});

test("promisesListWithNothing: ne se déclenche pas sur une vraie réponse en texte normal", () => {
  assert.equal(promisesListWithNothing("Ouais, tu l'as déjà, Dune (2021) est bien dans ta bibliothèque !"), false);
  assert.equal(promisesListWithNothing("Salut ! Comment ça va aujourd'hui ?"), false);
});

test("promisesListWithNothing: ne se déclenche pas sur une réponse vide (déjà couvert par isDegenerateReply)", () => {
  assert.equal(promisesListWithNothing(""), false);
  assert.equal(promisesListWithNothing("   "), false);
});

test("isFalseInternetDenial: détecte le déni catégorique alors que la recherche web est activée (bug confirmé en direct, deux fois : le toggle 'Recherche web' était sur ON mais l'assistant niait tout accès)", () => {
  assert.equal(isFalseInternetDenial(
    "tu as acces a internet a present, vas y",
    "Je n'ai toujours pas accès à internet en direct, même après ta demande — même Movviz ne me donne pas cette capacité.",
    true
  ), true);
  assert.equal(isFalseInternetDenial(
    "tu as accès à internet ?",
    "Non, je n'ai pas accès à internet en temps réel.",
    true
  ), true);
});

test("isFalseInternetDenial: ne se déclenche jamais quand la recherche web est réellement désactivée (un déni reste alors légitime)", () => {
  assert.equal(isFalseInternetDenial(
    "tu as accès à internet ?",
    "Non, je n'ai pas accès à internet en temps réel.",
    false
  ), false);
});

test("isFalseInternetDenial: ne se déclenche pas sur une réponse qui ne nie rien", () => {
  assert.equal(isFalseInternetDenial(
    "tu as accès à internet ?",
    "Pas pour une recherche libre à la demande, non — seulement pour certaines fonctionnalités précises comme les scènes mémorables.",
    true
  ), false);
});

test("isFalseInternetDenial: ne se déclenche pas sur un message sans rapport", () => {
  assert.equal(isFalseInternetDenial("télécharge sakamoto days", "D'accord, c'est parti !", true), false);
});

test("extractFilmographyQuestion: reconnaît les formulations courantes (bug confirmé en direct : 'donne moi la filmographie de brad pitt' recevait le même refus mot pour mot à chaque relance, sans aucune donnée réelle derrière)", () => {
  assert.equal(extractFilmographyQuestion("donne moi la filmographie de brad pitt"), "brad pitt");
  assert.equal(extractFilmographyQuestion("la filmographie de Tom Hanks"), "Tom Hanks");
  assert.equal(extractFilmographyQuestion("quels films a fait Denis Villeneuve"), "Denis Villeneuve");
  assert.equal(extractFilmographyQuestion("tous les films de Meryl Streep"), "Meryl Streep");
});

test("extractFilmographyQuestion: ne se déclenche pas sur la formulation 'manque' (déjà couverte par extractMissingFromEntity, les deux détecteurs restent exclusifs)", () => {
  assert.equal(extractFilmographyQuestion("il me manque quel film de brad pitt"), null);
  assert.equal(extractFilmographyQuestion("j'ai pas quoi comme film de brad pitt"), null);
});

test("extractFilmographyQuestion: ne se déclenche pas sur un message sans rapport", () => {
  assert.equal(extractFilmographyQuestion("télécharge sakamoto days"), null);
  assert.equal(extractFilmographyQuestion("recommande-moi un truc similaire"), null);
});

test("buildFilmographyContext: sépare bibliothèque / pas bibliothèque, signale la troncature quand la liste est plafonnée", () => {
  const ctx = buildFilmographyContext("brad pitt", "Brad Pitt", [
    { title: "Fight Club", year: 1999, type: "movie", tmdbId: 550, inLibrary: true },
    { title: "Se7en", year: 1995, type: "movie", tmdbId: 807, inLibrary: false },
  ], 120);
  assert.ok(ctx.includes("RECHERCHE RÉELLE"));
  assert.ok(ctx.includes("Brad Pitt"));
  assert.ok(ctx.includes("Fight Club (1999)"));
  assert.ok(ctx.indexOf("Déjà dans ta bibliothèque") < ctx.indexOf("Fight Club"));
  assert.ok(ctx.indexOf("Pas dans ta bibliothèque") < ctx.indexOf("Se7en"));
  assert.ok(/plafonn[ée]e/i.test(ctx));
});

test("buildFilmographyContext: pas de troncature quand tous les crédits réels sont inclus", () => {
  const ctx = buildFilmographyContext("un acteur obscur", "Un Acteur Obscur", [
    { title: "Seul Film", year: 2010, type: "movie", tmdbId: 1, inLibrary: false },
  ], 1);
  assert.ok(!/plafonn[ée]e/i.test(ctx));
});

test("extractFacts: marqueur sur sa propre ligne, extrait et retiré", () => {
  const got = extractFacts("Ah super, Seb !\n[[FAIT: Prénom : Seb]]");
  assert.deepEqual(got.facts, ["Prénom : Seb"]);
  assert.equal(got.cleaned, "Ah super, Seb !");
});

test("extractFacts: marqueur collé en fin de phrase (pas sur sa propre ligne) — extrait quand même, pas de fuite visible", () => {
  const got = extractFacts("Tu as préféré lequel ? [[FAIT: prénom inconnu]]");
  assert.ok(!got.cleaned.includes("[[FAIT"));
});

test("extractFacts: un 'fait' qui note une ignorance (prénom inconnu) est filtré, jamais stocké", () => {
  const got = extractFacts("Je ne sais pas encore. [[FAIT: prénom inconnu]]");
  assert.deepEqual(got.facts, []);
  assert.ok(!got.cleaned.includes("[[FAIT"));
});

test("extractFacts: réponse composée uniquement de marqueurs => cleaned vide", () => {
  const got = extractFacts("[[FAIT: aime les comédies]]");
  assert.deepEqual(got.facts, ["aime les comédies"]);
  assert.equal(got.cleaned, "");
});

test("extractFacts: aucun marqueur => texte inchangé, aucun fait", () => {
  const got = extractFacts("Salut, comment ça va ?");
  assert.deepEqual(got.facts, []);
  assert.equal(got.cleaned, "Salut, comment ça va ?");
});

test("extractSelfIntroName: 'je m'appelle X'", () => {
  assert.equal(extractSelfIntroName("je m'appelle Seb"), "Prénom : Seb");
});

test("extractSelfIntroName: variantes (nomme, moi c'est, mon prénom, appelle-moi)", () => {
  assert.equal(extractSelfIntroName("je me nomme Léa"), "Prénom : Léa");
  assert.equal(extractSelfIntroName("moi c'est Max"), "Prénom : Max");
  assert.equal(extractSelfIntroName("mon prénom est Alex"), "Prénom : Alex");
  assert.equal(extractSelfIntroName("appelle-moi Théo"), "Prénom : Théo");
});

test("extractSelfIntroName: aucune intro => null", () => {
  assert.equal(extractSelfIntroName("tu as quoi comme bon film d'horreur ?"), null);
  assert.equal(extractSelfIntroName("donne mon nom"), null);
});

test("extractSelfIntroName: mot-piège capté par l'alternance mais rejeté (pas un prénom plausible)", () => {
  assert.equal(extractSelfIntroName("moi c'est cool"), null);
});

test("extractFacts: un vrai fait négatif n'est plus filtré à tort (audit #6 — 'n'a pas'/'pas encore' étaient trop larges)", () => {
  const disliked = extractFacts("[[FAIT: n'a pas aimé Interstellar]]");
  assert.deepEqual(disliked.facts, ["n'a pas aimé Interstellar"]);

  const noAccount = extractFacts("[[FAIT: n'a pas de compte Netflix]]");
  assert.deepEqual(noAccount.facts, ["n'a pas de compte Netflix"]);

  const notYetSeen = extractFacts("[[FAIT: pas encore vu la saison 2]]");
  assert.deepEqual(notYetSeen.facts, ["pas encore vu la saison 2"]);
});

test("extractFacts: un vrai marqueur d'ignorance reste filtré", () => {
  const got = extractFacts("[[FAIT: prénom inconnu]]");
  assert.deepEqual(got.facts, []);
});

test("extractWatched: parse titre + type, retire le marqueur du texte affiché", () => {
  const got = extractWatched("Ah cool, tu vas adorer la suite ! [[VU: The Batman|movie]]");
  assert.deepEqual(got.watched, [{ title: "The Batman", type: "movie" }]);
  assert.equal(got.cleaned, "Ah cool, tu vas adorer la suite !");
});

test("extractWatched: type absent ou invalide retombe sur movie par défaut", () => {
  const got = extractWatched("[[VU: Un titre sans type]]");
  assert.deepEqual(got.watched, [{ title: "Un titre sans type", type: "movie" }]);
});

test("extractWatched: series explicite reconnue", () => {
  const got = extractWatched("[[VU: The Boys|series]]");
  assert.deepEqual(got.watched, [{ title: "The Boys", type: "series" }]);
});

test("extractWatched: plafonné à 2 par réponse", () => {
  const got = extractWatched("[[VU: A|movie]] [[VU: B|movie]] [[VU: C|movie]]");
  assert.equal(got.watched.length, 2);
  assert.deepEqual(got.watched.map((w) => w.title), ["A", "B"]);
});

test("extractRatings: parse titre + type + étoiles, retire le marqueur du texte affiché", () => {
  const got = extractRatings("Ah génial, un classique ! [[NOTE: The Batman|movie|5]]");
  assert.deepEqual(got.ratings, [{ title: "The Batman", type: "movie", stars: 5, opinion: undefined }]);
  assert.equal(got.cleaned, "Ah génial, un classique !");
});

test("extractRatings: opinion optionnelle capturée", () => {
  const got = extractRatings("[[NOTE: The Boys|series|4|humour noir très apprécié]]");
  assert.deepEqual(got.ratings, [{ title: "The Boys", type: "series", stars: 4, opinion: "humour noir très apprécié" }]);
});

test("extractRatings: type absent ou invalide retombe sur movie par défaut", () => {
  const got = extractRatings("[[NOTE: Un titre sans type|x|3]]");
  assert.deepEqual(got.ratings, [{ title: "Un titre sans type", type: "movie", stars: 3, opinion: undefined }]);
});

test("extractRatings: étoiles hors 1-5 sont ignorées (marqueur retiré quand même)", () => {
  const got = extractRatings("[[NOTE: X|movie|8]]");
  assert.deepEqual(got.ratings, []);
  assert.equal(got.cleaned, "");
});

test("extractRatings: étoiles non numériques sont ignorées", () => {
  const got = extractRatings("[[NOTE: X|movie|beaucoup]]");
  assert.deepEqual(got.ratings, []);
});

test("extractRatings: plafonné à 2 par réponse", () => {
  const got = extractRatings("[[NOTE: A|movie|5]] [[NOTE: B|movie|4]] [[NOTE: C|movie|3]]");
  assert.equal(got.ratings.length, 2);
  assert.deepEqual(got.ratings.map((r) => r.title), ["A", "B"]);
});

test("extractBareTitleMention: un titre isolé sans question est reconnu", () => {
  assert.equal(extractBareTitleMention("zootopie 2"), "zootopie 2");
  assert.equal(extractBareTitleMention("Zootopia 2"), "Zootopia 2");
});

test("extractBareTitleMention: rejette le bavardage courant", () => {
  for (const m of ["salut", "bonjour", "merci", "ok", "cool", "ça va", "lol", "d'accord"]) {
    assert.equal(extractBareTitleMention(m), null, `"${m}" ne devrait pas être traité comme un titre`);
  }
});

test("extractBareTitleMention: rejette les questions (déjà couvertes par un autre détecteur)", () => {
  assert.equal(extractBareTitleMention("est-ce que j'ai Dune ?"), null);
});

test("extractBareTitleMention: rejette les phrases longues/construites", () => {
  assert.equal(extractBareTitleMention("j'ai regardé ce film hier soir avec des amis et c'était vraiment sympa"), null);
});

test("extractBareTitleMention: rejette un message trop long ou vide", () => {
  assert.equal(extractBareTitleMention(""), null);
  assert.equal(extractBareTitleMention("a".repeat(61)), null);
});

test("buildTitleMentionContext: titre non résolu renvoie le message d'absence de correspondance", () => {
  const ctx = buildTitleMentionContext("zzzzzznotreal", null, null, null);
  assert.ok(ctx.includes("aucune correspondance fiable trouvée"));
});

test("buildTitleMentionContext: combine présence/visionnage/note dans un seul bloc", () => {
  const resolved = { title: "Zootopia 2", year: 2025, type: "movie" as const, tmdbId: 123, overview: "", posterPath: null, rating: 7, inLibrary: true };
  const ctx = buildTitleMentionContext("zootopie 2", resolved, "watched", { rating: 5, source: "explicit" });
  assert.ok(ctx.includes("déjà dans la bibliothèque"));
  assert.ok(ctx.includes("déjà vu(e) en entier"));
  assert.ok(ctx.includes("noté(e) 5/5"));
});

test("buildTitleMentionContext: titre vu mais jamais noté encourage à demander l'avis", () => {
  const resolved = { title: "X", type: "movie" as const, tmdbId: 1, overview: "", posterPath: null, rating: 0, inLibrary: true };
  const ctx = buildTitleMentionContext("x", resolved, "watched", null);
  assert.ok(ctx.includes("jamais noté"));
  assert.ok(ctx.includes("occasion naturelle"));
});

test("isUnresolvedCheckPromise: vrai quand la réponse entière n'est qu'une promesse de vérification", () => {
  assert.ok(isUnresolvedCheckPromise("Tu as raison, je vais vérifier ça tout de suite !"));
  assert.ok(isUnresolvedCheckPromise("Laisse-moi regarder ça."));
});

test("isUnresolvedCheckPromise: faux quand la promesse fait partie d'une réponse substantielle", () => {
  assert.equal(isUnresolvedCheckPromise("Ouais, Zootopie 2 est déjà dans ta bibliothèque et tu l'as déjà vu, je vais vérifier si tu l'as noté aussi pour être sûr de bien comprendre ton avis complet dessus."), false);
});

test("isUnresolvedCheckPromise: faux sur une réponse normale sans promesse", () => {
  assert.equal(isUnresolvedCheckPromise("Ah cool, Zootopie 2 ! Tu l'as adoré ?"), false);
});

test("containsLeakedActionJson / sanitizeLeakedActionJson: détecte et retire un bloc JSON d'action qui aurait fuité", () => {
  const leaked = 'Voilà : {"action":"add_media","items":[{"title":"Zootopia 2","year":2025,"type":"movie"}]}';
  assert.ok(containsLeakedActionJson(leaked));
  assert.equal(sanitizeLeakedActionJson(leaked), "Voilà :");
});

test("containsLeakedActionJson: faux sur une réponse normale", () => {
  assert.equal(containsLeakedActionJson("Ah cool, Zootopie 2 ! Tu veux que je te le trouve ?"), false);
});

test("isEpisodeListRequest: reconnaît les formulations courantes", () => {
  assert.ok(isEpisodeListRequest("donne moi la liste des episodes"));
  assert.ok(isEpisodeListRequest("quels sont les épisodes ?"));
  assert.ok(isEpisodeListRequest("combien d'épisodes il y a ?"));
  assert.ok(isEpisodeListRequest("montre-moi les épisodes de cette saison"));
});

test("isEpisodeListRequest: ne se déclenche pas sur un message sans rapport", () => {
  assert.equal(isEpisodeListRequest("télécharge sakamoto days"), false);
  assert.equal(isEpisodeListRequest("recommande-moi un truc similaire"), false);
});

test("buildEpisodeListContext: liste réelle avec statut vu, jamais tronquée pour une petite série", () => {
  const series = {
    title: "Ma Série",
    seasons: [
      { seasonNumber: 1, episodes: [{ episodeNumber: 1, title: "Pilote" }, { episodeNumber: 2, title: "Suite" }] },
    ],
  };
  const ctx = buildEpisodeListContext(series, new Set(["1.1"]));
  assert.ok(ctx.includes("S1E1 — Pilote (vu)"));
  assert.ok(ctx.includes("S1E2 — Suite"));
  assert.ok(!ctx.includes("S1E2 — Suite (vu)"));
});

test("extractSelfIntroName: 'c'est Seb' sans 'moi' est maintenant reconnu (bug confirmé en direct)", () => {
  assert.equal(extractSelfIntroName("c'est Seb"), "Prénom : Seb");
});

test("extractNameFromDirectAnswer: réponse en un mot à la question du prénom posée par l'assistant", () => {
  const got = extractNameFromDirectAnswer("Au fait, comment tu t'appelles ?", "Seb");
  assert.equal(got, "Prénom : Seb");
});

test("extractNameFromDirectAnswer: ignore un mot isolé si l'assistant n'a PAS demandé le prénom juste avant", () => {
  const got = extractNameFromDirectAnswer("Tu as regardé quoi récemment ?", "Seb");
  assert.equal(got, null);
});

test("extractNameFromDirectAnswer: n'accepte pas une phrase complète comme réponse directe (déjà couvert par extractSelfIntroName si applicable)", () => {
  const got = extractNameFromDirectAnswer("Comment tu t'appelles ?", "je sais pas trop pourquoi tu demandes");
  assert.equal(got, null);
});

test("extractNameFromDirectAnswer: filtre les mots courants qui ne sont pas des prénoms", () => {
  const got = extractNameFromDirectAnswer("Comment tu t'appelles ?", "ok");
  assert.equal(got, null);
});

test("isDegenerateReply: vrai quand la réponse nettoyée est vide (uniquement des marqueurs)", () => {
  assert.equal(isDegenerateReply(""), true);
  assert.equal(isDegenerateReply("   "), true);
});

test("isDegenerateReply: faux dès qu'une vraie phrase reste après extraction", () => {
  assert.equal(isDegenerateReply("Ah super, Seb !"), false);
});

test("detectLibraryFalseNegativeCorrection: cas confirmé en direct (jeremy ferrari / duo impossible)", () => {
  const got = detectLibraryFalseNegativeCorrection(
    "D'après ton historique, tu n'as encore rien ajouté de Jeremy Ferrari dans ta bibliothèque Movviz.",
    "ben si, j'ai les duo impossible"
  );
  assert.equal(got, "ben si, j'ai les duo impossible");
});

test("detectLibraryFalseNegativeCorrection: reconnaît d'autres formulations de la même affirmation d'absence", () => {
  assert.ok(detectLibraryFalseNegativeCorrection("Les Duos Impossible n'est pas dans ta bibliothèque.", "mais si, je l'ai déjà"));
  assert.ok(detectLibraryFalseNegativeCorrection("Tu n'as jamais regardé ça.", "c'est faux"));
  assert.ok(detectLibraryFalseNegativeCorrection("Il te manque plusieurs films de lui.", "en fait si"));
});

test("detectLibraryFalseNegativeCorrection: ne se déclenche pas sans affirmation d'absence préalable", () => {
  assert.equal(detectLibraryFalseNegativeCorrection("Tu as regardé quoi récemment ?", "ben si, j'ai ça"), null);
});

test("detectLibraryFalseNegativeCorrection: ne se déclenche pas si le message suivant n'est pas une correction", () => {
  assert.equal(detectLibraryFalseNegativeCorrection("Tu n'as pas encore vu Anesthésie Générale.", "ok je vais regarder ça"), null);
});

test("detectLibraryFalseNegativeCorrection: ignore un message précédent qui n'est pas de l'assistant", () => {
  assert.equal(detectLibraryFalseNegativeCorrection(undefined, "ben si, je l'ai"), null);
});

test("extractMissingFromEntity: cas confirmé en direct (pokemon)", () => {
  assert.equal(extractMissingFromEntity("Il me manque quel film de pokemon"), "pokemon");
});

test("extractMissingFromEntity: reconnaît les formulations courantes", () => {
  assert.equal(extractMissingFromEntity("il me manque quoi comme film de star wars"), "star wars");
  assert.equal(extractMissingFromEntity("qu'est-ce qu'il me manque de harry potter"), "harry potter");
  assert.equal(extractMissingFromEntity("j'ai pas quoi comme film de jeremy ferrari"), "jeremy ferrari");
  assert.equal(extractMissingFromEntity("quels films de pokemon j'ai pas encore"), "pokemon");
});

test("extractMissingFromEntity: entité multi-mots, ponctuation finale retirée", () => {
  assert.equal(extractMissingFromEntity("il me manque quels films de fast and furious ?"), "fast and furious");
});

test("extractMissingFromEntity: ne se déclenche pas sur un message sans rapport", () => {
  assert.equal(extractMissingFromEntity("télécharge sakamoto days"), null);
  assert.equal(extractMissingFromEntity("recommande-moi un truc similaire"), null);
  assert.equal(extractMissingFromEntity("liste des épisodes de cette série"), null);
});

test("extractMissingFromEntity: pronom/filler capté par l'alternance mais rejeté (pas une entité exploitable)", () => {
  assert.equal(extractMissingFromEntity("il me manque quoi de lui"), null);
});

test("buildMissingFromFranchiseContext: sépare bibliothèque / pas bibliothèque, jamais présenté comme exhaustif", () => {
  const ctx = buildMissingFromFranchiseContext("pokemon", [
    { title: "Pokémon, le film", year: 1998, type: "movie", tmdbId: 1, inLibrary: true },
    { title: "Pokémon Détective Pikachu", year: 2019, type: "movie", tmdbId: 2, inLibrary: false },
  ]);
  assert.ok(ctx.includes("RECHERCHE RÉELLE"));
  assert.ok(ctx.includes("Pokémon, le film (1998) [film, tmdb:1]"));
  assert.ok(ctx.includes("Pokémon Détective Pikachu (2019) [film, tmdb:2]"));
  assert.ok(ctx.indexOf("Déjà dans ta bibliothèque") < ctx.indexOf("Pokémon, le film"));
  assert.ok(ctx.indexOf("Pas dans ta bibliothèque") < ctx.indexOf("Pokémon Détective Pikachu"));
  assert.ok(/pas forc[ée]ment exhaustif/i.test(ctx));
});

test("buildMissingFromFranchiseContext: liste vide d'un côté annoncée explicitement, jamais silencieuse", () => {
  const ctx = buildMissingFromFranchiseContext("pokemon", [
    { title: "Pokémon Détective Pikachu", year: 2019, type: "movie", tmdbId: 2, inLibrary: false },
  ]);
  assert.ok(ctx.includes("Déjà dans ta bibliothèque : aucun parmi ces résultats"));
});

// --- Item 1 : présence en bibliothèque ---------------------------------

test("extractLibraryPresenceQuestion: cas confirmé (exemple flagship user)", () => {
  assert.equal(extractLibraryPresenceQuestion("Est-ce que j'ai Alien ?"), "Alien");
});

test("extractLibraryPresenceQuestion: variantes reconnues", () => {
  assert.equal(extractLibraryPresenceQuestion("j'ai déjà Dune ?"), "Dune");
  assert.equal(extractLibraryPresenceQuestion("est-ce que je possède Interstellar"), "Interstellar");
  assert.equal(extractLibraryPresenceQuestion("je possède The Batman ?"), "The Batman");
});

test("extractLibraryPresenceQuestion: ne se déclenche pas sur une simple affirmation ('j'ai adoré X') sans marqueur de question", () => {
  assert.equal(extractLibraryPresenceQuestion("j'ai adoré Interstellar."), null);
  assert.equal(extractLibraryPresenceQuestion("j'ai fini la saison 2 hier soir"), null);
});

test("extractLibraryPresenceQuestion: ne se déclenche jamais sur la forme 'j'ai vu X' (c'est le statut de visionnage, pas la possession)", () => {
  assert.equal(extractLibraryPresenceQuestion("est-ce que j'ai vu Alien ?"), null);
  assert.equal(extractLibraryPresenceQuestion("j'ai déjà vu Dune ?"), null);
});

test("extractLibraryPresenceQuestion: rejette un pronom capté sans intérêt comme titre", () => {
  assert.equal(extractLibraryPresenceQuestion("j'ai ça ?"), null);
});

test("buildLibraryPresenceContext: résolution réussie, présent en bibliothèque", () => {
  const ctx = buildLibraryPresenceContext("Alien", { title: "Alien", year: 1979, type: "movie", tmdbId: 348, overview: "", posterPath: null, rating: 8, inLibrary: true });
  assert.ok(ctx.includes("VÉRIFICATION RÉELLE"));
  assert.ok(ctx.includes("Alien (1979)"));
  assert.ok(ctx.includes("OUI, déjà dans la bibliothèque"));
});

test("buildLibraryPresenceContext: résolution réussie, absent de la bibliothèque", () => {
  const ctx = buildLibraryPresenceContext("Alien", { title: "Alien", year: 1979, type: "movie", tmdbId: 348, overview: "", posterPath: null, rating: 8, inLibrary: false });
  assert.ok(ctx.includes("NON, pas dans la bibliothèque"));
});

test("buildLibraryPresenceContext: pas de correspondance fiable, honnête plutôt que silencieux", () => {
  const ctx = buildLibraryPresenceContext("Un Titre Bidon Introuvable", null);
  assert.ok(ctx.includes("aucune correspondance fiable trouvée"));
});

// --- Item 2 : statut de visionnage ---------------------------------------

test("extractWatchStatusQuestion: variantes reconnues", () => {
  assert.equal(extractWatchStatusQuestion("est-ce que j'ai vu Alien ?"), "Alien");
  assert.equal(extractWatchStatusQuestion("j'ai déjà vu Dune ?"), "Dune");
  assert.equal(extractWatchStatusQuestion("j'ai regardé The Boys ?"), "The Boys");
});

test("extractWatchStatusQuestion: ne se déclenche pas sur une affirmation sans question ('j'ai vu X hier')", () => {
  assert.equal(extractWatchStatusQuestion("j'ai vu Alien hier soir, c'était nul"), null);
});

test("buildWatchStatusContext: vu en entier, avec date relative", () => {
  const ctx = buildWatchStatusContext("Alien", { title: "Alien", year: 1979, type: "movie", tmdbId: 348 }, "watched", Date.now());
  assert.ok(ctx.includes("OUI, déjà vu(e) en entier"));
  assert.ok(ctx.includes("aujourd'hui"));
});

test("buildWatchStatusContext: série partiellement vue, distincte de 'vue en entier'", () => {
  const ctx = buildWatchStatusContext("The Boys", { title: "The Boys", type: "series", tmdbId: 76479 }, "partially_watched");
  assert.ok(ctx.includes("PARTIELLEMENT vu(e)"));
});

test("buildWatchStatusContext: pas de correspondance fiable, honnête plutôt que silencieux", () => {
  const ctx = buildWatchStatusContext("Titre Introuvable", null, null);
  assert.ok(ctx.includes("aucune correspondance fiable trouvée"));
});

// --- Item 3 : casting / équipe --------------------------------------------

test("extractCastCrewQuestion: variantes reconnues", () => {
  assert.equal(extractCastCrewQuestion("qui joue dans Alien ?"), "Alien");
  assert.equal(extractCastCrewQuestion("qui a réalisé Dune ?"), "Dune");
  assert.equal(extractCastCrewQuestion("qui est le réalisateur de Dune ?"), "Dune");
  assert.equal(extractCastCrewQuestion("qui réalise Oppenheimer"), "Oppenheimer");
});

test("extractCastCrewQuestion: ne se déclenche pas sur un message sans rapport", () => {
  assert.equal(extractCastCrewQuestion("télécharge sakamoto days"), null);
});

test("buildCastCrewContext: réalisateur + top acteurs formatés, jamais plus de 8 acteurs", () => {
  const cast = Array.from({ length: 12 }, (_, i) => ({ name: `Acteur ${i}`, character: `Perso ${i}` }));
  const ctx = buildCastCrewContext("Dune", { title: "Dune", year: 2021, type: "movie", tmdbId: 438631 }, cast, [{ name: "Denis Villeneuve", job: "Director" }]);
  assert.ok(ctx.includes("Denis Villeneuve"));
  assert.ok(ctx.includes("Acteur 0 (Perso 0)"));
  assert.ok(!ctx.includes("Acteur 8"));
});

test("buildCastCrewContext: pas de correspondance fiable, honnête plutôt que silencieux", () => {
  const ctx = buildCastCrewContext("Titre Introuvable", null, [], []);
  assert.ok(ctx.includes("aucune correspondance fiable trouvée"));
});

// --- Item 4 : statut de production ----------------------------------------

test("extractSeriesStatusQuestion: variantes reconnues avec titre explicite", () => {
  assert.equal(extractSeriesStatusQuestion("est-ce que Breaking Bad est fini ?"), "Breaking Bad");
  assert.equal(extractSeriesStatusQuestion("Dune est-il terminé ?"), "Dune");
});

test("extractSeriesStatusQuestion: ne capture jamais 'cette série'/'ce film' comme un vrai titre (géré séparément)", () => {
  assert.equal(extractSeriesStatusQuestion("cette série est-elle terminée ?"), null);
  assert.equal(extractSeriesStatusQuestion("est-ce que ce film est fini ?"), null);
});

test("isSeriesStatusAboutCurrentPage: reconnaît la forme implicite", () => {
  assert.ok(isSeriesStatusAboutCurrentPage("cette série est-elle terminée ?"));
  assert.ok(isSeriesStatusAboutCurrentPage("est-ce que ce film est fini ?"));
});

test("isSeriesStatusAboutCurrentPage: ne se déclenche pas sur une phrase générique sans référence claire à une série/un film", () => {
  assert.equal(isSeriesStatusAboutCurrentPage("c'est fini entre nous"), false);
  assert.equal(isSeriesStatusAboutCurrentPage("télécharge sakamoto days"), false);
});

test("buildTitleStatusContext: statut réel injecté tel quel (déjà traduit par l'appelant)", () => {
  const ctx = buildTitleStatusContext("Breaking Bad", { title: "Breaking Bad", type: "series", tmdbId: 1396 }, "Terminée");
  assert.ok(ctx.includes("Terminée"));
});

test("buildTitleStatusContext: pas de correspondance fiable, honnête plutôt que silencieux", () => {
  const ctx = buildTitleStatusContext("Titre Introuvable", null, null);
  assert.ok(ctx.includes("aucune correspondance fiable trouvée"));
});