"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  // Hydrate the stored preference after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && LOCALES.includes(stored)) setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback<TFn>(
    (path, params) => interpolate(resolve(DICTS[locale], path), params),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
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
