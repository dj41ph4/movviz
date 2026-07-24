import { NextRequest, NextResponse } from "next/server";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { releaseAllDownloadClaims } from "@/lib/library/downloadState";
import { requireUser, requireAdmin } from "@/lib/auth/guard";
import { eventBus } from "@/lib/events/EventBus";

/**
 * Same-origin proxy to the download engine. The browser calls /api/engine/*,
 * this forwards the request to the loopback engine (9820) and relays the JSON
 * response. Reads (GET) are open to any signed-in user, since the download
 * queue is visible on the dashboard and Activity page for everyone. Writes
 * (POST/PATCH/DELETE — pause, resume, delete, add a magnet, clear the queue)
 * are admin-only: the UI already hides those controls from regular users,
 * but that's cosmetic, so it must also be enforced here or a signed-in user
 * could call this proxy directly to bypass it.
 */

export const dynamic = "force-dynamic";

async function forward(req: NextRequest, path: string[]) {
  const authed = req.method === "GET" ? requireUser(req) : requireAdmin(req);
  if (!authed) return NextResponse.json({ error: req.method === "GET" ? "unauthorized" : "forbidden" }, { status: req.method === "GET" ? 401 : 403 });
  const target = `${ENGINE_BASE}/${path.join("/")}${req.nextUrl.search}`;
  const method = req.method;

  const init: RequestInit = {
    method,
    headers: engineHeaders(
      method === "GET" || method === "DELETE"
        ? {}
        : { "content-type": "application/json" }
    ),
    cache: "no-store",
    signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
  };
  if (method !== "GET" && method !== "DELETE") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(target, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "engine_unreachable", detail: "The download engine is not running or timed out." },
      { status: 503 }
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return forward(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const res = await forward(req, path);
  if (res.ok && path[0] === "torrents") {
    eventBus.emit({ type: "download_changed" });
  }
  return res;
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const res = await forward(req, path);
  if (res.ok && path[0] === "torrents" && path[1]) {
    releaseAllDownloadClaims(path[1]);
    eventBus.emit({ type: "download_changed" });
  }
  return res;
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const path = (await params).path;
  const res = await forward(req, path);
  if (res.ok && path[0] === "torrents") {
    eventBus.emit({ type: "download_changed" });
  }
  return res;
}
