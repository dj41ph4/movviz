# Changelog

All notable changes to Movviz, grouped by development milestone.

---

## v1.12.81 — August 2026

### Search/matching audit (TR4KER vs C411), link-before-download, Seerr notification flood, and a discovered engine-token mismatch

- **Fixed, confirmed live**: a series like "Ma vie avec les Walter Boys" (tmdbId 199001) could never be grabbed: the French localized title was used for both the indexer query and local release matching, while scene releases are always named after the ORIGINAL title ("My.Life.With.The.Walter.Boys.S03...") — every indexer returned 0 hits. Search and matching now prefer `originalTitle` (the localized title stays as an alias), and the daily metadata refresh backfills `originalTitle`/`tvdbId`/`imdbId` on pre-existing entries. TR4KER also only declares tvdb search (`tvSearchTvdb`, no tmdb) — the tvdbid was never sent to it because the field didn't exist; `searchTv` now sends `tvdbid` (TR4KER) / `tmdbid` (C411) as the indexer supports.
- **Fixed**: a failing ID-mode search (indexer-side error or HTTP 5xx) silently swallowed the whole search — the text fallback never ran. Both `searchMovie`/`searchTv` now always fall back to the text query.
- **Fixed**: the hourly RSS refresh silently showed "C411:0" — indexer errors were caught and discarded. Errors are now logged per indexer (`rss_refresh.indexer_error`) and a cycle with 0 releases while others return plenty warns with the indexer's caps (`rss_refresh.indexer_empty`).
- **Fixed**: linking a release before downloading failed with "Impossible d'ajouter ce titre à la bibliothèque" when the title was already in the library — the server's `alreadyInLibrary` response now carries the existing item so the picker can link straight to it. A duplicate-library guard (`libraryEntriesMatch`, title/originalTitle/aliases + compatible year) also stops TMDb duplicate entries from creating a second library record.
- **Fixed**: the `[seerr] mediaId not found` log flood — unknown tmdbIds are now cached as misses for 1 hour (warn at most once/hour each) with bounded pagination, and "processing" notifications are deduped to one per title per pass (`notifySeerrProcessingOnce`).
- **Fixed, environment**: the diagnostic log showed every grab rejected with `{"error":"unauthorized"}` — the web app and the download engine were using different `engine-token.json` files (dev vs Windows service install). Token files aligned; an explicit "TOKEN MOTEUR INVALIDE" hint now appears in the diagnostic log when the engine rejects a grab with unauthorized.

---

## v1.12.80 — August 2026

### "Récupérer téléchargements" crashed on large download folders — now batched, and the queue/history tabs no longer freeze with thousands of rows

- **Fixed, confirmed live**: the maintenance action processed every file in one synchronous request. With hundreds of files (big packs, long-running backlog) the request could time out or take minutes, and the response rendered every recovered/failed/duplicate entry at once — the page froze or crashed outright. The scan now runs in batches of 20 files per request: the panel re-invokes automatically with the paths already attempted (the server is idempotent per path, so a permanently-failed file is reported once and never retried within the same run), shows progress as batches complete, and caps the rendered list at 30 entries per section with a "+N more" note — the full data stays available for the delete-duplicates/unmatched actions.
- **Fixed**: the Queue tab rendered every torrent row (downloading, seeding, completed...) on every 500 ms poll — hundreds of completed items painted thousands of DOM nodes, freezing the tab. It now paints the first 50 rows immediately (active items sort first, so the live queue stays visible), grows the rest in idle time, and offers a "Show more" button. Same progressive rendering applied to the Activity history tab, which holds up to 2000 entries.
- Both changes are rendering/perf-only: filters, bulk actions, counters and cleanup buttons behave exactly as before.

---

## v1.12.79 — August 2026

### Hardened the previous fix after independent review

- An independent review of v1.12.78's recovery fix caught two real gaps before they could bite: the new "trust the original download's own record" resolution could have let it override a file's own explicit, disagreeing season number — meaning a mislabeled release could have been silently misfiled into the wrong season folder. It now only fills in a season/episode the file's own name didn't already provide, never overrides one it did. Also, one remaining spot (a movie bundled inside a series-category pack) was still on the old guess-only path while every other case had already been upgraded — now consistent across all of them.

## v1.12.78 — August 2026

### Root cause of downloads recovery couldn't relink either — recovery was discarding information it already had

- **Fixed, confirmed live**: investigated a specific case (Wakfu) where the download-recovery tool couldn't find a match for completed files even though the show was already correctly in the library. Root cause: recovery was re-guessing each file's show purely from its file name and folder path, even for files whose original download already knew — with certainty, from the moment it was grabbed — exactly which series and season it belonged to. That authoritative information was being discarded before the per-file matching ran, forcing every file through a fuzzy filename guess instead. For a show organized as `ShowName/Saison 01/episode.avi` with an episode file whose own name carries no recognizable season marker, that guess fell back to reading the season folder itself ("Saison 01") as the show's title — sharing no words at all with the real name, so it never matched.
- Recovery now resolves a file's show/season directly from its original download's own record when available, instead of guessing — and when it does have to fall back to reading folder names, it now checks one level higher whenever the closer folder turns out to be a bare season marker with no real title in it, rather than stopping at the first folder regardless of what it actually contains. Both fixes are generic — they apply to any show organized this way, not the one that surfaced the bug.

## v1.12.77 — August 2026

### Theater Mode was letting the page underneath bleed through visibly

- **Fixed, confirmed live**: the previous fix made the player's own background transparent so the color ambience could show through — but nothing behind it was actually fully opaque (the page-dim layer is only ~80% black through a blur, and the color layers themselves stack several partial-opacity effects with no solid base). The real library page ended up visibly readable through the letterbox bars — worse than the flat black it replaced. Added a permanent, fully opaque base layer underneath everything else, so the page can never show through again, with or without a title's artwork available for the color extraction.

