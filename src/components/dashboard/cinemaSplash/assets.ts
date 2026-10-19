/**
 * Beta splash: where the precomputed images live (public/brand/splash) and what they describe.
 * The files are served with a one-year immutable cache: when an image changes, bump SPLASH_REV,
 * otherwise browsers keep the old one.
 */
export const SPLASH_REV = "2";
export const splashAsset = (name: string) => `/brand/splash/${name}?v=${SPLASH_REV}`;

export interface SplashFamily {
  id: string;
  rect: [number, number, number, number];
  kind: "conic" | "linear";
  dir: [number, number] | null;
  center: [number, number] | null;
}

export interface SplashManifest {
  w: number;
  h: number;
  families: SplashFamily[];
  logo: { x: number; y: number; w: number; h: number };
  bar: { x0: number; x1: number; y: number; h: number };
  tagY: number;
  labelY: number;
  cx: number;
}

/** Plate layout, embedded so the splash never waits for a network round trip before drawing. */
export const SPLASH_MANIFEST: SplashManifest = {
  w: 1916,
  h: 821,
  families: [
    { id: "tri", rect: [700, 30, 470, 320], kind: "conic", dir: null, center: [940, 215] },
    { id: "beamL", rect: [640, 0, 66, 345], kind: "linear", dir: [0, 1], center: null },
    { id: "beamR", rect: [1210, 0, 66, 345], kind: "linear", dir: [0, 1], center: null },
    { id: "ceilL", rect: [0, 0, 640, 205], kind: "linear", dir: [0.89, 0.46], center: null },
    { id: "ceilR", rect: [1276, 0, 640, 205], kind: "linear", dir: [-0.89, 0.46], center: null },
    { id: "pillL", rect: [490, 205, 150, 375], kind: "linear", dir: [0, -1], center: null },
    { id: "pillR", rect: [1276, 205, 150, 375], kind: "linear", dir: [0, -1], center: null },
    { id: "floorL", rect: [0, 575, 958, 246], kind: "linear", dir: [-1, 0], center: null },
    { id: "floorR", rect: [958, 575, 958, 246], kind: "linear", dir: [1, 0], center: null },
  ],
  logo: { x: 620, y: 290, w: 686, h: 146 },
  bar: { x0: 686, x1: 1234, y: 510, h: 26 },
  tagY: 457,
  labelY: 564,
  cx: 958,
};
