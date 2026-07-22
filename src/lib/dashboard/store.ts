import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { DEFAULT_DASHBOARD_LAYOUT, sanitizeDashboardLayout, type DashboardLayout } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "dashboards.json");

type Store = Record<string, DashboardLayout>;

function read(): Store {
  return readJsonCached<Store>(FILE, {});
}

function write(data: Store) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, data);
}

export function loadDashboardLayout(userId: string): DashboardLayout {
  const data = read();
  return data[userId] ?? DEFAULT_DASHBOARD_LAYOUT;
}

export function saveDashboardLayout(userId: string, layout: unknown): DashboardLayout {
  const clean = sanitizeDashboardLayout(layout);
  const data = read();
  data[userId] = clean;
  write(data);
  return clean;
}
