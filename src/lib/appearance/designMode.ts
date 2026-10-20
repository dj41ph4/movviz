/** Beta is Movviz's only design, rendered server-side from the first
 *  paint. "stable" is still a valid stored value (older preferences keep
 *  validating) but is never applied anymore. */
export const DESIGN_MODES = ["stable", "beta"] as const;
export type DesignMode = (typeof DESIGN_MODES)[number];

export const DESIGN_MODE: DesignMode = "beta";
