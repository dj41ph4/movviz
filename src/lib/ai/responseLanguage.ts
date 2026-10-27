import type { Locale } from "@/i18n/config";

const languageWords: Record<Locale, RegExp> = {
  // Seen live: « donne moi des film belge du premier janvier 2025 au 31
  // decembre 2025 » only matched « film » (in every list), so the reply came
  // back in the account's German. Each list now also has everyday verbs,
  // function words and month names that belong to one language only.
  fr: /\b(?:je|tu|vous|est|avec|pour|quoi|quel|quelle|bonjour|merci|regarder|film|série|donne|donnez|moi|toi|les|une|au|aux|dans|qui|que|mon|mes|propose|proposes|cherche|trouve|montre|premier|janvier|fevrier|février|avril|juin|juillet|aout|août|decembre|décembre)\b/gi,
  en: /\b(?:i|you|the|what|which|where|why|how|please|watch|movie|show|can|would|recommend|give|find|some|from|with|and|january|february|april|june|july|august)\b/gi,
  it: /\b(?:io|tu|che|quale|come|perché|guardare|film|serie|grazie|ciao|dammi|mostrami|cerco|dal|nel|gennaio|febbraio|aprile|giugno|luglio|agosto|dicembre|marzo)\b/gi,
  nl: /\b(?:ik|jij|wat|welke|waarom|hoe|kijken|film|serie|alsjeblieft|bedankt|geef|toon|zoek|een|met|naar|januari|februari|maart|augustus)\b/gi,
  de: /\b(?:ich|du|was|welche|warum|wie|sehen|film|serie|bitte|danke|gib|mir|zeig|suche|einen|eine|und|mit|von|januar|februar|märz|dezember)\b/gi,
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
