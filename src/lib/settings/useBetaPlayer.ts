"use client";

import useSWR from "swr";

export function useBetaPlayer() {
  const { data, mutate } = useSWR<{ enabled: boolean }>("/api/settings/beta-player");
  const enabled = data?.enabled ?? false;

  const setEnabled = async (next: boolean) => {
    mutate({ enabled: next }, { revalidate: false });
    try {
      await fetch("/api/settings/beta-player", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded: data !== undefined, setEnabled };
}
