"use client";

import useSWR from "swr";

// Explicit fetcher: this hook also runs on /login and /setup, which render
// outside the app-shell SWRConfig (no global fetcher there).
const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

/**
 * `setupRequired` de /api/auth/me — partage la même clé SWR que
 * useCurrentUser, donc aucun fetch supplémentaire : première valeur rendue
 * par l'app quand aucun compte n'existe encore (ou plus — dossier config
 * supprimé, réinitialisation d'usine). AppShell l'utilise pour rediriger
 * vers le wizard (/setup) au lieu d'afficher une app cassée.
 */
export function useSetupRequired(): boolean | undefined {
  const { data } = useSWR<{ user: { id: string } | null; setupRequired: boolean }>("/api/auth/me", fetcher, {
    dedupingInterval: 30_000,
    revalidateOnFocus: false,
  });
  return data === undefined ? undefined : data.setupRequired;
}
