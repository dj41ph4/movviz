"use client";

import { useT } from "@/i18n/provider";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";

/**
 * "Lire" when the Beta player will actually handle this play action,
 * "Lire sur Plex" when it's a genuine hand-off to Plex — derived from the
 * same enabled + plexRatingKey gating condition every call site already
 * uses to pick its button-vs-link branch, so the label always matches what
 * actually happens on click.
 */
export function usePlayLabel(plexRatingKey: string | null | undefined) {
  const t = useT();
  const { enabled: betaPlayer } = useBetaPlayer();
  const willUseTheater = betaPlayer && !!plexRatingKey;
  return {
    willUseTheater,
    label: willUseTheater ? t("library.play") : t("library.watchOnPlex"),
  };
}
