<div align="center">

# Movviz

**Le centre de commande unique pour tes films et séries — découverte, recherche, téléchargement et bibliothèque, sans jongler entre dix outils différents.**

[![Licence](https://img.shields.io/badge/licence-GPL--3.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org)

</div>

---

## Le problème que Movviz résout

Gérer une médiathèque personnelle demande normalement d'empiler plusieurs outils : un pour découvrir les nouveautés, un pour chercher les releases, un pour piloter les téléchargements, un pour organiser la bibliothèque, un pour gérer les demandes de la famille, un pour synchroniser avec le lecteur média. Chacun avec sa propre interface, son propre login, sa propre config.

**Movviz réunit tout ça dans une seule application**, avec une interface cinématographique cohérente du début à la fin. Un seul endroit où découvrir un film, l'ajouter, suivre son téléchargement, et le retrouver dans la bibliothèque — sans changer d'onglet.

Auto-hébergé, sans dépendance à un service tiers payant, et développé en code 100 % original.

## Ce que Movviz fait concrètement

**Découverte** — Parcourt les tendances, les nouveautés, les box-offices et les classements réels d'allociné.fr (pas juste les API génériques), filtrable par genre, année, studio, plateforme de diffusion ou continent d'origine. Un clic ajoute le titre et lance automatiquement la recherche de la meilleure release.

**Recherche & téléchargement** — Interroge tous tes indexeurs torrent/usenet (protocole Torznab/Newznab) en une seule requête, note chaque résultat selon la qualité, la fraîcheur et la santé des seeds, et pilote le téléchargement via un moteur BitTorrent maison intégré — pas de client externe à configurer.

**Bibliothèque unifiée** — Films et séries dans une seule vue, avec suivi des épisodes manquants, renommage automatique des fichiers selon tes propres modèles, réconciliation avec le disque, et intégration Plex (statut de lecture, lien "Lire sur Plex" direct).

**Demandes multi-utilisateurs** — Chaque membre du foyer peut demander un titre ; un administrateur approuve (ou l'auto-approbation s'en charge), avec quotas par utilisateur et délégation d'approbation possible sans donner les pleins droits admin.

**Automatisation** — Scan quotidien des flux RSS des indexeurs, upgrade automatique de qualité quand une meilleure release apparaît, synchronisation Plex incrémentale, notifications (Discord, Telegram, Slack, Gotify, Pushbullet).

**5 langues d'interface** — Français, anglais, italien, néerlandais, allemand, choisies dès la première configuration ou changeables à tout moment.

## Aperçu des modules

| Module | Rôle |
| --- | --- |
| **Tableau de bord** | Vue d'ensemble : statistiques, file de téléchargement, activité en direct |
| **Découverte** | Parcourir, filtrer et ajouter des titres |
| **Recherche** | Recherche interactive sur tous les indexeurs, releases notées |
| **Bibliothèque** | Films & séries unifiés, épisodes manquants, renommage auto |
| **Demandes** | File d'approbation multi-utilisateurs avec quotas |
| **Réglages** | Indexeurs, clients de téléchargement, profils de qualité, notifications — tout centralisé |

## Stack technique

- **Next.js 15** (App Router, composants serveur + routes API)
- **TypeScript** strict de bout en bout
- **Tailwind CSS v4** (design tokens `@theme`)
- **Framer Motion** pour la couche d'animation
- **Moteur de téléchargement maison** (service Node.js dédié, isolé de l'app web)
- **i18n maison** — aucune chaîne en dur, 5 langues, ajouter une langue = ajouter un fichier

## Déploiement

Movviz tourne à partir du même code sur trois cibles :

| Cible | Dossier | Démarrage |
| --- | --- | --- |
| Windows x64 | `packaging/windows/` | Service Windows (installeur multilingue, démarrage auto au boot) |
| Linux x64 | `packaging/linux/` | Unité systemd (démarrage auto au boot) |
| NAS / Docker | `packaging/docker/` | Conteneur (`restart: unless-stopped`) |

Voir [`packaging/README.md`](packaging/README.md) pour les instructions détaillées de chaque cible.

### Démarrage rapide (développement)

```bash
npm install
npm run dev
# http://localhost:9810
```

## Architecture

```
src/
  app/            # routes (tableau de bord + sections) + /api
  components/     # UI par domaine (layout, media, settings, discover…)
  i18n/           # dictionnaires (5 langues) + provider + hook de traduction
  lib/            # logique métier : indexeurs, bibliothèque, moteur, Plex…
engine/           # moteur de téléchargement BitTorrent, service Node.js isolé
packaging/        # installeurs Windows / Linux / Docker
```

L'interface est découplée des données : chaque écran lit des modèles typés depuis `src/lib`, ce qui garde la logique métier indépendante de la présentation.

## Guides d'utilisation

| Langue | Guide |
| --- | --- |
| Français | [`docs/guide-fr.md`](docs/guide-fr.md) |
| English | [`docs/guide-en.md`](docs/guide-en.md) |
| Deutsch | [`docs/guide-de.md`](docs/guide-de.md) |
| Italiano | [`docs/guide-it.md`](docs/guide-it.md) |
| Nederlands | [`docs/guide-nl.md`](docs/guide-nl.md) |

## Licence

Movviz est un logiciel libre distribué sous licence [GPL-3.0](LICENSE) : librement modifiable et redistribuable, à condition que les versions dérivées restent elles aussi open-source.

## Soutenir le projet

Movviz est gratuit et le restera. Si l'application te rend service, un don via [GitHub Sponsors](https://github.com/sponsors/dj41ph4) est toujours apprécié.
