import { isHdrDvToSdrEnabled } from "@/lib/settings/betaPlayer";
import { benchmarkRealtimeFactor } from "@/lib/playback/engine/serverBenchmark";

/**
 * Même règle que le moteur de lecture (playback/prepare) : la conversion
 * HDR/DV → SDR n'a lieu que si le réglage est activé ET si le banc d'essai du
 * serveur mesure au moins 3× le temps réel. Sinon, jamais de conversion.
 */
export function castToneMapAllowed(): boolean {
  if (!isHdrDvToSdrEnabled()) return false;
  return (benchmarkRealtimeFactor("software_720p_tonemap") ?? 0) >= 3;
}
