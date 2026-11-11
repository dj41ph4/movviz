import { NextRequest, NextResponse } from "next/server";
import { Session } from "node:inspector";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProfileNode = {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
  children?: number[];
};
type Profile = { nodes: ProfileNode[]; samples?: number[]; timeDeltas?: number[]; startTime: number; endTime: number };

let running = false;

/**
 * Profil CPU du processus web pendant N secondes (5 à 60, 20 par défaut), réservé aux admins.
 * Renvoie les fonctions qui ont consommé le plus de temps propre, regroupées par fonction + fichier :
 * de quoi voir ce qui occupe le serveur sans redémarrer ni changer sa configuration.
 */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (running) return NextResponse.json({ error: "already_running" }, { status: 409 });
  const requested = Number(req.nextUrl.searchParams.get("seconds"));
  const seconds = Number.isFinite(requested) ? Math.min(60, Math.max(5, Math.round(requested))) : 20;

  running = true;
  const session = new Session();
  try {
    session.connect();
    const post = <T = unknown>(method: string, params?: object) =>
      new Promise<T>((resolve, reject) => session.post(method, params ?? {}, (err, res) => (err ? reject(err) : resolve(res as T))));
    await post("Profiler.enable");
    await post("Profiler.setSamplingInterval", { interval: 1000 });
    await post("Profiler.start");
    await new Promise((r) => setTimeout(r, seconds * 1000));
    const { profile } = await post<{ profile: Profile }>("Profiler.stop");

    // Temps propre par nœud : chaque échantillon est attribué à son nœud, durée = delta de temps qui suit.
    const selfUs = new Map<number, number>();
    const samples = profile.samples ?? [];
    const deltas = profile.timeDeltas ?? [];
    for (let i = 0; i < samples.length; i++) selfUs.set(samples[i], (selfUs.get(samples[i]) ?? 0) + (deltas[i] ?? 0));

    const byFn = new Map<string, { ms: number; fn: string; url: string; line: number }>();
    let totalUs = 0;
    for (const node of profile.nodes) {
      const us = selfUs.get(node.id) ?? 0;
      totalUs += us;
      if (us <= 0) continue;
      const fn = node.callFrame.functionName || "(anonyme)";
      const url = node.callFrame.url.replace(/^file:\/\//, "").replace(/.*\/(?=\.next|node_modules|src)/, "");
      const k = `${fn}|${url}|${node.callFrame.lineNumber}`;
      const cur = byFn.get(k) ?? { ms: 0, fn, url, line: node.callFrame.lineNumber + 1 };
      cur.ms += us / 1000;
      byFn.set(k, cur);
    }
    const top = [...byFn.values()]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 25)
      .map((x) => ({ ms: Math.round(x.ms), pct: Math.round((x.ms * 1000 * 1000) / Math.max(1, totalUs)) / 10, fn: x.fn, where: `${x.url}:${x.line}` }));
    const idle = byFn.get(`(idle)||-1`)?.ms ?? 0;
    return NextResponse.json({ seconds, cpuBusyMs: Math.round(totalUs / 1000 - idle), top });
  } catch (e) {
    return NextResponse.json({ error: "profile_failed", detail: String(e) }, { status: 500 });
  } finally {
    try { session.disconnect(); } catch { /* déjà fermée */ }
    running = false;
  }
}
