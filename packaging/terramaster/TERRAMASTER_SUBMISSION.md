# TerraMaster TOS 7 submission checklist

This checklist is intentionally strict. A release is not considered ready until every applicable item is verified against the current TerraMaster documentation.

## Package content

Each submitted `.tar.gz` must contain exactly these four files at its root:

- `config.ini`
- `movviz.lang`
- `movviz.svg`
- `docker-compose.yml`

The CI produces separate `movviz_x86_64.tar.gz` and `movviz_aarch64.tar.gz` assets so each architecture has its own `config.ini.platform` value.

## Docker requirements

- Docker Hub image only: `dj41ph4/movviz:sha-<commit>`
- Immutable image tag; never `latest`
- Compose compatible with version 3.8+
- Explicit `user: "1000:1000"`
- No `privileged`
- No `network_mode: host`
- Persistent bind mounts for `/config` and `/data`
- No comments inside `ports:` or `volumes:` sequences
- `restart: unless-stopped`
- Healthcheck configured
- Web UI exposed through `x-app-meta`
- Port 9810 uses the TerraMaster recommended application range
- BitTorrent peer ports 55000/55001 are explicitly declared in the allowed dynamic range
- Internal engine/resolver ports 9820/9830 are not published to the NAS host

## TOS metadata

- `id`: `movviz`
- `publisher`: `dj41ph4` — use the same developer name when registering on the TerraMaster Developer Platform
- `application_type`: `docker`
- `exec`: `true`
- `open_path`: `true`
- `path`: `http://${ip}:9810`
- `category`: `Audio_Video_Entertainment`
- `depend`: includes `DockerEngine`
- `relation`: includes `docker` and `DockerEngine`
- `platform`: one package each for `x86_64` and `aarch64`
- `user`: `1000:1000`
- icon path: `/images/icons/movviz.svg`
- help URL present
- TOS minimum version: `TOS7.0`

## Language and icon

- UTF-8 without BOM
- LF line endings
- Full documented 26-language baseline in TerraMaster's documented order
- `name`, `auth`, and `descript` non-empty for every language
- English text may be used for untranslated language descriptions, as permitted by TerraMaster
- SVG with transparent background and valid `viewBox`
- SVG below 50 KB

## Automated release gates

Before a TerraMaster package is attached to a tagged GitHub release, CI must pass all of the following:

- Git tag `vX.Y.Z` matches `package.json` version
- Immutable `dj41ph4/movviz:sha-<commit>` image exists on Docker Hub
- Source files are UTF-8 without BOM and LF-only
- `config.ini` passes JSON and TerraMaster field validation
- language file passes the 26-language validation
- SVG validation passes
- `docker compose config -q` passes
- archive contains exactly the four required TOS files
- SHA-256 is generated and then verified again before release upload
- container starts as UID/GID 1000:1000 with writable `/config` and `/data`
- `/api/healthz` succeeds while running as that non-root user
- Trivy finds no fixable CRITICAL image vulnerabilities

## Developer Platform submission

1. Register at the TerraMaster Developer Ecosystem Platform using developer name `dj41ph4` so it matches `config.ini.publisher`.
2. Create the MOVVIZ application as a Docker application using the public GitHub repository.
3. Register/submit `x86_64` and `aarch64` separately as required by TOS.
4. Select the corresponding package asset from the GitHub Release.
5. Record/verify the package SHA-256 from the matching `.sha256` asset.
6. Submit for TerraMaster automated and manual review.

## External/manual review items

The CI validates everything that can be mechanically checked in the repository or container. TerraMaster still controls App Center review and can reject the application for external policy reasons.

Most importantly, the current TOS 7 documentation states that Docker Hub trust/reputation is reviewed and warns that unverified personal images can be rejected. MOVVIZ is hosted on Docker Hub as required, but Docker Hub publisher verification/reputation cannot be made true by repository code. Confirm this point with `developer@terra-master.com` before final submission if the `dj41ph4` Docker Hub namespace is not accepted by their reviewer.
