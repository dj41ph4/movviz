/**
 * Client-safe constants/types for LOT7's device-preferences question — split
 * out from devicePreferences.ts (which reads/writes via node:fs) so a
 * "use client" component can import the id list without pulling server-only
 * filesystem code into the browser bundle.
 */
export const DEVICE_TYPES = ["tv4k", "smartphone", "tablet", "pc", "console", "remoteServer"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];
