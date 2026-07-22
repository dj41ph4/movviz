export const DASHBOARD_WIDGET_IDS = [
  "movies",
  "series",
  "episodes",
  "missingEpisodes",
  "available",
  "downloading",
  "missing",
  "episodesAvailable",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

/** Order = display order; a widget id absent from the array is hidden. */
export interface DashboardLayout {
  widgets: DashboardWidgetId[];
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  widgets: [...DASHBOARD_WIDGET_IDS],
};

function isWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === "string" && (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value);
}

/** Drops unknown/duplicate ids from a client-supplied layout — never trust stored/posted JSON as-is. */
export function sanitizeDashboardLayout(input: unknown): DashboardLayout {
  const raw = input && typeof input === "object" ? (input as { widgets?: unknown }).widgets : undefined;
  if (!Array.isArray(raw)) return DEFAULT_DASHBOARD_LAYOUT;

  const seen = new Set<DashboardWidgetId>();
  const widgets: DashboardWidgetId[] = [];
  for (const w of raw) {
    if (isWidgetId(w) && !seen.has(w)) {
      seen.add(w);
      widgets.push(w);
    }
  }
  return { widgets };
}
