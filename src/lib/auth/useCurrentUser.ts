"use client";

import useSWR from "swr";
import type { PublicUser } from "./types";

// Explicit fetcher: this hook also runs on /login and /setup, which render
// outside the app-shell SWRConfig (no global fetcher there).
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

/** undefined = still loading, null = not signed in, PublicUser = signed in. */
export function useCurrentUser() {
  // Session-wide shared cache: every component using this hook reads the same
  // entry, so only the first mount fetches — later pages know the user
  // instantly (admin-only UI no longer pops in after paint).
  const { data, error } = useSWR<{ user: PublicUser | null }>("/api/auth/me", fetcher, {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });
  if (error) return null;
  return data === undefined ? undefined : data.user ?? null;
}
