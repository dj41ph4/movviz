import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";

/**
 * Discover's row layout — user-chosen editorial angle. "movviz" is the
 * classic shape (trending/popular/top-rated/upcoming rows). "allocine" mimics
 * how allocine.fr organizes its homepage instead: "sorties de la semaine"
 * (now playing) leads, and the weekly-trending row renders as a numbered
 * ranked list rather than a poster carousel. Same TMDb-backed content either
 * way — only the picks and layout differ, never the data source.
 */
const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "discover-layout.json");

export type DiscoverLayout = "movviz" | "allocine";

export function loadDiscoverLayout(): DiscoverLayout {
  const raw = readJsonCached<{ layout?: string }>(FILE, {});
  return raw.layout === "allocine" ? "allocine" : "movviz";
}

export function saveDiscoverLayout(layout: DiscoverLayout) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, { layout });
}
