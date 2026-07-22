import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadDiscoverLayout, saveDiscoverLayout } from "@/lib/metadata/discoverStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ layout: loadDiscoverLayout() });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { layout } = await req.json();
  if (layout !== "movviz" && layout !== "allocine") {
    return NextResponse.json({ error: "invalid layout" }, { status: 400 });
  }
  saveDiscoverLayout(layout);
  return NextResponse.json({ layout });
}
