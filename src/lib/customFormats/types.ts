/**
 * Custom formats — named release-title scoring rules, replacing a single
 * hardcoded score() with something the user can tune. Each format lists a set
 * of regex terms; if any matches the release title, its score (positive or
 * negative) is added on top of the base resolution/seeders/age score.
 */
export interface CustomFormat {
  id: string;
  name: string;
  i18nKey?: string;
  score: number; // can be negative, to penalize (e.g. SUBFRENCH)
  terms: string[]; // regex patterns, case-insensitive, matched against the release title
  enabled: boolean;
}
