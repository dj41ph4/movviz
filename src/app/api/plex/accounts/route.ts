import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { getAccountHistoryPage, getLocalAccounts } from "@/lib/plex/client";
import { getAllBindings } from "@/lib/plex/plexBindingStore";
import { getWatchStatus } from "@/lib/plex/watchStore";

export const dynamic = "force-dynamic";

/**
 * Admin, read-only diagnostic: every account the Plex server itself knows
 * (its local account table keeps the accounts of deleted Home profiles), with
 * the size of each one's playback history and the Movviz account bound to it
 * — what is needed to know whether a deleted profile's history still exists
 * before moving it anywhere. Nothing is modified, in Plex or in Movviz.
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadPlexConfig();
  if (!cfg.adminToken) return NextResponse.json({ error: "plex_not_connected" }, { status: 400 });

  const users = loadUsers();
  const usernameById = new Map(users.map((u) => [u.id, u.username]));
  const boundTo = new Map<number, string[]>();
  for (const binding of getAllBindings()) {
    if (binding.localAccountId == null) continue;
    const list = boundTo.get(binding.localAccountId) ?? [];
    list.push(usernameById.get(binding.movvizUserId) ?? binding.movvizUserId);
    boundTo.set(binding.localAccountId, list);
  }

  const accounts = [];
  for (const account of await getLocalAccounts(cfg, cfg.adminToken)) {
    let historyCount: number | null = null;
    let lastViewedAt: number | null = null;
    let firstViewedAt: number | null = null;
    try {
      const latest = await getAccountHistoryPage(cfg, cfg.adminToken, account.id, { start: 0, size: 1, sortDirection: "desc" });
      historyCount = latest.totalSize;
      lastViewedAt = latest.entries[0]?.viewedAt ?? null;
      if (historyCount > 0) {
        const oldest = await getAccountHistoryPage(cfg, cfg.adminToken, account.id, { start: 0, size: 1, sortDirection: "asc" });
        firstViewedAt = oldest.entries[0]?.viewedAt ?? null;
      }
    } catch {
      /* compte illisible : laissé à null */
    }
    accounts.push({
      localAccountId: account.id,
      name: account.name,
      historyCount,
      firstViewedAt: firstViewedAt ? new Date(firstViewedAt).toISOString() : null,
      lastViewedAt: lastViewedAt ? new Date(lastViewedAt).toISOString() : null,
      movvizAccounts: boundTo.get(account.id) ?? [],
    });
  }

  const movviz = users.map((u) => {
    const status = getWatchStatus(u.id);
    return {
      username: u.username,
      plexId: u.plexId ?? null,
      managedProfile: !!u.plexManagedUserId,
      moviesWatched: status?.movies.length ?? 0,
      episodesWatched: status?.episodes.length ?? 0,
    };
  });
  return NextResponse.json({ accounts, movviz });
}
