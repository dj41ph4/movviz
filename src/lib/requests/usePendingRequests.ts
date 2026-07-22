"use client";

import { useEffect, useState } from "react";

export function usePendingRequests(): number {
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch("/api/requests", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setPendingRequests((d.requests ?? []).filter((r: { status: string }) => r.status === "pending").length);
        })
        .catch(() => {});
    load();
    // Same reasoning as usePendingUsers: a pending-request badge doesn't
    // need 5s freshness, and this fetched the full requests list every tick
    // for as long as the sidebar was mounted.
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  return pendingRequests;
}
