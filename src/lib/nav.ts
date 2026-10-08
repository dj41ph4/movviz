import {
  LayoutDashboard, Compass, LibraryBig, Search, Inbox, Download,
  Settings, AlertTriangle, Users, Clock, CalendarDays, Trash2, ClipboardList,
  Ban, CircleOff, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** i18n keys resolved at render time — never hardcode display strings. */
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  /** When set, the Sidebar looks up a live count for this key instead of a static badge. */
  liveBadge?: "pendingRequests" | "pendingUsers" | "activeDownloads";
  adminOnly?: boolean;
}

/** Main media navigation. `/search` intentionally lives under Gestion: the
 * global search in the top bar remains the only primary search metaphor. */
export const NAV: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", hintKey: "nav.dashboardHint", icon: LayoutDashboard },
  { href: "/discover", labelKey: "nav.discover", hintKey: "nav.discoverHint", icon: Compass },
  { href: "/library", labelKey: "nav.library", hintKey: "nav.libraryHint", icon: LibraryBig },
  { href: "/downloads", labelKey: "nav.downloads", hintKey: "nav.activityHint", icon: Download, liveBadge: "activeDownloads" },
  { href: "/calendar", labelKey: "nav.calendar", hintKey: "nav.calendarHint", icon: CalendarDays },
  { href: "/settings", labelKey: "nav.settings", hintKey: "nav.settingsHint", icon: Settings },
];

/** Operations and admin tools. Access rules are retained on their existing
 * items; the compact rail exposes this group through an accessible flyout. */
export const GESTION_NAV: NavItem[] = [
  { href: "/requests", labelKey: "nav.requests", hintKey: "nav.requestsHint", icon: Inbox, liveBadge: "pendingRequests" },
  { href: "/history", labelKey: "nav.history", hintKey: "nav.historyHint", icon: Clock },
  { href: "/search", labelKey: "nav.torrentSearch", hintKey: "nav.torrentHint", icon: Search },
  { href: "/issues", labelKey: "nav.issues", hintKey: "nav.issuesHint", icon: AlertTriangle },
  { href: "/exclusions", labelKey: "nav.exclusions", hintKey: "nav.exclusionsHint", icon: CircleOff },
  { href: "/blocked-torrents", labelKey: "nav.blockedTorrents", hintKey: "nav.blockedTorrentsHint", icon: Ban, adminOnly: true },
  { href: "/users", labelKey: "nav.users", hintKey: "nav.usersHint", icon: Users, adminOnly: true, liveBadge: "pendingUsers" },
  { href: "/trash", labelKey: "nav.trash", hintKey: "nav.trashHint", icon: Trash2 },
];
