import type { Metadata, Viewport } from "next";
import { BRAND } from "@/lib/brand";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import { fontVariables } from "./fonts";
import { AppShell } from "@/components/layout/AppShell";
import { ScrollRestoration } from "@/components/layout/ScrollRestoration";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { UserActivityPing } from "@/components/layout/UserActivityPing";
import { PerfReporter } from "@/components/system/PerfReporter";
import { getAppVersion } from "@/lib/updates/version";
import { REDUCE_MOTION_INIT_SCRIPT } from "@/lib/gpu/reduceMotionInit";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { resolveSession } from "@/lib/auth/store";
import { markUserActivity } from "@/lib/priority/userActivity";
import { loadUserPrefs } from "@/lib/userPrefs/store";
import { designModeOrDefault, type DesignMode } from "@/lib/appearance/designMode";

const DESCRIPTION =
  "Le centre de commande intelligent de vos films et séries — découverte, demandes et bibliothèque, orchestrés en un seul endroit.";

export const metadata: Metadata = {
  title: {
    template: "Movviz – %s",
    default: "Movviz — Centre de commande média intelligent",
  },
  description: DESCRIPTION,
  manifest: "/manifest.json",
  // Small sizes for the tab and home-screen icons — the 512px logo is 470 KB.
  icons: {
    icon: [
      { url: "/brand/movviz-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/movviz-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/brand/movviz-icon-180.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    title: "Movviz — Centre de commande média intelligent",
    description: DESCRIPTION,
    siteName: "Movviz",
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Priorité absolue au clic et au chargement de page : l'App Router re-rend
  // ce layout serveur à CHAQUE navigation client (et au chargement initial) —
  // chaque clic de lien marque donc l'activité utilisateur. Conséquence :
  // l'arrière-plan (yieldToUser, boucles Plex, bulk, RSS…) cède la main dès
  // la navigation et reprend 4 s après la dernière interaction. Les routes
  // API marquent déjà via requireUser ; ce point couvre le RSC lui-même
  // (sinon une navigation pure restait invisible de l'arrière-plan).
  // Bêta : décor du splash peint dès le premier affichage (avant l'hydratation). Posé seulement
  // sur le tableau de bord et au premier passage de la session, comme le splash lui-même.
  const PRESPLASH_INIT_SCRIPT = `try{if(location.pathname==="/"&&!sessionStorage.getItem("movviz-splash-seen"))document.documentElement.setAttribute("data-mv-presplash","")}catch(e){}`;
  // Même géométrie et même entrée que BrandSplash (dashboard-splash.css) : le composant reprend la même animation sans saut.
  const PRESPLASH_CSS = `html[data-mv-presplash]::before{content:"";position:fixed;inset:0;z-index:79;pointer-events:none;background:radial-gradient(60% 52% at 50% 41%,#1d0b42 0%,#0e0623 48%,#05030b 100%);animation:mv-presplash-expire 0s 12s forwards}html[data-mv-presplash]::after{content:"";position:fixed;z-index:79;pointer-events:none;left:50%;top:41%;width:clamp(150px,19vw,290px);aspect-ratio:640/442;transform:translate(-50%,-50%);background:url("${BRAND.mark}") center/contain no-repeat;animation:mv-m-in 900ms cubic-bezier(.2,.7,.2,1) both,mv-presplash-expire 0s 12s forwards}@keyframes mv-m-in{from{opacity:0;transform:translate(-50%,-50%) scale(.94)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}@keyframes mv-presplash-expire{to{opacity:0;visibility:hidden}}@media (prefers-reduced-motion:reduce){html[data-mv-presplash]::after{animation:mv-presplash-expire 0s 12s forwards}}`;
  // Tableau de bord : ses données partent dès l'analyse du HTML, en parallèle du JavaScript, au lieu
  // d'attendre l'hydratation. Le fetcher SWR (AppShell) reprend ces promesses une seule fois.
  const EARLY_DATA_SCRIPT = `try{if(location.pathname==="/"){var m=window.__mvEarly={};["/api/interface/dashboard","/api/dashboard/layout","/api/metadata/rows?type=movie","/api/metadata/rows?type=series"].forEach(function(k){m[k]=fetch(k,{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(String(r.status));return r.json()});m[k].catch(function(){})})}}catch(e){}`;
  let signedIn = false;
  let desktopTextScale: 110 | 120 | undefined;
  let designMode: DesignMode = "stable";
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const sessionUser = token ? resolveSession(token) : null;
    if (sessionUser?.status !== "pending" && (sessionUser?.desktopTextScale === 110 || sessionUser?.desktopTextScale === 120)) {
      desktopTextScale = sessionUser.desktopTextScale;
    }
    if (sessionUser && sessionUser.status !== "pending") {
      signedIn = true;
      markUserActivity(sessionUser);
      designMode = designModeOrDefault(loadUserPrefs(sessionUser.id).designMode);
    }
  } catch {
    // Pré-rendu statique au build (pas de cookies) — sans conséquence.
  }
  return (
    <html lang="fr" data-theme="dark" data-movviz-appearance="beta" data-movviz-design={designMode} className={fontVariables} data-desktop-text-scale={desktopTextScale} suppressHydrationWarning>
      {/* React ne monte le <img> du splash/sidebar qu'après l'hydratation JS —
          trop tard pour qu'il "apparaisse en premier". Ce preload démarre le
          téléchargement dès le HTML initial, en parallèle du JS, pour que le
          logo soit déjà en cache au moment où React le rend. */}
      <link rel="preload" as="image" href="/brand/movviz-lockup.png" fetchPriority="high" />
      <link rel="preload" as="image" href="/brand/movviz-mark.png" fetchPriority="high" />
      {signedIn && <script dangerouslySetInnerHTML={{ __html: EARLY_DATA_SCRIPT }} />}
      {designMode === "beta" && (
        <>
          <link rel="preload" as="image" href={BRAND.mark} fetchPriority="high" />
          <link rel="preload" as="image" href={BRAND.word} />
          <style dangerouslySetInnerHTML={{ __html: PRESPLASH_CSS }} />
          <script dangerouslySetInnerHTML={{ __html: PRESPLASH_INIT_SCRIPT }} />
        </>
      )}
      <body className="cinema-grain antialiased">
        <Script id="reduce-motion-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: REDUCE_MOTION_INIT_SCRIPT }} />
        <ScrollRestoration />
        <ServiceWorkerRegistration />
        {/* Marqueur d'activité : chaque clic réel ping le serveur (voir
            UserActivityPing) — l'arrière-plan cède la main au clic, même
            quand la navigation client ne re-rend pas le layout serveur. */}
        <UserActivityPing />
        <PerfReporter />
        <AppShell version={getAppVersion()} initialDesignMode={designMode}>{children}</AppShell>
      </body>
    </html>
  );
}
