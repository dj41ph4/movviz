"use client";

import useSWR from "swr";

export function usePendingRequests(): number {
  const { data } = useSWR<{ requests: { status: string }[] }>("/api/requests");
  return (data?.requests ?? []).filter((r) => r.status === "pending").length;
}
