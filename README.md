<div align="center">

<br>

<img src="https://img.shields.io/badge/Movviz-1.16.58-7c3aed?style=for-the-badge&labelColor=1a1a2e&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDUxMiA1MTIiPjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTEyIiBmaWxsPSIjN2MzYWVkIi8+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjI4IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjEwOCIgeT0iMTUyIiB3aWR0aD0iMjk2IiBoZWlnaHQ9IjI0MCIgcng9IjIwIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMTUiLz48cGF0aCBkPSJNMCAwaDEyOHYxMDhIMHoiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEwOCwxMDgpIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuOSIvPjxjaXJjbGUgY3g9IjE2OCIgY3k9IjMwMCIgcj0iMjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC45IiBzdHJva2U9Im5vbmUiLz48Y2lyY2xlIGN4PSIzNDQiIGN5PSIzMDAiIHI9IjI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuOSIgc3Ryb2tlPSJub25lIi8+PC9nPjwvc3ZnPg==" alt="Movviz"/>

<h1>Movviz</h1>
<p><strong>Ton catalogue. Ton serveur. Tes règles.</strong></p>
<p>Movviz réunit découverte, recherche, bibliothèque et lecture — films et séries — dans une seule interface cinématographique, auto-hébergée et open-source. Un serveur que tu contrôles entièrement, sans abonnement, sans compromis sur le style.</p>

<a href="https://github.com/dj41ph4/movviz/releases/latest">
  <img src="https://img.shields.io/badge/T%C3%A9l%C3%A9charger_pour_Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white&labelColor=1a1a2e" alt="Télécharger pour Windows"/>
</a>
<a href="https://hub.docker.com/r/dj41ph4/movviz">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white&labelColor=1a1a2e" alt="Docker"/>
</a>
<a href="packaging/linux/">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black&labelColor=1a1a2e" alt="Linux"/>
</a>
<a href="android-tv/">
  <img src="https://img.shields.io/badge/Android_TV-3DDC84?style=for-the-badge&logo=androidtv&logoColor=white&labelColor=1a1a2e" alt="Android TV"/>
</a>

<br><br>

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

## Pourquoi Movviz

Les solutions du genre existent depuis des années, chacune sur son bout du problème — un outil pour découvrir, un autre pour chercher, un troisième pour organiser, un quatrième pour regarder. Movviz part d'un principe simple : **tout ça devrait vivre au même endroit**, avec une seule base de données, une seule interface, et un niveau de finition qui donne envie de l'ouvrir plutôt que de le subir.

Concrètement, ça veut dire :

- **Un vrai moteur de recherche** interrogeant tes indexeurs Torznab/Newznab, avec un **client BitTorrent intégré** — pas de dépendance à un outil tiers pour télécharger.
- **Une bibliothèque qui se tient à jour toute seule** — scan RSS, upgrade automatique de qualité, réconciliation disque, synchronisation Plex incrémentale.
- **Un système de demandes multi-utilisateurs** avec quotas et approbation, pour que toute la maison puisse participer sans tout casser.
- **Une interface pensée comme un produit**, pas comme un tableau de bord d'administration — glassmorphism, animations soignées, expérience mobile au même niveau que le bureau.
- **Un client Android TV natif** — pas une page web redimensionnée, une vraie application Compose pensée pour la télécommande, avec mise à jour automatique.

Rien de tout ça n'est un service tiers. C'est ton serveur, tes fichiers, tes identifiants — Movviz ne fait que les orchestrer.

---

## Pour démarrer

<table>
<tr>
<td width="33%" align="center">

### Windows

**`Movviz-Setup-X.Y.Z.exe`** — dernière version sur la page des releases

<a href="https://github.com/dj41ph4/movviz/releases/latest">
  <img src="https://img.shields.io/badge/T%C3%A9l%C3%A9charger_l'installeur-0078D4?style=for-the-badge&logo=windows&logoColor=white&labelColor=1a1a2e" alt="Télécharger"/>
</a>

<br>

Service Windows automatique · Installeur multilingue · Démarrage au boot

</td>
<td width="33%" align="center">

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
<td width="33%" align="center">

### Android TV

**`Movviz-Android-TV.apk`** — sur la page des releases

<a href="android-tv/">
  <img src="https://img.shields.io/badge/Voir_le_client-3DDC84?style=for-the-badge&logo=androidtv&logoColor=white&labelColor=1a1a2e" alt="Client Android TV"/>
</a>

<br>

Manette/télécommande native · Mise à jour automatique

</td>
</tr>
</table>

