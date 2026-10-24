import { build } from "esbuild";

await build({
  entryPoints: ["src/lib/workers/plexSnapshotWorker.ts"],
  outfile: ".next/plex-snapshot/plexSnapshotWorker.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  tsconfig: "tsconfig.json",
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
