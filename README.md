<div align="center">

# Movviz

<img src="https://img.shields.io/badge/Movviz-v1.1.61-7c3aed?style=for-the-badge&labelColor=1a1a2e" alt="Version"/>

### Le centre de commande unifié pour films et séries

Découvrir, organiser, suivre et gérer — depuis une interface unique, self-hostée et open-source.

[![Windows Installer](https://img.shields.io/badge/T%C3%A9l%C3%A9charger_pour_Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/dj41ph4/movviz/releases/latest)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/dj41ph4/movviz/pkgs/container/movviz)
[![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)](packaging/linux/)

<br>

[![Licence](https://img.shields.io/badge/Licence-GPL--3.0-3da639.svg?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000.svg?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Plex](https://img.shields.io/badge/Plex-int%C3%A9gr%C3%A9-E5A00D.svg?style=flat-square&logo=plex)](https://www.plex.tv)
[![i18n](https://img.shields.io/badge/langues-5-43b02a.svg?style=flat-square)](#guides-dutilisation)

</div>

---

## Installation rapide

<table>
<tr>
<td width="50%" align="center">

### Windows

**`Movviz-Setup-1.1.61.exe`**

[![Download](https://img.shields.io/badge/T%C3%A9l%C3%A9charger_l'installeur-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/dj41ph4/movviz/releases/latest)

Service Windows automatique. Installeur multilingue.

</td>
<td width="50%" align="center">

### Docker

```bash
docker pull ghcr.io/dj41ph4/movviz:latest
```

[![Docker](https://img.shields.io/badge/Voir_sur_GitHub_Container_Registry-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/dj41ph4/movviz/pkgs/container/movviz)

</td>
</tr>
</table>

**Développement :** `git clone https://github.com/dj41ph4/movviz.git && cd movviz && npm install && npm run dev`

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

## Stack technique

| Technologie | Utilisation |
| :--- | --- |
| **Next.js 15** | App Router, composants serveur, routes API |
| **TypeScript** | Typage strict de bout en bout |
| **Tailwind CSS v4** | Design tokens via `@theme` |
| **Framer Motion** | Animations d'interface |
| **Node.js** | Moteur BitTorrent dédié, isolé de l'application |
| **i18n custom** | 5 langues, aucune chaîne en dur |

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

<br>
<a href="https://github.com/dj41ph4/movviz/releases/latest">
  <img src="https://img.shields.io/badge/Movviz_1.1.61-7c3aed?style=for-the-badge&logo=github" alt="Télécharger"/>
</a>
<br><br>
<sub>Un seul endroit pour tout gérer.</sub>

</div>
