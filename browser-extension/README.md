# Movviz Companion

Extension navigateur (Chrome, Edge, Brave) qui ajoute un bouton Movviz sur les
sites de cinéma : un clic pour demander un film ou une série, avec le statut en
direct (en attente, en cours, disponible).

Sites pris en charge : TMDb, IMDb, AlloCiné, SensCritique, TheTVDB, Letterboxd,
Rotten Tomatoes, JustWatch, Trakt, Taste.

## Installation

1. Ouvrir `chrome://extensions` et activer le **mode développeur**.
2. **Charger l'extension non empaquetée** et choisir ce dossier `browser-extension`.
3. La page d'options s'ouvre : renseigner l'adresse du serveur Movviz et un jeton.

## Jeton

Dans Movviz : **Profil, Jetons API**, créer un jeton (`mvz_…`) et le coller dans
les options. Le jeton hérite des droits de ton compte : une demande est
approuvée tout de suite pour un administrateur ou un utilisateur en
approbation automatique, sinon elle attend dans la page Demandes.

## Côté serveur

Trois routes dédiées, authentifiées uniquement par le jeton (en-tête Bearer) :
`GET /api/extension/me`, `GET /api/extension/lookup`, `POST /api/extension/request`.

## Langues

Les textes sont dans `_locales/` (fr, en, it, nl, de), générés par
`node browser-extension/scripts/gen-locales.mjs`.
