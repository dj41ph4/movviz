import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadNamingTemplates, saveNamingTemplates } from "@/lib/naming/store";
import { DEFAULT_TEMPLATES } from "@/lib/naming/defaults";
import type { NamingTemplates } from "@/lib/naming/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(loadNamingTemplates());
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const templates: NamingTemplates = {
    enabled: body.enabled ?? DEFAULT_TEMPLATES.enabled,
    movieFolder: String(body.movieFolder ?? DEFAULT_TEMPLATES.movieFolder),
    movieFile: String(body.movieFile ?? DEFAULT_TEMPLATES.movieFile),
    seriesFolder: String(body.seriesFolder ?? DEFAULT_TEMPLATES.seriesFolder),
    seasonFolder: String(body.seasonFolder ?? DEFAULT_TEMPLATES.seasonFolder),
    episodeFile: String(body.episodeFile ?? DEFAULT_TEMPLATES.episodeFile),
    useDotsInsteadOfSpaces: !!body.useDotsInsteadOfSpaces,
  };
  saveNamingTemplates(templates);
  return NextResponse.json(templates);
}
