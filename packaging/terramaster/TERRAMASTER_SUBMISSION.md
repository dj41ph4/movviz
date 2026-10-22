# TerraMaster TOS 7 submission checklist

This checklist is intentionally strict. A release is not considered ready until every applicable item is verified against the current TerraMaster documentation.

## Package content

Each submitted `.tar.gz` must contain exactly these four files at its root:

- `config.ini`
- `movviz.lang`
- `movviz.svg`
- `docker-compose.yml`

## Docker requirements

- Docker Hub image only: `dj41ph4/movviz:<version>`
- Compose compatible with version 3.8+
- Explicit `user: "1001:1001"`
- No `privileged`
- No `network_mode: host`
- Persistent bind mounts for `/config` and `/data`
- No comments inside `ports:` or `volumes:` sequences
- `restart: unless-stopped`
- Healthcheck configured
- Web UI exposed through `x-app-meta`
- Web port uses TerraMaster-approved non-reserved range

## TOS metadata

- `application_type`: `docker`
- `exec`: `true`
- `open_path`: `true`
- `path`: `http://${ip}:9810`
- `depend`: includes `DockerEngine`
- `platform`: one package each for `x86_64` and `aarch64`
- `user`: `1001:1001`
- icon path: `/images/icons/movviz.svg`
- help URL present
- publisher matches the developer account identity used for submission

## Language and icon

- UTF-8 without BOM
- LF line endings
- TerraMaster-required language sections present
- `name`, `auth`, and `descript` non-empty
- SVG with transparent background and valid `viewBox`
- SVG below 50 KB

## Release

- Build x86_64 package
- Build aarch64 package
- Generate SHA-256 for each package
- Publish packages as GitHub Release assets
- Submit each architecture separately in the TerraMaster Developer Platform
- Verify package SHA-256 at submission/review

## Manual review reminders

The GitHub Actions workflow validates the mechanical rules we can check locally. TerraMaster still performs manual/security/runtime review, and a reviewer may reject a package even when CI passes. In particular, Docker Hub trust/reputation and App Center runtime behavior remain external review items.
