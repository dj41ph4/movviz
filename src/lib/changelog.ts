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

const FILE = path.join(process.cwd(), "CHANGELOG.md");
const VERSION_HEADER = /^##\s+\[([\d.]+)\](?:\s+—\s+(.+))?/;

/**
 * Pulls the "for humans" release notes for one version straight out of
 * CHANGELOG.md — the file itself is the single source of truth (already
 * required to be plain French for end users), so the in-app "what's new"
 * popup and the file people read on GitHub never drift apart.
 */
export function getChangelogEntry(version: string): ChangelogEntry | null {
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

/**
 * Every changelog entry strictly newer than `since` (exclusive) up to and
 * including `upTo`, newest first — for a user who hasn't opened the app in a
 * while and should see everything they missed, not just the latest release.
 * `since === null` (never seen a version before) returns just `upTo`, same
 * as the single-entry behavior this replaces.
 */
export function getChangelogRange(since: string | null, upTo: string): ChangelogEntry[] {
  if (!fs.existsSync(FILE)) return [];
  const lines = fs.readFileSync(FILE, "utf8").split("\n");

  const headers: { version: string; date: string | null; start: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(VERSION_HEADER);
    if (m) headers.push({ version: m[1], date: m[2] ?? null, start: i });
  }

  const entries: ChangelogEntry[] = [];
  for (let h = 0; h < headers.length; h++) {
    const { version, date, start } = headers[h];
    if (compareVersions(version, upTo) > 0) continue;
    if (since !== null && compareVersions(version, since) <= 0) continue;

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
    if (sections.length > 0) entries.push({ version, date, sections });
  }

  return entries;
}
