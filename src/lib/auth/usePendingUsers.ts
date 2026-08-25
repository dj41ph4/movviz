"use client";

import useSWR from "swr";
import { useCurrentUser } from "./useCurrentUser";
import { useInterfaceSummary } from "@/lib/interface/useInterfaceSummary";

export function usePendingUsers(): number {
  const user = useCurrentUser();
  const summary = useInterfaceSummary();
  const { data } = useSWR<{ users: { status: string }[] }>(
    summary.ready && !summary.optimized && user?.role === "admin" ? "/api/users" : null
  );
  if (summary.optimized) return summary.data?.pendingUsers ?? 0;
  return (data?.users ?? []).filter((u) => u.status === "pending").length;
}
