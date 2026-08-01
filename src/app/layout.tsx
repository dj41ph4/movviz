import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ScrollRestoration } from "@/components/layout/ScrollRestoration";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { PerfReporter } from "@/components/system/PerfReporter";
import { getAppVersion } from "@/lib/updates/version";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
import { REDUCE_MOTION_INIT_SCRIPT } from "@/lib/gpu/reduceMotionInit";

const DESCRIPTION =
  "Le centre de commande intelligent de vos films et séries — découverte, demandes et bibliothèque, orchestrés en un seul endroit.";

export const metadata: Metadata = {
  title: {
    template: "Movviz – %s",
    default: "Movviz — Centre de commande média intelligent",
  },
  description: DESCRIPTION,
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    title: "Movviz — Centre de commande média intelligent",
    description: DESCRIPTION,
    siteName: "Movviz",
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#05060b" },
    { media: "(prefers-color-scheme: light)", color: "#f5f6fb" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="cinema-grain antialiased">
        {/* next/script's beforeInteractive strategy injects this before hydration
            (avoiding a flash of the wrong theme) via Next's own script-injection
            path — a raw <script> tag here got reconciled by React on every
            client-side navigation, which correctly (but harmlessly) warned
            "scripts inside React components are never executed when rendering
            on the client" each time. */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Script id="reduce-motion-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: REDUCE_MOTION_INIT_SCRIPT }} />
        <ScrollRestoration />
        <ServiceWorkerRegistration />
        <PerfReporter />
        <AppShell version={getAppVersion()}>{children}</AppShell>
      </body>
    </html>
  );
}
