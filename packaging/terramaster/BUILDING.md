# Building the TerraMaster packages

The source files in this directory are templates. The release workflow replaces the MOVVIZ version placeholder, selects the architecture-specific config, copies the icon, validates the result, and creates the final TOS 7 archives.

The final archive for each architecture must contain exactly:

- `config.ini`
- `movviz.lang`
- `movviz.svg`
- `docker-compose.yml`

No extra file from this source directory is included in the archive.
