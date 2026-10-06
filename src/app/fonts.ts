import localFont from "next/font/local";

/*
 * Polices « Salle obscure » (apparence Bêta, desktop). Fichiers embarqués
 * (licence SIL OFL 1.1, voir src/app/fonts/LICENSE-*) : aucun appel réseau,
 * donc identiques sur Windows, Linux et Docker hors ligne. preload: false —
 * Stable ne les utilise pas et ne doit pas payer leur téléchargement ; le
 * navigateur ne les récupère que lorsqu'une règle Bêta les applique.
 */
export const fontDisplay = localFont({
  src: "./fonts/BricolageGrotesque-Latin-Variable.woff2",
  weight: "200 800",
  variable: "--font-mv-display",
  display: "swap",
  preload: false,
  fallback: ["Segoe UI Variable Display", "Segoe UI", "system-ui", "sans-serif"],
});

export const fontUi = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-mv-ui",
  display: "swap",
  preload: false,
  fallback: ["Segoe UI Variable", "Segoe UI", "system-ui", "sans-serif"],
});

export const fontMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-mv-mono",
  display: "swap",
  preload: false,
  fallback: ["Cascadia Mono", "ui-monospace", "monospace"],
});

export const fontVariables = `${fontDisplay.variable} ${fontUi.variable} ${fontMono.variable}`;
