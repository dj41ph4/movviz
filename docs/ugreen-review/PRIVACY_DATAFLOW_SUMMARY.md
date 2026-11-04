# MOVVIZ — Privacy data-flow summary (audit of the source code)

Audited version: see `package.json` at the tag being reviewed. Method: source search
for analytics/telemetry libraries and keywords, review of the dependency lists
(`package.json`, `engine/package.json`), inventory of every outbound host referenced by
`src/` and `engine/src/`, review of persisted stores, cookies/local storage, deletion and
reset routes. The public policy (`/privacy`, source: `src/lib/legal/content.ts`) only states
what is listed here.

## 1. Stored locally only (server, in the configuration folder `/config`)

| Data | Where / form |
| --- | --- |
| User accounts (username, role, scrypt password hash, linked Plex id/token/avatar) | `users.json` |
| Sessions | cookie `movviz_session` (HTTP-only, SameSite=Lax), server-side session store |
| Library (movies, series, file paths), requests, watchlist, ratings, history, resume positions | JSON stores |
| Settings and **credentials/API keys** entered by the administrator | JSON stores, **plain text, not encrypted** |
| AI assistant conversations and taste profile (only if the assistant is enabled) | local store / SQLite |
| Logs and diagnostics (container output, engine output, search/activity logs) | local only |
| Consent proof (policy version, date/time, account) — UGREEN package only | `privacy-consent.json` |

Browser storage: the session cookie, plus preference keys (`movviz.locale`, `movviz.deviceId`,
`movviz.recentSearches`, UI options). No advertising or tracking cookies.

## 2. Telemetry / analytics

Result of the audit: **none found**.

* No analytics, advertising, crash-reporting or tracking dependency in `package.json` /
  `engine/package.json` (runtime dependencies: clsx, dashjs, framer-motion, hls.js,
  lucide-react, mp4box, next, react, react-dom, swr, tailwind-merge, webtorrent).
* No telemetry keyword in `src/`, `engine/src/`, `public/` (the only hits are the English
  word "plausible").
* Next.js telemetry is disabled in the image (`NEXT_TELEMETRY_DISABLED=1`).
* Logs and diagnostics are never uploaded automatically.

Single project-related outbound call: GitHub releases API
(`https://api.github.com/repos/dj41ph4/movviz/releases/latest`), made while an
administrator has the interface open (periodic) or checks manually. No account data is sent.

## 3. Third-party services (only when configured or used)

| Service | Data sent | Trigger |
| --- | --- | --- |
| TMDb (`api.themoviedb.org`, `image.tmdb.org`), TheTVDB, OMDb | titles, ids, searches + the administrator's API key | metadata; images by browser only if "CDN images" is enabled |
| TheIntroDB (`api.theintrodb.org`) | TMDb id + season/episode of the title being played (only in "All" / "API only" mode or when Plex is not linked) | intro/recap/credits/preview timings; no user, account or file data |
| Plex (`plex.tv`, `app.plex.tv`, Plex metadata providers) | sign-in, watchlist, library linking | administrator connects Plex |
| Indexers (Torznab/Newznab, trackers) | search terms, release requests, credentials | administrator configures an indexer |
| Import lists (Trakt/IMDb/Letterboxd URLs) | the list URL fetched by the server | administrator adds a list |
| AlloCiné, anime VF calendar (`mang-actu.com`) | plain GET requests by the server | discovery rows |
| Apple iTunes search, YouTube embed | title in the search; the browser connects to Google/YouTube when a YouTube trailer plays | trailers |
| Discord, Slack, Telegram, Pushbullet, Gotify | notification text (titles, user names) | administrator configures a channel |
| Google Gemini (own key), Tavily (optional) | user messages + needed library context | AI assistant (off by default, no key shipped) |
| Seerr | requests/status | administrator connects Seerr |
| BitTorrent peers/trackers | public IP address (inherent to the protocol) | download engine in use |

Links to Rotten Tomatoes, Letterboxd and IMDb on title pages are plain links opened by the user.

## 4. Credentials

API keys and tokens are stored in clear text in the configuration folder; the policy says so and
asks the administrator to protect the folder. Nothing is shipped in the package.

## 5. Deletion and control

* Delete a user: Users page (`DELETE /api/users/[id]`).
* Reset a profile's viewing history/resume: profile page.
* Remove/replace a stored key or token, disconnect Plex: Settings.
* Export a configuration backup: Settings > About.
* Factory reset (erases MOVVIZ data): Settings > Danger zone (`POST /api/system/reset`).
* Uninstalling the UPK does not delete the user-selected configuration and media folders.

## 6. Consent

Only the UGREEN package sets `MOVVIZ_REQUIRE_PRIVACY_CONSENT=1`. Then: an unticked checkbox with
links to the policy and the GPL license is required to create an account (setup wizard, login
registration, first Plex account), the server refuses account creation without it, and the policy
version plus date/time are recorded in `privacy-consent.json`. Optional integrations are never
enabled by the consent. All other distributions are unchanged.
