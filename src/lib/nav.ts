import {
  LayoutDashboard,
  Compass,
  Film,
  Tv,
  LibraryBig,
  Search,
  Inbox,
  Download,
  Settings,
  AlertTriangle,
  Users,
  Clock,
  CalendarDays,
  Trash2,
  ClipboardList,
  type LucideIcon,
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

export const NAV: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", hintKey: "nav.dashboardHint", icon: LayoutDashboard },
  { href: "/discover", labelKey: "nav.discover", hintKey: "nav.discoverHint", icon: Compass },
  { href: "/movies", labelKey: "common.movies", hintKey: "nav.moviesHint", icon: Film },
  { href: "/series", labelKey: "common.series", hintKey: "nav.seriesHint", icon: Tv },
  { href: "/collections", labelKey: "nav.collections", hintKey: "nav.collectionsHint", icon: LibraryBig },
  { href: "/calendar", labelKey: "nav.calendar", hintKey: "nav.calendarHint", icon: CalendarDays },
  { href: "/search", labelKey: "nav.torrent", hintKey: "nav.torrentHint", icon: Search },
  { href: "/settings", labelKey: "nav.settings", hintKey: "nav.settingsHint", icon: Settings },
];

/** "Gestion" renders as a collapsible group in the Sidebar (same pattern the
 *  old Bibliothèque submenu used) — everything admin/ops-facing, kept out of
 *  the primary flat list above. */
export const GESTION_NAV: NavItem[] = [
  { href: "/requests", labelKey: "nav.requests", hintKey: "nav.requestsHint", icon: Inbox, liveBadge: "pendingRequests" },
  { href: "/activity", labelKey: "nav.activity", hintKey: "nav.activityHint", icon: Download, liveBadge: "activeDownloads" },
  { href: "/history", labelKey: "nav.history", hintKey: "nav.historyHint", icon: Clock },
  { href: "/trash", labelKey: "nav.trash", hintKey: "nav.trashHint", icon: Trash2 },
  { href: "/issues", labelKey: "nav.issues", hintKey: "nav.issuesHint", icon: AlertTriangle },
  { href: "/users", labelKey: "nav.users", hintKey: "nav.usersHint", icon: Users, adminOnly: true, liveBadge: "pendingUsers" },
];
