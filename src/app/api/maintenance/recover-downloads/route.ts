import { NextRequest, NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guard";
import { recoverDownloads } from "@/lib/library/recoverDownloads";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";

export const dynamic = "force-dynamic";

// ─── POST: scan + recover ───────────────────────────────────────────────
// Thin HTTP wrapper over the shared recoverDownloads() implementation — the
// scheduled stuck-download detection calls the same function.

export async function POST(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    // Batch mode: the client splits a big run into chunks of 20 files and
    // re-invokes with the accumulated `processed` list until hasMore=false —
    // a single synchronous request over a large download folder would
    // otherwise time out and the huge JSON response would freeze the UI.
    const { batchSize, processed } = await req.json().catch(() => ({})) as { batchSize?: number; processed?: string[] };
    const result = await recoverDownloads(undefined, { batchSize: batchSize ?? 20, processed });
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "engine_unreachable") return NextResponse.json({ error: "engine_unreachable" }, { status: 503 });
    if (msg === "no_instances") return NextResponse.json({ error: "no_instances" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE: clean duplicates from download folder ──────────────────────

/**
 * Unlink a list of duplicate files reported by the POST scan. SECURITY: every
 * path is validated against the engine's own download folders before unlink —
 * the pre-review version unlinked whatever the client sent, letting a
 * misconfigured downloadPath turn the whole library into "duplicates" and a
 * click into a mass deletion. Only paths strictly inside a known download
 * folder are ever touched.
 */
export async function DELETE(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const { files } = await req.json() as { files?: string[] };
    if (!files?.length) return NextResponse.json({ error: "no files" }, { status: 400 });

    let allowedRoots: string[] = [];
    try {
      const res = await fetch(`${ENGINE_BASE}/instances`, {
        headers: engineHeaders(),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const { instances } = await res.json() as { instances?: Array<{ downloadPath?: string }> };
        allowedRoots = (instances ?? [])
          .map((i) => path.resolve(i.downloadPath ?? ""))
          .filter((p) => p && p.split(/[\\/]/).filter(Boolean).length >= 2);
      }
    } catch { /* engine down → nothing gets deleted */ }

    let deleted = 0;
    let errors = 0;
    for (const f of files) {
      const resolved = path.resolve(f);
      const inside = allowedRoots.some((root) => resolved.startsWith(root + path.sep));
      if (!inside) { errors++; continue; }
      try { await fsp.unlink(resolved); deleted++; } catch { errors++; }
    }
    return NextResponse.json({ deleted, errors });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
