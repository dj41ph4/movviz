import type { BleachPart } from "./bleachPresentation";

export interface BleachArtworkSelection {
  customBackdropPath?: string | null;
  customLogoPath?: string | null;
}
export type BleachArtworkByPart = Partial<Record<BleachPart, BleachArtworkSelection>>;

/** Existing artwork belongs to the original fiche; TYBW has its own choices. */
export function bleachPartArtwork(series: BleachArtworkSelection & { bleachArtwork?: BleachArtworkByPart }, part: BleachPart): BleachArtworkSelection {
  const selected = series.bleachArtwork?.[part];
  return {
    customBackdropPath: selected?.customBackdropPath !== undefined ? selected.customBackdropPath : part === "original" ? series.customBackdropPath : undefined,
    customLogoPath: selected?.customLogoPath !== undefined ? selected.customLogoPath : part === "original" ? series.customLogoPath : undefined,
  };
}

/** A logo save must preserve this part's backdrop and the other part's choices. */
export function patchBleachArtwork(current: BleachArtworkByPart | undefined, part: BleachPart, patch: BleachArtworkSelection): BleachArtworkByPart {
  return { ...current, [part]: { ...current?.[part], ...patch } };
}
