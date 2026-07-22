"use client";

import useSWR from "swr";
import type { EngineTorrent } from "@/lib/types";

/** Shares the SWR key already polled by DownloadQueue/dashboard/activity — no extra request. */
export function useActiveDownloads(): number {
  const { data } = useSWR<{ torrents: EngineTorrent[] }>("/api/engine/torrents", { refreshInterval: 3000 });
  // The Activity queue displays a "metadata" torrent (fetching torrent info,
  // before any pieces download) as "downloading" — count it the same way
  // here, or a torrent that's visibly active in the queue leaves the nav
  // badge undercounting/stale until real piece transfer starts.
  return (data?.torrents ?? []).filter((t) => t.state === "downloading" || t.state === "metadata").length;
}
