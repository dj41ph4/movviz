/** Visual polish is opt-in. Stable preserves the interface shipped before it. */
export const DESIGN_MODES = ["stable", "beta"] as const;
export type DesignMode = (typeof DESIGN_MODES)[number];

export function designModeOrDefault(value: unknown): DesignMode {
  return value === "beta" ? "beta" : "stable";
}
