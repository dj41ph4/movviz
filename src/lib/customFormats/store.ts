import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { CustomFormat } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "customFormats.json");

/**
 * Seeded on first run — French-audio preference is the concrete case this
 * feature exists for. Both are enabled by default but harmless for any other
 * language setup: they just never match and contribute nothing.
 */
const DEFAULT_FORMATS: CustomFormat[] = [
  {
    id: "cf_default_fr_preferred",
    name: "Audio français préféré",
    i18nKey: "customFormats.defaultFrenchPreferred",
    score: 25,
    terms: ["\\bmulti\\b", "\\bvff?\\b", "\\bvfq\\b", "\\btruefrench\\b", "\\bvfi\\b", "\\bvostfr\\b"],
    enabled: true,
  },
  {
    id: "cf_default_fr_avoided",
    name: "Audio français à éviter",
    i18nKey: "customFormats.defaultFrenchAvoided",
    score: -20,
    terms: ["\\bsubfrench\\b"],
    enabled: true,
  },
];

function read(): CustomFormat[] {
  const list = readJsonCached<CustomFormat[] | null>(FILE, null);
  if (list) return list;
  write(DEFAULT_FORMATS);
  return DEFAULT_FORMATS;
}
function write(list: CustomFormat[]) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, list);
}

export function loadCustomFormats(): CustomFormat[] {
  return read();
}
export function addCustomFormat(cf: CustomFormat): CustomFormat {
  const list = read();
  list.push(cf);
  write(list);
  return cf;
}
export function updateCustomFormat(id: string, patch: Partial<CustomFormat>): CustomFormat | null {
  const list = read();
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  write(list);
  return list[i];
}
export function removeCustomFormat(id: string) {
  write(read().filter((c) => c.id !== id));
}
