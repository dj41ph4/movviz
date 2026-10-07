export const DESKTOP_TEXT_SCALES = [100, 110, 120] as const;
export type DesktopTextScale = (typeof DESKTOP_TEXT_SCALES)[number];

export function isDesktopTextScale(value: unknown): value is DesktopTextScale {
  return value === 100 || value === 110 || value === 120;
}

export function desktopTextScaleOrDefault(value: unknown): DesktopTextScale {
  return isDesktopTextScale(value) ? value : 100;
}
