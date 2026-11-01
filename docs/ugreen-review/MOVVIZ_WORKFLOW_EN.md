# MOVVIZ — Main application workflow (UGREEN review)

## Installation

1. Install the MOVVIZ UPK (Docker suite 1.7.0.0000 or later required).
2. Choose the configuration folder (`CONFIG_PATH`) and the media/download folder (`DATA_PATH`).
3. Enter PUID/PGID: the numeric user and group that own both folders.
4. Click **Enable**, then open MOVVIZ from UGOS Pro (web port 9810).

## First run

1. The setup wizard opens.
2. Step 1 — administrator account: the Privacy Policy and the GPL license are linked; the
   unticked consent box must be ticked before the account can be created.
3. Following steps: language, optional metadata key, download folders, optional integrations
   (none is enabled automatically).

## Daily workflow

Discover → Request/Add → Search configured sources → Select a release → Download → Import and
organize → Library → Playback → History / Resume

* **Discover**: browse and search movies and series (metadata from TMDb with the administrator's key).
* **Request/Add**: add a title to the library or request it (approval rules per user).
* **Search / Download**: configured indexers are searched, a release is chosen by quality rules and
  downloaded by the built-in engine.
* **Import**: the finished files are renamed and moved into the library under the media folder.
* **Playback**: Direct Play when the device supports the file, otherwise remux or software
  transcoding with FFmpeg.
* **History / Resume**: watched state and resume position are saved per profile.

## Administration

Users and profiles, media locations, quality rules, indexers, integrations, playback settings,
diagnostics and logs, backup export, factory reset — all in Settings.

## Error scenarios covered by the self-test plan

Unwritable configuration/media folder (clear log message), port already in use, no Internet,
invalid API credentials, inaccessible media path.
