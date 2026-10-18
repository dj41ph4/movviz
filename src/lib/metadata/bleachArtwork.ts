import type { BleachPart } from "./bleachPresentation";

export interface BleachArtworkSelection {
  customBackdropPath?: string | null;
  customLogoPath?: string | null;
}
export type BleachArtworkByPart = Partial<Record<BleachPart, BleachArtworkSelection>>;
export const BLEACH_LOGOS = { original: "/8LUioGrJ0RlvVq9rpPTkrJaGTYl.png", tybw: "/jEImh4O7mcYuwuAeryGZo3G6hg6.png" } as const;

/** Existing artwork belongs to the original fiche; TYBW has its own choices. */
export function bleachPartArtwork(series: BleachArtworkSelection & { bleachArtwork?: BleachArtworkByPart }, part: BleachPart): BleachArtworkSelection {
  const selected = series.bleachArtwork?.[part];
  const logo = selected?.customLogoPath !== undefined ? selected.customLogoPath : part === "original" ? series.customLogoPath : undefined;
  return {
    customBackdropPath: selected?.customBackdropPath !== undefined ? selected.customBackdropPath : part === "original" ? series.customBackdropPath : undefined,
    customLogoPath: logo === "/hNc25NvN8cadjFfeEGVrpbZnhmy.png" && part === "tybw" ? BLEACH_LOGOS.tybw : logo !== undefined ? logo : BLEACH_LOGOS[part],
  };
}

/** A logo save must preserve this part's backdrop and the other part's choices. */
export function patchBleachArtwork(current: BleachArtworkByPart | undefined, part: BleachPart, patch: BleachArtworkSelection): BleachArtworkByPart {
  return { ...current, [part]: { ...current?.[part], ...patch } };
}
