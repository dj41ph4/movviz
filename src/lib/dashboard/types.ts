export const DASHBOARD_WIDGET_IDS = [
  "movies",
  "series",
  "episodes",
  "missingEpisodes",
  "available",
  "downloading",
  "searching",
  "missing",
  "episodesAvailable",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

// Single appearance since the Stable theme was removed. A stored "cinema"
// (the old Stable key) is read back as "beta".
export const DASHBOARD_MODES = ["beta"] as const;
export type DashboardMode = (typeof DASHBOARD_MODES)[number];

export const DASHBOARD_SECTION_IDS = [
  "continueWatching",
  "availableNow",
  "becauseYouLike",
  "watchlist",
  "rewatch",
  "discover",
  "shortSessions",
  // « Prochainement » — every announced film (TMDb), distinct from
  // comingSoon (« Vos prochaines sorties »: the user's own requests).
  "announced",
  "comingSoon",
  "upgradesAvailable",
] as const;
export type DashboardSectionId = (typeof DASHBOARD_SECTION_IDS)[number];

export const HERO_SLIDESHOW_SPEEDS = [5, 10, 15, 30, 60] as const;
export type HeroSlideshowSpeed = (typeof HERO_SLIDESHOW_SPEEDS)[number];

export interface DashboardHeroSettings {
  enabled: boolean;
  slideshowSpeedSec: HeroSlideshowSpeed;
  trailerAutoplay: boolean;
  /** Whether the Hero can draw from pools of titles already in the library (unwatched, recently added, upcoming, recent activity). */
  includeOwned: boolean;
  /** Whether the Hero can draw from pools of titles NOT in the library (personalized TMDb suggestions, discovery). */
  includeUnowned: boolean;
  /** Minimum release year for the discovery carousels (trending/recommended) — null = show everything. */
  minYear: number | null;
}

/** Order = display order; a widget id absent from the array is hidden. */
export interface DashboardLayout {
  version: 2;
  mode: DashboardMode;
  showStats: boolean;
  showDownloads: boolean;
  showTasks: boolean;
  hero: DashboardHeroSettings;
  sections: { id: DashboardSectionId; visible: boolean }[];
  widgets: DashboardWidgetId[];
  /**
   * Off by default — falls back to TMDb's own trailer catalog only, no
   * outside request. When on, a title/language with no TMDb trailer in the
   * viewer's language triggers a YouTube search (page scrape, no official
   * API) for one instead of silently falling back to English. Opt-in since
   * it's not an official API and depends on YouTube not rate-limiting the
   * server's IP.
   */
  youtubeTrailerSearch: boolean;
}

const DEFAULT_HERO_SETTINGS: DashboardHeroSettings = {
  enabled: true,
  slideshowSpeedSec: 10,
  // v1.24.164: the hero's ambient trailer is now reliable (see
  // HERO_TRAILER_AUTOPLAY_MIGRATION in store.ts for the one-time forced
  // migration of already-saved layouts to this same value).
  trailerAutoplay: true,
  includeOwned: true,
  includeUnowned: true,
  minYear: null,
};

const DEFAULT_SECTIONS: DashboardLayout["sections"] = DASHBOARD_SECTION_IDS.map((id) => ({ id, visible: true }));

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 2,
  mode: "beta",
  // Off by default on a fresh install — an existing install's own saved
  // `true` is never touched by this (sanitizeDashboardLayout only falls
  // back to these defaults for a field that was never actually saved).
  showStats: false,
  showDownloads: false,
  showTasks: false,
  hero: DEFAULT_HERO_SETTINGS,
  sections: DEFAULT_SECTIONS,
  widgets: [...DASHBOARD_WIDGET_IDS],
  youtubeTrailerSearch: false,
};

function isWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === "string" && (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value);
}

function isSectionId(value: unknown): value is DashboardSectionId {
  return typeof value === "string" && (DASHBOARD_SECTION_IDS as readonly string[]).includes(value);
}

