import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import type { NamingTemplates } from "./types";
import { DEFAULT_TEMPLATES } from "./defaults";

/**
 * Naming templates live in the shared config directory as plain JSON — the
 * same file the download engine reads directly (no HTTP round-trip needed
 * since web and engine share the filesystem on every supported deployment).
 */
const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "naming.json");

export function loadNamingTemplates(): NamingTemplates {
  return { ...DEFAULT_TEMPLATES, ...readJsonCached<Partial<NamingTemplates>>(FILE, {}) };
}

export function saveNamingTemplates(templates: NamingTemplates) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, templates);
}
