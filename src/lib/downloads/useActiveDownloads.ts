"use client";

import useSWR from "swr";
import type { EngineTorrent } from "@/lib/types";
import { useInterfaceSummary } from "@/lib/interface/useInterfaceSummary";

export function useActiveDownloads(): number {
  const summary = useInterfaceSummary();
  const { data } = useSWR<{ torrents: EngineTorrent[] }>(summary.ready && !summary.optimized ? "/api/engine/torrents" : null);
  if (summary.optimized) return summary.data?.activeDownloads ?? 0;
  return (data?.torrents ?? []).filter((t) => t.state === "downloading" || t.state === "metadata").length;
}
