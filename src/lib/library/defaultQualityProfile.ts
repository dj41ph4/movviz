import { DEFAULT_QUALITY_PROFILES } from "./qualityProfiles";
import { loadReleaseRules } from "./releaseRules";
import type { QualityProfile } from "./types";

/**
 * Profil de qualité donné aux titres ajoutés, tel que réglé dans Réglages > Qualité.
 * Serveur uniquement (lit releaseRules.json) : un composant client ne doit jamais importer ce fichier,
 * il utilise defaultQualityProfile() de qualityProfiles.ts.
 */
export function configuredQualityProfile(): QualityProfile {
  const id = loadReleaseRules().defaultQualityProfileId;
  return DEFAULT_QUALITY_PROFILES.find((p) => p.id === id) ?? DEFAULT_QUALITY_PROFILES[0];
}
