# Contributing to Movviz

Thanks for taking the time to improve Movviz.

Movviz spans a self-hosted Next.js/TypeScript server, media automation and playback services, Docker/Linux/Windows packaging, and native Android TV/mobile clients. Contributions do not need to cover the whole stack: focused fixes, documentation, translations, UX improvements and compatibility reports are welcome.

## Before opening an issue

- Search existing issues and recent releases first.
- Use the latest available Movviz release when reproducing a bug whenever possible.
- Remove API keys, tokens, private tracker/indexer URLs, credentials, personal library paths and other secrets from screenshots and logs.
- For playback or download issues, include the relevant media/release characteristics without sharing copyrighted media or private credentials.

## Useful information for bug reports

Please include as much of the following as is relevant:

- Movviz version;
- installation type: Windows, Linux or Docker/NAS;
- CPU architecture: amd64 or arm64;
- browser/client: web, PWA, Android TV, Android mobile or Tizen beta;
- server OS and hardware;
- whether Plex is connected;
- steps to reproduce;
- expected and actual behavior;
- relevant Movviz logs or Doctor output;
- for playback: container, video codec, audio codec, HDR/Dolby Vision status and whether direct play/remux/transcoding was selected;
- for indexers: Torznab/Newznab type and sanitized query/diagnostic output.

## Development setup

```bash
git clone https://github.com/dj41ph4/movviz.git
cd movviz
npm install
npm run dev      # http://localhost:9810
npm test
npm run build
```

The native Android clients live in:

- `android-tv-nx/` — Kotlin, Jetpack Compose for TV, Media3;
- `android-mobile-nx/` — Kotlin, Jetpack Compose, Media3.

Packaging and deployment assets live under the corresponding packaging/workflow directories in the repository.

## Pull requests

Keep pull requests focused whenever possible.

A good PR should:

1. explain the problem it solves;
2. describe the chosen approach;
3. avoid unrelated refactors;
4. preserve existing configuration/data compatibility unless the change explicitly requires a migration;
5. include or update tests when behavior changes;
6. update documentation when user-facing behavior changes;
7. avoid committing secrets, local paths, generated credentials or private media metadata.

For UI changes, consider low-powered clients as well as high-end desktops. Movviz deliberately supports reduced-effects profiles and native TV/mobile experiences, so visual improvements should not make the product unnecessarily heavy.

## Compatibility philosophy

Movviz aims to remain practical for existing self-hosted libraries and workflows. Changes should avoid destructive assumptions about storage, watch state, user profiles or imports. A temporarily unavailable mount, failed metadata lookup or disconnected integration must not silently become data loss.

Plex is an optional integration, not a mandatory runtime dependency. New core features should not unnecessarily require Plex when Movviz can reasonably provide the behavior itself.

## Documentation and translations

Documentation fixes and translations are valuable contributions. Movviz currently ships French, English, German, Italian and Dutch user-facing documentation/localization coverage.

The main French README is `README.md`; the international overview is `README.en.md`.

## Feature requests

Feature requests are most useful when they describe the user problem first, then the proposed solution. If an existing self-hosted tool already solves the problem, explain what an integrated Movviz implementation would improve for the end-to-end experience.

## Code of collaboration

Keep discussions technical and respectful. Strong disagreement about architecture or UX is fine; personal attacks, harassment and spam are not.

Thanks for helping make Movviz better.