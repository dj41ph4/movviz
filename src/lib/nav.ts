import {
  LayoutDashboard,
  Compass,
  Library,
  Search,
  Inbox,
  Download,
  Settings,
  AlertTriangle,
  Users,
  Clock,
  LibraryBig,
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
  { href: "/library", labelKey: "nav.library", hintKey: "nav.libraryHint", icon: Library },
  { href: "/collections", labelKey: "nav.collections", hintKey: "nav.collectionsHint", icon: LibraryBig },
  { href: "/search", labelKey: "nav.search", hintKey: "nav.searchHint", icon: Search },
  { href: "/requests", labelKey: "nav.requests", hintKey: "nav.requestsHint", icon: Inbox, liveBadge: "pendingRequests" },
  { href: "/activity", labelKey: "nav.activity", hintKey: "nav.activityHint", icon: Download, liveBadge: "activeDownloads" },
  { href: "/history", labelKey: "nav.history", hintKey: "nav.historyHint", icon: Clock },
  { href: "/issues", labelKey: "nav.issues", hintKey: "nav.issuesHint", icon: AlertTriangle },
  { href: "/users", labelKey: "nav.users", hintKey: "nav.usersHint", icon: Users, adminOnly: true, liveBadge: "pendingUsers" },
  { href: "/settings", labelKey: "nav.settings", hintKey: "nav.settingsHint", icon: Settings },
];
