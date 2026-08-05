# Changelog

All notable changes to Movviz, grouped by development milestone.

---

## v1.12.70 — August 2026

**Root cause fixed, confirmed live**: removing a torrent from the download engine reported success and wiped its own tracking (including which library title it belonged to) even when the underlying download client silently failed to actually remove it — the torrent kept running and seeding untouched, but the engine had no record of it anymore. This is what produced downloads that could never be linked back to a title no matter how many times a recovery scan ran. The engine now only clears its own bookkeeping once removal is independently confirmed; otherwise the torrent stays tracked and can be retried instead of turning into a permanent orphan.

## v1.12.51 – v1.12.69 — August 2026

Matching accuracy and engine reliability pass: complete-series pack detection (season-range terms, false-positive guards), stuck-download recovery hardened to atomic no-overwrite moves with a reliable import callback, per-series/movie write locking to close a race that could drop a completed episode's status, and duplicate-download reconciliation so a re-grabbed file no longer leaves the library stuck on the wrong status. User guide refreshed to cover recently shipped features (title editing, movie versions, unlinked-download linking, anime settings).

## v1.12.24 – v1.12.50 — August 2026

Complete-series pack search (single-query, season-range aware), download recovery reliability (folder scan, orphaned-file matching, duplicate cleanup), secured duplicate deletion, and a small automated test suite for the release-matching core.

## v1.10.90 – v1.12.23 — July–August 2026

Quality-upgrade workflow (Optimize / Ignore, meaningful-upgrade detection), a redesigned resolution/codec badge system, GPU/animation performance profiles, and engine stabilization across the interchangeable download backends (crash fixes, anti-stall rule, per-series search locking).

## v1.10.39 – v1.10.89 — July 2026

Download engine rewrite with interchangeable backends (native/aria2, WebTorrent, libtorrent), a maintenance "recover downloads" tool for orphaned files, a premium toast notification system, audio-codec badges, and beta in-app playback improvements (direct play, transcode logging).

## v1.10.12 – v1.10.17 — July 2026

Language-detection accuracy pass: audio-track language read from Plex, French-variant tags (VF/VFQ/VFF/TRUEFRENCH) correctly satisfying quality profiles, duplicate-episode cleanup, and a fix for premature torrent abandonment.

## v1.10.1 – v1.10.6 — July 2026

Decision Guard (pre-grab blocklist enforcement), franchise/collection detection, a redesigned download queue and diagnostics dashboard, and trailer/calendar refinements.

## v1.8.0 – v1.9.9 — July 2026

Unified title panel (single component for the slide-in and full-page views), a trash/recycle-bin safety net for removed titles, mobile responsiveness pass, and a fix for a memory leak in the metadata cache.

## v1.4.5 – v1.7.9 — July 2026

Security hardening (path traversal, database protections, CodeQL alerts), the trash system's final protections, a live in-app player, real-time updates across the UI, Plex activity monitoring, and collections support.

## v1.1.67 – v1.4.4 — July 2026

In-app player with automatic Plex transcode fallback, Overseerr (Seerr) request import, multi-architecture Docker builds, and a reduction of the settings navigation from 26 tabs down to 18.

## v1.1.50 – v1.1.66 — July 2026

Initial public release: TMDb discovery, Torznab/Newznab indexer search, unified movie/series library, multi-user requests, the built-in BitTorrent engine, and Plex sync — plus early stability and security fixes (session handling, library deduplication, dependency upgrades).
