"use client";

import { useT } from "@/i18n/provider";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";

/**
 * "Lire" when Movviz can open the player, "Lire sur Plex" only for a
 * genuine hand-off. `playbackId` is normally the Plex key, but can be the
 * stable Movviz id while the Plex enrichment is still pending.
 */
export function usePlayLabel(
  playbackId: string | null | undefined,
  /** A validated Movviz file can be played even before Plex has indexed it. */
  hasLocalPlayback = false,
) {
  const t = useT();
  const { enabled: betaPlayer } = useBetaPlayer();
  // A Movviz-managed file must stay readable even if the optional Plex
  // enrichment is disabled or has not completed yet.
  const willUseTheater = !!playbackId && (betaPlayer || hasLocalPlayback);
  return {
    willUseTheater,
    label: willUseTheater ? t("library.play") : t("library.watchOnPlex"),
  };
}
