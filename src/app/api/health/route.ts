import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guard";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { tmdbConfigured } from "@/lib/metadata/tmdb";
import { loadIndexers } from "@/lib/indexers/store";
import { testIndexer } from "@/lib/indexers/torznab";

export const dynamic = "force-dynamic";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

/** Real diagnostics: pings the engine, TMDb config, every enabled indexer, and reads actual disk usage. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const engineHealth = await fetch(`${ENGINE_BASE}/health`, { headers: engineHeaders(), cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const indexers = loadIndexers().filter((i) => i.enabled);
  const indexerResults = await Promise.all(
    indexers.map(async (ix) => ({ name: ix.name, ok: (await testIndexer(ix)).ok }))
  );

  let disk: { total: number; free: number } | null = null;
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const stat = await fs.promises.statfs(CONFIG_DIR);
    disk = { total: stat.blocks * stat.bsize, free: stat.bfree * stat.bsize };
  } catch {
    disk = null;
  }

  // Per-process resource footprint — when the machine is pegged, this shows
  // WHICH process (web app vs download engine) is actually responsible.
  const cpu = process.cpuUsage();
  const processes = {
    web: {
      rssBytes: process.memoryUsage().rss,
      cpuMs: Math.round((cpu.user + cpu.system) / 1000),
      uptimeMs: Math.round(process.uptime() * 1000),
    },
    engine: engineHealth
      ? {
          rssBytes: engineHealth.rssBytes ?? null,
          cpuMs: engineHealth.cpuMs ?? null,
          uptimeMs: engineHealth.uptimeMs ?? null,
        }
      : null,
  };

  return NextResponse.json({
    engine: !!engineHealth,
    tmdb: tmdbConfigured(),
    indexers: indexerResults,
    disk,
    processes,
  });
}
