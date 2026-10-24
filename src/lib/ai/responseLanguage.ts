import type { Locale } from "@/i18n/config";

const languageWords: Record<Locale, RegExp> = {
  fr: /\b(?:je|tu|vous|est|avec|pour|quoi|quel|quelle|bonjour|merci|regarder|film|série)\b/gi,
  en: /\b(?:i|you|the|what|which|where|why|how|please|watch|movie|show|can|would|recommend)\b/gi,
  it: /\b(?:io|tu|che|quale|come|perché|guardare|film|serie|grazie|ciao)\b/gi,
  nl: /\b(?:ik|jij|wat|welke|waarom|hoe|kijken|film|serie|alsjeblieft|bedankt)\b/gi,
  de: /\b(?:ich|du|was|welche|warum|wie|sehen|film|serie|bitte|danke)\b/gi,
};

/** Only override the profile when a message contains clear language evidence. */
export function resolveAiLocale(profileLocale: Locale, message: string): Locale {
  const scores = (Object.keys(languageWords) as Locale[])
    .map((locale) => ({ locale, score: [...message.matchAll(languageWords[locale])].length }))
    .sort((a, b) => b.score - a.score);
  return scores[0].score >= 2 && scores[0].score > scores[1].score ? scores[0].locale : profileLocale;
}

const names: Record<Locale, string> = {
  fr: "French", en: "English", it: "Italian", nl: "Dutch", de: "German",
};

const tmdbLanguages: Record<Locale, string> = {
  fr: "fr-FR", en: "en-US", it: "it-IT", nl: "nl-NL", de: "de-DE",
};

export function aiLanguageInstruction(locale: Locale, message?: string): string {
  return `\n\nRESPONSE LANGUAGE — This instruction overrides the language of all French examples and internal notes above. ${message ? "For this reply, " : ""}use the language of the user's latest substantive message when it is clear; otherwise use the account's selected language, ${names[locale]}. A short acknowledgement or a movie title alone does not change the conversation language. Keep recommendation introductions, reasons, questions and visible text in that language. Use a title's verified official name in that language when known; otherwise retain its original name. Never invent or literally translate a movie or series title. Preserve JSON keys, action names and invisible markers exactly as specified.`;
}

export function tmdbLanguage(locale: Locale): string {
  return tmdbLanguages[locale];
}