## v1.12.76 — August 2026

### Theater Mode's content-adaptive backdrop was invisible — fixed, and rebalanced for real visual impact

- **Fixed, confirmed live**: the color ambience extracted from each title's own artwork was structurally hidden — the actual video player's own background was fully opaque, painted on top of the ambience layer, so the color only ever flashed for an instant during the opening animation before disappearing completely for the entire time spent watching. On top of that, the ambience layer itself carried a second near-opaque black scrim stacked directly on the color gradient, crushing what little showed through during that instant to almost nothing. Net effect: flat black regardless of the title's artwork.
- The player's background is now transparent where it's meant to show the backdrop through, and the scrim/gradient balance was reworked so the extracted color is actually visible in the letterboxed areas around the video — a bright, colorful poster now visibly tints the theater, a dark one stays moody, instead of everything looking identical.

## v1.12.75 — August 2026

### Root cause of a completed season-pack download that never showed up in the library

- **Fixed, confirmed live**: investigated a specific case (an anime whose season packs had fully downloaded — the queue showed them "completed" — but none of the episodes ever became available). The root cause: some season-pack releases name their episode files after the show in a heavily abbreviated or non-standard form the title parser can't recognize (in the confirmed case, an acronym sharing no words with the real title) — so when the completed download's files failed to match any tracked episode, they were correctly *not* deleted, but the recovery pass that's supposed to catch exactly this case only recorded the miss in a value nothing ever read, so the files sat there indefinitely with zero visibility.
- The recovery pass now records these the same way a truly-unlinked manual download already does: they show up in Activité → Non liés, where they can be manually pointed at the right title — generically, for any release whose name the parser can't confidently map, not specific to the one show that surfaced it.

## v1.12.74 — August 2026

### Matching bug that could grab the wrong show, and a job-queue stall that could silently freeze all background searches

- **Fixed, confirmed live**: the title-matching score treated two titles as near-identical based on raw character distance alone, even when they differed by one completely different word — confirmed live with "How I Met Your Father" (an unrelated spin-off) scoring ~91% similar to a search for "How I Met Your Mother" and getting grabbed in its place. The scorer now also checks word-by-word: a wholesale different word (not a spelling variant) is disqualifying regardless of how close the overall character count looks.
- **Fixed, confirmed live**: a single stuck background task (in this case a slow Plex sync) could occupy a job-queue slot indefinitely, silently blocking every other queued job behind it — including scheduled and manual searches — for as long as it stayed stuck, with no error or indication anything was wrong. This is what could leave a monitored, correctly-added title never actually searched. The queue now frees a job's slot after 10 minutes if it hasn't finished, so a single hung task can no longer starve everything behind it.

## v1.12.73 — August 2026

### Beta player — direct play now starts the way the manual "lightning bolt" retry always worked

- **Fixed**: the player used to decide whether to attempt direct play by pre-checking codec support with browser APIs that are known to lie for common cases (AC-3/E-AC-3 always reporting "unsupported" on Chrome/Edge, some containers reporting decodable video as unsupported) — routing many files to a transcode or WebCodecs fallback that direct play would actually have handled fine. Confirmed live: the manual retry button, which always attempted direct unconditionally with no such pre-check, worked noticeably better.
- Direct play is now the unconditional first attempt on every video, exactly matching what the manual retry already did — the two are now literally the same code path, sharing the same automatic recovery (falls back to the other playback mode on a real playback error or on genuinely silent audio, unchanged from before).
- The manual retry button now benefits from that same automatic recovery too, and resumes from the current position instead of restarting from zero.
- Removed the now-fully-unused WebCodecs playback path this pre-check used to route into — it was strictly a worse, redundant version of what direct play + the existing fallback chain already cover.

## v1.12.72 — August 2026

### Theater Mode — a real immersive player, not a video in a modal

- **New**: the Beta player now opens in a full "Theater Mode" — the current page stays exactly where it was behind it (scroll position, state, everything), the player expands from the button you clicked with a genuine geometric transition (not a fade), and the page behind dims and blurs progressively rather than just disappearing.
- Any ambient trailer or preview playing anywhere on screen stops the instant the real player opens — never two videos playing at once.
- The player's backdrop now takes on a subtle color ambience extracted from the title's own artwork (dominant tones, brightness-aware) instead of being flat black — analyzed once per title and cached, never during playback.
- "Lire dans Plex" now reads "Lire" wherever the Beta player will actually handle playback, and stays "Lire sur Plex" wherever it's a genuine hand-off to Plex — consistent across every title card, the title page, the episode page, and the dashboard hero (which previously had no Beta player integration at all).
- The three separate copies of this trigger logic across the app are now one shared implementation, closing the gap where a future fix could land in one place and be missed in the others.

### In-app "what's new" now follows your interface language

- Release notes are now localized per UI language (falling back to English for anything not yet translated), instead of a single fixed-language file.
- **Fixed**: the release notes were silently missing on both the Docker and Windows builds — the file they're read from was never actually included in either packaged build, so the "what's new" popup had nothing to show.

## v1.12.70 — August 2026

### Download engine — root cause of permanently unlinked downloads

- **Fixed, confirmed live**: removing a torrent from the download engine reported success and wiped its own tracking (including which library title it belonged to) even when the underlying download client silently failed to actually remove it — the torrent kept running and seeding untouched, but the engine had no record of it anymore. This is what produced downloads that could never be linked back to a title no matter how many times a recovery scan ran. The engine now only clears its own bookkeeping once removal is independently confirmed; otherwise the torrent stays tracked and can be retried instead of turning into a permanent orphan.

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
