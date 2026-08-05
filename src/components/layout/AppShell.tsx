"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { SWRConfig, mutate } from "swr";
import { useLibrarySSE } from "@/lib/events/useLibrarySSE";
import { Hourglass, LogOut } from "lucide-react";
import { AuroraBackground } from "@/components/fx/AuroraBackground";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { CommandPaletteProvider } from "./CommandPalette";
import { WhatsNewModal } from "./WhatsNewModal";
import { ToastContainer } from "@/components/ui/Toast";
import { ConfirmDialogHost } from "@/components/ui/ConfirmDialog";
import { PageLoaderProvider } from "@/components/ui/PageLoader";
import { I18nProvider, useT } from "@/i18n/provider";
import { VersionProvider } from "@/lib/version/VersionContext";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { GpuProvider } from "@/lib/gpu/GpuProvider";
import { PlayerProvider } from "@/lib/player/PlayerProvider";

/**
 * Shared data-fetch cache for the whole session. SWR keeps its cache keyed
 * by URL in a module-level store that survives client-side navigations —
 * so Bibliothèque/Découverte render instantly from whatever was last
 * fetched (even if that came from a different page hitting the same
 * endpoint, e.g. /api/library/movies) instead of every visit starting from
 * a blank state, while still revalidating in the background so it never
 * goes stale.
 */
const swrConfig = {
  fetcher: async (url: string) => {
    const r = await fetch(url, { cache: "no-store" });
    // Surface HTTP failures as SWR errors so consumers (e.g. engine-offline
    // detection) can tell "endpoint down" apart from "empty payload" — and
    // carry the status so callers can tell "session expired" (401) apart
    // from "engine actually unreachable" (503), which otherwise both render
    // as the same misleading "engine not started" message.
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status} for ${url}`) as Error & { status?: number };
      err.status = r.status;
      throw err;
    }
    return r.json();
  },
  revalidateOnFocus: true,
  dedupingInterval: 2000,
};

function PendingApprovalScreen({ username }: { username: string }) {
  const t = useT();
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Same stale-SWR-cache fix as UserMenu's logout / the login page.
    await mutate("/api/auth/me");
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl glass-strong p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber/12 text-amber">
          <Hourglass className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-black tracking-tight text-ink">{t("auth.pendingTitle")}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t("auth.pendingHint", { username })}</p>
        <button
          onClick={logout}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl glass text-sm font-bold text-down"
        >
          <LogOut className="h-4 w-4" /> {t("auth.logout")}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children, version }: { children: React.ReactNode; version: string }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  const currentUser = useCurrentUser();
  const isPending = !!currentUser && currentUser.status === "pending";

  // Every hook must run on every render regardless of which branch below
  // ends up returned — currentUser can flip (unauthenticated → signed in,
  // or active → pending) while this same component instance stays mounted
  // across a client-side navigation, and conditionally calling hooks only
  // in the "fully signed in" branch made React throw "rendered more hooks
  // than during the previous render" the moment that transition happened.
  // Subscribes to /api/events and revalidates SWR library keys on status
  // change — disabled (no SSE connection opened) on the auth pages/pending
  // screen, where there's nothing authenticated to keep live.
  useLibrarySSE(!isAuthPage && !isPending);
  const reduceMotion = useShouldReduceMotion();

  if (isAuthPage) {
    return (
      <GpuProvider>
        <I18nProvider>
          <AuroraBackground />
          <div className="relative z-10">{children}</div>
        </I18nProvider>
      </GpuProvider>
    );
  }

  if (isPending) {
    return (
      <GpuProvider>
        <I18nProvider>
          <AuroraBackground />
          <div className="relative z-10">
            <PendingApprovalScreen username={currentUser!.username} />
          </div>
        </I18nProvider>
      </GpuProvider>
    );
  }

  return (
      <GpuProvider>
      <SWRConfig value={swrConfig}>
        <I18nProvider>
          <VersionProvider version={version}>
            <CommandPaletteProvider>
              <PlayerProvider>
                <Suspense fallback={null}>
                  <PageLoaderProvider>
                    <AuroraBackground />
                    <div className="relative z-10 flex min-h-screen">
                      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:outline-none">
                        Skip to main content
                      </a>
                      <Sidebar version={version} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Topbar />
                        <main id="main-content" className="flex-1 px-4 pt-5 pb-24 sm:px-5 sm:pt-6 md:px-8 md:pt-8 lg:pb-8">
                          <div key={pathname} className={cn(!reduceMotion && "animate-page-fade-in")}>
                            {children}
                          </div>
                        </main>
                      </div>
                      <BottomNav />
                    </div>
                    <WhatsNewModal />
                    <ToastContainer />
                    <ConfirmDialogHost />
                  </PageLoaderProvider>
                </Suspense>
              </PlayerProvider>
            </CommandPaletteProvider>
          </VersionProvider>
        </I18nProvider>
      </SWRConfig>
      </GpuProvider>
  );
}
