"use client";

import useSWR from "swr";
import { useCurrentUser } from "./useCurrentUser";

export function usePendingUsers(): number {
  const user = useCurrentUser();
  const { data } = useSWR<{ users: { status: string }[] }>(
    user?.role === "admin" ? "/api/users" : null
  );
  return (data?.users ?? []).filter((u) => u.status === "pending").length;
}
