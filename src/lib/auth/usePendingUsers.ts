"use client";

import { useEffect, useState } from "react";

export function usePendingUsers(): number {
  const [pendingUsers, setPendingUsers] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch("/api/users", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setPendingUsers((d.users ?? []).filter((u: { status: string }) => u.status === "pending").length);
        })
        .catch(() => {});
    load();
    // A pending-approval count doesn't need sub-second freshness — this ran
    // every 5s for as long as the sidebar was mounted (effectively the whole
    // session for any admin), fetching the full user list each time. 30s
    // keeps the badge feeling live without the constant background load.
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  return pendingUsers;
}
