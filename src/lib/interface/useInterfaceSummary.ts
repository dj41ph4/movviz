"use client";

import useSWR from "swr";
import { useInterfaceDataMode } from "@/lib/settings/useInterfaceDataMode";

export interface InterfaceSummary {
  pendingRequests: number;
  pendingUsers: number;
  activeDownloads: number;
  unreadNotifications: number;
}

export function useInterfaceSummary() {
  const { optimized, ready } = useInterfaceDataMode();
  const result = useSWR<InterfaceSummary>(ready && optimized ? "/api/interface/summary" : null, {
    // A few counters, cheap to re-read when the user comes back to the tab.
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });
  return { ...result, optimized, ready };
}
