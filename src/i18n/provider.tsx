"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fr } from "./locales/fr";
import { en } from "./locales/en";
import { it } from "./locales/it";
import { nl } from "./locales/nl";
import { de } from "./locales/de";
import type { Dictionary } from "./types";
import {
  DEFAULT_LOCALE,
  LOCALES,
  STORAGE_KEY,
  type Locale,
} from "./config";

const DICTS: Record<Locale, Dictionary> = { fr, en, it, nl, de };

type TFn = (path: string, params?: Record<string, string | number>) => string;

interface I18nCtx {
  locale: Locale;
  localeReady: boolean;
  setLocale: (l: Locale) => void;
  t: TFn;
}

const Ctx = createContext<I18nCtx | null>(null);

/** Resolve a dot-path ("settings.title") against a nested dictionary. */
function resolve(dict: Dictionary, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], dict);
  return typeof value === "string" ? value : path;
}

function interpolate(str: string, params?: Record<string, string | number>) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [localeReady, setLocaleReady] = useState(false);
  const selectedByUser = useRef(false);

  // Hydrate the stored preference after mount (avoids SSR mismatch).
  useEffect(() => {
    let stored: Locale | null = null;
    try { stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null; } catch { /* Account preference still loads. */ }
    if (stored && LOCALES.includes(stored)) queueMicrotask(() => {
      if (!selectedByUser.current) setLocaleState(stored);
    });

    // Account-level preference wins once it loads — confirmed live: the
    // interface language was device-only, resetting on every new browser or
    // device. Also writes back to localStorage for instant hydration next
    // time. Silently ignored when logged out or offline.
    fetch("/api/settings/preferences", { cache: "no-store", signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const locale = d?.prefs?.locale as Locale | undefined;
        if (!selectedByUser.current && locale && LOCALES.includes(locale)) {
          try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* Optional local cache. */ }
          setLocaleState(locale);
        }
      })
      .catch(() => {})
      .finally(() => setLocaleReady(true));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    selectedByUser.current = true;
    setLocaleState(l);
    setLocaleReady(true);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* Account preference still saves. */ }
    fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: l }),
    }).catch(() => {});
  }, []);

  const t = useCallback<TFn>(
    (path, params) => interpolate(resolve(DICTS[locale], path), params),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, localeReady, setLocale, t }),
    [locale, localeReady, setLocale, t]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

/** Convenience hook when only the translate function is needed. */
export function useT() {
  return useI18n().t;
}
