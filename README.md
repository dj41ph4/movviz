<div align="center">

# Movviz

### Le centre de commande unifié pour tes films et séries

**Découvrir, organiser, suivre et gérer — tout depuis une seule interface, self-hosted et open-source.**

[![Licence](https://img.shields.io/badge/licence-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-strict-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com)
[![Plex](https://img.shields.io/badge/Plex-intégré-E5A00D.svg?style=flat-square&logo=plex)](https://www.plex.tv)
[![i18n](https://img.shields.io/badge/5_langues-🌍-green.svg?style=flat-square)](#guides-dutilisation)

---

</div>

## Le problème

Gérer une médiathèque personnelle demande normalement d'empiler plusieurs outils : un pour découvrir, un pour chercher, un pour organiser, un pour gérer les demandes, un pour synchroniser. Chacun avec sa propre interface, son propre login, sa propre config.

**Movviz réunit tout ça dans une seule application**, avec une interface cinématographique cohérente du début à la fin.

---

## Fonctionnalités principales

<table>
<tr>
<td width="50%" valign="top">

### 🔍 Découverte
Parcourt les tendances, nouveautés, box-offices et classements allociné.fr — filtrable par genre, année, studio, plateforme ou continent d'origine. Un clic ajoute le titre et lance automatiquement la recherche.

### 🎬 Recherche & organisation
Interroge tous tes indexeurs Torznab/Newznab en une seule requête. Chaque résultat est noté selon la qualité, la fraîcheur et la santé des seeds. Le moteur BitTorrent intégré gère le reste.

### 📚 Bibliothèque unifiée
Films et séries dans une seule vue. Suivi des épisodes manquants, renommage automatique des fichiers selon tes modèles, réconciliation disque, intégration Plex.

</td>
<td width="50%" valign="top">

### 👥 Demandes multi-utilisateurs
Chaque membre du foyer peut demander un titre. Un administrateur approuve — avec quotas par utilisateur et délégation d'approbation possible.

### ⚙️ Automatisation
Scan RSS quotidien, upgrade automatique de qualité, synchronisation Plex incrémentale, notifications push (Discord, Telegram, Slack, Gotify, Pushbullet).

### 🌍 5 langues d'interface
Français, anglais, italien, néerlandais, allemand — choisies dès la première configuration ou changeables à tout moment.

</td>
</tr>
</table>

---

## Architecture

<div align="center">

| Module | Description |
| :---: | --- |
| **Tableau de bord** | Vue d'ensemble : statistiques, file de téléchargement, activité en direct |
| **Découverte** | Parcourir, filtrer et ajouter des titres |
| **Recherche** | Recherche interactive sur tous les indexeurs, releases notées |
| **Bibliothèque** | Films & séries unifiés, épisodes manquants, renommage auto |
| **Demandes** | File d'approbation multi-utilisateurs avec quotas |
| **Réglages** | Indexeurs, moteur, profils de qualité, notifications — tout centralisé |

</div>

---

## Stack technique

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15-000000.svg?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4.svg?style=for-the-badge&logo=tailwindcss)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-animation-F45F42.svg?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-moteur-339933.svg?style=for-the-badge&logo=node.js)

</div>

- **Next.js 15** — App Router, composants serveur + routes API
- **TypeScript** strict de bout en bout
- **Tailwind CSS v4** — design tokens `@theme`
- **Framer Motion** — animations fluides
- **Moteur BitTorrent maison** — service Node.js dédié, isolé de l'app web
- **i18n maison** — aucune chaîne en dur, 5 langues, ajouter une langue = ajouter un fichier

---

## Déploiement

<div align="center">

![Windows](https://img.shields.io/badge/Windows-x64-0078D4.svg?style=for-the-badge&logo=windows)
![Linux](https://img.shields.io/badge/Linux-x64-FCC624.svg?style=for-the-badge&logo=linux)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg?style=for-the-badge&logo=docker)

</div>

| Cible | Dossier | Démarrage |
| :---: | --- | --- |
| **Windows** | `packaging/windows/` | Service Windows (installeur multilingue, démarrage auto) |
| **Linux** | `packaging/linux/` | Unité systemd (démarrage auto) |
| **Docker** | `packaging/docker/` | Conteneur (`restart: unless-stopped`) |

### Démarrage rapide (développement)

```bash
git clone https://github.com/dj41ph4/movviz.git
cd movviz
npm install
npm run dev
# http://localhost:9810
```

---

## Structure du projet

```
src/
  app/            routes (tableau de bord + sections) + /api
  components/     UI par domaine (layout, media, settings, discover)
  i18n/           dictionnaires (5 langues) + provider + hook de traduction
  lib/            logique métier : indexeurs, bibliothèque, moteur, Plex
engine/           moteur de téléchargement BitTorrent, service Node.js isolé
resolver/         résolveur Cloudflare (port 9830), service indépendant
packaging/        installeurs Windows / Linux / Docker
```

L'interface est découplée des données : chaque écran lit des modèles typés depuis `src/lib`, ce qui garde la logique métier indépendante de la présentation.

---

## Guides d'utilisation

| Langue | Guide |
| :---: | --- |
| 🇫🇷 Français | [`docs/guide-fr.md`](docs/guide-fr.md) |
| 🇬🇧 English | [`docs/guide-en.md`](docs/guide-en.md) |
| 🇩🇪 Deutsch | [`docs/guide-de.md`](docs/guide-de.md) |
| 🇮🇹 Italiano | [`docs/guide-it.md`](docs/guide-it.md) |
| 🇳🇱 Nederlands | [`docs/guide-nl.md`](docs/guide-nl.md) |

---

## Licence

Movviz est un logiciel libre distribué sous licence [GPL-3.0](LICENSE) : librement modifiable et redistribuable, à condition que les versions dérivées restent elles aussi open-source.

## Soutenir le projet

Movviz est gratuit et le restera. Si l'application te rend service, un don via [GitHub Sponsors](https://github.com/sponsors/dj41ph4) est toujours apprécié.

---

<div align="center">

**Movviz** — *Un seul endroit pour tout gérer.*

</div>