> **Développement** — `git clone https://github.com/dj41ph4/movviz.git && cd movviz && npm install && npm run dev` — puis direction [http://localhost:9810](http://localhost:9810)

---

## Fonctionnalités

<table>
<tr>
<td width="50%" valign="top">

<img src="https://img.shields.io/badge/D%C3%A9couverte-7c3aed?style=flat-square&labelColor=1a1a2e" alt="Découverte"/>

Tendances, nouveautés, classements par genre, année, studio ou plateforme de streaming. Bandes-annonces, fiches détaillées, ajout en un clic depuis la fiche TMDb.

<img src="https://img.shields.io/badge/Recherche_unifi%C3%A9e-7c3aed?style=flat-square&labelColor=1a1a2e" alt="Recherche"/>

Interroge tous tes indexeurs Torznab/Newznab en une seule requête. Résultats notés par qualité, fraîcheur et santé des seeds, avec un **moteur BitTorrent intégré** — aucun client externe requis.

<img src="https://img.shields.io/badge/Biblioth%C3%A8que-7c3aed?style=flat-square&labelColor=1a1a2e" alt="Bibliothèque"/>

Films et séries dans une vue unifiée. Suivi des épisodes manquants, renommage automatique, réconciliation disque, intégration Plex bidirectionnelle.

<img src="https://img.shields.io/badge/Client_Android_TV-7c3aed?style=flat-square&labelColor=1a1a2e" alt="Android TV"/>

Application native Compose, pas un site redimensionné — navigation télécommande, reprise de lecture, transcodage adaptatif, mise à jour automatique depuis GitHub.

</td>
<td width="50%" valign="top">

<img src="https://img.shields.io/badge/Demandes-ec4899?style=flat-square&labelColor=1a1a2e" alt="Demandes"/>

Chaque membre du foyer peut soumettre un titre. Approbation par un administrateur, quotas et délégation configurables par utilisateur.

<img src="https://img.shields.io/badge/Automatisation-ec4899?style=flat-square&labelColor=1a1a2e" alt="Automatisation"/>

Scan RSS quotidien, upgrade automatique de qualité dès qu'une meilleure version apparaît, synchronisation Plex incrémentale, notifications (Discord, Telegram, Slack, Gotify, Pushbullet).

<img src="https://img.shields.io/badge/Interface_soign%C3%A9e-ec4899?style=flat-square&labelColor=1a1a2e" alt="Interface"/>

Hero cinématique, glassmorphism, animations fluides — pensée comme un produit, avec un passage mobile explicite sur chaque écran, pas juste une adaptation en dernière minute.

<img src="https://img.shields.io/badge/Multilingue-ec4899?style=flat-square&labelColor=1a1a2e" alt="Multilingue"/>

Français, anglais, allemand, italien, néerlandais. Configurable à l'installation et modifiable à tout moment, sans redémarrage.

</td>
</tr>
</table>

---

## Architecture

| Module | Rôle | Stack |
| :---: | --- | :---: |
| **Tableau de bord** | Statistiques, téléchargements, activité en direct | Next.js + API |
| **Découverte** | Parcourir, filtrer, ajouter des titres | TMDb / Allociné |
| **Recherche** | Interrogation multi-indexeur + téléchargement | Torznab / Newznab + BitTorrent |
| **Bibliothèque** | Films, séries, épisodes manquants, renommage | Plex API |
| **Demandes** | Approbation multi-utilisateurs avec quotas | Base intégrée |
| **Client Android TV** | Découverte, bibliothèque, lecture au salon | Kotlin + Jetpack Compose |
| **Réglages** | Indexeurs, moteur, profils qualité, notifications | Centralisé |

Le serveur web (Next.js) et le moteur BitTorrent tournent comme deux process séparés mais colocalisés — un seul déploiement, deux responsabilités bien découpées.

---

## Stack technique

<div align="center">

<img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&labelColor=1a1a2e" alt="Next.js"/>
<img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&labelColor=1a1a2e" alt="TypeScript"/>
<img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&labelColor=1a1a2e" alt="Tailwind"/>
<img src="https://img.shields.io/badge/Node.js-moteur-339933?style=for-the-badge&logo=node.js&labelColor=1a1a2e" alt="Node.js"/>
<img src="https://img.shields.io/badge/Kotlin-Android_TV-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white&labelColor=1a1a2e" alt="Kotlin"/>

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
  <img src="https://img.shields.io/badge/T%C3%A9l%C3%A9charger_Movviz-7c3aed?style=for-the-badge&logo=github&logoColor=white&labelColor=1a1a2e" alt="Télécharger"/>
</a>

<br><br>

---

## Soutenir le projet

Movviz est gratuit et le restera. S'il te rend service, un don est toujours apprécié.

<a href="https://github.com/sponsors/dj41ph4">
  <img src="https://img.shields.io/badge/GitHub_Sponsors-30363D?style=for-the-badge&logo=github&logoColor=white&labelColor=1a1a2e" alt="GitHub Sponsors"/>
</a>

<br><br>

<sub>Ton catalogue. Ton serveur. Tes règles. · GPL-3.0 · 2026</sub>

</div>
