import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import { lookupMedia } from "@/lib/extension/lookup";
import { requestMedia } from "@/lib/requests/requestMedia";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireExtensionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized", source: "extension" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = body.type === "series" ? "series" : body.type === "movie" ? "movie" : null;
  const tmdbId = Number(body.tmdbId);
  if (!type || !tmdbId) return NextResponse.json({ error: "type and tmdbId required" }, { status: 400 });

  const result = await requestMedia(user, type, tmdbId);
  if ("blocked" in result) return NextResponse.json({ error: "blocked" }, { status: 403 });
  if ("quotaReached" in result) return NextResponse.json({ error: "quota" }, { status: 429 });
  if ("error" in result) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const media = await lookupMedia({ type, tmdbId });
  return NextResponse.json({ ok: true, media });
}
