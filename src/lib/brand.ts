/**
 * Beta brand files (public/brand/m): the « M ruban » symbol, the horizontal logo and the MOVVIZ
 * wordmark. Served with a one-year immutable cache: when a file changes, bump BRAND_REV.
 */
export const BRAND_REV = "1";
export const brandAsset = (name: string) => `/brand/m/${name}?v=${BRAND_REV}`;

export const BRAND = {
  mark: brandAsset("movviz-m-640.webp"),
  markSmall: brandAsset("movviz-m-128.webp"),
  logo: brandAsset("movviz-logo-h-960.webp"),
  logoSmall: brandAsset("movviz-logo-h-480.webp"),
  word: brandAsset("movviz-word-720.webp"),
} as const;

/** Intrinsic aspect ratios (width / height) of the exported files. */
export const BRAND_RATIO = { mark: 640 / 442, logo: 960 / 213, word: 720 / 251 } as const;
