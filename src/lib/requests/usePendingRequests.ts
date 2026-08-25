"use client";

import useSWR from "swr";
import { useInterfaceSummary } from "@/lib/interface/useInterfaceSummary";

export function usePendingRequests(): number {
  const summary = useInterfaceSummary();
  const { data } = useSWR<{ requests: { status: string }[] }>(summary.ready && !summary.optimized ? "/api/requests" : null);
  if (summary.optimized) return summary.data?.pendingRequests ?? 0;
  return (data?.requests ?? []).filter((r) => r.status === "pending").length;
}
