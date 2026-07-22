<div align="center">

# Movviz

### Centre de commande unifié pour médiathèques personnelles

**Découvrir, organiser, suivre et gérer — depuis une interface unique, self-hostée et open-source.**

[![Licence](https://img.shields.io/badge/Licence-GPL--3.0-3da639.svg?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000.svg?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com)
[![Plex](https://img.shields.io/badge/Plex-int%C3%A9gr%C3%A9-E5A00D.svg?style=flat-square&logo=plex)](https://www.plex.tv)
[![i18n](https://img.shields.io/badge/langues-5-43b02a.svg?style=flat-square)](#guides-dutilisation)

</div>

---

## Fonctionnalités

<table>
<tr>
<td width="50%" valign="top">

**Découverte** — Parcourir les tendances, nouveautés et classements. Filtres par genre, année, studio, plateforme. Ajout en un clic.

**Recherche unifiée** — Interroger tous les indexeurs Torznab en une requête. Résultats notés par qualité, fraîcheur et santé des seeds. Moteur BitTorrent intégré.

**Bibliothèque** — Films et séries dans une vue unifiée. Suivi des épisodes manquants, renommage automatique, réconciliation disque, intégration Plex.

</td>
<td width="50%" valign="top">

**Demandes multi-utilisateurs** — Chaque membre peut soumettre un titre. Approbation par un administrateur, quotas et délégation configurables.

**Automatisation** — Scan RSS quotidien, upgrade automatique de qualité, synchronisation Plex incrémentale, notifications (Discord, Telegram, Slack, Gotify, Pushbullet).

**Multilingue** — Français, anglais, allemand, italien, néerlandais. Configurable à l'installation et modifiable à tout moment.

</td>
</tr>
</table>

---

## Architecture

| Module | Rôle |
| :--- | --- |
| **Tableau de bord** | Statistiques, téléchargements en cours, activité en direct |
| **Découverte** | Parcourir, filtrer, ajouter des titres |
| **Recherche** | Interrogation multi-indexeur avec notation des releases |
| **Bibliothèque** | Films, séries, épisodes manquants, renommage |
| **Demandes** | Approbation multi-utilisateurs avec quotas |
| **Réglages** | Indexeurs, moteur, profils de qualité, notifications |

---

## Stack

| Technologie | Utilisation |
| :--- | --- |
| **Next.js 15** | App Router, composants serveur, routes API |
| **TypeScript** | Typage strict de bout en bout |
| **Tailwind CSS v4** | Design tokens via `@theme` |
| **Framer Motion** | Animations d'interface |
| **Node.js** | Moteur BitTorrent dédié, isolé de l'application |
| **i18n custom** | 5 langues, aucune chaîne en dur |

---

## Déploiement

| Cible | Emplacement | Démarrage |
| :---: | --- | --- |
| **Windows** | `packaging/windows/` | Service Windows, installeur multilingue |
| **Linux** | `packaging/linux/` | Unité systemd |
| **Docker** | `packaging/docker/` | Conteneur `restart: unless-stopped` |

```bash
git clone https://github.com/dj41ph4/movviz.git
cd movviz
npm install
npm run dev
# http://localhost:9810
```

---

## Structure

```
src/
  app/          routes et API
  components/   UI par domaine
  i18n/         dictionnaires et hook de traduction
  lib/          logique métier : indexeurs, bibliothèque, moteur, Plex
engine/         moteur BitTorrent (service Node.js isolé)
resolver/       résolveur Cloudflare (port 9830)
packaging/      installeurs Windows, Linux, Docker
```

---

## Guides

| Langue | Document |
| :---: | --- |
| Français | [`docs/guide-fr.md`](docs/guide-fr.md) |
| English | [`docs/guide-en.md`](docs/guide-en.md) |
| Deutsch | [`docs/guide-de.md`](docs/guide-de.md) |
| Italiano | [`docs/guide-it.md`](docs/guide-it.md) |
| Nederlands | [`docs/guide-nl.md`](docs/guide-nl.md) |

---

## Licence

[GPL-3.0](LICENSE) — Librement modifiable et redistribuable, sous condition que les versions dérivées restent open-source.

<div align="center">

Movviz — Un seul endroit pour tout gérer.

</div>
