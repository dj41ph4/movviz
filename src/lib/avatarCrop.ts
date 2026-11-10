/**
 * Recadrage de la photo de profil — calculs purs (sans DOM), partagés par la fenêtre de recadrage
 * et par les tests. Le « viewport » est le carré visible (en px CSS) ; l'image est affichée à
 * l'échelle `coverScale × zoom`, décalée de (x, y) par rapport au coin haut-gauche du viewport.
 */

/** Taille maximale d'un fichier de photo de profil, côté serveur ET côté client. */
export const AVATAR_MAX_BYTES = 6 * 1024 * 1024;
/** Côté (px) de l'image carrée envoyée après recadrage. */
export const AVATAR_OUTPUT_PX = 512;
export const AVATAR_MIN_ZOOM = 1;
export const AVATAR_MAX_ZOOM = 4;

/** Échelle minimale pour que l'image recouvre tout le viewport. */
export function coverScale(imageW: number, imageH: number, viewport: number): number {
  return Math.max(viewport / imageW, viewport / imageH);
}

export function clampZoom(zoom: number): number {
  return Math.min(AVATAR_MAX_ZOOM, Math.max(AVATAR_MIN_ZOOM, zoom));
}

/** Garde l'image toujours recouvrante : aucun bord vide dans le cadre. */
export function clampOffset(imageW: number, imageH: number, viewport: number, zoom: number, x: number, y: number): { x: number; y: number } {
  const scale = coverScale(imageW, imageH, viewport) * zoom;
  const minX = Math.min(0, viewport - imageW * scale);
  const minY = Math.min(0, viewport - imageH * scale);
  return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
}

/** Décalage centré (image au milieu du cadre). */
export function centeredOffset(imageW: number, imageH: number, viewport: number, zoom: number): { x: number; y: number } {
  const scale = coverScale(imageW, imageH, viewport) * zoom;
  return clampOffset(imageW, imageH, viewport, zoom, (viewport - imageW * scale) / 2, (viewport - imageH * scale) / 2);
}

/** Change le zoom en gardant fixe le point au centre du cadre. */
export function zoomAroundCenter(imageW: number, imageH: number, viewport: number, fromZoom: number, toZoom: number, x: number, y: number): { x: number; y: number } {
  const base = coverScale(imageW, imageH, viewport);
  const from = base * fromZoom;
  const to = base * clampZoom(toZoom);
  const cx = (viewport / 2 - x) / from; // point de l'image au centre du cadre
  const cy = (viewport / 2 - y) / from;
  return clampOffset(imageW, imageH, viewport, clampZoom(toZoom), viewport / 2 - cx * to, viewport / 2 - cy * to);
}

/** Rectangle de l'image source qui correspond au cadre visible. */
export function sourceRect(imageW: number, imageH: number, viewport: number, zoom: number, x: number, y: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = coverScale(imageW, imageH, viewport) * zoom;
  const sw = viewport / scale;
  return { sx: -x / scale, sy: -y / scale, sw, sh: sw };
}
