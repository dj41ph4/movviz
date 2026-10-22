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

## Storage model

MOVVIZ only relies on two stable container-side paths:

- `/config` — persistent MOVVIZ configuration, database and state
- `/data` — the media/download root

The host-side folders are not part of MOVVIZ's application logic. They can point wherever the NAS administrator wants, as long as the user running the container has read/write access.

The App Center package uses TerraMaster-safe defaults:

```yaml
volumes:
  - ./config:/config
  - ./data:/data
```

For a new installation, these defaults give MOVVIZ its own persistent application storage.

For an existing media library, edit the project/container volume mapping in TOS Container Manager and map the existing media folder to `/data`.

For an existing Plex installation, the usual setup is simply:

```text
<folder already used by Plex> -> /data
<MOVVIZ config folder>         -> /config
```

This is the same model used by the normal MOVVIZ Docker deployment: MOVVIZ sees `/data` and `/config`; only the NAS-side paths change. There is no requirement to move or duplicate an existing Plex library.

The standard MOVVIZ Docker entrypoint keeps its existing NAS behaviour when started as root: it can remap PUID/PGID, fix ownership and then drop privileges. When an orchestrator such as TerraMaster starts the container with an explicit non-root `user:`, the entrypoint detects that state and immediately executes MOVVIZ without trying privileged setup.

The final `.tar.gz` release packages are generated from these source templates and contain only the four files required by TOS 7.

See `TERRAMASTER_SUBMISSION.md` for the submission checklist.
