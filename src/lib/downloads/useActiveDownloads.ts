"use client";

import useSWR from "swr";
import type { EngineTorrent } from "@/lib/types";

export function useActiveDownloads(): number {
  const { data } = useSWR<{ torrents: EngineTorrent[] }>("/api/engine/torrents");
  return (data?.torrents ?? []).filter((t) => t.state === "downloading" || t.state === "metadata").length;
}
