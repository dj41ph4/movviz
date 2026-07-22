import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { PerfReporter } from "@/components/system/PerfReporter";
import { getAppVersion } from "@/lib/updates/version";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";

const DESCRIPTION =
  "Le centre de commande intelligent de vos films et séries — découverte, demandes et bibliothèque, orchestrés en un seul endroit.";

export const metadata: Metadata = {
  title: "Movviz — Centre de commande média intelligent",
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
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ServiceWorkerRegistration />
        <PerfReporter />
        <AppShell version={getAppVersion()}>{children}</AppShell>
      </body>
    </html>
  );
}
