"use client";

import useSWR from "swr";
import type { InterfaceDataMode } from "@/lib/settings/interfaceDataMode";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error(`interface_data_${response.status}`);
    return response.json() as Promise<{ mode: InterfaceDataMode }>;
  });

export function useInterfaceDataMode() {
  const { data, error, isLoading, mutate } = useSWR<{ mode: InterfaceDataMode }>(
    "/api/settings/interface-data",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000,
    },
  );

  return {
    mode: data?.mode ?? "optimized",
    optimized: (data?.mode ?? "optimized") === "optimized",
    ready: data !== undefined || error !== undefined,
    isLoading,
    error,
    mutate,
  };
}
