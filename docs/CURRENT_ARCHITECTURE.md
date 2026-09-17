# Architecture actuelle du moteur de recommandations (audit Phase 1)

> Document de travail interne, produit avant la refonte du moteur « Pour vous ».
> Audité sur `main` à partir du commit `e3576187` (v1.25.19).

## 1. Route principale

`src/app/api/metadata/recommendations/route.ts` — 14 lignes, délègue entièrement à
`getRecommendations(userId, type)` (`src/lib/recommender/engine.ts`). Un seul paramètre
de requête (`type=movie|series`), aucune pagination, aucun paramètre de région.

## 2. `recommender/engine.ts` — moteur général « Pour vous »

- **Seeds** : tous les titres vus (`getWatchStatus`), plafonnés à 25, **sans aucune
  pondération qualité** (un titre juste vu pèse autant qu'un 5★). Confirme le
  problème #1 du plan (seeds non qualifiés).
- **Exclusions** : owned ∪ watched ∪ disliked (`getFeedback`).
- **Candidats** : pour chaque seed, appel concurrent (limite 5) à la fois à
  `/recommendations` ET `/similar` TMDb (`getMovieRecommendations`/`getMovieSimilar`
  et équivalents séries) — les deux sources sont déjà mélangées dans la même boucle
  de comptage.
- **Consensus multi-seed déjà existant** : `Map<tmdbId, {item, count}>`, un candidat
  vu par plusieurs seeds/endpoints a un `count` plus élevé → `count/maxCount` pèse
  20 % du score final. C'est un embryon de consensus, mais noyé dans une formule à
  7 termes dont l'audience TMDb pèse le plus (25 %).
- **Injection acteurs/réalisateurs favoris** directement dans la même map de
  candidats (`getFavoritePeople` → filmographie complète via `getPerson`).
- **Score composite final** (7 termes, aucun n'a de poids dominant clair) :
  `count/maxCount×0.2 + genreAffinity×0.14 + keywordAffinity×0.16 + personScore×0.1
  + tasteVector×0.15 + audienceSignal×0.25 + rating×0.1`.
- **Aucun appel IA bloquant** : `buildTasteVector` ne lit que le cache, jamais
  d'analyse à la volée.

## 3. `recommender/providerPersonalized.ts` — rails provider (Netflix/Disney+/Prime)

- Sépare bien « Nouveautés » (tri chronologique pur, sans scoring) et « Suggestions »
  (pool partagé multi-utilisateurs par `type:providerId:pays`, réutilise
  `getCache()` du registre commun).
- Réutilise directement les primitives de `userContext/taste.ts`
  (`buildTasteVector`, `getComputedGenreTraits`/`matchGenreAffinity`,
  `getFavoriteKeywords`/`matchKeywordAffinity`, `audienceSignal`).
- Score composite distinct (pas de terme de récence, volontairement).
- Enrichissement mood IA optionnel, budgété à 4s via `Promise.race`, jamais bloquant,
  continue en arrière-plan pour réchauffer le cache.
- **Le pool provider est bien une simple contrainte de catalogue, pas un moteur de
  goût parallèle** — bon point à préserver tel quel.

## 4. `recommender/becauseYouWatched.ts`

**Confirme le problème #2 du plan : logique de scoring réellement distincte de
`engine.ts`**, pas juste une politique de seed contrainte sur le même moteur :
- Ancre unique (le titre le plus engagé : rating explicite ≥4 > vu récemment > vu
  en dernier), pas un blend multi-seed.
- Candidats : uniquement `/recommendations` sur l'ancre (pas de `/similar`, pas
  d'injection acteurs/réalisateurs).
- Formule à 4 termes, différente de celle d'`engine.ts` (rating, audience, keyword
  affinity, taste vector général + mood similarity spécifique à l'ancre).

## 5. `dashboard/suggestionEngine.ts` — Hero

**Confirme le problème #7.1 du plan : duplication réelle de la couche de goût.**
Construit son propre `TasteProfile` local (comptage brut de genres/réalisateurs/
acteurs sur un échantillon de 12 titres vus), **sans jamais appeler**
`getComputedGenreTraits`, `matchGenreAffinity`, `getFavoritePeople` ni aucune
fonction de `userContext/taste.ts`. Le seul point de contact avec le moteur commun
est l'utilisation de `getRecommendations()` comme une des pools d'entrée
(`personalized`). Son propre système de reasons (clés i18n) et son shuffle
journalier déterministe (mulberry32) sont légitimes et à préserver — seule la
couche de scoring/goût doit converger.

## 6. `userContext/taste.ts` — couche de goût canonique

Confirmée comme réellement canonique et déjà consommée par 3-4 endroits distincts
(`engine.ts`, `providerPersonalized.ts`, partiellement `becauseYouWatched.ts`,
`ai/recommendationScore.ts` pour le chat IA). Hero est le seul consommateur qui
l'ignore totalement.

Fonctions clés exportées : `matchGenreAffinity`, `getComputedGenreTraits`,
`getFavoritePeople`/`computeFavoritePeople`, `getFavoriteKeywords`/
`matchKeywordAffinity`, `getComputedKeywordTraits`, `getComputedPersonTraits`,
`getBanterTraits`, `formatTasteEvidenceContext`.

Règles déjà en place à préserver :
- absence de preuve ≠ preuve de désintérêt (les traits genre ne descendent jamais
  sous zéro faute de données) ;
- affinité personne : un sentiment net négatif exclut la personne (règle dure, pas
  une simple pénalité) ;
- poids des demandes de téléchargement plafonné à +0.1 (signal jugé peu fiable) ;
- seuil `evidenceCount ≥ 4` avant qu'un trait de genre existe.

Reste de `userContext/` (database/history/ingest/knowledge/preferences/query/
reconcile/syncState/watchBridge/types) : couche d'infrastructure du Context Engine
(SQLite, ledger append-only, LWW reconciliation multi-source Plex). Ne pas toucher
dans le cadre de cette refonte — c'est déjà la bonne fondation.

## 7. Fiche média — `detail.similar`

**Confirme le problème central du plan (section 5)** :
`src/lib/metadata/tmdb.ts` `getDetail()` construit `detail.similar` à partir de
`data.recommendations.results` (TMDb `/recommendations`), **pas** de `/similar`.
Le vrai endpoint `/similar` (`getMovieSimilar`/`getTvSimilar`) n'est utilisé nulle
part dans la fiche — uniquement dans la boucle de consensus d'`engine.ts`.

## 8. Frontière IA

`getRecommendations()` (engine.ts) ne déclenche jamais d'appel IA/LLM bloquant.
Les deux seuls points d'enrichissement IA optionnel sont `providerPersonalized.ts`
et `becauseYouWatched.ts`, tous deux gated par `loadAiConfig().enabled`, budgétés
à 4s, non bloquants, avec poursuite en arrière-plan pour réchauffer le cache.
`ai/recommendationScore.ts` est un scorer complètement séparé, utilisé uniquement
par le chat IA — jamais par le moteur de recommandations principal.

**Conclusion : la règle 2.4 du plan (aucun LLM requis) est déjà respectée
aujourd'hui pour le moteur général.** Le travail de la phase IA Boundary Guard sera
surtout de documenter cet état, pas de le corriger.

## 9. Bug région confirmé

`src/lib/metadata/tmdb.ts` :
- ligne 714 : `discoverByFilters()` force `watch_region = "FR"` dès qu'un
  `watchProvider` est fourni ;
- ligne ~1375-1379, 1401, 1498 : plusieurs autres lectures hardcodées de `"FR"`
  (watch providers d'un titre, liste des providers, recherche du provider FR).

**Aucun mécanisme de région utilisateur/compte n'existe nulle part** dans
`userContext/` ni `settings/` — ce n'est pas un gap partiellement comblé, il est
entièrement à construire.

Appelants impactés transitivement : `providerPersonalized.ts` (nouveautés +
pool suggestions), routes `discover`, `rows`, `row-page`, `logos`, et les
composants client associés.

## 10. Infrastructure cache/concurrence réutilisable

- `cache/registry.ts` (`getCache`) : cache TTL en mémoire + persistance disque
  optionnelle, stale-while-revalidate via `getStale()`, déjà utilisé par le pool
  provider — **directement réutilisable pour un cache de relations titre→titre**.
- `fsJsonCache.ts` : `memoizeByFileMtimesAsync`/`memoInFlightAsync` fournissent déjà
  un mécanisme single-flight pour éviter les appels TMDb dupliqués concurrents.
- `concurrency.ts` (`mapWithConcurrency`) : limiteur de concurrence déjà utilisé
  partout dans le recommender (3-5 en parallèle) comme budget de facto.

## 11. Tests existants pertinents

`because-you-watched.test.ts`, `contrastive-profile.test.ts`,
`provider-pool-cache.test.ts`, `recommendation-score.test.ts`,
`audience-signal.test.ts`, `user-context*.test.ts`, `user-preferences.test.ts`,
`genre-taxonomy.test.ts`, `suggestable.test.ts`.

**Gap confirmé** : aucun test dédié pour `engine.ts` (`getRecommendations`), le
scoring de `providerPersonalized.ts`, `dashboard/suggestionEngine.ts`, ni pour les
fonctions de `userContext/taste.ts` elles-mêmes. À combler en Phase 2-4.

## 12. Clients Android (Mobile NX / TV NX)

Confirmé : aucun ranking dupliqué côté Kotlin. `MovvizRepository.kt` fait du simple
passthrough (`safeCall { api.X(...) }`), aucun `.sortedBy`/`.sortWith` trouvé. Le
commentaire Kotlin sur `metadataRecommendations` documente explicitement que les
clients filtrent seulement contre la bibliothèque locale, sans jamais mélanger
d'œuvres externes. Le contrat `GET api/metadata/recommendations?type=` est
consommé tel quel — toute évolution doit rester additive/nullable côté DTO.

## 13. Points de duplication confirmés à consolider (priorité refonte)

1. `engine.ts` vs `becauseYouWatched.ts` — deux formules de scoring distinctes,
   candidat à une extraction de scorer commun avec politique de seed différente.
2. `dashboard/suggestionEngine.ts` — couche de goût dupliquée (genre/directeur/
   acteur en comptage brut), à faire converger vers `userContext/taste.ts` sans
   casser ses pools/reasons/shuffle spécifiques.
3. Hardcode région `"FR"` dans `tmdb.ts` (4 emplacements) — aucun mécanisme de
   remplacement existant, à construire de zéro.
4. Aucun cache partagé pour les relations titre→titre (`/recommendations` et
   `/similar` par seed) — actuellement re-fetchées à chaque appel utilisateur ;
   candidat naturel pour `cache/registry.ts`.

## 14. Ce qu'il ne faut surtout pas casser

- Le contrat `GET /api/metadata/recommendations?type=` (forme `{results: [...]}`).
- Le split Nouveautés/Suggestions provider et son cache partagé multi-utilisateurs.
- Le budget IA non bloquant (4s, `Promise.race`, warm cache en arrière-plan) dans
  `providerPersonalized.ts` et `becauseYouWatched.ts`.
- Les règles de goût déjà correctes dans `userContext/taste.ts` (absence de preuve
  ≠ désintérêt, exclusion dure sur sentiment négatif net, plafond des demandes).
- Le passthrough Android (aucun ranking Kotlin à introduire).
