export type ActivityVersion = "v1" | "v2";

export interface ActivitySettings {
  version: ActivityVersion;
  showBetaWarning: boolean;
}

export const DEFAULT_ACTIVITY_SETTINGS: ActivitySettings = {
  version: "v2",
  showBetaWarning: true,
};