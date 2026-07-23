import fs from "node:fs";
import path from "node:path";
import { engineRoots } from "./indexScan";

const SYSTEM_FILES = new Set([".ds_store", "thumbs.db", "@eadir", "desktop.ini"]);

function isSystemFile(name: string): boolean {
  return SYSTEM_FILES.has(name.toLowerCase());
}

function realEntries(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((n) => !isSystemFile(n));
  } catch {
    return [];
  }
}

export function scanEmptyDirs(roots: string[]): string[] {
  const empty: string[] = [];

  function walk(dir: string): boolean {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }

    const nonSystem = entries.filter((e) => !isSystemFile(e.name));
    if (nonSystem.length === 0) {
      empty.push(dir);
      return true;
    }

    const files = nonSystem.filter((e) => !e.isDirectory());
    if (files.length > 0) return false;

    const subdirs = nonSystem.filter((e) => e.isDirectory());
    const allEmpty = subdirs.every((d) => walk(path.join(dir, d.name)));
    if (allEmpty) {
      empty.push(dir);
      return true;
    }
    return false;
  }

  for (const root of roots) {
    try {
      if (fs.statSync(root).isDirectory()) walk(root);
    } catch {
      // skip inaccessible roots
    }
  }

  return empty.sort((a, b) => b.length - a.length || b.split(path.sep).length - a.split(path.sep).length);
}

export function deleteEmptyDirs(paths: string[]): { deleted: number } {
  let deleted = 0;

  const sorted = [...paths].sort(
    (a, b) => b.split(path.sep).length - a.split(path.sep).length || b.length - a.length
  );

  for (const dir of sorted) {
    try {
      fs.rmdirSync(dir);
      deleted++;

      let parent = path.dirname(dir);
      let prevParent: string | null = null;
      while (parent && parent !== prevParent) {
        const remaining = realEntries(parent);
        if (remaining.length === 0) {
          fs.rmdirSync(parent);
          deleted++;
          prevParent = parent;
          parent = path.dirname(parent);
        } else {
          break;
        }
      }
    } catch {
      // not empty anymore — skip
    }
  }

  return { deleted };
}
