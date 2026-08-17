import { mutate } from "swr";

/**
 * Clears EVERY cached SWR entry immediately, rather than revalidating one
 * key — call this on any login/logout transition.
 *
 * A prior fix (UserMenu.logout, the login page, PendingApprovalScreen)
 * narrowly re-validated just "/api/auth/me" to stop it reporting the old
 * signed-out/signed-in state for up to `dedupingInterval`. That fixed the
 * topbar/AppShell auth check, but left every OTHER per-user cache entry
 * untouched — watch status, preferences, requests, notifications, AI
 * session/facts, dashboard layout, library data, all of it. Since login
 * and logout both navigate with `router.push`/`router.replace` (never a
 * full page reload), the React tree and its SWR cache survive the
 * transition: on a shared browser/device, the NEXT person to log in could
 * see the PREVIOUS account's data rendered for a moment (or indefinitely,
 * for any hook that doesn't happen to revalidate on its own) — confirmed
 * live as the cause of "other users see my Plex watch list/preferences/
 * requests" reports.
 *
 * `revalidate: false` clears every entry's cached data to `undefined`
 * immediately (so nothing stale can render even for a flash) instead of
 * just kicking off a background revalidation that would still show the
 * old data until the new response lands. Each mounted hook then refetches
 * fresh on its own next render (SWR's default `revalidateOnMount`).
 */
export function resetSwrCache() {
  return mutate(() => true, undefined, { revalidate: false });
}
