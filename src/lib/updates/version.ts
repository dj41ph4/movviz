import fs from "node:fs";
import path from "node:path";

let cached: string | null = null;

/** Reads the installed app version from package.json — works both in dev (repo root) and the installed Windows build (standalone output ships its own package.json). */
export function getAppVersion(): string {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    cached = JSON.parse(raw).version ?? "0.0.0";
  } catch {
    cached = "0.0.0";
  }
  return cached as string;
}
