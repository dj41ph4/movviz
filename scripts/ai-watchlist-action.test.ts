import test from "node:test";
import assert from "node:assert/strict";
import { asksToAddToWatchlist, pickShownCards, watchlistReply } from "@/lib/ai/watchlistAction";
import type { AiRecommendation } from "@/lib/ai/types";

test("« ajoute à ma liste » est une demande pour la liste de l'utilisateur", () => {
  for (const m of ["ajoute à ma liste", "ajoute Le Daim à ma liste", "mets-les dans ma watchlist", "rajoute le deuxième dans ma liste", "garde-le dans ma liste", "ajoute ça à ma watchlist", "mets le dans mes favoris"]) {
    assert.equal(asksToAddToWatchlist(m), true, m);
  }
});

test("une demande de liste de films ou un téléchargement ne passe jamais par Ma liste", () => {
  for (const m of ["fais moi une liste clicable de 3 film des dupieux", "ajoute Le Daim", "télécharge les 3", "montre-moi ma liste", "c'est quoi ma liste ?"]) {
    assert.equal(asksToAddToWatchlist(m), false, m);
  }
});

const card = (tmdbId: number, title: string): AiRecommendation => ({ title, type: "movie", tmdbId, overview: "", posterPath: null, rating: 7, inLibrary: false });
const shown = [card(1, "Le Daim"), card(2, "Mandibules"), card(3, "Yannick"), card(4, "Rubber")];

test("les cartes visées : un titre nommé, un rang, les N premiers, ou toutes", () => {
  assert.deepEqual(pickShownCards("ajoute mandibules à ma liste", shown).map((c) => c.tmdbId), [2]);
  assert.deepEqual(pickShownCards("mets le deuxième dans ma liste", shown).map((c) => c.tmdbId), [2]);
  assert.deepEqual(pickShownCards("ajoute le dernier à ma liste", shown).map((c) => c.tmdbId), [4]);
  assert.deepEqual(pickShownCards("ajoute les 3 premiers à ma liste", shown).map((c) => c.tmdbId), [1, 2, 3]);
  assert.deepEqual(pickShownCards("ajoute les 2 à ma liste", shown).map((c) => c.tmdbId), [1, 2]);
  assert.deepEqual(pickShownCards("ajoute-les à ma liste", shown).map((c) => c.tmdbId), [1, 2, 3, 4]);
  assert.deepEqual(pickShownCards("ajoute tous à ma liste", shown).map((c) => c.tmdbId), [1, 2, 3, 4]);
  assert.deepEqual(pickShownCards("ajoute à ma liste", shown), []);
});

test("la réponse dit ce qui est vraiment dans la liste", () => {
  assert.equal(watchlistReply([{ title: "Le Daim", year: 2019 }]), "C'est dans ta liste ✅ Le Daim (2019) t'attend pour plus tard.");
  assert.equal(watchlistReply([{ title: "Le Daim" }, { title: "Rubber", year: 2010 }]), "C'est dans ta liste ✅ Le Daim, Rubber (2010).");
  assert.match(watchlistReply([]), /Dis-moi lequel/);
});

test("« ajoute le deuxième à ma liste » vise une carte, jamais toute une filmographie", async () => {
  const { extractPersonListFollowUp } = await import("@/lib/ai/personList");
  for (const m of ["ajoute le deuxième à ma liste", "mets-les dans ma liste", "ajoute ça à ma watchlist", "ajoute ses films à ma liste"]) {
    assert.equal(extractPersonListFollowUp(m), null, m);
  }
  const previous = [card(10, "Yannick"), card(11, "Réalité"), card(12, "Au poste !")];
  assert.deepEqual(pickShownCards("ajoute le deuxième à ma liste", previous).map((c) => c.title), ["Réalité"]);
});
