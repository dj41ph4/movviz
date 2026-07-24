<div align="center">

<br>

<!-- Hero badge - version + brand -->
<img src="https://img.shields.io/badge/Movviz-1.7.4-7c3aed?style=for-the-badge&labelColor=1a1a2e&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDUxMiA1MTIiPjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTEyIiBmaWxsPSIjN2MzYWVkIi8+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjI4IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjEwOCIgeT0iMTUyIiB3aWR0aD0iMjk2IiBoZWlnaHQ9IjI0MCIgcng9IjIwIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMTUiLz48cGF0aCBkPSJNMCAwaDEyOHYxMDhIMHoiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEwOCwxMDgpIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuOSIvPjxjaXJjbGUgY3g9IjE2OCIgY3k9IjMwMCIgcj0iMjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC45IiBzdHJva2U9Im5vbmUiLz48Y2lyY2xlIGN4PSIzNDQiIGN5PSIzMDAiIHI9IjI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuOSIgc3Ryb2tlPSJub25lIi8+PC9nPjwvc3ZnPg==" alt="Movviz"/>

<!-- Primary tagline -->
<h1>Centre de commande unifié pour films et séries</h1>
<p><strong>Découvrir, organiser, suivre et gérer</strong> — depuis une interface unique, self-hostée et open-source.</p>

<!-- CTA buttons row -->
<a href="https://github.com/dj41ph4/movviz/releases/latest">
  <img src="https://img.shields.io/badge/T%C3%A9l%C3%A9charger_pour_Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white&labelColor=1a1a2e" alt="Télécharger pour Windows"/>
</a>
<a href="https://hub.docker.com/r/dj41ph4/movviz">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white&labelColor=1a1a2e" alt="Docker"/>
</a>
<a href="packaging/linux/">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black&labelColor=1a1a2e" alt="Linux"/>
</a>

<br><br>

<!-- Badges bar -->
<img src="https://img.shields.io/badge/Licence-GPL--3.0-3da639?style=flat-square&labelColor=1a1a2e" alt="Licence"/>
<img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&labelColor=1a1a2e" alt="Next.js"/>
<img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&labelColor=1a1a2e" alt="TypeScript"/>
<img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&labelColor=1a1a2e" alt="Tailwind CSS"/>
<img src="https://img.shields.io/badge/Plex-int%C3%A9gr%C3%A9-E5A00D?style=flat-square&logo=plex&labelColor=1a1a2e" alt="Plex"/>
<img src="https://img.shields.io/badge/5_langues-43b02a?style=flat-square&labelColor=1a1a2e" alt="i18n"/>

</div>

<br>

---

<br>

## Pour démarrer

<table>
<tr>
<td width="50%" align="center">

### Windows

**`Movviz-Setup-1.7.4.exe`**

<a href="https://github.com/dj41ph4/movviz/releases/latest">
  <img src="https://img.shields.io/badge/T%C3%A9l%C3%A9charger_l'installeur-0078D4?style=for-the-badge&logo=windows&logoColor=white&labelColor=1a1a2e" alt="Télécharger"/>
</a>

<br>

Service Windows automatique · Installeur multilingue · Démarrage au boot

</td>
<td width="50%" align="center">

### Docker

<a href="https://hub.docker.com/r/dj41ph4/movviz">
  <img src="https://img.shields.io/badge/Docker_Hub-2496ED?style=for-the-badge&logo=docker&logoColor=white&labelColor=1a1a2e" alt="Docker"/>
</a>

<br>

```dockerfile
docker pull dj41ph4/movviz:latest
```

amd64 · arm64

</td>
</tr>
</table>

> **Développement** — `git clone https://github.com/dj41ph4/movviz.git && cd movviz && npm install && npm run dev` — http://localhost:9810

---

## Fonctionnalités

<table>
<tr>
<td width="50%" valign="top">

<img src="https://img.shields.io/badge/D%C3%A9couverte-7c3aed?style=flat-square&labelColor=1a1a2e" alt="Découverte"/>

