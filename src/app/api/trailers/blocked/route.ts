import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { isValidVideoKey, markVideosBlocked } from "@/lib/trailers/blockedVideos";
import { fallbackTrailerKeys } from "@/lib/trailers/fallbackTrailers";

export const dynamic = "force-dynamic";

/**
 * Called by the ambient trailer player once every candidate of a title has
 * refused to play embedded (YouTube 101/150). Records those keys as blocked
 * for everyone, then answers with replacement trailers found on YouTube
 * (official channels and anime publishers first), already excluding any
 * known-blocked key.
 */
export async function POST(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { keys?: unknown; title?: unknown; year?: unknown; language?: unknown } | null;
  const keys = Array.isArray(body?.keys) ? body.keys.filter((k): k is string => typeof k === "string" && isValidVideoKey(k)).slice(0, 10) : [];
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  const year = typeof body?.year === "number" && Number.isFinite(body.year) ? body.year : null;
  const language = typeof body?.language === "string" && /^[a-z]{2}$/.test(body.language) ? body.language : "fr";
  if (!title || keys.length === 0) return NextResponse.json({ error: "invalid_params" }, { status: 400 });

  markVideosBlocked(keys);
  const replacements = (await fallbackTrailerKeys(title, year, language)).filter((k) => !keys.includes(k));
  return NextResponse.json({ keys: replacements.slice(0, 5) });
}
