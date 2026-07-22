# Movviz User Guide

## 1. Overview

Movviz is a unified media command center. It brings together discovery (TMDb), Torznab/Newznab indexer search, a movie and TV series library, multi-user request management, an integrated BitTorrent engine, Plex integration, and more — all within a single premium cinematic interface.

**Key concepts:**

- **Library** — Movies and series you add for monitoring. Each title has a status (Available, Downloading, Missing, Searching) and can be tagged, monitored, and automatically searched through indexers.
- **Indexer** — Torznab/Newznab services that index releases. Movviz queries them to find available downloads for your monitored content.
- **Engine** — The integrated BitTorrent client. Each category (movies/series) runs its own engine instance with independent download paths, speed limits, and seed ratios.
- **Requests** — Users can request titles not yet in the library. Admins approve or reject requests, which then trigger automatic searching.
- **Plex** — Optional integration for library sync (importing what Plex has), watchlist sync (auto-requesting Plex watchlist additions), and play state tracking per user profile.

**Tech stack:** Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion, SWR, and a dedicated ESM BitTorrent engine running on a separate port.

**Ports (default):** Web UI on 9810, BitTorrent engine on 9820, Cloudflare resolver on 9830, peer-to-peer on 51413/51414.

---

## 2. Getting Started

### First launch — Setup wizard

The first time you access Movviz (or if no admin account exists), you are guided through a 6-step setup wizard at `/setup`:

