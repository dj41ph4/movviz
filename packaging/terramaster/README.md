# MOVVIZ for TerraMaster TOS 7

This directory contains the TerraMaster TOS 7 App Center packaging layer for MOVVIZ.

The TerraMaster package is intentionally isolated from the standard Docker/Synology packaging so the existing deployment path is not changed.

## Compliance goals

- Docker application package for TOS 7
- Docker Hub image only (`dj41ph4/movviz`)
- Explicit non-root runtime user via Compose `user:`
- No privileged mode
- No host networking
- Persistent bind mounts
- `x-app-meta` web declaration
- Separate x86_64 and aarch64 package metadata
- UTF-8 / LF text files
- SHA-256 release checksums

The standard MOVVIZ Docker entrypoint keeps its existing NAS behaviour when started as root: it can remap PUID/PGID, fix ownership and then drop privileges. When an orchestrator such as TerraMaster starts the container with an explicit non-root `user:`, the entrypoint now detects that state and immediately executes MOVVIZ without trying privileged setup.

The final `.tar.gz` release packages are generated from these source templates and contain only the four files required by TOS 7.

See `TERRAMASTER_SUBMISSION.md` for the submission checklist.
