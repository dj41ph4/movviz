import useSWR from "swr";

function fetcher(url: string) {
  return fetch(url, { cache: "no-store" }).then((r) => r.json());
}

export function useAutoUpdate() {
  const { data, mutate } = useSWR<{ enabled: boolean }>(
    "/api/settings/auto-update",
    fetcher,
  );
  return {
    enabled: data?.enabled ?? true,
    setEnabled: async (enabled: boolean) => {
      await fetch("/api/settings/auto-update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      mutate();
    },
  };
}