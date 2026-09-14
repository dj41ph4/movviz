import { NextRequest, NextResponse } from "next/server";
import { platform } from "node:os";
import { requireAdmin } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { getLibrarySections } from "@/lib/plex/client";
import type { PlexSection } from "@/lib/plex/types";
import {
  loadPathMappings,
  learnPathMapping,
  removePathMapping,
  type PathMapping,
} from "@/lib/plex/pathMappingStore";
import { offlineInstancesSnapshot } from "@/lib/engine/stateFile";
import { commonSuffixDepth } from "@/lib/library/pathSuffix";

export const dynamic = "force-dynamic";

export interface PathMappingSuggestion {
  plexPrefix: string;
  movvizPrefix: string;
  sectionTitle: string;
  kind: "movie" | "series";
}

function engineRoots(): { movies: string[]; series: string[] } {
  const movies = new Set<string>();
  const series = new Set<string>();
  for (const inst of offlineInstancesSnapshot()) {
    const p = String((inst as { completedPath?: unknown }).completedPath ?? "").trim();
    if (!p) continue;
    if (inst.category === "movie") movies.add(p);
    else if (inst.category === "series") series.add(p);
  }
  return { movies: [...movies], series: [...series] };
}

function alreadyCovered(mappings: PathMapping[], plexLocation: string): boolean {
  const loc = plexLocation.toLowerCase();
  return mappings.some((m) => loc.startsWith(m.plexPrefix.toLowerCase()));
}

/**
 * Compare chaque emplacement réel Plex (Location[]) avec les dossiers de
 * bibliothèque configurés côté torrent (completedPath engine) du même type.
 * Un suffixe commun (ex: Plex /volume1/docker/plex/film vs Movviz /data/film
 * → "film") suggère que c'est le même endroit vu de deux mounts — proposé à
 * validation humaine, jamais appliqué seul.
 */
function buildSuggestions(
  sections: PlexSection[],
  roots: { movies: string[]; series: string[] },
  mappings: PathMapping[]
): PathMappingSuggestion[] {
  const out: PathMappingSuggestion[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const kind = section.type === "movie" ? ("movie" as const) : ("series" as const);
    const candidates = kind === "movie" ? roots.movies : roots.series;
    for (const loc of section.locations ?? []) {
      if (!loc) continue;
      for (const root of candidates) {
        if (!root) continue;
        if (loc.toLowerCase() === root.toLowerCase()) continue; // même vue, rien à mapper
        if (alreadyCovered(mappings, loc)) continue;
        let depth = 0;
        try {
          depth = commonSuffixDepth(loc, root);
        } catch {
          depth = 0;
        }
        if (depth < 1) continue;
        const key = `${loc.toLowerCase()}→${root.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ plexPrefix: loc, movvizPrefix: root, sectionTitle: section.title, kind });
      }
    }
  }
  return out;
}

function cleanPrefix(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s || s.length > 500) return null;
  // Docker/Linux uniquement : chemins absolus POSIX.
  if (!s.startsWith("/")) return null;
  return s.replace(/\/+$/, "") || "/";
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Windows : on ne change rien — section masquée côté UI.
  if (platform() === "win32") {
    return NextResponse.json({
      supported: false,
      engineRoots: { movies: [], series: [] },
      sections: [],
      mappings: [],
      suggestions: [],
    });
  }
  const roots = engineRoots();
  const cfg = loadPlexConfig();
  let sections: PlexSection[] = [];
  if (cfg.hostname && cfg.adminToken) {
    try {
      sections = await getLibrarySections(cfg, cfg.adminToken);
    } catch {
      sections = [];
    }
  }
  const mappings = loadPathMappings();
  return NextResponse.json({
    supported: true,
    engineRoots: roots,
    sections: sections.map((s) => ({ key: s.key, type: s.type, title: s.title, locations: s.locations ?? [] })),
    mappings,
    suggestions: buildSuggestions(sections, roots, mappings),
  });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (platform() === "win32") return NextResponse.json({ error: "unsupported_on_windows" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const plexPrefix = cleanPrefix(body.plexPrefix);
  const movvizPrefix = cleanPrefix(body.movvizPrefix);
  if (!plexPrefix || !movvizPrefix) {
    return NextResponse.json({ error: "invalid_prefix (absolute POSIX path expected)" }, { status: 400 });
  }
  if (plexPrefix.toLowerCase() === movvizPrefix.toLowerCase()) {
    return NextResponse.json({ error: "identical_prefix" }, { status: 400 });
  }
  learnPathMapping(plexPrefix, movvizPrefix);
  return NextResponse.json({ ok: true, mappings: loadPathMappings() });
}

export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (platform() === "win32") return NextResponse.json({ error: "unsupported_on_windows" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const plexPrefix = String(body.plexPrefix ?? "").trim();
  const movvizPrefix = String(body.movvizPrefix ?? "").trim();
  if (!plexPrefix || !movvizPrefix) return NextResponse.json({ error: "missing_prefix" }, { status: 400 });
  const removed = removePathMapping(plexPrefix, movvizPrefix);
  return NextResponse.json({ ok: true, removed, mappings: loadPathMappings() });
}
