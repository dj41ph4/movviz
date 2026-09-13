import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { DEFAULT_DASHBOARD_LAYOUT, sanitizeDashboardLayout, type DashboardLayout } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "dashboards.json");

// Raw, not DashboardLayout: values may carry one extra internal field (see
// HERO_TRAILER_AUTOPLAY_MIGRATION below) that sanitizeDashboardLayout
// deliberately never round-trips.
type Store = Record<string, Record<string, unknown>>;

function read(): Store {
  return readJsonCached<Store>(FILE, {});
}

function write(data: Store) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, data);
}

// One-time forced flip of the hero ambient-trailer default to "on", applied
// even to users who had explicitly turned it off before v1.24.164 (when the
// nx redesign had silently disconnected this whole panel from the hero — see
// v1.24.163's changelog). Marked per-user on the raw stored record (a field
// outside the typed DashboardLayout, so sanitizeDashboardLayout never touches
// it) so this runs exactly once per account; a user who turns it back off
// afterward stays off.
const HERO_TRAILER_AUTOPLAY_MIGRATION = "heroTrailerAutoplayMigratedV1";

export function loadDashboardLayout(userId: string): DashboardLayout {
  const data = read();
  const raw = data[userId];
  // Sanitized on read, not just on save — a file written before the v2
  // schema (mode/hero/sections) existed is upgraded to a complete, valid
  // layout on every load instead of only whenever the user next saves.
  const clean = raw ? sanitizeDashboardLayout(raw) : DEFAULT_DASHBOARD_LAYOUT;

  if (raw && raw[HERO_TRAILER_AUTOPLAY_MIGRATION] !== true) {
    clean.hero.trailerAutoplay = true;
    data[userId] = { ...clean, [HERO_TRAILER_AUTOPLAY_MIGRATION]: true };
    write(data);
  }

  return clean;
}

export function saveDashboardLayout(userId: string, layout: unknown): DashboardLayout {
  const clean = sanitizeDashboardLayout(layout);
  const data = read();
  // A user who explicitly saves from Settings has made their own choice —
  // never re-flip trailerAutoplay for them after this point.
  data[userId] = { ...clean, [HERO_TRAILER_AUTOPLAY_MIGRATION]: true };
  write(data);
  return clean;
}
