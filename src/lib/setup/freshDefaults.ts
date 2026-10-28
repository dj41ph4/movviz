import fs from "node:fs";
import path from "node:path";
import { readJsonCached } from "@/lib/fsJsonCache";
import { updateTaskConfig } from "@/lib/scheduler/state";
import { DEFAULT_TEMPLATES } from "@/lib/naming/defaults";
import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/types";
import { saveUserPrefs } from "@/lib/userPrefs/store";
import { saveDashboardLayout } from "@/lib/dashboard/store";

/** Called only when creating the first administrator. Existing files win. */
export function initializeFreshDefaults(userId: string) {
  const dir = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
  fs.mkdirSync(dir, { recursive: true });
  try { fs.writeFileSync(path.join(dir, "setup-pending"), userId, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  try {
    fs.writeFileSync(path.join(dir, "naming.json"), JSON.stringify({ ...DEFAULT_TEMPLATES,
      movieFile: "{title} ({year})", seasonFolder: "Saison {season}",
      episodeFile: "{title} - S{season:00}E{episode:00}",
    }, null, 2), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  try {
    fs.writeFileSync(path.join(dir, "discover-layout.json"), JSON.stringify({ layout: "allocine" }), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const newFiles: Record<string, unknown> = {
    "cdn-images.json": { enabled: true, localNetworkPriorityEnabled: true },
    "trailer-sources.json": { enabled: true },
    "beta-player.json": { hdrDvToSdrEnabled: false },
    "job-priorities.json": { qualityUpgrade: 11, rssScan: 58 },
  };
  for (const [file, value] of Object.entries(newFiles)) {
    try { fs.writeFileSync(path.join(dir, file), JSON.stringify(value), { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  const scheduler = readJsonCached<{ configs?: Record<string, unknown> }>(path.join(dir, "scheduler.json"), {});
  const scheduleDefaults = {
    "plex-marker-sync": { window: { startHour: 4, endHour: 6 } },
    "plex-full-reconcile": { window: { startHour: 3, endHour: 6 } },
    "retry-missing-movies": { window: { startHour: 3, endHour: 6 } },
    "plex-watch-sync": { intervalMs: 30 * 60 * 1000 },
  };
  for (const [id, config] of Object.entries(scheduleDefaults)) {
    if (!Object.hasOwn(scheduler.configs ?? {}, id)) updateTaskConfig(id, config);
  }
  saveUserPrefs(userId, { autoSubtitles: true });
  saveDashboardLayout(userId, { ...DEFAULT_DASHBOARD_LAYOUT,
    showStats: true, showDownloads: true, showTasks: true,
    hero: { ...DEFAULT_DASHBOARD_LAYOUT.hero, slideshowSpeedSec: 60, minYear: 2015 },
    widgets: ["movies", "series", "downloading", "searching"], youtubeTrailerSearch: true,
  });
}
