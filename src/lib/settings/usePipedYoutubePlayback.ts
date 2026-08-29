"use client";

import useSWR from "swr";

export const KEY = "/api/settings/piped-youtube";

interface PipedYoutubeData {
  enabled?: boolean;
}

export function usePipedYoutubePlayback() {
  const { data, error, isLoading, mutate } = useSWR<PipedYoutubeData>(KEY);

  const enabled = data?.enabled ?? false;

  const setEnabled = async (next: boolean) => {
    mutate({ enabled: next }, { revalidate: false });
    try {
      await fetch(KEY, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, isLoading, error, setEnabled };
}
