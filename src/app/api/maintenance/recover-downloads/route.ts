import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fsp from "node:fs/promises";
import { requireAdmin } from "@/lib/auth/guard";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { loadNamingTemplates } from "@/lib/naming/store";
import { parseRelease } from "@/lib/naming/parser";
import { buildContext, renderSegment } from "@/lib/naming/render";
import type { ReleaseInfo } from "@/lib/naming/types";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";

export const dynamic = "force-dynamic";

const VIDEO_EXT_RE = /\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i;

interface Recovered { title: string; src: string; dest: string; size: number; season?: number; episode?: number }
interface Failed { src: string; size: number; reason: string }
interface Duplicate { src: string; size: number }

function norm(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[._\s\-–:!?,;'"()]+/g, " ")
    .trim();
}

function fuzzyMatch(parsedTitle: string, libTitle: string): boolean {
  const p = norm(parsedTitle);
  const l = norm(libTitle);
  if (l.includes(p) || p.includes(l)) return true;
  const pWords = p.split(" ").filter((w) => w.length > 1);
  const lWords = l.split(" ").filter((w) => w.length > 1);
  if (pWords.length === 0 || lWords.length === 0) return false;
  const overlap = pWords.filter((w) => lWords.includes(w)).length;
  return overlap / Math.max(pWords.length, lWords.length) >= 0.6;
}

async function scanVideoFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(d: string) {
    try {
      const entries = await fsp.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) { await walk(full); }
        else if (VIDEO_EXT_RE.test(e.name)) { results.push(full); }
      }
    } catch { /* skip inaccessible dirs */ }
  }
  await walk(dir);
  return results;
}

async function getFileAgeMs(fp: string): Promise<number> {
  try { return Date.now() - (await fsp.stat(fp)).mtimeMs; } catch { return 0; }
}

// ─── POST: scan + recover ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const instRes = await fetch(`${ENGINE_BASE}/instances`, {
      headers: engineHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!instRes.ok) return NextResponse.json({ error: "engine_unreachable" }, { status: 503 });
    const { instances } = await instRes.json() as {
      instances: Array<{ id: string; category: string; downloadPath: string; completedPath: string }>;
    };
    if (!instances?.length) return NextResponse.json({ error: "no_instances" }, { status: 404 });

    const movies = loadMovies();
    const series = loadSeries();
    const naming = loadNamingTemplates();
    const recovered: Recovered[] = [];
    const failed: Failed[] = [];
    const duplicates: Duplicate[] = [];

    for (const inst of instances) {
      const files = await scanVideoFiles(inst.downloadPath);
      for (const fp of files) {
        const age = await getFileAgeMs(fp);
        if (age < 30_000) continue;

        const size = await fsp.stat(fp).then((s) => s.size).catch(() => 0);
        const basename = path.basename(fp);
        const parsed = parseRelease(basename);
        const parsedTitle = parsed.title;
        if (!parsedTitle || parsedTitle.length < 2) {
          failed.push({ src: fp, size, reason: "Impossible d'extraire un titre du nom de fichier" });
          continue;
        }

        let dest: string | null = null;
        let label = "";

        if (inst.category === "movie") {
          const match = movies.find((m) => fuzzyMatch(parsedTitle, m.title));
          if (match) {
            const ctx = buildContext({ ...parsed, title: match.title, year: String(match.year ?? "") } as ReleaseInfo);
            const folder = renderSegment(naming.movieFolder, ctx, naming.useDotsInsteadOfSpaces);
            const file = renderSegment(naming.movieFile, ctx, naming.useDotsInsteadOfSpaces);
            const ext = path.extname(fp);
            dest = path.join(inst.completedPath, folder, file + ext);
            label = match.title;
          }
        } else if (inst.category === "series") {
          const sMatch = series.find((s) => fuzzyMatch(parsedTitle, s.title));
          if (sMatch) {
            if (parsed.season == null) {
              failed.push({ src: fp, size, reason: `Série "${sMatch.title}" trouvée mais saison non détectée` });
              continue;
            }
            const ctx = buildContext({ ...parsed, title: sMatch.title, year: String(sMatch.year ?? "") } as ReleaseInfo);
            const seriesFolder = renderSegment(naming.seriesFolder, ctx, naming.useDotsInsteadOfSpaces);
            const seasonFolder = renderSegment(naming.seasonFolder, ctx, naming.useDotsInsteadOfSpaces);
            const file = renderSegment(naming.episodeFile, ctx, naming.useDotsInsteadOfSpaces);
            const ext = path.extname(fp);
            dest = path.join(inst.completedPath, seriesFolder, seasonFolder, file + ext);
            const ep = parsed.episode != null ? String(parsed.episode).padStart(2, "0") : "XX";
            label = `${sMatch.title} S${String(parsed.season).padStart(2, "0")}E${ep}`;
          }
        }

        if (dest) {
          try {
            try { await fsp.access(dest); failed.push({ src: fp, size, reason: "Existe déjà dans la bibliothèque" }); duplicates.push({ src: fp, size }); continue; } catch {}
            await fsp.mkdir(path.dirname(dest), { recursive: true });
            await fsp.rename(fp, dest);
            recovered.push({ title: label, src: fp, dest, size, season: parsed.season ?? undefined, episode: parsed.episode ?? undefined });
          } catch (e) {
            failed.push({ src: fp, size, reason: (e as Error).message });
          }
        } else {
          failed.push({ src: fp, size, reason: "Aucune correspondance trouvée dans la bibliothèque" });
        }
      }
    }

    return NextResponse.json({
      recovered, failed, duplicates,
      summary: `${recovered.length} récupéré(s), ${failed.length} ignoré(s), ${duplicates.length} doublon(s)`,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ─── DELETE: clean duplicates from download folder ──────────────────────

export async function DELETE(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const { files } = await req.json() as { files?: string[] };
    if (!files?.length) return NextResponse.json({ error: "no files" }, { status: 400 });

    let deleted = 0;
    let errors = 0;
    for (const f of files) {
      try { await fsp.unlink(f); deleted++; } catch { errors++; }
    }
    return NextResponse.json({ deleted, errors });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
