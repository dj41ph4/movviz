/** Beta is the default design for everyone, rendered server-side from the
 *  first paint (no Stable → Beta switch). Stable stays available as an
 *  explicit per-user choice in Settings. */
export const DESIGN_MODES = ["stable", "beta"] as const;
export type DesignMode = (typeof DESIGN_MODES)[number];

export function designModeOrDefault(value: unknown): DesignMode {
  return value === "stable" ? "stable" : "beta";
}
