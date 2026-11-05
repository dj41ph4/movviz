import type { QualityProfile } from "./types";

export const DEFAULT_QUALITY_PROFILES: QualityProfile[] = [
  {
    id: "any",
    name: "Any",
    allowedResolutions: ["480p", "720p", "1080p", "2160p"],
    minScore: 1,
    cutoffResolution: "2160p",
  },
  {
    id: "hd-720p",
    name: "HD-720p",
    allowedResolutions: ["720p", "1080p", "2160p"],
    minScore: 1,
    cutoffResolution: "1080p",
  },
  {
    id: "hd-1080p",
    name: "HD-1080p",
    allowedResolutions: ["1080p", "2160p"],
    minScore: 60,
    cutoffResolution: "1080p",
  },
  {
    id: "ultra-hd",
    name: "Ultra-HD",
    allowedResolutions: ["2160p"],
    minScore: 70,
    cutoffResolution: "2160p",
  },
];

/** Valeur de repli côté client (aucun accès disque) ; le profil réellement réglé vient de configuredQualityProfile() côté serveur. */
export function defaultQualityProfile(): QualityProfile {
  return DEFAULT_QUALITY_PROFILES[0];
}
