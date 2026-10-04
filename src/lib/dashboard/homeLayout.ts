import { DASHBOARD_WIDGET_IDS, DEFAULT_DASHBOARD_LAYOUT, sanitizeDashboardLayout, type DashboardLayout } from "./types";

/** Preserve the deployed composition; only the opted-in appearance changes.
 * Shared content, video and carousel settings apply identically in both modes. */
export function mergeNxDashboardLayout(saved: DashboardLayout | undefined): DashboardLayout {
  const clean = sanitizeDashboardLayout(saved ?? DEFAULT_DASHBOARD_LAYOUT);
  return {
    ...clean,
    showStats: true,
    showDownloads: false,
    widgets: [...DASHBOARD_WIDGET_IDS],
  };
}