function sanitizeWidgets(raw: unknown): DashboardWidgetId[] {
  if (!Array.isArray(raw)) return [...DASHBOARD_WIDGET_IDS];
  const seen = new Set<DashboardWidgetId>();
  const widgets: DashboardWidgetId[] = [];
  for (const w of raw) {
    if (isWidgetId(w) && !seen.has(w)) {
      seen.add(w);
      widgets.push(w);
    }
  }
  return widgets;
}

function sanitizeHero(raw: unknown): DashboardHeroSettings {
  const h = raw && typeof raw === "object" ? (raw as Partial<DashboardHeroSettings>) : {};
  const speed = h.slideshowSpeedSec;
  return {
    enabled: typeof h.enabled === "boolean" ? h.enabled : DEFAULT_HERO_SETTINGS.enabled,
    slideshowSpeedSec: (HERO_SLIDESHOW_SPEEDS as readonly number[]).includes(speed as number) ? (speed as HeroSlideshowSpeed) : DEFAULT_HERO_SETTINGS.slideshowSpeedSec,
    trailerAutoplay: typeof h.trailerAutoplay === "boolean" ? h.trailerAutoplay : DEFAULT_HERO_SETTINGS.trailerAutoplay,
    includeOwned: typeof h.includeOwned === "boolean" ? h.includeOwned : DEFAULT_HERO_SETTINGS.includeOwned,
    includeUnowned: typeof h.includeUnowned === "boolean" ? h.includeUnowned : DEFAULT_HERO_SETTINGS.includeUnowned,
    minYear:
      typeof h.minYear === "number" && h.minYear >= 1900 && h.minYear <= new Date().getFullYear()
        ? Math.floor(h.minYear)
        : null,
  };
}

function sanitizeSections(raw: unknown): DashboardLayout["sections"] {
  if (!Array.isArray(raw)) return DEFAULT_SECTIONS;
  const seen = new Set<DashboardSectionId>();
  const sections: DashboardLayout["sections"] = [];
  for (const entry of raw) {
    const id = entry && typeof entry === "object" ? (entry as { id?: unknown }).id : undefined;
    if (isSectionId(id) && !seen.has(id)) {
      seen.add(id);
      const visible = (entry as { visible?: unknown }).visible;
      sections.push({ id, visible: typeof visible === "boolean" ? visible : true });
    }
  }
  // Any section id introduced after this layout was last saved (a new
  // Movviz version adding a row type) is appended visible-by-default,
  // rather than silently missing until the user re-saves their settings.
  for (const id of DASHBOARD_SECTION_IDS) {
    if (!seen.has(id)) {
      if (id === "watchlist") sections.splice(Math.min(3, sections.length), 0, { id, visible: true });
      else if (id === "announced") {
        // Beside its sibling « Vos prochaines sorties », wherever the user put it.
        const sibling = sections.findIndex((s) => s.id === "comingSoon");
        sections.splice(sibling >= 0 ? sibling : sections.length, 0, { id, visible: true });
      }
      else sections.push({ id, visible: true });
    }
  }
  return sections;
}

/**
 * Drops unknown/duplicate values from a client-supplied layout — never trust
 * stored/posted JSON as-is. Also the single migration point for the pre-v2
 * schema (`{ widgets: [...] }` with no `version`): read-time upgrade to v2
 * defaults, preserving the widget order/set the user
 * already had — never a one-shot migration script, never destructive.
 */
export function sanitizeDashboardLayout(input: unknown): DashboardLayout {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    version: 2,
    mode: "beta",
    showStats: typeof obj.showStats === "boolean" ? obj.showStats : DEFAULT_DASHBOARD_LAYOUT.showStats,
    showDownloads: typeof obj.showDownloads === "boolean" ? obj.showDownloads : DEFAULT_DASHBOARD_LAYOUT.showDownloads,
    showTasks: typeof obj.showTasks === "boolean" ? obj.showTasks : DEFAULT_DASHBOARD_LAYOUT.showTasks,
    hero: sanitizeHero(obj.hero),
    sections: sanitizeSections(obj.sections),
    widgets: sanitizeWidgets(obj.widgets),
    youtubeTrailerSearch: typeof obj.youtubeTrailerSearch === "boolean" ? obj.youtubeTrailerSearch : DEFAULT_DASHBOARD_LAYOUT.youtubeTrailerSearch,
  };
}