Parcourir les tendances, nouveautés et classements. Filtres par genre, année, studio, plateforme. Ajout en un clic.

<img src="https://img.shields.io/badge/Recherche_unifi%C3%A9e-7c3aed?style=flat-square&labelColor=1a1a2e" alt="Recherche"/>

Interroger tous les indexeurs Torznab en une requête. Résultats notés par qualité, fraîcheur et santé des seeds. Moteur BitTorrent intégré.

<img src="https://img.shields.io/badge/Biblioth%C3%A8que-7c3aed?style=flat-square&labelColor=1a1a2e" alt="Bibliothèque"/>

Films et séries dans une vue unifiée. Suivi des épisodes manquants, renommage automatique, réconciliation disque, intégration Plex.

</td>
<td width="50%" valign="top">

<img src="https://img.shields.io/badge/Demandes-ec4899?style=flat-square&labelColor=1a1a2e" alt="Demandes"/>

Chaque membre peut soumettre un titre. Approbation par un administrateur, quotas et délégation configurables.

<img src="https://img.shields.io/badge/Automatisation-ec4899?style=flat-square&labelColor=1a1a2e" alt="Automatisation"/>

Scan RSS quotidien, upgrade automatique de qualité, synchronisation Plex incrémentale, notifications (Discord, Telegram, Slack, Gotify, Pushbullet).

<img src="https://img.shields.io/badge/Multilingue-ec4899?style=flat-square&labelColor=1a1a2e" alt="Multilingue"/>

Français, anglais, allemand, italien, néerlandais. Configurable à l'installation et modifiable à tout moment.

</td>
</tr>
</table>

---

## Architecture

| Module | Rôle | Stack |
| :---: | --- | :---: |
| **Tableau de bord** | Statistiques, téléchargements, activité en direct | Next.js + API |
| **Découverte** | Parcourir, filtrer, ajouter des titres | TMDb / Allociné |
| **Recherche** | Interrogation multi-indexeur | Torznab / Newznab |
| **Bibliothèque** | Films, séries, épisodes manquants, renommage | Plex API |
| **Demandes** | Approbation multi-utilisateurs avec quotas | Base intégrée |
| **Réglages** | Indexeurs, moteur, profils qualité, notifications | Centralisé |

---

## Stack technique

<div align="center">

<img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&labelColor=1a1a2e" alt="Next.js"/>
<img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&labelColor=1a1a2e" alt="TypeScript"/>
<img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&labelColor=1a1a2e" alt="Tailwind"/>
<img src="https://img.shields.io/badge/Node.js-moteur-339933?style=for-the-badge&logo=node.js&labelColor=1a1a2e" alt="Node.js"/>

</div>

---

## Guides

<div align="center">

| Langue | Document |
| :---: | --- |
| Français | [`docs/guide-fr.md`](docs/guide-fr.md) |
| English | [`docs/guide-en.md`](docs/guide-en.md) |
| Deutsch | [`docs/guide-de.md`](docs/guide-de.md) |
| Italiano | [`docs/guide-it.md`](docs/guide-it.md) |
| Nederlands | [`docs/guide-nl.md`](docs/guide-nl.md) |

</div>

---

<div align="center">

<a href="https://github.com/dj41ph4/movviz/releases/latest">
  <img src="https://img.shields.io/badge/T%C3%A9l%C3%A9charger_Movviz_1.7.4-7c3aed?style=for-the-badge&logo=github&logoColor=white&labelColor=1a1a2e" alt="Télécharger"/>
</a>

<br><br>

---

## Soutenir le projet

Movviz est gratuit et le restera. S'il te rend service, un don est toujours apprécié.

<a href="https://github.com/sponsors/dj41ph4">
  <img src="https://img.shields.io/badge/GitHub_Sponsors-30363D?style=for-the-badge&logo=github&logoColor=white&labelColor=1a1a2e" alt="GitHub Sponsors"/>
</a>

<br><br>

<sub>Un seul endroit pour tout gérer. · GPL-3.0 · 2026</sub>

</div>
