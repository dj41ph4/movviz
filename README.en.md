<div align="center">

<img src="public/brand/movviz-lockup.png" width="420" alt="Movviz"/>

# Movviz

### Your catalog. Your server. Your rules.

**A self-hosted, all-in-one media platform for discovery, requests, acquisition, library management, playback, recommendations, AI assistance and multi-device viewing.**

[![Latest release](https://img.shields.io/github/v/release/dj41ph4/movviz?style=flat-square&labelColor=1a1a2e&color=a855f7&label=version)](https://github.com/dj41ph4/movviz/releases/latest)
[![License](https://img.shields.io/badge/license-GPL--3.0-3da639?style=flat-square&labelColor=1a1a2e)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-amd64%20%7C%20arm64-2496ED?style=flat-square&logo=docker&logoColor=white&labelColor=1a1a2e)](https://hub.docker.com/r/dj41ph4/movviz)
[![Windows](https://img.shields.io/badge/Windows-installer-0078D4?style=flat-square&logo=windows&logoColor=white&labelColor=1a1a2e)](https://github.com/dj41ph4/movviz/releases/latest)
[![Android TV](https://img.shields.io/badge/Android%20TV-native-3DDC84?style=flat-square&logo=androidtv&logoColor=white&labelColor=1a1a2e)](android-tv-nx/)
[![Android](https://img.shields.io/badge/Android-native-3DDC84?style=flat-square&logo=android&logoColor=white&labelColor=1a1a2e)](android-mobile-nx/)
[![Plex](https://img.shields.io/badge/Plex-optional-E5A00D?style=flat-square&logo=plex&labelColor=1a1a2e)](#plex-is-optional)

[Download](https://github.com/dj41ph4/movviz/releases/latest) · [Docker Hub](https://hub.docker.com/r/dj41ph4/movviz) · [Français](README.md) · [Changelog](CHANGELOG.md)

</div>

---

## What is Movviz?

Movviz is built around a simple idea: a modern personal media stack should not require half a dozen disconnected applications just to discover something, request it, find a release, download it, organize it, track it and finally watch it.

Movviz brings those workflows together in one self-hosted product.

It combines:

- media discovery and personalized recommendations;
- movie and TV library management;
- Torznab/Newznab indexer search;
- release scoring and quality policies;
- a built-in BitTorrent engine;
- automatic importing and renaming;
- missing-item search, RSS and release-day automation;
- automatic quality upgrades;
- integrated playback with direct play, remux and transcoding;
- hardware acceleration and HDR/Dolby Vision to SDR conversion when required;
- per-user watched state and resume positions;
- requests, quotas and approval workflows;
- native Android TV and Android mobile clients;
- optional Plex synchronization;
- Trakt, IMDb, Letterboxd, Netflix history and Seerr/Overseerr imports;
- notifications and webhooks;
- an AI assistant that can recommend, search, add, rate and launch content using natural language.

The result is closer to a personal streaming platform than a traditional automation dashboard.

> **Movviz does not require Plex to manage or play local media.** Plex integration is optional and can be used for synchronization, watch history, markers and interoperability.

---

## Why another media application?

The classic self-hosted media stack is powerful, but highly fragmented. A typical setup may involve separate tools for requests, movies, TV shows, indexers, downloading, playback, monitoring, recommendations and user management.

Movviz takes a different approach: **one product, one interface, one source of truth and one experience across desktop, TV and mobile.**

### Movviz vs a traditional multi-app stack

| Workflow | Traditional stack | Movviz |
| --- | --- | --- |
| Discovery | Separate discovery/request app | Built in |
| Requests | Seerr / Overseerr | Built in |
| Movie automation | Radarr | Built in |
| TV automation | Sonarr | Built in |
| Indexer aggregation | Prowlarr | Torznab/Newznab search built in |
| Download client | qBittorrent / Transmission | Built-in BitTorrent engine |
| Import / rename | Arr applications | Built in |
| Missing-content search | Arr applications | Built in |
| Quality upgrades | Arr applications | Built in |
| Playback | Plex/Jellyfin/etc. | Built-in player, Plex optional |
| Watch progress | Media server | Unified per-user tracking |
| Recommendations | External service/plugin | Built in |
| AI assistant | External | Built in |
| Android TV | Separate media client | Native Movviz app |
| Android mobile | Web/PWA or separate client | Native Movviz app |
| Diagnostics | Multiple dashboards/logs | Centralized Doctor and health tools |

Movviz is not trying to imitate the *arr ecosystem screen-for-screen. The objective is to provide the complete user journey in one coherent application while keeping the automation depth expected by experienced self-hosters.

---

## At a glance

| Area | What Movviz does |
| --- | --- |
| **Discover** | Trending content, streaming-platform rows, genres, studios, networks, rankings, trailers and personalized discovery |
| **Search** | Unified Torznab/Newznab search, indexer diagnostics, quality scoring and manual release selection |
| **Acquire** | Built-in BitTorrent engine, magnet/torrent support, separate movie/TV workers, queue management |
| **Automate** | RSS, missing content, release-day searches, quality upgrades, automatic importing and renaming |
| **Organize** | Movies, TV shows, episodes, collections, sagas, calendars, multiple movie versions and trash management |
| **Watch** | Direct play, remux, transcoding, hardware acceleration, HDR→SDR, audio/subtitle selection and resume |
| **Track** | Per-user watched status, resume positions and activity synchronized across devices |
| **Recommend** | Personalized suggestions based on history, ratings, likes/dislikes, actors, directors and genres |
| **Assist** | Natural-language AI able to recommend, answer, add, rate and launch content |
| **Share** | Multiple users, requests, approval rules, quotas, profiles and personal watchlists |
| **Integrate** | Plex, Trakt, IMDb, Letterboxd, Netflix history, Seerr/Overseerr, Discord, Telegram, Gotify, Slack, Pushbullet and webhooks |
| **Run anywhere** | Windows, Linux, Docker/NAS, native Android TV, native Android mobile and PWA |
| **Diagnose** | Health indicators, logs, indexer diagnostics, server metrics, playback diagnostics and transcoding benchmark |

---

## Platforms

### Server

- **Windows** — installer, Windows service and update flow.
- **Linux x64 / ARM64** — prebuilt bundle and systemd service.
- **Docker x64 / ARM64** — suitable for self-hosted servers and NAS platforms.

### Clients

- **Web / PWA** — responsive interface with desktop and mobile layouts.
- **Android TV** — native Kotlin / Jetpack Compose for TV application.
- **Android mobile** — native Kotlin / Jetpack Compose application with portrait, landscape and foldable layouts.
- **Samsung Tizen TV** — beta client present in the repository.

---

## Installation

### Windows

Download the latest `Movviz-Setup-X.Y.Z.exe` from the [release page](https://github.com/dj41ph4/movviz/releases/latest).

The installer registers Movviz as a Windows service so it can start automatically with the machine.

### Linux

```bash
tar -xzf movviz-linux-x64.tar.gz
cd movviz
sudo ./packaging/linux/install.sh
```

Prebuilt bundles are available for x64 and ARM64.

### Docker / NAS

```bash
docker pull dj41ph4/movviz:latest
```

A Docker Compose setup is available under `packaging/docker`.

Default service ports:

- Web interface: `9810`
- BitTorrent engine: `9820`
- resolver service: `9830`
- peer-to-peer ports: `55000` / `55001`

### Android

The release page contains the Android TV and Android mobile APKs. The applications can update from GitHub releases.

---

## Discovery and streaming-style home screen

Movviz is designed to be opened and used, not merely administered.

The home screen can include:

- cinematic hero content with trailers;
- Continue Watching;
- recently added episodes;
- personalized recommendations;
- titles worth rewatching;
- short content when the user has little time;
- upcoming releases;
- Movviz trends;
- discovery carousels;
- download status and pipeline activity.

Users can select Cinema, Classic or Compact home-screen styles.

Discovery views include trending, popular, top-rated, upcoming, cinema, currently airing, box office, kids, new releases, studios, networks, genres and streaming-platform rows such as Netflix, Disney+, Prime Video, Apple TV+, Max and Crunchyroll.

---

## Library management

Movviz manages movies and TV shows as a unified media library.

Capabilities include:

- movie and series hubs;
- episode-level availability;
- missing-content views;
- release and airing calendars;
- collections and TMDb sagas;
- custom collections;
- multiple versions of the same movie;
- alternate titles for better matching;
- custom artwork selection;
- file reconciliation and moved-file repair;
- recycle bin/trash retention;
- blocked titles and exclusions;
- manual disk indexing;
- bulk renaming;
- media analysis using ffprobe.

Movviz avoids destructive cleanup when storage temporarily disappears. A disconnected mount should not become a mass-deletion event.

---

## Indexers, search and acquisition

Movviz can search multiple **Torznab/Newznab** indexers in one request and can expose diagnostics when an indexer returns no usable result.

Release selection can take into account resolution, source, codec, language, file size, seeders, freshness, custom formats, regular-expression rules, blocked words and per-title quality profiles.

An interactive/manual search mode lets the user choose a specific release.

### Built-in BitTorrent engine

Movviz includes its own BitTorrent engine instead of requiring a separate download client.

It supports:

- separate movie and TV instances;
- queue progress, speed and ETA;
- pause/resume/restart/remove;
- magnet links and `.torrent` files;
- ratio and upload-slot rules;
- automatic import at completion;
- orphaned download recovery;
- import history and failure diagnostics.

---

## Quality automation

Quality rules are configurable rather than hard-coded.

Movviz can use:

- forbidden words;
- maximum sizes by movie, episode or season;
- codec scoring for x264, x265/HEVC and AV1;
- regular-expression custom formats with positive or negative scores;
- per-title quality profiles;
- automatic upgrades when a better release appears;
- automatic replacement of an older episode/movie file after validation;
- a decision log explaining why a release was accepted or rejected.

Automated jobs also cover missing titles, same-day releases, RSS feeds, library reconciliation, media metadata and recovery tasks.

---

## Playback engine

Movviz includes a player and media-delivery pipeline.

For each client it tries to perform the minimum necessary work:

1. **Direct play** when the device supports the file.
2. **Remux** when the video can remain untouched but the container/audio needs adaptation.
3. **Transcode** only when required.

Playback capabilities include:

- verified hardware encoding when available;
- software fallback;
- HDR/Dolby Vision → SDR conversion;
- audio-track and subtitle selection;
- playback speed, Picture-in-Picture and fullscreen;
- exact resume positions;
- intro/credits skipping when markers are available;
- next-episode behavior;
- active-session monitoring;
- playback diagnostics exposing codec, buffer and transcoding decisions.

Media files are analyzed with ffprobe and the result is cached to avoid repeating expensive detection work.

---

## Per-user watch state and recommendations

Watch history and resume positions are isolated per profile and synchronized between supported clients.

Movviz can build recommendations from:

- watched content;
- ratings;
- likes/dislikes and "not for me" feedback;
- requests and watchlists;
- genres;
- favorite actors and directors;
- previous recommendations.

The goal is to make the home screen increasingly personal rather than displaying the same global popularity list to everyone.

---

## Movviz AI

Movviz includes an optional conversational assistant.

It can:

- recommend movies and series using the user's real taste profile;
- answer questions about the local library and media metadata;
- understand follow-ups such as "the second one" or "launch it";
- add content to the library;
- mark titles watched;
- rate content;
- start playback;
- perform web-assisted media research when configured;
- remember user-level preferences and conversational context;
- support speech input and text-to-speech on compatible clients.

The assistant is optional and can be disabled entirely.

---

## Multi-user requests

Movviz supports local accounts and optional Plex authentication.

Features include:

- admin/user roles;
- account approval;
- request quotas;
- automatic or manual request approval per user;
- delegated request management;
- issue reporting with comments and resolution;
- personal watchlists;
- profile pictures;
- personal API tokens.

---

## Plex is optional

Movviz works without Plex. When Plex is connected, Movviz can use it for interoperability features such as:

- incremental library synchronization;
- per-profile watch-history synchronization;
- resume-position merging;
- Plex watchlist import;
- intro and credits markers;
- active-session monitoring;
- path mapping for Docker/NAS installations;
- opening content in Plex when desired.

Plex is an integration, not a hard dependency.

---

## Imports and integrations

Movviz can import or synchronize data from several existing workflows:

- **Netflix** viewing history CSV;
- **Trakt** lists;
- **IMDb** lists;
- **Letterboxd** lists;
- **Seerr / Overseerr** requests;
- **Plex** libraries, profiles, history and watchlists.

Notifications can be sent through Discord, Telegram, Gotify, Slack, Pushbullet or generic webhooks.

---

## Android TV

The Android TV application is native Kotlin + Jetpack Compose for TV rather than a WebView wrapper.

It includes a streaming-style home screen, movie/TV hubs, discovery, search, downloads, profiles, seasons/episodes, watch-state controls, trailers and an integrated player with D-pad-first navigation.

The client is designed around fast focus movement, remote-control ergonomics and local-first screen restoration.

---

## Android mobile

The Android mobile client is also native Kotlin + Jetpack Compose.

It includes dedicated portrait, landscape and foldable layouts, library browsing, discovery, downloads, actor pages, playback, resume, intro/credits skipping, AI chat with voice features and real-time synchronization.

---

## Diagnostics and operations

Movviz includes operational tooling normally spread across multiple services:

- readiness/health indicators;
- indexer tests;
- disk and library checks;
- server CPU and memory visibility;
- request latency diagnostics;
- event-loop monitoring;
- a Movviz Doctor that highlights configuration/library issues;
- transcoding benchmarks;
- media-engine logs;
- indexer query logs;
- scheduled-job visibility and manual execution;
- backup/restore tools;
- cache inspection and clearing.

Background jobs yield priority to user-triggered actions so maintenance work does not unnecessarily block the UI.

---

## Technical architecture

| Component | Role | Technology |
| --- | --- | --- |
| Web server | UI, APIs, jobs, playback orchestration, AI, real time | Next.js 16, TypeScript strict, Tailwind CSS v4, SWR |
| Download engine | BitTorrent | Separate Node.js process |
| Resolver | Protected-indexer access | Dedicated process |
| Media engine | Analysis, remux, transcoding, tone mapping | FFmpeg / ffprobe |
| Real time | Server → clients | Server-Sent Events |
| Data | Config, library, watch state, user context | Atomic JSON + SQLite |
| Android TV | Living-room client | Kotlin, Jetpack Compose for TV, Media3 |
| Android mobile | Phone/foldable client | Kotlin, Jetpack Compose, Media3 |

Heavy tasks can be delegated to workers so the interactive UI stays responsive.

---

## Development

```bash
git clone https://github.com/dj41ph4/movviz.git
cd movviz
npm install
npm run dev      # http://localhost:9810
npm test
npm run build
```

Android projects live under [`android-tv-nx/`](android-tv-nx/) and [`android-mobile-nx/`](android-mobile-nx/).

---

## Who is Movviz for?

Movviz is particularly relevant if you:

- self-host your media stack;
- use or have used Plex, Seerr/Overseerr, Radarr, Sonarr, Prowlarr or a separate torrent client;
- want fewer moving parts and less duplicated configuration;
- want family-friendly requests without exposing admin tooling;
- care about TV/mobile UX as much as backend automation;
- want one system to understand both acquisition state and viewing state;
- want an open-source platform that can run locally on Windows, Linux, Docker or a NAS.

---

## Project status

Movviz is under active development. Releases are published frequently and the complete history is available in [`CHANGELOG.md`](CHANGELOG.md).

Bug reports, feature requests, testing feedback, packaging contributions and documentation improvements are welcome.

If you try Movviz, **star the repository** if you want to help other self-hosters discover it.

---

<div align="center">

### Download Movviz

[GitHub Releases](https://github.com/dj41ph4/movviz/releases/latest) · [Docker Hub](https://hub.docker.com/r/dj41ph4/movviz)

**Open source · GPL-3.0 · Self-hosted**

</div>
