## v1.28.8 — 29 October 2026

### Player

- Audio and subtitle tracks of episodes Plex has not scanned yet are now read from the file: the Audio menu lists every language and French is picked by default.

## v1.28.7 — 29 October 2026

### Library

- Removing an episode whose file was already deleted now removes the library entry instead of showing an error.
- A button on the series page checks every file and removes from the library those that have disappeared.

## v1.28.6 — 29 October 2026

### Desktop title pages

- Movie and series page videos adopt the hero presentation, with rounded corners, border, gradients and ambient glow.

## v1.28.5 — 28 October 2026

### Android TV

- Remote navigation uses the system navigation sound.
- Back closes the audio and subtitle track menus.
- Restores the direct playback retry after a decoding error on resume from pause.

## v1.28.4 — 28 October 2026

### Android TV

- Restores playback behavior from version 1.28.1 while retaining the return to profiles after sleep.

## v1.28.3 — 28 October 2026

### Setup and playback

- Reset clears accounts, settings, library records and history while keeping movie, series and downloaded files.
- The Synology package includes FFmpeg, FFprobe and the resolver; DSM compatibility remains to be checked on each architecture.
- Android TV retries direct playback after a decoding error immediately following a pause before falling back to transcoding.
- The Windows build checks the FFmpeg download and retries on failure.

## v1.28.2 — 28 October 2026

### Setup and playback

- Setup offers library and download folders, free space and import of existing files. Configured paths are preserved.
- Searches prefer seasons and episodes before complete series packs. Identified active session titles open their details.
- After TV sleep, Movviz returns to profile selection. Full reset is temporarily disabled to protect media files.

## v1.28.1 — 28 October 2026

### Settings

- Updates settings search after the Discover simplification in version 1.28.00.

## v1.28.00 — 28 October 2026

### Setup and downloads

- The setup wizard offers a local or Plex account, country, subtitled original versions and the folders where movies and series are stored. Plex is optional. New defaults do not replace existing settings.
- Dashboard suggestions appear with an empty library. Full series packs are labelled in the queue; an automatic pack clearly missing the requested episodes is removed without deleting its files before another search.

## v1.27.81 — October 28, 2026

### NAS

- Fixed the UGREEN UPK manifest so the official `ugcli` check accepts the minimum firmware version. NAS packages still build from the same Movviz source and attach to this release. The Synology SPK remains experimental until tested on a real DSM NAS.

## v1.27.80 — October 28, 2026

### NAS

- Added UGREEN UPK (Docker App) and native Synology SPK packages, built by GitHub Actions from the same source and published with the other files of each version. The SPK is experimental pending real DSM testing; some FFmpeg or Playwright features may be unavailable.

## v1.27.79 — October 27, 2026

### Android TV and Android

- Coming back to Movviz after going through the Android menu during a series now resumes the episode you were on, at its position. When Android had closed the app in the background, the player restarted from the episode first launched (and its old position) instead of the one reached by playing episodes in a row.

## v1.27.78 — October 27, 2026

### Movviz AI

- Requests with criteria are now run against real TMDb data instead of the model's memory: period ("from January 1, 2025 to today", "since", "before", "in 2025"), production or co-production country ("Belgian film"…), the number asked for and "highest-rated" ordering. Titles outside the period or country are no longer suggested, and both the country and the date are re-checked on each title. Films with no French title (a Flemish film, for example) show their English title, with the original title mentioned. The reply language follows the message language more reliably: a quickly typed French request no longer falls back to the account's language. A message right after a list ("what's the release date of the first one?") is taken into account again: only real complaints ("you didn't follow my conditions") reuse the previous list's criteria. A short complaint ("you didn't follow my conditions") reuses the criteria of the last request.

## v1.27.77 — October 27, 2026

### Android mobile and TV

- Remove a title from "Continue watching": on mobile, long-press the card; on TV, long-press OK (or press Menu or Info) on the card. A simple confirmation asks to remove it: the playback in progress is cleared (Movviz and Plex), progress starts again from zero and the title is not marked as watched. For a series, only the episode in progress is affected. Your other devices update.

## v1.27.76 — October 27, 2026

### Android mobile

- Tablet: the right-hand panel ("In progress" and "Completed") is gone, so the content keeps the full width. The left sidebar is larger: icons, labels, logo and avatar. The unfolded Fold and phones are unchanged.
- Home: a little space between the top image and the "Platforms" rail.

## v1.27.75 — October 27, 2026

### Android mobile

- Tablet and landscape: the "Platforms" rail now appears on the home screen (it only existed in portrait, so no platform was reachable). The square icons are sized for large screens and open the platform's categories page, as on Android TV. Phone portrait is unchanged.

## v1.27.74 — October 27, 2026

### Maintenance

- Stronger code quality checks: 44 style errors fixed without changing behavior, and any new error is now rejected automatically.

## v1.27.73 — October 27, 2026

### Platforms

- Netflix now has as many categories as Disney+: Netflix Originals, Studio Ghibli, Spain and Latin America, United Kingdom and German productions join the common categories.
- Discover (desktop): choosing a platform shows the same categories as on mobile and TV. The "All" tab mixes movies and series; "Movies" and "Series" each show only their own type. "See all" opens a category's full grid.
- Mobile: a platform's categories appear right away, with empty slots that fill in. Each row shows 8 posters then grows as you scroll; the next ones and their posters are preloaded.

### Android TV and mobile

- Loading a title page: the title's logo in the center of the screen with a loading bar underneath, instead of the flashing silhouette.

### Plex

- The list of episodes watched in Plex without a Movviz entry now includes every account's views, with "Watched by". "Link to Plex" now really links the episodes of a series already in Movviz, without touching their files or status.
- An ignored series no longer produces any warning in the log.

## v1.27.72 — October 27, 2026

### Plex

- New list in Settings → Plex: series with episodes watched in Plex (by the server owner) that have no entry in the Movviz library. Tick the ones to add: adding starts no download search and links the episodes to Plex. Nothing is added automatically, and a series can be ignored so it is no longer suggested.
- Series already in Movviz whose episodes are not linked to Plex can be linked in one click.

## v1.27.71 — October 27, 2026

### Queue

- A queued task now says why it is waiting: a user's activity (and on which page), a page still loading, a playback in progress, a heavy task already running, or a free slot to wait for.
- New "Force start" button on every queued task: it goes ahead of user activity and playbacks. Two heavy tasks still never run together: in that case the reason is shown.
- The diagnostic log notes, at most every 5 minutes, why a heavy task is still waiting.

## v1.27.70 — October 27, 2026

### Android TV

- The Beta interface becomes the only Movviz TV interface: the "Beta interface" choice is removed from Settings and the Beta look applies from launch.

## v1.27.69 — October 27, 2026

### Plex

- Plex watch sync now reads the library through section listings instead of about 1,500 requests (one per series, then batches of 50 items): much less load on Plex and on the server. If a listing looks incomplete, it falls back to the previous scan, identical to before.

### Player

- When the server restarts during an update, the desktop player waits for it to come back (under a minute) while showing the loading state, instead of saying you have to play it in Plex.

## v1.27.68 — October 27, 2026

### Android TV

- Title pages open faster: the page is requested at the same time as everything else instead of waiting for the library, and it is preloaded after 300 ms on a tile (from search too).
- When you come back from a movie or an episode, the home screen no longer freezes: the personalized rows are reloaded 15 s after playback ends and no longer block the interface.

## v1.27.67 — October 27, 2026

### Settings

- Search now finds a setting by its content, not just by the tab title: every word you type must appear in the tab's labels and descriptions, ignoring accents and word order. The matching setting is shown under the title.

## v1.27.66 — October 27, 2026

### Scheduled tasks

- Each task can now start only within a time window (for example between 4 AM and 6 AM) without changing its interval. Set it in Settings → Tasks; the time is the server's.

### Diagnostics

- Server freezes now record what was running at that moment (movie or episode being searched, folder being scanned), the memory in use and garbage-collector pauses. Incidents of at least 1 s are kept in a file that survives restarts.

## v1.27.65 — October 26, 2026

### Indexers

- Restored the indexer and resolver behavior from before the previous three versions.

## v1.27.61 — October 27, 2026

### Home

- Genres shown in the home spotlight (Animation, Action & Adventure…) now share the grey background of the "Why this title?" reasons.

## v1.27.60 — October 27, 2026

### Home

- "Coming soon" no longer shows documentaries: only announced fiction films.

## v1.27.59 — October 27, 2026

### Android TV and Samsung

- "Are you still watching?" like on Netflix: after two episodes played back to back with no remote input, the next episode waits for your answer (Continue watching or Stop). With no answer nothing plays and the TV's sleep mode resumes normally. Any remote key resets the count; nothing changes while you use the remote.

## v1.27.58 — October 27, 2026

### Android

- Android home: Platforms tiles now show real square icons for every service (Netflix, Disney+, Prime Video, Max, Apple TV+, YouTube, Crunchyroll, OCS), bundled in the app, instead of the "YO" and "OC" initials when the remote logo was missing.

## v1.27.57 — October 27, 2026

### Home

- New "Coming soon" row on every home screen (web, Android TV, Android, Samsung): every film announced for the next twelve months (known release date and poster), in release order, with the same cards as every other row. Projects dated more than a year out, often hypothetical, are left out.
- "Your upcoming releases" keeps your requests not out yet, right after it, with the same name everywhere (Android TV called it "Coming soon"). Samsung now shows both rows.

## v1.27.56 — October 26, 2026

### Player

- Resume no longer goes back to 0: a stream cut before the end of the film (server restart, connection dropped during a long pause) was taken for the end of the film, which was marked watched and lost its position, in Movviz as well as in Plex. The player now restarts the stream at the same second, and only a real ending counts.
- No more "Cannot play this video in the browser" when resuming after more than 5 minutes of playback or pause, or after a server restart: playback picks up on its own at the exact spot.
- Closing the player on "Resume?" or after an error no longer resets the resume position to 0.
- The quality actually displayed (4K, 1080p…) and the dynamic range (HDR10, Dolby Vision, HLG) now appear above the progress bar.

## v1.27.55 — October 26, 2026

### Platforms

- Platform pages (Android TV and Android): New releases show popular titles from the last six months in Europe and the US; Korean and French content have their own rows.
- Every category filters out obscure titles, and new rows arrive for all platforms: Superheroes, Based on a true story, Romantic comedies, Under 1 h 40, Epic films, the 2010s, 2000s and 90s, Great classics.
- Disney+ gets dedicated rows: Marvel Universe, Pixar, Star Wars, Disney Classics and National Geographic.
- Rows are twice as full on opening, with a server cache so they stay instant.
- Discover on desktop: a platform's "For you" sort keeps your recommendations first, then continues with the platform's whole catalogue ranked by your taste, instead of stopping after a few titles.

## v1.27.54 — October 25, 2026

### Search and Android TV

- A release whose title adds words to the searched title is no longer taken for it: "The Odyssey" (2026) had downloaded "Space Cadet" ("L'Odyssée de Céleste", 2026), same year but another film. The legitimate "French title + original title" case (L.Odyssee.The.Odyssey.2026) is still recognized.
- A title page on Android TV no longer shakes when moving from one button to another.

## v1.27.53 — October 25, 2026

### Platforms on Android TV and Android

- Opening a platform (Netflix, Disney+, Prime Video…) now shows a real page by category: Trending, New, Top rated, then Action and adventure, Comedies, Anime, Sci-fi, Crime and thriller, Dramas, Family, Horror, Romance, Documentaries and many more.
- Movies and series are smartly mixed in each row: the most relevant title comes first, never more than two movies or two series in a row. Netflix finally shows its series, which were missing until now.
- Each row loads as it comes into view, extends endlessly to the right and ends with "See all"; on mobile, "Picked for you" stays at the top.

## v1.27.52 — October 25, 2026

### Platforms on Android TV

- A platform grid ("On Disney Plus"…) no longer jumps or freezes while scrolling down: each loaded page sent focus back to an already-passed card. Focus now stays on the chosen card, same column.
- The home Platforms row has moved up, right under the first row.
- Transparent logos on Android TV and Android: platform logos (and PNG title logos) no longer show on a black rectangle, and a platform's header uses the same brand logo as the tiles.

## v1.27.51 — October 25, 2026

### Profile on Android TV and Android

- The profile no longer crashes when scrolling down to history: a title watched several times appeared twice, which crashed the row. History now shows each title only once (the most recent viewing).

## v1.27.50 — October 25, 2026

### Profile on Android TV, Android and Samsung

- The profile no longer gets stuck on "Loading your activity…": the server sent an empty date for ratings, which the Android apps rejected entirely. The server now sends the real date and the apps tolerate this case; on failure, a Retry button replaces the endless loading.
- TV profile redesigned: ringed avatar, name, account role and five real counters (in progress, movies watched, series watched, in my list, ratings given), then Continue watching, My list, History and My ratings — same order on mobile and Samsung, which also gains its counters and ratings.
- Resuming an episode now opens that episode, and history shows the episode title.

## v1.27.49 — October 25, 2026

### Trailers

- The fallback YouTube search now only accepts a video whose title contains the movie's title: "The Good, the Bart, and the Loki" no longer picks up the Loki series trailer. Already-cached results are recomputed.

## v1.27.48 — October 25, 2026

### Downloads

- Re-downloading a release that had already been imported and then seeded no longer fails instantly: the link left in the download folder to the library file, broken once that file was deleted, is removed before writing.

## v1.27.47 — October 25, 2026

### Downloads

- Re-grabbing an already-imported release whose file was deleted (or replaced by another version) now really restarts the download: the engine answered "already imported" without downloading anything, and the title stayed "downloading" without showing up in the queue.

## v1.27.46 — October 25, 2026

### Subtitles and playback

- Text subtitles selected in the desktop player display again: they were extracted but stuck in an ffmpeg buffer, and the player never requested them from the new engine. Track labels no longer show redundant release titles ("FR Full : SRT").
- Movies whose recorded path is the one Plex sees (e.g. /volume1/...) play again: the path is translated to Movviz's own, otherwise playback goes through the Plex source instead of failing.
- Plex ↔ Movviz path mapping: a mapping that leads to a missing folder is ignored, then removed as soon as a real file contradicts it; manual entry rejects a missing Movviz folder; and the automatic suggestion works when both roots share a single folder (/volume1/docker/plex/films ↔ /data/films).

## v1.27.45 — October 25, 2026

### Playback from cards

- On the dashboard, in the library and in Discover, cards show + outside the library, a clock when the file is missing, and Play as soon as a local movie is available, without waiting for Plex.
- The home hero Play button and the episode page Play button also work as soon as the local file exists, without a Plex link.
- Clicking the image opens the title details; only the Play button starts playback.

### Audio and subtitle tracks

- Player menus (web, Android TV, Android mobile, Samsung) now show language, codec and channels (e.g. "French · E-AC-3 5.1"), plus the track title and a Forced tag for subtitles.
- Tracks are read from the file itself: a title without a Plex link now has its audio and subtitle menus, and switching track restarts the local engine.
- Automatic subtitles (profile setting, off by default): when the audio being played is not in the profile language — the interface language picked with the flags — subtitles start in that language. The setting is tied to the account: changing it on Android changes it on desktop, TV and Samsung.
- The default audio language follows the profile language while set to Automatic; on Android this setting was never applied during playback, which is now fixed.

## v1.27.44 — October 25, 2026

### Manual port forwarding

- On every platform, the engine and WebTorrent no longer create UPnP/NAT-PMP rules. TCP peer and UDP DHT traffic use the configured port for manual forwarding.
- Any existing rule or reservation on the router or NAS must be removed there; this update does not change that device's configuration.

## v1.27.43 — October 25, 2026

### Manual Docker port forwarding

- In Docker, Movviz and WebTorrent no longer attempt UPnP/NAT-PMP mappings. Docker published ports and router forwarding remain manual; native installations retain their existing behavior.
- DHT UDP now listens on the configured WebTorrent port, so TCP and UDP forwarding match the actual listeners.

## v1.27.42 — October 25, 2026

### Configurable WebTorrent ports

- Download client settings now let admins choose separate WebTorrent ports for movies and series. Values are validated, retained across restarts, and applied by restarting the torrent client without clearing the queue.
- Docker host port publishing remains an external setting, explained beside the new control.

## v1.27.41 — October 25, 2026

### Automatic search and recent arrivals

- Automatic search tries the original title, then the localized title and one alias when no eligible result is found. Indexers remain sequential and quality rules still apply.
- The Hero confirms an addition only after a valid response and distinguishes a pending request from an added title.
- Movies requested long ago appear in Recently Added when their file arrives. Library shelves and recent sorting also use the availability date.

## v1.27.40 — October 25, 2026

### GPU/iGPU access on Docker NAS systems

- The Compose launcher detects `/dev/dri/renderD128` on the NAS and gives Movviz access to the device and its group. Systems without a usable GPU still deploy normally and keep CPU transcoding.
- Docker device mapping is applied when the container is recreated; the guide covers image updates and manual setup in Container Manager.

## v1.27.39 — October 24, 2026

### More responsive downloads

- Opening Downloads now shows the page structure immediately. Only the selected tab mounts, so History no longer displays the queue loader or its panel on large screens.
- The queue loads more rows on scroll. Its updates and the WebTorrent panel stop polling when the page is in the background or another tab is selected, while remaining responsive during active downloads.

## v1.27.38 — October 24, 2026

### Downloads, images and settings

- The queue shows current downloads first and keeps completed and seeding torrents in their filters. A brief WebTorrent outage retains the last known queue instead of clearing it.
- History loads only the open tab, shows 50 events, then loads more on scroll. Other tabs avoid background requests.
- Known images and logos display from the browser cache, separated by language. Missing artwork loads in small batches through the server cache; recent additions and resumes come first.
- The animations setting also disables Hero ambilight and automatic rotation. The separate Hero video setting stops its player immediately; manual playback remains independent.
- Monitored upcoming movies now enter automatic search on addition, scheduled retries and RSS matching. No release before the date keeps their upcoming status without a false error.

## v1.27.37 — October 24, 2026

### Instant recent additions and playback resumes

- Recent additions now come solely from the Movviz library and appear in the same order for every profile, without personal filters or the Hero year limit. Series are ordered by their latest available episode.
- Adding a movie or series refreshes the home screen on web, Android TV, and Android mobile. The first available episodes of a series also refresh the recent rows.
- Continue Watching returns Movviz positions immediately. The first five verified Plex resumes and subsequent batches arrive in the background and update Android apps too.
- Playback and progress reporting no longer wait for Plex network calls. Imports still trigger a background Plex scan and metadata reconciliation shortly afterward.

## v1.27.36 — October 24, 2026

### Movviz AI optimization

- Movviz AI optimization.

## v1.27.35 — October 24, 2026

### Episodes and Plex watchlist

- Admins can remove an episode from its detail page, with a separate option to delete its file. Files shared by episodes are protected. Removed episodes no longer enter automatic search or get reattached by Plex sync.
- “My List” syncs movie and series additions and removals both ways with the personal Plex Watchlist. Movviz changes are sent after the response so the page stays fast, and scheduled sync retries failures. Conflicts use change times; a Plex removal without a timestamp is dated when observed.

## v1.27.34 — October 24, 2026

### Responsiveness during automated tasks

- Scheduled recovery of unimported downloads still runs every 15 minutes, but now runs alone among heavy tasks, waits until startup settles, and yields to interface or player use. Manual recovery remains immediate.
- Seerr import only deduplicates the whole library after it actually adds an approved request. Daily reconciliation remains active.
- Non-Latin original titles no longer create false homonyms: automatic search accepts matching yearless releases while protecting real homonyms. Failures now identify the filter that rejected the results.

## v1.27.33 — October 24, 2026

### Plex resumes and responsiveness

- Full Plex watch-state collection runs in a dedicated worker. Existing states are replaced only after a complete, validated snapshot arrives.
- Scheduled Plex watch and history syncs are treated as heavy tasks: they no longer overlap another heavy task and wait until playback ends.
- Opening a title still triggers quick watch-state verification without starting a full snapshot.
- On Deck shows local resumes after at most two seconds of waiting for Plex. The first five Plex resumes then arrive automatically, followed by the rest progressively with fewer repeated passes.

## v1.27.32 — October 23, 2026

### Player and interface priority

- Heavy automatic jobs wait until playback in the Movviz player ends and user activity settles before starting. They stay queued and resume afterward.
- A heavy automatic job runs alone among automatic jobs; the automatic benchmark no longer overlaps Plex sync or Seerr import. The Benchmark button also uses this queue and shows when it is waiting. Direct user actions and immediate acquisition retain priority.

## v1.27.31 — October 23, 2026

### Double episodes by season

- In Edit title, each season offers a Double episodes switch beside its folder. It links each file to two catalog episodes and can be disabled per season.
- New packs are detected automatically only when file count, numbering and durations confirm the double format. FINAL helps but is never sufficient alone.
- Movviz shows covered episodes as available, plays their shared file, marks both watched at completion and continues to the next file. Disk videos are not renamed.

## v1.27.30 — October 23, 2026

### Dashboard hero

- Ambilight waits for its YouTube video copy to confirm its position before showing the glow, then hides and realigns if the two videos drift apart.
- The dark veil at the top of the hero is removed, preserving the video's and ambilight's colors along the upper edge.

## v1.27.29 — October 23, 2026

### Loading and Plex Continue Watching

- Continue Watching shows the five most recent Plex resumes first, then fills in the rest progressively in the background on connected devices.
- RSS matching and automatic downloads continue to run, but this phase now waits its turn among heavy jobs to limit server stalls.
- Diagnostics group consecutive similar stalls and no longer display a measurement stack as an error.

## v1.27.28 — October 23, 2026

### Performance and diagnostics

- Library reads already served from the cache no longer create a call stack and two timeline events each. This removes measurement overhead from a path called very frequently.
- Slow disk access while checking JSON files is now logged alongside slow JSON decoding. Global freezes and background tasks remain measurable.

## v1.27.27 — October 23, 2026

### Recently added episodes

- Episodes added to the library remain visible independently of the download list. A purge waits for import confirmation before deleting the information needed to match the files.
- Recent additions load page by page as you scroll, without a permanent 150-file limit. A batch of episodes from the same series occupies a single card on desktop, Android TV, and Android mobile.
- Purging downloads shows the items it could not remove instead of artificially clearing the list.

## v1.27.26 — October 23, 2026

### Android TV: Beta interface and player

- The Beta interface's sidebar and text are smaller, while remaining slightly larger than in Stable mode.
- Moving between the hero buttons no longer repeatedly recenters the page.
- The brief white outline has been removed from the loading screen.
- The player's audio and subtitle options remain readable when selected with the remote control.

## v1.27.25 — October 23, 2026

### Diagnostics: See what freezes the server

- Settings now lists every server freeze with its duration, its type (blocked computation or waiting for an external service), and the operations running at that exact moment.
- A timeline of measured windows shows background tasks overlapping, such as indexer scans, Plex synchronization, request imports, and download reconciliation.
- Indexer scans distinguish computation time (loading libraries, comparing releases) from waiting time (searching and downloading through indexers).
- Each window records the code location where it was opened, so the source of a slowdown can be found directly.

## v1.27.22 — October 22, 2026

### Acquisition: Distinguishing homonymous series and searching upon addition

- Two library series with the same name but different years, such as Scrubs (2001) and Scrubs (2026), now require an explicit year corresponding to the correct series before an automatic download. Ambiguous episodes, season packs, and full-length features are excluded.
- Direct searches for homonymous series include their year and use TMDb, IMDb, or TVDB identifiers when the indexer supports them.
- The approved addition of a movie or series triggers a search in a dedicated area, even when background tasks occupy the regular queue. If an admissible release is found, it is sent for download without waiting for a scheduled task. Acquisitions remain sequential and duplicates are avoided.
- Additions from the AI assistant use the same workflow. Requests requiring approval retain their prior validation.

## v1.27.21 — October 22, 2026

### Desktop: Plex connection via QR code

- The "Connect with Plex" button displays a QR code to scan with a smartphone and a short code usable on plex.tv/link.
- The desktop waits for validation on the smartphone, then automatically opens the connected profile, without additional clicks.
- The usual Plex connection in the browser remains accessible to the right of the QR code. An expired code can be renewed, and closing the window stops the waiting.

## v1.27.20 — October 22, 2026

### Windows: Startup check and update diagnostics

- The installation check waits for the Movviz and Movviz Update services to be active and for the server to respond with the expected version, instead of failing on a transient startup status.
- Service logs are recorded in the designated folder. Windows diagnostics are grouped before sending to avoid the error related to files spread across multiple drives.
- The actual update test can be launched from a branch: it checks the restart of Movviz and the maintenance of the Movviz Update process during installation.

## v1.27.19 — October 21, 2026

### Home: My list on desktop, Android TV, and Android mobile

- The personal list appears in the fourth block by default, before "To review," with the most recent additions on the left.
- It picks up existing cards and refreshes when the list changes on another device. Visibility preferences are retained.
- The Tizen application will be updated later.

### AI Assistant: Title identification and fact-checking

- The assistant first searches the library and recognizes the same title with or without spaces, such as Vision Quest and VisionQuest. Type and year corrections are retained, and links reuse the verified identity.
- A web or release date verification request triggers a search when activated. The assistant distinguishes between an announced date and a confirmed release and indicates when verification is unavailable.
- A simple check can no longer trigger an automatic addition, even if the model produces an incorrect action.

## v1.27.18 — October 21, 2026

### Desktop: Recently added episodes grouped like on Android TV

- On the Home and Series library, several recently added episodes from the same series are grouped into a single season card.
- The badge indicates the number of unwatched episodes for this season and turns into a checkmark when everything is watched. A standalone added episode keeps its number and direct playback.
- The grouping precedes the card limit: a season imported in bulk no longer obscures other recently enriched series.

## v1.27.17 — October 20, 2026

### Interface: mobile and tablet theme, banner and navigation

- The Beta theme extends to phones and tablets with consistent colors and surfaces, a more readable banner, and compact actions. Counters are removed from the home screen.
- On desktop, ambient lighting extends the banner's colors and follows the playback of its trailer.
- Language selection is accessible in the user menu on all screens. The margins of the detail page, counter labels, and the accessibility of the 'close new' button have been adjusted.

### Windows: Update service protection

- The installer disables automatic application closing by Windows to preserve the Movviz Update service during installation.
- PowerShell downloads mask their progress, and the CI installation control has more precise delays and diagnostics.

## v1.27.16 — October 20, 2026

### Series: new episodes are finally retrieved

- The episode list for a series was only built at the time of addition: episodes and seasons announced later (e.g., season 4 of Link Click, which remained at 1 episode out of 12), as well as titles and dates of episodes published afterwards, were never retrieved.
- A new scheduled task, "Series Episode Update," runs once a day: it adds missing episodes and seasons (new seasons only for followed series) and updates titles, broadcast dates, and season names. Already released episodes become searchable; others await their broadcast date.
- Nothing is ever deleted: files, downloads, and Plex links remain intact, and series whose numbering differs from TMDb (some anime) are not modified.

## v1.27.15 — October 20, 2026

### Sidebar: readable update button with accessibility zoom

- With enlarged text (110% or 120%), the "New update available" button was overflowing the sidebar. It now displays a short label ("Update v1.27.15") and expands if necessary instead of overflowing; the full text remains visible on hover.

## v1.27.14 — October 20, 2026

### Trailers: a replacement video when YouTube blocks playback

- Some official trailers cannot be played outside of YouTube (this is the case for Toei's Dragon Ball Super: Beerus). When all videos for a title are rejected, Movviz now searches for another trailer, prioritizing official channels and anime publishers (Netflix, Crunchyroll…).
- Rejected videos are remembered and are never proposed again, whether on the web or on Android applications.

## v1.27.13 — October 20, 2026

### Home: series appear in the banner

- The home banner only featured movies: it now also highlights series, alternating with movies. A new series that Movviz knows you like therefore appears as soon as it is released.
- In the library section, the banner takes into account unwatched series, recently added ones, those with a newly arrived episode, and the next episode to be released for followed series.
- Also benefits Android TV and Android mobile applications, without an update from them.

## v1.27.12 — October 20, 2026

### Home: brighter and clearer banner (desktop)

- The banner image is much clearer, with a slight shadow under the texts to keep them legible.
- Technical badges (4K, HDR, MULTI, TrueHD…) are on their own line, under the genres.
- "Information" becomes "More info", the Play button icon is solid, and the button text is slightly larger.
- The reasons for the suggestion are permanently displayed in the bottom right, below the scroll arrows, replacing the "Why this content?" button.
- The sound button moves to the top right, with a thinner line; it is clickable again.

### Interface

- The Beta theme is now the sole appearance for Movviz: the choice between Stable and Beta has been removed from settings.
- Narrower sidebar, links moved up a notch and icons aligned identically, whether the sidebar is expanded or collapsed. The button to collapse or expand it is now at the bottom, above the profile.

## v1.27.11 — October 20, 2026

### Fuzzy search on Android TV, Android mobile, and Samsung

- Android TV, Android mobile, and Samsung apps now display "Results for …" when a typo has been corrected, like on the web.
- On Android TV, the correction also finds titles already present in the library.

### Web interface

- Fixes display errors when loading pages: interface startup elements are now placed in the correct position on the page.

## v1.27.10 — October 20, 2026

### Search: faster, clearer, typo-tolerant

- Typos are automatically corrected: "hary potter", "matirx", "onepiece", or "le seigneur des anaux" directly display the correct titles, with the mention "Results for …" and a link to search for the exact text.
- While typing, previous results remain displayed and fade away during loading, instead of disappearing with every letter. The "No results" message no longer appears before the end of the search.
- A "Other titles to discover" line completes the title being typed, and a "In the same vein" section enriches searches that yield few results.
- When nothing matches, the page suggests searching directly on indexers and displays trending movies.
- Clicking the empty bar displays recent searches and trends. Esc clears the search and exits the bar; the down arrow scrolls down the results.
- A search now only creates one entry in the browser history, and clearing the bar immediately returns to the catalog.
- During a search, only search filters are displayed; people without photos are no longer suggested.

### Appearance: Beta theme by default

- The Beta theme is now the default for all accounts, from the first display and without going through the Stable theme. The Stable theme remains available in settings.

## v1.27.09 — October 20, 2026

### Downloads: WebTorrent becomes the sole engine

- Removal of aria2 and rTorrent engines, engine selector in settings, and their dependencies in Windows, Linux, and Docker installers. WebTorrent remains the built-in engine for movies and series.
- Old engine selections are resumed with WebTorrent without emptying the queue, files, or history. If a download restoration fails, the saved queue is kept to allow for a new attempt.

### Windows: Movviz updates independent

- The new "Movviz Update" service controls the official download by SHA256, installs the update, and confirms that the expected version responds after rebooting. It remains active when the installer stops Movviz, and keeps logs in case of failure.
- The automatic setting disabled continues to allow only click-requested updates. A manual installation of this version is necessary once to create the service, without losing data or settings.
- The Windows compilation test now generates its icon, like the production installer, to also work on a clean runner.

## v1.27.08 — October 20, 2026

### Windows: Movviz Update service installation

- The independent "Movviz Update" service downloads and controls the official installer, reboots Movviz, and checks the running version, with preserved logs. The automatic setting disabled continues to allow only click-requested installations.
- Fix for the PowerShell test control that was preventing the build of the previous Windows installer. Install this version manually once to create the new service; data and settings are preserved.

## v1.27.07 — October 20, 2026

### Windows: An independent service for updates

- The new "Movviz Update" service installs updates without stopping Movviz, then checks that the new version responds after rebooting. The download is controlled by its SHA256 hash, and installation logs are kept to diagnose a failure.
- The automatic update setting is respected upon opening the interface: when disabled, only a click-requested installation is launched. The interface now follows the installation until the expected version returns and displays errors.
- To create this new service on an existing installation, install this version manually once. Data and settings are preserved.

## v1.27.06 — October 20, 2026

### Android TV: Episode details respond to the remote again

- When opening an episode detail from a season, no button was selected and the remote no longer responded: the screen remained frozen. The "Play" (or "Back") button is now selected upon opening, and all actions are accessible.

### Home: No more flashing in the hero

- When changing the featured item in the hero, the image briefly flashed black before displaying the next one. The new image now settles directly over the old one, once loaded, on Android TV as on Samsung TVs.

## v1.27.05 — October 19, 2026

### New "M ribbon" logo

- The new Movviz logo, a purple ribbon M, arrives in the beta design on the web: full logo in the sidebar, on connection, on installation, in the player, and in "About," and just the M when the bar is collapsed, with a slight sheen that crosses it from time to time.
- On Android TV, Google TV, and Android mobile, it becomes the app icon, the Google TV home screen banner, and the logo displayed in the app. On Samsung TVs, it also becomes the app icon and brand.

### Beta design: A clean and instant loading screen

- New loading screen on the web and on Android TV: the M in the center on a violet night, with its glow, MOVVIZ below and a thin bar that follows the actual loading. It appears as soon as the page opens, even before the application is loaded, and weighs only a few dozen kilobytes.
- The stable design keeps its current loading screen.

### Android TV: a stationary hero

- When navigating between the home hero buttons, the entire page used to shake. It now remains perfectly still.

## v1.27.04 — October 19, 2026

### Search: each series keeps its own downloads

- A release bearing the exact name of another movie or series in the library is no longer assigned to a longer title containing it: the complete "Dragon Ball Super" is no longer mistaken for "Dragon Ball Super: Beerus," which is another series. This applies to automatic search, RSS feeds, and version replacements. Releases that simply omit a subtitle are still recognized, and manually added alternative names on a listing remain a priority.

## v1.27.03 — October 19, 2026

### The stable design adopts this morning's beta design

- The stable design reverts exactly to the beta design as it was on October 19th in the morning, before the new logo and the new loading screen: colors, sidebar, cards, and layout on the computer, as well as the cinema loading screen (projector, halos, full logo, and percentage). The beta design continues to evolve on its own.

### Reliable file analysis after a large import

- After importing a large number of episodes at once (a complete series), file analysis (codecs, audio tracks, and subtitles) could cut off until the next restart, and overload the server in the process. It is now available, without load spikes.

## v1.27.02 — October 19, 2026

### Updates: never suggest an older version again

- After an update, the sidebar could still suggest "installing" the previous version, based on information kept in memory before deployment. An update is now only suggested — and automatically installed on Windows — if it is actually newer than the current version.

## v1.27.1 — October 19, 2026

### Bleach: the complete downloaded series is correctly filed in the library

- A complete Bleach series fully downloaded and correctly filed on the disk could not appear anywhere in Movviz: it was enough for a single episode not to be recognized as expected for the whole batch to be rejected. Each file is now individually verified based on where it was actually filed (season, folder, name), and the concerned episodes become available without re-downloading anything.
- No existing file is ever replaced or deleted by this catch-up, and an episode expected by another download remains reserved for it.

## v1.27.0 — October 19, 2026

### Beta design: a smooth loading screen that only disappears when everything is ready

- The loading screen animation is now calculated separately from the rest of the page: it remains perfectly smooth (60 frames per second) even while the dashboard is preparing in the background, where it used to stutter. It is also lighter to render, especially on large screens.
- The loading screen appears quickly, and only disappears when everything visible on the screen is loaded — data, listings, posters, and fonts: nothing else loads after it leaves.

### Faster dashboard

- Dashboard data starts downloading as soon as the page opens, at the same time as the application, instead of waiting for it to be ready.

### Technical

- Migration to Next.js 16.3.

## v1.26.056 — October 19, 2026

### Faster dashboard

- Dashboard data (library, recommendation rows, home banner, "Resume") are now compressed before sending: several megabytes less on each opening, which is especially noticeable remotely. Android apps also benefit, without an update.

### Beta design: faster and cleaner loading screen

- The loading screen appears faster: its images are cached in the browser, the scene is displayed as soon as the background is ready, and the neon lights then illuminate softly. The loading screen background is visible immediately, even before the application loads.
- Its disappearance is a simple fade, without zoom or final flash.

### Web beta design: sidebar

- Slightly narrower sidebar, centered logo; when collapsed, only the "O" symbol remains.

## v1.26.055 — October 19, 2026

### Beta design: return to purple, new loading screen and new logos

- The beta design returns to its purple color (the gold from the previous version is dropped) on the web and on Android TV.
- New purple loading screen, on the web as on Android TV: a large 21:9 luminous corridor (adjusted exactly to 21:9, cropped sides in 16:9, logo text always fully visible on narrow screens). The light runs smoothly along the real lines of the scene—floor, ceiling, pillars, triangle outline—with a chrome reflection on the logo and a bar that follows the actual progress. Animations remain subtle.
- New chrome purple logos (full format small and large "O" symbol), animated without a halo around the "O", wherever the logo appears in beta, including the README.
- Android TV: startup remains fast (images decoded in the background, a lightweight version is displayed immediately), with "reduce animations" the scene remains still.

## v1.26.054 — October 19, 2026

### Beta design: dark gold instead of purple, on the web and on Android TV

- The purples and mauves of the beta design become a dark gold, in the same shade as the logo: main action buttons, active states, progress bars, focus outlines, filters, and glows. The original brightness and transparency are maintained so that everything remains legible. The stable design does not change.
- On Android TV, the navigation bar takes exactly the same background as the rest of the screen: a single solid color.

### Android TV beta: new loading screen and new logo

- New cinematic full-screen loading screen (the navigation bar remains hidden underneath): a live illuminated screen wall, reflections running on the orange edges, light on the logo letters, embers, and a bar that follows the actual progress with the current step message. A flash marks the end.
- Fastest startup: images are decoded in the background as soon as the application launches, a lightweight version of the same scene is immediately displayed while waiting, and nothing is calculated at runtime (masks and halos are provided ready-to-use). With "reduce animations", the scene remains still.
- The animated full-format small logo replaces the symbol and text everywhere (profile selector, login, installation, player, expanded bar). Collapsed bar: only the animated "O" symbol remains, larger and centered.

### Web beta design: logo everywhere, streamlined sidebar

- The animated full-format small logo is displayed everywhere (login, installation, player, About); in the sidebar, it gives way to the animated "O" symbol when collapsed.
- In the sidebar, the logo is shifted slightly to the left and the separator line under the header has disappeared.

## v1.26.053 — October 19, 2026

### Beta design: splash starts instantly, full logo in the sidebar

- The loading screen appears as soon as the page opens, without waiting for the application to load: a blurry ambiance of the scene is displayed immediately, then the animated scene appears in a fade-in as soon as it is ready. The background image is preloaded, and the initial black fade has disappeared.
- In the beta design sidebar, the full small animated logo replaces the "O" and the text when the sidebar is expanded; when it is collapsed, only the animated "O" remains.
- The MOVVIZ logo is better spaced: the distance between the "O" and the first "V", and between the last "V" and the "I", is now uniform with the rest of the letters.

## v1.26.052 — October 19, 2026

### Beta Design: New Loading Screen and New Logo

- On startup, the beta design displays a new cinematic loading screen: a wall of screens, reflections running on the orange edges, light sweeping across the logo letters, embers, and a bar that follows the actual loading progress. A flash of light marks the end.
- The screen adapts to all formats: 16:9, ultra-wide 21:9 (the scene extends on each side without stretching), and portrait phone. It is rendered at the actual screen resolution, so it is sharp on high-definition screens.
- The tagline "Your universes in one place" is translated into five languages. With the "reduce animations" option, the scene remains still.
- New logo in three vector formats: the standalone "O" symbol, the full small logo, and the full large logo, with their animated versions (light sweep across the letters, no halo around the "O"). The beta design displays the new animated symbol in the sidebar, on connection, and in settings.
- The stable design remains unchanged. The README GitHub logo is replaced by the animated version.

## v1.26.051 — October 19, 2026

### Details: Status displayed immediately

- When opening a detail page (web, Android TV, mobile, Samsung), the status (in the library, missing or available episodes) is displayed immediately. Previously, the page waited for Movviz to query Plex, which could take about ten seconds for Bleach, during which time it displayed "Add to library".
- Verification with Plex is now done in the background, at most once per minute and per series, and the page updates automatically when it finds something new. The Plex path specific to Bleach is retained for ten minutes instead of being redone upon every opening.
- The sidebar download counter no longer retains page loading: it responds with the last known value and refreshes in the background.

## v1.26.050 — October 19, 2026

### Bleach: Original series Japanese logos in the selector

- The Bleach logo selector now also features the Japanese logos, including the original series' classic red and blue "BLEACH ブリーチ" logo, which does not exist in French or English.
- The automatically selected logo and other series remain unchanged.

## v1.26.049 — October 19, 2026

### Bleach: Manual search finds Thousand-Year Blood War episodes

- Manually selecting an episode of Thousand-Year Blood War only searched for court-named releases ("S04E01") and found nothing for episodes published in continuous numbering ("S17E41"). It now queries both formats and displays all releases corresponding to the episode.
- Manually selecting an entire cour also searches for packs published under "Bleach S17".

## v1.26.048 — October 19, 2026

### Android and Samsung: Thousand-Year Blood War readable in downloads

- The download lists on Android TV, Android mobile, and Samsung display "Bleach: Thousand-Year Blood War" with its season and episode (e.g., S4 · E1), instead of "Bleach S17E41". Other series remain unchanged.
- Download tracking in the details is not modified: episodes remain associated exactly as before.

## v1.26.047 — October 19, 2026

### Bleach: Integrals are sorted into the correct seasons

- An integral (absolute numbering from 1 to 366, "Bleach - 150" files, "S01E150", or season folders) now places each episode in its Movviz season. Previously, only the first episodes were sorted, and others remained unassigned, or the import failed.
- The integral of Thousand-Year Blood War (episodes 1 to 50) is automatically split across the 4 seasons of the series, regardless of the file numbering.
- A single-season pack retains its local numbering, without confusion with the absolute numbering.

### Downloads: Thousand-Year Blood War displayed as its own series

- The queue, history, and searches display "Bleach: Thousand-Year Blood War" with its season and episode (e.g., S4E1), instead of "Bleach S17E41".
- One click opens the correct series page. File sorting has not changed.

### Home: Clean featured banner

- Pagination dots are centered at the bottom, and the pause button and "Now Showing" text disappear.

### Title Logos: They always end up appearing

- When a logo is not immediately available, Movviz retries for longer, with increasing delays. The title text serves as a placeholder, then the logo replaces it as soon as it arrives, on the banner, pages, and rows.
- A response without a logo is no longer kept for a full day by the browser: a temporary incident no longer hides the logo until the next session.

## v1.26.046 — October 19, 2026

### Android TV and mobile: Reliable Bleach repair status

- Bleach pages now use the requested part projection and the repair flag provided by the server. A compact dashboard line can no longer suggest that TYBW needs repairing when its order is already correct.
- On Android TV, the repair action is clickable and reserved for administrators; it shows a preview and asks for confirmation before modifying data. Locks indicate why the repair is impossible.
- The opening focus targets an actual page action; the decorative title no longer receives a selection outline.
- Tizen does not have an equivalent add or repair action for Bleach on its page.

## v1.26.045 — October 19, 2026

### Android TV: Stable focus when opening seasons

- The opening guardrail no longer restores focus when the user intentionally navigates to a season. A redirect in progress is canceled as soon as the season is selected.
- Tizen does not have an equivalent deferred redirect; its season navigation remains unchanged.

## v1.26.044 — October 19, 2026

### Android TV: Reliable Bleach library addition

- After adding, Android TV re-reads the selected Bleach part and keeps the Original and TYBW views separately. The "Add to Library" button no longer reappears during reconciliation.
- Season searches always release their loading indicator, even if the request fails or is canceled.
- Tizen removes the add button as soon as the server confirms the addition, to maintain the same behavior.

## v1.26.043 — October 18, 2026

### Android TV: Bleach/TYBW navigation and separation

- TV rows eliminate duplicate cards before creating their Compose keys, which prevents crashing when scrolling through suggestions.
- Recent additions of original Bleach and Thousand-Year Blood War remain separate. TYBW episodes use course numbers 1–4 on screen, while keeping canon season 17 for viewing and tracking.
- Season loading now ignores late responses from another Bleach arc, even if both entries share the same TMDb ID.

## v1.26.042 — October 18, 2026

### Bleach Numbering and TYBW Search

- Android TV restores the same eight platform logos as the desktop dashboard, loaded from the project's source SVGs.
- The original numbered installments S01E001–S01E366 are redistributed across 16 seasons and their respective season folders, with expected local renaming.
- TYBW retains its internal S17 tracking and its courses 1–4 in separate folders. Searching for an episode like S17E41 accepts S17 or S04E01 releases, and excludes packs from other courses.
- Android TV, Android mobile, and Tizen transmit the selected Bleach arc when loading and refreshing seasons; S17 no longer populates the original entry.

## v1.26.041 — October 18, 2026

### Bleach: Complete Downloads and Entries

- Bleach catalogs already spread across 16 seasons are recognized without migration or history modification. Manual downloads also work for an untracked or already available season; TYBW packs retain their numbering and independent folder.
- Both entries feature integral search, personal list, rating, metadata refresh, and targeted deletion. Quality profiles, aliases, and personal choices remain independent.
- The 16 seasons of Bleach receive a cover and a summary of their arc. Bleach and Thousand-Year Blood War have distinct logos, with a high-definition version for TYBW.

## v1.26.040 — October 18, 2026

### Bleach and TYBW on all screens

- Android mobile, Android TV, and Samsung Tizen display both Bleach and Thousand-Year Blood War results. Navigation retains the chosen arc, and playback, tracking, and search actions use the corresponding episodes.
- Both entries feature the same provider as other titles, with independent background and logo choices, preserved after reloading and in lists.
- New downloads are placed in two separate folders, Bleach (2004) and Bleach - Thousand-Year Blood War (2022), with their IMDb ID in a `.plexmatch` file. TYBW resumes the numbering of each arc, while Movviz tracking coordinates remain stable. Old files are not moved automatically.
- Synchronization recognizes the independent Plex entries for TYBW, even if renamed, and maintains a Plex link per arc. Generic renaming can no longer merge their folders. An outdated engine blocks these new imports instead of ignoring the requested organization.

## v1.26.039 — October 18, 2026

### Searching from a Row

- After "See all," entering text in the search bar now queries the catalog instead of continuing to load the previous row. Both Bleach and Thousand-Year Blood War entries also appear in this flow, as if in a direct search.

## v1.26.038 — October 18, 2026

### Bleach and Thousand-Year Blood War Separated

- Search and library now show two distinct entries: Bleach (2004), with its 16 seasons and 366 episodes, and Bleach: Thousand-Year Blood War (2022), organized by arcs. Provider IDs and history are retained.
- Searches, requests, manual and automatic downloads, quality replacements, and follow-up actions are limited to the selected part. TYBW S02E01 corresponds to the first episode of The Separation and can no longer be confused with Bleach original S02E01. Japanese titles and part names are also recognized.
- The engine distinguishes between source file numbers, Movviz tracking, and the naming expected by Plex. Packs are limited to the episodes actually covered; coordinates are retained upon restart and new import attempt.
- Old catalogs with a certain order are reorganized with prior backup, without moving files or deleting tracking. Ambiguous Plex histories and snapshots block risky corrections; no real content is derived from a simple file name.
- The TYBW entry uses its synopsis, poster, and first broadcast. Adding a missing part completes the same catalog, even when an empty season already existed. Long season titles remain readable on mobile.

### Home

- Removal of the "Find inspiration" line. The Stable/Beta choice and direct startup in the saved appearance are kept.

## v1.26.037 — October 18, 2026

### Lite Home

- Removal of the texts "Cinema, at home" and "Your next big story" from the Beta home.
- Removal of the visible label "Platforms" and its reserved column: logos now occupy the available width directly.

## v1.26.036 — October 17, 2026

### A more cinematic Beta

- The Beta home adopts an editorial composition: large typographic opening, framed hero, featured images, and more spaced-out rows. Navigation switches to an ivory selection on graphite, and search receives a new surface.
- The Beta splash opens projection curtains, reveals the logo from a light slit, and deploys two orbits. Beams and progress reflection accompany the loading; the exit is done in a zoom and fade, without adding a waiting delay.
- Stable keeps its rendering, its old splash, and its geometry. The account choice remains applied from the first HTML; animation reduction preferences are still respected.

## v1.26.035 — October 17, 2026

### Stable / Beta Appearance

- Settings → My experience → Appearance and previews now offer a personal Stable or Beta choice, saved to the account and applied without reloading. Stable keeps the current interface; a save error restores the previous mode.
- The saved choice applies from the first server render: a Beta account starts directly in Beta, without an intermediate Stable appearance, even when the preferences API is slow to respond.
- Beta mode refines desktop typography, spacing, cards, and badges. Main actions provide discrete haptic feedback; animation reduction remains respected. The title entry remains shared between the page and the panel.

### A cinema opening

- The Beta splashscreen welcomes the startup with the enlarged official logo, purple and cyan beams, a light halo, and a redesigned progress bar. It adapts to small screens and keeps a calm version with reduced movement.
- The old splash remains available in Stable. The new animation adds no waiting time to loading and does not replay on every navigation.

### Frontend reliability

- Correction of seven ESLint errors identified in the hero and title entry: slideshow initialization, mobile detection, orientation typing, and search/playback function declarations.
- The resume position is attached to the current media to avoid displaying that of the previous title; it is re-read after closing the player.

## v1.26.034 — October 15, 2026

### Searching and downloading after a request

- Adding a movie or series now launches a background search task, without keeping the phone's request open during indexer calls. The search continues after the response and remains visible in the tasks.
- A download request for an already present but incomplete title relaunches the missing items. Repeated clicks share the same task; available media, untracked content, search-free additions, and pending approval requests remain protected.
- Approving a request also uses this queue; an addition error no longer prematurely marks the request as approved.

### Reseeding and Android TV

- Imported torrents can share renamed files after fingerprint verification, read-only. Torrent paths and metadata are preserved after restart; the interface distinguishes between verification, full sharing, partial sharing, and unavailable files.
- Continuous validation runs the download engine tests, including sharing after import.
- Android TV uses Media3 1.9.4.

## v1.26.033 — October 14, 2026

### Android mobile: zoom without cropping in the old frame

- The video container keeps all available surface area. Zoom resizes the native surface while maintaining proportions, instead of enlarging the image in a 16:9 frame that could still crop the sides despite free space.
- The framing is updated as soon as the detector confirms the embedded black bars, without waiting for another action on the player. The detector and its protections against dark scenes are retained.
- Two distinct "Fit" and "Fill" buttons are visible in the controls; the active mode is highlighted and the choice remains memorized by profile on the device.

## v1.26.032 — October 14, 2026

### Android mobile: display adapted for phones and tablets

- The player displays the entire image by default without distortion, adapting the width or height to the available surface. A button allows switching between "Fit" and "Fill"; the choice is memorized on the device for each server and profile.
- The embedded black bar detector is retained. In Fit mode, the zoom takes into account the player's dimensions to keep all useful image visible, including on tablets; in Fill mode, the image is cropped to occupy the screen.
- Player size and mode changes are taken into account even when paused. Controls can span multiple lines in a narrow window.
- Vertical brightness and volume gestures are removed. Double taps to fast-forward or rewind and swiping on the timeline are retained.

## v1.26.031 — October 13, 2026

### "Clear Playback": the profile reverts to empty

- The button now also clears the list, notes, favorites, and the AI assistant's memory, as well as the conversation with it. The profile itself (name, photo, password, settings) is not affected.
- On the Plex side, in addition to viewed and replayed items, the profile's notes and watchlist are cleared, only with that profile's Plex account. A managed profile without a Plex account keeps its Plex watchlist, and the screen indicates this.
- An old resynchronized Plex watchlist does not reappear in Movviz.
- Warning texts (web, Android mobile, Samsung) now state exactly what is being deleted and what remains.

## v1.26.030 — October 13, 2026

### Profile: new "Clear Playback" button

- Each profile can start from scratch on the viewing side: viewed titles, in-progress replays, and playback history are cleared. The profile's notes, list, and favorites remain.
- Two warnings before acting: an initial confirmation, followed by a final screen where you must retype "CLEAR" (web and Android mobile) or check "I understand" (Samsung).
- Only the logged-in profile is erased, never another's, and any user can do this for their own profile.
- If the profile is linked to Plex, its viewed status and replays are also erased, only for that profile's Plex account: views from other Plex accounts are not affected. The result on the Plex side is displayed once finished, and if Plex could not erase everything, it is stated clearly.
- Old views will not return to the next Plex sync. A real viewing done after the erasure is normally counted.
- Available on the web (Profile page), the Android mobile app (Profile menu), and the Samsung app (Profile page).

## v1.26.029 — October 13, 2026

### AI Assistant: Updated Gemini model list

- Google removed Gemini 3.5 Flash and Gemini 3.7 Flash on October 8. Gemini 3.6 Flash replaces 3.5 Flash in the recommended models, and 3.7 Flash is removed from the list.
- If the assistant was set to one of these two models, it automatically switches to its replacement (3.6 Flash or 3.8 Flash), as Google already does on its end.

## v1.26.028 — October 12, 2026

### AI Assistant: Models are no longer tested upon opening settings

- Settings → AI Assistant used to test every Gemini model with a real query upon opening, which consumed the free daily quota. The result is now kept in memory, and tests are redone once a week.
- A model whose daily quota is exhausted is recognized as available, instead of being marked "unverified" and retested.
- A test that could not be completed (network, per-minute limit) is redone at most once per day.

## v1.26.027 — October 12, 2026

### One web interface: Beta becomes the Movviz appearance

- The Stable theme is removed from the web (desktop and mobile). The Beta interface is now applied to everyone, including accounts that had chosen Stable. Other dashboard settings (hero, videos, rows) are kept.
- The Stable/Beta choice disappears from the dashboard settings and the setup assistant.
- Android TV keeps its own Stable/Beta choice for now. The Android mobile app and the Samsung app only had one appearance: nothing changes for them.

## v1.26.025 — October 12, 2026

### Plex view sync: much faster after a major Plex update

- After a major Plex update, view syncing could take nearly 9 minutes and freeze the server for up to 7 seconds: every viewed movie was re-checked with a separate query to Plex. These checks are now grouped by 50, and the sync releases the server much more often.
- Such an unusual batch (more than 500 view changes at once) is reported in the log, to detect a Plex that has reassigned its identifiers.

## v1.26.024 — October 12, 2026

### Scheduled tasks: lighter, one heavy task at a time

- Never two heavy tasks at the same time (disk scan, missing items rerun, upgrades, TMDb metadata, reconciliations, diagnostics, benchmark). Small frequent tasks (download status, RSS, Seerr, Plex) and your own actions continue in parallel.
- A heavy manual search ("Search for missing items", technical analysis, Plex or TVDB view resync, saga scan) takes precedence: the ongoing heavy automatic task is paused and resumes immediately after.
- No scheduled tasks for the first 3 minutes after a server startup, except for downloads.
- New "Stop" button on every running or pending task, in Settings → Scheduled tasks and in the queue.
- Settings → Scheduled Tasks displays the "worst freeze" of each task (how long it froze the server), heavy tasks, and the names of the three tasks that displayed incorrectly.
- Task intervals are reset to default values only once with this version. Those you set afterward are kept.

### Fewer server freezes

- Disk scanning no longer freezes the server every hour: it reads the disk without blocking and only compares files that have not yet been attached.
- RSS scanning no longer re-compare the entire cache on every pass: a new release is compared to all missing titles, a title is added to all cache releases, and a full pass occurs at startup and once a day. A day's output is always retrieved within 15 minutes of its arrival on the indexers.
- Quality upgrade checking follows the same principle.
- TMDb metadata refreshing only records titles that have changed.
- When automatic upgrade is enabled, suggested replacement checking no longer performs the same search. Automatic upgrade itself signals the replacements it could not download. When disabled, the check works as before.
- Automatic upgrade no longer counts a film whose download failed as "upgraded."
- Intervals revised: automatic upgrade every 12h (instead of 6h), Plex tracking list every 5 min (instead of 1 min, without a log line per user and per minute). Missing film re-run takes precedence over maintenance tasks.

### Priority Points

- Sliders no longer send a request for every pixel dragged and no longer revert automatically.
- The "Downloads" slider finally serves a purpose: above 50, an active download reduces other tasks to 2 in parallel. Below that, it does not slow them down.
- Added the Plex intros slider, which was missing.

## v1.26.023 — October 12, 2026

### Changes
- Republication of the exact code of v1.26.021 under the number v1.26.023: fixes from versions 1.26.017 to 1.26.021 are back.

## v1.26.022 — October 12, 2026

### Return to 1.26.016 code

- Republication of the exact code of v1.26.016 under the number v1.26.022 to allow it to be updated from more recent versions.
- Changes introduced in versions 1.26.017 to 1.26.021 are removed from this release.
- This rollback is to check the behavior of Android TV cards; the resolution of the problem remains to be confirmed on the server and the TV.

## v1.26.021 — October 12, 2026

### Samsung: "Movviz Trends" row also appears

- Same fix as 1.26.020 on the Samsung app (Tizen): after a server restart, the home and Discover pages re-read the rows as long as the server is preparing them, instead of remaining without trends.

## v1.26.020 — October 12, 2026

### Movviz TV: "Movviz Trends" row appears

- After a server restart, trends are calculated in a few seconds. The site was waiting for them to arrive, but the TV app was taking the home page as is and keeping it without trends. The TV app (and the mobile app) now re-reads the rows as long as the server is preparing them.
- When the server signals new suggestions, the TV app's home screen updates immediately. Previously, the new row would arrive in the background without ever being displayed.

## v1.26.019 — October 12, 2026

### Android: "See more" no longer crashes the application

- On mobile and TV, opening "See more" from a suggestion row and then scrolling could suddenly close the application when the next page returned an already displayed title. Duplicates are now ignored.

## v1.26.018 — October 12, 2026

### Search: all TMDb results are displayed

- Search no longer hides any title without a rating on TMDb: everything TMDb finds appears. The Discover lines keep their sorting of uninteresting titles.

## v1.26.017 — October 12, 2026

### Search: the most recent movies are found by their title

- A movie that no one has rated yet on TMDb (festival film, upcoming French release, like "A Good Lawyer") was hidden from search as an uninteresting result. It now appears when you type its title. Unrated results that do not match the search remain hidden.

## v1.26.016 — October 12, 2026

### Resyncing missing items: 3 days maximum waiting time

- A title already searched without results waits 1 day, then 3 days maximum before being searched again (instead of 7). The RSS scan, today's releases search, and manual search never wait: a title that appears in a feed is downloaded immediately.

## v1.26.015 — October 12, 2026

### Missing movies and series: RSS first, lighter resync

- The indexer RSS scan runs every 15 minutes instead of every hour. A missing movie or series is downloaded as soon as it appears in a feed, without waiting for a resync.
- When releases have been published between two passes without appearing in the feed (too many new items at once), Movviz notices, reads the indexer's next page, and logs it.
- The resyncing of missing items runs every 8 hours instead of 6. A title already searched without results waits 1 day, then 3, then 7 before being searched again; it returns to the top as soon as it is found.
- The resyncing of missing episodes now covers the entire library. Previously, it only checked the first series in the list.

### Indexers: a rejected key is no longer overlooked

- An indexer test now performs a real small search: a rejected API key appears as a failure, even when the indexer publishes its list of capabilities without a key.
- A search rejected by an indexer (invalid key or missing necessary rights) is logged as an error, instead of passing as "no results".

## v1.26.014 — October 12, 2026

### Plex: lighter view synchronization

- Plex view synchronization compares the Plex state to the Movviz state with prepared indexes only once, instead of reprocessing the entire library for each episode, and lets the server breathe during processing. The results are identical; the small interface freezes during this task disappear.

## v1.26.013 — October 12, 2026

### Download retrieval: no more server freezes

- The task that retrieves completed but unimported downloads still compares each file to the library in the same way, but without recalculating all titles for each file, and lets the server breathe between files. After a restart, it could freeze the interface for up to 11 seconds.

## v1.26.012 — October 11, 2026

### Plex: View sync loop end

- When a "viewed" status cannot be sent to Plex (profile removed from server shares, episode missing from Plex...), Movviz will first retry every minute, then increasingly rarely: every 5 minutes after 10 minutes, every 30 minutes after an hour, every 6 hours after a day. Previously, it would retry every minute endlessly, which could freeze the server for several seconds and flood the search log.
- Episodes from the same series are returned together, with a single Plex account check and a single log entry per series.
- A viewed episode that does not exist on the Plex server (e.g., in an imported history) remains marked as viewed in Movviz, without calling Plex or logging a warning.

### Plex: Lightweight daily reconciliation

- Full Plex reconciliation no longer rewrites a movie if nothing has changed. Previously, the entire library was counted as "updated" every day (notification "2351 movie(s) updated") and the server could freeze for about a minute during this process. The notification now only counts actual changes.

### Diagnostics, icons, and trailers

- Diagnostics now return counters by type and the first 50 examples, instead of several tens of thousands of lines.
- Lightweight tab and application icons, and a favicon.ico.
- Trailers already found remain cached after a server restart.

## v1.26.011 — October 11, 2026

### Security: TMDB key reserved for administrators

- Changing, deleting, or testing the TMDB key now requires an administrator account, similar to OMDb and TVDB. Previously, these actions passed without checking the session.
- A test now verifies that every route that modifies something checks itself to see who is calling it.

### Tests

- Discovery tests follow the current layout (sort preserved when changing platform, "All" tab).
- ffmpeg detection tests no longer assume an NVIDIA card on the machine, and the ffprobe cache test is no longer unstable.

## v1.26.010 — October 11, 2026

### Android TV and mobile: Sleep pause

- When playback is paused, the screen saver and TV sleep will trigger again after their usual delay, similar to Plex. During playback, including during loading, the screen remains on.

## v1.26.009 — October 11, 2026

### Android mobile: Complete a season

- On a season page, the season download has its own button, on a line separate from playback actions. It is called "Complete season" when some episodes are already present, "Download season" when none are, and displays the percentage live during download.

## v1.26.008 — October 11, 2026

### Android TV and mobile: Episode download

- On a missing episode's details page, the button becomes "Download episode" instead of "Download season". It then displays the live status: in queue, searching, downloading with real-time percentage, then importing, before switching to "Play".
- "Download season" is only offered for a season with no episodes present, with the same live tracking. On TV, a partially watched season keeps "Complete season," which also has live tracking.
- A current season pack displays its progress on each of its episodes, but only on the first one.
- Mobile: missing episodes are now available for download (they were inactive).

## v1.26.007 — October 10, 2026

### Automatic recovery of locks

- A blocked JSON backup worker is replaced after two minutes; failed backups are retried with the latest data.
- In Docker, an independent supervisor restarts the web server after five minutes of continuous unavailability, with a ten-minute grace period on startup, at least fifteen minutes between restarts, and a maximum of three restarts per hour.
- Prolonged backup failures are detected by the health probe. Download and resolver processes retain their log output during a web server restart.
- Shutdown attempts to save pending changes after the writing workers stop. Recovery decisions appear in the logs under `[watchdog]`.

## v1.26.006 — October 8, 2026

### Library: proportions and filters

- The Genres menu is aligned to the right of the title counter.
- The page uses the same usable width as the dashboard to maintain the same proportions of cards and spacing on large screens.

## v1.26.005 — October 8, 2026

### Automatic Downloads

- Default reactivation of automatic missing search, including for old disabled configurations; voluntary deactivation after this update remains saved.
- The hourly RSS scan updates the status of new releases and recognizes the original titles of movies. Recent release search uses the known date when the VF date is missing.
- Custom automatic search frequencies are capped at eight hours to allow for at least three passes per day when the server is active.

### Library and customization

- Movies, Series, and Collections are grouped in the existing Library page. Old Movies and Series addresses redirect to its filters.
- Genres move to a dropdown menu above the title count. The grid occupies the full width and adopts the dimensions of the dashboard cards.
- List customization is accessible on desktop in Discovery and added to the dashboard: order, hiding, redisplaying, and resetting, saved per account.
- In Discovery, the green badge for available titles is halved; "Seen" appears in the bottom right, regardless of the download status.

## v1.26.004 — October 2026

### Downloads: safe replacement and seed status

- The old movie remains available and readable during the download of its replacement; it is only removed after installation and validation of the new file with the final name, without "(2)" suffix or residual backup.
- In case of refusal (file in use, name taken, incomplete or inaccessible file), the new one is kept for three new attempts spaced 10 minutes apart, including after restarting. After the last failure, the new one is deleted and the old one is kept; Downloads displays a precise message.
- A torrent finished sharing displays "Seeding" and is no longer blocked due to zero download speed.

### Desktop: hero badges

- The technical badges retain the presentation and alignment of genres; "FHD" becomes "1080P" in the hero desktop.

## v1.26.003 — October 2026

### Desktop: hero technical badges next to genres

- On desktop, the resolution, HDR, language, and codec badges for the hero are displayed immediately after the genres, on the same line if space allows.
- Their presentation and data remain identical; on mobile and tablet, they keep their position in the top right.

## v1.26.002 — October 2026

### Android mobile: scrollable timeline and immersion

- The slider, progress, and displayed time follow the finger on the timeline. The video jump occurs upon release, without repeated reloading during scrolling.
- The timeline gesture locks the brightness and volume; controls remain visible until release.
- The player uses the entire screen surface, masking system bars.
- Black bars integrated into a video stream are detected on several consecutive clear frames and removed by a progressive display zoom. Dark scenes do not trigger the zoom; native 21:9 videos are excluded.

## v1.26.001 — October 2026

### Desktop accessibility by profile

- In My profile, an Accessibility section allows choosing the text size on desktop: 100%, 110%, or 120%, with immediate preview and return to the standard setting.
- The preference is saved in the account and found on other computers. It does not modify Android or TV applications.
- Zooming covers interface texts, menus, and panels, in Stable and Beta appearances, with adaptation of navigation areas and controls.
- At 100%, zoom styles are completely disabled; posters, logos, and videos retain their dimensions.

## v1.25.201 — October 2026

### Android mobile: discreet player and priority height

- While playing, no title or logo: compact controls and episode actions disappear after 2.5 seconds without interaction.
- When paused, a slight gradient accompanies the official logo of the movie or series; the title serves as a backup if the logo is missing or cannot be loaded. The logo disappears upon resuming.
- 4 dp timeline, 18 dp handle, and touch targets of at least 44 dp. The playback mode badge is reduced.
- The actual video and audio formats played are discreetly displayed near the times, without inventing HDR or Atmos or repeating the source file characteristics after transcoding.
- The video fills the screen height while maintaining its proportions; content narrower than the phone retains black side bars.

## v1.25.200 — October 2026

### Android mobile landscape: video preview placement

- In the two-panel sheet, the trailer preview is shifted 33% of its width to the left, without changing its size or format.
- The fade, text, and background image remain in place; the overflowing video is masked at the screen edges.

## v1.25.199 — October 2026

### Android mobile landscape and theme colors Beta

- Android mobile landscape home: horizontal swipe of the hero to display the previous or next title; the auto-rotation delay restarts after manual selection.
- Android mobile two-panel sheet: the visual and gradients cover the entire surface, with a continuous fade to the text and page background, without a vertical cut.
- Beta appearance on desktop: Discovery platform search and cards adopt the palette colors, including on hover and selection.

## v1.25.198 — October 2026

### Beta appearance: return of the usual search bar

- On desktop, the Beta appearance restores the Stable appearance's search bar, identical: you type directly into the top bar.
- The `Ctrl K` palette is removed.

## v1.25.197 — October 2026

### Beta appearance: Downloads faithful to the mockup, title sheet in tabs

- Downloads: under the title, a live summary (active downloads, bitrate, free space) replaces the explanatory text.
- Each line in the queue is aligned in columns: content, progress, bitrate, time remaining, sources. Actions remain discreet (pause, search, delete, details).
- The progress changes color according to the status: purple for in progress, gray for pending, green for finished, red for blocked.
- The "Sources" column now displays the actual number of pairs, instead of empty arrows.
- The right column is organized into "Live Bitrate," with a filled curve, and "Status." Grouped buttons are no longer red, except on hover.
- Title sheet on desktop: Episodes, Cast, Similar, and Details move to tabs under the summary.
- Correction: the "Details" tooltip displayed technical text instead of the translated word.
- Playback resumes do not change. Stable, mobile, and TV apps also do not change.

## v1.25.196 — October 2026

### Android mobile: fix

- The My Space History no longer crashes the application when the same movie or episode appears multiple times (reviewed or replayed): each title appears only once, with its most recent date.

## v1.25.195 — October 2026

### Beta appearance: full-screen home on desktop

- The large home image breaks out of its frame: it occupies the full width, passes under the top bar, and fades into the black of the page.
- The title, summary, and buttons are aligned with the rest of the page.
- The slideshow, title logo, background trailer, and platform cards do not change. Stable, mobile, and TV apps also do not change.

## v1.25.194 — October 2026

### Android mobile: premium redesign, search, player, and settings

- Search: With "All," found people appear at the top, in round photos, before movies and series.
- Each result indicates if it is already in the library or downloading.
- Filters (genres, duration, platforms...) open like a leaf from the bottom in portrait, with a scrolling list.
- Active tabs (Movies/Series, In Progress/Finished, search filters) turn white, like seasons.
- Player: A double tap left or right rewinds or fast-forwards by 10 s, and a vertical swipe adjusts the brightness (left) or volume (right).
- Downloads: A summary at the top shows the overall progress, total bitrate, and estimated end time.
- Settings: Automatic update becomes a clear line with a toggle switch.
- The update screen is more readable on mobile.

## v1.25.193 — October 2026

### Beta Appearance: "Dark Room" extends to the entire computer

- All colors are unified: a deep black, a single purple for selections and progress. Cyan, electric blue, and pink gradients disappear from buttons, filters, and panels.
- Green, orange, and red keep their meaning: finished, warning, failure.
- Redesigned Downloads page: underlined tabs, bulleted filters, cleaner lines, purple progress, speeds readable in aligned numbers, status dots colored according to status, and a live column (graph, bitrates, counters) matching the rest.
- The main button (Play, Resume, Add to library) turns light on the home screen and on a title's page. Other actions remain icons, with their name on hover.
- Library: Type and Sort filters no longer appear twice; they remain in the top toolbar.
- The settings home screen loses its colored halos and resumes the same surfaces as the rest.
- Platform cards, their logos, and their hover effects do not change. Stable, mobile, and TV apps also do not change.

## v1.25.192 — October 2026

### Android mobile: premium redesign of the movie and series page

- The page takes the color of the poster: the background gently tints according to the title instead of being an identical black everywhere.
- In landscape and on a fully opened Fold, the page is displayed in two panes: the image remains fixed on the left and the information scrolls on the right.
- On a vertically held open Fold, the page resumes the portrait layout with more space.
- The Play button is white everywhere, and the resume progress is displayed directly in the button.
- In portrait, "Play from beginning" and "Mark as seen" become round buttons on a single line.
- Seasons are selected with compact dots "Season 2 · 10 ep." on phone and Fold.
- In portrait, an episode opens in a leaf that rises from the bottom, closable with a tap above.

## v1.25.191 — October 2026

### Android mobile: premium redesign, first step (chassis)

- The open Z Fold held upright no longer displays the TV interface: it now has its own touch layout, with a labeled navigation rail on the left.
- New frosted glass navigation rail in landscape and on Fold. It integrates search, and the Downloads tab displays a progress ring during a download.
- On the Fold opened flat or on a tablet, the right panel keeps its place when the screen is wide enough and adopts the same glass style.
- The home feature takes up full width in landscape and on Fold, with its summary and a more readable white Play button.
- The bottom dock is lighter: the active tab is marked by an underlined purple icon instead of a colored pill.
- The home search in portrait becomes an icon in the header, leaving more space for content.
- Buttons and thumbnails react to touch with a slight press, and secondary texts take on a softer hue.
- The floating Movviz AI button remains unchanged.

## v1.25.190 — October 2026

### Beta Appearance: first steps of "Dark Room" on desktop

- New command palette: `Ctrl K` (or a click on the top bar) searches for movies and series, pages and settings, and suggests launching the search in Discover or a torrent search.
- The top bar is streamlined: the language and Support Movviz link move to the profile menu, and the heart no longer beats continuously.
- Darker and more neutral colors, active sidebar entry in raised surface, dedicated Movviz fonts (embedded, no connection), page titles without gradient and a single focus ring, identical to the mouse and keyboard.
- A link to a specific setting now opens the correct tab even when the Settings page is already displayed.
- The Stable, mobile, and TV app appearances remain unchanged.

## v1.25.189 — October 2026

### Android TV: new Beta interface to try

- New setting Settings > Appearance > Beta Interface. It is disabled by default: the current appearance will not change until you enable it.
- With the Beta interface, texts are larger and more readable from the couch (badges, notes, synopses, card info), and the selection has the same white frame everywhere.
- Rows, posters, and repeat cards are aligned on the same margin and are a bit larger; the repeat progress bar is more visible.
- The home feature no longer changes while you are on its button, and this button is now called "View Details," which is what it actually does.

## v1.25.188 — October 2026

### Android mobile: search by actor

- In the Actors tab of the search, tapping an actor now opens their profile with their filmography.
- Each result displays the person's photo and profession, and the search indicates when it is loading or failing instead of showing "No actors."
- The actor search (mobile and web) finds many more people: it now uses the TMDb search dedicated to people.

## v1.25.187 — October 2026

### Movviz Companion: live download tracking

- The button now displays the download percentage in real-time, with a thin progress bar, and updates automatically: no need to refresh the page.
- When the download is complete, the button automatically changes to "Available" with direct access to the page in Movviz.
- More precise error messages when the server connection fails (unauthorized access, server needs update, server unreachable), and more reliable authorization request for an HTTP server.

## v1.25.186 — October 2026

### Movviz Companion: fixed installation

- The extension loads again in Chrome and Edge: an invalid icon declaration prevented it from installing since the previous version.

## v1.25.185 — October 2026

### Movviz Companion: visible logo and more readable button

- The Movviz logo finally appears on the button, on all supported sites.
- The button is now a dark card with a purple halo, larger and readable even on white pages. When a title is available, "Open in Movviz" becomes the main button.

## v1.25.184 — October 2026

### Movviz Companion: crisp logo

- The extension icon now uses the Movviz logo in transparent PNG, without the dark border that appeared on the edges.

## v1.25.183 — October 2026

### Movviz Companion: request your movies and series from cinema websites

- New browser extension (Chrome, Edge, Brave): A Movviz button appears on TMDb, IMDb, AlloCiné, SensCritique, TheTVDB, Letterboxd, Rotten Tomatoes, JustWatch, Trakt, and Taste to request a movie or series with one click.
- The status is displayed live (pending, in progress, available) with direct access to the page in Movviz. If a site changes its layout, the button remains visible in the bottom left corner.
- Connection with a personal API token (Profile, API Tokens): The request follows your usual rights, approved immediately for an administrator or a user in automatic approval.
- The extension archive is attached to every release, with a Movviz-themed options page available in five languages.

## v1.25.182 — October 2026

### Playback: reliable pause/resume and large files that no longer run into the void

- Pausing for more than a few seconds, or playing a large file, no longer cuts the video connection: on Android TV and mobile, the player no longer imposes a maximum duration on a stream, and the server no longer interrupts it after 5 minutes.
- It is again possible to pause during loading, and the icon follows the actual status. A player left paused remains so after an automatic resume, and exiting the screen now properly pauses playback even during loading.
- Less memory used: the welcome trailer is freed as soon as the player opens or the application goes to the background.
- Smoother playback of local files on large files.

## v1.25.181 — October 2026

### Movies and Series: correct row titles and customizable rows

- The suggestion rows for the Movies and Series pages finally display their true names (Critically acclaimed, Anime, Action, Comedy, etc.) instead of "Movies" or "Series" everywhere.
- New pencil button on Movies, Series, and Discover: each user can move up, down, pin to top, or hide a suggestion row, and reset it at any time. The organization is saved to their account, page by page, and a button is available to revert to the default order.

## v1.25.180 — October 2026

### Samsung Tizen: experience closer to Android TV NX

- Revised settings, title cards, seasons, and episodes: viewed/unviewed status, counter for viewed and missing episodes, resume at the exact spot or from the beginning.
- Consistent Home when AI is not active: no empty areas or visible AI elements.
- New labels translated into five languages, and Samsung version UX audit added to the porting documentation.

## v1.25.179 — October 2026

### Downloads: End of incorrect editions and bypassed forbidden words

- A release from a national edition of a show is no longer taken for the base series: "Hot Ones Quebec" is no longer downloaded for "Hot Ones" (same for Canada, France, Australia, etc.).
- "Replace blocked" now respects forbidden words: a release containing a forbidden term (e.g., VFQ) is no longer automatically chosen, regardless of its score. Manual search still displays everything.

## v1.25.178 — October 2026

### Samsung Tizen: first NX client in beta and GitHub release

- Addition of a Samsung TV client packaged in `.wgt`, with colors, Roboto font, logo, focus rail, and dimensions from Android TV NX. Server screens, Movviz/Plex connection by code and QR, profile selection, home with hero, library, discovery, search, and unique title card with seasons/episodes and distribution.
- Reuse of server routes and rules for accounts, resumes, history, viewed status, personal lists, title requests, download searches, and AI when active. Profiles each restore their authenticated session; no Plex token is sent to the client.
- AVPlay adapter with authenticated playback, resume, pause, navigation within the stream, audio/subtitle selection by server rescheduling, progress, and next episode. Declared capabilities limited to H.264/AAC SDR 1080p pending hardware testing; playback on physical TV and full Android TV parity are not yet validated.
- Samsung workflow on the same `v*` tags as other platforms: type/test verification, archive, and SHA-256 attached to the release. Without configured Samsung certificates, the package explicitly carries the name `client-unsigned.wgt` and must be signed before installation. HEVC/HDR/4K, trailers, markers, and advanced settings remain to be finalized and verified on the target model.

## v1.25.177 — October 2026

### Android TV: D-pad returns and season opening

- When returning to an open card from search, focus returns to the selected card, with filter and grid restoration.
- A season opens on the action of playing its header, without obscuring it. Returning to an episode card retains priority to its original card; Compose navigation and playback rules remain unchanged.

## v1.25.176 — October 2026

### Android TV: Lightweight search input

- Input no longer invalidates the entire navigation container with each letter. Library title normalization is calculated once per refresh, and matches and their sorting are calculated off the display thread.
- Obsolete calculations are canceled and their results cannot replace those of the new input. Priority for library, sorting, filters, deduplication, viewed badges, network timing, and remote navigation are preserved.

## v1.25.175 — October 2026

### Beta: Light reflection on card borders

- On hover on desktop, a fine white-violet reflection follows the mouse on the edge of the cards. The center is masked to preserve the colors and readability of the posters, with a discreet outer halo.
- No zoom or enlargement added: existing mouse tracking is retained. No changes to the background, Stable mode, content, or playback; no additional libraries or permanent animations.

## v1.25.174 — October 2026

### Recent additions: do not confuse view change with file arrival

- Plex synchronization and reconciliation retain the arrival date of an already known file. Switching between viewed or unwatched episodes, or refreshing their metadata, no longer artificially resets their synchronization date in recent additions.
- A first import uses the actual addition date provided by Plex; a true file replacement retains its new arrival behavior. Previously recorded local acquisition dates are preserved.
- Correction in the shared data source, without modifying views, histories, Plex accounts, or playback rules.

## v1.25.173 — October 2026

### Useful settings, special seasons, and Discovery

- Removal of neutralized home options (statistics, download queue, and tasks) and graphic quality profiles. The current composition and standard graphic rendering remain fixed; disabling animations and choosing Stable/Beta remain available. The texts of removed choices are cleaned; the wizard retains only its still useful choices.
- The built-in player is called Movviz player, enabled by default. The personal choice disabled opens Plex, even when a local source would otherwise bypass this choice. Explicit preferences of existing accounts are retained; the engine remains automatic.
- On desktop, the existing special episodes option now truly drives the display of Season 0. It is disabled once for all profiles after this update, then each can re-enable it. On Android TV, specials are hidden as they are already on smartphone. No files, history, or watched status are deleted.
- Discovery offers New, Trending, Best, and For you in the same selector, for all platforms. Sorting is retained when changing platform or type; For you uses account recommendations, filtered by the chosen platform. With additional filters, the filtered results are reordered without changing their pagination.
- In Movies and Series, the platform rows now distinguish between suggestions for you and new arrivals, with the same labels as Discovery.
- Removal of the rectangular frame added in the Beta search field; only its rounded outline indicates focus.

## v1.25.172 — October 2026

### Beta: original background and refined interactions

- The page background and sidebar background return to the original theme: no decorative background added in Beta. Mouse tracking and tile relief are retained.
- Rating and episode badges are more legible, playback bars are better defined, and the selected platform in Discovery has a discreet indicator.
- Hero buttons and carousel arrows provide clearer visual feedback on hover, click, and keyboard, without moving the layout.
- These finishes remain reserved for Beta on desktop, respecting the reduction of animations and not modifying playback, data, or preloading.

## v1.25.171 — October 2026

### Beta: premium cinema desktop finish

- Beta now applies a consistent appearance to the dashboard, movie and series cards, Discovery, details, search, settings, and Movviz AI panel. Stable keeps its existing appearance.
- Posters and platforms have a hover light and a slight relief. Controls, preview windows, and details are harmonized; detail transitions are refined without replacing their behavior.
- Pointer effects share a single task per frame, without React recomposition or permanent animation. They are cut during playback, on touch screens, and when animations are reduced.
- Appearance settings and cache are checked against the connected profile. Data, search, carousels, preloading, and playback rules are not modified.
- Effects selected in the free libraries are adapted to Movviz without stacking their engines or adding production dependencies.

## v1.25.170 — October 2026

### Stable and Beta Display

- The Home selector and carousels now offer Stable (the current, default interface) and Beta (the new premium desktop finish). The dashboard actually applies the saved mode and allows reverting to Stable.
- The old Cinema, Classic, and Compact modes become Stable. Video, content, and carousel settings are retained and common to both appearances.
- Beta refines the hero frame, buttons, titles, and platforms, without changing playback or data. Premium styles remain exclusively active in Beta.
- The choice remains specific to each profile; a save error no longer suggests that the new mode is saved.

## v1.25.169 — October 2026

### Docker Build Correction

- The README is included in the Docker build context to allow version and changelog validation. The check remains active; no user behavior is modified.
- This release incorporates the view and resume corrections from version 1.25.168 whose Docker build had failed.

## v1.25.168 — October 2026

### Consistent Views and Resumes on All Devices

- Android TV and smartphone now use the same server decision as the web when closing or changing episodes: episodes at 80%, movies according to their credits or existing end margin, with real playback time protection. Natural end remains an explicit validation.
- Resumes S01E01 without progress are removed from local and Plex sources, especially after an incomplete import. A genuinely started first episode and transitions to a following season remain available.
- No deletion of imported views or history; the separation of Plex profiles and existing synchronization are maintained.

## v1.25.167 — October 2026

### Changelog After Update

- The New Features window no longer marks a version as read in case of error, missing notes, or until the splash screen covers it. Validation occurs upon closing.
- Interrupted loads are canceled and transient errors have two new retries. Old unreliable validations no longer hide notes.
- Notes for versions 163 to 166 are restored. The changelog is included in the standalone server and the build now checks notes as well as the README and lockfile versions.

### Catch-up of Recent Features

- Carousels prepare two screens ahead, with limited anticipation and priority given to visible images, requested searches, and sheets.
- Resuming a series no longer suggests a non-existent or missing episode; views, imported history, and Plex account separation are preserved.
- The installed version and the update block are back at the bottom of the sidebar, in open and compact modes.

## v1.25.166 — October 2026

### Version and update in the sidebar

- The installed version is visible again under the profile, including in compact mode.
- The updated block returns for administrators: native installation on Windows and Linux, access to Docker/NAS information. Navigation remains unchanged.

## v1.25.165 — October 2026

### Navigation Priority

- Activity detection covers keyboard, touch, scrolling, and navigation. Priority is renewed during useful loads, not by already cached refreshes.
- Visible images no longer wait behind anticipation. Nearby carousels prepare two screens ahead, with two speculative preloads and one decode at a time for all rows.
- Background tasks are correctly queued; TMDb user requests remain a priority, with stable order and preserved concurrency limits.

## v1.25.164 — October 2026

### Valid Resumes Only

- The next episode comes from the actual catalog, ordered by season and episode. A completed series no longer generates an extra episode.
- A missing next episode prevents resuming without skipping to a later episode; an available current episode retains priority.
- The check applies to local and Plex resumes, without modifying views, imported history, or profile synchronization rules.

## v1.25.163 — October 2026

### Carousel Responsiveness

- Rows preload two widths ahead and avoid unnecessary rendering during scrolling.
- The download counter no longer displays twice in the open sidebar.

## v1.25.162 — October 2026

### OCS and YouTube

- OCS and YouTube remain always visible in Discovery, even if TMDb does not list them for Belgium.
- When a Belgian provider catalog is empty, the search automatically uses the France catalog for that platform; existing Belgian results remain a priority.
- Discovery sorting is ordered New, Trending, Best; "For you" remains accessible regardless of the provider.

## v1.25.161 — October 2026

### Movviz AI More Lively

- Questions and impersonation attempts on the creator now receive varied mysterious answers, without disclosing identity or recycling the same phrase.
- Movviz AI can mock with insolence the actually viewed choices, and respond to an insult with a slight touch of theatrical disdain, without escalation or free attack.

## v1.25.160 — October 2026

### Discovery and Inactive Downloads Platforms

- Clicking a platform (tile or menu) opens its catalog without keeping the previous search or incompatible filters; the Movies/Series type remains unchanged.
- Available platforms are drawn from the movies and series lists of the selected country. OCS and YouTube are no longer offered in a country where TMDb provides no catalog, without silent fallback to France.
- A download of under 20 bytes/s for two minutes will switch to "blocked," even with connected peers or a data trickle. A significant resumption can move it to the end of the queue.
- Pauses, waiting for a slot, and checks are excluded from the inactivity timeout; a manual resumption receives a new full timeout.

## v1.25.159 — October 2026

### Restart torrent client

- Administrator button in the quick settings of downloads, with "Restarting..." and double-click protection.
- Actual stopping and recreation of torrent clients, then restoration of the queue, pauses, and imported history without deleting files. Native processes must be stopped before replacement.
- Status viewable during the operation; in case of failure, the backup is kept for a new attempt instead of overwriting the queue with a partial state.

## v1.25.158 — October 2026

### Movies and Series Cards on desktop

- The Movies and Series pages resume the desktop width of the dashboard and Discovery. Their rows already use the same component and the same responsive card dimensions.
- The phone and tablet rendering remains unchanged.

## v1.25.157 — October 2026

### Allowed release terms

- An allowed term must be distinct: FRENCH no longer bypasses a ban when it is only contained in SUBFRENCH or TRUEFRENCH.
- Usual release separators are still accepted, including VOSTFR+FRENCH. The common rule covers automatic selection and post-import control, without changing manual exceptions.

## v1.25.156 — October 2026

### Discovery Card Size on desktop

- Discovery uses the same content width and the same responsive card size as the dashboard on desktop, in rows and result grids.
- Placeholders follow the same dimensions; sizes on phone and tablet remain unchanged.

## v1.25.155 — October 2026

### First load responsiveness

- Discovery and Movies/Series pages sources respond independently: a slow source no longer holds back all rows. Already calculated rows remain immediately available during an update, and are kept if it fails.
- Suggestions keep all history, ranking, and profile filters. Viewed and rejected states are also checked on data served from the cache.
- Progressive filling uses the low-priority path and no longer adds network waiting on the first pass. Devices are notified when rows become available; the web has a catch-up limited to the preparation time.
- Actor and keyword calculation no longer loads trailers, external ratings, or unnecessary platforms. Simultaneous calculations for the same profile are pooled; actual sheets retain their functionality.

## v1.25.154 — October 2026

### Suggestions based on entire history

- All viewed titles from the profile contribute to the suggestion pool, with no limit of 20 titles or mixing between users. The ranking retains ratings, preferences, consensus between titles, and diversity.
- Suggestions from the dashboard, movies, and series use the same pool; Netflix, Disney+, and Prime Video filter this complete pool according to availability in the profile's country, instead of ranking an independent catalog.
- Public relationships and availabilities are progressively cached with limited concurrency. Web, smartphone, and Android TV rows refresh automatically as they are prepared, without changing existing DTOs.
- Viewed or rejected titles remain excluded. New releases, trends, and editorial rows keep their functionality; personal suggestions are no longer artificially supplemented by generic top-rated items.

## v1.25.153 — October 2026

### Real Pause and Plex History Export

- The WebTorrent pause closes existing transfer connections and rejects reconnections during the pause, without deleting files or losing their selection. Automatic retrievals no longer run on a paused torrent.
- Pause/resume commands wait for the engine's response; a failure no longer returns a misleading success, and the manual state is persisted.
- An explicit export allows transmitting a Movviz profile's viewing history to its own Plex account via the existing durable queue. Other profiles, Movviz dates, and current plays remain unchanged; ordinary imports still do not create any loops.

## v1.25.152 — October 2026

### SQLite Progression and View Consistency

- SQLite progression writing uses the correct number of parameters; it can no longer fail on "34 values for 33 columns".
- After synchronization, the JSON mirror resumes the canonical decisions of the same user, without new decisions or Plex propagation, while keeping unknown dates and states. This repair does not reset any current playback.
- An unreadable JSON mirror no longer masks valid SQLite decisions. The bundle check also verifies actual progression writing and mirror repair without adding a history event.

## v1.25.151 — October 2026

### SQLite Engine in Production

- Loading the SQLite module remains functional in the production Webpack bundle, instead of being replaced by a non-existent loader.
- Upon reactivation, each user's JSON views only complete unknown canonical states, with their original dates. An existing canonical decision, notably "not viewed," is never overwritten; no view is sent to Plex by this recovery.
- A check run on the real production bundle verifies SQLite, view and date preservation, user isolation, and adherence to "not viewed" decisions.

## v1.25.150 — October 2026

### Plex Import Verification

- Importing an old profile checks views in the storage actually used by clients: SQLite when available, otherwise JSON fallback. It no longer confuses the absence of the SQLite engine with the absence of all views.
- The report specifies the storage used, and Plex diagnostics indicate the availability of the context engine. The JSON fallback remains limited to the same user and does not overwrite decisions from an available SQLite engine.

## v1.25.149 — October 2026

### Plex Views and Search

- Plex observations are de-duplicated by user, and old events without a viewed status can be repaired without overwriting a more recent decision.
- Account associations reject ambiguous names, and the linking account never serves as a fallback for a shared profile. Full histories are taken once and then caught up by pages, with no total view limit.
- Importing an old account now verifies the actually recorded states before announcing success.
- Web search retains the typing during browsing and cancels obsolete answers. Android mobile and TV also protect title and person searches against late answers and redundant calls.

## v1.25.148 — October 2026

### YGGReborn Indexer

- YGGReborn is available in the Torznab catalog with its official API URL. The form provides access to the official guide to obtain the API key.

## v1.25.147 — October 2026

### V3x Indexer

- V3x is available in the indexer catalog with its pre-filled Torznab URL and API key authentication.
- The add and edit form provides a link to V3x integrations to retrieve the API key.

## v1.25.146 — October 2026

### Episode Tracking and Consistent Resume

- An episode is marked as viewed at 80% playback; progress and resume use the same threshold.
- TV and mobile players transmit the season and episode number to record the viewed status on the correct episode. Identifiable old progress is reconciled.
- A series suggests the current episode or the next unwatched episode in season order, without resuming an already completed episode. Local continuation remains available during Plex synchronization.

## v1.25.145 — October 2026

### Continuous Desktop Navigation

- The Home, Library, and Activity titles and their spacing have been removed from the sidebar. All main entries follow a uniform rhythm of 44 px with 4 px between lines.

## v1.25.144 — October 2026

### Desktop Sidebar Adjustments

- The compact rail button occupies its own line under the logo; icons remain vertically aligned between the two modes.
- Management no longer displays duplicate titles and its compact flyout only opens on demand, even from a Management page.
- The compact rail badges display numbers up to 99, then "99+".

## v1.25.143 — October 2026

### Stable and Compact Desktop Sidebar

- The desktop sidebar now remembers its expanded or compact state (240 px / 76 px) and no longer opens on mouse hover.
- Entries maintain a geometry of 44 px and a stable icon axis; navigation is organized into Home, Library, Activity, and Management.
- Management has an aggregated badge, a keyboard flyout in the compact rail, and torrent search has been moved there to leave global search to the Topbar.
- Updates no longer create permanent noise: Settings only displays an indicator when an update is available.

## v1.25.142 — September 2026

### Profile statistics and history pagination

- Android mobile displays the true totals for the watchlist and notes provided by the server, even when the profile rows only show a portion. The list counter reacts immediately to tapping.
- The history page with 200 entries retains a control element to detect continuation; the cursor filters the database directly to find older pages without loading more cards.

## v1.25.141 — September 2026

### Mobile list: favorites retained beyond 20 titles

- The profile transmits up to 500 watchlist items to Android mobile. The favorite button for a movie added after the 20th remains checked when refreshing the profile.

## v1.25.140 — September 2026

### Playback retained after episode replacement

- TV keeps "Play" in the episode and season details as soon as Movviz has the local file or a valid playback source.
- Plex enriches metadata without being able to hide local availability.
- When opening a targeted series, Movviz quickly checks local paths then the ambiguous episodes of that single series, without a global scan or application restart.

## v1.25.139 — September 2026

### AI Assistant: polar requests display cards

- "A good dark thriller" is recognized as a recommendation request and produces clickable cards on the web and Android mobile.
- If the model returns a list of titles instead of the expected format, Movviz converts it into cards. Already suggested cards are directly reused when the model copies the history; the technical block "Suggested Cards" no longer appears in the discussion.

## v1.25.138 — September 2026

### Redownloaded episodes: reliable file replacement

- A new episode takes the name and place of the old one, even if the engine had provisionally named it as another episode. Replacing S04E15 no longer leaves S04E15 missing or a "(2)" copy next to S04E16.
- The new file is checked and placed in standby before switching. If this fails, the old one remains available and the engine can retry the import.
- Movviz TV, mobile, and web immediately read the new local file. The ffprobe analysis continues in the background; an import callback replayed after renaming is acknowledged without creating a duplicate.

## v1.25.137 — September 2026

### AI Assistant: creator identity protected

- Only the creator's authenticated account benefits from the dedicated confidential conversation. Another user can no longer obtain this status by claiming to be Seb or by giving their first name.
- Questions about the creator's identity and impersonation attempts receive a mysterious response without calling the model. Previous erroneous exchanges are excluded from the context sent to the model, in the chat, and in session follow-ups.

## v1.25.136 — September 2026

### Home: rows in the same order on web, Android TV, and Android mobile

- Recent additions immediately follow Resume. On Android TV, the Movies and TV Series additions remain two consecutive rows.
- "Less than 40 minutes" appears right after "Movviz Trends".
- The order remains correct with old dashboard configurations; "Resume" remains at the top on Android as soon as media is available to resume.

## v1.25.135 — September 2026

### AI Assistant: readable and clickable answers on the web and Android mobile

- Internal markers for notes, facts, and choices no longer appear in the discussion, including in old answers and when the model escapes them. A simple question about a movie's note no longer records an invented note.
- Paragraphs, lists, and highlighted words are rendered cleanly. Titles recognized in answers open their sheet, and suggested answers become easy-to-tap buttons.

## v1.25.134 — September 2026

### AI Assistant: instant "add to my list"

- When designating a card it just showed ("add the second to my list", "add Mandibules to my list", "add them to my list"), the assistant immediately puts it in My list, without waiting for the model: less than a second instead of about twenty.

## v1.25.133 — September 2026

### AI Assistant: "add the second to my list" only adds the second

- "Add the second to my list" used to add the entire filmography of the person discussed instead of just the targeted title. "My list" was taken as a request for a list of movies. The assistant now only adds the designated card.

## v1.25.132 — September 2026

### AI Assistant: instant and reliable filmographies for a person

- Lists of cards for a person ("all films by Dupieux", "the 3 best", "show in 5") appear immediately. They could wait up to a minute: the assistant would ask the model for titles it no longer needed.
- "10 films by Dupieux", "the 5 best Nolan films", or "3 films by Dupieux" now display the correct number of cards for that person's films. Previously, the assistant suggested unrelated films, like *Détour mortel*. The name is first checked on TMDb: "10 horror films" remains a genre recommendation.

## v1.25.131 — September 2026

### AI Assistant: "add to my list" saves to My list

- "Add to my list", "put it in my watchlist", or "keep it in my favorites" now add the title to the user's list (My list), like the sheet button. It never triggers a download.
- The assistant understands which titles are targeted among the cards it just showed: a cited title, "the second", "the last", "the first 3", or "add them". Otherwise, it takes the title being discussed.
- It confirms what was actually saved and redisplays the cards for the added titles. The list updates immediately on the web and on Android.

## v1.25.130 — September 2026

### AI Assistant: filmographies in cards, and never an unsolicited addition

- "Show me all films by Quentin Dupieux" now displays clickable cards, like a genre recommendation, instead of a long text list. Each card indicates if the title is already in your library.
- Follow-up queries on the same person work: "show me his films", "the 10 best", "show in 8", "a list of 3 Dupieux films". The assistant picks up the person just discussed and displays the correct number of cards, sorted by rating when asking for the best. Previously, it answered from memory, without cards, and even claimed not to have access to the online catalog.
- The assistant no longer adds anything for download without being asked. A list request had triggered the download of three films. An addition now only happens on a real request ("add", "download", "retrieve"...) or on a "yes" to its own suggested addition. Otherwise, the titles are displayed as cards, ready to be added with a click.

## v1.25.129 — September 2026

### AI Settings: a test for each key

- Each Gemini key now has its own "Test" button. The test passes only through that key, with the chosen model, without another key taking over: you immediately see which key responds, which fails, and with what Google message.
- The result indicates Google's response time and the model's "thinking" token count, to understand where a slow response comes from.
- The provider's "Test" button now tests all keys one by one and displays a result under each one.

## v1.25.128 — September 2026

### AI Assistant: always the chosen model, one request at a time

- The assistant only uses the model chosen in the AI settings. It never switches to another model, especially not to models limited to 20 requests per day.
- One message sent, one request to Google: each message goes to the next key. If a key fails, the same request moves to the next key, without ever doubling the sends.
- If Google is overloaded on all keys, the assistant waits 2 seconds and retries once, always with the same model.

## v1.25.127 — September 2026

### AI Assistant: it holds up when Google is overloaded

- For two days, the main free Gemini models (Flash Lite) have often been saturated at Google: "too many requests" response or no response, on all keys at once. The assistant would then fall back to backup models, limited to 20 requests per day and quickly exhausted: failed responses, and no more movie cards with their buttons.
- When Google responds that it is overloaded, the assistant now waits 2 seconds and retries the main models once, instead of giving up.
- AI Settings: the log shows the detail of each attempt (model, key, exact Google response), to immediately see where a failure comes from.

## v1.25.126 — September 2026

### No more server freezing during daily Plex reconciliation

- Every night, the full reconciliation with Plex relaunched the technical analysis of all movies at once, nearly 2,000 at once. The NAS was saturated, all analyses failed, Movviz stopped responding, and due to no recorded result, the same wave returned the next day.
- Movviz now analyzes up to two files at a time, and a playback that starts always takes precedence over background analyses.
- A movie is re-analyzed after a Plex sync only if its file has changed, or if it has never been analyzed before.
- A file whose analysis fails is no longer retried on every sync unless it changes. Playback, however, always retries it.
- In case of failure, the logs now indicate the exact reason given by the analysis tool.

## v1.25.125 — September 2026

### Series: never again "Awaiting Plex Sync"

- A series available without a Plex link (Plex turned off, not yet synced, or files just organized) displayed a grayed-out "Awaiting Plex Sync" button and could not be played. Movviz knows where the files are: the button now directly plays the next episode present on the disk (the first unseen one), and every episode in the list also plays. Plex syncs in the background, without ever blocking.
- Series already linked to Plex keep exactly the same behavior.

## v1.25.124 — September 2026

### Monster: reliable organization under Windows, and button to run it

- Under Windows, the folder "Monster (2022)Season 04" was created but remained empty: the system refused to move a file still open by another program (Plex, an antivirus...). The file is now copied, its size verified, and the library uses the copy immediately. The original is deleted as soon as it is released.
- Monster Series Card → Edit: new "Organize like Plex" button that organizes the files immediately and displays the result for each episode, with the exact error if the system refuses.
- Sheets: the displayed path is the NAS path (the one Plex sees), and no longer the path inside the Movviz container, when Movviz knows the correspondence between the two.

## v1.25.123 — September 2026

### Monster: the four parts arranged as a single series for Plex

- "Monster: The Lizzie Borden Story" did not appear anywhere in Plex once downloaded. TMDb presents each part of the Netflix anthology Monster as a separate series, while Plex only knows one, "Monster," of which these are the seasons. Listed in its own "Season 1" folder, Lizzie Borden was merged by Plex with Dahmer's season 1: its episodes became invisible there.
- Movviz now arranges the anthology as Plex expects, in the "Monster (2022)" folder: Dahmer in season 1, the Menendez brothers in season 2, Ed Gein in season 3, and Lizzie Borden in season 4. Already downloaded files (Lizzie Borden, Ed Gein) are automatically moved one minute after the update, and then Plex is restarted. When the NAS refuses a simple move between two folders, the file is copied, verified, and then the original is deleted. In Movviz, each part remains a separate series, with its own sheet.
- This rule only concerns Monster; mass renaming is unaffected.

## v1.25.122 — September 2026

### Sheets: the entire file path

- "Edit Sheet" (the pencil) now displays the full file path, on several lines instead of being cut off, with a button to copy it.
- For a series, which showed none: the series folder, then the folder for each season.
- Windows paths (D:\…) are displayed as NAS paths.

## v1.25.120 — September 2026

### AI Assistant: full or compact context, your choice

- Settings → AI Assistant: new choice "Assistant Context". Full (by default) keeps all detailed instructions; Compact keeps the same rules and personality in about 40% less, for slightly faster responses.
- In both cases, the assistant speaks more humanly: sentences of varying lengths, natural phrasing, no list when a sentence suffices, no canned conclusion, and it can hesitate, change its mind, or simply admit an error. Its personality remains exactly the same.

## v1.25.119 — September 2026

### AI Assistant: it knows who created it

- The assistant knows that Seb (dj41ph4 profile) is its creator. With him, it is more complicit: winks at its own updates and past bugs, speaks frankly, and no longer presents itself as if to a stranger. It keeps its personality and dignity: creator does not mean master.
- With all others, it knows that the person claiming to have created it is mistaken, and it takes it with humor.
- Preparation of a lightweight version of its instructions (same personality, same rules, 40% shorter), testable only by an administrator until it proves itself.

## v1.25.118 — September 2026

### Android TV: return to the home screen without a locked D-pad or side bar

- After returning from an open sheet via "Continue Watching," BAS from the "Play" button on the hero no longer did anything. Moving to the row below targeted its very first card, which was no longer displayed once the row was scrolled or reordered. The home screen rows now open by the row itself: BAS arrives at the last selected card, or the first visible one.
- Upon returning from a sheet, focus returns to the home screen instead of staying on the side bar, even if you had scrolled further down the page.

## v1.25.117 — September 2026

### AI Assistant: no more "in the vein of" movies from a title it misunderstood

- When the assistant suggested movies, it automatically added titles "In the vein of" the one you were talking about, even if you hadn't asked for it. It took "nothing else" for the movie "Dad and Nothing Else"; despite your correction, a simple "do whatever you want" then gave a whole list in the vein of that movie.
- Similar titles are only added if you ask for them ("in the same vein," "like this one," "in the same line," etc.) or for the page you are viewing.
- When you correct it ("I asked you to...", "that's not it," "you misunderstood"), the assistant forgets the title it thought it recognized.

## v1.25.116 — September 2026

### Android TV: focus stays where you are, and pages open faster

- No more returning to the sidebar by itself, or jumping to "Play" while browsing. When the end of a loading (resume, seasons, "watched" status) modified the page, the app would automatically reposition the focus, sometimes on a button hidden under the season screen: it would then disappear completely. These automatic placements no longer happen once you have moved, and never under an overlay screen.
- If a selected item disappears during a loading, the focus returns to the page, on your last choice, instead of moving to the sidebar. LEFT, BACK, and OK work as before.
- "Resume" responds immediately instead of querying Plex for 2 to 5 seconds upon each page opening. The list is refreshed in the background and re-read as soon as a "watched" or resume changes.
- TV and phone: up to 10 simultaneous requests to the server instead of 5. A slow request no longer makes the page and the images behind it wait.

## v1.25.115 — September 2026

### Android TV: Plex owner account pages open again

- For the Plex owner account, opening a series page used to make every episode checked with Plex, in batches of 50 sent one after another, before responding: from 10 to 50 seconds for a long series. The TV app would time out after 20 seconds while the server continued, each opened page re-running a full check, and the TV requests would pile up behind: pages that never came, images from the previous page remaining displayed.
- The page now immediately receives the known "watched" status. The check with Plex is done in the background, one at a time per title and no more than once every two minutes. If Plex signals a real change, the page updates live on all your devices.

## v1.25.114 — September 2026

### Android TV: recent additions are no longer limited to a single series

- When a series arrives all at once (Regular Show, 15 episodes on the same day), it used to take up almost the entire list of recent episodes sent to the devices. Once grouped by series on the TV, the row would only show that. The list now goes up to cover twenty different series: the Regular Show block with its 15 episodes remains at the top, followed by other recent additions.
- Web and phone: the row showing each episode is still limited to the last 24.

## v1.25.113 — September 2026

### AI Assistant: it also reads the movies it suggests

- Out loud, the assistant only read its text: the cards remained silent, and a recommendation named no movie. It now reads every suggested title with its description, for example "Nobody: bum, jubilant, and cut from the same cloth as John Wick," on the web as on the phone.
- Phone: only a response to a question asked on this device is read. A conversation coming from another screen remains silent.

## v1.25.112 — September 2026

### Android mobile: voices as natural as on PC

- The assistant speaks with the Google synthesis engine when installed, the same voice family as Chrome on PC, instead of the phone's engine (the Samsung one on a Galaxy, much more robotic).
- Online voices, the most natural, are prioritized, and the best one is automatically chosen unless you select another. Offline, the phone automatically switches back to its local voice.

## v1.25.111 — September 2026

### AI Assistant: no more 10-second delays in responses

- Occasionally, Gemini takes 10 to 15 seconds to respond to a request it usually processes in one second: the same message, sent right after, responds in 1.2 seconds. If the response hasn't arrived after 4 seconds, Movviz now sends the same request with the following key and keeps the first response that arrives; the other is canceled.
- A normal response never costs an extra request: the retry only happens for a delayed request.

## v1.25.110 — September 2026

### Android TV: End of infinite loading on the Plex owner account

- Only the Plex owner account checks the "seen" status of each episode directly with Plex upon opening a card. For an episode never watched, Plex provides no date, and Movviz had no record of it either. However, Movviz detected a difference and recorded a "not seen" dated to the moment of verification: a new one for every check, notifying your devices, which re-read the card, which triggered the check again, endlessly, once per second. This is why only this account was blocked.
- An episode never seen on both sides remains "never seen": Movviz no longer invents a "not seen" date for it. No more unnecessary rewriting, no more loop, and no more false recent date that could override an older true "seen" that arrived later (an import, for example). A true "not seen" is always recorded: an episode marked as "not seen" in Plex, or seen in Movviz but not seen in Plex.
- For safety, your devices are no longer notified unless a "seen" or "Resume" genuinely changes: a Plex sync that reaffirms an already known "seen" triggers nothing. Real-time between devices works as before.

## v1.25.108 — September 2026

### Android mobile: Chat input sticks to the keyboard

- On some phones, the Movviz AI input area floated in the middle of the screen when the keyboard opened: Android had already scrolled up the screen and the keyboard height was counted a second time. The margin is now calculated from the actual keyboard position, and the input remains stuck just above, like in any messaging app.

## v1.25.107 — September 2026

### Real-time: The conversation with Movviz AI follows on all your screens

- A conversation started on the PC continues on the phone, and vice versa: every question and every answer appear immediately on your other devices, without reopening the chat.
- "Clear" clears the conversation everywhere at once, and a replaced card ("Already seen", "Not for me") is also replaced on other screens.
- "Play it" only starts playback on the device where you requested it, never on another screen displaying the same conversation.

## v1.25.106 — September 2026

### AI Assistant: It knows the date and time

- The assistant now knows the real day and time, according to your device's time (web, phone). It no longer takes a past date for "the future"; it correctly calculates durations, ages, and birthdays, and it knows when it is late.
- Documentation: The README has been completely rewritten and details every Movviz feature.

## v1.25.105 — September 2026

### Real-time: "Available → Read" instantly, updated Android home

- Android TV and phone: The home screen finally reflects live changes. "Resume," recent episodes, and the library refreshed in real-time did not reach the home screen, which read a frozen copy. Same for the card removed from "Resume" when marking a title as seen.
- Real-time: When a download finishes, the open card immediately switches to "Read" and the episode appears in "Recently Added Episodes," without re-reading the entire library: only the relevant title is re-read.
- Android cards: No more looping re-reading during a download. The card is read upon opening, and only when the server signals a change.
- Web: No change, it already reacted to these events.

## v1.25.104 — September 2026

### Real-time: a change on one device appears instantly on others

- Real-time: marking as seen or unseen, advancing playback, removing a title from "Resume" or modifying "My List" on the PC is instantly reflected on Android TV and the phone, and vice versa. The server notifies the user's devices upon change, and only then: no more unnecessary refreshing when nothing has changed. This even works when Plex is off.
- Downloads: Android apps no longer re-read the queue every 8 seconds. The server signals a new download itself, including automatically started ones, the end of a download, or progress of at least 1%, and only when a device is connected.
- Android TV and phone: upon returning to the app (end of playback, returning from another app), "Resume" and viewed items are re-read once, to catch up on what has changed during the absence. Same thing after a network outage.

## v1.25.103 — September 2026

### AI Assistant: it acts instead of asking questions, and "Clear" deletes for good

- AI Assistant: "Clear conversation" truly deletes. On Android, re-reading the conversation right before or during deletion could make it reappear. On the web, a local copy would display it again upon the next reload.
- AI Assistant: it launches what is asked. "Play Silent Night" starts this library title. "Play a random movie" or "play an action/horror/comedy movie..." chooses a movie from your library, not yet seen, of the requested genre, and plays it.
- AI Assistant: "I feel like watching something tonight", "lesser-known gems", "an action movie", "something short"... give direct suggestions, instead of a question in return.
- AI Assistant: the "Movie / Series" buttons no longer appear under a question about something else (for example, "a comedy or a thriller?").

## v1.25.102 — September 2026

### Server: lighter background tasks

- Server: automatic searches (missing movies, today's releases, RSS feeds) constantly compared the same release names to the same library titles, costing about 5 seconds of computation per pass. These comparisons are now cached, with strictly identical results.
- Server: each data read queried the disk to see if the file had changed, hundreds of times per pass, a blocking and slow call on a busy NAS drive. This check is now done at most once per second and per file. Writes are not delayed, no data is affected.
- Server: building the "Open in Plex" links for each library episode is faster, with identical links.
- Server: during a clean shutdown, the last modifications still pending writing are saved immediately.

## v1.25.101 — September 2026

### Server: end of massive TMDb cache rewrites

- Server: the TMDb data cache, stored on disk (several hundred MB), was rewritten entirely whenever a single piece of data changed, up to every 30 seconds during background tasks. This cost several seconds of computation per pass, and the saturated disk made everything else wait. Now only modified data is added. A full rewrite only happens once a day, or when the file contains more expired versions than useful data. On startup, the most recent version of each piece of data is correctly read.

## v1.25.100 — September 2026

### Diagnostics: precise measurement of server slowdowns

- Diagnostics (administrators): a profile of the server's activity over a few dozen seconds indicates which operations consume the most. It helps target background tasks that freeze the server for several seconds, without guessing.

## v1.25.99 — September 2026

### Much faster to open details

- Sheets: a sheet that never opened used 3 to 4 seconds on the server, up to ten on mobile. Three causes corrected:
  - to rule out vertical trailers, the server queried YouTube for each video, and each failure was forgotten: it retried on every opening, waiting up to 3 seconds. It now waits at most 0.4 seconds, retains definitive answers, and does not retry a failed check for an hour;
  - background tasks (missing movies, metadata refresh...) occupied all the queue slots towards TMDb: an opened sheet was queued behind them. User requests now pass through first, with reserved slots;
  - IMDb and Rotten Tomatoes scores are retrieved at the same time as the trailer, and no longer afterwards.
- Android mobile: the sheet loads everything at once instead of step by step (library check, then sheet, then logo, then resume). An already opened sheet reappears instantly, including seasons, then updates silently. "Checking file..." no longer displays for a title already known in the library.

## v1.25.98 — September 2026

### Android TV: "Next Episode" button instead of the banner

- Android TV: the large "Next Episode" end-of-episode banner is removed. In its place, the usual "Skip Credits" button becomes "Next Episode" when a continuation exists: same style, same location, and it appears during the end credits provided by Plex, at the exact times. For an episode whose credits Plex does not know, the same button appears in the last 45 seconds.

## v1.25.97 — September 2026

### AI Assistant: voice chat

- AI Assistant: two new settings in Settings → AI, disabled by default, "Voice Dictation" and "Read Aloud". As long as they are off, no voice button appears.
- Voice Dictation: a microphone button next to send. We speak, the text appears live then disappears by itself. Launched from the microphone, the assistant listens again after each response for a real hands-free conversation, until the next tap on the microphone.
- Read Aloud: the assistant reads its answers (without emojis) with the device's voice, chosen from available ones, most natural first. A short test allows hearing each voice. On Android, a long press on the speaker reopens the voice selection.
- Web: everything goes through the browser, free and without quota. The microphone requests browser permission, and on Windows, permission from Settings > Privacy > Microphone. It only works over https or on localhost (browser rule). On http, the microphone button indicates it, and read aloud still works.
- Android mobile: dictation goes through Google voice recognition, without microphone permission for Movviz, and reading through the phone's voice engine.

## v1.25.96 — September 2026

### AI Assistant: "play it" really plays the movie

- AI Assistant: it can start playback. "Play it", "start the movie", or "go ahead and play" open the player on the title you are talking about: the movie itself, or for a series, the current episode, otherwise the next unwatched one. A ▶ button remains in the conversation to restart it. On the web as in the Android mobile app.
- AI Assistant: if the title does not yet have a file in the library, it says so and suggests adding it. Previously, this request could end with "I missed my answer this time."

## v1.25.95 — September 2026

### AI Assistant: suggestions faithful to the request, no buttons on a goodbye

- AI Assistant: a movie request no longer suggests a series, and vice versa. When most of its ideas have already been seen, the supplementary titles must now share a genre with the request: a "horror movie for beginners" displayed an animated series from the last thing watched.
- AI Assistant: quick reply buttons only appear if its message genuinely asks a question. A "have a good evening" no longer displays them.

## v1.25.94 — September 2026

### Reading: progress and "seen" are no longer lost

- Reading: progress and the end of an episode or movie were no longer saved, on all devices (web, Android TV, mobile). Playback sessions only existed in server memory: every restart, for example during an automatic update, erased them, and a running player would continue sending its progress into the void. The position remained stuck at the last recorded value before the restart, and a finished title remained in "Resume". Sessions are now saved and found after a restart. The web player also reopens a session by default if it loses one.
- Resume: marking a title in "Resume" as seen erases its progress and immediately removes it from the list, even before Plex has registered it as "seen". On Android TV and mobile, the card disappears upon tapping.

## v1.25.93 — September 2026

### AI Assistant: quick replies adapted to the question

- AI Assistant: the quick reply buttons under a message answer the question it just asked. It suggests them itself (e.g., "Yes, tonight", "Later", "Another of the same kind"), instead of the fixed buttons "Go / Movie / Series / Surprise me" which were displayed even when it was talking about a specific title.
- AI Assistant: it no longer writes the name of an emoji in full next to the emoji ("popcorn 🍿").

## v1.25.92 — September 2026

### AI Assistant: never "yes master" again, and it won't be overwritten

- AI Assistant: someone who demanded to be called "Master" (or Lord, Majesty...) no longer has the "yes master" responses. The assistant used to imitate its own old responses from the conversation: these phrases are now erased from what it rereads and what it writes. A prompt reminds it that this title is not a name, including from one session to the next. A sentence talking about the title ("you are not my master") remains intact.
- AI Assistant: when faced with an insult or contempt ("you are useless", "go fuck yourself"...), it no longer apologizes flatly nor does it validate the insult. It maintains its composure with a subtle jab, without gratuitous attack or resentment, and doses its response according to the tone: a light retort for teasing, an honest correction for real criticism.

## v1.25.91 — September 2026

### Recently added episodes: no more titles stuck at the top

- Recently added episodes: episodes already present in the library (e.g., "H") would reappear at the top of the list and trigger their "now available" notification, as if they had just arrived. Automatic download retrieval, which runs every 15 minutes and on every restart, would re-import them every time. It now leaves alone a file that the library already has. A file reviewed in the same location keeps its original added date.

## v1.25.90 — September 2026

### Android TV and mobile: instant "Seen" button

- Android TV and mobile: the "Seen" button toggles upon press. Movviz then records in the background, without waiting for the server response, and reverts to the previous state only if the recording fails.

## v1.25.89 — September 2026

### AI Assistant: Gemini only, keys used in rotation

- AI Assistant: Groq is removed. Its free limit (8,000 tokens per minute) rejected all chat questions, even those with much longer prompts. Gemini answers everything, including web search: the search goes through Tavily and Gemini drafts the answer from the results.
- AI Assistant: with multiple Gemini keys, each message uses the next key (message 1 on key 1, message 2 on key 2... then back to the first). Each key rests between uses, instead of wearing out the first one before touching the others. If a key is occupied or exhausted, the next one takes over in the same message, without waiting.

## v1.25.88 — September 2026

### AI Assistant: it no longer stays silent when Gemini is saturated

- AI Assistant: One in two messages remained unanswered when the Gemini model was saturated ("high demand") or had reached its requests per minute limit. The assistant now immediately switches to the next Gemini model, which has its own quota, instead of failing. It no longer waits 45 seconds for a blocked model before trying elsewhere.

## v1.25.87 — September 2026

### AI Assistant: aligned suggestion buttons

- AI Assistant: The buttons for a suggestion (check, My list, Seen, 👍, 👎) fit on a single line, across the full width of the card, with 👍 and 👎 aligned to the right. On a narrow screen, 👎 no longer wraps to a new line by itself.

## v1.25.86 — September 2026

### AI Assistant: it understands despite typos

- AI Assistant: Typos no longer prevent it from understanding. "apelle moi maitre", "je l'ai deja vu", "recommande moi un flim d'horeur" or "le prochian episdoe" are recognized as if they were correctly written, for all its reactions and not just a few sentences. Movie and series titles are still searched as you wrote them, and common words are never incorrectly "corrected."

## v1.25.85 — September 2026

### AI Assistant: it keeps the thread and submits to no one

- AI Assistant: It maintains the thread of a conversation after a series of suggestions. It now remembers the titles it has presented as cards and understands "the second one," "that one," or "why this one?" several messages later.
- AI Assistant: "call me master" (or lord, majesty, boss...) is no longer taken as a first name and no longer replaces the real one. The assistant refuses the title with humor, reminds the user that they are only human, demands their real name, and gently threatens them with a nickname of its own choosing. It always does this with its own words, never with a canned phrase, and continues to help with everything else. A previously registered "first name" of this kind is automatically corrected.

## v1.25.84 — September 2026

### AI Assistant: "My list" button on suggestions

- AI Assistant: A title already in the library now only displays the green checkmark, leaving space for actions.
- AI Assistant: A new "Add to my list" button appears between the checkmark and "Seen," on the web (desktop and mobile browser) as in the Android mobile app. It uses the same list as the rest of Movviz, and a second tap removes the title from the list.

## v1.25.83 — September 2026

### AI Assistant: no more Gemini error in question, several users served at the same time

- AI Assistant: The error "Requests ending with a model turn are not supported" can no longer occur. The assistant's spontaneous message could be added to the conversation while a question was being processed: the Gemini 3 models would then reject the request. This message no longer appears during an active conversation, and the assistant always responds to the user's last message.
- AI Assistant: Several people can talk to it at the same time without waiting for others' responses. Requests are sent at short intervals to respect free quotas, but up to three responses are prepared simultaneously.

## v1.25.82 — September 2026

### AI Assistant: Groq and Gemini only, real web search

- AI Assistant: Only two providers, Groq (GPT-OSS 120B model) and Gemini, both with a free offering. Mistral, Cerebras (which requires a payment method), OpenRouter, and OpenCode (unusable outside its own software) have been removed.
- AI Assistant: We simply choose the primary provider; if it fails (quota reached, error), the other takes over automatically. There is no longer an order to set or a toggle option to activate.
- AI Assistant: If the conversation exceeds Groq's free limit (8,000 tokens per minute), it goes directly to Gemini, without going through a rejected request. Groq is for shorter calls.
- AI Assistant: web search (movie music, iconic scene, filmography) uses a real search engine, Tavily, whose results are summarized by the assistant. Just paste your free Tavily key under the "Web search" option in Settings → AI.

## v1.25.81 — September 2026

### Cerebras as primary AI assistant

- AI Assistant: new provider Cerebras (GPT-OSS 120B model, fast, with a generous free quota), placed first by default. Its free key is created on cloud.cerebras.ai and then pasted into Settings → AI.
- AI Assistant: a message left unanswered (provider unavailable) no longer remains orphaned in the conversation.
- Android mobile: in the library, the Movies / Series selector is aligned with the rest of the page.

## v1.25.80 — September 2026

### Assistant visible on opening on mobile, library on three columns, chained Gemini keys

- Android mobile: the AI assistant bubble appears upon opening the application, in both portrait and landscape. Choosing its profile used to make it disappear right after loading, and it would only reappear after screen rotation.
- Android mobile, portrait: the library displays three posters per row across the full width, instead of two with a large gap on the right. The "Genre" and "Duration" filters have their text properly centered.
- AI Assistant (desktop, phone, and mobile app): a title added from a suggestion simply displays "Added".
- AI Assistant: with multiple Gemini keys, a key whose daily quota is exhausted immediately passes to the next one, without waiting time.

## v1.25.79 — September 2026

### Android mobile: assistant visible in portrait, readable episodes, haptic feedback

- Android mobile: the AI assistant bubble reappears in portrait. The application used to request the assistant's status before loading the server address, and never retried: the bubble only appeared after screen rotation.
- Android mobile: in the chat, the input area remains just above the keyboard, instead of rising almost to the top of the screen.
- Android mobile, portrait: the episode list for a season has been completely revised. Title on two lines, air date, summary across the full width, discreet "seen" checkmark, and phone margins. Titles were being cut off after three letters.
- Android mobile, portrait: an episode's window stacks its buttons instead of writing "Back" letter by letter. On the details page, "Resume" and "Series seen" take up the full width, season cards are more compact, "Cast" and "Similar titles" are aligned to the rest of the page, and titles under posters are no longer cut off in the middle of a word.
- Android mobile: every button provides slight haptic feedback on touch, including those marking a title or episode as seen. The phone's vibration setting is respected.
- Downloads: no more absurd remaining duration ("37458 h") when a source streams almost nothing, and two-line titles are correctly spaced.
- Administration: resuming the history of a deleted Plex profile now runs in the background, without being cut off after one minute.

## v1.25.78 — September 2026

### Corrected Plex view dates, ongoing series remain at the top

- Plex: for all shared accounts (everyone except the server owner), view dates from Plex were recorded in the wrong unit and appeared as January 1970. They are now correct, and previously recorded dates are automatically repaired upon server startup. Recent views thus regain their place in the history and in suggestions.
- Marking an old episode of a series as seen no longer pushes that series back in the recently viewed titles: the most recent date always prevails.
- Administration : a diagnostic lists all known Plex server accounts, including a deleted Plex Home profile, with the number of views for each. A tool allows restoring the history of such a profile into a Movviz account, without ever showing these old views before recent views, without touching what is currently playing, and without writing anything to Plex.

## v1.25.77 — September 2026

### More relevant and mobile AI Assistant, account deletion, repaired Plex user import

- AI Assistant: it no longer suggests a title already seen, including a series that has started or is currently airing, nor a title already suggested in the same conversation. It knows the list of everything you have seen, even when it advises in a few words.
- AI Assistant: it acts instead of asking questions. "Something similar," "animation," "you know what I like" directly provide a selection. It relies on a taste profile calculated from what you are actually watching (dominant genres, favorite actors and directors, ongoing series) and looks for lesser-known titles when the classics have already been seen.
- AI Assistant: "mark as seen" and "I've seen everything" truly mark titles as seen. Each suggestion has a "Already seen" button and an "Not for me" button that immediately replace it with another. Quick replies ("Darker," "More of a movie," "Lesser-known gems,"...) appear under its responses, and it presents its selections with its own phrasing.
- AI Assistant: ask it what it can do for you, and it responds with a clear list of what it really knows how to do. It also knows the new features of the current Movviz version.
- Android mobile: the AI assistant arrives in the application, with the same conversation as on the computer, the same suggestions, and the same buttons.
- Users: an administrator can delete an account from its profile. The account is disconnected from all its devices. It is impossible to delete one's own account or the last administrator.
- Plex: "Import Plex users" finds people who have access to the server again. The import relied on the Plex friends list, often empty even for real server users. For the same reason, a new server user could be denied connection with their Plex account.
- NAS / Docker Update: the "Click here to update" button, unusable on these installations, is removed from the update window.

## v1.25.76 — September 2026

### Repaired AI Assistant, "To rewatch without moderation," no more already seen titles in suggestions

- AI Assistant: it responds again. Movviz itself was saturating the free Mistral quota (about one request per second): the profile update was relaunched after every failure, opening the chat waited for two AI calls, and a single message could trigger up to fifteen. Calls now pass one by one at the right pace, a refusing provider is rested for a minute, and a message no longer requires more than two corrections.
- AI Assistant: the chat opens immediately, without waiting for the AI. A recommendation requested from a profile is displayed without waiting for the analysis of each suggested title; missing analyses are then done in the background.
- Gemini: Google has closed the 2.5 models to new accounts. Movviz switches to Gemini 3.5 Flash Lite and, if Google rejects a model, automatically tries the next one. In Settings → AI, the list of Gemini models is tested with your key and only shows those that actually respond, along with their free daily quota.
- Home (desktop, Android TV, and mobile): new "To rewatch without moderation" row with already seen and still available movies and series, from newest to oldest. A title marked 👎 does not appear there.
- Suggestions: a movie or series already seen no longer appears, whether it was marked as seen manually or simply watched.

## v1.25.75 — September 2026

### Sharp images on Android, same optimizations on mobile, measures server slowdowns

- Android TV and mobile: posters, backgrounds, actor photos, episode and season thumbnails display sharply from the start. They were previously loaded in too small a size for their frame, then enlarged (blurry), and only became sharp once the card was selected. Actor photos are also loaded in higher resolution for 4K TVs.
- Android mobile: the same improvements as on Android TV. The app no longer queries the server when it is not on screen. Fast forward and rewind are grouped into a single jump. In a series, "Skip to next episode" launches the next episode.
- Just after a server restart, a card no longer waits for the TMDb cache to be re-read for information already in memory. Each read could previously wait up to 3 seconds during this phase.
- Diagnostics: the server now records which scheduled task or startup step is freezing it, and for how long. It also notes the reading of large files, to target future optimizations.

## v1.25.74 — September 2026

### Android TV: entire card on opening, grouped fast forward, no more background requests

- The card now opens entirely: logo, status badge, and information remain visible when "Play" is selected, instead of an automatic scroll that cut off the top. Moving from "Play" to "Trailer" no longer moves the card; normal scrolling resumes by scrolling down to seasons, cast, or similar titles.
- Fast forward and rewind grouped in the player: successive presses on ⏩ / ⏪ (or on the progress bar) accumulate on the screen ("+1:00"), then a single jump occurs when released. Previously, each press relaunched playback on the server, and a series of quick presses could end in a playback error.
- The app no longer refreshes anything when it is not on screen (TV switched to another app, playback in progress). A card left open used to continue querying the server dozens of times per minute; everything now refreshes all at once upon return.

## v1.25.73 — September 2026

### Android TV: "Skip to next episode" in one OK, Esc closes card on desktop

- Android TV: when "Skip intro" or "Skip to next episode" appears, the remote control is placed on it and stays there, even when the playback bar hides. Previously, the bar resumed selection and OK did not perform the jump. An arrow re-displays the bar without losing the button.
- Android TV: in a series, OK on "Skip to next episode" directly launches the next episode (the exited episode is marked as seen). The intro, a movie, or the last episode simply skips the sequence, as before.
- Desktop: Esc closes the open card, like the "Close" button. It does not close anything if a window is open on top (edit, versions, searches), during typing, or in full-screen video.

## v1.25.72 — September 2026

### "Selection for you" without actor invasion, more sober cards

- "Selection for you": the filmography of favorite actors and directors is subject to the same limit as the rest. Since v1.25.71, it could fill the row (several films from the same saga, unrelated TV appearances).
- The link between movies and series no longer relies on the French or European language of a viewed title: watching a French comedy no longer suggests French series if it's not your taste. Japanese (anime) or Korean (drama) are still taken into account.
- Desktop Home: "Recommended suggestions" returns to landscape format, like other rows. Only "Movviz Trends" keeps the poster format.
- Desktop Library: The "Available" badge on cards (and the episode counter for series) is 25% smaller.

## v1.25.71 — September 2026

### "Selection for you" takes into account everything you have seen

- Every title viewed now brings its share of suggestions. Previously, a single strong title (rated, liked, or viewed recently) brought all its similar ones to the top and filled half the row. Titles recommended by several of your viewings now appear first: this is the surest sign of what you like.
- Movies and series feed each other: the series you watch also guide the suggested movies, and vice versa (an anime brings Japanese animation movies, a crime series brings movies of the same genre, an epic movie brings epic series). Someone who only watches series now also receives movies.
- Same improvement for "See all", the Discovery page, and the home hero, on desktop, Android TV, and Android mobile.

## v1.25.70 — September 2026

### Audit of the last two versions: reinforced protections

- Playback on Android TV and mobile: current playback is counted as an activity again, and background tasks step back during a movie or episode, like before v1.25.69. Only pages left open without doing anything no longer throttle the background.
- Library/disk reconciliation: a file is only considered missing if it is truly unfindable. A temporary storage error (busy NAS, slow network share) is no longer counted as a disappearance. A temporarily inaccessible download folder (unmounted share, sleeping disk) is ignored during the scan, instead of making the entire library it contains appear missing.
- New safety: if a scan suddenly finds more than 50 unfindable files representing more than 20% of the library, nothing is moved to the trash, and a notification signals the anomaly. Reconciliation has never deleted a file from the disk. This safety also prevents an unavailable storage from filling the trash with still-present titles.
- Overseerr/Seerr import now merges potential library duplicates on every scan, like before v1.25.68 (without the disk check that froze the server).
- Right after a restart, a page no longer waits more than 3 seconds for the TMDb cache reload, to never exceed the Android application waiting time.

## v1.25.69 — September 2026

### Startup without freezing, background tasks advance, "Less than 40 minutes" without shorts

- "Little time? Less than 40 minutes" no longer suggests shorts under 10 minutes (bonus, clips, mini-episodes), on desktop, Android TV, and Android mobile.
- After each restart or update, the server re-read its TMDb cache of several hundred MB in one block and froze for several seconds: everything remained loading. It now reads it progressively without blocking. The rest of the application responds immediately, and only the pages that need TMDb wait a few moments for the reading to finish, instead of asking TMDb for everything. The first startup after this update converts the old file one last time.
- A TV or phone left open on a page or on a playing movie was counted as a user continuously clicking: background tasks (Plex synchronization, intros and credits…) stepped back and could drag on for hours. Only real actions are counted now: opening a page, browsing, starting or advancing playback. Automatic refreshes no longer count, on all applications.
- Performance measures reserved for administrators now include server memory distribution.

## v1.25.68 — September 2026

### Trailer with image on Android TV, server no longer freezes

- Android TV: the full-screen trailer played sound on a black screen. The YouTube video was indeed played, but in a zero-height frame, so invisible. It now occupies the entire screen.
- The periodic import of Overseerr/Seerr requests ran a full disk check on every pass, which froze the entire server for over 30 seconds on a NAS: every page and every record remained loading, until abandonment on Android TV. The import now only de-duplicates the titles it has just added, and the disk check (daily or manually run) no longer blocks the server while running.
- The TMDb cache backup, which exceeds several hundred MB on a large library, was written in a single block and froze the server for several seconds each time. It is now written in small chunks, without interrupting other requests.

## v1.25.67 — September 2026

### Android TV: Reliable return to the player, time displayed on the bar

- Since adding "Return closes the bar first", Return could remain with no effect when the bar was already hidden: the area capturing keys at that moment still relaunched the display timer on a Return press, entering a race with the player closing. Fixed.
- The playback bar now displays the current time in the top right, next to the movie or episode title in the top left.

## v1.25.66 — September 2026

### Less stingy suggestions, instant records, enriched playback bar

- The suggestion engine ("Selection for you", "In the vein of ...", "Netflix/Prime suggestion for you") systematically removed any title already present in the library, even if never watched — whereas "Similar titles" at the bottom of a record never filters the library and displays those same titles. Only what has actually been seen is now excluded.
- Reopening a record viewed in the current session is displayed instantly (a fresh version reloads silently in the background); the very first load displays the record's silhouette instead of the spinner. A record pointed at with the remote for 750 ms is preloaded in the background, for an instant rendering once opened.
- The playback bar displays the actual decoded resolution (4K/1080p/720p) and audio codec (Dolby Digital/Digital+, TrueHD, DTS, AAC...), with the same badge style as the desktop.
- An initial OK during playback only displays the bar, without pausing: previously, an unintentional focus back-and-forth was required for this not to happen. A second OK, on the pause button which is now truly focused, pauses.
- Return first makes the playback bar slide down if it is displayed, before leaving the player on the next Return.

## v1.25.65 — September 2026

### Android TV: Playback, library, search, and focus stabilized

- The full-screen trailer sometimes lost sound after buffering (unstable network): the image remained but the sound did not return. It is now reapplied on every playback restart instead of just once at the beginning.
- In the Library, changing the sort or genre now scrolls the grid all the way up instead of leaving the first title out of view. The sort, the chosen genre, and the new "Show missing" box (unchecked by default, which hides movies without files and series without any available episodes) remain in memory when changing tabs, including upon returning to a record.
- The Movies/Series filter in the Library and Discovery remembers its last choice instead of defaulting to Movies on every return.
- Search displays a title already present in the library from the first letters typed, without waiting for the end of typing or a distant response.
- Cards, covers, and badges no longer zoom at focus, and the selection border no longer blinks when leaving a button.
- A movie or episode watched over 80% and then left (Return, or moving to the next episode) is now marked as seen and disappears from Continue Watching, as was already the case upon reaching the credits. What was already in this case before this update is updated automatically, once.
- The "viewed" pill (episode, season, movie, search) now has the same style everywhere: a black, rounded-corner pill, identical to the one for seasons.
- Opening a fiche no longer lands directly on the "Play" button: the top of the screen (cover, title) remains visible upon opening, and the focus always leads to the button.

## v1.25.64 — September 2026

### Android TV: logo on "Continue Watching" movies

- The thumbnails in the "Continue Watching" row only required the official title logo for series: a replayed movie ("300", "100 Million!") always kept its written name underneath, never its logo. Movies are now treated like series.

## v1.25.63 — September 2026

### Android TV and smartphone: premium loading; Android TV: stable focus when opening a fiche

- The text "Loading..." alone on a black background is replaced, on Android TV and on smartphone, by a real brand loading: the Movviz logo breathes in the center of an aurora halo that slowly rotates, with a light streak sweeping underneath. It is used for movie and series fiches, an actor's fiche, and episode loading.
- Opening a fiche from the home screen no longer sends the D-pad to "Home": during loading, no one could receive focus, which would then fall on the side bar and not return. The loading screen now keeps the focus, and the focus request is reissued upon arrival of the fiche.
- The main button on a fiche is now a single button that changes its label ("Play", "Resume at...", "Add to library"), instead of being destroyed and recreated on each update; it is present from the opening, grayed out during verification, instead of the text "Verifying file...". The focus therefore no longer moves when the fiche refreshes.
- The "Continue Watching" row displays the official title logo on the thumbnail, instead of the written name underneath.

## v1.25.62 — September 2026

### Android TV: Plex-style episode fiche, full-screen trailer

- The episode fiche adopts the Plex principle: background tinted by the dominant color of the capture, smaller capture with its "Watched" / "In Progress" banner, series name in large font, episode title, "Season · Episode", then a line with the definition in a pill, the date, the duration, and the rating, the buttons, the synopsis, and the file table on two columns.
- Opened from "Continue Watching", the fiche had neither a capture, nor a synopsis, nor a duration, nor a rating: it now re-reads the season's metadata as soon as it is loaded, and displays the TMDb title of the episode when available instead of "Episode N".
- The trailer opens in a separate window that covers the entire screen, including the side bar; returning closes it and the focus returns to the "Trailer" button.
- To avoid the timeout delay on launch, the YouTube player is served from the Movviz address like on the desktop, instead of youtube.com, and a source is abandoned only after 25 seconds. The player's state and its errors are now tracked to diagnose a failure on a box.

## v1.25.61 — September 2026

### Android TV: reliable playback and resume, audio transcoding time, "Recently Added" sort

- The time displayed "0:00" and the bar did not move when the audio of a file was not decodable by the TV (the server then sends a stream without duration or index). The displayed position is now the starting point plus the playback time, the duration comes from the file information, and advancing or rewinding requests the stream from the server at the new position. Resuming, recording the position, chaining episodes, and intro markers follow this same position.
- The series, season, and episode detail playback buttons now use a single path. The "Resume at..." button sends the position it announces to the player, instead of the player recalculating it differently: a started episode that was not the last in its series would restart from the beginning despite the label. Without a resume, the episode starts from the beginning, and an episode not found in the playback queue displays a message instead of doing nothing.
- An episode detail page has a "From Start" button next to "Resume," and a resume viewed on the home screen also appears on the detail page.
- After "Back" from an episode detail page opened by "Continue Watching," the focus returns to the episode card instead of dropping to the sidebar.
- Movies and Series Library: new "Recently Added" sort, placed before Title, Rating, and Year, and selected by default.

## v1.25.60 — September 2026

### Android TV: side-by-side buttons and "watched" as a simple icon, round bookmark on desktop

- On a movie or series detail page, Play / Resume, Trailer, and "watched" are on a single line instead of a vertical stack of three buttons.
- "Mark as watched" becomes an icon: gray and unlit until watched, green and lit (background, checkmark, and border) once watched, white on focus like all buttons. The label appears under the icon when it has focus, without displacing neighboring buttons. Same button on the movie detail page, series detail page, season page, and episode page, where "Mark as watched" no longer wraps onto two lines.
- On desktop, "Add to my list" on a title's page is a round button like the magnifying glass, filter, or eye: the icon colors and fills when the title is in the list, and the label remains in a tooltip.

## v1.25.59 — September 2026

### A series can no longer be downloaded in place of a movie

- An entire series season could be placed in a movie's folder: "Resident Evil (2026)" and "Van Helsing (2021)" received the 13 episodes of `The Resident S06` and `Van Helsing S04`, named "(2)" to "(13)" next to the movie. Selecting a movie release only looked at the title and year: an episode name has no year, so it passed, and nothing rejected the season mention.
- A movie now refuses any release that has a season or episode marker (S04, S01E05, "Season 2"), in all places where it chooses one: automatic search, feed scan, quality upgrade, and version addition. "Special Edition" and titles like "Season of the Witch" remain accepted.
- The movie engine now only imports one video file per torrent, the largest one, without dumping the others into the folder with a suffix. A "movie" torrent containing multiple episode files is not imported at all, and the movie returns as "missing."
- To be done manually for already affected titles: delete the extra files in the movie folder, then set the movie to "missing" from its detail page.

## v1.25.58 — September 2026

### Android TV: no more crashing on the Genres row, season cards, and clean cards

- The application crashed as soon as the D-pad scrolled the Discovery genre row, without even entering it. Five lists did not have the scrolling protection that prevents the TV list component error: the Discovery genres and platforms, the Library genres, the Settings list, and its language row. They now have it, and no client list is deprived of it.
- Season cards on a series detail page no longer display "0/10" or the line "x/y watched" below: a simple number on a black background in the top right shows the number of unwatched episodes, replaced by a checkmark when the season is fully watched.
- Movie and series names embedded on posters are removed; logos remain.
- When opening a series detail page, the focus no longer remains on season 1 (boxed as if selected) when the main button has just recomposed: it returns to the main button.

## v1.25.57 — September 2026

### Android TV: Profile photos refreshed on each launch, stabilized trailer

- The active profile photo and name are refreshed from Movviz on each launch and return to foreground, and profile images are re-requested from the server instead of coming from the cache. Previously, a changed photo elsewhere would only appear on the TV when a new profile was added, because the app, often kept in memory, would not reread anything without going through the selector.
- The YouTube trailer now starts muted, like the home preview, then restores sound as soon as playback begins: a start with sound could remain stuck without any error, on a loading screen.
- A source that doesn't start within 12 seconds is abandoned for the next one, and when none work, the screen indicates the cause instead of loading indefinitely.

## v1.25.56 — September 2026

### Android TV: Trailer, focus stays within content, card polish

- Movie and series cards now have a "Trailer" button: full-screen playback with sound, using the same trailers as on the desktop (YouTube first, then direct sources as a last resort). OK or play/pause toggles playback, left and right scroll back or forward by 10 seconds (hold repeats), Back closes and returns focus to the button. A bar displays elapsed time, progress, and duration for each key press then fades away on its own, and remains visible when paused; a visual return confirms each action.
- The dark overlay at the top of the cards now covers the entire height of the image: it previously left a bare strip of image, then a sharp cut at the bottom.
- In a series card, no season has a permanent border anymore: they all have the same discreet border at rest, and only the card with focus receives the highlight border, which removed the confusion between "selected" and "focused".
- Focus no longer drops into the sidebar when changing pages. After clicking a tab, it enters the new page. When returning from a card to the home, the focus request retries without ever reverting to the sidebar. When returning from a season page, focus returns to that season's card, and when returning from an episode's card, to that episode's card.
- The message displayed during an update said that the application would restart by itself, which is not the case: it now prompts to restart the application after the update (TV and mobile).
- No key interception added in the sidebar or on pages: only trailer playback manages its own keys, within its screen.

## v1.25.55 — September 2026

### Android TV: Episode card like Plex, Home Movies / TV Series, Profile photo

- Tapping an episode card always opens its card: background capture, "Watched" or "In Progress" status below the image, series title, season, episode, rating, duration, and date, then "Play" (or "Resume at 00:12:34" if a resume exists), "Mark as watched", and the file table (video, HDR, audio, source). The "Watched" checkmark under each card disappears: everything is done from the card.
- The home separates recent additions into two rows, "Recently added in Movies" and "Recently added in TV Series", instead of a mixed row.
- In series rows, multiple episodes arriving together no longer display side-by-side: they form a single season card, with the number of unwatched episodes in the top right, or a checkmark if the whole season is watched. A single episode keeps its episode card, with a checkmark if it has already been watched.
- The server adds the number of available episodes per season to the compact home, to count the entire season. Without it, the counter only drops on recent episodes.
- The profile photo finally appears in the sidebar: the images used a network client without a session, while the mobile client shares the API's. Initials are no longer used except as a fallback.
- No key interception added: the D-pad remains managed by the Compose focus engine.

## v1.25.54 — September 2026

### Android TV / Mobile NX: Watch status remains attached to the episode

- The "Watched" checkmark for an episode used the season callback and sent `scope="season"` to `/api/watch/toggle`. The server therefore did exactly what it was asked: it extended the action to all known episodes of the season.
- TV and mobile unit actions now reuse `toggleEpisodeWatched(...)`, already present in ViewModels and equivalent to the desktop behavior: only one episode is sent, without scope.
- The actual "Mark season as watched" buttons keep `toggleEpisodesWatched(..., scope="season")` and "Mark entire series as watched" keeps `scope="series"`. No endpoint or server behavior has been reinvented.

## v1.25.53 — September 2026

### Android TV: Reliable exit from Home hero to D-pad

- The Home hero could remain stuck on the buttons: DOWN still depended on Compose's automatic spatial search to discover the first card of a TvLazyColumn, which is not always a candidate until it is sufficiently in the viewport.
- The hero and the first card of the first row are now linked by focusProperties.down and a dedicated FocusRequester. The main button also keeps an explicit LEFT exit to the sidebar.
- No onKeyEvent/onPreviewKeyEvent is reintroduced: movement remains entirely managed by the Compose focus engine, and the visual does not change.

## v1.25.52 — September 2026

### Android TV: Profile picture displayed in the sidebar

- The three profile pill widgets on the rail (rail footer, menu header, profile lines) only accepted an absolute URL avatar: a photo served via a relative path by Movviz was never resolved against the profile server and silently defaulted to initials. An expired Plex avatar (401) left an empty circle, lacking an error fallback.
- They now use the same component as the mobile client, where display works: relative URL resolution, image cropping, and fallback to initials in case of missing URL or network failure.
- No visual changes: shapes, sizes, initial bodies, and fallback gradient remain identical.

## v1.25.50 — September 2026

### Android TV: D-pad fixed after sidebar redesign

- Side navigation and content now use a single focus engine: Compose's `focusProperties`/`focusGroup`, without global `UP` interception.
- Since the sidebar is now on the left, content exit to the menu happens on `LEFT`; `UP`/`DOWN` remain native in lists, rows, grids, and cards.
- The old calls `runCatching { requestFocus() }.isSuccess` have been corrected: the boolean actually returned by `requestFocus()` is now respected, so a focus refusal is no longer taken as a success.
- No visual changes: dimensions, colors, cards, sidebar, and animations remain identical to the current redesign.

## v1.25.49 — September 2026

### Re-downloaded episode replaces its file instead of installing alongside it

- A manual selection—or a re-download, or a quality upgrade—on an episode that already had a file would leave both on the disk. The engine renames the imported file before knowing the intention: it encountered the already taken name and deposited a "Series - S01E01 (2).mkv" next to the original, which Plex then presented as a second version while continuing to serve the old one. The old file is now deleted and the new one takes the expected final name: manually choosing a release truly replaces the one in place. Seasons and complete packs follow the same rule; only movies benefited from this until now.
- This return to the final name actually didn't work for anyone, including movies: the collision suffix was sought at the end of the file name when it is placed just before the extension, so it was never recognized.
- Deleting the old file now targets the actual path on the disk and not the one seen from Plex, which might differ — this is what left files in place when the entry came from a library scan.
- The final name is never overwritten if it is occupied by a third-party file; a re-import to the same path does not delete itself, and nothing is touched outside the engine's library roots.

## v1.25.48 — September 2026

### Search C411: the full results page is finally requested

- Movviz used to let C411 choose its default page size, which only returned a partial and rather old slice of results: recent episodes remained invisible in Movviz while the indexer's web search listed them. Every interactive search now explicitly requests the first 100 results.
- This fix was already in the image published under v1.25.47, but the version number had not been incremented: the application still displayed v1.25.46 after updating. The numbering resumes properly in v1.25.48.

## v1.25.46 — September 2026

### Plex → Movviz: end of `plex_history_page_invalid_shape` failures

- Plex omits the `Metadata` key on empty history pages (account with no history, or pagination beyond the total): these responses are now treated as consistent empty pages instead of failing the entire view synchronization.
- A single-item page serialized as a single object (case of bootstrap `size=1`) is wrapped in an array; only a missing `MediaContainer` or a truly invalid shape still triggers the error, with a shape diagnostic in the message to decide on the next log.

## v1.25.45 — September 2026

### Android TV: season episodes switch to grid view

- The season now displays its episodes in a 16:9 thumbnail grid of four columns, instead of a vertical list. A twenty-episode season fits in five rows and is navigated in two dimensions with the remote instead of a long downward scroll.
- The background of the screen takes the dominant color of the season's cover art instead of a uniform black.
- The header groups the cover art with its episode count, progress, and an action bar on a single row: play, complete season, mark as watched, back.
- Each thumbnail displays its episode number, "watched" badge, resume bar, and download status; the title, rating, duration, and date remain visible below the image.

### No more enlargement on focus

- Cards, tiles, buttons, and profile photos no longer change size when selected. Three distinct causes were accumulating, including the default enlargement applied to all clickable surfaces, and the landscape widening of the home cards — the latter shifted its entire row and cropped the season badge embedded on the image.
- A button is never white at rest: gray background and white text, with white on black text reserved for the actually selected item, so that the focus remains on the most visible element of the screen.

### Remote control navigation

- Opening a series page left the focus stuck in the sidebar: no action was selectable until an episode was downloaded, and a never-started series had no play button.
- The season screen sometimes opened with no element selected, and the remote seemed unresponsive.
- Scrolling up episodes to the action bar sent the focus behind the displayed screen, into the side menu.
- Returning from the side menu to an episode required about ten presses and fumbling: the right arrow targeted an element hidden behind the season screen. A single press is now enough, and it returns control to the left thumbnail.
- Closing a season returns the focus to the series page instead of leaving it in the side menu.

### Play

- Proceeding to the next episode marks the previous one as watched as soon as it has been played over 70%, on Android TV as on mobile. A truly finished episode no longer reappears in "Continue Watching" because the credits have been skipped.

## v1.25.44 — September 2026

### Android TV: Redesigned season and episode list

- The episode list for a season is redesigned like Plex: larger thumbnail, title and synopsis much more legible from a distance, and an information line that finally shows the duration, broadcast date, definition, and HDR of the actual file present.
- A partially watched episode now displays its progress bar directly on its thumbnail, even when multiple episodes from the same series are in progress.
- Pressing OK now starts playback immediately; an "Info" button opens the episode's detailed sheet, which becomes a full-screen view and no longer a floating window.
- A missing episode is now accessible via the remote control: its sheet allows for download, which was impossible since the entire line was inaccessible.
- The season screen now opens to the next episode to watch instead of the first, and gains a header with a cover, progress, and action bar: play, complete season, mark season as watched, back.
- "Complete season" remains available as long as episodes are missing, whereas it disappeared as soon as a single episode was available.
- A series' sheet now offers a play button even when no episodes are in progress: it points to the next unwatched episode. Until now, a never-started series had no play button.
- Season thumbnails now indicate their progress (watched episodes, progress stripe, checkmark when the season is complete) instead of just a number of episodes.
- Special episodes are once again accessible: they appear after numbered seasons and are never included in the series completion count.
- The episode list adopts Movviz's colors: this was the only area of the app that remained in a neutral gray.

### TV and Mobile Interface: No more enlargement on focus

- Cards, tiles, buttons, and profile photos no longer enlarge when selected. The enlargement made embedded elements—episode number, "watched" badge, logo—blurry throughout the animation. Selection remains indicated by the drop shadow and focus outline.

### Fixes

- Profile photo: the one chosen from the web never appeared on Android TV or Android mobile once the device already knew a profile, i.e., on every startup except the very first. The profile selector and profile badge are now updated in the background on every launch, without slowing down the app's opening.
- Remote navigation can no longer get lost behind a screen: from the episode list or an episode's sheet, the focus no longer drops down into the series sheet below, and Back always closes exactly one level.
- The duration and rating specific to each episode are now transmitted by the server; they were previously retrieved from TMDb and then abandoned without being used.

## v1.25.43 — September 2026

### Performance: Technical analyses and caches

- Technical analyses of files (ffprobe) failed in bulk whenever a Plex sync launched several dozen in parallel: their result was read before it had finished being written. They now all complete.
- The cache for these analyses lost almost all of its entries when several ran at the same time, which caused the same files to be re-analyzed on every sync. The results are now saved, which eliminates a permanent background load on the server.
- The TMDb cache no longer serializes every response to feed a simple display statistic, and the Settings Cache panel stops querying the server continuously when nothing is progressing.

### Fixes

- An episode sheet no longer crashes when opened directly — via link, favorite, or page refresh — instead of being accessed from the series sheet.

## v1.25.42 — September 2026

### Android TV / mobile: Plex series synchronization

- Opening a series sheet on Android TV and mobile now triggers the same targeted Plex check as the web, so that viewed episodes immediately update in Movviz.
- Refreshing upon returning to the sheet retains this behavior; general loads remain unchanged.

## v1.25.41 — September 2026

### Plex → Movviz: immediate series views

- Opening a series sheet now reads the Plex states of all its already indexed episodes, in batches of 50 keys, and then reconciles them immediately. Naruto no longer depends on the next global history pass or the scheduled snapshot.
- A partial Plex response can never change an episode absent from the response to "not watched".
- A normal season is complete when all its available episodes are watched; a series is complete when all its normal seasons are. Special episodes (season 0) never block series completion.

## v1.25.40 — September 2026

### Plex → Movviz: synchronization without SQLite

- When the SQLite context engine is unavailable on the server, an accepted Plex decision is now immediately written to the JSON compatibility store read by the interface. The "applied" diagnostic now finally corresponds to a state actually visible in Movviz.

## v1.25.39 — September 2026

### Plex → Movviz: immediate repair of divergent views

- A stable Plex observation ("watched" or "not watched" already present in the local log) now repairs the Movviz state if it has diverged: the interface can no longer incorrectly remain on "not watched" after a targeted synchronization has confirmed Plex.
- Freshness protections remain unchanged: a more recent local action continues to override an old Plex observation.

## v1.25.38 — September 2026

### Plex → Movviz: reliable targeted diagnostic

- Targeted viewing of a movie now explicitly indicates whether Plex returned "watched" or "not watched" and whether the reconciler applied or rejected the observation, without exposing any Plex token or key.

## v1.25.37 — September 2026

### Plex → Movviz: catching up on missing movie keys

- When a movie sheet does not yet have its local `ratingKey`, Movviz now resolves it in Plex on the exact title and mandatorily validates the same TMDb ID before reading its watched status.
- Resolution failures are explicitly logged; they are no longer confused with a successful synchronization nor can they associate two homonymous movies.

## v1.25.36 — September 2026

### Full background resynchronization of Plex views

- Plex settings now offer "Synchronize all views": full and authoritative control of watched/not watched states goes into the Movviz queue, with persistent progress, without blocking the page.
- Initial synchronizations retain the full automatic bootstrap before any incremental pass; the button is the explicit recourse to restart it after an inconsistency.
- Only one complete task can run at a time, and more recent local actions remain protected by the existing reconciler.

## v1.25.35 — September 2026

### Plex → Movviz: immediate "watched" status on movies

- Opening a movie record now directly checks its Plex `ratingKey` and reconciles its "watched/unwatched" status without waiting for a global history scan or its 30-minute snapshot.
- This targeted check is independent of a long history bootstrap, but retains concurrency and freshness protections: a more recent local action is never overwritten.
- In case of Plex unavailability or an unknown key, the record remains usable and the general synchronization mechanism retains the relay.

## v1.25.34 — September 2026

### Local WebTorrent Season Association

- A manually released title explicitly named for another season is now rejected before being added to WebTorrent: `S02` can no longer be downloaded as `S01` by mistake.
- Safety net on import side: when all truly imported files indicate a single different followed season, Movviz immediately attaches the local state to this real season, without depending on Plex.
- Mixed packs, incomplete ones, without a season number, or targeting an unknown season are never reassigned by inference.

## v1.25.33 — September 2026

### Plex History V2: source pagination, resumable bootstrap, and bounded incremental

- `getAccountHistoryPage()` becomes the single Plex History read primitive: one HTTP page, offset calculated on the raw number of Plex items, and centralized parsing/filtering.
- Bootstrap History V2: ASC pages of 100, `currentStart` represents the Plex source offset, reliable resumption after restart and voluntary migration of old V1 states to a new full scan without affecting existing views.
- Recent views remain prioritized via a small DESC page independent of the bootstrap; the snapshot owner is deferred during the full scan and executed at the end.
- Multi-page DESC incremental up to the cursor, including identical timestamps, without reloading the entire history.

## v1.25.32 — September 2026

- Android mobile and TV search: explicit status in case of error, expired session, or empty result, without presenting a failure as an empty search.
- Interactive search: the last query cancels previous ones, and the first page is displayed without waiting for pagination.
- Safe diagnostics for `/api/metadata/search`: HTTP code, duration, pagination, and decoded result, without logging the search or session IDs.

## v1.25.31 — September 2026

### Full history bootstrap and most responsive Plex → Movviz

- Full history bootstrap: as long as `bootstrapCompleted=false`, `pollHistory` pages `GET /status/sessions/history/all` and processes **all** entries (batches 200, persistent `plex-history-bootstrap.json` resumable) instead of `slice(0,20)`. Views from 2022 deleted from Plex in 2024 remain importable if `canonical` is resolvable.
- After `bootstrapCompleted=true`, incremental sync by `lastViewedAt` only (a few entries). Does not lose any event, never restarts the 4000+ from scratch.
- `localAccountId` remains `null` for un-bound shared accounts: `historyAvailable=false` → `pollHistory` ignored, `snapshot/quickVerify` remain active via the share's `accessToken`.

## v1.25.30 — September 2026

### Plex → Movviz: corrected history string, no more owner `viewCount` for shared profiles

- Contradiction corrected: `viewCount`/`batchPlexViewState` gave the owner's state even with another user's token. For `shared`/`managed`, `snapshotWatchState`/`quickVerify`/`fullRescan` are now disabled (`unsupported_per_user_viewstate`) — no more `WATCHED/UNWATCHED` import from the owner state.
- `PlexHistoryEntry.ratingKey` optional: `getAccountHistory()` keeps movies/episodes from `title`/`grandparentTitle+parentIndex+index` (Guid passed), `watchSync` switches to **resolve-first** (episodes: `resolveEpisode(requireRatingKey:true)` → true `episode.ratingKey` via `allLeaves`, movies: `resolveMovie` by exact Plex/Movviz title + `Guid tmdb://` ambiguity resolution). No more `no verifyKey` / `movie without ratingKey`.
- `resolveEpisode`: new `requireRatingKey` (history→verify refuses `RESOLVED` without true key), fast-path `grandparentRatingKey → getShowEpisodesAtomic` direct, fallback exact title `Dragon Ball Z Kaï` with `exactTitleMatches` log, TMDB-id `findPlexShowByTmdbId` when titles diverge, atomic `getSectionRawItemsAtomic`. Rate of malformed rejections at a low, each rejection has a real reason.
- History filtered by `accountID` remains the `WATCHED` trigger for `shared`/`managed`: `verifyWatchState` is no longer called, a direct `WATCHED` observation is created from `viewedAt`; `absence history` remains `UNKNOWN`, never `UNWATCHED`.

## v1.25.29 — September 2026

### Shared Plex and episodes/movies without ratingKey — end of phantom `NOT_IN_SHARED`

- Shared Plex users (`plexId` external) no longer depend on `getPlexFriends()` (social graph, often `friends=0`): `resolvePlexUserContext()` now queries `GET /api/servers/{machineIdentifier}/shared_servers` (owner token) and exclusively maps `SharedServer.userID == plexId` → `accessToken` becomes the user's Plex `serverToken`, no personal login required. Fallback `getPlexFriends` removed from PMS path.
- `getSharedServers()` reads `res.text()`, detects `Content-Type` / first character and parses JSON or XML `<SharedServer>` (whitelist `id, userID, username, email, thumb, accessToken, accepted` only, token never logged). `HTTP non-200` = error, `HTTP 200` + valid XML = success.
- `localAccountId` no longer conditions the watched-state: `PlexUserContext` exposes `localAccountId: number|null` + `historyAvailable: boolean`. A shared `RESOLVED` with a valid `accessToken` passes `source=shared … localAccountId=null historyAvailable=false` → `snapshot/quickVerify/viewCount` active, `pollHistory` ignored cleanly.
- History `getAccountHistory()` now keeps episodes from `grandparentTitle+parentIndex+index` even without `grandparentRatingKey` or `ratingKey`; `PlexHistoryEntry.ratingKey` becomes optional. Movies without `ratingKey` enriched via `resolveMovie` (exact Movviz title → exact Plex library title → true `ratingKey` + TMDB, `Guid` ambiguity resolution) instead of `continue`.
- WatchSync rewritten in **resolve-first**: `resolveEpisode/resolveMovie` → true Plex `ratingKey` (`allLeaves`, true `episode.ratingKey`) → `verifyWatchState` → `reconcile`. The `no verifyKey … S4E14` and `movie without ratingKey … La vie est belle` disappear.
- `resolveEpisode` prioritizes Plex lookup (`allLeaves`) when the input key is missing, otherwise Movviz exact first; upsert `mediaIdentityMap` on the true key. Rate of malformed rejections strongly reduced.
- Observability maintained: `source=shared`, `tokenFp`, `plex.identity` without plain token.

## v1.25.28 — September 2026

### Plex Sync, Watch State & Recommendations Architecture — full reliability

- Strict separation of `PlexHistoryObserver` (activity, trigger) and `PlexWatchStateObserver` (WATCHED/UNWATCHED state via `viewCount/lastViewedAt` with the user's PMS token). Fixes P0 bug: "Mark as watched" in Plex did not create a history entry and remained invisible (now detected by snapshot).
- Unified Plex context `resolvePlexUserContext()` — `owner/account/managed` via stable IDs, `machineIdentifier` + `serverToken` by `userId`, 5 min cache, invalidation on 401/403. Removal of silent fallback to `adminToken` for personal data.
- Unique canonical reconciler `PlexReconciler` (`BASELINE/UNCHANGED/REMOTE_WATCHED/REMOTE_UNWATCHED/ACK/CONFLICT`) + LWW revision — no more direct writing from observers, no `Movviz→Plex→Movviz` loop.
- Atomic snapshot per library (`fetch all pages → validate → build set → diff`) — a partial snapshot is never interpreted as `UNWATCHED`, deleted media ≠ `UNWATCHED`.
- Restructured episode resolver with reasons `MISSING_RATING_KEY/MISSING_SEASON/AMBIGUOUS_MATCH` + sampling, `ratingKey→GUID→SxxExx→library lookup` pipeline.
- Targeted check after every `scrobble/unscrobble` (`/:/scrobble` 200 ≠ proof) + `outbox` `PENDING` kept until ACK, `STALE_INTENT` ignored.
- Stores isolated by `userId+machine+ratingKey` (`plex-observed-state.json`, `plex-media-identity-map.json`, cursor `plex-history-cursors.json` per user, circuit-breaker per user, lock `plex-sync:userId`).
- Recommendations strictly `userId` — reading `CanonicalWatchState`, TV aggregation in show-level signal (weight `log1p`, saturation), excluding `FullyWatched` only.
- Observability `GET /api/plex/status` (admin): `binding/status/tokenFp/localAccount/lastHistory/lastSnapshot/watchedObserved/canonical/outbox/circuit` + structured logs `plex.identity/history/snapshot/reconciler` without plaintext token.
- Explained and greatly reduced episode rejection rate, `rejectedForeign/Unattributed/Malformed` counters + visible `sampleMalformed`.

## v1.25.27 — September 2026

### Complete reliability of "watched" status and badge on Android posters

- Critical fix: a crash or outage at the wrong time could leave a title marked as watched inconsistently in the database; writing is now fully atomic (all or nothing).
- The "watched / unwatched" status displayed in the app now always comes from the most reliable available source, never from a copy that could occasionally desynchronize.
- An export to Plex that failed (network outage, Plex unavailable) was silently lost; it is now automatically retried in the background until successful.
- New diagnostic and repair tool for accounts historically affected by the already fixed ID collision bug (two distinct accounts sharing the same watched movies/episodes).
- Android applications (mobile and TV) now display a "watched" badge on movie posters in Home, Discover, Catalog, and Search.

## v1.25.26 — September 2026

### Plex profile resolution by ID + four bugs found by audit

- Critical fix: some accounts (typically those managed by admin, never personally connected to Plex) failed 100% of their synchronization attempts, indefinitely. Plex account resolution now uses a stable ID instead of depending on a personal connection that may never happen.
- The same bug as the watch sync (missing field on Plex side) also affected the "Continue Watching" list — fixed the same way.
- A forgotten account creation route from the previous fix still used the old collision-prone ID — corrected.
- A strict equality conflict resolution compared two unrelated values, making it unreliable — corrected to compare the correct values.

## v1.25.25 — September 2026

### Two Plex bugs confirmed live via production logs

- Critical fix: 100% of episodes for each account were rejected as "malformed" on every Plex sync, regardless of the account — a field that the Plex server never returns was used to identify the series, preventing any episode from being marked as watched.
- Critical fix: two distinct accounts could obtain the same internal ID during creation (Plex connection), causing them to silently share all their watched history. A guaranteed unique ID is now used everywhere, and any future collision is blocked instead of being ignored.
- Accounts already affected by the past collision require spot cleaning before full resynchronization.

## v1.25.24 — September 2026

### The "What's New" popup no longer truncated release notes

- Live bug confirmed: a changelog item wrapped over multiple lines only displayed its first line in the popup, even though the source file was still complete.

## v1.25.23 — September 2026

### Critical fix: Plex tracking no longer updated

- Real regression bug: when the SQLite context engine is
  unavailable (especially in Docker production), any new
  "seen" decision (Plex, manual, player, AI, import) was
  silently rejected instead of being applied — confirmed live ("seen added on Plex,
  forced sync, nothing in Movviz").
- The resolver now trusts the source when no
  conflict information is available, instead of blocking by default.

## v1.25.22 — September 2026

### Android Mobile NX / TV NX: Hero finally uses real recommendations

- Fix for a real bug: Mobile NX and TV NX were not sending any
  parameters to the Hero call, which always caused the server
  to fall back to local fallback (recently added library, not customized) —
  the recommendation pipeline (weighted seeds, scorer, taste) was
  never reached on Android, unlike on the web.
- No data contract changes, no app to reinstall for
  a technical reason related to the version.

## v1.25.21 — September 2026

### "Seen / Unseen" status: single source of truth

- Fix for a real bug: a late Plex resynchronization (history
  still containing an old view) could resurrect a title marked
  "unseen" manually, due to lack of date comparison between sources.
- New canonical resolver (`applyWatchDecision`): the most
  recent (Plex, player, manual action, AI, import) always wins by
  the real-time of the event, never by the synchronization order.
- Correction of a real bug where a character wrote a timestamp in the
  wrong column when merging playback states.
- The outgoing Plex scrobble/unscrobble is now tracked and visible
  (success/failure), where only a diagnostic log existed before.
- API contract unchanged — no update required on Desktop, Mobile NX
  or TV NX.

## v1.25.20 — September 2026

### Rework of the "For you" recommendation engine

- Seeds (titles used as starting points for suggestions) are now weighted by real signal strength — explicit rating, 👍, series engagement, recency — instead of treating every viewed title as equivalent. A disliked-but-watched movie no longer weighs as much as a 5★.
- TMDb candidates (`recommendations` + `similar`) are aggregated by multi-seed proof with a saturating consensus function, and ranked by a pure and deterministic scorer (testable offline) rather than a formula dominated by TMDb popularity.
- "Because you watched X" and the dashboard Hero now reuse the same common taste primitives (`userContext/taste.ts`) instead of duplicated scoring logic — the Hero previously had no link to this layer.
- Region bug fix: the Netflix/Disney+/Prime catalog and "where to watch" badges forced `watch_region=FR` for everyone, including Belgian/Swiss/Canadian accounts. New "Streaming Region" setting in the profile (11 countries, applied automatically on Desktop, Mobile NX, and TV NX since it is stored on the account side).
- API route contract unchanged — no update required on Android Mobile NX or TV NX.

## v1.25.19 — September 2026

### Android TV NX: avatar refreshed on every startup

- No visual change compared to v1.25.18.
- The only images whose cache is forced are profile photos.
- A session ID is added to the avatar URL on every new TV process startup: Coil thus actually reloads the photo instead of reusing an old cached image.
- The URL remains stable throughout the session to avoid repeated downloads during recompositions.
- The ephemeral cache-buster is never persisted in local preferences.

## v1.25.18 — September 2026

### Android TV NX — premium sidebar + Movviz avatars truly synchronized

- Sidebar deployed reduced from 195 dp to 156 dp (-20 %).
- Removal of the large active gradient and the 2 dp white border: more subdued active/focus states, light brand background, and 1 dp border.
- Fix for the active background not filling the width of the deployed button.
- Profile popup and footer harmonized with the same premium visual language.
- The active profile is now refreshed even if it already exists in cache: a changed photo on desktop immediately replaces the old TV avatar.
- Known device profiles reconcile name/avatar with `/api/tv-profiles`; the Movviz avatar (`customAvatar`) remains primary and Plex is only a fallback.
- Same reconciliation applied to the NX mobile client.
- Hero "Featured": `Play` by default, `Resume` only when actual progress exists.

# Changelog

## v1.25.17 — September 2026

### Profiles: canonical Movviz avatar on desktop, NX mobile, and NX TV

- The custom Movviz avatar remains the source of truth: a Plex photo refresh only updates the fallback and can no longer overwrite `customAvatar`.
- Movviz avatar files still present on disk are automatically retrieved if an old logic had disabled them.
- Android TV NX and Android Mobile NX normalize the URLs `/api/avatars/...` relative to the Movviz server so that picker, sidebar, badges, and profile sheet all display the same photo.
- Movviz upload also attempts replication to Plex via the private endpoint used by Plex Web; this sync is strictly best-effort and a rejection on the Plex side never prevents the local Movviz avatar from working.

## v1.25.16 — September 2026

### Android TV NX: D-pad sidebar/content focus stabilized

- Sidebar: removal of global `DPAD_RIGHT` interception; exiting to content now relies on `focusProperties.exit`, natively provided by Compose.
- Modifier order corrected: `focusProperties` wraps `focusGroup` in the NavRail and on the home screen, so exit rules apply to the correct focus target.
- Removal of unwired focus fallback in the NavRail, which complicated navigation without ever being used.

## v1.25.15 — September 2026

### Android TV NX: D-pad sidebar unblocked (focusGroup exit)

- `Home 1×→ 3×↓ 3×←` used to navigate to `Search` instead of `Home` — changed from `enter` to `exit` on the content `Box` + `TvLazyColumn` in `focusGroup` so that `LEFT` from any first card correctly goes to the selected tab.

## v1.25.14 — September 2026

### Android TV NX: hero centered at top

- Hero backdrop aligned `TopCenter` (instead of center) — the top of the poster is visible, and less of the bottom is cut off.

## v1.25.13 — September 2026

### Android TV NX: D-pad Home 1×→ 3×↓ 3×← unblocked

- `Home > right > 3× down > 3× left` no longer gets stuck in the sidebar — `focusGroup` + `focusProperties { enter/exit }` on NavRail/Content replace `left =` on lazy items (which broke spatial layout), `TvLazyColumn` in `focusGroup`, `RIGHT` prioritizes `moveFocus` then `contentFocus`.

## v1.25.12 — September 2026

### Android TV NX: immersive hero restored

- The hero restores its original immersive size (500 px max, 46% viewport, padding 52/40/46, width 620) — only the tiles and the sidebar remain at -25% as requested.

## v1.25.11 — September 2026

### Android TV NX: 25% global reduction + D-pad unlocked

- Entire TV interface reduced by 25% (sidebar 63/195 dp, cards 99/203/124 dp, typo 11/17 sp, etc.) — sidebar included, ratios and gradients preserved.
- D-pad: `Home > right > 3× down > 3× left` no longer gets stuck in the sidebar — `LEFT` from the 1st card of each row (including "Coming Soon") explicitly goes to the selected tab, `UP` moves up to the NavRail, `RIGHT` finds the content even after scrolling.

## v1.25.10 — September 2026

### Download correction: WebTorrent pause/resume

- `pause`/`resume` no longer worked since the redesign (case-sensitive failure on infoHash) — `WebTorrentBackend` and `AbstractBackend` now use case-insensitive, `findByInfoHash` too; the pause/resume button on desktop and mobile correctly reprograms WebTorrent.

## v1.25.9 — September 2026

### Android TV NX: Square sidebar, "Coming Soon" D-pad unlocked

- NavRail: 56 dp square icons (14 dp radius) in collapsed rail, gradient preserved on active — like the second image's square, no more ugly stretched pill at rest.
- D-pad: `LEFT` from the 1st card of each row (including "Coming Soon") now explicitly goes to the selected tab via `focusProperties`, no longer random geometric (Coming Soon → Profile) — 1st card `LEFT` no longer gets stuck.
- Home: `UP` from the hero/content moves up cleanly to the NavRail, `DOWN` stays in the column without escaping to the sidebar/launcher.

## v1.25.8 — September 2026

### Android TV NX: Remaining duration on Continue, enriched on-deck API

- `GET /api/plex/on-deck` now exposes `durationMs` on TV: the "Continue" row displays `S2 E3 · 22 min remaining` (or `22 min remaining` for a movie) instead of just `S2 E3`, with the thin bar preserved.

## v1.25.7 — September 2026

### Android TV NX: D-pad unlocked, logos restored, series untangled

- D-pad: LEFT from content now targets the selected tab (no longer random), UP no longer falls on the invisible 2 px anchor, DOWN no longer escapes to the sidebar/launcher, BACK from a detail page restores the same card (focusRestorer) instead of the NavRail — 3 blocking traps corrected (report 183 tests: 161 PASS).
- Platforms: 16/9 tiles with 95% white background behind the logo (like Discovery), visible even for dark logos; hero and rows keep their halos.
- Series untangled: FILM/SERIES pill on mixed rows (Selection, Trending, Added, editorial), server-side type-split search (`?type=movie|series`) instead of client filter.

## v1.25.6 — September 2026

### Android TV NX: Home mockup, aligned trailers, TV pattern everywhere

- Home: "Platforms" row (16/9 tiles, same logos as Discovery, "See all" customized on click), hero matching the mockup (46 % / 500 px max, "Resume" CTA in brand gradient, bottom-right dots), "Continue" row in fixed 270x150 landscape cards with episode still, S/E context and progress embedded, purple glow on focus.
- Trailers: TV played direct sources (search by title, sometimes the wrong movie) before YouTube, unlike desktop which only plays YouTube — YouTube now plays first everywhere (hero, cards, title page), direct is only a last resort.
- Logo: Orbital animation removed (rotating halo, waves, particles, pulsation), static mark.
- Discovery, Library, Search, and Settings switched to TvLazyColumn/TvLazyRow + focusRestorer; Back/Escape in the search field returns control to the D-pad without leaving the screen.
- "VF" pill on the hero added but displayed only on real data (no VF field returned by the server today: never made).

## v1.25.5 — September 2026

### Android TV : image cache memory doubled

- Coil memory cache increases from 10 % to 20 % of application RAM: fewer poster/backdrop re-downloads in rows, smoother on well-equipped devices.

## v1.25.4 — September 2026

### Visual cleanup: animated background removed, suggestions and metadata refined

- The "Aurora" animated background (app background) is removed — an unused component that weighed down rendering without current visual added value.
- TMDb suggestion engine and metadata retrieval refined (video orientation, translated texts).

## v1.25.3 — September 2026

### Android TV/mobile: design-compliant sidebar, player and profile fixes

- Android TV sidebar recalibrated to exact mockup values (widths, spacing, icons) — the Discovery icon (compass) and the bug preventing the D-pad from reaching the content on this screen are fixed.
- Season card and "seen" badge on episodes restyled with Movviz identity instead of plain gray/white.
- Profile picture: a change made via the web was not picked up by the Android TV and mobile apps on the next launch (avatar refreshed in memory but never re-registered on the device) — corrected on both apps.
- Video preview (home and title card): the video crops differently from the static image behind it, creating a visible band on switch — corrected on Android TV and mobile.
- Compiled and visually verified on Android TV emulator; the search grid and a rare case of D-pad triggered playback remain to be investigated.

## v1.25.2 — September 2026

### Android TV: navigation and visual overhaul

- Navigation changes from a top bar to a collapsible side sidebar (icons only, expands on remote focus) — night blue palette, blue→violet→magenta brand gradient.
- Movies and Series merge into a single Library tab (Movies/Series/Collections); Search becomes a standalone tab with the same All/Movies/Series filter as mobile; Discovery is directly accessible again.
- ⚠️ Not compiled/tested on device — first real check via the CI build triggered by this tag.

## v1.25.1 — September 2026

### Hotfix: API timeouts during Plex sync

- "Same physical file" detection reloaded `plex-path-mappings.json` (a disk `stat`) on every comparison, synchronously: on a large library, every Plex item scanned thousands of paths blocking the event loop, causing all API routes to time out during sync.
- Guards now pass in two steps without any syscall: normalized equality first (memory only), then mappings loaded once + suffix. Same treatment in disk reconciliation.
- No change in business behavior: same merges, same rules, just without I/O.

## v1.25.0 — September 2026

### Plex Library: duplicate elimination, instant playback, and Docker paths

- The duplicate anti-lock for Plex sync is now shared across all bundles (no more double import on double-click or overlap with the scheduler), with re-verification after every TMDb call.
- Same physical path = same movie: the sync merges instead of creating a duplicate, including with different mounts (Movviz `/data/film` ↔ Plex `/volume1/docker/plex/film`) and divergent Plex agents. The grid also masks residual duplicates by `tmdbId`.
- Settings → Plex: new path mapping section (Docker/Linux only) — final torrent destinations compared to actual Plex section locations, suggestions to validate with one click, manual entry possible. Nothing is applied without validation.
- Lecture as soon as the file is moved and renamed to the correct location, without waiting for Plex (web, Android TV, and mobile). Plex remains an asynchronous enrichment (badges, fallback URL).
- The sync button now displays a persistent progress status (phase, section, counter, seconds) and remains disabled while the server run is active.
- Daily reconciliation no longer reports false anomalies related to double mounts views (exact comparison + translation via mappings + parent/file suffix).
- Tightened nets: download reconciliation every 2 minutes, retrieval of unimported completed items every 15 minutes.

## v1.24.170 — September 2026

### Sidebar: automatic collapse on hover

- The sidebar now automatically shrinks into a column of icons and expands on mouse hover, pushing the content (no more manual button to click).
- Collapsed icons are enlarged, more spaced, with no background on inactive icons — only the active icon retains its gradient tile.

## v1.24.169 — September 2026

### Downloads: covers finally displayed

- The real cause: the queue rebuilds the information for each title on every refresh from the download engine, never including the cover — corrected. Now works for ongoing AND already present downloads in the queue/history (retroactive, nothing to re-run).

## v1.24.168 — September 2026

### Downloads: clickable title, clean details, covers for upcoming downloads

- Clicking on a download title now opens its page, like everywhere else in the app.
- The detail under the title (resolution, source, codec, audio, HDR) has returned to plain text instead of large colored pills; the "Unknown" indexer is no longer displayed when the info has never been saved.
- The cover for each title is now displayed for any new download started from this version (the info was never saved anywhere before, including the path actually taken by a manual search/retrieval) — entries already in the queue/history will not have it retroactively.

## v1.24.167 — September 2026

### Downloads: toggles consistent with the rest of the app

- "Auto-start on boot" and "Sequential" now use the same toggle component as everywhere else in Movviz, instead of a mismatched custom style.

## v1.24.166 — September 2026

### Collapsible Sidebar

- The sidebar can now collapse into a simple column of enlarged icons (logo + dock-style icons), to save screen space. Preference remembered per device.

### Discovery: resettable platform filter

- Clicking on an already selected platform now deactivates the filter instead of remaining stuck on it.

## v1.24.165 — September 2026

### Discovery: enlarged and corrected top bar

- Tabs, platform logos, and the Filters and Sort button are about 50% larger and more readable.
- Platform logos fill their frame better.
- The label "Sort by" was displayed as a raw technical key instead of the translated text — corrected.

### Downloads: Missing covers and actions

- Each download now displays its cover (instead of just an icon) on a slightly taller line.
- The "replace" (manual search) and "delete" buttons were missing next to pause on the downloads dashboard — added.
- The "Auto-start on boot" and "Sequential" toggles now display an error message instead of remaining silently ineffective in case of failure.

## v1.24.164 — September 2026

### Home: Dashboard settings take effect

- Hero settings (video, slideshow speed, minimum year, suggested content) and line display are once again taken into account on the home page — they no longer had any effect since the home redesign.
- The hero trailer is now enabled by default for all accounts, including those that previously had it (unbeknownst to them) set to "disabled".
- The "Minimum year of carousels" dropdown is finally readable (dark background instead of the browser's default white).

### Home and Discovery: Larger and truly adaptive cards

- The sidebar is expanded by about 15%.
- Movie/series cards on the Home and Discovery pages are enlarged by about 25% and now truly shrink with the window (like the Platform tiles), instead of remaining fixed at a set size.

## v1.24.163 — September 2026

### Home: Hero visuals and trailer aligned with listings

- The hero now favors editorial landscape backdrops without an integrated title, so that the Movviz logo remains alone above the image.
- The hero player now uses exactly the iframe profile of the movie and series listings.

## v1.24.162 — September 2026

### Home: Hero available even under TMDb overload

- The first rendering of the hero immediately uses backdrops already stored in the library, without depending on a slow or expired TMDb request.
- Enhanced recommendations and trailers are loaded afterward, without being able to hide the usual hero image.

## v1.24.161 — September 2026

### Home: Safe fallback for the hero

- The trailer remains an overlay on the hero backdrop: without a video or in case of a YouTube iframe error, the usual image remains visible with all the hero controls.
- An isolated player error can no longer make the entire hero disappear.

## v1.24.160 — September 2026

### Home: Reliable hero trailers

- The hero adopts the same iframe profile as the movie and series listings.
- A loaded YouTube iframe is now revealed after a short delay if YouTube does not transmit its internal playback messages, instead of leaving the background static indefinitely.

## v1.24.159 — September 2026

### Home: adjusted ultrawide ceiling

- The fluid and centered desktop canvas is now capped at 2000 px instead of 2200 px.

## v1.24.158 — September 2026

### Home and Discovery: fluid width and OCS restored

- The home page now uses the full usable width on desktop, then remains centered with a 2200 px ceiling on ultrawide. Cards retain their size and thus display more content, while platform tiles gain space.
- The hero now spans full width at an 18:9 ratio; "Continue Watching" becomes an editorial row above personalized suggestions.
- Bottom exclusions are re-read by local rows: a title excluded by "Under 40 minutes" no longer reappears after reloading.
- OCS retains its logo and name, but now queries the current TMDb catalog Ciné+ OCS (id 685) instead of the old empty id 56.

## v1.24.157 — September 2026

### Home: dynamically sized platforms

- The eight platform logos now fill the content width up to the "See all" alignment.
- The grid cleanly reduces from 8 to 3 columns depending on screen width, with no horizontal scrolling or fixed small tiles.

## v1.24.156 — September 2026

### AI: genuinely selectable free offers

- The OpenCode Zen and OpenRouter catalogs are dynamically re-read and filtered to offer only free models.
- Gemini is limited to officially documented and genuinely accessible free models via the configured key; Mistral is explicitly limited to the included quota of the free plan.
- The lock is applied in the interface, upon saving, and on actual call: an old configuration can no longer silently select a billable model.

## v1.24.155 — September 2026

### AI: Test button displays raw provider error

- The test only returned "quota" or "failure," which masked the real cause (invalid key, missing billing, unknown model, actual rate-limit). The exact provider message is now displayed below in the panel.

## v1.24.154 — September 2026

### AI: Test button tested the wrong provider

- The test route was building its chain from the stored primary instead of the clicked provider: "Test" on opencode actually tested mistral, with an OK displayed under the wrong card. Corrected with a chain reduced to the requested provider.

## v1.24.153 — September 2026

### Platform logos: end of white backgrounds

- Disney+ and Apple TV+ use their white variants (same outlines, Disney+ blue arc retained): all tiles remain dark, no more white backgrounds.
- OCS displays directly on dark tile, without white background.

## v1.24.152 — September 2026

### Local platform logos

- The Platforms row for Home and Discovery (tabs + grid) uses local SVGs (Netflix, Disney+, Prime Video, HBO Max, Apple TV+, YouTube, Crunchyroll, OCS retrieved from Wikimedia) instead of remote TMDb logos, with a light background for dark logos.

### Mobile-style search bar

- The search bar exactly replicates the Android mobile rendering: 46px pill, electric blue → purple → magenta border, #131836 background, 13px #B3B3B3 icon + placeholder.

### End of light mode

- Complete removal of light mode: dark enforced everywhere, no choice possible — removal of the topbar switcher, the Appearance step in the wizard, the Profile Appearance section, all light CSS, and the server preference.

## v1.24.151 — September 2026

### Android smartphone — My Space

- The bottom portrait bar renames the "Library" tab to "My Space", which is more accurate for a hub that gathers the watchlist, recent history, and collections.
- The three tabs (Watchlist, History, Collections) are displayed in a 3-column grid instead of horizontal scrolling.
- All content is clickable: cards open the title sheet, collections are navigable, and sagas respond to tap.

## v1.24.150 — September 2026

### NX Dashboard

- Fixes the Platforms row: Netflix, Disney+, Prime Video, HBO Max, Apple TV, YouTube, Crunchyroll, and OCS.
- Enlarges rectangular platform tiles and removes Canal+ from this composition.

## v1.24.149 — September 2026

### NX Dashboard

- Rebalances the ultra-wide composition: content anchored towards the sidebar, expanded usable width, more compact hero, and enriched Continue column.
- Transforms main suggestions into vertical posters and gives more presence to platforms and search.
- Displays the actual remaining time in Continue based on the Plex duration and position.

## v1.24.148 — September 2026

### NX Discovery

- Corrects the New Releases and Trending grid: each tile uses its full cell and its status remains overlaid on the visual.
- The Filters panel remains open when selecting a genre on desktop.

## v1.24.147 — September 2026

### NX Discovery

- The rails now use the actual width of the tiles, without empty spaces or detached add buttons between the content.

## v1.24.146 — September 2026

### Discover NX

- The Discover desktop bar adopts the sketch composition: compact tabs, separated platforms, readable Filters and sort button, without halo or global frame.

## v1.24.145 — September 2026

### NX desktop fidelity

- Removal of halos, light shadows, and decorative frames that are not in the NX sketch.
- The reprise, platforms, and topbar actions regain a dark, compact, and readable composition.

## v1.24.144 — September 2026

### NX desktop fidelity

- The desktop shell is densified: compact sidebar, bordered active state, and tightened topbar and search.
- Home, Discover, Library, and Downloads adopt cleaner controls and the editorial hierarchy of the NX charter, without modifying the mobile interface.

## v1.24.143 — September 2026

### Downloads

- The quick settings panel displays translated titles, an explicit link to download clients, and toggles accessible without reducing their readability.

## v1.24.142 — September 2026

### NX desktop fidelity

- The Home bar now displays the actual platforms under the hero; Play is primary and My list is actionable.
- The library receives its NX toolbar with real filters (4K, HDR, my list, recent, and sort) and more compact rails.
- The Downloads rail displays the wait, free space, and quick settings actually connected to the engine.

## v1.24.141 — September 2026

### NX desktop interface

- Redesign of the Home, Discover, Library, and Downloads pages: dense desktop composition, content rails, platform filters, Genre column, and real-time tracking table.
- The Movies and Series pages now prioritize suggestions, with explicit access to their respective libraries.
- The dashboard maintains a fixed composition, with a dedicated rail for playback resumption and without duplication of this row.

### Plex and downloads

- A personal Plex connection from mobile or TV immediately retrieves the user's watchlist and activates its private synchronization.
- The engine retains a real history of bitrates for live download statistics.

## v1.24.140 — September 2026

### Android

- Administrators can now create a user account from the Android settings, with the same validation and authorization rules as the web interface.

## v1.24.139 — September 2026

### Interface

- Optimized loading is now the only interface behavior, active by default even for older configurations. The Compatibility option has been removed from Settings.

## v1.24.138 — September 2026

### Discovery Reliability

- All TMDb requests now share a global pool of six maximum connections, including between concurrently loaded rows.
- Identical TMDb requests are pooled and recommendations no longer analyze more details than necessary, preventing timeout bursts that emptied Discovery.

## v1.24.137 — September 2026

### Desktop Interface

- Tiles and secondary buttons adopt the electrical contours of the NX mobile charter: a more readable violet/cyan silhouette, a discreet halo, and reinforced focus, without changing the page structure.

## v1.24.136 — September 2026

### Discovery and Suggestions

- Clicking "Bad recommendation" immediately removes the title from all affected rows, shifts the remaining cards, and then loads a replacement. The rejection remains permanent after refreshing or restarting.
- Management → Exclusions displays all rejected recommendations and allows them to be individually re-authorized.

## v1.24.135 — September 2026

### Discovery

- The Anime row remains global, even when a continent filter is selected. Japanese anime movies and series therefore do not disappear from Discover.

## v1.24.134 — September 2026

### Discovery

- Continents now cover all countries and territories recognized by TMDb: checking or unchecking a continent correctly applies the entire corresponding set to the original filter.
- Platform logos on cards (Netflix, Disney+, Prime Video, etc.) are displayed without background or white border.

### Docker

- AMD64 and ARM64 images are published with Docker V2 manifests rather than OCI manifests, so that Synology Container Manager can read the `latest` tag and download updates.

## v1.24.133 — September 2026

### Installation

- Windows and Linux also use the configurable BitTorrent ports `55000`/`55001` by default. Both variables are passed to the Windows service, and a persistent systemd override is documented for Linux.

## v1.24.132 — September 2026

### Docker

- The BitTorrent ports for movies and series now use `55000` and `55001` by default, and can be configured independently via Docker variables. These variables also replace the ports previously registered by the engine, avoiding any persistent conflict with another torrent client. UPnP automatically opens and removes the corresponding TCP and UDP mappings when the router allows it.

## v1.24.131 — September 2026

### Docker

- The Docker manifest now explicitly exposes the three Movviz services: interface/API (`9810`), download engine (`9820`), and Cloudflare resolver (`9830`), in addition to the BitTorrent ports.

## v1.24.130 — September 2026

### Installation

- The initial setup wizard now offers, before configuring indexers, to disable automatic searching and downloading of followed but missing content.

## v1.24.129 — September 2026

### Android mobile NX

- Persistent landscape search now reserves its height, plus 3 dp, in each central column page: no hero, title, or first list item is hidden upon opening or when changing tabs.

## v1.24.128 — September 2026

### Discovery

- **Trending / Top / New aligned for synthetic genres**: `Animes` and `Teen Romance` now respect the chosen sorting — `Trending` (`popularity.desc`), `Top` (`vote_average.desc` + `vote_count.gte 200`), and `New` (`primary_release_date.desc`/`first_air_date.desc` + cap at today) — and the year, instead of a hardcoded `popularity.desc`. Other filters (platform, studio, duration) are also passed.

## v1.24.127 — September 2026

### Android mobile NX

- The portrait search bar is now persistent and opaque above the central landscape column; the hero and lists scroll beneath it.
- Netflix, Prime Video, and platform sorting: NX premium buttons (electric outlines, blue-night surfaces, and purple gradient selection).
- Platform catalogs no longer become empty when a valid pool contains only new releases: they display these titles instead of showing a no-results page.

## v1.24.126 — September 2026

### Android mobile NX

- Landscape mode: search leaves the sidebar and becomes a floating global action in the top right of the central content.

## v1.24.125 — September 2026

### Android mobile NX

- Landscape and expanded mode: narrower menu with logo retained at the top, adaptive width for the download panel, and preserved central space (minimum 360 dp with three columns).
- Rounded and spaced featured card in landscape, without change to portrait or TV NX.
- Extended portrait charter to landscape: blue-violet-magenta electric contours of cards and playback buttons in mauve gradient.
- Active profile photo refreshed from the connected account even if a local profile already exists; the selector cache also retains the personalized Movviz photo.
- Correction of the Compose reference for the catalog sorting selector.

### Artificial intelligence

- The IA priority list is now the single source of truth: an old `primary` value can no longer override the #1 ranked provider.

## v1.24.124 — September 2026

### Android NX

- Netflix, Prime Video, and Disney+ catalogs no longer remain empty after a temporary TMDb outage: an initial empty response no longer poisons the cache for 45 minutes.
- Platform pages now feature "Selection for you" by default, "Top rated," and "Newest."
- Immediate avatar refresh on TV NX even when Plex replaces the image without changing its URL.
- "Movies watched" and "Shows watched" counters now display aggregated Plex/Movviz totals instead of only counting the 20 visible recent cards.

## v1.24.123 — September 2026

### Artificial intelligence

- Added OpenCode Zen to IA providers, with API key, connection test, and support for Chat Completions and Responses protocols.
- Selection intentionally limited to the six officially free Zen models: no paid models can be registered.
- Provider priority order is fully configurable; the engine respects the chosen ranking for the primary provider and each fallback.

### Profiles

- Movviz ↔ Plex avatar synchronization in last-write-wins, with anti-loop fingerprint, TV NX cache invalidation, and safe fallback: a Plex failure never blocks Movviz upload.

## v1.24.122 — September 2026

### Unified Viewing

- Single source of watched/unwatched status on desktop, Mobile NX, and TV NX, with real episode, season, and series aggregation.
- Bidirectional Plex synchronization retaining actual dates; confirmed viewing remains prioritized over mere status absence.
- Clean resume as soon as a title is watched or reset, with only one active resume per series.

### Suggestions and AI

- Personalized ranking based on tastes and public traction: popularity, vote volume, and match quality take precedence over equivalent obscure content.
- Highly followed new releases from a provider can immediately rise when matching tastes, without waiting to accumulate thousands of votes.
- Profile enriched by TMDb themes and keywords, in addition to genres, moods, actors, directors, franchises, ratings, and real behaviors; the same context feeds Movviz suggestions and AI.

## v1.24.121 — September 2026

### Android

- Withdrawal of historical Android Mobile and TV clients: only Movviz NX Mobile and Movviz NX TV remain compiled and published. Existing API routes remain unchanged.

## v1.24.120 — September 2026

### Profiles

- User-customized profile picture (Settings → Profile on desktop, tappable photo on mobile card): JPEG/PNG/WebP/GIF ≤ 2 MB, visible desktop + mobile + TV, takes precedence over Plex photo (unchanged).
- Note: replication to Plex is impossible via public API (no documented endpoint — only the official app knows how); the Movviz photo lives on the Movviz side, hook ready in `src/lib/avatars.ts`.

## v1.24.119 — September 2026

### NX Mobile

- Plex photo retrieved everywhere: Coil shares the authenticated HTTP session client, relative URLs resolved against the server, fallback initials in case of failure (badge, rail, picker, card, TV bar).
- Single page background (#0F142F, logo banner tone) on all portrait/landscape screens, system bars, and startup — no more black backgrounds.

## v1.24.118 — September 2026

### NX Mobile

- Compact unfolded hero: reduced logo, synopsis on card only — Play / More info always visible (measured collapsed at 12px on emulator).

## v1.24.117 — September 2026

### NX Mobile

- Premium landscape everywhere: touch rail also on title/actor card and "See All", extended immersive, reduced card hero, compact margins (Discover, Catalog, Library, Profile, Settings, Card, Actor, Grid), "See All" grid 3 columns, touch search.

## v1.24.116 — September 2026

### NX Mobile

- True zero-overflow: spacing between 3rd and 4th card (and 4th/5th platform) is accounted for in the adjustment — measured in pixels via bounds (Horimiya at [1053,1080]).

## v1.24.115 — September 2026

### NX Mobile

- Zero 4th card end: 4dp safety margin in exact adjustment (Dp→px rounded measured on emulator).
- Unfolded hero: 1-line synopsis to keep Play / More info visible on landscape bottom.

## v1.24.114 — September 2026

### NX Mobile

- Anti-"MO": username fallback everywhere (greeting, avatar header, unfolded rail) when no profile is active; the avatar leads to the selector in this case.
- 3 full-frame rows (floating arithmetic Dp on real viewport): no more 4th card end; captions also unfolded.
- Unfolded: immersive (outside real TV), slim rail without scroll, touch search, panel covers via library, compact margins on Discover/Library/Catalog/Profile/Settings, compact hero.
- Bottom bar: "Downloads" fully visible (weight 1.3); MAJ badge also in the unfolded rail.

## v1.24.113 — September 2026

### NX Mobile

- Sketch profile 08: mauve electric circled photo, name + real role (Admin Account / User Account), Settings gear, 2x2 stats (Movies watched / Series watched / In my list / Ratings given), My activity / My recommendations / Settings / Change profile / Sign out to real destinations.
- Unfolded mode (landscape ≥ 700dp): persistent left touch rail + Side panel Currently / Completed on the home screen, same electric contours. Portrait and TV unchanged.
- Bottom bar: labels in 9.sp, "Downloads" is no longer truncated.

## v1.24.112 — September 2026

### NX Mobile

- Sketch bottom bar 01: 4 tabs only (Home/Discover/Library/Downloads) with icon + label always visible, active in a gradient badge.
- Updated badge moved to the top left of the avatar (visible only if available), mauve electric ring with breathing halo + 44dp hitbox.
- Immersive video game type on the portrait home screen: Android system buttons hidden, temporary return to edge swipe.

## v1.24.111 — September 2026

### NX Mobile

- Gradient electric border (blue `#3D7BFF` → purple `#8B2FFF` → magenta `#BC3FFF`) on Platforms, movie/series cards, and search — no more flat look.
- Platforms: 4 full-frame icons adjusted to the viewport (no more 5th cut off), swipe retained for the rest.
- Movie/series rows: exact adjustment of 3 full-frame cards on all large screens (120dp ceiling removed, it was letting out a piece of the 4th).

## v1.24.110 — September 2026

### NX Mobile

- Portrait home: 3 full-frame cards per row like sketch 01 (calculated width `(viewport-32-20)/3`, bounded 92–120dp, "See more" tile aligned) instead of 2.5 with the 3rd cut off.
- Mauve electric NX Mobile only: Brand `#7C3AED` → `#8B2FFF`, Brand2 `#C04BFF` → `#BC3FFF`, Glow `#A06BFF` → `#A66BFF`. Web and 3 other modules unchanged.
- Portrait search bar: fine electric mesh `1.dp to 22%` like the dock border and the badge of sketch 01.

## v1.24.109 — September 2026

### Android TV NX

- Fixes a systematic crash when scrolling down in the home rows (and several other screens: title sheet, search, catalog, downloads, actor sheet, profile selector, player): `NoSuchMethodError` on `LazyLayoutPrefetchState.schedulePrefetch`, binary incompatibility between `androidx.tv:tv-foundation` and the `compose.foundation` version resolved by the project. Same bug already fixed on NX Mobile side (prefetch disabled by reflection, no visible affected behavior) — never ported to NX TV until now. Applied to the 14 `TvLazyRow`/`TvLazyColumn`/`TvLazyVerticalGrid` in the module.

## v1.24.108 — September 2026

### Continue Watching

- A finished episode or movie (including during the credits) is no longer displayed in "Continue Watching"/"Resume" — on desktop, Android TV, and Android mobile simultaneously, since all 3 rely on the same server point (`listOnDeckEntries`). Same "near end" threshold rule (5 min remaining for a movie, 2 min for an episode, 10 % for a short media — the one already used by the player to mark viewing as finished) applied uniformly to the progress followed by Movviz AND to the raw on-deck of Plex, not just one of the two sources. Effective immediately on already "stuck" titles, without manual purge.

## v1.24.107 — September 2026

### NX Mobile

- Corrects video previews that occasionally show a completely different movie (e.g., Demon Slayer showing a real-shot trailer unrelated to it): the ambient preview incorrectly favored "enriched" sources (Apple/Netflix/Disney+/Prime Video/IMDb), which match by title similarity and might confuse a homonym, instead of the TMDb videos directly linked to the correct ID. TMDb (reliable ID) is now attempted first; enriched sources only take over if this video genuinely doesn't start after a few seconds, to never leave the preview frozen due to lack of playback.

## v1.24.106 — September 2026

### NX Mobile

- Portrait media sheet: enlarged hero (backdrop/video preview) (300dp → 460dp) and darkening gradient pushed to the last third instead of starting from the middle — the image/video remained visible for too short a time before being masked by the background, making the sheet less immersive.

## v1.24.105 — September 2026

### NX Mobile

- Fixes the cropped logo at the top of the "Add Profile" screen (connection): the multi-colored halo of the mark was overflowing above its box and was cut off by the scroll viewport, due to lack of margin above the very first element.

## v1.24.104 — September 2026

### NX Mobile

- Home screen platform icons: removes the white background behind each logo (TMDb icons are already colored square icons, the white background was superfluous).
- Permanent purple gradient border (matching the mockup) around platform icons and movie/series posters in portrait — the white TV focus border remains unchanged in landscape/TV.

## v1.24.103 — September 2026

### NX Mobile

- Home screen "Platforms" rail: uniform square icons (as requested) instead of variable-width rounded chips inherited from Discovery/TV.

## v1.24.102 — September 2026

### NX Mobile

- Restores the Suggestions/Library toggle in Discovery > Movies/Series (portrait) — which disappeared by mistake with the old 3-way selector, it provided access to the entire owned catalog (2439 movies for the user); without it, the catalog was unreachable with a direct tap.

## v1.24.101 — September 2026

### NX Mobile

- Fixes the "Platforms" tiles on the home screen: they are inert (no action on tap) and all have a uniform width instead of conforming to their logo, as per the sketch.
- Moves "By Mood" to the top of Discovery, just below genres, instead of the bottom.
- Redesigns the "See All" screen (Platforms/genres/mood/editorial rows) in portrait: it lacked a header or back button (page blocked after a tap), and had a 2-card oversized grid per row — replaced by the standard header (mark + avatar) and a 4-column grid consistent with the rest of the app. Same fix for the actor sheet (Cast).
- Fixes content hidden under the floating bottom bar on Discovery, Library, Downloads, and Search.

## v1.24.100 — September 2026

### NX Mobile

- Complete redesign of the smartphone portrait according to the provided UX mockup: the bottom bar is reduced to Home/Discovery/Library/Downloads (icons only), and Profile and Search are now accessible via the avatar and header search field rather than dedicated tabs.
- Home: "Platforms" rail, separate "Continue Watching Movies"/"Continue Watching Series" rows, no more hero banner in portrait (not planned in the mockup).
- Discovery: full-width movie/series selector in brand gradient, "Resume a movie/series" row.
- Library: becomes a real Watchlist/History/Collections entry point (instead of a Films/Series catalog alias), real watchlist and history, user collections + owned TMDb sagas.
- Downloads: "In Progress"/"Completed" tabs with real counters, remaining time, and displayed speed, plus a Refresh button.
- Media page: back button and floating watchlist toggle on the banner, watchlist is truly bidirectional (add/remove from server).
- Search: "Actors" chip (real person search), recent session searches, Results section with filter access.
- Bottom bar dynamic update retained (5th icon, appears/disappears based on availability).

## v1.24.99 — September 2026

### NX Mobile

- Redesign of the first-time onboarding according to the mockup: server, account (+ Plex), profiles, synchronization, home. Subsequent launches start on "Who's watching?", and adding a profile goes through the login screen before returning to profiles.
- Bottom nav portrait aligned with the mockup: Discovery / Movies / Series / My List / Profile, with "Recommended for you" and "Streaming services".
- Single version: the 4 APKs now read `package.json` (desktop version) instead of a fixed value — no more possible desynchronization.

### Build

- Gradle alignment: Gradle 8.13, AGP 8.13.2, Kotlin 2.2.21, Compose BOM 2025.08.01, Media3 1.7.1, Navigation 2.9.3 on the 4 Android modules + CI.

## v1.24.98 — September 2026

### Fixes

- Fixes broken NX Mobile compilation from v1.24.97 merge: `Border(...)` with positional arguments instead of named arguments in `DiscoverHubScreen.kt`/`LibraryHubScreen.kt`, and a double declaration of `SearchTypeFilter` in `SearchScreen.kt` (two distinct screens had each defined their own enumeration of the same name) — renamed to `PortraitSearchTypeFilter` for the portrait search screen.

## v1.24.97 — September 2026

### Discovery (web)

- Redesign of the desktop Discovery block according to the sketch: hero with 3 real actions (Watch Now / My List / Trailer), "Your streaming services" section moved just below the hero with real brand colors, platform badge on rows that already belong to a platform.

### NX Mobile

- Alignment of mobile navigation and Plex OAuth connection.
- Real launcher icons by density (mdpi to xxxhdpi) on the 4 Android apps, replacing adaptive XML icons.

## v1.24.96 — September 2026

### Fixes

- NX Mobile portrait, Discovery screen: "According to your mood" chips were too small to be comfortably tapped (identified in real testing) — touch target enlarged to 44dp minimum.
- The Genres/Platforms/Studios/According to your mood rows used a fixed margin of 52dp inherited from TV instead of the 16dp of the rest of the portrait content — same fix as the Title page Distribution row (v1.24.95), they now follow the same margin.

## v1.24.95 — September 2026

### Fixes

- Corrects the alignment of the "Distribution" row on the NX Mobile portrait title card: it was using a fixed margin of 48dp instead of the 16dp of the rest of the card (title, buttons, Similar Titles), which visibly shifted it to the right.

## v1.24.94 — September 2026

### Fixes

- Fixes broken NX Mobile compilation from v1.24.93 redesign (incorrectly named parameters on `Border(...)` and a non-existent `Modifier.padding()` overload) — no APK could be generated for v1.24.93.

## v1.24.93 — September 2026

### NX Mobile

- True structural redesign of the phone portrait (not just colors): persistent header with always visible search bar (the old portrait showed no header), Discovery/Movies/Series segmented pills, real Genre/Mood/Duration/Platform filters, hero card with rounded corners and rating badge, and double View/Trailer button, "By Mood" chips in thin pills, rebuilt Search screen (persistent bar, type pills, Suggestions, Trending now, list results).
- Bottom navigation with 5 tabs and unchanged update badge.

## v1.24.92 — September 2026

### NX Mobile

- Visual redesign of the NX Mobile app: palette aligned with the rest of Movviz (purple/void/abyss), active chips in brand gradient on filters and content selector, darker navigation dock.
- New "By Mood" section on Discovery: quick access to genres by mood (adventure, relaxation, thrills, emotion, comedy, inspiration). 5-tab navigation and unchanged update badge.

## v1.24.91 — September 2026

### Fixes

- Fixes "Active Sessions": playing a local episode never opened a tracking session (it only depended on Plex duration), so it never appeared in the panel — regardless of the device or app (mobile, NX Mobile, TV, NX TV).
- The splashscreen logo loaded too late (after JS hydration); it is now preloaded from the initial HTML.
- Tweaks the NX Mobile portrait navigation dock: the update indicator no longer pushes the bar up and is no longer an opaque solid.

## v1.24.90 — September 2026

### Visual Identity

- New Movviz mark (cross-pink/purple ribbon) across the entire platform, starting from official assets: web sidebar, favicon/PWA, adaptive Android icons (mobile, NX Mobile, TV, NX TV), Android TV banners, Windows icon, and Docker icon.
- New desktop and Android NX splashscreens with the full lockup (mark + "Movviz"), loaded with priority.

## v1.24.89 — September 2026

### NX Mobile and NX TV

- A card opened from Resume now prioritizes the local library entry before displaying its actions. An already indexed file therefore never suggests "Add to library" during loading; Plex remains optional.

## v1.24.88 — September 2026

### NX Mobile and NX TV

- Explicitly separates resume cards from recently added episodes: only the first can display "Resume," progress, and a resume thumbnail; recent episodes only display their `Sxx · Exx` badge.
- Recomposes the NX Mobile portrait dock: floating, centered, compact, with fluid expansion and fade of the active tab; the content now reserves the necessary space below the last row.

## v1.24.87 — September 2026

### NX Mobile and NX TV

- Fixes transition to the next episode: the new media is actually loaded, the skipped episode is closed and no longer remains in Resume.
- When leaving a player or putting the app in the background, audio stops and position is retained. Trailers and end credits no longer create resumes.
- Episode resumes now display the episode image, the series logo, and the `S03 · E10` badge; movies keep their cover art.
- Revises the portrait navigation for NX Mobile: low capsule with explicit icons, label only on the active tab, Discover available, active profile name, and discreet update shortcut.

## v1.24.86 — September 2026

### NX Mobile and NX TV

- Adds the dedicated Downloads page, fed live from the server queue.
- Makes the playback bar truly touch-enabled: tapping a track immediately jumps to the selected position.
- Cards retain their live download status then switch to Play as soon as the media is available.

## v1.24.85 — September 2026

### Movviz NX Mobile

- Adapts the portrait smartphone interface without changing the TV/landscape rendering: compact bar with action menu, denser home, readable catalog, and resized cards and episodes.
- Fixes texts and margins for profiles, profile selector, Plex connection, and settings on small screens.
- Aligns the four Android channels and the web package on the same release number.

## v1.24.84 — September 2026

### NX Mobile — on-screen touch actions

Repairs overlapping actions in NX Mobile: the Home/Series/Movies/Profile tabs, search, settings, profile change, and update signal now explicitly capture touch in addition to the D-pad. Playback controls retain the same touch handling.

## v1.24.83 — September 2026

### Movviz NX Mobile — direct port from NX TV

Replaces the first NX Mobile base with the `android-tv-nx` code: same local-first startup, isolated cache by server/account/profile, Plex profiles, NX home, Movies/Series hubs, cards, season/episode pages, player, update, and D-pad protections. The touch port retains these behaviors instead of resuming the old mobile application.

The package remains `com.movviz.nx.mobile`, the update asset remains `Movviz-NX-Mobile-client.apk`, and the retail signature is unchanged. The activity is resizable on phone, tablet, and Fold; the NX bar becomes scrollable on touch on compact screens while retaining all its access points. The M logo is applied on launch and navigation.

## v1.24.82 — September 2026

### Movviz NX Mobile — new independent channel

Adds `Movviz NX Mobile` (`com.movviz.nx.mobile`): an independent touch Android application from Movviz Mobile and NX TV, signed with the same retail key. It retains Movviz's profiles, resumes, player, home, and automatic update while keeping its own data and its own release asset (`Movviz-NX-Mobile-client.apk`).

The interface adapts to phones, tablets, and foldable devices: resizable activity, 2/3/4 column profile selector depending on width, adaptive library grid, and forms centered on large screens. The NX icon is used as the Android icon.

## v1.24.81 — September 2026

### Movviz NX — local-first finalized home

The NX home now publishes a single snapshot per P0/P1 wave: local content is displayed immediately, and then server data replaces everything coherently without composition cascade or focus jump. The first viewport rendering is confirmed before the secondary work starts; the download queue, recommendations, and remote metadata remain in the background.

In the absence of a cache, the preparation screen displays progress linked to the steps actually completed. If the server is unavailable, the last valid home from the same server, account, and profile remains usable with a discreet offline indicator, without repeating unnecessary fallback requests. Preloading is limited to nearby posters and the single focused backdrop; Coil explicitly uses its shared loader.

## v1.24.80 — September 2026

### Corrective release retail Android

Fixes retail key fingerprint control in Android workflows. TV, NX, and mobile builds still reject any different key, but now correctly read the fingerprint returned by `keytool`. Version `1.24.80` (`124080`) replaces release v1.24.79 whose CI was stopped before APK publication.

## v1.24.79 — September 2026

### Movviz NX — local-first startup and safe retail release

The NX home now instantly restores the last local state, strictly isolated by server, account, and profile, then reconciles the library, reprises, and recommendations in the background. Selecting a known profile is no longer blocked by network latency; however, the session is revalidated in the background, and an invalid session redirects to login.

The download queue starts only after the first viewport and is canceled upon every profile change. The `TV-PERF` logs allow measuring the actual startup steps.

Android CI now requires the Movviz retail key and verifies its fingerprint: it fails instead of publishing an APK signed with a temporary key. The three APKs share the same `versionCode` derived from the tag (`124079`), which fixes the automatic update path.

## v1.24.78 — September 2026

### Google TV Channels — Movviz TV and Movviz NX

Android TV apps now publish their Movviz channel and their "Continue Watching" system row on the Google TV home screen. The official AndroidX TV Provider dependency is shared by Movviz TV and Movviz NX so that both channels remain consistent.

## v1.24.77 — September 2026

### Movviz NX — Home no longer blocks the remote

From Home, pressing down from the navigation bar could remain ineffective as long as the dashboard had not finished loading, forcing users to go through Movies or Series to scroll down. The focus target now exists from the first displayed image, even before data arrives.

## v1.24.76 — September 2026

### Movviz NX — Movies and Series become real hubs

Each Movies and Series universe now has its own hub with a compact Suggestions/Library toggle, no longer mixing the two intents or the two catalogs. The home screen is enriched with the same editorial rows as Movies/Series, including new releases and suggestions by platform, in a feed mixing movies and series like a real streaming screen. Also fixes a real focus defect that could jump arbitrarily when switching to the Library.

## v1.24.75 — September 2026

### Discovery — readable platforms and refined ranking

Platform and studio logos in Discovery (Movies/Series) are now always visible, including Disney+ and Canal+, which were previously unreadable on a dark background — each logo now rests on a clear badge, like on the website. The ranking of "Suggestion {platform} for you" rows is refined: the top few titles now benefit from dedicated tone analysis rather than relying solely on already cached analysis, for a sorting more faithful to each profile's real tastes.

## v1.24.74 — September 2026

### Discovery — platform-separated new features and suggestions

Each Discovery platform (Netflix, Disney+, Prime Video) now displays two distinct rows: "New {platform} for you," strictly sorted by release date, and "Suggested {platform} for you," sorted only by your tastes (genres, history, ratings) regardless of release date. The "See all" for both rows also scrolls as far as the platform's actual catalog allows. Movviz NX receives the same breakdown on its own Discovery screen.

## v1.24.73 — September 2026

### Movviz NX — navigable seasons and episodes

The dedicated season page now uses a truly scrollable list on the D-pad: even a long season keeps all its episodes accessible, without the lines changing size on focus. The upper area is placed below the navigation bar, each episode retains a thumbnail (with visual collapse if TMDb does not provide one), and the "watched" checkmark remains reserved to the right. Movviz and Plex sources finally follow the same rule for displaying episode playback action. Platform recommendations retain a cache separated by profile, type, and discovery country.

## v1.24.72 — September 2026

### Discovery — Netflix, Disney+, and Prime Video new features and suggestions for you

Discovery (Movies and Series) now displays "New Netflix for you," "New Disney+ for you," and "New Prime Video for you": the catalogs of these platforms are presented sorted according to your own tastes (genre affinity, history, ratings) rather than by simple generic popularity — two accounts see the same Netflix catalog, but in a different order. The "See all" and pagination retain this personal ranking. The platform icons at the bottom of Discovery remain unchanged. Movviz NX receives the same enhancement on its own Discovery screen, with the Platform and Studio logo rows at the bottom of the screen.

## v1.24.71 — September 2026

### Movviz NX — full-screen seasons

Selecting a season on an NX series page now opens a dedicated screen, rather than unfolding an episode list in the middle of the page: the series page remains a clear summary, and the episode list utilizes all the space with a simple D-pad navigation, and the back button closes exactly this level before leaving the page. Episode lines now maintain a fixed geometry (thumbnail, title, "watched" checkmark) so that the focus never changes the layout.

## v1.24.70 — September 2026

### Movviz NX — genuinely available previews

Video previews are again allowed on Android TV and emulators with less than 2 GB of total memory, as long as free memory remains safe. Pages use the same preview pipeline as cards, the navigation magnifying glass is redesigned, the "Resume" badge no longer clutters the posters, and each distribution card receives an opaque text base to remain readable on light portraits.

## v1.24.69 — September 2026

### Movviz NX — navigation and profile polish

Android TV NX navigation gains consistent icons, more readable focus states, and D-pad-enterable search. Pages return to a visible focal point, episode titles remain readable, and the profile dashboard retrieves missing posters from the media library or metadata to avoid empty cards.

## v1.24.68 — September 2026

### Movviz NX — accessible search and updates

NX navigation now displays Settings, with automatic search activation and forced update checking. When a release is detected, an update arrow appears in the bar and triggers installation upon confirmation. Search displays and refocuses its input field upon opening.

## v1.24.67 — September 2026

### Movviz NX — home screen choice on startup

The profile selector is now systematically displayed on startup when at least one profile is available on the server, regardless of the last active account's role. Update detection remains automatic; after the first Android authorization to install unknown apps, installation can continue without intervention.

## v1.24.66 — September 2026

### Movviz NX — Plex profile and recent episodes

The active profile's Plex avatar is now displayed in the top badge and opens the profile selector. The NX home screen adds a row of actually added episodes, independent of reprises, strictly sorted from most recent on the left to oldest. The profile dashboard also reserves a safe area below the navigation and uses poster cards readable from a distance.

## v1.24.65 — September 2026

### Movviz NX — Android TV and standalone channel release

Movviz NX receives its dedicated retail APK, signed with the same key as Movviz TV but published under a distinct GitHub asset. Its update signal and automatic installation can therefore never replace Movviz TV. The NX header now follows the Netflix behavior: it remains transparent at the top of the hero and only obscures when the rows pass under the navigation, without altering the D-pad paths. Identities are also separated: circular icon for the application, "M" brand in the interface.

## v1.24.64 — September 2026

### Mobile Library Movies and Series like Plex

Each Movies or TV Series tab now has three distinct views: **Recommended**, with reprises followed by poster rows; **Browse**, a dense local grid with search, sorting, and genres; and **Collections**, rows by library universe. Recently added episodes appear in Series Recommended with their poster, series, and `Sxx · Exx`.

## v1.24.63 — September 2026

### Mobile Home centered on reprises

The large "Featured" card is removed from the smartphone home screen. Reprises remain the first row after the header, followed by recently added episodes, then the library and discoveries. Adding a row can no longer move or replace "Reprise".

## v1.24.62 — September 2026

### Recently added episodes on the mobile home

The smartphone home screen now displays a dedicated row for episodes that have actually arrived last in the library, whether from a Plex import or Movviz. Each card retains the series, episode title, and its identifier `Sxx · Exx`, and opens directly to the series details. This row is distinct from reprises and views: it describes the available files, without exposing the history of another profile.

## v1.24.61 — September 2026

### Plex views strictly isolated by profile

Plex view synchronization now systematically resolves the Plex profile linked by API to its local Plex server account before reading the history. In case of doubt, the import is rejected: no view from another profile can be added or deleted. Opening Movviz also triggers a fresh, profile-limited synchronization, instead of waiting for the background cycle. Markings made in Movviz continue to be sent only to that same Plex profile.

## v1.24.60 — September 2026

### Personal mobile home and Movviz signature

The mobile home now clearly distinguishes between what already exists in the profile's library and titles to discover: the first row mixes actually available movies and series, then personal recommendations exclude already owned, viewed, or rejected works. A compact Movviz wordmark also anchors the page, in the spirit of the Plex signature, without reducing the space dedicated to content.

## v1.24.59 — September 2026

### Mobile reprises and repaired series playback

Home now recharges the unified resume list on every return to the tab and keeps the film/series mix, sorted by last viewed date and time. Discovery reuses this same source in its separate Films and Series tabs. Mobile playback also retrieves old local episode entries without a source field, without diverting a Plex episode to the local source.

## v1.24.58 — September 2026

### Synchronized views, episode by episode

"Viewed / Not viewed" actions are now available on Android mobile and Android TV at the film, episode, entire season, and entire series level. They write the unique Movviz profile tracking and propagate the change to Plex when a Plex media is linked. Future episodes are intentionally excluded: when a season is finished, only the first available episode of the next season becomes the resume.

## v1.24.57 — September 2026

### Home and Android mobile updates

The mobile home features the TV editorial rows (personal selection, short formats, trends, recent additions, and upcoming releases), still by profile and with resumes first. A detected release is now signaled without interruption by a pulsating pill and a badge in the navigation; installation only starts after confirmation.

## v1.24.56 — September 2026

### Android mobile APK published

The resume row title margin now uses the correct Compose overload; CI can finalize the smartphone APK and attach it to the release.

## v1.24.55 — September 2026

### Android mobile publishing fix

The Kotlin compilation for the Android mobile home is fixed; the release version can once again be produced and published.

## v1.24.54 — September 2026

### Unified Android mobile home

Android mobile receives a true Home tab: "Continue Watching" resumes appear first, followed by the hero and library rails. This row consumes exactly the unified user route already used by the web and Android TV; progress, next episode, and Plex/Movviz order remain the same on all three platforms.

## v1.24.53 — September 2026

### Plex truly additive and dense TV catalogs

Resumes present in Plex no longer depend on a prior link to the Movviz library: their TMDb IDs and visuals are resolved directly, then merged with the Movviz resume by ID and actual date. Films, Series, and the "See All" Android TV screens switch to a fixed, dense, and stable 1080p/4K grid, with more compact controls and no enlargement on focus.

## v1.24.52 — September 2026

### Truly unified resumes and stabilized TV home

The single "Continue Watching" route now uses a common Movviz/Plex clock and sorts each resume by its true viewing date. Plex can immediately provide the first episode of the next season without waiting for a local historical sync; only the first sequence proposed by Plex is kept. A Plex episode re-indexing is also resolved by series + season + episode. On Android TV, posters remain fixed in portrait on focus, without landscape cropping or row shifting; resumes keep their readable progress bar and the home remains dense at 1080p/4K.

## v1.24.51 — September 2026

### Android TV — priority resumes and calibrated living room cards

The "Continue Watching" row is always placed at the top as soon as a resume exists, even if an old dashboard layout had hidden it. The home cards regain proportions suitable for a TV screen: the selection opens in landscape without replacing the entire row. Resumes now complete the Plex visual with the Movviz backdrop without text when available.

## v1.24.50 — September 2026

### TV — generalized official logo and corrected navigation grid

The portrait principle without a logo at rest / official logo placed separately at focus now extends to Discover, similar titles, an actor's filmography, as well as the complete catalog and "see all" grids (where the card remains fixed in portrait rather than opening in landscape, as a vertical grid cannot grow without displacing its neighbors). The text title disappears wherever this logo is displayed; it remains discreetly folded on the grids when no TMDb logo is available. Logo loading is protected against network duplicates. The deployed side navigation bar finally aligns its tabs to the same edge instead of floating at different widths.

## v1.24.49 — September 2026

### TV — direct access to the profile and refined home theme

On Android TV, the profile is now accessible via a direct shortcut from the navigation rail, without going through the account selection screen. The home screen and its visual theme have been reworked for greater consistency. Furthermore, award ceremonies (Oscars, Caesars, Golden Globes...) and non-fiction content uploaded as "series" by catalogs (news, talk shows, reality TV) are no longer suggested, regardless of their source.

## v1.24.48 — September 2026

### Unified Plex and Movviz Resume

Resume is now calculated once, per user, for web, profile, and Android TV. Plex remains optional: its positions and history complement Movviz data without ever replacing them. Plex views are recorded with their actual date in the common timeline, which correctly orders Plex and Movviz plays. For series, only the very first unwatched episode is suggested: after a season 4 is finished, season 5 episode 1 appears; season 6 waits for the complete end of season 5. Stopping during the credits also immediately marks the media as watched and synchronizes it to Plex when connected.

## v1.24.47 — September 2026

### Independent Profiles on TV and Mobile

Android profiles are now stored only on the device, per Movviz account and per server. Uninstalling no longer retrieves profiles from another device or household, and a user's Plex session can no longer replace another's.

## v1.24.46 — September 2026

### Episode Watchlist and Optional Plex

Added Watchlist actions per episode in series details and additional safeguards: Plex server tasks are cleanly ignored when Plex is not configured, without disrupting the local media profile.

## v1.24.45 — September 2026

### User Sync Transport

Watchlist and watched mutations now expose their transport capacity and clock, with LWW resolution and history preservation upon switching to unwatched.

## v1.24.44 — September 2026

### Plex Convergence of Notes and Resumes

Local notes are synchronized to Plex in the background, and the remote resume now respects the LWW timestamp instead of mechanically favoring the largest value.

## v1.24.43 — September 2026

### Unified Media Profile and Plex Sync

Added shared media profile, LWW resolution per field, Watchlist with episodes and tombstones, profile APIs, and Android TV integration. Plex remains optional and does not trigger any automatic acquisition.

## v1.24.42 — September 2026

### Android TV — resume, subtitles, genres, and controlled update

Android TV gains a truly dynamic resume upon return of the player (`Resume at HH:MM:SS`), default subtitles with memorization by profile and media, correction of category filtering which wrongly compared TMDb IDs to genre names, a complete purge of personalized data upon profile change, a more lively focus, and a blinking update arrow in the sidebar. Automatic updates can no longer start during navigation or playback: only the short startup window allows auto-installation; then the user explicitly triggers the installation from the indicator.
### Aligned release versions

The reference version is now the same in the web package, the lockfile, the README badge, and the mobile and TV Gradle configurations: `1.24.42` (`versionCode` `12442`). CI builds retain derivation from the release tag.

## v1.24.41 — September 2026

### Fixed Android release

The mobile and TV Android pipelines now use the current version of the SDK build tool, which directly installs Android 35 and build-tools 35.0.0. Generating release APKs works again.

## v1.24.38 — September 2026

### No more documentaries and making-of in suggestions

TMDb regularly mixes documentaries and making-of in `/recommendations`, `/similar`, and even a favorite actor's filmography — the AI chat already excluded them, but not "Suggestions for you" or "Because you watched", which still suggested them despite repeated 👎 on this genre. Genre affinity never excludes an entire genre (it only attenuates its score), so this was not enough. The Documentary genre is now a hard rule, applied in the filter shared by all suggestion rows: priority to the film and the series, no documentaries slip in anymore. Manual search is not affected — an explicitly searched documentary remains findable.

## v1.24.37 — September 2026

### Actor/director affinity finally drives the real "Suggestions for you" row

The actor/director affinity added in v1.24.36 only fed the conversation with the AI, not the "Suggestions for you" row itself — rating two Jim Carrey films five stars, or simply watching several without ever rating, did not make anything else from him appear in the suggestions. It now also drives this row: the complete filmography of the 3 favorite actors/directors (calculated from ratings, 👍/👎 votes AND the simple fact of frequently rewatching the same actor, without explicit rating) is retrieved via TMDb and injected into the candidate pool, promoted on par with genre affinity ≥95 % — a direct match on the actor even ranks higher.

## v1.24.36 — September 2026

### New actor/director affinity — "I love Jim Carrey" now counts for itself

The calculated genre affinity (views, ratings, votes, requests) never links a rated title to ITS ACTORS — rating two Jim Carrey films 5/5 only reinforced "Comedy" in general, nothing brought his OTHER films closer together. A new actor/director affinity, built from explicitly rated or voted 👍/👎 titles (never the entire viewing history, to remain fast), complements the genre: "particularly likes Jim Carrey as an actor" becomes a fact the AI knows directly and can reuse to suggest his other films. For now, it feeds the conversation with the AI (recommendation generation and "Create context" button), not yet the pure TMDb ranking of "Suggestions for you".

## v1.24.35 — September 2026

### "Suggestions for you" — series run out too fast, and thumbs up is now also dynamic

The TMDb "recommendations" catalog for series is significantly poorer than that for movies — after a few 👎, the series row often no longer had a replacement to suggest (the card would disappear without anything taking its place), whereas the movie row never ran out in the same way. A second TMDb source ("similar", based on content rather than other users' habits) now complements the first for both types. A thumbs up also recalculates the row now, just like a thumbs down — a rating can bring up other titles.

## v1.24.34 — September 2026

### Minimum year for carousels — two distinct causes for overly old titles

The home hero selected a small number of candidates (about 6) and then filtered by year — when a large portion of these candidates were below the minimum year, it voluntarily supplemented with excluded titles rather than displaying an incomplete hero, which could show several titles prior to the set limit. The candidate pool is now much wider from the start when a minimum year is defined, so that the filter has real recent candidates to retain without ever needing this fallback. The "Suggestions for you" row on the Movies/Series pages did not consult this setting at all — also corrected.

## v1.24.33 — September 2026

### The AI displayed raw JSON instead of rating — and actually rated nothing at all

On a batch rating request ("give 5 stars to all Dragon Ball"), the assistant sometimes responded with a raw JSON block displayed as is in the conversation, in addition to not actually recording ANYTHING despite a confident tone ("it's noted!"). The model used an unrecognized format instead of the expected internal marker — now recognized and applied for real, with a confirmation instead of JSON. Titles mentioned in a conversation before this update were not rated: you will have to ask the AI again for those.

## v1.24.32 — September 2026

### Going to Profile always redirected to a search — the real cause this time

The previous fix (canceling a pending deferred search) fixed a real bug, but not this one: the issue persisted even on a full reload of the /profile URL, which ruled out any React state. The real cause: the browser's password manager associates a "current password" field with a nearby "username" field to suggest autofill — the profile's password change form has none nearby, so the browser chose the only other visible text field on the page: the global search (always displayed at the top), which it filled with the saved username and then submitted. A target username field now correctly targets this mechanism, and search is explicitly excluded from autofill.

## v1.24.31 — September 2026

### "Create context" (profile) ignored rated and calculated genre affinity

The profile's "Create/Regenerate context" button already synchronized the library to the SQL journal in the background, but the text actually sent to the AI to synthesize the context did not include the 1-5 star ratings, nor the already calculated genre affinity (views, votes, ratings, requests) — only the viewed titles, requests, and raw 👍/👎 votes. Both are now missing, both for manual reconstruction and for automatic background update (which now triggers on a new rating, not just a view/request/vote).

## v1.24.30 — September 2026

### Clicking on Profile redirected to a search with the username

Tapping in the search and immediately clicking "Profile" would indeed open the profile sheet, but it was followed ~300ms later by a silent return to `/discover?q=<username>`: the search (Topbar/Sidebar) never unmounts between pages (the app chrome remains mounted, only the content changes), so the deferred search programmed by the previous typing remained active and ended up executing afterwards, overwriting the already performed navigation. Any pending deferred search is now canceled as soon as navigation completes.

## v1.24.29 — September 2026

### "Suggestions for you" now consults calculated genre affinity

The engine behind the "Suggestions for you" row (TMDb candidates) no longer consulted the calculated genre affinity from actual activity (views, votes, ratings, requests) — only the conversation with the AI benefited from this since the last update. A title whose genre affinity exceeds 95% (a deliberately very high threshold, only solid and confirmed proof crosses it) now appears before the TMDb ranking rather than just slightly influencing it.

## v1.24.28 — September 2026

### Context engine — the views/ratings/votes/requests ↔ suggestions loop closes

The SQLite journal per user (previously introduced) until now only received reads and explicit corrections via the AI — votes 👍/👎, 1-5 star ratings, requests, and additions via the AI continued to exist only in separate JSON files, never joining this unified journal, and nothing read any search or sheet opening since neither was captured anywhere. All these actions now also write to the unified journal (in addition to their existing storage, without breaking anything), including two signals that didn't exist anywhere before: searches and sheet openings. The genre taste engine (already used for AI responses) now integrates these views as additional proof, and weighs them for the first time on the actual ranking of recommendations sent by the AI — until now it only served to color the tone of the responses, never to choose what to recommend. Download requests remain deliberately a weak and capped signal (often requested for others, not for oneself); the already accumulated history is retroactively taken into the journal, nothing is lost. Still strictly per account — never mixed between profiles, including Plex owner.

## v1.24.27 — September 2026

### "Bad recommendation" no longer excluded the title from suggestions, and did not recalculate the row

The 👎 button on a "Suggestions for you" card correctly recorded the feedback, but the engine behind this row (recommender/engine.ts, distinct from the one used by the AI in conversation) never consulted this journal — the same title could appear indefinitely. It now excludes any title previously rated 👎. The card also immediately disappears from the row, but the list was never recalculated behind: just a simple gap, never replaced before the cache expires. The removal now triggers a revalidation of the row, which dynamically slides another title into its place.

## v1.24.26 — August 2026

### Android mobile — TV style redesign, add in one tap, automatic update

The smartphone client adopts the same principles as the recent redesign of the TV version. The "My list" placeholder (never implemented) becomes a real Library tab: the complete library in a grid, sortable by name/rating/year and filterable by genre, with a Movies/Series selector — Discovery remains the screen for finding content to add. The "Add" button on the featured card on the Home screen previously only reopened the title's page (a second tap was needed there to actually add); it now adds directly to the library in one tap, like every Discovery card already does. Search now displays the same dynamic button on every result, to add without going through the page. Finally, the mobile client receives the same automatic update mechanism as the TV (check on launch against the latest GitHub release, SHA-256 verified download, background installation with fallback to the system installer), adjustable and manually verifiable from Profile.

## v1.24.25 — August 2026

### Episodes without a date — no more "Missing" after an episode already announced as "Coming Soon"

An episode without a known broadcast date used to show "Missing" (and thus be searched for as if it could already exist), even when a numbered episode before it in the same season was still "Coming Soon" with a known future date — chronologically impossible, a series cannot have aired episode 6 before episodes 4/5. Any undated episode following, in the same season, an episode that is still to come now inherits the same "Coming Soon" status instead of showing a false "Missing".

## v1.24.24 — August 2026

### Android TV — redesigned navigation, Discovery separated from the catalog, scaled-down player

The side navigation bar (fixed 224dp, always expanded) now reduces to just the icons when idle and only expands — while remaining narrower than before — when the D-pad approaches it, so as not to constantly encroach on the space for movie/series lists. Each tab now has its own icon (Home, Discovery, Movies, Series previously only showed text). The old Movies/Series screen (hero + editorial rows like Netflix) becomes the Discovery tab, with a Movies/Series selector so as not to mix the two universes in the same rows; the Movies and Series tabs become the complete library in a grid, sortable by name/rating/year and filterable by genre. In the video player (windowed mode, not full screen), the control bar was anchored to the bottom of a panel limited to 80% of the screen height, leaving a void below the controls — the panel is enlarged to 92% to bring it closer to the actual edge.

## v1.24.23 — August 2026

### Manual search — cache no longer replaces live search

Two previous fixes (v1.24.21, v1.24.22) reduced cases where the local cache was enough to cut off querying the indexers, but each safeguard had its own blind spot — the latest one even blocked an otherwise accurate cached result. Manual search now systematically queries all configured indexers every time, and merges these results with those from the cache instead of choosing between the two: no cache configuration can prevent an indexer from being queried for a search you initiate yourself.

## v1.24.22 — August 2026

### Interactive search — a single cached result could also cut off live search

The previous fix only covered the case of a targeted season/episode. Free-text search ("Interactive search") could suffer the same issue without any season penalty being involved: the RSS cache only keeps a recent snapshot (~100-150 releases across all indexers), so a single result in it for a title was enough to prevent a full query of the indexers, even when some had much more to offer. Now, more than one cached result is required to consider the search as already satisfied.

## v1.24.21 — August 2026

### Manual search — a search by season/episode could ignore an entire indexer

A cached release, from the wrong season or episode, could — thanks to quality bonuses (resolution, seeders...) — just barely cross the minimum threshold despite the cap applied to bad matches. Its mere presence was then enough to make it seem like the search already had an answer, which completely canceled the live querying of the indexers — hiding dozens of correct results available elsewhere. A cached result penalized for wrong season/episode no longer blocks the live search.

## v1.24.20 — August 2026

### Indexers — button to refresh categories

Settings → Indexers now offers a dedicated button to reload the actual list of an indexer's categories directly from the selection panel, without going through the general "Test" button.

## v1.24.19 — August 2026

### Search — a custom indexer category (e.g., "Show") could be ignored

A category specific to an indexer (like "Show" on C411, an identifier outside the standard Torznab numbering), even if checked in its settings, would never appear in the "Series" search as long as that indexer also had at least one standard checked category. Filtering no longer recognizes only categories explicitly of the other type (movie vs series) as to exclude — an unknown custom category to Movviz remains included.

## v1.24.18 — August 2026

### Manual search — indexer diagnostics

An indexer absent from the results of a manual search remained invisible as long as another indexer found something — a single aggregated log masked the detail. The log (Settings → Logs) now displays, for every direct search, the number of raw then filtered results for each indexer individually.

## v1.24.17 — August 2026

### Plex Sync — full diagnostic on missing viewed episodes

The log (Settings → Logs) now displays, for every sync, the raw number of "episode" events actually received from Plex before any filtering — previously, if Plex didn't send any from the start, nothing distinguished it from silent downstream filtering. The next sync will finally state precisely where the problem lies.

## v1.24.16 — August 2026

### Android TV — unified navigation and player

Android TV navigation adopts a truly reserved NavRail: no screen or backdrop passes under it anymore, and the Hero occupies the entire usable width of the content area. The home screen relies on native TV lists: the D-pad scrolls up row by row with the associated scrolling, then joins the NavRail only at the top.

The player gathers all controls in its bottom dock. Progress is reachable via the D-pad and adjusted with left/right; the dock displays the actual playback status: direct playback, audio transcoding, or video transcoding. Compatibility fallbacks also retain the correct state during network retries.

## v1.24.15 — August 2026

### Logs — filtering by tag or text

Settings → Logs now offers a free-text search field, in addition to the existing level filter, to isolate a specific tag (e.g., `plex.watchSync`) amidst the noise of thousands of RSS/search lines.

## v1.24.14 — August 2026

### Active sessions — transcoded audio was displayed as "Direct Stream"

A Movviz session that only transcoded audio (video copied as is) was displayed as "Direct Stream" in the admin panel, even though the player correctly displayed "Audio transcoded." Corrected — this case now displays as a transcode, and the target audio codec is displayed even when the video is not transcoded.

### Player — "Skip Credits" button overlapping the playback bar

When shrinking the window, the control bar buttons would wrap onto two lines and enlarge the bar beyond the margin reserved for "Skip Intro"/"Skip Credits"/"Next Episode" buttons, which would then appear on top. Corrected.

## v1.24.13 — August 2026

### Download — a potentially available episode could remain marked as "missing"

Several episodes from the same series that finished downloading at the same time could overwrite each other: the availability writing of one would overwrite that of the other, leaving the episode displayed as "missing" despite a file being present on the disk. The fix already in place for this type of conflict on movies and on direct series import was missing on this fallback path (used when a torrent disappears from the engine before the import triggers); it is now protected in the same way.

### Plex Sync — visibility on missing viewed episodes

The log (Settings → Logs) now precisely indicates how many episodes from the Plex history have been rejected and why, instead of a count silently resetting to zero. An example of the raw fields returned by Plex for a rejected episode is also logged, to confirm the exact cause on this server.

## v1.24.12 — August 2026

### Active Sessions — native Movviz player is now displayed, in addition to Plex

The "Active Sessions" widget (admin only) only displayed streams relayed by Plex. It now also lists what is being played directly via the Movviz player, for all users combined, with the same information as for Plex: title, poster, user, device, direct play/copy/transcode, and progress.

## v1.24.11 — August 2026

### Manual Search — a title present on C411 could remain invisible in Movviz

An indexer paused 10 minutes after a single 429 error (background rate limiting protection: auto-grab, RSS scan) was also excluded from manual search during the entire pause, without any on-screen indication. Manual search now queries all configured indexers regardless of this pause — the request limit per minute specific to each indexer is respected in all cases.

## v1.24.10 — August 2026

### Plex Sync — admin account and Home profiles no longer sync as "viewed"

Since switching to the Plex session history to track what was viewed by account, the admin account and profiles managed by Plex Home (unlike external guest accounts) never synced their history: Plex filters this history by a server-specific ID (internal, distinct from the plex.tv cloud ID stored until now), which these two types of accounts never had. Sync now resolves the correct local ID by Plex username before querying the history.

## v1.24.09 — August 2026

### Maintenance

Version bump with no functional changes.

## v1.24.08 — August 2026

### Unified Branding — Windows, Android, Web/PWA and Docker

The new pink/mauve Movviz logo with a white clap becomes the common identity of the application. The installer and Windows shortcuts now use a multi-resolution ICO, Android Mobile and Android TV share the same launcher/adaptive icons, the TV banner is aligned, and the Web/PWA as well as Docker assets use the same canonical visual.

## v1.24.07 — August 2026

### Maintenance

Version bump with no functional changes — cleanup of GitHub release/tag history prior to 1.24.06.

## v1.24.06 — August 2026

### Settings → Player — total disabling of HDR/Dolby Vision → SDR

HDR10, HDR10+, HLG, and Dolby Vision tone mapping to SDR can now be completely disabled from Settings → Player, even when the server benchmark exceeds the usually required 3× threshold. When activated, the behavior does not change: tone mapping remains allowed only above this threshold.

### Android TV — home synchronized with desktop

The Android TV client home screen now consumes the same layout as the desktop dashboard (`/api/dashboard/layout`): the order and visibility of rows, hero activation, slideshow speed, and trailer autoplay follow the server configuration instead of a fixed TV layout. The "For You" and "Movviz Trends" rows use the exact same sources as the desktop (`/api/metadata/recommendations`, trending row), and "Recently Added"/"Coming Soon" use actual dates (`addedAt`, VF release date) instead of an approximate sort.

## v1.24.04 — August 2026

### Unified Movviz Player

The automatic player uses a single Movviz planner for local files and raw Plex sources: direct playback when the client can actually decode, remuxing when only the track/container needs to change, audio transcoding without touching the video when only the audio is incompatible, and video transcoding only when necessary. The actually selected audio track is decided before the codec: an unselected DTS track can no longer trigger a transcode when the played track is AAC. HDR→SDR remains forbidden below 3× on the benchmark. Software video transcodings adapt to the benchmark and are limited to 1.5× of pre-playback to keep enough buffer without unnecessarily taxing the server.

### Windows, Linux, and ARM64

FFmpeg/ffprobe now use a common media runtime. The Windows installer bundles its own binaries, and the service explicitly points to them; amd64/arm64 Docker images check FFmpeg and ffprobe during their build. The benchmark uses the same runtime resolution as the player.

### Settings → Player

Playback options have moved from Settings → Plex. A dedicated Player tab groups activation by profile, audio language, automatic engine, reserve/cache, diagnostics, and benchmark. Old manual MSE/FFmpeg/HLS/Beta choices are migrated to Auto; Plex retains only connection, synchronization, and profiles.

## v1.24.03 — August 2026

### Setup Wizard — Account creation blocked after account creation

The administrator account creation, added at the very beginning of the wizard in the previous version, remained stuck on an infinite loading screen right after form validation, preventing configuration completion. Fixed.

## v1.24.02 — August 2026

### Setup Wizard — Account creation restored

On a first-time installation, the setup wizard no longer offered to create the administrator account or link a Plex account: the AI Wizard step remained stuck on loading, the download engine displayed "no client configured," and the Plex step remained empty. Finishing the wizard would then loop back to the same page because no account had ever been created. Administrator account creation is now the very first step of the wizard, before everything else.

### Netflix Import and Plex Sync — Viewing dates

Importing a Netflix history recorded each title as "watched just now" instead of keeping its true viewing date. This actual date is now preserved. Real-time Plex synchronization also updates the AI context immediately instead of waiting for several minutes.

### Startup Screen and "What's New" Window

The window displaying update news could appear over the animated startup screen instead of waiting for it to disappear. It now only appears once the startup screen has finished.

## v1.24.01 — August 2026

### Movviz AI — Conversational continuity and explicit preferences

Movviz AI now retains the thread of the last turns much better: implicit references like "it," "him," "that one," or "this change" are resolved by prioritizing the recent conversation instead of starting from scratch. Explicit user corrections immediately replace old contradictory assumptions and remain prioritized in the context.

Explicit preferences on a title are now persisted in the User Context Engine with maximum confidence and directly feed the recommendation scoring. A correction like "you're wrong, I love Watchmen" thus becomes a structured, durable, and prioritized signal instead of a simple forgettable phrase.

The Dialogue Director has also been softened: removal of automatic escalation, stereotypical challenge introductions, and the obligation to win or have the last word. Duel responses can be shorter, more natural, and vary between humor, sarcasm, irony, self-deprecation, or a dry reply, with an enhanced anti-repetition safeguard.

## v1.24.00 — August 2026

### Movviz AI — Unified User Context Engine

Movviz AI now has a unified and persistent user context engine. A SQLite ledger per `user_id` retains media history without mixing profiles: viewed, watched, and completed episodes, distinct rewatches, progress, resuming, and actual timeline when known. Old viewing/progress data are bootstrapped idempotently without creating missing dates.

The Query Engine can leverage this verified state to provide the AI with the exact series progress, ongoing content, and recent history, with enrichment by metadata/genres. Ratings, feedback, requests, facts, insights, and AI memory remain compatible via a unified adapter layer to avoid any destructive migration. Evidence-based taste traits and a confidence level can also feed the personality without turning an inference into a fact.

The Context Engine is additive and resilient: existing stores remain functional, SQLite writes never prevent reading in case of failure, and `MOVVIZ_CONTEXT_ENGINE_DISABLED=true` allows for immediate rollback. Tests cover multi-user isolation, idempotency, and the preservation of multiple rewatches.

### Runtime — Node.js 22

The Movviz server switches to Node.js 22 minimum to guarantee the availability of `node:sqlite`. The Windows installer now bundles Node 22 and Linux builds also use/announce Node 22 minimum.

## v1.23.04 — August 2026

### Release — Aligned versions and artifacts

Synchronization release: application version, lockfile, and Android TV/mobile fallback values aligned to `1.23.04`. The tag `v1.23.04` triggers the GitHub builds for the Windows installer, Linux archive, and Android TV/mobile clients; the Docker image remains generated from `main`. No functional change is introduced by this release.

## v1.23.03 — August 2026

### Cards — Refined virtual YouTube framing

The `detail` profile, shared by the full card and the fly/TitlePanel card, retains the 1920×1080 virtual YouTube engine from v1.23.02 but changes from a `1.10` zoom to `1.15`. The change remains centered and deliberately conservative to make the visual benefit more perceptible in cards without touching the already validated `hero` carousel or `card` layouts. The `postMessage` bridge, fallbacks, toggles, trailer selection, and interactive trailer modal remain unchanged.

## v1.23.02 — August 2026

### Ambient YouTube — Unified 1080p virtual engine

The three ambient surfaces (hover card, hero/carousel, and card header) now use the same raw YouTube engine with a true logical viewport of `1920×1080`, controlled by `postMessage` and then scaled down in CSS via `ResizeObserver`. Each surface has its own framing preset: `card` retains the validated `1.36` zoom, while `hero` and `detail` start at `1.10` to reproduce their previous rendering as closely as possible and remain independently adjustable after visual validation. The bridge, `apiInterface`, chrome masking when exposed, before `ENDED` loop, backdrop curtain, mute, and timeouts are shared. The old `YT.Player` remains the safety fallback and continues to feed the interactive trailer modal. Existing toggles, trailer order, direct video paths, and Android remain unchanged.

## v1.23.00 — August 2026

### New version series

Moving to series 1.23.x. No functional changes in this version.

## v1.22.61 — August 2026

### Cards — 1080p virtual YouTube iframe

The small YouTube previews now use a raw iframe whose logical viewport remains at `1920×1080`, and then a Movviz wrapper calculates a `transform: scale(...)` via `ResizeObserver` to reduce it to the card size. The scale applies `cover × 1.36`, which exactly preserves the zoom/cropping of v1.22.60 while making YouTube think it has a large desktop player. The goal is twofold: to avoid the compact player layout and to maximize the chances that YouTube ABR selects a high quality; however, the 1080p quality remains decided by YouTube and is not officially forceable. The `postMessage`, `apiInterface`, `hideVideoInfo` bridge (if exposed), the pre-`ENDED` loop, the poster curtain, and the `YT.Player` fallback remain unchanged. If the card viewport cannot be measured properly, Movviz automatically falls back to the stable v1.22.60 rendering. Hero, cards, modal, and Android remain unchanged.

## v1.22.60 — August 2026

### Cards — YouTube iframe cropping

The small YouTube previews are vertically re-centered (`top: 50 %` instead of `46 %`) and receive 15% extra zoom compared to the previous cropping (`scale 1.18` → `scale 1.36`) to eliminate the black bars integrated into the trailers. The `postMessage` bridge and its `YT.Player` fallback use exactly the same cropping. Hero, cards, modal, trailer selection, and Android remain unchanged.

## v1.22.59 — August 2026

### Cards — Raw YouTube iframe driven by postMessage

Testing in real conditions limited to small previews: the primary card player is now a raw YouTube iframe with `enablejsapi=1` and `origin`, without construction via `new YT.Player()`. Movviz launches the `listening` handshake, reads the capabilities actually announced in `initialDelivery.info.apiInterface` / `infoDelivery`, and only attempts `hideVideoInfo` or `hideControls` when explicitly exposed by this player. Playback, mute, states, `currentTime`, and pre-END loop pass through the `postMessage` bridge. The poster remains opaque until actual video progression, then an additional 700 ms. In case of failed loading, handshake, or playback, the card destroys this path and automatically falls back to the stable v1.22.58 `YT.Player`. Hero, cards, modal, Android TV, and trailer selection/fallback remain unchanged.

## v1.22.58 — August 2026

### Cards — Poster curtain + real YouTube pause/resume transition

Small previews no longer lose 650 ms before loading the iframe: as soon as the intended preview opens, YouTube starts immediately behind the poster, which remains 100% opaque. On the first `PLAYING`, Movviz calls `pauseVideo()`, now waits for the actually confirmed `PAUSED` event, lets this state stabilize for 450 ms, resumes with `playVideo()`, waits for a second `PLAYING`, checks that `currentTime` is actually advancing, and then keeps the poster for another 300 ms before fading to the video. A global timeout of 2.5 s abandons this warm-up and falls back to the historical 1.5 s settle if YouTube does not follow the sequence. Hero, cards, modal, Android TV, trailer selection, and fallback remain unchanged.

## v1.22.57 — August 2026

### Cards — Invisible YouTube iframe warm-up

Small previews now start earlier under the backdrop (650 ms instead of 1000 ms), then perform a single hidden `PLAYING → pause → play` sequence. Movviz then waits for `currentTime` to actually advance after resuming and applies a short delay of 180 ms before revealing the video. This sequence reproduces the clean visual state observed after a manual resume without mouse movement, while keeping a hard fallback at 1500 ms if YouTube ignores a transition. The hero, cards, modal, Android TV, trailer selection, quality, and fallbacks remain unchanged.

## v1.22.56 — August 2026

### Version fix — YouTube preview for cards

Release the YouTube preview fix for the small cards above the existing `v1.22.55`. No functional change compared to the previously validated card patch: YouTube iframe retained, direct YouTube → user traffic, `scale 1.18` crop, 46 % center, 28 % proportional top mask, hero and sheet videos unchanged.

## v1.22.54 — August 2026

### Cards — compact YouTube iframe without title

Targeted test on card previews only: the hero and sheet videos remain unchanged. The small cards retain the YouTube IFrame API and direct YouTube → user traffic, but use a slightly reinforced crop (`scale 1.18`, center moved up to 46 %) and a 28 % proportional top mask to hide the title/channel chrome in the compact layout. `YOUTUBE_CHROME_SETTLE_MS=1500`, `LOOP_BEFORE_END_SEC=0.75`, trailer selection and YouTube fallbacks remain unchanged. No Piped/Invidious/yt-dlp added.

The revert 1.22.53 left orphaned Piped/Invidious files which already made `tsc --noEmit` invalid; these unreferenced remnants are removed to cleanly complete the revert before validating this version.

## v1.22.53 — August 2026

### Revert — 1.22.50 postponed to 1.22.53

Pull of `v1.22.50` (clean revert to `v1.22.27`) postponed to `v1.22.53`.

## v1.22.50 — August 2026

### Revert — return to stable 1.22.27

Clean return to `v1.22.27` following hover/zoom regressions.

## v1.22.27 — August 2026

### Blocked Torrents

A specific release can now be forbidden from the download queue. The block is linked to its info-hash: other releases for the same movie or series remain available. A "Blocked Torrents" page in Management allows viewing and unblocking each torrent.

## v1.22.26 — August 2026

### TMDb Trailers

Spots, promos, and other promotional videos can no longer precede a real TMDb trailer. Carousel, card, and sheet previews now prioritize the full official trailer in all contexts.

## v1.22.25 — August 2026

### Docker Workflow

Correction of YAML indentation and addition of an explicit workflow name for Docker publications.

## v1.22.24 — August 2026

### Docker Publication Fix

Workflow correction: comments are no longer interpreted as invalid Docker tags.

## v1.22.23 — August 2026

### Independent Docker Publication

The AMD64 image now publishes the `latest` tag as soon as its build is finished. The ARM64 build remains parallel on its own tag, and the multi-architecture manifest is assembled afterward, allowing AMD64 NAS devices to update without waiting for ARM64.

## v1.22.22 — August 2026

### Trailers: Priority and Validation

Videos linked by TMDb are now the sole source used for previews; the old enriched sources system is neutralized. The YouTube fallback refuses any result whose title and type are not sufficiently validated, in order to avoid trailers for another movie.

## v1.22.21 — August 2026

### Sheet: gradient junction

The bottom gradient of the sheet now correctly covers the edge of the panel, removing the thin line visible between the visual and the content.

## v1.22.20 — August 2026

### Video fallback: reliable selection

The YouTube fallback now validates the title, language, channel, and video type. Spots, teasers, clips, recaps, and interviews are discarded in favor of official trailers. Old erroneous matches are invalidated by a new cache key.

## v1.22.19 — August 2026

### Cards: stable and haze-free preview

The video preview for cards appears without movement or top fade during loading. The carousel and sheets retain their unchanged rendering.

## v1.22.18 — August 2026

### Cards: unified video preview on Hero/sheet flow

The hover preview on cards (`DashboardPosterCard`) now uses exactly the same `TrailerHeader` as the Hero and the sheet (`trigger="immediate" enabled={videoPreviewEnabled}`) — same `backdrop`, same `trailerKeys/enhancedSources`, same crossfade, and same mute button. Only the triggering remains mouse-based (`videoReady` after 1s); the video rendering is strictly identical.

## v1.22.17 — August 2026

### CI: Linux Release build fix

The `tar -tzf | grep -qx` check caused a SIGPIPE when grep quit prematurely after finding a match, killing the pipeline under `set -euo pipefail`. The check now writes the list of files to a temporary file before grepping, eliminating the signal. The runner is pinned to `ubuntu-22.04`.

## v1.22.16 — August 2026

### AI: directed dialogue, double Mistral and complete factual answers

Movviz now distinguishes between a critique, a factual correction, and a real provocation before answering. The exchange escalates gradually, avoids recycled phrases, and maintains a coherent mini Ghostface scene, one step per message. With two Mistral keys, two answers can be evaluated in parallel to display only one; a single key continues to function normally. Filmographies and actor/director counts are checked against TMDb and the library, with owned and missing relevant titles, while music questions use factual web search.

## v1.22.15 — August 2026

### Hero 5 visuals guaranteed + airtight AI profiles

Hero no longer drops to 2 visuals when `minYear` filters too much: excluded items return sorted by score to always make 5. AI: `getWatchStatus` + `getRecommendations` strictly by `userId` (Plex `accountId` verified, `rejectedForeignEntries` logged), no more movies from another profile.

## v1.22.14 — August 2026

### Search and linking: Yellowstone corrected + All/Movies/Series sort

Search no longer switches to the filmography of a homonymous actor (`Yellowstone` actor 3 votes → `Yellowstone` series 73586 3298 votes kept), docu `19355` not proposed instead of the series, and the Discovery page gains an `All | Movies | Series` sort + `Relevance/Popular/Recent/Notes` without refetch, with highlighting of known/recent. Plex link `tvdb://85527` → `73586` if docu.

## v1.22.13 — August 2026

### AI: generalized anti-repetition

The control no longer depends on an uninterrupted sequence of insults: all conversational responses are compared to recent formulations. Short provocations like "little punk" are still correctly identified after a normal question; three reformulations are attempted before any fallback, and an explicit remark on repetition receives a contextual answer rather than a generic retort. The existing personality is maintained.

## v1.22.12 — August 2026

### AI: personality retained, repetitions removed

The assistant retains its tone and personality, but now remembers recent phrasing beyond a normal conversation interruption. Responses that recycle the same structure with a few changed words are detected and then regenerated; previously used openings, closings, and prompts also serve as a temporary blacklist. Overly recognizable old phrases have been replaced with short and varied responses.

## v1.22.11 — August 2026

### Android TV: home crash permanently fixed

`HomeScreen` `focusRequester` protected (`runCatching + withFrameNanos` 8 frames), `heroIndex` anti-divide-by-zero, `AmbientTrailer` `availMem` 400Mo + `applicationContext` + pool `1` idle, no more WebView leak. D-pad `focusGroup`/`padding 80dp` stable.

## v1.22.10 — August 2026

### Remaster HD withdrawal + static thumbnail + optimized dashboard retained

Complete withdrawal of the HD remaster system (1.22.00) — too many false positives — return to `Apple/Netflix/Disney+/Prime/IMDb → TMDb` exactly as before, no regression. Hover thumbnail: black veil and zoom removed, remains static before video preview. Retained: identical splash, D-pad, speed optimization, SVG logos.

## v1.22.09 — August 2026

### Full and installable Linux Archive

The x64 Linux release now contains the precompiled application, the engine, `install.sh`, `uninstall.sh`, the systemd service, and a reorganized Linux guide. The installer creates the `movviz` system account itself, installs available media dependencies, preserves data during updates, and can directly install the extracted bundle. CI checks the archive content before publishing and provides its SHA-256 sum.

## v1.22.08 — August 2026

### Reliable video previews and unified metadata

The "remastered" search is removed from all previews: it could associate a video with the wrong title. Reliable improved sources remain in the order Apple TV, Netflix, Disney+, Prime Video then IMDb, before the TMDb trailer. Desktop, mobile, and TV cards now display more concise metadata: compact duration and technique, genres separated by dots.

## v1.22.07 — August 2026

### Android TV Build fixed + clean hero/thumbnail + mobile aligned with desktop

TV Build `focusGroup` import corrected (`foundation` not `ui.focus`), hero pause `||` hidden (`900→1500ms` + top veil `z-10`), thumbnail hover only video as hero, mobile palette `Void #05060B / Surface #0D1020` aligned with desktop.

## v1.22.06 — August 2026

### Hero and thumbnails: clean video without YouTube UI

The central `||` of the hero disappears (delay `YOUTUBE_CHROME_SETTLE 450→900ms` to cover the YouTube chrome) and the hover thumbnail masks the YouTube title/channel bar with a top veil, to display only the video as the hero.

## v1.22.05 — August 2026

### Splash synchronized to images and TV D-pad

The splash now remains until **all dashboard images** are loaded (15s timeout requested) and not just the library — no more splash that disappears before the rows. Android TV fixes: `NavRail` + `LazyColumn` with `focusGroup`/`padding 80dp` anti-overlay, `focusRestorer` null, `BringIntoViewSpec`, WebView memory threshold `4→2Go`.

## v1.22.04 — August 2026

### Instant dashboard and SVG logos

High-quality Movviz splash on first cold start only (never on every click) with intelligent progress bar, background preloading of Discovery in optimized mode (`requestIdleCallback` + `priority:low`), and correction of TMDb logos in `*.svg` that remained 404 (`tmdbImageCache` now allows `svg`).

## v1.22.03 — August 2026

### Chat improvement

## v1.22.02 — August 2026

### Homogeneous trailer previews

Cards now use the same source selection as the carousel: restored HD trailer, direct video, then YouTube as a last resort. On startup, YouTube remains briefly obscured by the illustration to eliminate the large central play/pause button, on cards as in the carousel.

## v1.22.01 — August 2026

### Chat improvement

## v1.22.00 — August 2026

### Prioritized restored trailers

New global setting **"Prioritize restored trailers"** in **Settings → Info, images and logos** (disabled by default, reversible with one click, active for all when admin enables). When active, Movviz prioritizes restored/remastered/re-trailer in **Full HD/4K** from **5 trusted YouTube channels** (Digital Ciné, HD Retro Trailers, Casu/Re-Trailer, FilmsActu, The Digital Theater) — strict whitelist by `channelId`, actual resolution polled (≥1080p mandatory, otherwise rejected), ultra-conservative title matching (≥0.85) + exact year/±1 (homonymous remakes never confused), user's preferred language, providers in parallel with short timeouts and global deadline ~3s, dedicated ranking, separate cache (7d positive / 18h empty / no cache on transient error), immediate fallback to the current workflow (Apple/IMDb/Prime → YouTube) at the slightest hesitation. Web integration: `DashboardHero` (carousel context: teaser > trailer) and `TitleContent` (details context: trailer > teaser) via `TrailerHeader`/`TrailerModalPlayer` (`premiumSources` prepended), `GET /api/trailers/remastered/resolve` checks the toggle BEFORE any network request, Android TV/mobile: optional `premiumTrailerCandidates` field (`= emptyList()`) — old APK ignores, old backend without field does not crash. Zero regression guaranteed: toggle OFF = exact workflow unchanged.

## v1.21.17 — August 2026

### Actor profiles: useful filmography

Talk shows, late shows, and award ceremonies no longer pollute actor profiles. Movviz excludes the TMDb genre "Talk" and rarely miscategorized shows, without changing search, Discovery, or title pages.

## v1.21.16 — August 2026

### Personal recommendations on Android TV and mobile

Android apps now use suggestions from the library already used on desktop. The "Suggestions for you," top-rated titles, and genre selections are calculated from the films and series actually present, while preserving the editorial rows of Discovery.

## v1.21.15 — August 2026

### Discovery: a "dislike" title reappeared after refresh

The 👎 on a Discovery card was correctly saved, but the editorial rows (trends, popular, top-rated...) never consulted it — the same title thus reappeared on every page reload. These rows now permanently exclude titles marked "dislike".

### Movies/Series: missing logos on Resume and Recently Added Episodes

On Movies and Series pages, the "Resume" and "Recently Added Episodes" rows displayed the title as plain text instead of a logo — these cards were never included in the group logo retrieval. Fixed. Also added a permanent badge in the bottom right corner of the card ("S03 · E02") to identify the episode at a glance, without having to hover.

### Chat improvement

### Chat improvement

### Carousel preview: thin black line on trailers

A slight rounding offset between the video and its frame sometimes revealed a one-pixel black line on the edge of the player (direct MP4/HLS trailers). Minimal zoom added to make it disappear.

### Chat improvement

### Chat improvement

### Chat improvement

### Chat improvement

### Chat improvement

### Chat improvement

### Chat improvement

### Chat improvement

### Chat improvement

## v1.21.01 — August 2026

### Smart Chat: common words confused with titles

Tested in real conditions: responding just "bof" or "cretin" caused the Smart Chat to derail onto an obscure film bearing this name by coincidence ("O Bofe", "Ce crétin de Malec") instead of understanding the remark. Expanded filtered word list (common interjections, usual insults) so as never to confuse an everyday word with a title mention.

## v1.21.00 — August 2026

### Next-generation Linux installer + one-click update

The Linux installer (`packaging/linux/install.sh`) now detects an existing installation and offers to update it (keeping the library), reinstall everything, or uninstall — no longer necessary to clone the repository: `curl -fsSL .../install.sh | sudo bash` directly downloads the ready-to-use bundle of the latest version. And in the interface, the "One-click update" button (Settings → About), previously reserved for Windows, now also works on a native Linux installation (systemd service) — Docker containers remain up to date via `docker pull`, as before.

## v1.20.12 — August 2026

### Hover preview of cards: slightly increased zoom

On certain titles (RoboCop 2014 confirmed), a thin black band remained visible at the top/bottom of the video preview on card hover — the trailer itself incorporates a slight letterbox. Zoom increased by one notch, only on this preview (the home carousel and the title sheet are not affected).

## v1.20.11 — August 2026

### Android mobile: build fix

The Android smartphone build failed for the same reason as the TV corrected in v1.20.08: the mobile home screen had not followed the change in the compact contract for /api/interface/dashboard. Same fix applied.

## v1.20.10 — August 2026

### Smart Chat: livelier banter exchanges, teasing repeated questions

The Smart Chat now reacts to the precise content of what you say (not a canned response), always remembers the last word, and knows how to end a prolonged banter exchange by genuinely suggesting a movie to lighten the mood. By the way: if it notices you are asking a question already answered higher up in the conversation, it can gently tease you before answering — never in place of the answer.

## v1.20.09 — August 2026

### Smart Chat: tone regarding insults, take 3

Tested in real conditions: the Smart Chat recycled the same line word for word (only the insult changed), and sometimes derailed again towards an unsolicited recommendation list. Strict prohibition of any list in this specific case, and explicit instruction never to reuse a formula already used earlier in the conversation.

## v1.20.08 — August 2026

### Android TV: build fix

The Android TV build failed: a documentation comment erroneously contained a sequence that, in Kotlin, opens an unclosed nested comment — the rest of the file became invisible to the compiler. Fixed.

## v1.20.07 — August 2026

### Hover preview: black veil removed from the video

On the preview card that opens on mouse hover, the black overlay on the playing trailer unnecessarily masked the image — removed only in this specific case (the image/placeholder preview keeps its overlay for title readability).

## v1.20.06 — August 2026

### Smart Chat: making-of never added unless explicitly requested

Adding a movie should no longer automatically surface a making-of or a derivative web series — unless you explicitly ask for it ("the making of..."), in which case it is now respected instead of being blocked.

### Android TV: startup robustness

The compact home screen contract is now tolerant of incomplete library entries — a missing value no longer interrupts loading; it is simply ignored.

## v1.20.05 — August 2026

### Smart Chat: tone when faced with insults, take 2

Tested in real conditions: when faced with an insult, the Smart Chat was still too evasive ("are you kidding me?") and, worse, sometimes completely transformed the insult into a pretext to display an unsolicited list of recommendations. Instruction tightened so that it reacts first and truly to the provocation, without changing the subject.

## v1.20.04 — August 2026

### Smart Chat: additions/recommendations, fewer false matches

Tested in real conditions: requesting the addition of "Terminator 2" or "Terminator Salvation" sometimes added a making-of or a derivative web series instead of the actual movie — unrecognized TMDb bonus content. And a recommendation like "The Death of Stalin" could surface an almost anonymous duplicate (1 vote) instead of the actual movie, because the localized French title did not match the requested title. Both are corrected.

## v1.20.03 — August 2026

### Smart Chat: more reliable JSON recommendations

Strengthened the internal examples that the Smart Chat follows to build a list of recommendations or additions — multiple titles in a row rather than just one, with the exact syntax to follow. Goal: fewer cases where the generated format fails and triggers a generic error message.

## v1.20.02 — August 2026

### Smart Chat: questions about directors, filmography, and tone

Several natural phrasing ("what did X direct", "how many films did I direct by X"... etc.) were not recognized and gave a fabricated answer. Corrected, and also: documentaries are no longer mixed with actual works in responses about a director, and a recommendation request that sometimes failed to formulate correctly now automatically recovers instead of displaying a generic error message. The tone of the Smart Chat is also a bit more responsive to a teasing remark.

### Library: tighter layout

On the Movies and Series pages, the Available/Missing filters occupied an entire line next to an unnecessary empty space. Tighter layout, less wasted space.

## v1.20.01 — August 2026

### Library: Plex recommendations and episodes added

Movies and Series now open on a Recommended tab, composed exclusively of your library: resuming, recent additions, personalized selections, top ratings, and genres. The comprehensive Library view remains available in its own tab. The dashboard also displays recently added episodes, with their season and episode number.

### AI and metadata

Improvements on AI actions, intent interpretation, and TMDb resolution are part of this version.

## v1.20.00 — August 2026

### Major cleanup of GitHub releases

Complete cleanup of the GitHub releases history: deletion of dozens of old accumulated versions, keeping only useful milestones. No functional change on the application side.

## v1.19.63 — August 2026

### Resume: menu card, no more sound button

On "Resume" line cards (and all cards with video preview), the sound button has been removed — the preview remains silent, without a useless button. The chevron now opens a menu: "Mark as seen" (which also removes the card from Resume) and "Remove from Resume list" without marking it as seen. By the way, the improved trailer sources (Apple/IMDb) are now a single server setting, plus a user choice.

## v1.19.62 — August 2026

### Search: true filmography of directors, mixed films and series

Searching for a director (e.g., "Christopher Nolan") only returned titles where his name appeared randomly in the text, never his actual films. The search now displays his true filmography, with his works highlighted. Another fix: a search now mixes films and series in the same results instead of requiring a tab change. The intelligent Chat also now distinguishes between "directed by" and "appears in" (cameo, production...) — it will no longer confuse, for example, a cameo in a series with an actual directed film.

## v1.19.61 — August 2026

### Search: always visible in the menu

Fix: the menu search bar used to disappear once on Discover (which had its own separate bar). There is now only one, always in the same place, whether on the dashboard or already on Discover. On mobile, the magnifying glass icon becomes a real search bar instead of just a link.

## v1.19.60 — August 2026

### Search: direct in the menu, results in cards

Search moves from the "Search everywhere" menu to a real bar integrated into the left menu — typing a word directly opens Discover with results in cards (films, series, actors, directors), instead of a small dropdown menu. On mobile, the magnifying glass icon opens Discover directly.

## v1.19.59 — August 2026

### Quick search: actors and directors

Quick search (Ctrl/Cmd+K) now also finds actors and directors, in addition to films, series, and pages — a person result directly opens their filmography sheet. By the way, the intelligent Chat now recognizes "how many films do I have by [director]" as a real filmography question (previously, only "filmography of X" type formulations were recognized — a question asked differently received an unverified made-up answer).

## v1.19.58 — August 2026

### Trailers: translated titles fix

Tested in real conditions: a film like "The Idea of You" never found its Apple/Prime trailer, while the original title "The Idea of You" finds it immediately — these catalogs almost always reference films by their English title, not the French translation. Search now uses the original title by default (same logic already used for file search).

## v1.19.57 — August 2026

### Trailers: slowness fix

Tested in real conditions: trailer search (Apple, Prime...) could take up to 12 seconds because each source was checked one after the other. They are now checked all at once — 4 to 6 seconds instead of 12, without changing the result.

## v1.19.56 — August 2026

### Trailers: Prime Video added as source

After live technical verification (downloaded and confirmed unencrypted video segment), Prime Video joins Apple as a direct trailer source for films — same setting, same automatic fallback to YouTube. Netflix remains disabled: also tested live, but rejected by Netflix with an account restriction even before reaching the video stream.

## v1.19.55 — August 2026

### Apple Trailers: HD/4K quality + reliability fix

Tested in real-world conditions (25+ trials, enabled and disabled): a real bug was found and fixed — a burst of checks could wrongly suggest that a movie did not have an Apple trailer for 24h due to a temporary bandwidth limit on Apple's side. Take advantage of these tests to also improve quality: the Apple trailer now goes through the native HD/4K stream instead of a low-resolution file, with automatic selection of the best available quality.

## v1.19.54 — August 2026

### Trailers: reinforced reliability + expanded source search

The direct trailer player (Apple) now has a safeguard: if loading does not progress within a few seconds (observed in real-world conditions), Movviz automatically switches to YouTube instead of getting stuck. The source chain has also been expanded to Netflix, Disney+, and Prime Video — after in-depth technical verification, none of these platforms expose an exploitable public trailer without protection circumvention or account, so these three sources remain inactive for now (Apple remains the only direct source, YouTube the usual fallback).

## v1.19.53 — August 2026

### Trailers: Apple direct source before YouTube (optional)

New setting (Settings → My Experience, disabled by default): Movviz can now try a direct Apple video before falling back to YouTube as today for the look of the page and the "View Trailer" player. No loss of functionality if the Apple source is not found or fails — YouTube remains the automatic fallback, and the setting can be disabled with one click to instantly revert to the current behavior.

## v1.19.52 — August 2026

### Android Apps: faster startup, episode playback fix

TV and mobile apps now load the library at startup via a single compact snapshot instead of two full calls, with automatic fallback to the old behavior if necessary. Fix also for series mixing Plex and local episodes: the playback source is now determined episode by episode rather than inferred from the entire series, which was causing a playback error on some episodes. TV profile selection screen reworked.

## v1.19.51 — August 2026

### Smart Chat: invented duration and file quality, corrected

Confirmed live: on a movie's page, a question about its exact duration or quality (4K, HD...) could receive an invented answer — sometimes even insisting on it after correction, even though none of this was actually transmitted by Movviz. The real duration and quality of the file in the library are now provided, or the absence of data is frankly reported instead of an approximate figure presented as real.

## v1.19.50 — August 2026

### Tags removed

The custom tagging feature on movies and series has been completely removed — no more field on the page, no more filter in Movies/Series, no more associated menu on cards.

### Page: visual polish

Page scrollbar hidden, video stretched to the actual edge of the panel (it used to stop a little before), dark overlay in front of the video less present over the majority of the image (it only darkens towards the bottom, to blend with the rest of the page), slight zoom on the video preview to hide the thin black bars that some trailers occasionally include. The thin separator bar under the top menu has also been removed.

## v1.19.49 — August 2026

### Movies and Series open a page instead of changing pages

Clicking a card in Movies or Series used to reload an entire page — like on Discovery or the Dashboard, a page now opens over the grid with a fade-zoom effect from the clicked card, without ever leaving the page. It is also wider than before, to leave more room for the image and information.

### Clicking the poster starts playback, clicking the info opens the page

In the enlarged view on hover of a map, clicking directly on the image or the play button starts the movie immediately; clicking the information area (year, duration, genres) or the arrow opens the full sheet. The small preview on hover no longer remains displayed over a freshly opened sheet.

### Simplified map display

The hover zoom on the map image has been removed (only the map used to enlarge, the image zooming additionally weighed down the effect). The appearance of maps in a grid on loading is now managed without JavaScript animation.

## v1.19.48 — August 2026

### Smart scrolling in Movies and Series, with alphabetical index

On a large library, opening Movies or Series used to load everything at once and slow down the display. The grid now fills in batches of 200 titles, and automatically loads the next batch as you approach the bottom — the space for titles not yet displayed remains reserved so that scrolling never jumps. A sudden jump far down the list (scrolling the scrollbar, End key) now directly loads the area where you land, without waiting for a gradual catch-up from the beginning. When sorting by title, an A-Z bar like Plex appears on the edge of the screen to jump directly to titles starting with a given letter.

### New setting: disable automatic missing item search

Server setting, reserved for admin, in Settings → Automation: cuts the RSS scan, the periodic relaunch of missing movies/episodes, and the search for today's releases, with a single toggle. Tracking by title and the manual "Search" button continue to work normally.

## v1.19.47 — August 2026

### Smart chat: bonus content could pass for the real movie

A "deleted scenes" or "making-of" sheet sharing the same title as a real movie could, in rare cases, be suggested in its place in a recommendation — the displayed rating was then based only on a handful of votes. This type of content is now automatically excluded, the differentiation between two identical titles is based on the actual volume of votes rather than just the rating, and the same suggestion can no longer appear multiple times in the same response.

## v1.19.46 — August 2026

### Settings: indexers and download clients were not reserved for the admin

The "Indexers" and "Download clients" tabs were visible to any user in Settings, even though all sensitive data there is already protected on the server side — corrected so that they are no longer displayed except for an administrator, like the rest of the server settings.

### Images from the Internet become a server setting, more private

The choice to load posters/logos directly from TMDb rather than via the server (network impact/load for the whole house) was until now decided individually by each account. It is now a single server setting, in Settings → Cache.

### Smart chat: more reliable recommendations

Three fixes after a battery of tests in real conditions: a technical code fragment (```json```) could literally appear in a response; a title sharing its name with an older/obscure work could be confused with the correct version; a documentary completely off-topic could appear in a list of "similar" movies to a fiction. The tone and personality remain strictly unchanged — these fixes only act on the reliability of the transmitted data.

### Clearer playback error message

When a video cannot be played because the browser does not know how to decode its codec (HEVC in particular, common in 4K/HDR), the message now clearly indicates this instead of a generic message.

## v1.19.45 — August 2026

### Plex resume leak between accounts corrected

A Plex Home profile managed with the administrator token could, in some cases, be offered the playback resumption of the server owner's account instead of their own. Plex's response is now verified before being used: if it exactly matches that of the owner instead of the requested profile, it is ignored rather than displayed to the wrong person.

## v1.19.44 — August 2026

### A file manually deleted on the disk is no longer automatically re-downloaded

A movie, episode, or entire series deleted directly on the disk (outside of Movviz) now goes to the Trash instead of immediately re-searching — with a "Missing from disk" badge to distinguish it from a manual deletion, and a dedicated filter in the Trash page. A trash entry is never automatically purged: restore it to re-trigger a download (useful in case of accidental deletion), or empty it permanently — in this case, Movviz also asks Plex to remove its own reference, so that its next synchronization does not make it reappear by itself. Deleting an entire series groups everything into a single entry rather than one per episode; deleting only a few episodes leaves the rest of the series intact.

## v1.19.43 — August 2026

### Logos sometimes disappeared from all cards at once

Fixed: a background refresh of the dashboard suggestions could, for a fraction of a second, make the title logos of all visible cards disappear simultaneously before returning. Once displayed, a logo now remains in place as long as its card is visible, even if the surrounding data refreshes silently.

## v1.19.42 — August 2026

### Remote interface much faster

Movviz can now use an optimized data stream, activatable by an administrator in Settings → Server Speed and Capacity. The dashboard, discovery, local search, and navigation badges only request the necessary data for the screen instead of downloading entire libraries. On the reference library, the dashboard transmits about 89% less compressed data.

The setting is global to the server, with a Compatibility mode that instantly retains historical functionality for all users. Notifications are loaded upon opening the bell, real-time updates target only the data concerned, and download queues adapt their refresh rate to their activity.

## v1.19.41 — August 2026

### More dynamic card hover

The preview that enlarges on card hover now remains in place during a page scroll instead of being fixed on the screen, closes immediately if scrolling, and now appears with a real progressive zoom effect rather than a simple fade. The dashboard cards have also been slightly reduced to better harmonize with those of Movies and Series.

### Reduced background parasitic network loading

The automatic preloading of entries, which was triggered for every visible card on the screen even when the entry actually opened in a panel without ever truly navigating, no longer triggers — fewer unnecessary background requests during navigation.

## v1.19.40 — August 2026

### Publishing cleanup

Internal documents used to prepare the settings redesign have been removed from public distribution. The functionality of the control center and settings remains strictly unchanged.

## v1.19.39 — August 2026

### Settings become a true control center

The settings home now checks Plex live, the download engine, metadata, and storage. Indicators light up successively, give a clear verdict on Movviz's status, and directly open the setting to correct when attention is needed.

### Essential Mode and guided tours

The long technical list defaults to five understandable objectives: My Experience, Reading, Library and Plex, Downloads, then Server and data. Each path explains what it contains, distinguishes essential choices from advanced tools, and maintains contextual feedback. The saved Expert mode instantly grants access to the 25 sections, with no options removed.

### Search and more human labels

Search also finds advanced settings from the Essential mode. Vague names like "Experience," "GPU," "Performance," or "Maintenance" now describe their actual function. Old `?tab=` links remain compatible, and standard users no longer unnecessarily trigger administrator-reserved controls.

## v1.19.38 — August 2026

### A card could remain stuck loading indefinitely

Fixed: Retrieving title information from TMDb had no time limit — an abnormally slow response was enough to block the card indefinitely on its loading screen, without ever failing or retrying. A reasonable time limit is now in place, with automatic retries like for any other network error.

### "Playback Engine" setting clarified: Stable / Auto / Beta

The administrator setting Settings → Plex gains two new options. "Stable" explicitly locks the current playback behavior, guaranteed never to change even if "Auto" is pointed to later. "Beta" is the new decision engine, now capable of handling both movies and series episodes (limited to movies for now). Automatic and punctual migration to this update: regardless of the current choice, it will switch back to "Auto" once — to protect anyone who had manually selected the old experimental engine thinking, up to now, that it would change nothing.

### HDR/Dolby Vision content is no longer ever converted to SDR

Absolute rule now: an HDR or Dolby Vision title plays as is, never with a color conversion to a standard rendition, even when transcoding is necessary for another reason. A device that does not natively support HDR displays the image as is rather than waiting for an expensive conversion.

### More precise playback indicator

The badge displayed during playback (copy/remux/local transcode) now specifies whether hardware (GPU) or software (CPU) encoding is used.

## v1.19.37 — August 2026

### Vertical video previews in trends and on cards

Fixed: Some video previews (carousel, card) were displayed in a vertical, social media-like format instead of the usual cinematic format. The detection that was supposed to exclude these vertical clips was querying the wrong data and had not actually worked since its implementation — it is now reliable. A studio can also publish a real burst of vertical clips consecutively for the same title; the selection now correctly falls back to the classic trailer in this case rather than getting stuck. Fixed a video player that could display in a reduced size instead of filling the entire frame.

## v1.19.36 — August 2026

### Web, Android TV, and smartphone versions aligned

The fallback values for the two Android projects are now `1.19.36` with the `versionCode` `11936`, matching the web server and release tag. APKs built by CI already use the tag, and local builds / "About" screens can no longer report an old version.

## v1.19.35 — August 2026

### Cinema carousel that would disappear and then loop back

Fixed: The YouTube API itself was replacing a node that React was supposed to remove after a slide. This triggered a `removeChild` error, and then the recovery mechanism continuously re-raised the hero. The YouTube player is now isolated from the DOM managed by React; a persistent error can no longer endlessly restart the carousel.

## v1.19.34 — August 2026

### The "Images from Internet" toggle would disable itself

Fixed: activating it seemed to work for a moment then reverted to off. Saving the setting was silently rejected on the server side (list of recognized settings not yet updated) — the setting now holds correctly.

### Missing title logo on the sheet, smartphone

The sheet for a movie or series on Android smartphone never displayed the TMDb logo for the title (just the text title), unlike the rest of the app. Fixed — same logic as everywhere else: the logo replaces the text title when TMDb has one.

## v1.19.33 — August 2026

### Discovery on Android TV and smartphone

Both Android clients catch up with Discovery: same editorial rows as the web (including the personalized "because you watched/liked" row), same genre filter with Anime and Teen Romance included, "See all" in a paginated grid. New on smartphone, where this section did not exist before.

### Android Player — same styling as the web

Progress bar and "Optimizing" screen (with the animated logo) are replicated identically on both Android clients, for a consistent experience regardless of the device. On smartphone, the thumbnail that appears when dragging the slider now displays a real preview of the image at that moment, plus a simple time marker.

### Real-time series download tracking on Android TV

The sheet for a series on Android TV now displays, for each episode being downloaded, its progress, speed, and remaining time — updated live, without having to leave and reopen the sheet. Aligned with what the smartphone client already offered.

## v1.19.32 — August 2026

### Images loaded directly from the Internet (optional)

New setting in Settings → Experience: posters, backgrounds, and logos can now be loaded directly from TMDb rather than systematically going through your own server — useful if your upload connection is limited. Automatic fallback to your server if TMDb is unavailable. Disabled by default: nothing changes until you activate it. A second setting, available once the first is activated, prioritizes your server when you are on your home network (no point in going out on the Internet in this case).

## v1.19.31 — August 2026

### Discovery truly personalizes

Movies and Series each gain a dedicated row based on what you watch the most (or have rated the best) — never displayed if there isn't enough history yet. The suggested titles go beyond simple genre: the taste engine, already used elsewhere in the app, refines the ranking based on the actual style of the title that served as the starting point, not just its TMDb category.

## v1.19.30 — August 2026

### The enlarged preview remained displayed after opening a sheet

Clicking on a poster to open its sheet left the enlarged preview (with its video) floating over it, instead of closing. It now closes immediately on click.

## v1.19.29 — August 2026

### More portrait format trailers in previews

Since the teaser is preferred over the classic trailer for animated backgrounds (carousel, sheet, poster hover), some studios publish their teaser in vertical format (designed for social networks) — stretched/cropped into a 16:9 box, the rendering was poor. Vertical videos are now excluded from the selection; the teaser remains preferred when a version in the correct format exists.

## v1.19.28 — August 2026

### Video preview on poster hover

On desktop, hovering the cursor over a movie or series poster (dashboard, discovery) for one second now switches to the enlarged preview on the animated background trailer, like on the sheet pages — disableable via Settings → Experience → Video previews (the same setting now covers both locations).

### Suggestions no longer include unrated or not yet released titles

The suggestion rows (dashboard and Discovery) could suggest a title with no rating or not yet in theaters — nothing to say, nothing to watch. They now only show titles that have already been rated and released, except for the rows explicitly dedicated to what is coming soon.

### Android TV Client — new Discovery rows

The rows recently added on the web (critically acclaimed, anime universe, teen romance, short format, genre rows) now display with their correct French title on the Android TV client, instead of a generic title.

## v1.19.27 — August 2026

### The video overflowed at the top and bottom on an ultra-wide screen

On a screen wider than 16:9 (ultra-wide), the player no longer scaled the video correctly: instead of maintaining its proportions with black bars on the sides, it stretched to the width of the window and overflowed at the top and bottom, cutting off the top and bottom of the image. Fixed — the video always maintains its original proportions, regardless of the screen format.

## v1.19.26 — August 2026

### New Discovery rows were not visible to everyone

The Settings page allows choosing between two displays for Discovery ("Movviz" or "Allociné"). The new rows added in v1.19.24 (critically acclaimed, anime universe, teen romance, short format, genre rows) were only connected to the default display — invisible to anyone who had chosen the other. They now appear on both, with the same content.

## v1.19.25 — August 2026

### Infinite update loop on Android TV

The application would reinstall "an update" on every launch, even just after having already applied one: its internal version number remained stuck on an old value instead of following the actually published version, so it thought it was perpetually behind. It now only suggests an update when there really is one. The version number displayed in the Android smartphone client's "About" section was similarly stuck (with no consequence, this client does not yet have automatic updates) and is corrected in this update.

## v1.19.24 — August 2026

### Discovery greatly enriched, and two new shared genres

The Discovery page now displays many more editorial rows (critically acclaimed, anime universe, teen romance, short format, plus several genre rows) in addition to those already in place. Two new genres appear in the Genres menu, wherever they already exist: "Anime" and "Teen Romance" (designed for a current teenage audience, not for children). The Movies and Series pages also gain a genre filter next to the existing filters, with the same list of genres as in Discovery — including Anime and Teen Romance, to easily find what you already own.

## v1.19.23 — August 2026

### Release search failure for an original title in non-Latin script

A movie or series whose original TMDb title is written in Japanese, Chinese, Korean, Russian, Arabic, Thai... could no longer find any release to download: the automatic search always favored the original title, but no scene release is ever named in these scripts. It now falls back to the localized title (the one displayed in Movviz) as soon as the original title is not available for a search, for both movies and series.

### New settings welcome screen

The Settings page now opens on a welcome screen with an intent search ("missing movie", "slowness", "Plex"...), status cards (Plex, download client, metadata, storage), and shortcuts to the most used settings. The existing sidebar remains accessible as before from any setting — all `?tab=...` links already in circulation continue to work identically.

### The "Activity" page is now called "Downloads"

The menu already called this section "Downloads," but the page itself still displayed "Activity" / "Activity Center," and its address remained `/activity`. Both are now aligned: the page lives at `/downloads` and displays "Downloads" everywhere. The old address `/activity` now automatically redirects to the new one, with the active tab preserved—no existing link or bookmark breaks.

## v1.19.22 — August 2026

### Audio/subtitle track change: end of silent fallback to the old circuit

Fixes a serious regression in the new local playback engine: changing audio or subtitle language during playback caused it to fail and fall back to the old Plex/HLS circuit (badge "Transcoded (audio)", position reset to 0). Track switching now passes correctly through the new end-to-end engine, without any fallback. The "Transcoding mode" button (lightning bolt), which only controlled the old circuit and was no longer necessary, has been removed. Also fixes a case where an English audio track could display labeled as "French" in the menu (the label came from Plex, now overwritten by the actual file tags).

## v1.19.21 — August 2026

### Thumbs down everywhere, and really useful for suggestions

The thumbs down now appears on all cards (including the library, without ever removing the title from your collection) — clicking it only removes the card from the displayed row. It also passes the title's genre to the recommendation engine, which can now avoid similar titles in the future rather than just excluding that specific title.

## v1.19.20 — August 2026

### The "optimizing" overlay did not follow the actual start of playback

Fixes a regression introduced in 1.19.17: the full-screen overlay would close on a fixed 1.5s timer instead of following the actual start of playback, which could cause it to lift too early (before an audio switch was truly ready) or too late. It now closes exactly when playback actually starts—instant if no switch is necessary, or transcoded if a switch occurred.

## v1.19.19 — August 2026

### Selection of trailers and teasers revised according to context

The dashboard carousel and the title card's animated background now prioritize a teaser (short preview) over a full trailer, with automatic fallback if no teaser exists—the reverse for the voluntary "watch trailer" action on the card, which always prioritizes the full trailer. In both cases, the order respects the user's active language, then the film or series' original language, then the 4 other Movviz languages. The Android TV client benefits from the same selection on its own home carousel.

## v1.19.18 — August 2026

### Thumbs down on suggestions

An "not interested" button now appears next to the thumbs up on the "Recommended for you" and "Trending" rows on the dashboard: a click permanently excludes the title from future personalized recommendations and immediately removes it from the displayed row.

## v1.19.17 — August 2026

### End of "direct playback then audio switch" flash at startup

In direct playback, audio silence detection was done in the background while the video was already visible and audible to the user—when the sound proved incompatible, the direct launch followed by the switch to audio transcoding was visible on screen, with an unsightly flash. A full-screen overlay with the Movviz logo animation now masks the entire startup, until it confirms that the sound works (almost immediate confirmation in the normal case, up to 800ms in the rare case of a real silence to detect).

## v1.19.16 — August 2026

### Automatic benchmark now waits for the server to stabilize

Observed in real conditions just after deploying 1.19.14: the very first automatic benchmark run (just after an update) measured a result significantly lower than a second manual attempt moments later, on the same server — polluted by the server's startup load, not a true reflection of its capabilities. A short delay before automatic triggering now allows the server to stabilize first.

## v1.19.15 — August 2026

### Non-UTF-8 Subtitles (older French releases) finally reliable

A subtitle encoded in an old format (Windows-1252, common on older French releases) was crashing the image overlay and producing an empty subtitle file without visible error for extraction. Automatic detection of the correct encoding before processing — a file already correctly encoded (the vast majority today) is never touched.

## v1.19.14 — August 2026

### Server Benchmark, Manual Playback Selector Cleanup, and Several Background Fixes

- **Server Benchmark** (Settings → Performance): directly measures the actual transcoding speed of this server for representative cases (simple software, software with HDR→SDR conversion, hardware if available) — instead of discovering it during playback. Runs manually, automatically just after an update, and once a month via a scheduled task.
- **Corrected HDR Screen Detection**: the browser never reported its actual HDR capability to the server — corrected with real detection.
- **Manual "Transcoding Mode" Selector Cleaned**: these options (Audio only, Video only, Manual HLS) only controlled the old Plex circuit — when proposed on purely local content, they failed silently. They now only appear when a real Plex link exists.
- **Embedded Cover Art Never Confused with Main Video**: a file with an embedded cover image could, in rare cases, have this image analyzed as if it were the movie.
- **Shared Transcoding Session Limit** between the new engine and the old Plex circuit, instead of two independent limits that could accumulate.
- **Server Shutdown Cleanup**: active transcoding processes are now cleanly stopped during a restart/redeploy, instead of remaining orphaned.

## v1.19.13 — August 2026

### New Engine (Experimental): HDR/Dolby Vision no longer forces video transcoding

Background change rather than an extra setting: an HDR or Dolby Vision mismatch between the file and the playback device no longer triggers video transcoding by itself. The video is copied as is — an incompatible Dolby Vision decoder still displays the image correctly, just with a color rendition slightly less precise than the perfectly calibrated version. On modest hardware, avoiding costly video transcoding (often destined never to keep up with real-time playback) largely outweighs this rendering compromise. A real video transcode is still triggered normally for any actual incompatibility (codec, profile, layer, color depth, resolution) — in this case, the HDR→SDR conversion is still applied.

## v1.19.12 — August 2026

### New Engine (Experimental): HDR→SDR conversion remained too heavy even after 1.19.11

Measured live on the most demanding content possible (4K Dolby Vision), with no other load on the server: playback advanced at only about 30% of the required real speed, stably across several measurements — not just a slowdown at startup.

- **Fixed**: the resolution limit for the software encoding + HDR→SDR conversion combination increases from 1280 to 720 pixels wide. The HDR→SDR conversion itself (not the decoding, fixed regardless of output resolution) largely dominates the calculation time for this type of content — further reducing the target resolution directly reduces its cost. Remains to be confirmed in real conditions.

## v1.19.11 — August 2026

### New engine (experimental): faster encoding preset for the most demanding HDR→SDR case

Directly completes the 1.19.10 fix: asking the software encoder to optimize compression less (slightly larger file, in exchange for much less computation per frame) leaves it with real headroom to stay ahead of playback — applied only to the software encoding + HDR→SDR conversion combination, the only one that needed it; everything else (including simple software encoding without HDR) keeps exactly the same setting as before.

## v1.19.10 — August 2026

### New engine (experimental): the HDR→SDR conversion needed its own resolution limit

Third fix found while testing live on the production server, on even more demanding content (4K Dolby Vision): even after the two fixes in 1.19.08 and 1.19.09, this specific content still buffered without ever advancing.

- **Cause found and fixed**: the HDR to SDR conversion (necessary when the playback device cannot display HDR) adds a real extra computational cost, beyond simple encoding — confirmed by direct comparison with 4K content of equivalent resolution that did not require this conversion, which followed playback perfectly. The resolution limit for software encoding is now stricter specifically when an HDR→SDR conversion is also necessary, to give this more demanding case a real chance to stay ahead of playback in real time.

## v1.19.09 — August 2026

### New engine (experimental): the fallback target video followed live poorly on modest servers

Again found while testing for real in production, this time reported by actual viewing: on 4K content without a truly usable hardware encoder (see the 1.19.08 fix), the transcode would loop in the buffer every few seconds instead of following playback normally.

- **Cause found and fixed**: when no hardware encoder is actually available, the transcode target video format was chosen only based on what the playback device prefers to decode (often the most compressed, thus most expensive to produce) — without ever considering that the encoding would be done in software. However, a software encode of this format is significantly slower than a simpler format, to the point of failing to keep up with real-time playback on modest hardware. The server now chooses the simplest format to encode in software as soon as no hardware encoder is actually usable, while keeping the most efficient format available as soon as a real hardware encoder is available.

## v1.19.08 — August 2026

### New engine (experimental): critical fix, validated in real conditions

"Auto" mode activation tested for real on the production server (modest hardware, no dedicated graphics card) — the first movie (video + audio transcoded copy) worked perfectly, but a second one (4K HDR, full video transcode) failed immediately with a misleading message inviting opening in Plex, even though this movie has no Plex link.

- **Cause found and fixed**: the server relied on the list of video encoders compiled into ffmpeg to decide if it could use hardware acceleration — but a compiled encoder does not mean the corresponding hardware is actually present. On this server, an Intel QuickSync encoder was compiled but no compatible Intel chip was exposed, and the encoding attempt crashed immediately, with no fallback. The server now attempts a real micro-encoding check for each hardware acceleration family before trusting it, and switches to software encoding if this test actually fails.

## v1.19.07 — August 2026

### New engine (experimental): full audit and fundamental corrections

Following a systematic audit of transcode fundamentals (two dedicated passes, including a complete re-check of verifications against the original plan):

- **Video quality corrected on hardware encoder**: The quality setting (`-crf`) was silently ignored by all hardware encoders (NVENC/QuickSync/VAAPI/AMD), producing a very low fixed bitrate regardless of the resolution — verified live on real NVIDIA hardware, a 4K encode came out with the same quality as a minuscule encode. Each encoder family now uses its own actual quality setting.
- **Resolution ceiling for software encoding** (no hardware encoder available, typically a NAS): A 4K source is now downscaled to 1080p before software encoding, to remain capable of keeping up with real-time playback rather than risking falling behind.
- **More accurate scrubbing during transcoding**: A keyframe interval was missing, causing the scrubber to drop ~10 seconds back instead of the clicked position — corrected to 2 seconds.
- **Missing fonts for production subtitle embedding**: Image subtitles (PGS/VobSub, almost all BluRays) were making text invisible or crashing the transcode — the Docker image now installs the necessary fonts.
- **Refined browser capability detection**: Color depth (8/10 bits) and maximum decodable resolution are now precisely checked by codec, instead of being ignored due to missing data — an HDR 10-bit file that the browser cannot actually decode is now correctly identified as incompatible rather than being left in direct playback.
- **AC-3/E-AC-3 fix**: A track deemed compatible based solely on a technical signal not related to this engine could produce a silent stream — corrected to rely on the correct signal.

Remains noted for later (see `TODO_POST_READING_ENGINE.md`): Encoding of non-UTF-8 subtitles (old French releases), internal fallback cascade in case of failure during playback, detailed diagnostic panel.

## v1.19.06 — August 2026

### New engine (experimental) enabled by default for local content, and important audio fix

- The "New engine" is no longer limited to manual selection in Settings → Plex: in "Auto" mode (the default), it now automatically takes over for a local movie/episode (not linked to Plex) whose audio or video needs adapting — a case that previously had no functional fallback and failed systematically.
- Important fix: A 5.1/7.1 transcoded audio track was not downmixed to the correct number of channels — it was outputting as 5.1/7.1 even on a 2.0 audio output, with missing dialogue (the center channel, where dialogue is usually located, was not correctly downmixed to the left/right channels). A system not explicitly declaring more than 2 channels is now treated as stereo by default, and the audio is correctly downmixed to the right number of channels during transcoding.
- Fix: Seeking while a previous one was still in progress could, in rare cases, resolve out of order and play a stream corresponding to a position different from the displayed one — now, only the very last seek request can take effect.

## v1.19.05 — August 2026

### New engine (experimental): Improved HDR / Dolby Vision handling

- A Dolby Vision file whose base layer remains compatible with HDR10 (the vast majority of recent UHD BluRays) is now played directly, without unnecessary transcoding, even if the device does not explicitly declare Dolby Vision support.
- When no direct conversion is possible (Dolby Vision incompatible with HDR10, or HDR10/HLG on a device that doesn't declare it), the video is correctly converted to SDR during transcoding instead of being re-encoded with poorly interpreted raw HDR colors.
- Applies only to the "New engine (experimental)" introduced in v1.19.04 — default behavior unchanged.

## v1.19.04 — August 2026

### New reading engine (experimental, manual, local files)

- Settings → Plex → Beta player offers a new playback engine option, "New engine (experimental)" — never automatically activated, must be explicitly chosen. For a locally retrieved movie or series, it replaces/adapts the file via real technical analysis (ffprobe) instead of simple assumptions: container remuxing, audio adaptation, video transcoding with choice of hardware encoder if the server has one, and subtitle embedding when no other solution is possible.
- Fills a real gap: until now, a local file (not linked to Plex) whose audio was not readable by the browser had no fallback — playback would simply fail. This option corrects this specific case, without changing the default behavior.

## v1.19.03 — August 2026

### Extended technical analysis to series, and audio badge corrected for French language

- Technical analysis (ffprobe) now also covers series episodes, not just movies: Settings > Maintenance offers a dedicated section for series (same two buttons, usual analysis and full analysis), and a newly retrieved episode is automatically analyzed upon arrival, as was already the case for movies.
- Fix: for a file with multiple audio tracks (e.g., French in TrueHD, English in AAC), the audio codec badge could display the English track even if it was not the primary track — it now prioritizes the French track when it exists.

## v1.19.02 — August 2026

### Quality badges automatically corrected by technical analysis

- Once a movie is analyzed (ffprobe), its resolution/video codec/audio codec/HDR badges on the entry automatically correct themselves if they were wrong or missing — without ever erasing anything for an unanalyzed movie.
- Fixes a real bug found during testing: a 4K movie cropped for a cinematic ratio could be incorrectly classified as 1080p.

## v1.19.01 — August 2026

### Technical analysis: automatic upon movie retrieval, and "Full analysis" button

- A movie is technically analyzed (ffprobe) as soon as it is retrieved — no longer necessary to manually run the analysis for a newly downloaded movie to be covered.
- Settings > Maintenance now offers two buttons: the usual analysis (ignores what is already up to date) and a "Full analysis" that forces re-analysis of the entire catalog.

## v1.19.00 — August 2026

### Library technical analysis (ffprobe)

- New button in Settings > Maintenance: analyzes each movie via ffprobe (exact codec, profile, HDR/Dolby Vision, real audio tracks and subtitles) and caches the result per file — the first brick of the future playback engine, which can thus decide the best playback strategy without re-analyzing a known file.
- Runs in the background like other library analyses, with its own progress bar.

## v1.18.08 — August 2026

### Library: streamlined toolbar (Movies and Series)

- "Download" and "Upcoming" filters removed (redundant with the status badge displayed on each card).
- The automatic "plex" tag (applied to everything from a Plex sync, so never a truly useful filter) no longer appears in the tag list.
- The 3 admin actions (missing items search, disk reconciliation, search and replace) switch to compact icons with tooltips — the missing items search keeps its progress counter in a small badge.

## v1.18.07 — August 2026

### Fix: the dashboard hero would disappear randomly

- Cause identified in console: a trailer (YouTube player) could collide with the transition animation at the exact moment the hero unmounts, causing it to disappear until the page fully reloaded. It now reappears by itself a few moments later.
- Hardening fix: two missing fields in a suggestion's data (genres, reasons for choice) can no longer crash the hero.

## v1.18.06 — August 2026

### Sidebar: Collections no longer highlighted, Downloads moved

- "Collections" used to redirect to the Library before active highlighting was calculated — it is now properly enclosed once on the page.
- "Activity" renamed to "Downloads" and moved just below Collections.

## v1.18.05 — August 2026

### Fix: Action menu cut off on Library cards

- The "•••" menu (optimize, search, tags, delete) on Movie/Series cards could appear truncated — it lived in a container that masked any overflow. It now always displays in full.

## v1.18.04 — August 2026

### Sidebar reorganized

- Movies, Series, and Collections now each have their own direct entry in the menu (instead of being nested under "Library").
- "Search" renamed to "Torrent".
- New collapsible "Management" section grouping Requests, Activity, History, Trash, Issues, and Users.

## v1.18.03 — August 2026

### Library: complete redesign on the Discovery/Dashboard visual language

- Movie/Series cards in the Library now adopt the same card as Discovery and the Dashboard: true 16:9 visual with the title logo overlaid (instead of a vertical poster), and the enriched hover preview (year, duration, genres) instead of a simple banner.
- All existing actions remain accessible on hover via a compact menu: mark as seen, optimize, automatic search, manual search, tags, delete (admin) — nothing has been removed, just reorganized to remain minimalist.

## v1.18.02 — August 2026

### Library: same visual language as Discovery

- Discovery Genre menu: now closes on click outside or on the Escape key (it used to remain open).
- Library Movie/Series cards: more pronounced enlargement on hover and genre/duration banner, in the same spirit as Discovery — all existing actions (optimize, manual search, tags, delete) remain identical.

## v1.18.01 — August 2026

### Fix: Icon cut off in the mobile navigation bar on narrow screen

- On a phone with a narrower screen than average (e.g., Galaxy Z Flip6), the last icon in the bottom navigation bar overflowed off the screen, half invisible. The 5 icons now always distribute equally across the actual screen width, regardless of the device.

## v1.18.00 — August 2026

### Android smartphone — native player

- New native player (Media3/ExoPlayer) with background playback service — replaces the old embedded playback, lockable on-screen controls, and persistent media notification.

## v1.17.11 — August 2026

### Android smartphone — premium UX polish (40% Netflix / 60% TV)

- **Movviz mobile design system** : Void/Abyss palette + violet/magenta accents 80/20 (content remains the star), deep surfaces, controlled glass, unified TV tokens.
- **Floating capsule** : dark translucent bottom nav with subtle border, behind the content, spring animation on the active tab (icon + label), full respect for navigationBarsPadding — no more full-width Material bar.
- **Top bar** : transparent over content, progressive glass on scroll, content scrolls up behind.
- **Hero** : 62% viewport, edge-to-edge, double gradient (transparent top → deep bottom), logo/title, concise metadata, white "Play" CTA + glass actions [ + ] [ ⓘ ], soft fade-in of rows below.
- **Rails** : Netflix density — ~3 posters + peek of the next, LazyRow + peeking (end 12dp), tap scale 0.96 spring, titles 16sp bold, rating ★.
- **Search** : immediate field, 280ms debounce, leading/trailing icons, empty / no results states, dense results (poster 52×74 + title + year/type).
- **Profiles** : glass "Active Profile" card with gradient avatar and chevron, logout.
- No functional regression: backend, API, android-shared, auth, profiles, repository, Media3, Direct Play, fallback, subtitles reused as is.

## v1.17.10 — August 2026

### Android smartphone — first native base

- New Jetpack Compose touch client, separated from desktop and Android TV.
- Onboarding server connected to existing Movviz APIs, mobile navigation and
  shared layer for models, session, and network.
- Debug and release APK signed with the same retail key as the TV application.

## v1.17.08 — August 2026

### Desktop — card hover

- The calculated size of logos is reused between the card and its
  floating preview, for immediate display on hover.
- The hover intention delay is reduced without changing the behavior
  of links or play actions.

## v1.17.07 — August 2026

### Desktop — stable card logos

- TMDb logos are measured locally before display to appear
  directly at their final size, without scaling animation.
- Logo loading remains stable during scrolling and image
  errors no longer leave a card in an invisible state.

## v1.17.06 — August 2026

### Android TV — 10-foot redesign

- Navigation bar and hero section tightened to display more content upon arrival.
- 16:9 home cards with reuse of desktop editorial backgrounds and reliable poster fallback.
- Compact profile selector, controllable via D-pad, with profile preview and user addition.

## v1.17.05 — August 2026

### Visuals — TMDb logo priority

- For the French interface, logos are now sorted in the following order:
  France, neutral French, Canada, English. Other interfaces prioritize
  English. The visual cache re-selects old choices without
  deleting already downloaded images.

## v1.17.04 — August 2026

### Desktop — Card logo width

- Logos whose actually visible area is less than 40 % of the
  card width now reach this threshold, while strictly keeping
  their proportions. Logos that are already wider are never scaled down.

## v1.17.03 — August 2026

### Playback — Local source independent of Plex

- Fixes entries that displayed "Awaiting Plex sync"
  despite an already available local file. A finished Movviz movie or episode
  now immediately opens the player via its local source; the
  Plex link remains an asynchronous enrichment and no longer blocks playback.
- The player cleanly hides the "Play on Plex" link when no
  Plex URL is yet known.

## v1.17.02 — August 2026

### Desktop — Card logos

- Official logos surrounded by large transparent margins now gain
  up to 90 % of visual size. Already wide and
  tight logos remain at their natural scale, to maintain a
  clean hierarchy from one card to the next.

## v1.17.01 — August 2026

### Discovery — C411

- Corrects the C411 rows: each entry is again resolved by its
  complete TMDb sheet (poster, 16:9 background, title, and rating). If the identifier
  transmitted by C411 is missing, expired, or ambiguous, the title and year serve
  as a safe fallback instead of leaving a black card.

## v1.17.00 — August 2026

### Desktop — visuals, discovery, and playback

- Card visuals have three separate caches: all
  visual cache, only logos, or only backgrounds/posters. The
  title → image permanent associations are kept: completing the cache
  only restores the missing file, without re-downloading the other.
- The TMDb response cache increases to 35,000 entries so that a
  complete library is no longer prematurely evicted at the 3,500 key limit.
- Genres now have their own editorial hero, like Movies
  and Series. The hero is taller and correctly adapts 16:9 backgrounds.
- Transparent logos are scaled according to their visible area: small
  brands with large margins gain readability without enlarging the naturally
  wide logos. A card without a background uses at least its poster,
  instead of remaining empty.
- On an ultra-wide screen, the player preserves the video aspect ratio in full
  screen (sidebars if necessary). The cursor disappears with the
  controls after inactivity, and an explicit resume starts directly
  without a second popup; session offsets are converted from ms to s.
- All visible titles are now processed, cropped only into
  internal network packets: no global limit deprives the lower rows
  (Top, suggestions, recently added…) of their logos or backgrounds.
- "Resume" previews display the timestamped action and "Since the
  "start", with resolution, HDR, video, and audio badges from the actual file.

## v1.16.82 — August 2026

### Desktop — reliable playback

- Corrects the actual duration of fragmented FFmpeg streams: the player, the
  progress bar, seeking, and end threshold now use the
  Plex media duration, rather than the few seconds already buffered.
- Player controls collapse during playback and reappear
  on mouse movement, pause, buffering, or opening a
  menu. The image preview on the progress bar is retained.
- Full screen targets the Movviz container with the browser API: the same
  commands, real seek, and subtitles are therefore present, instead
  of switching to native video controls.

### Desktop — editorial cards

- The "Play Available Card" button now directly launches the
  Movviz player (movies, clips, and episodes), instead of reopening its details page.
- When a title does not have a neutral TMDb background, the cards use
  its localized 16:9 illustration and do not add a logo or title a second
  time. Empty choices from the old cache are automatically refreshed.

## v1.16.81 — August 2026

### Desktop — card preview

- Hovering no longer displays the "Info" button: clicking the image
  directly opens the Movviz details page. Actions adopt the
  Netflix language: play if the title is in the library, add if not,
  Like, and access the details page.
- Like immediately saves an explicit five-star rating.
- The preview then displays the year/duration badges, then up to three
  relevant genres, retrieved only on hover if the row does not have them.
- Visual calls explicitly request `fr-FR`; the choices cache
  of visuals migrates without erasing already downloaded backgrounds and logos.
- The background selection now favors a true 16:9 format, good
  resolution, and TMDb votes rather than a poorly framed or isolated visual.

### Desktop — scrolling stability

- Fixes the scrollbar that could disappear after closing
  a sheet or player: the overlays now share a scroll lock,
  compatible with their exit animations.
- The cache registry is shared among all Next bundles: the "hits / misses" counters, the TMDb cache, and its clearing action reflect
  the same instance after navigation or reboot.
  as of now.

## v1.16.80 — August 2026

### Visual cache — full incremental

- The incremental pass now runs persistently throughout the entire
  library, including already present titles: it checks the files
  local backdrop/logo and only re-downloads those that are missing. The display
  real-time of a map or a search result feeds the same cache.
- The API response cache capacity increases to 3,500 keys; Settings → Cache
  now displays the number used and its explicit limit.

## v1.16.79 — August 2026

### Desktop — editorial cards and image cache

- The editorial rows for Home, Movies, and Series now pass to large
  16:9 cards (300–360 px) with a proportional hover preview.
- Each card chooses a neutral TMDb backdrop, then applies the logo
  official; when no neutral background is available, Movviz keeps the
  title text instead of doubling a logo already printed in the image.
- Adds a persistent cache of backdrop/logo pairs, filled immediately
  from the Home, hero, and search. Immutable TMDb files are
  actually stored on disk by Movviz and for one year in the browser,
  without TMDb query by card.
- Settings → Cache adds "Complete cache" and "Refresh
  incrementally". A daily task only catches new
  titles, missing or rare network failures, without delaying the interface.
- Aligns web, Android TV, package lock, badge, and release metadata for
  `1.16.79`.

## v1.16.78 — August 2026

### Desktop — discovery, series, and playback

- The Home, Movies, and Series editorial cards now use
  real TMDb 16:9 backdrops, with the official title logo or a stable text
  title when no logo is available. A true absence of a backdrop
  displays a neutral Movviz card instead of cropping a vertical poster.
- Enhanced Home: hero with stable fallback after three seconds, intentional
  mixed rows, short formats, floating desktop hover, and removal
  of empty fake scroll indicators.
- Movies and Series have their dedicated catalogs, a hero specific to their type, and
  a Genre selector, while keeping the opening of the sheets in the
  single Movviz panel.
- Series sheets: seasons correctly downloadable, season 0
  hidden when it doesn't exist, direct launch of an available episode,
  button, and sequence to the next episode if it is present.
- Fixes the Auto Play path: a resume can start with FFmpeg,
  local files upload codecs/audio tracks/FFmpeg availability, and
  HLS Plex becomes the final fallback after a real failure — never a false
  "HLS Playback disabled" error.
- Aligns web, Android TV, package lock, badge, and release metadata for
  `1.16.78`.

## v1.16.77 — August 2026

### Desktop and Android TV

- Modernizes the desktop player: cinematic dock, persistent progress,
  unified menus and more readable intro/credits actions, without removing the
  Auto, Direct, audio/video transcoding, or HLS Plex modes.
- Prepares the desktop Home rows for 16:9 editorial cards and a
  floating hover, while keeping the vertical technical Library.
- Android TV: fixes D-pad focus returns, launches available episodes directly,
  and harmonizes focus, search, and playback states.
- Adds the versioned tracking plan for the desktop UX redesign.
- Aligns web, Android TV, and release metadata to `1.16.77`.

## v1.16.76 — August 2026

- Synchronizes web and Android TV for the next release.

## v1.16.75 — August 2026

### Release and local playback fixes

- Aligns Web, Android TV, and release metadata.
- Fixes `Range` HTTP suffix requests for local streaming.

## v1.16.73 — August 2026

### Android TV compilation fixes

- Fixes the Moshi annotation for the marker model.
- Adds the import for the `slideInVertically` animation used by the skip button.

## v1.16.72 — August 2026

### Movviz progress and multi-client resume backend

- Adds per-user backend storage, sessions, heartbeats, and protection against accidental seeks.
- Desktop and Android TV now use Movviz Playback sessions.
- Intro/credits markers from v1.16.71 remain served from the Movviz cache.
- Completion synchronizes the viewed status to Plex and enriches Continue Watching with Movviz resumes.

All notable changes to Movviz, grouped by development milestone.

---

## v1.16.71 — August 2026

### Plex Intro/Credits → Movviz → Android TV (Skip Intro / Credits)

**Architecture:** `Plex → sync Movviz (cfg.adminToken) → playback-markers.json → /api/stream/{ratingKey}/info → Android TV → ExoPlayer → context button`. No Plex requests on playback start, no Plex token on TV side.

**Backend:**
- New generic `PlaybackMarker` model (intro/credits) and `playback-markers.json` store (O(1) lookup by ratingKey, version 1, migration, readJsonCached/writeJsonCached).
- New state `plex-marker-sync-state.json` (dirty, knownUpdatedAt, emptyRetry 7d, auditBucket 0..6).
- Internal plex raw type `PlexMarker`, extension `PlexServerConfig.markerSyncEnabled` (default false, never exposed client-side).
- `batchMarkers(cfg,cfg.adminToken,ratingKeys)` chunks 50, `includeMarkers=1`, distinction error ≠ zero marker (Plex failure never deletes local data).
- Normalization (intro/credits only, validation, ASC sort), deterministic SHA16 signature, preservation of multi-block credits (mid/post-credit not merged).
- `markerSync.ts` engine: incr (dirty + never-sync + expired retries + today's audit bucket), full (all plexRatingKey Movviz), retry 7d, stableHash%7 rotating audit, GC only if full complete, real progression, yieldToUser between batches, lean logs, withKeyLock + sourceId `plex-marker-sync`.
- Hooks `registerMarkerCandidate` in `librarySync` (movies + every episode), library decoupling 5min → marker 24h.
- Daily scheduled task `plex-marker-sync` (24h, check markerSyncEnabled), mapping JobType `plexMarkerSync` + priorities.
- Route `POST /api/plex/marker-sync` (admin, enqueueJob sourceId, immediate queued/jobId return) + `GET` stats, `GET /api/plex/config` and extended `PUT` (markerSyncEnabled, no token ever).

**Desktop Settings > Plex:** Intro and credits section (toggle ON/OFF, dates, counters, incremental/full buttons, polling jobRunning via /api/plex/marker-sync + /api/jobs).

**Playback API:** `GET /api/stream/{ratingKey}/info` injects `markers[]` from local store (try/catch → [] if unavailable).

**Android TV:**
- `PlaybackMarkerDto` + `StreamInfoDto.markers` (emptyList default, compatible with old backend).
- `PlayerActivity`: loads markers via streamInfo, detects activeMarker every 500ms, labels Skip Intro/Credits, seekTo(endMs) without consumed state, resume/seek/fallback/palette unchanged.
- Conditional D-pad focus, unified PlaybackActionOverlay (Skip above Up Next), 150-250ms glass visual.

---

## v1.16.70 — August 2026

### Android TV: Gear icon settings

- The text tab "Settings" leaves the nav bar: a **gear icon** (drawn, same style as the magnifying glass) takes its place between the search magnifying glass and the profile avatar. White focus border (brand gradient when the tab is active).

---

## v1.16.69 — August 2026

### Android TV: End of auto-scroll on opening, seasons race condition corrected

#### Auto-scroll on opening details (requested live)
- MINIMAL scroll spec (mobile behavior) on title and actor details, instead of the TV pivot (~30% of the edge) which used to scroll the detail automatically as soon as the initial focus landed on the CTA. Scrolling now only occurs if the targeted element is actually out of view (seasons/episodes further down).

#### Seasons from another series displayed ("the season is not that of the selected series")
- **Race condition**: opening series A then B quickly returned both requests in a random order — A's seasons overwrote B's. Added guard: the response is only written if the requested series is still the current one.
- **Cache season key by series**: the old key by season number only served season 1 of the first open series to the next. Now key "tmdbId-season".

---

## v1.16.68 — August 2026

### Android TV: hero like title card, D-pad top anchor, cleaned up filmography

#### Hero Home/Movies/Series = same composition as the card
- TMDb logo at fixed height 118dp (`ContentScale.FillHeight`): small logos (~30px, unreadable from the couch) become Netflix-style title-art.
- Library status badge under the logo (same badge as the card: Searching…/Downloading/Missing) — "Available" remains implicit.
- Unified meta line ★ rating · year · duration · genres inline (chips used to take up an entire row for nothing).
- Removal of the unsightly black gradient behind the synopsis — the hero scrim is enough.
- Content column anchored to the bottom edge of the backdrop (the "Read" CTA was no longer cut off under the image).
- Remaining glyphs replaced by vector icons: ▶ on "Read", "i" badge on "More info".

#### D-pad top anchor (Home + Movies + Series)
- Invisible 1dp anchor at the very top of each screen: UP from the hero CTA lands there first — bringIntoView scrolls to offset 0 (entire carousel becomes visible under the bar), then a second UP joins the NavRail. No more half-hidden carousel behind it.

#### Cleaned up actor filmography
- Filtering of talk shows and ceremonies (Saturday Night Live, Tonight Show, Late Night/Show, Graham Norton, Kelly Clarkson, Jimmy Kimmel, Ellen, Golden Globes, Oscars, MTV/Critics'/People's Choice Awards, GMA, Today Show, Conan, red carpet…) — requested live: "I'm tired of seeing late nights".

#### Miscellaneous
- CatalogScreen migrated TvLazyColumn → standard LazyColumn (consistency with home).

---

## v1.16.67 — August 2026

### Android TV: reactive download status on the card, focusRestorer, D-pad anchor

#### Title card: live download (Netflix pattern)
- **Reactive status badge**: "Downloading"/"Searching…" during activity (polling file 3s), actual library status otherwise (Available/Downloading/Missing via statusTone) — never a frozen "In library" during a download.
- **Progress pill** `DownloadProgressPill`: percentage + speed + remaining time ("Downloading 42% · 6.1 MB/s · 12 min remaining") with progress bar in the pill itself.
- **Automatic switch to "Read"** at the end of the download: accelerated library refresh at 4s as long as a torrent is active — zero user action, zero app breathing room.
- Missing TMDb rating (0) → no more misleading "★ 0.0" on the card.

#### D-pad Navigation
- **`focusRestorer()` on all rows** (Google official doc): each row remembers its focused card — focus returns to the correct poster after returning from a sheet and when navigating vertically.
- **Migration TvLazy\* → Lazy\*** standard (TvLazyColumn/TvLazyRow deprecated).
- **Fallback anchor excluded from directional search** (`FocusRequester.Cancel` ×4): it is geometrically above all content — moveFocus(Up) from the hero landed on it (invisible) instead of moving up in the NavRail.
- Hero star → vector icon (the glyph ★ does not exist in Inter).

---

## v1.16.66 — August 2026

### Android TV: massive UTF-8 repair, vector icons, D-pad symmetry

#### UTF-8 / mojibake (The bug of broken accents and symbols)
- **510 mojibake sequences repaired** (UTF-8 reinterpreted CP1252 then re-encoded): "Ã©cran" → "écran", "â˜…" → ★, "TÃ©lÃ©chargement" → "Téléchargement", "Â·" → "·"… in HomeScreen.kt, CatalogScreen.kt and UpdateManager.kt.
- Root cause: file writes in Get-Content/Set-Content without explicit encoding during previous sessions.

#### Vector icons (end of empty squares on Google TV)
- New `MovvizIcons.kt`: 13 hand-drawn icons in ImageVector (play, pause, skip prev/next, rewind/forward, musical note, check, star, plus, download, swap, dot-circle, replay) — the Unicode glyphs ▶ ❚❚ ⏮ ⏭ ♪ ★ ✓ ↓ ⇄ ◉ ↻ do not exist in Inter and caused system/square fallbacks.
- Replaced everywhere: player controls (PlayerActivity), title sheet CTA ("Play", "Resume", "Download season", "Add"), star rating badges (RatingBadge, title sheet), "Seen" pill, watched episode check, NavRail profile menu, Plex button on login.
- `ControlButton` now accepts vector icon or text label ("CC").

#### D-pad Navigation — UP/DOWN symmetry
- **Fix for "UP moves up but DOWN no longer moves down"**: the old handler consumed ALL UP from any depth → impossible to move between rows, every UP jumped to the nav bar.
- MainScreen/title sheets/actor: UP first tries `moveFocus(Up)` (internal move up row N−1), switches to the active NavRail tab only at the top of the content.
- NavRail: DOWN tries the precise target, then the geometric fallback `moveFocus(Down)` (works even on loading screen), then the fallback anchor.
- Fallback anchor hoisted to NavHost level (only existed on home — down arrow dead during sheet loading), now **drawn** when it gains focus (small white dot) so it never looks like a frozen screen.
- **Correction of the `.getOrDefault(false)` pattern on `requestFocus()`**: the method returns void in compose-ui 1.7.6 (verified on javap), the actual success test is `.isSuccess` — the old code evaluated `(Unit == true)` = always false.

---

## v1.16.65 — August 2026

### Android TV: version bump for test build

#### Notes
- Version bump for test build on Google TV.
- No code changes — same content as v1.16.64.

---

## v1.16.64 — August 2026

### Android TV: polished premium visual + toggle auto-update + crash fixes

#### Stability (8 crash vectors corrected)
- Staggered HomeScreen network calls (+200ms between each) — end of parallel flood on startup.
- GitHub check delay of 5s — no longer blocks the first frame.
- Ambient trailer disabled on devices < 4GB RAM — end of Chromium/SwiftShader crash.
- Hero backdrop preload reduced from 2 to 1 image — less memory pressure.
- Coil memory cache reduced from 20% to 10% of the heap.
- `createFilmGrain()` optimized with `setPixels()` batch instead of 32k `setPixel()` calls.
- OkHttp timeouts reduced: connect 5s, read 15s, callTimeout 20s.
- Hero logos loaded in batch sequentially (+100ms) instead of 5 coroutines in parallel.

#### Premium visual (45 fixes)
- Card shape 8dp → 12dp (TV consistent).
- displayLarge ExtraBold → Bold (less blobby at 10 feet).
- MovvizDown softened (#FF5B78 → #E87C7C).
- MovvizCyan softened (#34E2FF → #5CE0D8).
- Orbit dots AnimatedLogo 6dp → 8dp.
- Wordmark flow slowed from 5s → 8s.
- Profile popup NavRail expanded from 300dp → 320dp.
- Menu separator NavRail padding 10dp → 16dp.
- Hero left scrim 70% → 45%.
- Hero bottom gradient softened (reduced banding).
- Genre chips hero 12sp → 14sp.
- Download card border 3dp → 2dp.
- Row heading bottom padding 16dp → 20dp.
- Season chip shape 9dp → 12dp.
- Episode number 22sp Light → 16sp Medium.
- Cast photos 72dp → 84dp, names 12sp → 14sp.
- Settings section titles MovvizBrand → MovvizInkSoft.
- Settings panel 72% → 78% width.
- InfoRow labels 12sp → 14sp, width 160dp → 180dp.
- Error screen player: white title instead of red, overlay 85% → 72%.
- Buffering spinner thickness 14% → 18%.
- Progress bar update pill shape (50 radius).
- Empty state catalogue padding top 24dp → 48dp.

#### Features
- Toggle « Auto-update ON/OFF » in Settings → About (persisted via DataStore).
- Touch click activated on profile selection screen (tvPointerClick).

---

## v1.16.62 — August 2026

### Android TV: Netflix premium quality redesign

#### Typography and design system
- Embedded Inter font (5 weights: Regular → ExtraBold) — same typographic direction as Netflix and Apple TV.
- Unified typography tokens: displayLarge (40sp), headlineMedium (24sp), titleLarge (20sp), titleMedium (16sp), bodyLarge (16sp), bodyMedium (14sp), labelLarge (14sp), labelSmall (12sp).
- `MovvizCardShape` (12dp) — unique radius for all content cards, consistent everywhere.
- Existing `tvFocusLift` preserved — spring + GPU-only shadow (graphicsLayer), zero recomposition during animation.

#### Home (HomeScreen)
- Category rows with title above (titleLarge style), Netflix peaking (negative end padding).
- Poster cards: 2:3 ratio, 2dp white alpha 90% focus border visible from the couch.
- Netflix call-out: synopsis + metadata at the bottom of the row on focus, AnimatedVisibility with debounce for zero flickering.
- Directional preloading: the next 2 images after the focused card are preloaded via Coil (zero pop-in).
- Stable keys + contentType on all lists.
- Hero: Ken Burns (zoom 1.0→1.05 over 20s), cinematic grain (native BitmapShader), luminance-adaptive scrim, official TMDb logo, animated text, AmbientTrailer via WebView pool, preloading of the next 2 backdrops.

#### Title Detail Screen (TitleDetailScreen)
- Parallax backdrop (graphicsLayer translationY), official logo, CTA, seasons/episodes with stable keys.
- French error messages (friendlyAddError) instead of raw English.
- Episode stills w780, backdrops w1280.

#### Video Player (PlayerActivity)
- Centered seek indicator "+10s" / "−10s" with fadeIn/fadeOut.
- "Next Episode" panel at the end of an episode (position > duration − 45s) with countdown and D-pad focus.
- Auto-hide overlay 5s, animated progress bar, buffered spinner.
- Error screen with technical details (codec, resolution) readable from the couch.
- Typography and theme tokens on all controls.

#### D-pad Navigation
- DOWN from NavRail → content: interception via onPreviewKeyEvent (before child Surfaces).
- UP from content → NavRail: interception via onKeyEvent (after LazyColumn).
- Focus restoration upon returning from a detail sheet (delay 300ms + navRailFocusRequester).
- Fallback focus (1dp invisible always focusable) — no lost focus cases.

#### Performance
- Polling file download: 4s → 8s (reduces network traffic).
- largeHeap on Android Manifest.
- TMDb: retry 3 attempts with backoff (300ms, 800ms) — fewer false "movie not found" on transient network disconnection.

#### Fixes
- "Add to Library" button: no more false TMDb failures (server retry + readable error message).
- Search: `fieldFocused` variable and `TMDB_POSTER_BASE` constant corrected.

## v1.16.60 — August 2026

### Dashboard: a broken carousel card no longer blocks the entire screen

- A movie or series with unexpected data could crash the entire dashboard ("Server Error", entire screen blocked) instead of just failing to display. Each carousel card (and the hero thumbnail) is now isolated: if one crashes, it disappears discreetly, and the rest of the dashboard continues to function normally.

## v1.16.59 — August 2026

### Fix: server error on dashboard for non-admin accounts

- The new setting added in v1.16.56 for the "Available Upgrades" row was read via a route reserved for admins — any non-admin account opening the dashboard would receive an access denied on this request. Reading is now open to any logged-in account (writing remains admin only, as before).

## v1.16.58 — August 2026

### Android TV: Home loading screen, true visual identity

- The text "Loading your library…" is replaced by the animated Movviz logo (the same as login/settings) on the very first launch, before the library has loaded. This logo also serves as a true visible focus target for the down arrow — the invisible fallback anchor is no longer invoked in this specific case, it remains in place for other edge cases.

## v1.16.57 — August 2026

### Fix: The new "Dashboard upgrade suggestions" button was not saving

- The button added in v1.16.56 never persisted its state — the settings save route ignored this specific field, always reverting to its original value.

## v1.16.56 — August 2026

### Settings > Quality: disable dashboard upgrade analysis

- New button in Settings > Quality to disable the analysis that feeds the "Available upgrades" row on the dashboard — this analysis could seriously slow down display on a large library. Distinct from the existing automatic upgrade button (which handles background automatic replacement): this only cuts the display scan, without affecting the rest.

## v1.16.55 — August 2026

### Android TV: down arrow from the menu — real fix

- The previous fix eliminated unexpected closures but rendered the down arrow inoperable during normal use (it systematically targeted an invisible anchor instead of the actual content). Restores direct scrolling to the first real item on the screen when one exists, with the fallback anchor only in reserve — never a crash, never a down arrow with no effect.
- New README, complete redesign.

## v1.16.54 — August 2026

### Control version for automatic update verification

## v1.16.53 — August 2026

### Android TV: manual update check

- Adds a "Check for updates" button in Settings → About — until now, the check only triggered once at launch, with no way to re-run it or see what was happening without restarting the entire application.

## v1.16.52 — August 2026

### Android TV: playback — more reliable audio-only fallback

- The "audio-only" fallback systematically went through Plex transcoding, which can silently refuse to copy the video for certain sources (HEVC notably) and then re-encode both instead of just the audio. Now prioritizes the local server remux when available (already used by the desktop client) — guaranteed video copy, only the audio is re-encoded.

## v1.16.51 — August 2026

### Android TV: update loop, unexpected crashes on remote

- Automatic update that would restart indefinitely: the system requires an installation confirmation screen starting from Android 12, never handled until now — the application believed the installation was successful when it was actually stuck waiting forever. Fixed and verified in real conditions (version number advances correctly afterward).
- Unexpected application crashes when pressing the down arrow on the remote — more frequent on slower boxes (e.g., Chromecast 4K): the navigation target could point to a screen element that had not yet loaded. Made systematically safe, regardless of the screen's loading state.

## v1.16.50 — August 2026

### Android TV: adding user to household, missing admin profile

- "Add user" from the profile screen did not respond to the remote — the add mode login screen never requested D-pad focus (even a defect already fixed elsewhere, repeated here without a safety net).
- The admin account that performs the initial link was never visible in "Who is it?" unless manually added to its own household — now automatically added upon first access, like the owner account always is in the first profile on Netflix/Plex.

## v1.16.49 — August 2026

### Android TV: update blocked by remote

- The auto-update overlay never captured D-pad focus: the "Allow" button remained unreachable and the remote continued to control the hidden menu below — probable cause of unexpected application crashes during updates. Fixed.

## v1.16.48 — August 2026

### Test auto-update version

- No functional change: version bump only, to validate the auto-update flow in a real-world scenario (check GitHub on launch → download `Movviz-Android-TV-client.apk` → SHA-256 verification → install over existing).

## v1.16.47 — August 2026

### Single APK: "Movviz TV"

- The `retail` variant (without auto-update) is **removed**: there is now only one APK, the application is now called **Movviz TV** and updates itself via GitHub on launch.
- The `applicationId` `com.movviz.tv.au` is kept: existing installations and auto-updates continue to replace each other cleanly (same package = update, not a 2nd app).
- The CI workflow now only publishes one asset: `Movviz-Android-TV-client.apk`.
- New: a **TvProvider** string "Movviz" on the Android TV dashboard — the "Continue Watching" row on the launcher displays the active account's current titles (like Plex/Netflix, without any partnership), and a deep link `movviz://title/{type}/{tmdbId}` is declared to open the title's page.
- **Google TV**: the media session now feeds the "Continue Watching" row on the Google TV launcher — MediaItems carry real metadata (title, episode subtitle, TMDb poster) and a session activity is declared (clicking the card reopens the app).

## v1.16.46 — August 2026

### Android TV: Player prevents screen sleep during playback

- The anti-sleep window flag is now set for the entire life of the playback Activity (not just during active ExoPlayer playback): a re-buffering on a remote server no longer lets the Android TV fall asleep in the middle of a movie.
- Addition of an active media session (media3-session): the system knows that media is currently playing, like Netflix — it no longer puts the box to sleep and displays the title in the system interface.

## v1.16.45 — August 2026

### Android TV: Audio-only fallback in DASH for all codecs

- The "audio-only" fallback (video copied in bitstream, audio re-encoded) now uses DASH regardless of the source codec, including h264 — consistent with the web player and with Plex Web's own behavior, and fMP4/DASH offers ExoPlayer a more precise byte-range seeking than HLS-TS by segments.

## v1.16.44 — August 2026

### Android TV: Real hardware compatibility check

- Device compatibility is never assumed: before each playback, the app queries the codecs REALY declared by the device (MediaCodecList, the same API ExoPlayer uses for decoding) and chooses the playback mode accordingly — a device that decodes DTS/TrueHD/E-AC3 plays in direct-play, another that doesn't switches to audio-only fallback (video copied, never re-encoded). The decision and its reason are logged in logcat (`Pre-decision v=… a=… → level …`).
- Correction: audio-only fallback is served in HLS for h264 sources — the player incorrectly announced a DASH manifest and playback failed on startup.
- New: Actor/actress page — A title's distribution leads to the person's complete filmography, with navigation by cards to each title. The NavRail remains visible on the pages (title and actor) to change tabs without returning to the home screen.

## v1.16.43 — August 2026

### Android TV: Optimized playback — end of unnecessary video transcoding

- A title whose video is decodable by the device but whose audio track is not (DTS/DTS-HD/TrueHD/E-AC3 depending on the device) triggered the entire fallback chain and ended in video+audio transcoding on the server, even though only the audio was problematic. The player now probes the title's actual codecs (streamInfo) AND the device's actual decoders before starting:
  - video not decodable by THIS device (AV1, VP9…) → full transcode directly, without two errors on screen;
  - audio undecodable by this box but video OK → immediate "audio only" fallback: the video is copied in bitstream (never re-encoded), only the sound passes in AAC;
  - the audio only fallback uses HLS for h264 sources (most robust for ExoPlayer) and DASH for HEVC/AV1/VP9 (the only format where Plex honors bitstream copy).
- "Continue Watching" on a series: the current episode's details (season, number, title, synopsis) automatically open upon arrival on the title — the user no longer has to search for it in the seasons list.

## v1.16.42 — August 2026

### Android TV: automatic update and remote navigation

- Auto-update: installation failed silently on every attempt (session refused by the system — a data stream never closed before validation). Fixed and verified in real-world conditions.
- Remote: from the top navigation bar, the down arrow never led to the content below, on any tab — the system spontaneously found no target between the two. Explicit target set so that the down arrow works everywhere (Home, Movies, Shows, Search, Settings).

## v1.16.41 — August 2026

### Android TV: library and series playback resume

- The "Add to Library" button no longer displayed the correct status (downloading, etc.) right after adding — it could revert to "Add" due to too fast a refresh. New automatic attempts.
- "Continue Watching" on a series now directly opens the current episode (correct season, resume CTA with episode number and title) instead of always defaulting to season 1 like a movie.

## v1.16.40 — August 2026

### Android TV: fixes reported on real box

- Realigns the version number everywhere (`package.json`, README badge, Android TV app's `versionCode`/`versionName`) — the drift between these sources caused some updates to fail.
- Fixes a crash when compiling the profile screen ("Who is it?") left by unfinished work.
- Search: removes the "Open Details" banner that appeared under the focused cards — being on a card and confirming now opens the details directly, like everywhere else.
- Settings and Search: removes the opaque bar that remained above the content, already removed from the Home and Movies/Shows catalogs.

## v1.16.33 — August 2026

### Android TV: profile screen — active profile name, addition via login, duplicates detected

- **Active profile name everywhere**: upon restarting on a persistent session, the menu header (user badge) displayed "—" and the avatar "? " — the active profile is now restored as soon as the session is verified.
- **"My Profile" and "Change User"** lead to the profile screen ("Who is it?"): active profile at the top (always visible, even off-premises), household members, and "+" tile — no more direct redirection to login.
- **Add User = login**: the "+" tile opens the login with the account to be added (dedicated subtitle); after logging in, the account joins the household and the profile screen is displayed with confirmation.
- **Account already present detected**: logging in with an account already in the household does not create a duplicate — message "This account is already in the household".

## v1.16.32 — August 2026

### Profile isolation refined: everyone keeps THEIR views, nothing mixes

- **Fix for 1.16.31**: imported friend accounts have their own Plex accounts (the admin only performs one import into Users, nothing else) — they must therefore retrieve **their** history, their resumes, and their preferences, not remain empty.
- **Data leak guard** : Plex may return the server history (the linked account's) instead of the requested account's. The fingerprint (movies + episodes) of each history is compared to that of the linked account: identical $\rightarrow$ write refusal + contaminated previous data cleared; different $\rightarrow$ it is indeed theirs, normal synchronization. No profile activity leaks to another, and no profile is deprived of its true data.

## v1.16.31 — August 2026

### Hermetic profiles + extended AI memory + context reset

- **Hermetic barrier between profiles (major fix)** : The AI context of each imported friend displayed the linked account's activity (294 movies watched, The Simpsons 714 eps…). Plex now returns the server history for friend accounts, regardless of the requested account — the history is now only synchronized for the authenticated account with its own token; all other profiles (friends, Home) remain strictly empty, and contaminated data is detected and cleared. Each profile only has its own views — its own, never another's.
- **Continuous conversational memory** : Every message discussed with the assistant (tastes, grievances, preferences, habits, first name…) is extracted and memorized in parallel with the response (no added latency), beyond just the markers the model previously emitted. Retained facts ceiling raised from 30 to 100.
- **"Reset Context" button** in Profile, next to "Create Context" : Two-click confirmation, the learned context is erased (votes and ratings are kept).

## v1.16.30 — August 2026

### Android TV: auto-update repaired (installation failure)

- Installation failed silently at `commit()`: On Android 15+, the status receiver must come from a **mutable** PendingIntent — `FLAG_IMMUTABLE` caused `IllegalArgumentException` and the session was abandoned (the app remained on the old version after the loading bar).
- The commit PendingIntent is now `FLAG_MUTABLE`: the update applies and the app restarts automatically on the new version.

## v1.16.29 — August 2026

### Android TV: series page — end of flickering and forced return to season 1

- Periodic refreshing of the page (3 s) cleared seasons before reloading them: the screen flickered and the D-pad selection was reset (returned to season 1 after each poll).
- Seasons are no longer cleared except upon a SERIES CHANGE; a simple refresh keeps the display in place.
- The default season is now only selected upon opening the page: a refresh no longer overwrites the user's choice.

## v1.16.28 — August 2026

### Android TV: reworked profile menu + navigation

- Profile menu with Movviz colors (deep dark background, subtle border, clear focus, brand gradient) with an "Active Profile" header (avatar + name).
- Fixes "Change User" click: menu items did not respond to pointer clicks (missing `tvPointerClick`) — mouse/remote control click now works everywhere.
- Removes the "Search" tab from the navigation bar: the magnifying glass already exists and opens search from the home screen.

## v1.16.27 — August 2026

### Android TV: auto-update fixes

- Fixes installation: `fsync(OutputStream)` now closes the stream itself on API 35 — the extra `close()` abandoned the session and the APK never installed (the app seemed to "close" after updating).
- Fixes "Allow" button crash (opening unknown sources settings without `FLAG_ACTIVITY_NEW_TASK` — AndroidRuntimeException on application context).
- Adds logs (`MovvizUpdate`) to track automatic installation and restart.

## v1.16.26 — August 2026

### Android TV: Netflix style profile menu

- Replaces the text "MOVVIZ TV" in the top right corner with the active profile's avatar, always visible.
- On click: Netflix-style menu with "Change User" (→ "Who is it?" screen: choice of a household profile or adding a member), household profiles in shortcut and "+ Add user".
- A guest account that chooses "Change User" goes through the login (it has no household).

## v1.16.25 — August 2026

### Android TV: improved auto-update

- Installation is now done in the background (PackageInstaller session API): no more system screen that "closes" the app — it remains displayed with a loading bar during installation, then the application automatically restarts on the new version (receiver `MY_PACKAGE_REPLACED`).
- Removes the system installer `ACTION_VIEW` (FileProvider is no longer necessary for this flow).

### Android TV: catalog black bar

- Fixes the black bar above the Films and Séries tabs hero: the content now passes under the glass navigation bar like on Home (the 80 dp `padding` is only kept for Search and Settings).

## v1.16.24 — August 2026

### Android TV: server-side profile household

- Household profiles are now stored on the server (`/api/tv-profiles`), not just on the device: a freshly installed APK no longer shows the local profiles of the previous device.
- 100% admin household management: only the admin can see the list of accounts and can add/remove a member (choice from existing accounts, no password). A guest account logging in from an APK never sees the household and cannot add anything to it.
- The "Add member to household" screen replaces the login to populate the household from the selector and the navigation menu.
- Sessions remain local to each device (separated by server and account).

### Android TV: catalog header

- Removes the black title banner above the Films and Séries tabs hero: the hero now starts right at the top, like on Home.

## v1.16.23 — August 2026

### Android TV: playback

- Adds the missing Media3 DASH module to prevent crashing when playback is paused.

## v1.16.22 — August 2026

### Android TV: profile compilation

- Fixes the server host resolution used to save and restore profile sessions.

## v1.16.21 — August 2026

### Android TV: profile menu fixes

- Fixes the retail/AU compilation of the profile selector and menu.
- Keeps separate sessions and synchronized avatars.

## v1.16.20 — August 2026

### Android TV: synchronized profiles

- Adds profile selector on startup after server selection.
- Reuses existing Movviz accounts, their Plex avatars, and their persistent sessions.
- Adds profile addition and profile switching from the TV menu.
- No kids profile or special rights are introduced.

## v1.16.19 — August 2026

### Android TV: auto-update without store (AU variant)

- New **AU** ("auto-update") APK variant alongside the retail one: on launch, it queries public Movviz GitHub releases, compares the version, and displays "Updating, please wait…" with a progress bar during download.
- SHA-256 verified against the digest published on GitHub before installation — a corrupted or tampered file is never installed.
- Installation via system installer (FileProvider); "unknown sources" permission managed on first launch, automatic resumption upon returning from settings.
- The retail version remains without auto-update; both APKs share the same signature — the AU updates over it without data loss.
- CI now publishes both APKs (`Movviz-Android-TV-client-retail.apk` and `Movviz-Android-TV-client-AU.apk`) on every release.

## v1.16.18 — August 2026

### Android TV: 3-level playback — direct > ffmpeg audio only > HLS

- Direct playback (raw bytes) as long as ExoPlayer decodes everything natively — no transcoding.
- If a format is not decodable (often audio: DTS/AC3/TrueHD), it switches to audio-only transcoding: the video is copied in bitstream (x264/x265 are never re-encoded) and only the audio is re-encoded to aac, via DASH (the only format where Plex honors bitstream copy, including HEVC).
- If the copied video is still not decodable (AV1 for example), last resort: full h264/aac transcoding served in HLS.
- Each level is attempted only once per item, resuming at the same position, no looping.

## v1.16.17 — August 2026

### Navigation in the title panel

- From the panel, any click on a similar title, actor, or collection updates the panel instead of opening an entire page.
- Actor and collection views now strictly share the same component as their dedicated pages (`PersonContent`, `CollectionContent`) — no dedicated variant for the panel.

### Android TV: carousels by type

- The Movies carousel now only displays movies.
- The Series carousel now only displays series.
- The mixed carousel on the general home screen remains unchanged.

## v1.16.15 — August 2026

### Android TV: enriched catalog and smoother playback

- Reuses existing editorial rows from the dashboard (`/api/metadata/rows`) on Home, Movies, and Series.
- Adds a shared 1.5 GB Media3 video cache and an expanded playback buffer to limit reloading.
- Keeps Media3 audio and subtitle tracks as well as the existing transcoding fallback.

## v1.16.14 — August 2026

### Android TV: Retail version and Plex connection

- Fixes the startup crash of the minified release and tolerates old Plex accounts without a `status` field.
- Keeps the local retail key out of the repository and allows builds without a keystore to function without exposing a secret.

## v1.16.13 — August 2026

### Android TV: Plex linking diagnostics

- Now displays the error returned by the server during Plex PIN polling (`no_plex_access`, inaccessible Plex account, etc.) instead of a generic message.
- Keeps the desktop stream unchanged.

## v1.16.12 — August 2026

### Android TV: Title logos

- Fixes a systematic offset that pushed the movie or series logo off-screen to the left, on the home screen as well as on the title page, for any logo that did not have the same margin as the one used to calibrate the setting.
- Fixes the active menu button ("Home") which became an unreadable opaque white block as soon as it retained focus from the remote control.

## v1.16.11 — August 2026

### Android TV Versioning

- Finally aligns the native Android TV APK version with the published Movviz version (`1.16.11`) and increments its `versionCode`.

## v1.16.10 — August 2026

### Android TV: Plex linking

- Explicitly allows the new TV PIN route in the authentication proxy so that the emulator and Android TV devices can call it without a session.

## v1.16.9 — August 2026

### Android TV: Plex linking

- Adds a dedicated route for the Plex short code for TV devices, without modifying the existing Plex desktop stream.
- Android TV displays and uses the short linking PIN via `plex.tv/link`.
- The discreet server change link cleanly erases the local configuration before returning to the assistant.

## v1.16.8 — August 2026

### Desktop chat: Continuity and taste

- Explicit notes given in conversation are now saved without depending on a model marker; a note on an entire universe remains a global preference, without being reduced to a single movie.
- After a recommendation offer, "ok", "go", or "give" continues the selection and can no longer be interpreted as a title to search for.
- If the model announces a selection without returning cards, Movviz requests a structured recommendation response again.

## v1.16.7 — August 2026

### Android TV: Movviz visual identity

- The animated TV mark uses the exact geometries of the Lucide `Clapperboard` icon used on the desktop, via a native VectorDrawable.
- Multi-colored violet, magenta, and cyan aurora halo reinforced around the animated logo like a static tile, without changing the TV navigation.

## v1.16.6 — August 2026

### Android TV: Navigation and show library

- Redesigned TV cards: official TMDb logo, badges under the logo, separate reprise and restart, and return to the card from the player.
- Series now offer a season selector without S0 bonus, an episode-illustrated card, and searching for a missing season from TV.
- Improved dashboard: animated Movviz navigation, tiles without visuals with a fixed brand halo, and clickable download cards with readable progress.

## v1.16.5 — August 2026

### Fix: matching worker embedded in standalone installations

- Cleaning the standalone bundle deleted the `*Worker.mjs` files after the build: automatic searches could therefore fail just after reading the RSS cache on installations packaged since v1.16.1.
- The build now explicitly copies all workers to the standalone runtime and the pools resolve them from this location. Parallel matching works again; the local safety fallback remains active.

## v1.16.4 — August 2026

### Fix: decoupled requests and auto-search

- An approved request is now recorded as soon as the movie or series enters the library, before automatic searching. An indexer or matching error can therefore no longer create media without making it appear in **Requests**.
- Unexpected errors during a movie, season, or episode search become a controlled and explicit result in the diagnostic log, instead of a 500 error or a "search" status restored without cause.

## v1.16.3 — August 2026

### Fix: reliable automatic addition, even without an available worker

- Adding a movie or series no longer stops with a 500 error if the matching worker is not loaded by a packaged installation: Movviz then applies the same matching rules directly in the main process and continues the automatic search.
- The failing worker pool is stopped cleanly instead of restarting in a loop, which prevents keeping the server in permanent error.
- The card no longer displays an HTTP failure response as a successful addition: the error is shown and the actual state of the library is reloaded.

### Android TV: Movviz identity and discovery flow

- The TV screen now features the Movviz visual identity: official clap logo, glass navigation on the hero, and title cards and cards adapted for the remote control.
- Connection with Plex and library actions are integrated into the TV flow, with immediate return of the download status.

## v1.16.2 — August 2026

### New: Dedicated library — Movies and Series pages

- The library is now split into **three fixed pages**: `/library` (All, both types mixed), `/movies` (movies only), and `/series` (series only) — accessible from the "Library" sub-menu in the sidebar.
- The Movies and Series pages no longer have type filtering buttons (it's their fixed nature); sorting, status filtering, and tags remain available. Old links `?type=movie|series` now redirect automatically to the new pages.

## v1.16.1 — August 2026

### New: Library sub-menu in the sidebar (desktop)

- The "Library" menu now expands under three entries: **All**, **Movies**, and **Series** — a chevron opens/closes the sub-menu, and the active entry is highlighted. Previously applied filters, sorting, and tags are retained when switching between the three views.

### Fix: Build failed due to lack of disk space

- **Root cause identified**: The Next.js 16 Turbopack build ignored tracing exclusions and copied development folders (`dta/`, `.movviz-data/`) — up to ~480 GB — into the standalone bundle, eventually filling the disk. The build reverts to webpack (where exclusions work) and a `clean-standalone` script purges what should remain out of the bundle: the final standalone size drops from ~480 GB to ~64 MB.

## v1.16.0 — August 2026

### New: Android TV client

- **First native Movviz client** for Android TV / Fire TV (remote, keyboard, and mouse all supported): connects to an existing Movviz server, Movies/Series library, title sheet, episode playback, search, settings — downloads as an APK from GitHub Releases, next to the Windows installer.
- Session is maintained between launches, like on Plex or Netflix — no need to log in every time.

## v1.15.17 — August 2026

### Fix: Simple interjection mistaken for a movie title

- **Root cause confirmed live**: Typing "hep" to get attention triggered a search, and Movviz followed up with an obscure 2013 Czech film as if it were the subject of the conversation. The list of recognized greetings and interjections (hep, hé, eh, ho, wesh, hmm, bref, ciao…) has been significantly expanded — real short titles like "300" or "Up" are still correctly recognized.

## v1.15.16 — August 2026

### Fix: Incorrect title could be added when movie and series are similar

- **Root cause confirmed live**: Asking to "download Lanterns" added "Human Lanterns" (a 1982 film with no relation) even though the series "Lanterns" (2026) was the very first search result. The assistant assumed it was a movie, and this assumption automatically excluded all series — including the exact match. A title that matches better now overrides this assumption, whether it's a movie or a series.
- Some common words ("de", "en", "et"…) can no longer be mistaken for a first name.

## v1.15.15 — August 2026

### Fix: Ordinary word could be saved as your first name

- **Root cause confirmed live**: Typing a sentence like "je l'ai pas vu, c'est avec DiCaprio ?" caused "Avec" to be saved as a first name, overwriting the real one. The detector took any word following a "c'est" in a sentence. This form is now only recognized at the very beginning of a message (the answer "c'est Seb" to a first name question is still captured), and an expanded list of common words can no longer become a first name.

### Fix: Successful rating displayed as a failure

- **Root cause confirmed live**: For a request like "give 5 stars to X, Y, and Z", the ratings were correctly saved, but the displayed response was "j'ai un vrai blocage" — the assistant hadn't generated any sentence around its ratings. Confirmation is now built from the actually saved ratings, along with the list of titles and their rating.

## v1.15.14 — August 2026

### Fix: Batch-announced notes were not actually saved

- **Root cause confirmed live**: After reviewing titles one by one, responding with "I loved it, give 5 stars to all" displayed a neat list ("Solo Leveling: 5/5", "Jurassic Park: 5/5"…) and announced "here are the updated scores"—even though **no scores were saved**. Two cumulative causes: an internal limit of 2 scores maximum per response made batch scoring structurally impossible, and nothing prevented announcing scores without actually setting them.
- Batch scoring now accepts up to 10 titles at once, and any response that announces scores without actually saving them is automatically detected and corrected—no more announced but absent scores.

## v1.15.13 — August 2026

### Movviz AI — Conversation subject is now explicitly tracked

- **Root cause identified during audit**: Outside of an open movie/series page, nothing indicated to the assistant which title you were talking about—it had to guess by rereading the history, which failed in natural sequences ("Solo Leveling" → "I love it" → "the best thing is against X") and could trigger an unnecessary search on the third message. The title currently under discussion is now memorized as soon as it has been actually identified, and recalled with every subsequent message: short reactions, implicit references, and character names default to this title, without restarting a search.

## v1.15.12 — August 2026

### Movviz AI — Cross-referencing filmography and scores to prioritize a missing title

- When a filmography search reveals missing titles and the user has assigned scores, the assistant can now cross-reference the two to suggest which of the missing titles is most likely to appeal, based on genuinely shared characteristics (tone, genre, structure)—never an invented intuition.

## v1.15.11 — August 2026

### Movviz AI — Unified decision hierarchy

- The numerous rules added separately (short responses, corrections, title mentions, occasional reviews...) are now gathered under a single, explicit priority order, to prevent isolated rules from contradicting each other: reaction to the current conversation > reference to the active subject (a character, a scene, "the second one"...) > correction of the previous response > conversational intent > already known work > potentially new work > external search as a last resort.
- A review of a specific character (e.g., "Beru is clearly the best") is now treated like reviews for a scene/actor/ending already covered: memorized for what it is, never transformed into the title's overall score.

## v1.15.10 — August 2026

### Movviz AI — Discreet badge instead of forced opening

- When Movviz spontaneously restarts the conversation after an absence, the chat no longer opens automatically—the floating button now displays a numbered badge with a brief pulse, until the user opens it themselves.

## v1.15.9 — August 2026

### Movviz AI — Spontaneous restart can now concern a score

- When Movviz spontaneously restarts the conversation after an absence (already existing mechanism, with its own waiting time), it can now, on occasion, directly ask for the score of a viewed but never rated title instead of a general question—never twice via two different channels within the same time window.

## v1.15.8 — August 2026

### Fix: A score did not update the context in real time

- **Root cause confirmed live**: Unlike any other real activity (viewed, 👍/👎 feedback, Netflix import), assigning a score—via the star widget or in conversation—did not trigger the update of the consolidated context ("What Movviz AI knows about you"). You had to manually click "Regenerate context" for the scores to be taken into account. A score now propagates automatically, like everything else.

### Movviz AI — occasional question about a seen title but never rated

- From time to time, when the conversation naturally lends itself to it, the assistant can now ask for the rating of a title that has been fully seen but never rated — never systematic (limited to one occasion every few hours, never forced if the moment is not right).

### Profile panel — remove a 👍/👎 feedback

- Each title liked/disliked in the "What Movviz AI knows about you" panel now has a button to remove it from the context (useful for a vote cast by mistake).

## v1.15.7 — August 2026

### Movviz AI — a previously disliked title is no longer ever suggested

- A title marked "bad recommendation" (👎) is now permanently excluded from future recommendations — until now, only a light penalty was applied to titles with a similar tone, which did not prevent the exact previously disliked title from reappearing.

## v1.15.6 — August 2026

### Movviz AI — distinction between a specific opinion and an overall rating

- A comment on a specific element ("I love this scene", "this actor is excellent", "the ending is flawed") no longer implies an overall rating for the entire title — only an opinion expressed about the whole film or series is translated into a rating.

## v1.15.5 — August 2026

### Movviz AI — enhanced cinephile companion identity

- The assistant now reasons explicitly as a cinephile companion who seeks to understand the user (why they like a title, not just what genre) rather than a search engine with surrounding text.
- Short responses ("but still", "that one", "I already saw it"... ) no longer trigger unnecessary searches — they are now recognized as reactions/corrections to be understood in relation to the previous message, never as a new title to search for.
- When the conversation is a simple cinephile discussion, preference collection and follow-ups take a backseat to natural exchange.
- Generic assistant phrasing ("Would you like me to help you?... ") explicitly banned.

## v1.15.4 — August 2026

### Fix: reinforced guarantee against raw technical lines (continuation of previous fix)

- **Root cause confirmed live**: the v1.15.3 fix relied on a new attempt by Movviz to respond, which could reproduce the same technical line instead of a real sentence. A deterministic automatic rephrasing (without depending on a new attempt from the language model) is now in place to ensure that no raw technical line ever reaches the user.

## v1.15.3 — August 2026

### Fix: mentioning a title sometimes responded to with a technical line instead of a real sentence

- **Root cause confirmed live**: the v1.15.2 fix prevented silent addition, but in some cases, the assistant still responded with a single line in the format "• Already in the library — Title (year)" — an imitation of the technical format used internally for addition results, copied by mistake instead of a real natural reaction. This mechanical format is now detected and automatically corrected to always yield a real sentence.

## v1.15.2 — August 2026

### Fix: mentioning a title sometimes treated as a silent addition

- **Root cause confirmed live**: the check added in v1.15.1 (library/history/rating before reacting to a mentioned title) did not actually trigger in some cases, because the assistant sometimes interpreted a simple title mention ("Hurlevent", "the nice guys") as an implicit addition request — result: a technical line ("Already in the library — X") with no reaction, instead of a real response. Corrected: a title mention without an explicit action verb (add, put, download...) no longer triggers a silent addition and now correctly proceeds through the expected natural response.

## v1.15.1 — August 2026

### Fix: Movviz AI no longer consulted what it already knew before responding

- **Root cause confirmed live** : Upon merely mentioning a title ("zootopia 2"), the assistant would ask "do you want to add it?" for an already present title, or "did you see it?" when the history already knew — it simply had no real verification to check for a casual mention (only explicit questions triggered one). It now systematically checks the library, viewing history, and existing notes before reacting to a mentioned title, and no longer asks a question whose answer it already knows.
- When a mentioned title is seen but never rated, the assistant naturally takes the opportunity to ask for an opinion, in one sentence, without making it an interrogation.
- Correction for an unfulfilled promise: The assistant could respond "I'll check that right away!" and then never follow up with the answer — as a conversation doesn't have an automatic second act, this kind of promise is now banned; either the check happens in the message itself, or the assistant honestly says it cannot check.
- Tighter personality: More regular use of the known first name, more present but not excessive emojis, reaction before question rather than the other way around.
- Additional safeguard so that an internal technical format never displays as is in a response.

## v1.15.0 — August 2026

### 1 to 5 star ratings (new)

- Every movie and series can now receive a rating from 1 to 5 stars, directly from its page — only one rating per title and per user, never shared between accounts.
- Movviz AI also understands a rating given in conversation ("I loved it," "what a disappointment," "I give it 4 stars") and automatically saves it, without ever guessing when it's not clear enough — a rating manually placed on the page always takes precedence over a rating inferred from a sentence.
- These ratings refine both the chatbot's recommendations and the Discover page suggestions, which now share the same understanding of your tastes instead of two separate logics.
- The "What Movviz AI knows about you" panel (Profile page) now displays your recent ratings, distinguishing between those manually given and those inferred from a conversation.

## v1.14.48 — August 2026

### Fix: Trash can button visible to everyone in the library

- **Root cause confirmed live**: The delete button for a movie (library card and movie page) was visible to any user, even though the server already correctly refused deletion for non-administrator accounts — so no data was at risk, but a regular user saw a button that failed silently on click. The button now only appears for administrator accounts, like everywhere else in the app.

## v1.14.47 — August 2026

### Fix: "Continue Watching" row incorrectly cleared

- **Root cause confirmed live**: The double check added in v1.14.44 (as a precaution, without certainty that it was necessary) compared every "in progress" title with the already synchronized viewing history — a history that only updates every 2 hours. A recently started title was not yet in it, so it was incorrectly removed from the row even though it belonged to you. Result: the row went from 10 actual titles to only 3. This double check is removed; the original protection (the token specific to each account) remains in place.

### Fix: Movviz AI and web access (continued)

- **Root cause confirmed live, twice**: Despite the fix in the previous version, Movviz AI sometimes continued to categorically deny all internet access even when web search was enabled in the settings — the instruction alone was not enough to prevent this reliably. Movviz AI now detects this erroneous denial and corrects itself immediately before displaying anything, using the same approach as for other automatic corrections already in place.

## v1.14.46 — August 2026

### Fix: Movviz AI and web access

- **Root cause confirmed**: Movviz AI used to respond "I do not have internet access" as a fixed technical impossibility, without ever taking into account whether the "Web search" setting was actually enabled or not on the account (Settings AI section). It now knows the actual status of this setting: if it is disabled, it explains it as a reversible configuration choice rather than a definitive limit; if it is enabled, it no longer claims to have no access when a real search is indeed performed for certain specific features (like finding a memorable scene). Reminder: this setting takes effect immediately on the next message, without reloading the page or reconnecting.

## v1.14.45 — August 2026

### New: Movviz AI can finally answer "give me the filmography of X"

- **Root cause confirmed live**: asking for the filmography of an actor or director ("give me the filmography of Brad Pitt") always received the same refusal, word for word, even when insisting multiple times in a row — Movviz AI simply had no real data for this specific type of question, unlike "what am I missing from X" which was already connected to a real search. A real search for the person on TMDb (with their actual filmography, cross-referenced with your library) is now triggered for this specific question.
- Movviz AI no longer repeats a response word for word from one message to the next in the same conversation — the phrasing always varies, even when the underlying answer remains the same.

## v1.14.44 — August 2026

### Fix: Second safety net for "Continue Watching"

- The "Continue Watching" row now checks, in addition to the data returned by Plex, that the title concerned is actually in the viewing history specific to the account viewing the page before displaying it — a title with no trace in this history is never shown, regardless of what Plex might have returned. This double check protects against potential account confusion on Plex's side, regardless of the exact cause.

## v1.14.43 — August 2026

### Major fix: User account isolation

- **Root cause confirmed**: on a shared device, logging out and then logging back in with another account never reset the data already displayed in memory (views, preferences, requests, anything personal) — a previous fix had only reset one technical element (the connection status), not the rest. Result: the next account could momentarily, or sometimes permanently, see the data of the previous account before it refreshed on its own. All personal data is now completely reset upon every login and logout — no more leakage from one account to another.
- **Second cause found upon investigation**: a secondary Plex profile (a "home"/child account linked by the admin, without its own Plex connection) never saw its watched movies/episodes synchronize from Plex — the background task simply ignored these profiles. Fixed: every profile, including secondary profiles, now has its own synchronized views independently.

## v1.14.42 — August 2026

### Fix: "Optimizations available" row error

- **Root cause confirmed live** (Settings panel > Performance): even after the previous fix, the "Optimizations available" row on the dashboard systematically failed after one minute — it launched, upon opening the dashboard, up to 50 live searches on the indexers (one per affected movie/episode), one after another, far exceeding the server timeout. This row is now limited to the cache already in memory, which is fast by nature; the full live search remains entirely available in the "Search and Replace" panel, triggered intentionally.

## v1.14.41 — August 2026

### Fix: General application slowness

- **Root cause confirmed live** (Settings panel > Performance): searching for available optimizations (the "Available optimizations" row on the dashboard, and the "Find and replace" panel) was re-analyzing the entire cache of releases for EVERY movie and EVERY episode in the library, instead of doing it once and reusing the result — on a large library, this repeated work saturated the server for several tens of seconds and slowed DOWN ALL other pages at the same time (dashboard loading, library, requests...), even if unrelated to the optimizations. The calculation is now done once, with a strictly identical result.

## v1.14.40 — August 2026

### Fix: Movviz AI

- **Root cause confirmed live**: a recommendation request ("surprise me") could receive a response announcing a list ("Here's what might surprise you...") without any title following — an unfulfilled promise, without a recommendation card or error message. Movviz AI now detects this case and immediately requests a real list before displaying anything.

## v1.14.39 — August 2026

### Fix: "Continue Watching" row

- **Root cause confirmed live**: Plex mixes two different things in its "on deck" list — what is actually paused during playback, and the next episode of a series that has never been started but is highlighted because a previous episode was watched. The row was therefore displaying dozens of thumbnails with a 0% progress bar, never actually started. Only the genuinely resumed content is displayed now.

## v1.14.38 — August 2026

### New: "Continue Watching" row

- The dashboard now displays a "Continue Watching" row, between "Movviz Trends" and "Suggested For You" — the ongoing movies and episodes, with the actual progress bar, whether they were resumed from a classic Plex app or directly from the Movviz built-in player. Can be enabled/disabled in Settings like other rows.
- **Root cause corrected simultaneously**: the Movviz built-in player was correctly signaling its progress to Plex on every playback, but a missing technical parameter caused Plex to silently ignore this signal — so the progress was never actually taken into account on the server side. Corrected, with the bonus of assigning it to the correct account when multiple users share the same Plex.

## v1.14.37 — August 2026

### Fix: Movviz AI

- **Root cause confirmed live**: every recommendation displayed a generic apology message ("I'm having a real block...") just above the suggestions, even when the recommendation had been perfectly successful — a real trust issue in the most used path of the feature. The accompanying sentence for a recommendation was actually never constructed, and thus defaulted to the generic error message. A real introductory sentence is now displayed for every recommendation.

## v1.14.36 — August 2026

### Fix: Movviz AI

- **Root cause confirmed live**: asking "Do you remember my name?" could receive an "I don't know yet" even though Movviz AI had used it a few messages earlier in the same conversation — the name was indeed retained, but the response still denied it. Movviz AI now detects this kind of false denial and corrects itself immediately before displaying anything.

## v1.14.35 — August 2026

### Fix: Movviz AI

- **Root cause confirmed live, after the previous version's fix**: the prompt alone was not enough to prevent some models from copying the internal technical note verbatim instead of rephrasing it — the problem persisted despite a reinforced prompt. Movviz AI now detects this itself and immediately requests a real rephrasing before displaying anything; if even this follow-up fails, the note is automatically cleaned of anything that betrayed its technical nature. The internal wording can no longer appear in a response, regardless of the model used.

## v1.14.34 — August 2026

### Movviz AI

- **Root cause confirmed live**: when a real check was performed to answer a specific question (possession, viewing, casting, series status, what a franchise is missing), Movviz AI sometimes copied the internal technical note verbatim instead of formulating a real sentence — an answer that sounded like a database excerpt rather than a conversation. Corrected: verified facts remain accurate, but are now always naturally rephrased.
- More generally reinforced personality: explicit instruction never to let internal formatting or technical structure show in a response, regardless of the question type.
- **Root cause confirmed live**: a recommendation or addition that was a bit long could, on some models, be cut off mid-way before the end — until now, the slightest cut caused everything to be lost and displayed a generic error message instead. Movviz AI now retrieves the already complete elements of a cut-off response instead of discarding everything.

## v1.14.33 — August 2026

### Fix: import Netflix

- **Root cause confirmed on a real export**: two recognition bugs caused a large portion of titles to be missed. First, an isolated episode number ("Episode 24") was wrongly taken for a season number — searched as "season 24" for a series that only has 2 or 3, inevitably unfindable. Second, a series with no season label at all (just "Series: Episode Title") could be misdirected during the search and lose the specific episode in the process.
- The labels "Part N" and "Volume N" are now recognized as seasons alongside "Season N".

## v1.14.32 — August 2026

### Movviz AI

- Movviz AI now actually checks four types of questions about a specific title before answering, rather than guessing from its memory alone: whether you already own a title ("do I have Alien?"), if you have already seen it (entirely or only partially), who stars in it and who directed it, and if a series is finished or still ongoing. When the question cannot be reliably verified (title not found), it states this clearly instead of inventing an answer.

## v1.14.31 — August 2026

### Fix

- **Root cause confirmed live**: when you ask what a character, director, or franchise is missing ("what movie is missing from..."), Movviz AI could still invent a false answer ("you don't have any Pokémon movies") despite a previous fix on this same type of error — the prompt alone was not enough to prevent this reliably. For this specific phrasing, Movviz AI now runs a real search in the catalog and actually checks, title by title, what is already in your library before answering, instead of guessing.

## v1.14.30 — August 2026

### Movviz AI

- Movviz AI now knows since when you haven't watched anything and at what rate you are currently watching (number of views in the last 7 and 30 days) — a real signal, based on your dated views, for answers better tailored to your recent activity rather than simple raw counters. This information is also visible in the "What Movviz AI knows about you" panel in the profile.

## v1.14.29 — August 2026

### Fix

- **Root cause confirmed live** : the "Force Plex Sync" button did ask Plex to rescan, but immediately triggered Movviz sync—before Plex had finished its own background scan. Result: the button displayed success without ever resolving the "waiting for Plex sync" lock. Fixed: a real delay is respected before checking, with a second automatic check a few seconds later for slower scanning libraries.

## v1.14.28 — August 2026

### Movviz AI

- When you correct the assistant because it falsely stated that a title is not in your library, this correction is now retained—if the same error recurs multiple times, the assistant becomes significantly more cautious before stating an absence, rather than repeating the same error in every conversation.

## v1.14.27 — August 2026

### Movviz AI

- The consolidated context ("what Movviz AI knows about you") is now updated near every real action (movie/episode marked as watched, vote 👍/👎, Netflix import complete) rather than just when opening the chat—still only one calculation at a time, never continuous processing.

## v1.14.26 — August 2026

### Movviz AI Fixes

- **Root cause confirmed live** : when the language model responded without a single real sentence (for example, because its entire response was only used to memorize information internally), the Movviz chat would return a completely off-topic "Got it!"—even when faced with a direct user comment or a real question like "what else?". A new check detects this case and immediately asks for a real answer before displaying it, without it being noticeable or slowing down the conversation; only as a last resort, a message honestly acknowledges the difficulty instead of an incongruous "Got it!".
- **Root cause confirmed live** : asking "what am I missing from [comedian/actor/director]?" could produce a list of completely fabricated titles, falsely presented as verified in the library ("according to your history")—to the point of stating a title was missing when it was already present. This type of question no longer has the right to invent a list: the chat now honestly explains that it cannot verify this reliably here and directs to the Movviz search, where every title truly shows if it is already in the library.

## v1.14.25 — August 2026

### Movviz AI Fix

- **Root cause confirmed live** : answering its own question "what is your name?" with a single word ("Seb") was not enough—the first name was never retained, even though it continued to use it normally in the ongoing conversation. Result: it could state "you didn't give me your first name" while using it in the same sentence. Fixed: a short answer to its own question about the first name is now correctly recognized and retained.

## v1.14.24 — August 2026

### Movviz AI Fixes

- **Root cause confirmed live** : pasting a long list of titles (e.g., copied from a Netflix history) caused the response to fail in a loop, regardless of rephrasing—the generated response exceeded the allowed length limit and arrived truncated, thus invalid. Limit raised, and adding more than 25 titles at once is now cleanly limited to the first 25 instead of trying (and failing) on everything at once.
- A title pasted in the format "Series: Episode Title" (typical of a Netflix export, e.g., "Sakamoto Days: The Legendary Assassin") was searched for as is and never found—now recognized as the series alone, AND the specific episode is found and marked as watched (no longer just the series added).
- New: asking for the list of episodes for a series (while on its page) returns the real list from Movviz, with the watched status—no more refusals or fabrications.

## v1.14.23 — August 2026

### New

- A title stuck on "Awaiting Plex sync" (file present but not yet detected by Plex) now offers a button to force synchronization immediately (admin), instead of waiting for the next automatic pass (up to 5 minutes).

## v1.14.22 — August 2026

### Fix: Netflix import

- **Root cause confirmed live** (actual export of 3217 lines): the import was contained in a single HTTP request, which timed out before completion on a large history — each title/episode requires an online search, and a multi-year history accumulates hundreds.
- **Fixed**: the import now runs in the background on the server with a progress bar directly in the button — you can leave the Settings page during the import; it will continue and resume display if you return to it.
- Two recognition bugs fixed on the fly: a viewing date was misinterpreted (day/month swapped depending on the export), and series whose title itself contains a ":" (e.g., miniseries) were incorrectly parsed.

## v1.14.21 — August 2026

### Netflix

- Settings → Netflix now offers a direct link to your Netflix viewing activity page (the "Download all" button), so you no longer have to search for where to find the file to import.

## v1.14.20 — August 2026

### New: Netflix integration

- Settings → Netflix: import your Netflix history (file downloaded from your own Netflix account, no password required) to mark these movies and episodes as watched in Movviz — strictly private to each account.
- The "Watched" status, manually checked or imported from Netflix, is now reflected in your linked Plex account (movie, series, season, episode) — until now, synchronization only worked in the other direction (Plex to Movviz).

## v1.14.19 — August 2026

### Fix

- The "new features" popup sometimes displayed untranslated text for non-French interfaces — the language translation for this popup had stopped being maintained since several versions without the fallback mechanism noticing. Simplified: a single source of truth, in French, consistent with the rest of the repository.

## v1.14.18 — August 2026

### Movviz AI

- The assistant now adapts to each person's style (direct, familiar, humorous...) instead of a fixed tone, and varies its phrasing so as never to repeat itself.
- When you return to Movviz after a period of absence, the assistant can open the conversation by itself with a question about cinema — never more than once every few hours.
- New "Create context" button on your profile page: an analysis of your actual activity (views, requests, feedback) builds a lasting understanding of your tastes — the mechanism that pleases you, not just the genre — and continues to enrich itself over time, without ever running continuously.
- Recommendations better recognize franchise logic: the next unwatched episode of a saga is now prioritized, and several options can be suggested (continue the saga / same energy elsewhere / even more extreme) rather than a single imposed choice.
- New, optional, and disabled by default: web search (via Mistral only) to sparingly evoke a memorable scene from an already seen title — never a spoiler for a current series, activatable in Settings.
- The assistant can remember that a title was watched simply by you telling it in conversation, without having to go through its dedicated page.
- Several refinements to the recommendation engine (weighted confidence on learned tastes, slight fatigue after a sequence of the same type of content) and a clear guideline: never ask to rephrase, always try to understand.

## v1.14.17 — August 2026

### Movviz AI

- Two full audits found and corrected 7 real comprehension bugs: the ambiance engine compared trait names that no longer always matched from one analysis to another, a series was excluded from recommendations after viewing just one episode (instead of the whole series), an excess of internal contradictions in conversation instructions, and a handful of other more discreet memory corrections.
- New: "What Movviz AI knows about you," a panel on your profile page that clearly shows (never raw code) what the assistant has retained—facts, activity, liked or disliked recommendations.

## v1.14.16 — August 2026

### Movviz AI

- Fix for a serious bug: a recommendation citing a word in quotes could display as raw JSON instead of cards — fixed at the root, no more risk of leakage whatsoever.
- Conversations now survive a server restart — only the trash can button empties them.
- Recommendation poster and title are clickable and open the card.
- Adding a recommendation now triggers a real assistant reaction to that title.
- New recognized recommendation modes: "darker," "less violent," "suggest something" without a specific reference, or deliberately unknown.
- Recommendations take into account your past 👍/👎 feedback more finely (what was liked AND what was rejected, not just one or the other) and your association with the same franchise as what you are watching.
- A need clearly expressed in the moment ("I need something lighter right now") now takes precedence over your general habits instead of being ignored.
- The assistant better understands requests that fall outside the obvious genre ("like this movie, but without this element") and asks a targeted question rather than guessing randomly when your request is truly ambiguous.

### Settings

- New "Experience" tab (video on cards, special episodes) separated from the Dashboard.
- New setting: special episodes no longer count towards the "series fully watched" status (disabled by default), and a not-yet-released season no longer blocks this status either.

## v1.14.15 — August 2026

### Movviz AI

- Fix for a last memory subtlety: the assistant no longer says "I will note this" without actually doing it in the same message — either it directly uses what it already knows, or it clearly states that it does not know yet.

## v1.14.14 — August 2026

### Movviz AI

- New trash can button directly in the chat on an "already present" entry: if it's actually the wrong entry, you can delete it yourself in two clicks without leaving the conversation (reserved for admins, as everywhere else in Movviz — the assistant never deletes anything itself).
- Your first name remains fixed once known — it no longer asks for it, and only changes if you explicitly give it another one.
- The assistant can now naturally address its sentences according to your first name, with caution and without ever insisting if the context suggests otherwise.

## v1.14.13 — August 2026

### Movviz AI

- Fix for a bug where the assistant could add the wrong movie in case of a false friend between languages (e.g., "a man a real" added an unrelated Spanish movie) — it now checks the true resemblance of the title before adding anything, and prefers to say "not found" rather than getting the movie wrong.

## v1.14.12 — August 2026

### Movie/Series Cards

- Removed the duplicate year next to the title — the year is now displayed only once, next to the duration.

## v1.14.11 — August 2026

### Movviz AI

- New suggestion source: In addition to its own ideas, Movviz AI now also draws from TMDb recommendations for the title you are watching — both sources go through the same final filtering (quality, mood, history, reviews).
- Recommendations no longer appear as a block of silent cards: each suggestion is now introduced by a different little phrase ("Hey, I think you might like this", "Otherwise, there's this..."), for a real conversational feel rather than a raw list.

## v1.14.10 — August 2026

### Movviz AI

- The assistant's humor now adapts to any genre (not just horror) and never repeats the same joke twice.
- Anecdotes are now always kept short — a naturally slipped sentence, never a long paragraph.

## v1.14.9 — August 2026

### Movviz AI

- Background bug fix: A first name given in conversation was not surviving a "clear conversation" — a calculation error meant that first conversation detection never actually triggered correctly.
- A user's first name is now also captured directly at the code level (several recognized formats), without depending solely on the language model's goodwill to note it.
- Fix for a display leak where internal technical text could appear in plain sight in a response, and for a case where the assistant noted a lack of information as if it were a memory.
- Movviz AI now explicitly asks for the first name from the first conversation if you haven't given it, and naturally prompts until it knows it.
- It now avoids asking the same opening question with every message.

## v1.14.8 — August 2026

### Movviz AI

- "I remember you" panel removed from the chat.
- Fix for a bug where the assistant would respond with simple ellipses instead of a real answer — especially when you were reacting to an already suggested recommendation (a question, a joke) instead of asking for a new one.
- The assistant no longer claims to have memorized something it has not actually received (e.g., your first name before you gave it).

## v1.14.7 — August 2026

### Movviz AI

- For a vague or general request ("something for a girl", "a movie for the whole family"...), Movviz AI now explicitly bases itself on the real experience of the person asking (their own views, their own requests — never those of another account in the household) rather than a generic cliché; if there is no exploitable clue, it asks a question rather than guessing randomly.

## v1.14.6 — August 2026

### Movviz AI

- New "Surprise Me" mode: Explicitly ask to be surprised or to step outside your habits, and the assistant will favor titles compatible with your taste but deliberately different from the obvious choice — while telling you why.
- The assistant now tempers its recommendations: it distinguishes between what it is sure of and what is more exploratory, rather than presenting every suggestion as a certainty.

## v1.14.5 — August 2026

### Settings

- Movviz AI "Save" button duplicated at the top of the panel: after activating the AI or pasting an API key, there is no longer a need to scroll through the entire provider list to save.

### Movviz AI

- Fix: The chat message field was cropping the bottom of the example text (placeholder) instead of displaying it entirely over two lines.

## v1.14.4 — August 2026

### Movviz AI

- New mood engine: when you request a recommendation from a profile, Movviz analyzes the deep tone of the reference title and each candidate (humor, energy, tone...) to rank suggestions according to the true mood proximity, not just the TMDb genre.
- First conversation with the assistant: it introduces itself and asks up to 3 small questions (first name, what you like watching right now...) to start getting to know you — never more, never a form.
- Assertive personality: always pleased to see you, a touch of well-placed humor (e.g., a horror movie), and sometimes an anecdote about a title — always phrased with caution, never presented as absolute certainty.
- Permanent safeguard: the assistant cannot and will never delete anything in Movviz, no matter how it is asked.

## v1.14.3 — August 2026

### Discovery

- Background fix: The "Platforms" row used an approximate name match on the TMDb catalog, which could attach an obscure service instead of the correct one (e.g., an unknown add-on instead of the expected service). Replaced with a fixed and verified list of the 10 most used platforms in France, with their real logos in better quality.
- Removal of the "Broadcasters" row, which duplicated "Platforms" (same brands, but worse: limited to series).
- On mobile, the Platforms/Studios tiles switch to compact round icons instead of the large rectangular format designed for desktop.

### Movviz AI

- The assistant now retains the facts you give it in conversation (first name, explicit preference...) from one session to the next, in addition to its existing memories (added titles, accepted recommendations).
- New 👍/👎 feedback on each recommendation — serves as a basis for a more relevant ranking of future suggestions.
- The model now proposes more candidates in the background; Movviz filters and ranks them itself (quality, novelty, past feedback, already requested) before only displaying the best — and now simply excludes any title that has already been fully viewed.

## v1.14.2 — August 2026

### Discovery

- Streaming platform filters (Prime Video, Netflix, Disney+, etc.) are now real platforms recognized by TMDb, valid for BOTH movies AND series — no additional API key required.
- Fix: Selecting a platform would force switching to "Series" even when on "Movies," and switching back to "Movies" would remove the platform filter when returning to the dashboard. The filter now remains active regardless of the type browsed.
- New "Platforms" row on the Discovery page.

### Movviz AI

- Fix: The assistant was confusing the number of movies viewed by the user with the total number of movies in the library, giving false answers about the collection size.

### Reliability

- Fix for random crash of the dashboard carousel (Hero) and ambiance video cards: two nested transition animations could conflict when removing the same page elements at the same time, occasionally causing a general application error.

## v1.14.1 — August 2026

### Movviz AI

- Fix: The chat button only appeared after a full page reload once Movviz AI was activated in Settings — it now appears immediately.
- New log (Settings → Movviz AI, admin): history of the last chat calls with the provider used, success/failure, latency — to understand what happened without guessing.
- Each provider now displays where to get a free API key directly in Settings.
- Expanded invalid quota/key detection (403 in addition to 429) for a more reliable switching between keys from the same provider.
- New, entirely optional step to activate Movviz AI and add a key upon initial Movviz setup.
- The background and custom logo of a card now prioritize the interface language (French logo if available for a French user, etc.) rather than just popularity.
- The logo is also displayed in the dashboard Hero carousel, not just on the card.

### Reliability and confirmations

- Card deletion (trash can button) and permanent deletion from Trash: a confirmation is now always requested, no more accidental one-click deletions.
- Accelerated Plex sync after download: Movviz triggers its own sync a few seconds after an import instead of waiting up to 5 minutes.
- Full-screen fix: the player container had inert layout CSS classes (unregistered variant), replaced with reliable logic.
- Card image editor merged with "Edit Card" (single pencil button) — image customization remains open to all users, structural settings remain reserved for admins.
- YouTube subtitles are now properly disabled on ambiance videos (cards and carousel).

## v1.14.0 — August 2026

### Movviz AI — smart chatbox (new)

- New conversational assistant (floating bubble, disabled by default): understands natural language requests, adds movies/series to the library, recommends in the same tone ("after Scary Movie, suggest Naked Gun" rather than a random comedy), answers common questions.
- Multi-provider (Mistral, OpenRouter, Gemini) with multiple keys per provider, automatic rotation upon quota reached, and fallback to the next provider if necessary — configurable from Settings (admin).
- Per-user memory: the assistant remembers added titles and accepted recommendations, and knows a numerical summary of activity (movies/series/episodes watched, requests, most watched series) — strictly isolated by account, never mixed between users.
- Never calls the language model without explicit user request: no background analysis, no impact on Movviz's normal operation if AI remains disabled.

### Enhanced "Watched" Tracking

- Movie/series cards and episodes now display a dated history ("watched yesterday," "3 days ago"...), combining Plex and direct playback from Movviz.
- New manual "mark as watched / not watched" button on movies, seasons, and episodes — complements Plex for anything watched elsewhere.

### Movie/Series Cards

- Redesigned resume button: when playback is in progress, the card directly suggests "Resume at HH:MM:SS" (with visible progress) instead of a generic "Play" button — the "resume or restart" choice is always offered when opening the player.
- New setting (Settings → Experience) to disable the animated background trailer on cards and keep a static image.
- The background and logo of a sheet can now be customized: a new button opens a selector of alternative images from TMDb (any user can adjust, like for tags).

### Queue

- New "Pending" and "Checking" status in download tracking, to better distinguish a lingering search from an import undergoing checks.

### Reliability

- Fix for a build configuration bug that could, on a development machine, excessively inflate the compilation output — with no impact on Docker images/the Windows installer.

## v1.13.92 — August 2026

### Manual Download: The banned words rule no longer applies

- **Cause**: The "banned term" check post-download (`checkPostImportBlockedWord`) applied to ALL imports, including those launched manually by the user. A manual download whose name contained a banned word (e.g., VOSTFR) was deleted and the library set to "missing" instead of being renamed/moved.
- **Fix**: A manual grab (search page, movie sheet, "Add Version" panel) now marks its infoHash as manual (`manualGrab.ts`, TTL 6 h) as soon as the engine accepts it. Upon import, this torrent is exempt from the banned words check: it is renamed, moved, and imported normally. Only automatic grabs keep the rule.
- First automatic acquisition, series, episodes: behavior unchanged.

## v1.13.91 — August 2026

### "Update by Quality" no longer creates duplicates (2) (3) (4)

- **Cause**: The "replace existing video" decision was only marked by the "Add Version" stream (LOT6). All other paths for grabbing an already available movie — sheet magnifying glass button (quality search), automatic 6 h upgrade, upgrade-candidates, manual search — did not mark any intention: the engine renamed the new file with a collision suffix "(2)"/(3)" as soon as the final name was occupied by the old file, which was never deleted.
- **Fix**: Any newly grabbed version for an already available movie (`movie.file`) now marks a "replace" intention on the infoHash before grabbing (`autoGrab`, `searchAndReplace`, grab route with manual search). Upon import, the old primary file is deleted from the disk (safety guards: validated engine root, depth ≥ 2, sanitized name, non-recursive unlink) and then the new file is renamed to its final name — no more "(n)" duplicates in Plex.
- First acquisition, series and episodes: behavior unchanged.

## v1.13.90 — August 2026

### "Minimum Year of Carousels" finally respected everywhere

- **Cause**: The `minYear` setting (Settings → Dashboard Experience) was only applied to the "Discovery" and "Recommended for you" rows on the dashboard — the cinematic Hero, "Recently Added," "Coming Soon," upgrades, and the ENTIRE Discovery page (carousels + "See All") ignored the filter: a 1931 movie could appear despite a limit to 1985.
- **Fix**: The filter is now applied everywhere uniformly:
  - Cinematic Hero: `buildHeroSlides` receives `minYear` and includes no slide released before.
  - Dashboard: all rows (Discovery, Recommended, Recently Added, Coming Soon, Upgrades) pass through the same filter.
  - Discovery: TMDb carousels + C411 rows + "See All" pages filtered; an explicit search (or manual year filter) remains unfiltered.

## v1.13.89 — August 2026

### No more "removeChild" crash (global display error)

- **Cause**: `NotFoundError: Failed to execute 'removeChild' on 'Node'` sent the entire app to the global error screen. The trigger: the open user menu (dropdown framer-motion/AnimatePresence) on "Sign out" click — navigation to `/login` dismantled the shell while the closing animation was still in progress, and framer-motion/React fought over the same DOM node during the commit phase.
- **Fix 1 (cause)**: `UserMenu.logout` closes the dropdown immediately and lets its exit animation finish (~300 ms) before the logout fetch and navigation — the shell is no longer ever unmounted with an animation in progress.
- **Fix 2 (fallback)**: new `AppErrorBoundary` (React error boundary) around the entire AppShell tree — a commit error (concurrent external DOM manipulation: hls.js/dash.js/YouTube during an unmount) can no longer kill the session in the default global-error: recovery screen + clean re-mount via "Try Again".
- Tested on Edge headless: login → logout with dropdown open → redirection to `/login` with no console errors.

## v1.13.88 — August 2026

### Logout: redirection to /login finally works

- **Cause**: in `UserMenu.logout`, `router.refresh()` was called immediately after `router.push("/login")`. A refresh issued right after navigating to another page cancels the ongoing navigation (it re-synchronizes the current page) — the RSC request for `/login` was sent, responded 200, but the URL never changed. Reproduced on Edge headless: session cookie properly deleted, back works, but the user remained on the dashboard until manual reload.
- **Fix**: no more `router.refresh()` after the push in the 3 logout navigations (`UserMenu.logout`, `PendingApprovalScreen.logout`, and the `AboutPanel` factory reset — same pattern, same risk). The login page already re-validates `/api/auth/me` on mount; the refresh was unnecessary.
- **Bonus**: `destroySession()` compared the full cookie (`raw.sig`) to the stored sessions (`raw`) — the session was never actually deleted from `sessions.json` (it rotted until expiration). It now extracts the `raw` as `resolveSession()`.
- Photos of actors in rounded squares (consistent with posters, instead of circles).

## v1.13.87 — August 2026

### "Search and replace": codec replacements (x264 → x265/AV1) finally suggested

- **Cause**: codec and format upgrades were only searched in the RSS cache (~50-150 most recent releases) — only language upgrade triggered a direct search in the indexers. With a cache that almost never covers the catalog (710 films in x264 when x265/AV1 are preferred, observed on real data), the panel displayed "No replacement suggested" even though better versions exist — and the "Replace" button found one.
- **Fix**: film and episode scans now replicate the grab fallback — if the cache contains no candidates and the film/episode can gain on codec score (score lower than the best configured codec), a bounded direct search (25 per run, same budget as language fallback) is launched on non rate-limited indexers. Episodes also gain codec score upgrades (previously reserved for films), without requiring `preferredVideoCodec`.
- The "Replace" button is unchanged: it performs its own direct search, as before.

## v1.13.86 — August 2026

### Click priority: now guaranteed on the client side

- **Cause**: activity marking on server layout re-render did not cover client navigations — the App Router does not re-render layouts on every navigation (they exit the router cache). A link click remained invisible to the background, which did not yield during page loading.
- **Fix**: a new client component (UserActivityPing) listens to every actual click (pointerdown in capture phase, limited to ~1/s, keepalive) and sends a POST ping to `/api/activity/ping` which marks the activity in the server process. The background now yields as soon as the click occurs, regardless of the navigation path — click, page loading, and searching remain prioritized during scans, bulk, and downloads.

### Re-download: the old version is actually replaced

- **Cause** : the reading is resolved via Plex (ratingKey → primary film version). After a re-download, the old file remained on disk → Plex kept two versions of the same movie and still served the OLD ONE (observed live: Alita in SBS, non-SBS downloaded version, still playing in SBS).
- **Fix** : any replacement import (manual selection, quality upgrade) deletes the old file from the disk as soon as a primary file existed — unless the explicit choice "Add as supplementary version" is made. Deletion is kept (never the imported file itself, never outside the library root); Plex then rescans and only sees one version: the reading serves the new one.

### Factory Reset — no config folder, return to wizard

- **Problem** : deleting the config folder on the fly was useless — the running server regenerates the files from its memory (globalThis cache, coalesced writes 300 ms) and the cookie session remains valid; the app continued to display normally, without a wizard.
- **Fix 1 — automatic detection** : if no accounts exist (config folder deleted), the AppShell automatically redirects to the wizard (`/setup`) instead of displaying a broken app.
- **Fix 2 — "Complete Reset" button** in Settings → About (admin) : purges all server memory caches, deletes the config folder (deletion validated: absolute path + depth), clears the session cookie, then opens the wizard on reload.

## v1.13.85 — August 2026

### Correction: the 10-item limit only applies to the ranking trend row

- **Problem reminder** : only the "Movviz Trends" row (the one with the top 10 numbers) displayed more than 10 items — other rows worked perfectly with their original length.
- **v1.13.84 adjusted fix** : the 10-item limit is restricted to the single merged trend row (trends ∪ popular), at the source. All other rows — recommended for you, new arrivals, kids, etc. — retain exactly their original length; no display regression on rows that were not affected.

## v1.13.84 — August 2026

### "Movviz Trends" Rows: still 10 items maximum

- **Cause** : the merged "trends ∪ popular" row was not capped — unlike the simple "Trends" row (10 max) — and the Dashboard displayed the full list (up to ~40 items) as soon as the merge exceeded 10. Result: overloaded rows with unranked items, heavy loading, and problematic display (observed particularly on Mac ARM).
- **Fix** : all rows from `/api/metadata/rows` are now capped at 10 items (same rule as "Trends"), and the Dashboard also applies the limit as a safety belt. The "See all" button still opens the full paginated version.

## v1.13.83 — August 2026

### Absolute priority to click and page loading

- **Navigation and loading now mark user activity** : the root layout (re-rendered server on every App Router navigation) marks activity as soon as a session is present — previously, a pure navigation (without an API call behind) remained invisible to the priority system, and the background did not yield during page loading. Every link click now immediately yields the background (yieldToUser), which resumes 4 s after the last interaction.
- **Plex sync now yields** : this was the last major consumer without yielding — its loops (movies, series, sections) made hundreds of sequential Plex/TMDb fetches without ever stopping while you were clicking. `yieldToUser("sync Plex movies/series")` is now called for every item and every section; a navigation pauses it for up to 30 s, then it resumes.
- **Rate-limited manual searches**: live search (fallback indexers) would launch `Promise.all` on all indexers without any limit — 3 tabs + a bulk grab = dozens of open sockets, and the entire server (including clicks) would slow down. A global semaphore limits to **2 simultaneous direct searches** (the next one waits for a slot ≤ 15 s then proceeds anyway): page loading remains smooth during peaks.
- **Reminder**: the rest of the mechanism was already in place — lanes (`runBackground`), indexer rate-limit with guaranteed user reserve (5 slots/host + 10 global), job queue with 10 min watchdog and reduced concurrency during downloads.

## v1.13.82 — August 2026

### Diagnostic subtitle logs (ffmpeg mode)

- Remux startup logs the added WebVTT output (`[remux] WebVTT output track=0:s:N`); the subtitle route logs the path taken for each request (`[subtitle] FAST PATH file=...` vs `[subtitle] no live session — dedicated extraction`). Allows immediate triage in `docker logs` if the instant player is used.

## v1.13.81 — August 2026

### ffmpeg mode subtitles: near instant (0.5 s instead of ~1 min)

- **New fast path**: the remux process (which already reads the file to produce the video) **also** writes the text subtitle track in WebVTT to a temp file, as a secondary output — at the pace of the movie playback, without any additional disk/network reading. The subtitle route tails this file and streams the cues to the player: **the first cue arrives in ~0.4 s** (verified by local playback), instead of waiting for a separate extraction to re-read the entire file from the beginning (~1 min on NAS).
- **Automatic session fallback**: on seek, quality or audio change, the remux restarts with a new temp file — the subtitle stream switches to it automatically (identical absolute times, no gaps in cues), without interruption for the player. When paused, the extraction follows the video (backpressure) and resumes on its own.
- **Fallback preserved**: non-pre-extracted text track (language other than the default track) → dedicated ffmpeg extraction as before; image tracks (PGS/VobSub) → unchanged Plex transcode (HLS) fallback.
- **Security**: Temporary WebVTT files are deleted upon session death (targeted unlink, name restricted to the system temp directory only — never recursive deletion).

## v1.13.80 — August 2026

### ffmpeg mode subtitles: 2nd root bug — the parser didn't understand the ffmpeg format

- **Fixed**: subtitles remained invisible even after the double-cancellation fix — root cause confirmed by local extraction reproduction: the ffmpeg WebVTT muxer writes timing lines in `MM:SS.mmm` when hours are 0 (movie less than 1h → **no** cue parsed; longer movie → only cues after the 1st hour). The parser required `HH:MM:SS.mmm`: hours are now optional in the regex, both formats are accepted and times remain correct (0h36m12s → 2172s).
- **Verified by reproduction**: test MKV file with 3 cues (1s, 5.5s, 1h02m) → old regex: 1 of 3 cues; new regex: 3 of 3, exact seconds.

## v1.13.79 — August 2026

### ffmpeg mode subtitles: root bug fixed (they never loaded)

- **Fixed**: in ffmpeg mode, text subtitles (SRT/ASS/SSA/WebVTT) never displayed — root cause confirmed live: upon loading a track, the cleanup function canceled the subtitle fetch that had just been initiated (double `abort()` on the same AbortController), and the error handler considered this voluntary cancellation as a normal case → silent return, no fallback, no message. Tracks are now loaded without being sabotaged: local WebVTT extraction (Plex method: subtitles served separately and rendered by the client, never burned into the video), rendered via the native `<track>` tag, real movie time ( `seekBase` offset recalculated on every seek).
- **Improved**: the track is built **immediately** upon loading the track — subtitles appear as the extraction packets arrive instead of waiting for the entire file to finish playing (long on NAS, ffmpeg reads the whole movie to extract the track).
- **Reminder**: image tracks (PGS/VobSub, not convertible to text) → automatically switches to Plex transcode (HLS) as before.

## v1.13.78 — August 2026

### Full screen: Movviz controls remain in charge

- **Fixed**: the full screen button passed the `<video>` alone in native fullscreen → the browser imposed its own controls, which displayed the **stream's** time (restarting from 0, relative to the seek) instead of the actual film position, and whose native seek did not reload the server session — the "buffer time instead of film, cannot advance" message appeared in fullscreen. Full screen is now applied to the **player container**: our controls (progress bar with `seekBase + currentTime`, menus, header, double-tap, gestures) remain displayed and functional, cinematic black background. iPhone kept on native `<video>` fullscreen (Fullscreen API does not exist on an iOS container — browser limit, unavoidable).

## v1.13.77 — August 2026

### Optimized NAS video transcode + server crash fixed

- **Optimized — local video transcode designed for NAS**: the encoder switches from `veryfast` to **`ultrafast` + `zerolatency`** (frames delivered as soon as encoded, no lookahead) — on an ARM/SoC NAS, the first buffer arrives ~2× faster and restarts after rebuffering immediately. The **GOP is shortened to 2 s** (`g 48`): a seek or quality change re-synchronizes in less than 2 s instead of waiting for a randomly drawn keyframe (often 10 s+ — this was what caused "the video transcode stutters"). `main` profile for guaranteed hardware decoding on all clients. Conservative bitrates unchanged (10/6.5/4/2.2 Mb/s) — quality remains correct, it is the latency that drops.
- **Fixed — server crash "Invalid state: Controller is already closed"**: when the client abandoned a video transcode session (seek, quality change, player close), the race between the asynchronous HTTP cancel propagation and the ffmpeg stop could destroy a stream whose Web controller was already closed → unhandled exception that killed the server process (503 generalized). Abandoned streams are now marked upon request abort and are never destroyed with an error; the error remains propagated for real encoding failures (HLS fallback intact).

## v1.13.76 — August 2026

### Smartphone: Netflix-level player, "minimum year" option for carousels

- **New — Settings → Dashboard → Hero → Minimum year for carousels**: choose the year from which movies are displayed in the "Discovery" and "Recommended for you" carousels — no more old stuff from 1955. "All years" by default, no library modification, filtering only on display.
- **New — smartphone player (375px/768px)**: left/right double-tap on the video = fast rewind/forward ±10 s with haptic feedback and toast (like Netflix), a single tap displays controls without ever stopping playback, the control bar no longer overflows (transcode/direct play buttons folded on tablet+, volume reserved for desktop where its slider appears on hover).
- **Fixed — iPhone**: functional full screen button (webkitEnterFullscreen), respect for safe areas (notch and home bar), enlarged slider touch surface (32px), no more parasitic elastic bounce.
- **Fixed — light mode**: header buttons, status badges, and player menus are now forced to dark cinematic (translucent black) — no more white icons on white background; control auto-hiding no longer closes an active menu.
- **Mobile Perf**: ambiance blur reduced on small GPU (max-sm:blur-2xl), Ken Burns retained.

## v1.13.75 — August 2026

### Player: HLS becomes a manual option, ffmpeg compression profiles, premium design

- **New — playback strategy**: HLS transcoding (Plex) is no longer automatically selected. In "Auto" mode, playback uses **direct playback or local FFmpeg remuxing**; if no local engine can read the file, an explicit error is displayed instead of silently switching to Plex transcode. HLS remains available **manually** in Settings → Plex → Playback Engine ("HLS (Plex transcode) — manual") for situations where it is still useful (PGS/VobSub image subtitles, exotic audio track, limited network).
- **New — ffmpeg compression profiles**: The Player Quality menu now offers **Original / 4K / 2K / FHD / HD** with true local transcoding (very fast libx264, CRF 23, conservative bitrates for NAS: 10 / 6.5 / 4 / 2.2 Mb/s, downscale without ever exceeding the source). "Original" keeps the current bit-exact copy (zero CPU). Changing quality reloads the ffmpeg session to the current position; on a direct/MSE stream, the player switches to local transcode.
- **New — premium player design**: Gradient scrim at the bottom of the screen (no more opaque banner), thin progress bar that thickens on hover with a luminous gradient fill and a zooming scrub thumbnail, giant central play/pause button, frosted glass menus with a checkmark on the active element, feedback toast on ±10 s skips, branded loading ring, redesigned resume card and error screen, gradient overlay header in full-screen mode, cinematic thumbnail and Ken Burns breathing effect, cursor hidden when controls disappear.

## v1.13.74 — August 2026

### Player: correct playback position in ffmpeg mode, 100% local subtitles without Plex

- **Fixed**: In ffmpeg mode, the progress bar would reset to the beginning after clicking in the middle of the video (the content itself would position correctly). The remuxed stream is a fragmented MP4 without an index: the browser restarts from zero on every seek/reload, even if the server seeks to the correct position. The player now displays and saves `seekBase + currentTime` (last seek position + time played), and the position is also preserved when changing audio tracks or pausing the player.
- **New**: Subtitles now work **without going through Plex** in ffmpeg mode — Movviz extracts the subtitle track from the raw file itself via ffmpeg (conversion to WebVTT) and renders it via the browser's native `<track>` tag, with a recalculated offset on every seek. The video remains a bit-exact copy; no video transcode is necessary. **Text** tracks (SRT, ASS, SSA, WebVTT, mov_text…) remain on the ffmpeg engine; **image** tracks (PGS/VobSub from Blu-ray remuxes, not convertible to text) switch to the HLS leg as before. Disabling subtitles no longer exits ffmpeg mode.

## v1.13.73 — August 2026

### Player: ffmpeg engine respected, sound detection in under a second, audio track selection in ffmpeg mode

- **Fixed**: When the **ffmpeg** engine is selected in Settings → Plex, the player sometimes restarted direct playback instead of local remuxing — the engine choice was not factored into the strategy calculation. Now, ffmpeg engine = ffmpeg remux for all files (the ⚡ button also re-muxes instead of direct playback), with HLS as a last resort if ffmpeg is unavailable.
- **Improved**: The direct playback silence detection now detects a silent audio track in **under a second** (800 ms window) instead of 6 s, then escalates to **local ffmpeg remuxing** (audio transcoded to AAC, video copied) before falling back to Plex transcoding. The verdict is only given once decoding has actually started, to never confuse a slow start with actual silence (no regression for compatible videos).
- **New**: Audio track / subtitle menus are now available when the ffmpeg engine is active — direct audio language change (remux session reloaded with the correct track, position preserved), and automatic switch to the HLS (Plex) leg when a subtitle is requested (local remux does not embed any subtitles).

## v1.13.72 — August 2026

### New: Preferred audio language setting for the player

- **New**: Settings → Plex now offers a preferred audio language for the default track selection during playback (French, English, Spanish, German, Italian, Dutch) — on "Automatic" (default), it follows the interface language as before; an account that uses Movviz in French but prefers English audio can now specify this explicitly, without changing its interface.

## v1.13.71 — August 2026

### The audio track in the interface language was chosen... then silently overwritten by another track of the same codec

- **Root cause confirmed live** (Jurassic Park 499959, two AC-3 French/English tracks): the French track was correctly selected — both by the new language rule and by Plex's "selected" itself — but an older fallback mechanism (designed to escape a truly undecodable codec, e.g., DTS → AC-3) never checked if the fallback track had a truly different codec. Since both tracks in this movie were in AC-3, this fallback "succeeded" by switching to the other track (English) simply because it wasn't excluded — without providing any additional compatibility, silently overwriting the correct French choice.
- **Fixed**: The fallback now requires a codec that is truly different from the already rejected track.

## v1.13.40 – v1.13.70 — August 2026

### Video playback: multi-level fallback chain, local ffmpeg remux, upgraded player

- **New**: Playing a file now goes through a multi-level fallback chain, each automatically tried based on what the browser can actually decode — direct playback → MSE (bit-exact copy, custom MP4 parser) → **local ffmpeg remux** (new engine, takes over for any container/codec the MSE parser doesn't handle, especially MKV) → DASH/HLS (Plex transcode, last resort). The ffmpeg remux retrieves the raw source file directly from Plex and remuxes it itself (zero CPU cost video copy, audio copied or transcoded to AAC depending on the codec) — zero dependency on Plex's transcode decision, which proved to be an undocumented and externally uninfluencable internal heuristic (refusing to copy the HEVC bitstream to HLS regardless of the parameter sent from the client, regardless of the variant tested).
- **Fixed**: The DASH protocol is now used for any HEVC/AV1 source or any transcode session — it is the only protocol where Plex honors the HEVC bitstream copy (HLS systematically re-encodes these sources, even in "audio only" mode, which was the real cause of the perceived lag). The client profile declared to Plex ("Plex Web") now covers HEVC/AV1 for HLS AND DASH, and both the "Transcoded (audio)"/"Transcoded (video)" menu modes — time-reversed — point to the correct Plex behavior.
- **Fixed**: Several audio decoding pitfalls identified and resolved in real-world conditions — AC-3 copied into a progressive MP4 is not natively decoded by Chrome/Edge (different context than hls.js/MSE transmux, fixed by restricting the remux copy to universally decodable codecs and transcoding the rest to AAC), and Dolby Digital(+) cannot be detected by the silence monitor (it relies on the Web Audio graph, out of reach for these codecs) — each of these cases is now correctly detected or avoided rather than producing silent playback with no visible error.
- **Fixed**: Pipeline robustness hardened through real-world testing — race conditions in the MSE engine and in ffmpeg sessions (buffers, seeking, clean server stream shutdown when the client abandons, including a case that could crash the entire server), reliable duration and playback position for the ffmpeg stream (fragmented container with no known duration on the client side).
- **New**: the player now selects the default audio track according to the Movviz interface language (same rule as the audio badge), only activates subtitles automatically if no audio track matches that language, displays a preview thumbnail on hover over the progress bar (relayed from Plex, which already generates it for its own player), and manages new keyboard shortcuts (volume, direct jump by percentage) in addition to existing shortcuts (play, ±10s, fullscreen, mute, close).

## v1.13.65 — August 2026

### The Hero always pinned the same titles

- **Fixed**: pools without a natural order (personalized suggestions, discovery, never watched) are now shuffled with a deterministic seed per day and per user — rotation every 24h instead of the same 2-3 pinned titles indefinitely; chronological pools (recentlyAdded, upcoming, recentActivity) are not affected.

## v1.13.63 — August 2026

### A series with a single "upcoming" episode was displayed as missing — the series card ignored the "upcoming" status

- **Root cause confirmed**: `LibrarySeriesCard` calculated series completeness with `available === monitored.length`, counting episodes not yet aired ("upcoming") as if they should already be available — a fully downloaded series with a single un-aired episode thus defaulted to the amber "missing" badge, even though `SeasonAccordion`, `TitleContent`, and the Library page already correctly treat "available OR upcoming" as complete.
- **Fixed**: the series card now applies the same rule as everywhere else in the app.

### "Search and replace" suggested replacing a file with an almost identical file when the current language was unknown

- **Live root cause confirmed**: when the language of the owned file is unknown (undetected), any release cached in the target language (French) was suggested as an "improvement," without ever checking if it provided anything real — the same resolution, the same codec (x264≈H.264, x265≈HEVC displayed differently but identical) and a nearly identical size still triggered a replacement suggestion. The existing safeguard (`isMeaningfulUpgrade`, size difference ≥ 10 %) was explicitly bypassed for this specific case; for series, this safeguard simply did not exist.
- **Fixed**: language-based suggestions now require the same minimum size difference (10 %) as other types of improvements, for both movies and episodes — suggestions for actual resolution/codec are not affected.

## v1.13.39 — August 2026

### Added an opt-in toggle for YouTube trailer search — off by default explains why trailers stayed in English

- **Added**: the YouTube search fallback for trailers (used whenever TMDb has none in the viewer's language) is a page scrape, not an official API — it depends on YouTube not rate-limiting the server's IP, and a single silent failure gets cached for 24h, so it was always off by default. That default is why trailers kept showing in English despite the mechanism existing and working correctly when tested directly. A new toggle in Settings → Dashboard ("Trailers") turns it on — off by default still, but now an explicit, visible choice instead of a silent one.

### Titles stuck "searching" gave the "Downloading" tile a nonzero count with nothing there to explain it

- **Added**: instead of just no longer counting "searching" items as downloading (last release), they now get their own dedicated "Searching" dashboard tile — so that number doesn't just disappear, it moves to where it actually belongs.

---

## v1.13.36 — August 2026

### The "Downloading" dashboard tile could show a nonzero count with nothing actually downloading

- **Fixed**: the tile counted episodes/movies still "searching" (actively looking for a release, no torrent grabbed yet) as if they were downloading. Confirmed live: a whole season stuck in "searching" with no active torrent inflated the count to 9 while zero downloads were actually running. The tile now only counts items with a real active download.

### A title's play button could disappear entirely with no explanation

- **Fixed**: the watch button on a title page was gated entirely on Plex having already linked the file — a file Movviz already has ready, but that Plex hasn't scanned into its own library yet (a normal async timing gap), showed no button at all instead of something explaining the wait. It now shows a clearly disabled placeholder with a tooltip instead of vanishing.

### Two unrelated title-page buttons shared the exact same icon

- **Fixed**: "manage versions" and "view saga/collection" both used the same stack icon, confusing on a title that has both. The collection link now uses a visually distinct icon.

---

## v1.13.34 — August 2026

### The same notification could keep firing for content that had been available for days

- **Fixed**: notifications were never deduplicated — a scheduled job re-scanning content it couldn't fully clean up after import could re-emit the exact same "now available" notification every run, confirmed live with a season-available notification repeating every ~30 minutes for a title that had actually been available for a week. The same notification kind with the same details now only fires once within a one-hour window; a genuine repeat further out (e.g. days later) still comes through normally.

### The "Classic" dashboard mode was reworked to match "Cinema" minus the hero

- **Changed**: Classic mode now reuses everything Cinema mode offers — the compact stat pills and the full row layout (Tendances, Suggestions adaptées, Ajouts récents, etc.) — just without the large hero banner at the top, per feedback. It previously fell back to a bare stat-tile grid and a flat "recently added" list with none of Cinema's rows.

---

## v1.13.33 — August 2026

### Added a manual seed toggle for completed downloads

- **Added**: a completed download in the queue now has a dedicated button to start or stop seeding it, independent of the pause/resume controls used for active downloads. Turning it off genuinely halts upload activity rather than just hiding a status — for the default download engine this fully detaches the torrent from peers; turning it back on re-establishes it, rebuilding the original file layout as needed if the files were already moved into the library, without ever touching or re-downloading the library copy.

### Poster row titles weren't centered under their cards

- **Changed**: the title under each poster card in the dashboard rows (Tendances, Suggestions, Ajouts récents) is now centered under the poster, per feedback — previously it could sit off-center, especially in the ranked Top-10 row.

---

## v1.13.32 — August 2026

### Downloads never showed a time remaining

- **Fixed**: the queue's "temps restant" (ETA) field was only ever computed by two of the three download-engine backends — the default one (the engine actually used day to day) never passed a `timeRemaining` value through at all, so the field was always empty in the queue view. It's now computed the same way the other backends already do (remaining bytes over current speed), so an active download shows a real estimate.

---

## v1.13.31 — August 2026

### A working file path could get silently overwritten by Plex's own view of the filesystem

- **Fixed**: on every Plex sync, an already-correct, working file path for a movie or episode could be overwritten by whatever path Plex itself reports for that file. When Plex and Movviz run in separate containers with different volume mounts for the same physical media, Plex's reported path doesn't exist from Movviz's own filesystem view — so a perfectly good, working path silently turned into a broken one, flooding "Repair paths" with false positives for titles that were never actually broken. Movviz now learns the correspondence between Plex's path layout and its own automatically — by comparing, for a title it already tracks correctly, its own verified working path against what Plex reports for that exact same title — and translates future Plex reports through that learned mapping instead of trusting them blindly. No settings screen, no manual configuration: it deduces the mapping itself from data it already knows for certain. A path is only ever written if it's independently verified to exist on disk first — a wrong or stale mapping can at worst produce a false "missing" flag (recoverable by hand), never a silently lost reference to a real file.

---
## v1.13.30 — August 2026

### "Repair paths" could suggest hundreds of completely unrelated files as candidates

- **Fixed**: when a broken episode file couldn't be found by its exact recorded filename, the last-resort fallback matched it against every video file in the whole library sharing the same season/episode numbers — regardless of which show it actually belonged to. Confirmed live: a single broken episode could come back with 500+ "candidates" that were really just every other show's own episode 1, episode 2, etc. This fallback now only offers files that plausibly belong to the actual series (by filename or folder name), so the suggestion list is short and relevant again. Present since v1.12.86 — not something changed in this recent batch of fixes, and no other matching path (exact filename, expected-path, or the duplicate-conflict warning) was touched.

### Trending row's Top-10 numerals overlapped too much of the poster

- **Changed**: the ranking numeral behind each Top-10 card in the "Trending" row sat too far under the poster, leaving only a sliver visible to the left. It now overlaps far less — most of the number is visible to the left of the card, with just its trailing edge tucked behind, per feedback.
- **Changed**: the "Trending" row now shows first on the dashboard, above "Recently Added", per feedback.

### Collection "download missing" could grab the wrong title instead of the actually missing one

- **Fixed**: two compounding bugs, both confirmed live across several collections. First, the button computed which titles were missing from a shared, app-wide cached library/collection snapshot that could be stale with nothing visibly wrong on screen — both the library and the collection's part list are now re-fetched fresh right before downloading. Second, and the more consequential one: a duplicate-detection guard meant to catch TMDb listing the same released film under two ids used fuzzy title matching with no real year requirement — it could silently reuse an unrelated, already-owned entry for an unconfirmed franchise placeholder, or confuse a real film with a same-franchise featurette a year off with an extra title suffix. That guard now requires an exact normalized title AND an exact, confirmed release year on both sides before ever trusting a match.

### Friend accounts were all getting the server owner's own Plex watch history

- **Fixed**: every linked friend account carried a genuinely distinct Plex identity and token, yet all of them synced the exact same watch counts as the account that owns the server. Root cause confirmed against Plex's own documented behavior: the endpoints used to sync watch status report `viewCount` from the server owner's perspective only, regardless of which valid account's token makes the request — no request header can change that. Watch-status sync now uses Plex's session-history endpoint instead, queried with the admin token and filtered by each account's own Plex id — the way Plex actually tracks per-account viewing — working the same for friend accounts and Home-managed profiles now, instead of two separate paths.

## v1.13.22 — August 2026

### "For you" recommendations are strictly per-account again, and a Plex watch-sync failure no longer looks like "watched nothing"

- **Changed**: reverted v1.13.21's household-blending — after more feedback, "For you" is back to being built ONLY from an account's own Plex watch history, with no signal from any other account, even a small one. An account with just a couple of watched titles now gets a personalized row from those alone, instead of needing a minimum before anything shows.
- **Fixed**: the Plex watch-status sync silently swallowed every error (network hiccup, expired token, unreachable section) and saved an empty result regardless — indistinguishable from "this account genuinely hasn't watched anything," and capable of quietly erasing real watch history on a transient failure. It now leaves existing data untouched when a sync can't reach any library section, and every sync attempt — success or failure, and for which account — is logged to Settings → Logs, so a silently-failing account is finally visible instead of just looking empty.

### "For you" recommendations can now draw on the whole household's Plex history, not just your own

- **New**: when an account's own Plex watch history is thin or empty, its "For you" row now also blends in what other accounts on the same instance have watched (weighted lower than the account's own history) — so someone without their own Plex link can still get a real, personalized row instead of the flat generic "top rated" fallback. This only kicks in once at least two other accounts have real watch data of their own — a single other account's taste is never used as a stand-in "household" signal, to avoid quietly cloning one person's picks onto someone else. Each account's own row stays exactly as personal as before; this only ever adds a broader signal on top, never replaces the account's own history when it's already there.

### Episode titles and descriptions always came back in French, regardless of the interface language

- **Fixed**: the season/episode data call (thumbnails, titles, descriptions — added in v1.13.12 and extended to owned series in v1.13.19) never told TMDb which language to answer in, so it silently defaulted to French for every user, even with English (or any other) selected as the interface language. This was the exact same bug already fixed once for title detail pages — just never applied to this specific call. It now follows the app's selected language like everywhere else.

### Episode thumbnails and descriptions now show up everywhere, not just for series you don't own yet

- **Fixed**: v1.13.12 added a thumbnail and short description to each episode row, but only for series not yet in your library — episodes of series you already own showed as plain text rows with no preview at all. Both views now pull from the same live TMDb data, so a downloaded/available episode shows exactly the same preview as one you haven't grabbed yet — with none of the existing quality badges, watched marker, status pill, or search buttons removed.
- **Fixed**: episode air dates in that same list rendered in your browser's own locale format regardless of Movviz's selected language (e.g. showing the US month/day order even with French selected) — now consistently follows the app's language, like every other date in Movviz.

### Retrying a partially-imported season pack could try to rename its leftover .nfo into an episode file

- **Fixed**: once every real video file in a season pack had already been matched and moved on an earlier partial run, a retry would find zero video files left and fall back to treating any remaining file — including the release's `.nfo` — as "the episode to import," attempting to rename it to something like `S03E02.nfo` and failing outright once that didn't match what was actually on disk. Leftover `.nfo`/`.txt`/image/checksum files are never episode content and are already cleaned up automatically once import finishes — they're now excluded from that matching entirely instead of causing a failed, user-visible import error.

## v1.13.17 — August 2026

### The slowdown logs you were told about now actually show up in Settings → Logs

- **Fixed**: the search-diagnostics log could fill up its 2000-line buffer in a few minutes during heavy background passes (each episode search writes ~10 lines, several of them debug), silently pushing out the important info lines — including the new background-slowdown lines. The buffer now holds 4000 lines, so `priority.yield` entries survive the noise.
- **New**: the log panel in Settings → Logs now tails live — it refreshes every 5 seconds while the tab is visible, so lines written by background work appear as they happen instead of only after a manual refresh. No re-render when nothing changed.
- **Fixed**: all log sources now live in one place — the transcode log panel moved from the Diagnostics tab to Settings → Logs, which now shows search/diagnostic, engine, resolver and transcode logs together.
- **Changed**: background-slowdown log lines now get their own color in the panel, so "Arrière-plan bridé [bulk manquants]…" entries stand out at a glance.

## v1.13.16 — August 2026

### Background slowdowns are now visible in the logs — with the user responsible

- **New**: background work (the manual "search everything missing" bulk, scheduled RSS matching, quality upgrades, missing-release retries) now pauses whenever you're actively using the app and resumes a few seconds after you stop — you never feel it. Every time such a slowdown actually happens, the diagnostics search log records it in one clean, readable line: which background task was bridled, which user was active (name + id), and how long the wait lasted (e.g. "Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1)").
- **Fixed**: silent frontend polling no longer counts as user activity. The status polls (engine torrents every 500ms, jobs every 2s, perf metrics every 5s, Plex activity every 5s, playback progress every 10s…) kept the app marked as "active" forever as soon as a single page was left open — so background work never properly resumed. Only real interactions count now (navigation, searches, clicks): leave the app open and background resumes a few seconds after your last click.
- **Changed**: the manual bulk search now runs in the background lane like the scheduled tasks — it inherits the reduced indexer quota (your own searches keep priority) and yields between items.

## v1.13.15 — August 2026

### Top nav stayed solid after scrolling back to the top

- **Fixed**: the transparent-to-solid top navigation bar added in v1.13.12 correctly turned solid once you scrolled down, but scrolling back up to the very top never reverted it back to transparent. Switched to a more reliable detection method so it now correctly reflects scroll position in both directions.

## v1.13.14 — August 2026

### Dashboard rows can now open a full grid — "See all" was never actually wired up

- **Fixed**: the dashboard's carousels ("For you", "Recently added", "Coming soon", "Trending") had a "See all" affordance built into the row component itself, but no dashboard row was ever passing it a destination — so it silently never appeared, on any row, since this part of the dashboard was first built. Rows stay exactly as compact horizontal strips; "See all" now opens the full set as a real, filterable grid (Discover for recommendation/trending rows, your Library — pre-filtered to match — for rows drawn from what you already own).

## v1.13.13 — August 2026

### Beta player is now a personal choice per account, off by default

- **Changed**: previously the Beta player had a single on/off switch for the whole instance — one admin turning it on silently switched playback behavior for every account. There are now two layers: an admin toggle in Settings that just makes the feature available at all, and a personal toggle in each user's own Profile page that actually turns it on for their account — off by default, regardless of what the admin has set.

## v1.13.12 — August 2026

### Six browsing improvements, picked from a design review

- **New**: rows now show a thin scroll-position indicator and hover-revealed edge arrows, and scroll by a full page instead of free-dragging.
- **New**: the "Trends" row now highlights its top 10 with a numbered ranking treatment, using the same real popularity order the row was already sorted by.
- **New**: hovering a poster card (desktop) now briefly shows year, runtime, and genre tags when available, instead of nothing.
- **Changed**: the top navigation bar is now transparent at the very top of the page and becomes solid as soon as you scroll.
- **Changed**: the episode list for a title not yet in your library now shows a thumbnail and a short description per episode, not just a bare row. (Episodes for titles already in your library don't have this yet — that needs new data collected at import time, tracked separately.)
- **New**: on mobile, the dashboard hero now uses dedicated portrait artwork instead of a cropped-down version of the desktop banner.

## v1.13.11 — August 2026

### Display personalization now follows your account, not just your browser

- **Changed**: GPU performance profile, animations, theme (light/dark/auto), interface language, and library view density were all saved to the browser only — switching devices or browsers reset every one of them back to default. They're now saved to your account and follow you anywhere you sign in, while still applying instantly on the device you're on.
- **Moved**: the "Animations" toggle now lives in Settings → Performance GPU, next to the profile it actually affects, instead of under Dashboard.

## v1.13.10 — August 2026

### Mobile bottom nav buttons that only worked when tapped above the icon

- **Fixed, confirmed live**: on mobile, tapping the Calendar/Requests/More tab buttons directly often did nothing — but tapping just above them worked. Root cause: the toast-notification container is mounted everywhere and stays in the page at all times, even with zero notifications showing. Its mobile layer spans the full width of the screen, sits right on top of the bottom tab bar, and is invisible — but an invisible element still blocks clicks underneath it unless explicitly told not to. Taps landing in that overlap silently hit nothing instead of reaching the tab button.
- The invisible container no longer blocks anything underneath it; only an actual visible notification (which is rare and brief) is still tappable/dismissible, exactly as before.

## v1.13.09 — August 2026

### The Blood+ matching fix from v1.13.06 never actually took effect — found the real reason

- **Fixed, confirmed live**: v1.13.06 fixed the title-matching function to treat "+" as the word "plus" (so "Blood+" wouldn't be confused with unrelated shows). But manual search still showed "Blood Of Zeus", "Dexter New Blood", "Blood-C" and others as valid candidates for "Blood+" — because a completely different, earlier step (the one that turns a search box query into the actual text sent to indexers) was stripping the "+" before the fixed matching function ever got to see it, silently undoing that fix for every real search. A search for "Blood+" was arriving at the matcher as the bare word "Blood", which of course matches nearly anything with "Blood" in the title.
- That earlier step now preserves "+" and "&" as words too, the same way the matching function already did — closing the actual gap, not just the one function that looked like the source of the problem.

## v1.13.08 — August 2026

### Accordion seasons — episodes visible even without library

- **Improved — episode list available for non-followed series**: the season accordion displayed "Not yet in library" when the series was not in the library. Episodes (number, title, air date) are now loaded from TMDb on demand (lazy, cached by SWR) as soon as a season is opened — with no impact on series already in the library whose rendering remains identical. A loading skeleton is displayed during the request.

---

## v1.13.07 — August 2026

### Correction changelog v1.13.05

- Removal of an incorrect entry: the red square visible in the ARM screenshot was a user-drawn annotation to indicate the problematic area, not a real UI visual bug.

---

## v1.13.06 — August 2026

### Matching fix — titles with `+` (Blood+, C+C Music Factory…)

- **Fixed — matching false positive on titles containing `+`**: the `+` was removed by normalization (only `a-z0-9` are kept), reducing for example `Blood+` to `blood`. Since this word alone is contained in `Blood of Zeus` → `blood of zeus`, the series obtained a score of 0.85 (above the 0.72 threshold) during a manual search for Blood+. The `+` is now converted to ` plus ` before cleaning in `normalizeTitle`, making `Blood+` → `blood plus` and `Blood of Zeus` → `blood of zeus` — two distinct strings that no longer merge. Releases named `Blood Plus` now correctly match `Blood+`. Fix applied in `matching.ts` and `releaseMatchWorker.mjs`. Non-regression test added.

---

## v1.13.05 — August 2026

### Seasons accordion fix — ARM browser compatibility

- **Fixed — accordion blocked on ARM Docker (second pass)**: the CSS `gridTemplateRows` transition is not supported in all ARM browsers. Replaced with `max-height: 0 → 9999px` with `overflow: hidden`, a universal technique supported since IE9 — works without ResizeObserver, without animation JS, without Framer Motion.

---

## v1.13.04 — August 2026

### Seasons accordion fix ARM Docker (deep investigation)

- **Fixed — seasons accordion blocked on ARM Docker**: Framer Motion interprets and animates `gridTemplateRows` via JS, which can fail on ARM runtimes. The animation is now entirely managed by the browser's CSS engine: inline transition on `gridTemplateRows` + `opacity`, without any external JS dependency. The inner div receives `min-h-0` to ensure the CSS Grid row truly collapses to 0. The content is still present in the DOM (hidden by the grid), which also eliminates the case where `libSeason` undefined made the expansion silently empty — when a series is not in the library, a localized message is displayed instead.

## v1.13.03 — August 2026

### Seasons accordion fix ARM/QEMU

- **Fixed — seasons accordion blocked on ARM Docker**: the opening animation for seasons relied on `height: "auto"` via Framer Motion, which measures height via `ResizeObserver`. On ARM Docker (Mac Apple Silicon / QEMU), `ResizeObserver` returns 0 on first render, making the animation invisible and the episode list inaccessible. The animation now uses `gridTemplateRows: "0fr" → "1fr"`, a pure CSS interpolation without DOM measurement — works identically on x64 and ARM.

---

## v1.13.02 — August 2026

### 2FA C411 Information

- **Added — 2FA warning in C411 form**: c411.org accounts with two-factor authentication (2FA) enabled cannot use the Discover lists (each new session would require a code). An informative note is now displayed under the username/password fields to signal this limitation. 5 locales.

---

## v1.13.01 — August 2026

### Animations and TVDB fixes

- **Fixed — cinema mode disabled by animations toggle**: disabling animations in Settings → Dashboard also cut off video playback in cinema mode (hero cinematic + title header). The two settings are now independent: disabling animations removes decorative transitions/effects without ever blocking the ambiance video playback, which is controlled only by its own autoplay toggle.
- **Fixed — TVDB status badge missing in Animated tab**: after moving the TVDB key to the Metadata tab in v1.13.00, the "TVDB configured / not configured" badge had disappeared from the Animated tab — the toggle seemed inactive without any visual feedback on the key's status. The badge is restored in the Animated tab (read-only), with a link to the Metadata tab to enter or modify the key.

---

## v1.13.00 — August 2026

### Refactor history, year matching, TVDB in Metadata, event loop, bottom nav mobile

- **Redesign — History page**: timeline grouped by date (Today / Yesterday / This week / This month / Older), cards with colored border according to status, failure entries in red with error message displayed directly (no click), staggered entry animations, illustrated empty state, event counter, automatic refresh every 10 seconds. Fully translated into 5 languages (status labels, date groups, system, score, details).
- **Fixed — matching: year tolerance extended to ±2**: physical releases (Blu-ray/DVD) published up to two years after the original cinema release were rejected by the year filter (e.g., Tafiti, German film 2024 with French Blu-ray release 2026). The tolerance increases from ±1 to ±2 in `releaseMatchWorker.mjs` and `matching.ts`, which also activates the already present containment bonus for titles truncated by scene releases.
- **Moved — TVDB API key from Anime tab to Metadata tab**: logical grouping with TMDb and OMDb. The Anime tab retains both toggles (use TVDB / special episodes) and the synchronization panel. The navigation hints for both tabs are updated. 5 locales.
- **Simplified — event loop text in Performance**: replaced with a clear one-line phrase (main thread latency, green = OK, red = overloaded). 5 locales.

---

## v1.12.98 — August 2026

### Mobile fix — bottom navigation bar hitbox

- **Fixed — non-clickable buttons at the bottom of the mobile navigation bar**: On iPhone with a home indicator (safe-area ≈ 34 px), the safe-area `paddingBottom` was applied to the `nav` container instead of each button. With `items-stretch`, children only fill the content area of the nav (excluding padding) — the bottom safe-area was visually covered by the bar's background but did not belong to any clickable element. Padding is now applied to each button with `max(0.5rem, env(safe-area-inset-bottom))`, which extends the hitbox to the bottom of the screen while keeping the icon and label centered in the visible area.

---

## v1.12.97 — August 2026

### Fix C411 TMDb ID collision + scene release matching improvement

- **Fixed — TMDb ID space collision in C411 lists**: TMDb uses two distinct ID spaces (films and series) that overlap — the same number can refer to both a film and a different series. Until now, the first found result (film side) was kept without verification, which could display a film record instead of a series. The resolution now uses a **title + year hint** provided by C411: when an ID exists on both sides, the title and year stored in the list allow selecting the correct space. The cache is versioned (v2); old entries without a version are ignored and recalculated to prevent an erroneous verdict from surviving the 30-day TTL.
- **Improved — scene release matching with truncated subtitle**: Scene releases often omit the official subtitle (e.g., "Tafiti" instead of "Tafiti - Ab durch die Wüste"), which penalized the score by 0.50 below the matching threshold. A containment bonus brings the score back to 0.85 when the release title is entirely contained within the official title **and** the year is compatible — different homonymous films released in another year remain rejected.

---

## v1.12.96 — August 2026

### Discover — refined recommendation section label

- **Refined — recommendation section**: The label for the first line of the Discover page changed from "For you & best" to **"Selection for you"** — more readable, cleaner, without an awkward conjunction. Translated into 5 languages.

---

## v1.12.95 — August 2026

### Windows uninstaller repaired, Docker container repaired, wizard completed, C411 login clarified

- **Fixed — Docker container in restart loop**: On startup with PUID/PGID different from the image's default values (the standard case for a NAS), `docker-entrypoint.sh` deleted the `movviz` group **before** its user — busybox refuses to delete a group that is the primary group of an existing user ("group in use"), so the following `addgroup` also failed, and the container died in a loop with "addgroup: group 'movviz' in use" repeated on each attempt. The order is corrected (user before group, at each step) and the script now cleanly releases the requested UID and GID, even when the target group is locked by its owning user. The published amd64+arm64 image is regenerated with this fix.
- **Fixed — Windows uninstaller crash**: The installation would end with a runtime error "Cannot call CreateInputOptionPage" when launching the uninstallation (this function does not exist in the Inno Setup uninstaller runtime, only in the installer runtime — it was introduced with the question "delete personal data?" in v1.12.91). The question is now asked via a native confirmation box at the end of the uninstallation, **by default NO**: nothing is ever deleted without explicit confirmation, always in 5 languages, and the data (ProgramData) are kept by default to allow for a complete reinstallation.
- **New — wizard**: The final step displays an "Account Activation" card explaining that the administrator account is already active and that subsequent accounts (registration or Plex) must be approved in Settings → Users.
- **Clarified — C411 indexers**: The label "Site credentials" now specifies in parentheses that the login is optional (it is only used for the Discover lists; searching works without it).

---

## v1.12.94 — August 2026

### Discover revamped — merged lists, strictly separated series and movies

- **Fixed — series/movie mix**: The c411.org lists (Popular / Recent Uploads / Today's Releases) displayed a mix of movies and series in both tabs. They are now filtered by the active tab (Movies or Series), when displayed as in "See All".
- **New — merged lists**: The sections on the Discover page are grouped with de-duplication (a title no longer appears twice):
  - "For you & best" (suggestions + top-rated)
  - "Trending & popular" (Movviz layout)
  - "In theaters" (now showing + box office) and "Coming soon & VOD" (Allociné layout, movies)
  - "New & returning" (Allociné layout, series)
  - From 11 to 7 sections in Movviz layout, from 14 to 9 in Allociné layout (movies) and from 11 to 7 (series). Each merged section has its paginated "See All" (10 min cache).
- **Removed — Genre tiles**: The row of genre tiles (duplicate of the genre filter in the bar) has been removed.
- **New — multi-arch Docker builds**: The images published on Docker Hub are again built for `linux/amd64` **and** `linux/arm64` (QEMU + buildx reactivated).

---

## v1.12.93 — August 2026

### Indexers — real status, key in memory, and connection diagnostics

- **New — C411 diagnostics**: The "Site credentials" section of the C411 pencil now displays the real server status (active or inactive lists, with the concerned login) and a "Test C411 connection" button that performs a real login with the registered credentials. In case of incomplete configuration, a detailed diagnostic indicates exactly what is missing (lists / username / password). The silent failure "I entered my credentials but nothing is displayed" is therefore visible and identifiable.
- **New — key in memory**: The "Show categories" button of an already configured indexer no longer asks to re-enter the API key — it is automatically retrieved from the server (the browser never sees it), and a note "Key saved — used automatically" indicates this. Also works for the credentials mode.
- **New — "Test connection" button** on each indexer: checks the URL and credentials in one second and displays the result (OK or the indexer's error).
- **Fixed — silent save** : the form no longer accepts failing silently — if the save fails on the server side, the error is displayed and the form remains open.
- **Fixed** : the catalog key (e.g., `c411`) is now also saved during an update, not just upon creation.

---

## v1.12.92 — August 2026

### Crayon C411: Editable site credentials

- **Fixed** : on the pencil icon, the "Site credentials (Discover lists)" section (login, password, list toggle) was never displayed on an already configured C411 indexer — the "C411" identity was lost upon saving: only `kind: "torznab"` and the URL were kept, and the form only recognized the indexer by its `kind`.
- **New** : the catalog key (e.g., `c411`) is now persisted on the indexer upon creation, and existing indexers are recognized by their catalog URL (fallback). The credentials section therefore appears during editing as well, and the "Discover lists" toggle is no longer lost upon creation (it is now saved from the initial POST).

---

## v1.12.91 — August 2026

### c411.org integration to the Discover page

- **New** : three lists from the c411.org site are displayed in the Discover tab — "Popular on C411", "Recent Uploads on C411", and "Daily Releases on C411" (movie/video category only). Account credentials are saved in Settings → Indexers → C411 ( "Site credentials" section), and each list can be enabled or disabled independently.
- Automatically managed session (connection with CSRF, TTL 25 min, fallback on a second attempt), spaced requests to avoid being blocked, and TMDb resolution of releases with a 30-day cache: a title is only suggested from a minimum score (exact title or year + type), zero false positives.
- **Fixed — release name parsing** : underscores used to become dots before tag parsing, "AD" is only recognized in uppercase (movies like "Ad Astra" are no longer mutilated), "5.1" channels and release groups are ignored, "10.bits" becomes 10BIT.

### Edit pencil on all indexers

- **New** : every configured indexer (Torznab, C411…) has a pencil icon to edit its settings without recreating it — the form displays existing secrets masked and does not overwrite them if the field is left empty.

### Windows uninstaller — choice to delete personal data

- **New** : uninstallation explicitly asks, via a checkbox, whether all personal data (libraries, history, downloads, settings — stored in ProgramData) should be deleted. Unchecked by default: a reinstallation keeps everything, as before. If checked, an additional confirmation protects against any accidental deletion. Screen in 5 languages.

### Cinema mode — "on hover" option removed

- **Cleanup** : triggering the "on hover" trailer for the cinematic Hero did not work reliably; the option has been removed from the settings (only "Disabled" and "Automatic" remain) and the hero hover logic has been removed.

---

## v1.12.90 — August 2026

### Single-season series cut into "parts" (DVD order) — automatically assembled

- **Fixed** : releases of a single-season series cut into multiple parts in DVD order (e.g., Disjointed: 1 season of 20 episodes, released as "S01.PART.01" + "S02.S01.PART.02", or simply "S01" + "S02") were never matched — the announced season number (S02) did not correspond to any season in the library, so episodes 11-20 remained unfindable on the indexers.
- **New**: detection of the "PART.N" marker in the release name (`S01.PART.02`, `Part 2`...) and fallback for single-season series: an S02 release (or part 2) covers the episodes of the second half of the season (11-20 for 20 episodes). The engine file selection and import are translated into the same numbering, so that `S02E01…E10` land correctly on S1E11-20.
- **Guardrails**: only single-season series; any multi-season series keeps its exact matching unchanged (a real season 2 is never reinterpreted as a part). Movies are not affected.

---

## v1.12.89 — August 2026

### Episodes TBA treated as "upcoming" — series with an announced but undated season are complete

- **Fixed**: an episode without an air date but with the placeholder title "TBA" (TVDB/TMDb pre-created these episodes for announced seasons, e.g., Gachiakuta S2) was treated as aired → `missing` → searched endlessly on indexers. Rule now in two distinct conditions: future date → "upcoming"; no date **and** TBA title → "upcoming" as well. An episode without a date with the real title keeps the historical behavior (searchable).
- **Fixed — series/season status calculations**: a series where everything remaining is "upcoming" (TBA or future dates) is now **complete** ("available") everywhere — library page, detail, discovery, requests, calendar — and naturally disappears from missing searches (search all, retries 6h, RSS). A series entirely "upcoming" remains displayed as "upcoming".
- Applied everywhere: series creation (TMDb + TVDB anime), season 0 backfill, TMDb season repair, Plex sync (creation + update), daily date transition task.

---

## v1.12.88 — August 2026

### Enhanced Plex diagnostic + external GUIDs explicitly requested from Plex

- **Added** — `GET /api/plex/diagnostic?title=...` now displays the raw GUID and the `Guid[]` array as reported by the list AND by the detail (`/library/metadata/{ratingKey}`), plus the tmdbId resolved by the sync logic — allows explaining why a media is not linked.
- **Improved — Plex sync**: list requests now include `includeExternalMedia=1`, the Plex parameter that populates the `Guid[]` array (tvdb://, imdb://, tmdb://) directly in the `/all` responses.

---

## v1.12.87 — August 2026

### Plex linking extended to legacy GUIDs + Plex diagnostic

- **Fixed — Plex sync**: GUIDs in legacy format (`com.plexapp.agents.thetvdb://80741?lang=fr`, pre-2021 agents) were not read — only the modern `Guid[]` array was read. These series could never be linked, even with the v1.12.86 `/find` resolution. The legacy `guid` field is now parsed as well (`thetvdb`/`imdb`/`tmdb`).
- **Added — diagnostic route** `GET /api/plex/diagnostic?title=...` (admin): displays for each matching Plex title the type, ratingKey, raw GUID, `Guid[]` array, and tmdbId resolved by the same logic as the sync — allows explaining why a media is not linked.

---

## v1.12.86 — August 2026

### Plex linking corrected for media without TMDb GUID + enriched linking tool

- **Fixed — Plex sync**: identifier resolution only read `tmdb://` GUIDs reported by Plex. Media matched by the Plex agent only with `tvdb://`/`imdb://` (Canadian series, old agents, etc.) were **silently ignored** — files present on disk and visible in Plex, never linked in Movviz, and the linking tool found nothing to repair (no path was recorded). **Fixed**: `imdb://`/`tvdb://` GUIDs are now resolved to TMDb via `/find` (cached like other TMDb calls), and in case of TMDb duplicates for the same title, the entry already present in the Movviz library is prioritized. Confirmed in production on "The Heart Has Its Reasons": the `tvdb://80741` GUID resolves to tmdb 2903 (2005), present in the library.
- **Improved — file linking** (`repair-paths`): when the saved filename no longer exists anywhere on the disk, the tool now also suggests files whose names contain the same `SxxEyy` (manual confirmation candidates — never automatic linking on this criterion).
- **Docs**: "Movviz Federation" architecture plan archived in `docs/federation-plan.md`.

---

## v1.12.85 — August 2026

### Renaming engine bug fixed + isolation of missing search (quotas + cancellation)

- **Fixed — engine** (`AbstractBackend.mjs`): pack renaming bug — the shared info object (`releaseInfo`) was mutated by the target file resolution, and for any file without an episode number in the name, this same object was reused for subsequent files: the FIRST matched file then imposed its episode on all others. Confirmed in production on a full Trigun pack: 25 files renamed to `S01E03` (then `S01E04` on the 3rd import), E1 always overwritten. **Fixed**: the object is now cloned per file (`{ ...info }`) — reproduced locally with the 28 actual filenames from the pack, each file gets its own episode (E01-E26, unique). The redeployed engine will no longer rename an entire pack to the same episode.
- **Indexer quotas (anti-429)**: quotas per indexer reactivated (`c411.org` = 15 req/min documented, 20 req/min by default for any host) + new global limit of 40 req/min (60s sliding window). Applied BEFORE sending each request (`fetchXml`), so documented quotas are never exceeded. The grouped search "search for missing" can no longer self-impose 429s (measured in production: ~35 requests in ~35 s already triggered a 429).
- **Job cancellation**: new route `POST /api/jobs/[id]/cancel` (admin) + `requestCancelJob()`/`isJobCancelled()` in the queue + new `"cancelled"` status (clean settlement via `JobCancelledError`, flag purged at the end). Cooperative checkpoints at all levels of grouped search: between lot items, between seasons, between episodes — episodes not yet searched remain simply "missing" and will be retried on the next pass. A job in the queue is removed immediately; a job in progress stops at its next checkpoint (a few seconds).
- **UI**: The Queue panel displays cancelled jobs (dedicated icon + `jobs.statusCancelled` labels in 5 languages).

---

## v1.12.84 — August 2026

### Reliable import of season/full packs — no more empty "S01E" or overwritten files

- **Context (confirmed in production)**: a Noblesse season pack (20.3 GB) downloaded 100% only imported 2 episodes out of 13. The grab had no `episodeTargets` — the engine then imported ALL files blindly, and every file whose episode number was not identifiable was renamed with an EMPTY episode (`Noblesse - S01E.mkv`). Several files from the same pack then arrived at the same destination path and **overwrote each other** (the last one replaced the previous ones), leaving the unimported episodes "missing".
- **Fixed — engine** (`AbstractBackend.mjs`): when the episode number remains unknown after all fallbacks (filename, release, folder), the file now keeps its original name instead of the empty `S{season:00}E{episode:00}` template — unique name per file, no more collision or overwriting, and the file is always discoverable by the renaming tool. `avoidCollision()` is now applied to series (like to movies).
- **Fixed — manual grab** (`/api/indexers/grab`): a grab from a series/season page now passes `episodeTargets` to the engine (monitored "missing"/"searching" episodes), exactly like an automatic grab — the engine then only downloads/imports the targeted episodes.
- **Precision**: the library-side import has not changed — a file without an episode number is never wrongly assigned to an episode ("missing" until the link is resolved).

---

## v1.12.83 — August 2026

### Allowed words — a term present in the title cancels the forbidden word

- **New** : In Settings → Quality, an "Allowed words" section is added to "Forbidden words". If an allowed word is present in a release title, the corresponding forbidden word is canceled. Typical case resolved: a user uploaded an episode marked "VOSTFR" when it is actually a multi — `Arrow.S01E01.MULTi.VOSTFR+FRENCH.1080p...` with "VOSTFR" forbidden + "FRENCH" allowed is now accepted, while a simple VOSTFR remains rejected.
- **Application** : the logic resides in `matchesBlockedWord()` (`releaseRules.ts`), so all entries respect it — auto-search (torznab), decision guard, file import, download retrieval.
- **Match** : in case-insensitive substring, like forbidden words (note: "TRUEFRENCH" contains "FRENCH").
- Tests : 6 new cases in `scripts/allowed-words.test.ts` (23/23 green).

---

## v1.12.82 — August 2026

### Release 1.12.82 — encoding verified, CI pipeline re-run on a clean commit

- **Context** : the first push of v1.12.81 was done with a `package.json` corrupted by a UTF-8 BOM (`U+FEFF`) introduced by a PowerShell write — the CI build (`next build` via `build.ps1`) failed with `package.json is not parseable: invalid JSON: expected value at line 1 column 1`.
- **Fixed** : the encoding of all affected files (`package.json`, `README.md`, `CHANGELOG.md`, `autoGrabSeries.ts`, `torznab.ts`, `autoGrab.ts`, `mediaMap.ts`, `rssCache.ts`) has been verified byte by byte — no BOM, clean UTF-8. The corrected commit for v1.12.81 already contained the exact code without BOM; v1.12.82 starts from a clean base and re-runs the full pipeline (Windows installer + Docker image) on the correct commit.
- **Reminder** : source files must NEVER be written via PowerShell 5.1 (`Set-Content`, redirections) — its default encodings corrupt UTF-8 or add a BOM.

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
- The recovery pass now records these the same way a truly-unlinked manual download already does: they show up in Activity → Unlinked, where they can be manually pointed at the right title — generically, for any release whose name the parser can't confidently map, not specific to the one show that surfaced it.

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
- "Play in Plex" now reads "Play" wherever the Beta player will actually handle playback, and stays "Play on Plex" wherever it's a genuine hand-off to Plex — consistent across every title card, the title page, the episode page, and the dashboard hero (which previously had no Beta player integration at all).
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

In-app player with automatic Plex transcode fallback, third-party request import (Seerr-compatible), multi-architecture Docker builds, and a reduction of the settings navigation from 26 tabs down to 18.

## v1.1.50 – v1.1.66 — July 2026

Initial public release: TMDb discovery, Torznab/Newznab indexer search, unified movie/series library, multi-user requests, the built-in BitTorrent engine, and Plex sync — plus early stability and security fixes (session handling, library deduplication, dependency upgrades).
