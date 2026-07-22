export type ThemeMode = "light" | "dark" | "auto";

const STORAGE_KEY = "movviz-theme";

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : "auto";
}

export function setStoredThemeMode(mode: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, mode);
}

export function systemPrefersLight(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
}

/** Resolves "auto" against the OS preference; "light"/"dark" pass through unchanged. */
export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") return systemPrefersLight() ? "light" : "dark";
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolveTheme(mode);
}

/**
 * Inline script string injected via next/script(beforeInteractive) — runs
 * before hydration so the page never paints the wrong theme first. Kept as
 * plain JS (not TS) since it executes as-is in the browser, unbundled.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("${STORAGE_KEY}");
    var mode = stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
    var resolved = mode === "auto"
      ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : mode;
    document.documentElement.dataset.theme = resolved;
  } catch (e) {}
})();
`;
