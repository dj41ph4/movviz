import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { DEVICE_TYPES, type DeviceType } from "./deviceTypes";

/**
 * LOT7 — "Quels appareils utilisez-vous ?" (wizard, multi-select, distinct
 * from `HardwareStep`'s single-choice codec preset). Purely descriptive for
 * now: stored per user so a future per-device version-selection feature
 * (LOT6's `versions[]` already carries everything needed — resolution,
 * codec, language, size) has real data to work from, without implementing
 * that selection logic yet.
 *
 * Server-only (reads/writes via node:fs) — client components must import
 * the id list/type from `./deviceTypes` instead, never from this file.
 */
export type { DeviceType };

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "device-preferences.json");

type Store = Record<string, DeviceType[]>;

function isDeviceType(v: unknown): v is DeviceType {
  return typeof v === "string" && (DEVICE_TYPES as readonly string[]).includes(v);
}

export function getDevicePreferences(userId: string): DeviceType[] {
  const data = readJsonCached<Store>(FILE, {});
  return data[userId] ?? [];
}

export function saveDevicePreferences(userId: string, devices: unknown): DeviceType[] {
  const clean = Array.isArray(devices) ? [...new Set(devices.filter(isDeviceType))] : [];
  const data = readJsonCached<Store>(FILE, {});
  data[userId] = clean;
  writeJsonCached(FILE, data);
  return clean;
}
