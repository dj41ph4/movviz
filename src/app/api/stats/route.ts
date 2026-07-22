import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guard";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { loadRequests } from "@/lib/requests/store";
import { loadNotifications } from "@/lib/notifications/store";
import { loadIndexers } from "@/lib/indexers/store";

export const dynamic = "force-dynamic";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const movies = loadMovies();
  const series = loadSeries();
  const requests = loadRequests();
  const notifications = loadNotifications();
  const indexers = loadIndexers();

  const totalEpisodes = series
    .flatMap((s) => s.seasons.flatMap((se) => se.episodes))
    .filter((e) => e.status === "available").length;

  const days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const count = notifications.filter(
      (n) =>
        (n.kind === "grab_movie" || n.kind === "grab_movie_upgrade" || n.kind === "grab_episode") &&
        new Date(n.createdAt).toISOString().slice(0, 10) === iso
    ).length;
    days.push({ date: iso, count });
  }

  let disk: { total: number; free: number } | null = null;
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const stat = await fs.promises.statfs(CONFIG_DIR);
    disk = { total: stat.blocks * stat.bsize, free: stat.bfree * stat.bsize };
  } catch {
    disk = null;
  }

  return NextResponse.json({
    totalMovies: movies.length,
    totalSeries: series.length,
    totalEpisodes,
    requests: {
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      declined: requests.filter((r) => r.status === "declined").length,
    },
    indexerCount: indexers.filter((i) => i.enabled).length,
    grabsByDay: days,
    disk,
  });
}