1. **Language** — Choose the interface language from 5 options: français (fr), English (en), Italiano (it), Nederlands (nl), Deutsch (de).
2. **TMDb API Key** — The Movie Database powers all discovery, metadata, posters, and search. You can use the built-in default key or enter your own from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
3. **TVDB API Key** — TheTVDB provides supplemental metadata, especially for anime. Get a key at [thetvdb.com/api-information](https://www.thetvdb.com/api-information).
4. **Indexer** — Add one or more Torznab or Newznab indexers. These are the sources Movviz queries when searching for releases. You can add them from a catalog or configure a generic endpoint manually.
5. **Download client** — Configure the integrated BitTorrent engine instances (one for movies, one for series). Set library folders, download paths, speed limits, seed ratios, and auto-start behavior.
6. **Plex** — Optionally link a Plex Media Server for library sync, watchlist sync, and Plex authentication.

Each step can be skipped and configured later from Settings.

### Account creation / login

After setup, you reach the login page at `/login`. Movviz supports two authentication methods:

- **Local account** — Register with a username and password. The first account (created during setup) is an admin. Subsequent registrations create pending users that must be approved by an admin.
- **Plex authentication** — Click "Sign in with Plex" to authenticate via your Plex account. A popup opens for Plex authorization; once complete, login happens automatically.

If you already have an account, use the login form directly. Use the "Don't have an account yet?" link to switch to registration mode.

---

## 3. Dashboard (/)

The dashboard is your home page — statistics at a glance and recent activity.

### Customizable widgets

The top section shows tiles with counts of:
- **Movies** — Total movies in library
- **Series** — Total series in library
- **Episodes** — Total monitored episodes
- **Missing Episodes** — Monitored episodes not yet available
- **Available** — Movies + episodes available
- **Downloading** — Movies + episodes currently downloading or searching
- **Missing** — Movies in missing state
- **Available Episodes** — Monitored episodes available

**Edit mode:** Click the pencil icon to enter edit mode. In edit mode you can:
- **Reorder** tiles by dragging (Framer Motion reorder)
- **Remove** tiles using the X button on each tile
- **Add** hidden tiles from the "Add widget" dropdown

Click the checkmark to exit edit mode and save the layout.

### Download queue

Below the statistics tiles, the **download queue** shows active and queued torrents from the engine, with real-time progress updates.

### Recently added

The bottom section shows the 12 most recently added titles in a progressive grid. Each card shows the poster, title, and download progress if the movie is currently being downloaded.

---

## 4. Discover (/discover)

The Discover page is your starting point for finding new content to add to the library.

### Content type selector

At the top, choose between **Movies** and **Series** to browse content specific to each type. Genres, rows, and search results update accordingly.

### Dynamic rows (home view)

When no filter is active, the Discover page shows curated horizontal rows of content:
- **Trending Now** — What is popular right now
- **Popular** — Most popular titles
- **Top Rated** — Titles with the highest ratings
- **Upcoming** — Future releases
- **Now Playing / Currently Airing** — Currently in theaters or on television
- **Box Office** — Highest-grossing films
- **Kids** — Family-friendly content
- **New Releases** — Recently added to streaming
- **New Series / Renewed** — New or recently renewed TV series

Each row is a horizontally scrollable carousel. Clicking a card navigates to the title detail page. Clicking "See All" switches to a paginated grid view filtered by that category.

**Rankings:** Some rows (e.g., Top Rated, Box Office) display as numbered rankings instead of carousels.

### Studios and networks buttons

Below content rows, you will find buttons for **studios** (production companies) and **networks** (TV networks). Clicking a studio filters movies from that company; clicking a network filters series from that network.

### Genre tiles

Gradient-colored tiles are shown for each genre. Clicking one filters results by that genre.

### Filters

When you activate a filter or perform a search, the page switches from the home layout to a paginated browse grid with these controls:

- **Search field** — Type to search by title (debounced at 350ms)
- **Genre dropdown** — Filter by genre
- **Year input** — Filter by release year
- **Sort dropdown** — Sort by Trending (popularity), Top Rated (vote average), or Most Recent (release date)
- **Active filter chips** — Show active filters (genre, year, studio, network, row category) with an X to clear each
- **Reset button** — Clear all filters at once

### Infinite results

The browse grid loads results in pages. As you scroll down, more results are loaded automatically via an IntersectionObserver. A "Load More" button also appears at the bottom as an alternative.

### Add to library

Each card in the browse view has an overlay button to **Add to Library**. When clicked, Movviz adds the title to your library and automatically starts searching for a release. The card shows the current status (Available, Downloading, Missing) if the title is already in your library.

---

## 5. Library (/library)

The Library page has three tabs: Library, Calendar, and Wanted.

### 5.1. Library tab

The main library view shows all your movies and series in a responsive progressive grid.

**Filters:**
- **Type** — All, Movies only, or Series only
- **Status** — All, Available, Downloading, or Missing
- **Tag** — If tags are assigned to titles, tag filter buttons appear
- **Sort** — By Title (alphabetical) or Recent (most recently added)

**Progressive rendering:** The first 100 cards are rendered immediately; the rest are loaded in batches using `requestIdleCallback` so the page stays responsive even with thousands of titles.

**Cards:** Movie cards show the poster (with a progress bar during download), title, year, and status badge. Series cards show similar information for the overall series status.

**Reconciliation:** Admin can trigger a library reconciliation to detect missing files or untracked files on disk. Issues are reported inline.

### 5.2. Calendar

Shows upcoming movie releases and episode air dates grouped by date. Today's entries are highlighted. Each entry shows the poster thumbnail, title, language badge (VO/VF), and links to the title detail page.

### 5.3. Wanted

Lists all missing monitored items — movies in missing state and monitored episodes not yet available.

Features:
- **"Download All" button** — Searches all missing items in batch (limit of 5 simultaneous searches), with a progress counter
- **Per-item search** — Each missing movie or episode has a search button to trigger an immediate indexer search for that specific item

Items are shown with their title, release/air date, and how long ago they were added.

---

## 6. Collections (/collections)

### 6.1. Sagas (TMDb franchises)

Automatically detected TMDb franchise collections (e.g., "Star Wars", "Harry Potter") are shown in this section.

- **Progress** — Each saga shows a owned/total count (e.g., 4/11) and a progress bar
- **Scan library** — Admin can trigger a saga scan to detect new collections from the library
- **View mode** — Large grid, small grid, or list (saved in localStorage)

Clicking a saga opens its detail page showing all entries in the collection.

### 6.2. Custom collections

User-created collections to organize your library however you like.

- **Creation** — Click the "New Collection" button to create a custom collection
- **View mode** — Same as sagas: large grid, small grid, or list

---

## 7. Activity (/activity)

The Activity page tracks download operations, events, and failures.

### 7.1. Downloads (Queue)

Shows the real-time download queue from the BitTorrent engine.

**Visible states:**
- **Metadata** — Downloading torrent metadata/info
- **Downloading** — Download in progress
- **Seeding** — Completed, now seeding
- **Paused** — Paused by user or system
- **Stalled** — No peers/activity
- **Completed** — Download finished

**Per-item actions:**
- Pause / Resume
- Restart
- Remove from queue
- Remove + delete downloaded files

**Manual addition:** You can manually add torrents via magnet link or by uploading a `.torrent` file.

**Status filters** — Filter the queue by status to focus on specific states.

### 7.2. History

A chronological log of events related to your content:
- **Grabbed** — A release has been grabbed from an indexer
- **Imported** — A download has been imported into the library
- **Upgraded** — An existing file has been replaced with a better quality
- **Failed** — A download or import has failed
- **Blocked** — A release was blocked by the blocklist

### 7.3. Wanted

Same as the Library Wanted tab — missing monitored items that can be searched individually.

### 7.4. Errors

A filtered view of history showing only failed events for quick debugging.

---

## 8. Indexer Search (/search)

The search page lets you directly query your configured indexers.

**Search bar** — Enter a query and press Enter or click the start button.

**Movie/Series toggle** — Limit the search to movie or series categories on your indexers.

**Sortable results table** — Results are displayed in a responsive table with sortable columns:
- **Title** — Release name (monospace)
- **Score** — Quality score (colored: green ≥ 90, amber ≥ 75)
- **Indexer** — Which indexer returned the release
- **Age** — How long ago it was published
- **Size** — File size
- **Peers** — Seed count (colored)
- **Action** — Grab button to download manually

**Quality score:** Each release is scored based on your configuration in Settings > Download > Quality (release profiles + custom formats). Higher scores indicate better matches for your preferences.

**Grab button** — Manually download a specific release. The button turns into a checkmark once grabbed.

**Recent releases** — When no search query is entered, the page shows recent releases from your indexers for the selected category.

**Per-indexer errors** — If an indexer returns an error (wrong key, rate limit, etc.), it is shown in a warning banner so you know why some indexers returned no results.

---

## 9. Requests (/requests)

Users can request movies or series not yet in the library.

**Making a request:** From a title's detail page, click "Add to Library." If the item is not in the library, a request is created (depending on user permissions).

**Request list:** Shows all requests with poster, title, rating, year, description, who requested it, and when.

**Pending requests:** New requests appear with a "Pending" badge.

**Admin actions:**
- **Approve** — Approves the request and triggers an automatic search
- **Reject** — Rejects the request

**Approved request status:** After approval, the status badge updates to reflect the real library state (Searching, Downloading, Missing, Available).

**Tabs:** Pending (default) shows only unhandled requests; All shows every request. The sidebar badge shows the pending request count.

---

## 10. History (/history)

A comprehensive event log separate from the Activity page.

**Filters:**
- **Type** — All, Movies, or Series
- **Event type** — All, Grabbed, Imported, Upgraded, or Failed

**Event table:** Each entry shows the content title, event type (with icon), size, timestamp, indexer/actor, and quality score. Clicking a title navigates to its detail page.

---

## 11. Issues (/issues)

Users can report issues with media items.

**Reporting an issue:** On the detail page of a title in the library, click "Report an Issue." Choose the issue type:
- **Video** — Problems with video quality or playback
- **Audio** — Problems with audio tracks
- **Subtitles** — Missing or incorrect subtitles
- **Other** — Any other problem

**Issue list:** Shows all reported issues with poster, title, issue type badge, status, description, reporter, and time.

**Comments:** Each issue has a threaded comment system. Click the comment count button to expand the conversation. Add comments via the input field at the bottom.

**Admin actions:**
- **Resolve** — Mark an issue as resolved
- **Reopen** — Reopen a previously resolved issue

**Tabs:** Open (default) shows unresolved issues; All shows every issue.

---

## 12. Users (/users)

User management for admins. Shows a list of all users.

**Pending users:**
- Users who have registered but not yet been approved appear in a highlighted section
- **Approve** — Activates the user account
- **Reject** — Deletes the pending user

**Active users:**
Each user row shows:
- Username with authentication badge (Local or Plex)
- Role (User or Admin) with inline toggle
- **Auto-approve** toggle — When enabled, this user's requests are automatically approved
- Link to the user detail page

**Create local user:** Opens a modal to create a new local user directly (username + password).

**Import Plex users:** If Plex is connected, imports Plex server users as Movviz users.

### User Detail (/users/:id)

Clicking a user shows their detail page with three tabs:

**General:**
- **Discover by continent** — Sets which continents appear on the user's Discover page
- **Request limits** — Per-user limits for movie and series requests (with Unlimited checkbox)
- **Auto-approve** — Toggle for automatic request approval
- **Plex watchlist sync** — If the user has a Plex token, they can auto-request Plex watchlist additions

**Permissions:**
- **Role** — User or Admin (an admin cannot demote themselves)
- **Can manage requests** — Delegates request handling to non-admin users

**Password:** For non-Plex users, admins can reset the password.

---

## 13. Profile (/profile)

Every user's personal profile page for their own settings.

### Password

Change your password by entering the current password and a new one (minimum 8 characters).

### API Tokens

Create and manage personal API access tokens for programmatic access.

- **Create token** — Give it a name, then copy the generated token (shown once)
- **Token list** — Shows all tokens with creation and last-used dates
- **Revoke** — Delete a token to invalidate it

### Discover by Continent

Select which continents you want to prioritize in discovery. This filters movies and series shown on your Discover page based on production countries.

### Watchlist

Your personal watchlist — titles you have flagged for later.

Each watchlist item shows the poster, rating, and hover actions:
- **Add to library** — Adds the title to the library and removes it from the watchlist
- **Remove** — Removes from watchlist without adding

You can add titles to your watchlist from any title detail page using the bookmark button.

---

## 14. Settings (/settings)

Settings are organized into 5 groups with a collapsible sidebar on desktop and bottom navigation on mobile. All Settings tabs (except About) are admin-only.

### 14.1. Download

**Clients:** Two integrated BitTorrent engine instances — one for movies, one for series. Each instance shows:
- Status indicator (online/offline)
- Protocol (Torrent)
- Category binding (Movie/Series)
- Current configuration summary

When editing, you can configure:
- **Library folder** — Where media files are stored for Plex
- **Download folder** — Where incomplete downloads go
- **Completed folder** — Where completed downloads are moved
- **Maximum active downloads** — Limit on concurrent downloads
- **Seed ratio** — Target ratio before stopping seed
- **Maximum peers** — Maximum peer connections per torrent
- **Upload slots** — Upload slots per torrent
- **Download speed limit** — Global download limit (KB/s; "Unlimited" if empty)
- **Upload speed limit** — Global upload limit
- **Auto-start** — Whether the instance starts with the engine

**Folder picker:** If the engine runs on the same machine, a built-in folder browser lets you navigate and select paths visually. For remote/Docker setups, enter the path manually.

**Restart engine button** — If the engine is offline, a restart button appears.

**Indexers:** Configure Torznab/Newznab indexers for release searching.

Each indexer shows:
- Protocol (Torrent/Usenet) with icon
- Name and base URL
- Connection status (OK/Fail/Untested) with last test detail
- Authentication indicators (API key or credentials)
- Enable/disable toggle
- Priority setting

**Per-indexer settings:**
- **Categories** — Which content categories to search (expandable panel)
- **Filters** — Min/max size (MB) and maximum age (days)
- **Cloudflare solver** — Enable Cloudflare resolver for indexers protected by Cloudflare
- **Test button** — Test the connection in real time
- **Delete** — Remove the indexer

**Add indexer:** Two-step flow:
1. Choose from a catalog of predefined indexers (Torznab/Newznab)
2. Enter URL, authentication (API key or username/password), and categories

**Resolver URL:** Configure the FlareSolverr URL (default: `http://localhost:9830`) used by the Cloudflare resolver.

**Quality:** Scoring and filtering rules for releases, combining release profiles and custom formats in a single tab.

- **Blocked words** — A list of words that, if present in a release title, cause it to be rejected. Add words individually; remove with the X button.
- **Maximum sizes** — Maximum allowed sizes for movies (GB), episodes (GB), and seasons (GB). Releases exceeding these are rejected.
- **Codec scores** — Scores for video codecs: x264, x265, and AV1. Higher scores make releases with that codec more likely to be chosen.
- **Custom formats** — Regex-based scoring rules applied to release titles. Each format has a name, score (positive or negative), and regex terms. Create them to prioritize or deprioritize patterns like "HDR", "Dolby Vision", "Remux", etc.

### 14.2. Library

**Metadata:** Configuration of external data sources.

- **TMDb** — The Movie Database API key. You can use the built-in default key or provide your own. Test the key to verify it works. Option to restore the default key available.
- **TVDB** — TheTVDB API key for supplemental metadata. Includes a toggle to use TVDB specifically for **anime** titles.
- **OMDb** — The Open Movie Database API key for Rotten Tomatoes scores and Metacritic ratings. Test to verify.
- **Discover Layout** — Choose between the standard **Movviz** layout (poster carousels + rankings) or the **Allociné** layout, which changes the Discover page styling.

**Plex:** Plex Media Server integration.

- **Connection:**
  - **Hostname** — Plex server hostname or IP
  - **Port** — Default 32400
  - **SSL** — Enable to use HTTPS
  - **Link/Reconnect** — Authenticate with your Plex account via browser popup
  - **Test** — Verify connectivity
- **Library sync:**
  - Enable to activate automatic Plex library syncing into Movviz
  - **Sync now** — Trigger an immediate sync
  - **New full scan** — Force a complete re-scan instead of incremental
  - Results show how many movies/series were added and matched
- **Watchlist sync:**
  - Enable to activate global Plex watchlist syncing
  - When enabled, users who sign in with Plex can have their Plex watchlist turned into requests automatically
- **Plex profiles (User mapping):**
  - Map each Movviz user to a specific Plex Managed User (profile) so that play state reflects that profile's history

**Naming:** Templates for file and folder naming with interactive token insertion.

Templates for:
- **Movie folder** — e.g., `{title} ({year})`
- **Movie file** — e.g., `{title} ({year}) [{quality}]`
- **Series folder** — e.g., `{title} ({year})`
- **Season folder** — e.g., `Season {season:00}`
- **Episode file** — e.g., `{series} - S{season:00}E{episode:00} - {title}`

**Interactive tokens:** Click a field, then click a token button to insert it at the cursor position. Available tokens include: `{title}`, `{year}`, `{quality}`, `{season}`, `{episode}`, `{series}` and more.

**Dots or spaces:** Choose whether separators use dots or spaces.

**Live preview:** As you edit templates, a preview shows what the resulting file paths will look like for a sample movie and episode.

**Imports:** External watchlists that can be synced and automatically added to the library (under the "Imports" section).

Supported sources:
- **Trakt** — Trakt user lists
- **IMDb** — IMDb lists
- **Letterboxd** — Letterboxd watchlist

For each list configure:
- **Name** — A descriptive label
- **Type** — Trakt, IMDb, or Letterboxd
- **URL** — The list URL
- **Auto-approve** — When enabled, items from this list are automatically approved (no manual approval needed)
- **Sync button** — Manually trigger a sync

Each list shows its last sync time.

**Seerr import:** Import requests from an existing Overseerr instance.

- **URL** — Your Seerr server URL
- **API Key** — API key for authentication
- **Test** — Verify the connection
- **Import now** — Start the import process

After import, a summary shows:
- Users and requests scanned
- Imported (approved and pending counts)
- Skipped (already in library, already requested, rejected, blocked)
- Failed imports
- Unmatched users (Seerr users not found in Movviz)

**Blocklist:** Titles that should never be added to the library.

- **Add blocked title** — Search TMDb for a title, select it, optionally add a reason, and confirm
- **Blocklist** — Shows all blocked titles with type, title, year, reason, who blocked it, and when
- **Unblock** — Remove a title from the blocklist

When a blocked title is encountered (via request or import), it is silently rejected with a "Blocked" message.

### 14.3. Disk

**Indexing:** Scan root library folders for orphan files — media files on disk that are not tracked in the Movviz library. A single tab with a Movie/Series toggle.

- Select the root folder to scan
- Matches are presented with an integrated TMDb search for manual matching if needed
- One-click import to add matched files to your library

**Rename:** Rename folders and files according to your naming templates.

Flow:
1. **Analyze** — Scan your library and generate a list of rename candidates with current vs. expected paths
2. **Select** — Choose which items to rename (All, Movies only, Series only, or individual selection)
3. **Preview** — Review the changes
4. **Execute** — Apply renames with real-time progress and log

Settings:
- **Language** — Choose TMDb language for translated titles (affects folder/file names)
- **"Remove empty folders"** — After rename, automatically remove now-empty directories
- **Real-time progress + log** — Track the operation in real time

**Maintenance:** Groups disk maintenance operations into a single tab.

**Repair paths:** Detect library entries whose files have been moved or are missing.

1. **Analyze** — Compare library records against the actual filesystem
2. Results are categorized:
   - **Certain** — A unique match (auto-selected)
   - **Ambiguous** — Multiple possible matches (requires human choice)
   - **Conflict** — A file that matches multiple library entries
3. **File browser** — For manual correction, open a file browser to navigate and select the correct path
4. **Apply** — Relink the selected entries

Options:
- **Silent auto-relinking** — For Docker bind mounts, Movviz detects and corrects path changes silently
- **"Remove empty folders after relinking"** — Clean up orphaned directories after repair

**Empty folders:** Scan configured root folders for empty directories.

- Recursively scan all configured library root folders
- Ignores common system files (`.DS_Store`, `Thumbs.db`, `Desktop.ini`, etc.)
- **Delete** — Remove selected empty directories
- **Recursive parent cleanup** — After deletion, now-empty parent folders are also removed recursively

**Trash:** Safety net for deleted content.

When a movie or series is removed from Movviz with its files, the files can be moved to a trash folder instead of being permanently deleted.

- **Movie folder** — Path where deleted movie files go
- **Series folder** — Path where deleted series files go
- **Retention** — Days before trash files are permanently deleted (configurable)
- **Item count** — Shows how many items are currently in the trash

### 14.4. Notifications

Configure push notifications for media events (grabbed, imported, failed, etc.). This single tab groups transports, webhook, and activity options.

**Transports:**
- **Discord** — Webhook URL
- **Telegram** — Bot token + Chat ID
- **Gotify** — Server URL + App token
- **Slack** — Webhook URL
- **Pushbullet** — API token

Each transport:
- Enable/disable toggle
- Configuration fields (passwords are masked)
- **Test button** — Sends a test notification to verify the setup

**Webhook:** Send HTTP POST notifications to a custom URL.

- **Enable** toggle
- **URL** — The webhook endpoint
- **Test button** — Sends a test payload

**Quality upgrades:** Toggle automatic searching and downloading of higher-quality versions of already-available content.

### 14.5. System

**Diagnostics:** Real-time system health overview.

- **Engine** — BitTorrent engine online/offline
- **TMDb** — TMDb API connectivity
- **Indexers** — Connection status per indexer
- **Processes:**
  - **Web** — Web interface process: % CPU, RAM, uptime
  - **Engine** — Engine process: % CPU, RAM, uptime
- **Disk space** — Total, free, and used space on configured paths
- **Library statistics** — Total movie, series, episode counts
- **Performance** — API call counts and latencies
- **Engine logs** — Live tail of engine output
- **Resolver logs** — Live tail of Cloudflare resolver output

**Scheduled tasks:** List of all recurring background tasks.

Each task shows:
- **Name** — What the task does
- **Interval** — How often it runs
- **Last run** — When it last executed
- **Next run** — When it will run next
- **"Run now" button** — Manually trigger the task

**Job queue:** Active and recent background jobs.

- Shows currently running jobs with status and progress
- Recently completed job history
- **Priority** — Slider (0–100) per job type to control execution priority
- Higher-priority jobs run first when multiple jobs are queued

**Cache:** Statistics and management for caches.

Each cache entry shows:
- **Name** — Cache identifier
- **Hits** — Successful cache lookups
- **Misses** — Failed cache lookups
- **Keys** — Number of cached entries
- **Size** — Estimated memory usage

Actions:
- **Warm** — Pre-populate a cache
- **Flush** — Invalidate all entries in a cache

**Backup:** Export and import JSON configuration.

- **Export** — Download all settings, library metadata, and configuration as a JSON file
- **Import** — Upload a previously exported JSON file to restore configuration

**About:** Application information.

- **Version** — Current Movviz version number
- **License** — GNU General Public License v3.0
- **Support the project** — Link to support development
- **Updates:**
  - **Check for updates button**
  - On **Windows**: One-click install button that downloads and applies the update automatically
  - On **Docker/other platforms**: Shows a link to the GitHub releases page with instructions

**Danger Zone:** Irreversible actions at the bottom of the group, visually separated.

Each action requires typing a confirmation word before it can be executed:
- **Clear all movies** — Remove all movies from the library
- **Clear all series** — Remove all series from the library
- **Clear activity history** — Delete all activity history
- **Clear notifications** — Delete all notification configurations
- **Clear requests** — Delete all user requests
- **Clear reported issues** — Remove all reported issues
- **Reset Plex sync state** — Reset Plex sync tracking

---

## 15. Title Detail (/title/:type/:id)

A comprehensive detail page for movies and series, showing everything about a title.

### Content sections

- **Backdrop** — Full-width hero image at the top
- **Poster** — Vertical poster with gradient overlay
- **Title** — Movie or series name
- **Ratings** — TMDb, IMDb, Rotten Tomatoes (from OMDb), and Metacritic scores
- **Year, Runtime, Seasons** (for series), **Genres**
- **Tagline** — The movie or series tagline (if available)
- **Overview** — Full synopsis / plot summary
- **Budget / Revenue** — For movies, financial data from TMDb

### Action buttons

- **Add to library** — If not already in the library, adds the title and triggers search
- **Watch on Plex** — If available in the library and Plex is connected, opens directly in the Plex web player
- **Search** — If the item exists in the library, triggers a new indexer search (also used for quality upgrades)
- **Manual pick** — Opens the indexer search page pre-filled for manual release selection
- **Bookmark / Unbookmark** — Add or remove from your personal watchlist
- **Trailer** — Opens a modal with the YouTube trailer
- **Saga** — For movies, links to the TMDb collection/saga page

### Library status badge

Shows the current library status of the title: Available, Downloading, Searching, or Missing.

### Cast and Crew

- **Cast** — Horizontally scrollable row of actor portraits with character names; click to view person details
- **Crew** — Grid of crew members by department (Director, Writer, etc.) with "Show More" expansion

### Seasons (Series)

For series, a seasons panel shows each season with its episodes. Each episode shows:
- Episode number and title
- Air date
- Monitor toggle
- Status badge
- Season-wide search button

### Keywords

TMDb tags/keywords displayed as pills.

### Recommendations

Similar titles from TMDb shown as a poster grid.

### Sidebar information

- Original title
- Status (Released, Ended, Returning Series, etc.)
- Release date / First air date
- Budget and revenue (movies)
- Original language
- Origin countries
- Studios / Production companies
- **Streaming providers** — Available streaming provider logos (e.g., Netflix, Disney+, etc.)
- **External links** — Plex, TMDb, IMDb, Rotten Tomatoes, Letterboxd icons

### Request modals

If the title is not yet in the library, clicking "Add to Library" opens a type-specific request modal (movie or series) with options for the user.

### Manual pick modal

Opens the indexer search page (`/search`) in a modal/dialog context, pre-filled with the title's metadata and the correct library reference for automatic import after grabbing.

---

## 16. Keyboard Shortcuts

- **Cmd+K / Ctrl+K** — Opens the universal command palette for quick navigation and search
- **Sidebar navigation** — All major sections are accessible from the sidebar: Dashboard, Discover, Library, Collections, Search, Requests, Activity, History, Issues, Users (admin), Settings (admin)

---

## 17. Troubleshooting

### Engine offline

**Symptoms:** Downloads do not start, activity shows no queues, red "offline" indicator in Settings > Download > Clients.

**Solutions:**
- Verify the engine process is running (`npm run engine` or the Windows service)
- Check that port 9820 is not blocked by a firewall
- In Settings > Download > Clients, click "Restart engine"
- Check engine logs in Settings > System > Diagnostics
- Verify the engine state file is not corrupted

### Indexer errors

**Symptoms:** Search results are empty, or specific indexers show "fail" status.

**Solutions:**
- Check each indexer's test result in Settings > Download > Indexers
- Verify your API keys are still valid
- For Cloudflare-protected indexers, enable the "Cloudflare solver" and ensure FlareSolverr is running
- Check min/max size and max age filters in Settings > Download > Quality — they may be too restrictive
- Look for per-indexer error messages in the search page warning banner

### Broken paths (Docker bind mounts)

**Symptoms:** Files exist on disk but the library shows "missing" status. Repair paths scan shows candidates with wrong paths.

**Solutions:**
- Run a scan in Settings > Disk > Maintenance > Repair paths
- For Docker bind mounts, Movviz attempts silent auto-relinking — check that it worked
- If auto-relinking did not work, use the manual file browser to correct paths
- Ensure your Docker volume mounts are consistent across restarts

### Expired sessions

**Symptoms:** 401 errors on API calls, unexpected redirect to login.

**Solutions:**
- Log out and log back in
- If using Plex authentication, reconnect your Plex account
- Session cookies are managed server-side — if the server restarts, sessions may be invalidated
- Check that your system clock is accurate (session token validation is time-sensitive)
