import type { QualityProfile } from "./types";
import { loadReleaseRules } from "./releaseRules";

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

export function defaultQualityProfile(): QualityProfile {
  // Réglable dans Réglages > Qualité ; "any" tant que rien n'est choisi, pour ne jamais écarter une release à cause de sa seule résolution.
  const id = loadReleaseRules().defaultQualityProfileId;
  return DEFAULT_QUALITY_PROFILES.find((p) => p.id === id) ?? DEFAULT_QUALITY_PROFILES[0];
}
