import { NextRequest, NextResponse } from "next/server";
import { Session } from "node:inspector/promises";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * CPU profile of the running server, for the server freezes the block probe
 * measures but cannot explain (which function holds the thread, not only
 * which task was running). Admin only, one at a time, 5-120 s. Returns the
 * functions that used the most CPU time themselves (« self ») and with
 * everything they called (« total »), our own code first.
 */

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
  children?: number[];
}
interface CpuProfile { nodes: ProfileNode[]; samples?: number[]; timeDeltas?: number[]; startTime: number; endTime: number }

const g = globalThis as typeof globalThis & { __movvizProfiling?: boolean };

function label(node: ProfileNode): string {
  const { functionName, url, lineNumber } = node.callFrame;
  const file = url.replace(/^.*\/(\.next|node_modules|src)\//, "$1/").replace(/^file:\/\//, "");
  return `${functionName || "(anonyme)"} ${file ? `${file}:${lineNumber + 1}` : ""}`.trim();
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (g.__movvizProfiling) return NextResponse.json({ error: "already_profiling" }, { status: 409 });
  const seconds = Math.min(120, Math.max(5, Number(req.nextUrl.searchParams.get("seconds")) || 30));

  g.__movvizProfiling = true;
  const session = new Session();
  session.connect();
  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.setSamplingInterval", { interval: 1000 });
    await session.post("Profiler.start");
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    const { profile } = (await session.post("Profiler.stop")) as unknown as { profile: CpuProfile };

    // Time per sample, then self time per node.
    const sampleMs = new Map<number, number>();
    const samples = profile.samples ?? [];
    const deltas = profile.timeDeltas ?? [];
    for (let i = 0; i < samples.length; i++) sampleMs.set(samples[i], (sampleMs.get(samples[i]) ?? 0) + (deltas[i] ?? 0) / 1000);

    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map<number, number>();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);

    const self = new Map<string, number>();
    const total = new Map<string, number>();
    for (const [id, ms] of sampleMs) {
      const node = byId.get(id);
      if (!node) continue;
      self.set(label(node), (self.get(label(node)) ?? 0) + ms);
      // Every distinct frame on the stack counts the sample once in « total ».
      const seen = new Set<string>();
      for (let cur: number | undefined = id; cur != null; cur = parent.get(cur)) {
        const frame = byId.get(cur);
        if (!frame) break;
        const key = label(frame);
        if (seen.has(key)) continue;
        seen.add(key);
        total.set(key, (total.get(key) ?? 0) + ms);
      }
    }
    const ignore = /^\((idle|program|root|garbage collector)\)/;
    const top = (map: Map<string, number>, onlyOurs: boolean) => [...map.entries()]
      .filter(([k]) => !ignore.test(k) && (!onlyOurs || /src\//.test(k)))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([fn, ms]) => ({ fn, ms: Math.round(ms) }));
    const busyMs = [...sampleMs.entries()].reduce((sum, [id, ms]) => {
      const name = byId.get(id)?.callFrame.functionName ?? "";
      return name === "(idle)" ? sum : sum + ms;
    }, 0);
    return NextResponse.json({
      seconds,
      busyMs: Math.round(busyMs),
      self: top(self, false),
      totalOurs: top(total, true),
      selfOurs: top(self, true),
    });
  } finally {
    await session.post("Profiler.disable").catch(() => {});
    session.disconnect();
    g.__movvizProfiling = false;
  }
}
