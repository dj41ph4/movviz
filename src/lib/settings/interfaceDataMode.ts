import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

export type InterfaceDataMode = "optimized" | "compatibility";

interface InterfaceDataConfig {
  mode: InterfaceDataMode;
}

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "interface-data.json");
const DEFAULT: InterfaceDataConfig = { mode: "optimized" };

function isInterfaceDataMode(value: unknown): value is InterfaceDataMode {
  return value === "optimized" || value === "compatibility";
}

export function getInterfaceDataMode(): InterfaceDataMode {
  const config = readJsonCached<Partial<InterfaceDataConfig>>(FILE, DEFAULT);
  return isInterfaceDataMode(config.mode) ? config.mode : DEFAULT.mode;
}

export function setInterfaceDataMode(mode: InterfaceDataMode): void {
  writeJsonCached(FILE, { mode: isInterfaceDataMode(mode) ? mode : DEFAULT.mode });
}

export function isOptimizedInterfaceDataEnabled(): boolean {
  return getInterfaceDataMode() === "optimized";
}
