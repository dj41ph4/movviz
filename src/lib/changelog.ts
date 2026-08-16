import fs from "node:fs";
import path from "node:path";

export interface ChangelogSection {
  heading: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
}

/**
 * CHANGELOG.md is the single source, in French, for every audience (GitHub
 * and the in-app "what's new" popup alike — AGENTS.md: everything
 * GitHub-visible is French). There used to be a per-locale
 * CHANGELOG.<locale>.md translation set, but CHANGELOG.md itself drifted to
 * French directly (matching the repo-wide French rule) while the
 * translated files silently stopped being updated after v1.13.72 — meaning
 * every non-French interface language actually fell back to raw French
 * text anyway. Removed rather than resurrected: one file, always in
 * French, is simpler and matches what was already true in practice.
 */
const DEFAULT_FILE = path.join(process.cwd(), "CHANGELOG.md");
const VERSION_HEADER = /^##\s+(?:v|\[)?([\d.]+)(?:\])?(?:\s+—\s+(.+))?/;

/** Pulls the "for humans" release notes for one version straight out of
 *  CHANGELOG.md. */
export function getChangelogEntry(version: string): ChangelogEntry | null {
  return readEntry(DEFAULT_FILE, version);
}

function readEntry(FILE: string, version: string): ChangelogEntry | null {
  if (!fs.existsSync(FILE)) return null;
  const lines = fs.readFileSync(FILE, "utf8").split("\n");

  let start = -1;
  let matchedDate: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(VERSION_HEADER);
    if (m && m[1] === version) {
      start = i;
      matchedDate = m[2] ?? null;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;
  for (const line of lines.slice(start + 1, end)) {
    const heading = line.match(/^###\s+(.+)/);
    if (heading) {
      current = { heading: heading[1].trim(), items: [] };
      sections.push(current);
      continue;
    }
    const bullet = line.match(/^-\s+(.+)/);
    if (bullet && current) current.items.push(bullet[1].trim());
  }

  return { version, date: matchedDate, sections };
}

function parseVersion(v: string): number[] {
  return v.split(".").map((n) => parseInt(n, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function readRange(FILE: string): { version: string; date: string | null; sections: ChangelogSection[] }[] {
  if (!fs.existsSync(FILE)) return [];
  const lines = fs.readFileSync(FILE, "utf8").split("\n");

  const headers: { version: string; date: string | null; start: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(VERSION_HEADER);
    if (m) headers.push({ version: m[1], date: m[2] ?? null, start: i });
  }

  const out: { version: string; date: string | null; sections: ChangelogSection[] }[] = [];
  for (let h = 0; h < headers.length; h++) {
    const { version, date, start } = headers[h];
    const end = h + 1 < headers.length ? headers[h + 1].start : lines.length;
    const sections: ChangelogSection[] = [];
    let current: ChangelogSection | null = null;
    for (const line of lines.slice(start + 1, end)) {
      const heading = line.match(/^###\s+(.+)/);
      if (heading) {
        current = { heading: heading[1].trim(), items: [] };
        sections.push(current);
        continue;
      }
      const bullet = line.match(/^-\s+(.+)/);
      if (bullet && current) current.items.push(bullet[1].trim());
    }
    out.push({ version, date, sections });
  }
  return out;
}

/**
 * Every changelog entry strictly newer than `since` (exclusive) up to and
 * including `upTo`, newest first — for a user who hasn't opened the app in a
 * while and should see everything they missed, not just the latest release.
 * `since === null` (never seen a version before) returns just `upTo`, same
 * as the single-entry behavior this replaces.
 */
export function getChangelogRange(since: string | null, upTo: string): ChangelogEntry[] {
  const all = readRange(DEFAULT_FILE).filter((e) => e.sections.length > 0);

  const entries: ChangelogEntry[] = [];
  for (const e of all) {
    if (compareVersions(e.version, upTo) > 0) continue;
    if (since !== null && compareVersions(e.version, since) <= 0) continue;
    entries.push(e);
  }
  entries.sort((a, b) => compareVersions(b.version, a.version));
  return entries;
}
