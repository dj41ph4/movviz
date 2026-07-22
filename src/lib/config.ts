/**
 * Runtime configuration. All network + storage settings are resolved from
 * environment variables so the same build runs identically on Windows, Linux
 * and NAS/Docker. Ports live in the 9800 range.
 */

const num = (v: string | undefined, fallback: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  /** Web interface + API (Next.js server). */
  webPort: num(process.env.MOVVIZ_WEB_PORT, 9810),
  /** Download / orchestration engine (dedicated service, future). */
  enginePort: num(process.env.MOVVIZ_ENGINE_PORT, 9820),
  /** Root data directory for libraries, incoming files and app state. */
  dataDir: process.env.MOVVIZ_DATA_DIR ?? "./data",
  /** Environment label. */
  env: process.env.NODE_ENV ?? "development",
} as const;

export type MovvizConfig = typeof config;
