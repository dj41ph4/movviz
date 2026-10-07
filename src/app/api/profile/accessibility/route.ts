import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getUserById, updateUser } from "@/lib/auth/store";
import { desktopTextScaleOrDefault, isDesktopTextScale } from "@/lib/accessibility/textScale";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ desktopTextScale: desktopTextScaleOrDefault(getUserById(user.id)?.desktopTextScale) });
}

export async function PUT(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!isDesktopTextScale(body?.desktopTextScale)) {
    return NextResponse.json({ error: "invalid_text_scale" }, { status: 400 });
  }
  // The authenticated account is always the target, including for admins.
  const updated = updateUser(user.id, { desktopTextScale: body.desktopTextScale });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ desktopTextScale: updated.desktopTextScale });
}
