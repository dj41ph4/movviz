/** i18n configuration. French is the primary language of Movviz. */

export const LOCALES = ["fr", "en", "it", "nl", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_META: Record<Locale, { label: string }> = {
  fr: { label: "Français" },
  en: { label: "English" },
  it: { label: "Italiano" },
  nl: { label: "Nederlands" },
  de: { label: "Deutsch" },
};

export const STORAGE_KEY = "movviz.locale";
